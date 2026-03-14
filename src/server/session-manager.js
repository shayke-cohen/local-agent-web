/**
 * SessionManager — manages multiple Claude Agent SDK sessions.
 *
 * Uses the V1 query() API with the `resume` option for multi-turn support
 * and proper plugin loading. Sessions use framework-generated UUIDs as keys;
 * the SDK's internal session ID is captured from system/init events.
 */

import { randomUUID } from 'crypto';
import { createEnvelope } from '../protocol/envelope.js';
import {
  MSG_CHAT_STREAM,
  MSG_CHAT_ASSISTANT,
  MSG_CHAT_TOOL_USE,
  MSG_CHAT_TOOL_RESULT,
  MSG_CHAT_STATUS,
  MSG_CHAT_ERROR,
  MSG_SESSION_CREATED,
  MSG_SESSION_RESUMED,
  MSG_SESSION_CLOSED,
  ChatStatus,
} from '../protocol/messages.js';

/**
 * @typedef {object} SessionEntry
 * @property {string} sessionId - Framework-assigned UUID
 * @property {string|null} sdkSessionId - SDK-assigned ID (resolved lazily)
 * @property {object} sdkOptions - Options passed to sdk.query() on each message
 * @property {object|null} activeQuery - Currently running query (null when idle)
 * @property {boolean} streaming - Whether the session is currently streaming
 * @property {import('../protocol/config.js').AgentConfig} config - Resolved config
 * @property {function} onMessage - Callback for protocol envelopes
 * @property {number} createdAt
 */

export class SessionManager {
  constructor() {
    /** @type {Map<string, SessionEntry>} */
    this._sessions = new Map();
    this._sdk = null;
  }

  /**
   * Lazily load the Agent SDK. Allows the framework to work without
   * the SDK installed (for testing, or client-only usage).
   * @returns {Promise<object>}
   */
  async _getSDK() {
    if (this._sdk) return this._sdk;
    try {
      this._sdk = await import('@anthropic-ai/claude-agent-sdk');
      return this._sdk;
    } catch {
      throw new Error(
        'Agent SDK not installed. Run: npm install @anthropic-ai/claude-agent-sdk'
      );
    }
  }

  /**
   * Create a new session.
   * With the V1 API, we don't create the SDK session upfront — we store
   * the options and create a query() on each sendMessage().
   * @param {object} sdkOptions - Options for query()
   * @param {import('../protocol/config.js').AgentConfig} resolvedConfig
   * @param {function} onMessage - Callback receiving protocol envelopes
   * @returns {Promise<string>} sessionId
   */
  async createSession(sdkOptions, resolvedConfig, onMessage) {
    // Verify SDK is available
    await this._getSDK();

    const sessionId = randomUUID();

    this._sessions.set(sessionId, {
      sessionId,
      sdkSessionId: null,
      sdkOptions,
      activeQuery: null,
      streaming: false,
      config: resolvedConfig,
      onMessage: onMessage || (() => {}),
      createdAt: Date.now(),
    });

    this._emit(sessionId, MSG_SESSION_CREATED, {
      sessionId,
      config: this._sanitizeConfigForClient(resolvedConfig),
    });

    return sessionId;
  }

  /**
   * Resume an existing session by ID.
   * @param {string} sessionId
   * @param {object} sdkOptions
   * @param {import('../protocol/config.js').AgentConfig} resolvedConfig
   * @param {function} onMessage
   * @returns {Promise<string>} sessionId
   */
  async resumeSession(sessionId, sdkOptions, resolvedConfig, onMessage) {
    // Verify SDK is available
    await this._getSDK();

    this._sessions.set(sessionId, {
      sessionId,
      sdkSessionId: sessionId,
      sdkOptions,
      activeQuery: null,
      streaming: false,
      config: resolvedConfig,
      onMessage: onMessage || (() => {}),
      createdAt: Date.now(),
    });

    this._emit(sessionId, MSG_SESSION_RESUMED, {
      sessionId,
      config: this._sanitizeConfigForClient(resolvedConfig),
    });

    return sessionId;
  }

  /**
   * Send a user message and stream the response.
   * Creates a new query() for each message, using `resume` for continuity.
   * @param {string} sessionId
   * @param {string} text
   */
  async sendMessage(sessionId, text) {
    const entry = this._sessions.get(sessionId);
    if (!entry) {
      throw new Error(`No session with id: ${sessionId}`);
    }

    if (entry.streaming) {
      throw new Error('Session is already streaming. Wait for completion or call stop().');
    }

    entry.streaming = true;
    this._emit(sessionId, MSG_CHAT_STATUS, { status: ChatStatus.THINKING });

    try {
      const sdk = await this._getSDK();

      // Build options for this query, adding resume if we have a prior session
      const opts = { ...entry.sdkOptions };
      if (entry.sdkSessionId) {
        opts.resume = entry.sdkSessionId;
      }

      const q = sdk.query({ prompt: text, options: opts });
      entry.activeQuery = q;

      let currentText = '';

      for await (const msg of q) {
        if (!entry.streaming) break;

        // Capture the SDK session ID from system init message
        if (msg.type === 'system' && msg.session_id && !entry.sdkSessionId) {
          entry.sdkSessionId = msg.session_id;
        }

        if (msg.type === 'assistant') {
          const textBlocks = (msg.message?.content || []).filter(b => b.type === 'text');
          for (const block of textBlocks) {
            if (block.text && block.text !== currentText) {
              const delta = block.text.slice(currentText.length);
              if (delta) {
                this._emit(sessionId, MSG_CHAT_STREAM, {
                  delta,
                  fullText: block.text,
                });
              }
              currentText = block.text;
            }
          }
        }

        if (msg.type === 'tool_use') {
          this._emit(sessionId, MSG_CHAT_TOOL_USE, {
            toolName: msg.tool_name || msg.name,
            toolId: msg.id,
            input: msg.input,
          });
        }

        if (msg.type === 'tool_result') {
          if (entry.config.includeToolResults !== false) {
            this._emit(sessionId, MSG_CHAT_TOOL_RESULT, {
              toolId: msg.tool_use_id,
              output: msg.content,
            });
          }
        }

        if (msg.type === 'result') {
          if (currentText) {
            this._emit(sessionId, MSG_CHAT_ASSISTANT, {
              text: currentText,
              sessionId,
            });
          } else {
            // Fallback: check msg.result for V1 API text
            const resultText = (msg.message?.content || [])
              .filter(b => b.type === 'text')
              .map(b => b.text)
              .join('\n');
            const finalResultText = resultText || (typeof msg.result === 'string' ? msg.result : '');
            if (finalResultText) {
              this._emit(sessionId, MSG_CHAT_ASSISTANT, {
                text: finalResultText,
                sessionId,
              });
            }
          }
          // Capture session ID from result if not yet captured
          if (!entry.sdkSessionId && msg.session_id) {
            entry.sdkSessionId = msg.session_id;
          }
          break;
        }
      }
    } catch (err) {
      this._emit(sessionId, MSG_CHAT_ERROR, {
        message: err.message,
        code: err.code,
      });
    } finally {
      entry.activeQuery = null;
      entry.streaming = false;
      this._emit(sessionId, MSG_CHAT_STATUS, { status: ChatStatus.IDLE });
    }
  }

  /**
   * Stop streaming for a session.
   * @param {string} sessionId
   */
  async stopSession(sessionId) {
    const entry = this._sessions.get(sessionId);
    if (!entry) return;

    if (entry.streaming) {
      entry.streaming = false;
      try {
        if (entry.activeQuery) {
          entry.activeQuery.close();
        }
      } catch { /* best effort */ }
      this._emit(sessionId, MSG_CHAT_STATUS, { status: ChatStatus.STOPPED });
    }
  }

  /**
   * Close and remove a session.
   * @param {string} sessionId
   */
  async closeSession(sessionId) {
    const entry = this._sessions.get(sessionId);
    if (!entry) return;

    entry.streaming = false;
    try {
      if (entry.activeQuery) {
        entry.activeQuery.close();
      }
    } catch { /* already closed */ }

    // Emit before removing so the callback is still available
    const callback = entry.onMessage;
    this._sessions.delete(sessionId);
    if (callback) {
      const envelope = createEnvelope(MSG_SESSION_CLOSED, { sessionId }, 'server', sessionId);
      callback(envelope);
    }
  }

  /**
   * List available sessions from the Agent SDK.
   * @param {string} [dir] - Project directory to filter by
   * @returns {Promise<Array>}
   */
  async listSessions(dir) {
    try {
      const sdk = await this._getSDK();
      const sessions = await sdk.listSessions({ dir, limit: 50 });
      return sessions.map(s => ({
        sessionId: s.sessionId,
        summary: s.summary,
        lastModified: s.lastModified,
        cwd: s.cwd,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get info about a specific active session.
   * @param {string} sessionId
   * @returns {object|null}
   */
  getSession(sessionId) {
    const entry = this._sessions.get(sessionId);
    if (!entry) return null;
    return {
      sessionId: entry.sessionId,
      streaming: entry.streaming,
      config: this._sanitizeConfigForClient(entry.config),
      createdAt: entry.createdAt,
    };
  }

  /**
   * Get all active session IDs.
   * @returns {string[]}
   */
  getActiveSessionIds() {
    return [...this._sessions.keys()];
  }

  /**
   * Update the onMessage callback for a session.
   * @param {string} sessionId
   * @param {function} onMessage
   */
  setMessageCallback(sessionId, onMessage) {
    const entry = this._sessions.get(sessionId);
    if (entry) {
      entry.onMessage = onMessage;
    }
  }

  /**
   * Close all sessions.
   */
  async closeAll() {
    const ids = [...this._sessions.keys()];
    for (const id of ids) {
      await this.closeSession(id);
    }
  }

  /**
   * Emit a protocol envelope for a session.
   */
  _emit(sessionId, type, payload) {
    const entry = this._sessions.get(sessionId);
    const callback = entry?.onMessage;
    if (callback) {
      const envelope = createEnvelope(type, payload, 'server', sessionId);
      callback(envelope);
    }
  }

  /**
   * Remove server-only fields from config before sending to client.
   */
  _sanitizeConfigForClient(config) {
    const { plugins, cwd, permissionMode, mcpServers, settingSources, ...clientSafe } = config;
    return clientSafe;
  }
}
