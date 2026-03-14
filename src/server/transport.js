/**
 * Transport — manages WebSocket + SSE connections.
 *
 * Tracks connected clients, broadcasts messages, handles heartbeats.
 * Transport-agnostic: the SessionManager emits envelopes, Transport delivers them.
 */

import { createEnvelope, PROTOCOL_VERSION, parseEnvelope } from '../protocol/envelope.js';
import { MSG_SYS_CONNECT, MSG_SYS_HEARTBEAT, MSG_SYS_DISCONNECT } from '../protocol/messages.js';

let wsClientIdCounter = 0;

/**
 * Generate a unique client ID.
 * @returns {string}
 */
export function generateClientId() {
  return `client-${Date.now()}-${++wsClientIdCounter}`;
}

export class Transport {
  constructor() {
    /** @type {Map<string, { ws: object, type: string }>} */
    this._wsClients = new Map();
    /** @type {Map<string, { res: object, type: string }>} */
    this._sseClients = new Map();
    this._heartbeatInterval = null;
    this._onClientConnect = null;
    this._onClientDisconnect = null;
  }

  /**
   * Register a WebSocket client.
   * @param {string} clientId
   * @param {object} ws - WebSocket instance
   * @param {string} clientType - e.g., 'browser', 'extension'
   */
  addWsClient(clientId, ws, clientType = 'browser') {
    this._wsClients.set(clientId, { ws, type: clientType });
    if (this._onClientConnect) {
      this._onClientConnect({ clientId, clientType, transport: 'ws' });
    }
  }

  /**
   * Remove a WebSocket client.
   * @param {string} clientId
   */
  removeWsClient(clientId) {
    const entry = this._wsClients.get(clientId);
    this._wsClients.delete(clientId);
    if (entry && this._onClientDisconnect) {
      this._onClientDisconnect({ clientId, clientType: entry.type, transport: 'ws' });
    }
  }

  /**
   * Register an SSE client.
   * @param {string} clientId
   * @param {object} res - HTTP response object
   * @param {string} clientType
   */
  addSseClient(clientId, res, clientType = 'browser') {
    this._sseClients.set(clientId, { res, type: clientType });
    if (this._onClientConnect) {
      this._onClientConnect({ clientId, clientType, transport: 'sse' });
    }
  }

  /**
   * Remove an SSE client.
   * @param {string} clientId
   */
  removeSseClient(clientId) {
    const entry = this._sseClients.get(clientId);
    this._sseClients.delete(clientId);
    if (entry && this._onClientDisconnect) {
      this._onClientDisconnect({ clientId, clientType: entry.type, transport: 'sse' });
    }
  }

  /**
   * Broadcast an envelope to all connected clients.
   * @param {object|string} envelope - Protocol envelope or JSON string
   */
  broadcast(envelope) {
    const data = typeof envelope === 'string' ? envelope : JSON.stringify(envelope);

    for (const [, { ws }] of this._wsClients) {
      try {
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(data);
        }
      } catch { /* client gone */ }
    }

    for (const [, { res }] of this._sseClients) {
      try {
        res.write(`data: ${data}\n\n`);
      } catch { /* client gone */ }
    }
  }

  /**
   * Send an envelope to a specific client.
   * @param {string} clientId
   * @param {object|string} envelope
   */
  sendTo(clientId, envelope) {
    const data = typeof envelope === 'string' ? envelope : JSON.stringify(envelope);

    const wsEntry = this._wsClients.get(clientId);
    if (wsEntry && wsEntry.ws.readyState === 1) {
      wsEntry.ws.send(data);
      return;
    }

    const sseEntry = this._sseClients.get(clientId);
    if (sseEntry) {
      try { sseEntry.res.write(`data: ${data}\n\n`); } catch { /* gone */ }
    }
  }

  /**
   * Get the number of connected clients.
   * @returns {{ ws: number, sse: number, total: number }}
   */
  getClientCount() {
    const ws = this._wsClients.size;
    const sse = this._sseClients.size;
    return { ws, sse, total: ws + sse };
  }

  /**
   * Start periodic heartbeat broadcasts.
   * @param {number} [intervalMs=30000]
   */
  startHeartbeat(intervalMs = 30000) {
    this.stopHeartbeat();
    this._heartbeatInterval = setInterval(() => {
      const counts = this.getClientCount();
      this.broadcast(createEnvelope(MSG_SYS_HEARTBEAT, {
        clients: counts,
        uptime: process.uptime(),
      }, 'server'));
    }, intervalMs);
  }

  /**
   * Stop heartbeat.
   */
  stopHeartbeat() {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
  }

  /**
   * Handle a WebSocket upgrade + handshake for agent-web protocol.
   * @param {object} ws - WebSocket instance
   * @param {object} wss - WebSocketServer
   * @param {function} onHandshake - Called with (clientId, envelope) on successful handshake
   * @param {function} onMessage - Called with (clientId, envelope) for subsequent messages
   * @returns {string} clientId
   */
  handleWsConnection(ws, onHandshake, onMessage) {
    const clientId = generateClientId();
    let handshakeComplete = false;

    const handshakeTimeout = setTimeout(() => {
      if (!handshakeComplete) {
        ws.close(4001, 'Handshake timeout');
      }
    }, 10000);

    ws.on('message', (rawData) => {
      const data = rawData.toString();

      if (!handshakeComplete) {
        const { valid, envelope } = parseEnvelope(data);
        if (!valid || envelope.type !== MSG_SYS_CONNECT) {
          ws.close(4002, 'First message must be sys:connect');
          clearTimeout(handshakeTimeout);
          return;
        }

        handshakeComplete = true;
        clearTimeout(handshakeTimeout);

        const clientType = envelope.payload?.clientType || 'browser';
        this.addWsClient(clientId, ws, clientType);

        // Send connect acknowledgment
        const ack = createEnvelope(MSG_SYS_CONNECT, {
          clientId,
          serverVersion: PROTOCOL_VERSION,
          clients: this.getClientCount(),
        }, 'server');
        ws.send(JSON.stringify(ack));

        if (onHandshake) onHandshake(clientId, envelope);
        return;
      }

      // Post-handshake messages
      const { valid, envelope, error } = parseEnvelope(data);
      if (valid && onMessage) {
        onMessage(clientId, envelope);
      } else if (!valid) {
        ws.send(JSON.stringify({ error }));
      }
    });

    ws.on('close', () => {
      clearTimeout(handshakeTimeout);
      this.removeWsClient(clientId);
    });

    ws.on('error', () => {
      clearTimeout(handshakeTimeout);
      this.removeWsClient(clientId);
    });

    return clientId;
  }

  /**
   * Handle an SSE connection.
   * @param {object} req - HTTP request
   * @param {object} res - HTTP response
   * @returns {string} clientId
   */
  handleSseConnection(req, res) {
    const clientId = generateClientId();

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial connect event
    const connectMsg = createEnvelope(MSG_SYS_CONNECT, {
      clientId,
      serverVersion: PROTOCOL_VERSION,
      clients: this.getClientCount(),
    }, 'server');
    res.write(`data: ${JSON.stringify(connectMsg)}\n\n`);

    this.addSseClient(clientId, res, 'browser');

    req.on('close', () => this.removeSseClient(clientId));
    req.on('error', () => this.removeSseClient(clientId));

    return clientId;
  }

  /**
   * Set lifecycle callbacks.
   * @param {{ onConnect?: function, onDisconnect?: function }} callbacks
   */
  setCallbacks(callbacks) {
    if (callbacks.onConnect) this._onClientConnect = callbacks.onConnect;
    if (callbacks.onDisconnect) this._onClientDisconnect = callbacks.onDisconnect;
  }

  /**
   * Clean up all connections.
   */
  closeAll() {
    this.stopHeartbeat();
    for (const [, { ws }] of this._wsClients) {
      try { ws.close(1000, 'Server shutting down'); } catch { /* */ }
    }
    for (const [, { res }] of this._sseClients) {
      try { res.end(); } catch { /* */ }
    }
    this._wsClients.clear();
    this._sseClients.clear();
  }
}
