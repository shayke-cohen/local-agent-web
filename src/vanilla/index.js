/**
 * @module @shaykec/agent-web/client
 *
 * Framework-agnostic Claude Code client for non-React apps.
 */

import { PROTOCOL_VERSION, createEnvelope, parseEnvelope } from '../protocol/envelope.js';
import { MSG_SYS_CONNECT, isTypeInCategory } from '../protocol/messages.js';

/**
 * ClaudeClient — vanilla JS client for agent-web servers.
 *
 * Usage:
 *   const client = new ClaudeClient('ws://localhost:3456');
 *   await client.connect();
 *   const session = await client.createSession({ model: 'claude-sonnet-4-6' });
 *   client.onMessage((msg) => console.log(msg));
 *   await client.send(session.sessionId, 'What files are here?');
 */
export class ClaudeClient {
  /**
   * @param {string} url - Server URL
   * @param {object} [config] - Default config for sessions
   */
  constructor(url, config = {}) {
    this._url = url;
    this._config = config;
    this._ws = null;
    this._listeners = new Set();
    this._connected = false;
    this._clientId = null;
  }

  get connected() { return this._connected; }
  get clientId() { return this._clientId; }

  /**
   * Connect to the agent-web server via WebSocket.
   * @returns {Promise<void>}
   */
  connect() {
    return new Promise((resolve, reject) => {
      const wsUrl = this._url.replace(/^http/, 'ws');
      this._ws = new WebSocket(`${wsUrl}/ws`);

      this._ws.onopen = () => {
        // Send handshake
        this._ws.send(JSON.stringify(createEnvelope(MSG_SYS_CONNECT, {
          clientType: 'vanilla',
          protocolVersion: PROTOCOL_VERSION,
        }, 'client')));
      };

      let handshaked = false;

      this._ws.onmessage = (event) => {
        const { valid, envelope } = parseEnvelope(event.data);
        if (!valid) return;

        if (!handshaked && envelope.type === MSG_SYS_CONNECT) {
          handshaked = true;
          this._connected = true;
          this._clientId = envelope.payload?.clientId;
          resolve();
          return;
        }

        for (const fn of this._listeners) {
          try { fn(envelope); } catch { /* */ }
        }
      };

      this._ws.onclose = () => {
        this._connected = false;
        if (!handshaked) reject(new Error('Connection closed before handshake'));
      };

      this._ws.onerror = () => {
        if (!handshaked) reject(new Error('WebSocket connection error'));
      };
    });
  }

  /**
   * Subscribe to incoming messages.
   * @param {function} callback
   * @returns {function} unsubscribe
   */
  onMessage(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  /**
   * Create a new chat session.
   * @param {object} [config] - Session config overrides
   * @returns {Promise<{ sessionId: string, config: object }>}
   */
  async createSession(config = {}) {
    const httpUrl = this._url.replace(/^ws/, 'http');
    const merged = { ...this._config, ...config };

    const resp = await fetch(`${httpUrl}/chat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: merged }),
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Failed to create session');
    return data;
  }

  /**
   * Send a message to a session.
   * @param {string} sessionId
   * @param {string} text
   */
  async send(sessionId, text) {
    const httpUrl = this._url.replace(/^ws/, 'http');

    const resp = await fetch(`${httpUrl}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, text }),
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Failed to send message');
    return data;
  }

  /**
   * Stop generation for a session.
   * @param {string} sessionId
   */
  async stop(sessionId) {
    const httpUrl = this._url.replace(/^ws/, 'http');
    await fetch(`${httpUrl}/chat/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
  }

  /**
   * Resume an existing session.
   * @param {string} sessionId
   * @param {object} [config]
   */
  async resumeSession(sessionId, config = {}) {
    const httpUrl = this._url.replace(/^ws/, 'http');
    const merged = { ...this._config, ...config };

    const resp = await fetch(`${httpUrl}/chat/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, config: merged }),
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Failed to resume session');
    return data;
  }

  /**
   * List available sessions.
   * @param {string} [dir]
   */
  async listSessions(dir) {
    const httpUrl = this._url.replace(/^ws/, 'http');
    const params = dir ? `?dir=${encodeURIComponent(dir)}` : '';

    const resp = await fetch(`${httpUrl}/chat/sessions${params}`);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Failed to list sessions');
    return data.sessions;
  }

  /**
   * Disconnect from the server.
   */
  disconnect() {
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this._connected = false;
    this._listeners.clear();
  }
}
