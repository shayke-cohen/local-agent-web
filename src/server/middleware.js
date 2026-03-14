/**
 * Middleware — HTTP request handler + createServer() for agent-web.
 *
 * Provides:
 *   POST /chat/start    — create a new chat session
 *   POST /chat/message  — send a user message
 *   POST /chat/stop     — stop generation
 *   POST /chat/resume   — resume an existing session
 *   GET  /chat/sessions — list available sessions
 *   GET  /chat/config   — get current server config (sanitized)
 *   GET  /health        — health check
 *   /ws                 — WebSocket upgrade
 *   /sse                — SSE stream
 */

import { createServer as createHttpServer } from 'http';
import { WebSocketServer } from 'ws';
import { SessionManager } from './session-manager.js';
import { ConfigResolver } from './config-resolver.js';
import { Transport } from './transport.js';
import {
  MSG_CHAT_USER,
  MSG_CONFIG_RESOLVED,
  isTypeInCategory,
} from '../protocol/messages.js';
import { createEnvelope } from '../protocol/envelope.js';

/**
 * @typedef {object} AgentServerOptions
 * @property {import('../protocol/config.js').AgentConfig} [config] - Default session config
 * @property {import('../protocol/config.js').ServerConstraints} [constraints] - Hard limits
 * @property {object} [hooks] - Server-side event hooks
 * @property {function} [hooks.onSessionStart] - Called when a session starts
 * @property {function} [hooks.onSessionEnd] - Called when a session ends
 * @property {function} [hooks.onMessage] - Called for every message
 * @property {function} [hooks.onToolUse] - Called when a tool is invoked
 * @property {function} [hooks.onError] - Called on errors
 * @property {function} [hooks.onClientConnect] - Called when a client connects
 * @property {function} [hooks.onClientDisconnect] - Called when a client disconnects
 * @property {number} [port] - Port for standalone server
 * @property {string} [basePath] - Base path prefix for all routes (default: '')
 */

/**
 * Create an agent-web server instance.
 * @param {AgentServerOptions} [options]
 * @returns {AgentServer}
 */
export function createAgentServer(options = {}) {
  return new AgentServer(options);
}

class AgentServer {
  constructor(options = {}) {
    this._options = options;
    this._configResolver = new ConfigResolver(options.config, options.constraints);
    this._sessionManager = new SessionManager();
    this._transport = new Transport();
    this._hooks = options.hooks || {};
    this._basePath = options.basePath || '';
    this._server = null;
    this._wss = null;

    // Wire transport lifecycle hooks
    this._transport.setCallbacks({
      onConnect: (info) => this._hooks.onClientConnect?.(info),
      onDisconnect: (info) => this._hooks.onClientDisconnect?.(info),
    });
  }

  /** @returns {SessionManager} */
  get sessions() { return this._sessionManager; }

  /** @returns {Transport} */
  get transport() { return this._transport; }

  /** @returns {ConfigResolver} */
  get configResolver() { return this._configResolver; }

  /**
   * Start a standalone HTTP server.
   * @param {number} [port]
   * @param {function} [onReady]
   */
  listen(port, onReady) {
    const listenPort = port !== undefined && port !== null ? port : (this._options.port ?? 3456);

    this._server = createHttpServer((req, res) => {
      this._handleRequest(req, res);
    });

    this._wss = new WebSocketServer({ server: this._server, path: this._basePath + '/ws' });
    this._wss.on('connection', (ws) => this._handleWsConnection(ws));

    this._transport.startHeartbeat();

    this._server.listen(listenPort, () => {
      const actualPort = this._server.address().port;
      console.log(`agent-web server running on http://localhost:${actualPort}`);
      console.log(`  WebSocket  ${this._basePath}/ws`);
      console.log(`  SSE        ${this._basePath}/sse`);
      console.log(`  REST       ${this._basePath}/chat/*`);
      console.log(`  Health     ${this._basePath}/health`);
      if (onReady) onReady({ port: actualPort });
    });

    return this;
  }

  /**
   * Return an HTTP request handler (middleware).
   * Compatible with Node http, Express, Hono, etc.
   * NOTE: WebSocket needs separate attachment via attachWebSocket().
   * @returns {function(req, res)}
   */
  middleware() {
    return (req, res) => this._handleRequest(req, res);
  }

  /**
   * Attach WebSocket handling to an existing HTTP server.
   * @param {object} httpServer
   * @param {string} [path]
   */
  attachWebSocket(httpServer, path) {
    this._wss = new WebSocketServer({
      server: httpServer,
      path: path || this._basePath + '/ws',
    });
    this._wss.on('connection', (ws) => this._handleWsConnection(ws));
    this._transport.startHeartbeat();
  }

  /**
   * Shut down the server gracefully.
   */
  async close() {
    await this._sessionManager.closeAll();
    this._transport.closeAll();
    if (this._wss) this._wss.close();
    if (this._server) this._server.close();
  }

  // --- Internal handlers ---

  _handleWsConnection(ws) {
    this._transport.handleWsConnection(
      ws,
      (clientId, envelope) => {
        // Handshake complete
      },
      (clientId, envelope) => {
        this._handleClientMessage(clientId, envelope);
      }
    );
  }

  _handleClientMessage(clientId, envelope) {
    if (envelope.type === 'chat:send') {
      const sessionId = envelope.sessionId || envelope.payload?.sessionId;
      const text = envelope.payload?.text;
      if (sessionId && text) {
        this._sessionManager.sendMessage(sessionId, text).catch(err => {
          console.error('[agent-web] sendMessage error:', err.message);
        });
      }
    }

    if (envelope.type === 'chat:stop') {
      const sessionId = envelope.sessionId || envelope.payload?.sessionId;
      if (sessionId) {
        this._sessionManager.stopSession(sessionId).catch(() => {});
      }
    }

    // Forward custom/extension messages via hooks
    if (this._hooks.onMessage) {
      this._hooks.onMessage(envelope, clientId);
    }
  }

  _handleRequest(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const base = this._basePath;

    // SSE
    if (req.method === 'GET' && pathname === base + '/sse') {
      this._transport.handleSseConnection(req, res);
      return;
    }

    // Chat endpoints
    if (req.method === 'POST' && pathname === base + '/chat/start') {
      this._handleChatStart(req, res);
      return;
    }

    if (req.method === 'POST' && pathname === base + '/chat/message') {
      this._handleChatMessage(req, res);
      return;
    }

    if (req.method === 'POST' && pathname === base + '/chat/stop') {
      this._handleChatStop(req, res);
      return;
    }

    if (req.method === 'POST' && pathname === base + '/chat/resume') {
      this._handleChatResume(req, res);
      return;
    }

    if (req.method === 'GET' && pathname === base + '/chat/sessions') {
      this._handleChatSessions(req, res);
      return;
    }

    if (req.method === 'GET' && pathname === base + '/chat/config') {
      this._handleGetConfig(res);
      return;
    }

    // Health
    if (req.method === 'GET' && pathname === base + '/health') {
      this._sendJson(res, 200, {
        status: 'ok',
        version: '0.1.0',
        clients: this._transport.getClientCount(),
        sessions: this._sessionManager.getActiveSessionIds().length,
        uptime: process.uptime(),
      });
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  async _handleChatStart(req, res) {
    const body = await this._readBody(req);
    if (!body) {
      this._sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }

    try {
      const clientConfig = body.config || {};
      const { config: resolved, warnings } = this._configResolver.resolve(clientConfig);
      const sdkOptions = this._configResolver.toSDKOptions(resolved);

      const broadcastMessage = (envelope) => {
        this._transport.broadcast(envelope);
        if (this._hooks.onMessage) this._hooks.onMessage(envelope);

        // Fire specific hooks
        if (envelope.type === 'chat:tool-use' && this._hooks.onToolUse) {
          this._hooks.onToolUse(envelope.payload, envelope.sessionId);
        }
      };

      const sessionId = await this._sessionManager.createSession(
        sdkOptions,
        resolved,
        broadcastMessage
      );

      if (this._hooks.onSessionStart) {
        this._hooks.onSessionStart({ sessionId, config: resolved });
      }

      this._sendJson(res, 200, {
        ok: true,
        sessionId,
        config: this._sessionManager._sanitizeConfigForClient(resolved),
        warnings: warnings.length > 0 ? warnings : undefined,
      });
    } catch (err) {
      if (this._hooks.onError) this._hooks.onError(err);
      this._sendJson(res, 500, { error: err.message });
    }
  }

  async _handleChatMessage(req, res) {
    const body = await this._readBody(req);
    if (!body?.text) {
      this._sendJson(res, 400, { error: 'Missing "text" in request body' });
      return;
    }

    const sessionId = body.sessionId;
    if (!sessionId) {
      this._sendJson(res, 400, { error: 'Missing "sessionId"' });
      return;
    }

    const session = this._sessionManager.getSession(sessionId);
    if (!session) {
      this._sendJson(res, 404, { error: `No active session: ${sessionId}` });
      return;
    }

    // Broadcast user message for multi-client sync
    this._transport.broadcast(
      createEnvelope(MSG_CHAT_USER, { text: body.text, sessionId }, 'client', sessionId)
    );

    // Respond immediately, streaming happens via WS/SSE
    this._sendJson(res, 200, { ok: true });

    this._sessionManager.sendMessage(sessionId, body.text).catch(err => {
      if (this._hooks.onError) this._hooks.onError(err);
      console.error('[agent-web] sendMessage error:', err.message);
    });
  }

  async _handleChatStop(req, res) {
    const body = await this._readBody(req);
    const sessionId = body?.sessionId;

    if (sessionId) {
      await this._sessionManager.stopSession(sessionId);
    }

    this._sendJson(res, 200, { ok: true });
  }

  async _handleChatResume(req, res) {
    const body = await this._readBody(req);
    if (!body?.sessionId) {
      this._sendJson(res, 400, { error: 'Missing "sessionId"' });
      return;
    }

    try {
      const clientConfig = body.config || {};
      const { config: resolved, warnings } = this._configResolver.resolve(clientConfig);
      const sdkOptions = this._configResolver.toSDKOptions(resolved);

      const broadcastMessage = (envelope) => {
        this._transport.broadcast(envelope);
        if (this._hooks.onMessage) this._hooks.onMessage(envelope);
      };

      await this._sessionManager.resumeSession(
        body.sessionId,
        sdkOptions,
        resolved,
        broadcastMessage
      );

      this._sendJson(res, 200, {
        ok: true,
        sessionId: body.sessionId,
        config: this._sessionManager._sanitizeConfigForClient(resolved),
        warnings: warnings.length > 0 ? warnings : undefined,
      });
    } catch (err) {
      if (this._hooks.onError) this._hooks.onError(err);
      this._sendJson(res, 500, { error: err.message });
    }
  }

  async _handleChatSessions(req, res) {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const dir = url.searchParams.get('dir') || undefined;
      const sessions = await this._sessionManager.listSessions(dir);
      this._sendJson(res, 200, { sessions });
    } catch (err) {
      this._sendJson(res, 500, { error: err.message });
    }
  }

  _handleGetConfig(res) {
    const { config } = this._configResolver.resolve({});
    this._sendJson(res, 200, {
      config: this._sessionManager._sanitizeConfigForClient(config),
    });
  }

  _sendJson(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  _readBody(req) {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve(null); }
      });
      req.on('error', () => resolve(null));
    });
  }
}
