/**
 * SessionManager — manages multiple Claude Agent SDK sessions.
 *
 * Each session wraps the Agent SDK V2 interface (createSession / resumeSession).
 * Sessions are identified by their SDK-assigned sessionId.
 * Streaming responses are emitted as protocol envelopes via callbacks.
 */

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
 * @property {string} sessionId
 * @property {object} sdkSession - Agent SDK session handle
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
   * @param {object} sdkOptions - Options for unstable_v2_createSession
   * @param {import('../protocol/config.js').AgentConfig} resolvedConfig
   * @param {function} onMessage - Callback receiving protocol envelopes
   * @returns {Promise<string>} sessionId
   */
  async createSession(sdkOptions, resolvedConfig, onMessage) {
    const sdk = await this._getSDK();

    const sdkSession = sdk.unstable_v2_createSession(sdkOptions);
    const sessionId = sdkSession.sessionId;

    this._sessions.set(sessionId, {
      sessionId,
      sdkSession,
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
    const sdk = await this._getSDK();

    const sdkSession = sdk.unstable_v2_resumeSession(sessionId, sdkOptions);

    this._sessions.set(sessionId, {
      sessionId,
      sdkSession,
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
      await entry.sdkSession.send(text);

      let currentText = '';

      for await (const msg of entry.sdkSession.stream()) {
        if (!entry.streaming) break;

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
        entry.sdkSession.close();
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
      entry.sdkSession.close();
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
