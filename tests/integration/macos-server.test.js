/**
 * Integration tests for the macOS demo server.
 *
 * Tests the server endpoints, WebSocket handshake, and session lifecycle
 * as a native macOS client would use them.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import { createAgentServer } from '@shaykec/agent-web/server';
import { createEnvelope, PROTOCOL_VERSION, MSG_SYS_CONNECT } from '@shaykec/agent-web/protocol';

describe('macOS Demo Server Integration', () => {
  let server;
  let port;

  beforeAll(async () => {
    server = createAgentServer({
      config: {
        model: 'claude-sonnet-4-6',
        tools: ['Bash(*)', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
        permissionMode: 'bypassPermissions',
        systemPrompt: 'Test assistant.',
      },
      constraints: {
        maxModel: 'claude-sonnet-4-6',
        maxTurns: 50,
      },
    });

    await new Promise((resolve) => {
      server.listen(0, ({ port: p }) => {
        port = p;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await server.close();
  });

  // MARK: - Health endpoint

  it('responds to /health', async () => {
    const res = await fetch(`http://localhost:${port}/health`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data).toHaveProperty('sessions');
    expect(data).toHaveProperty('uptime');
  });

  // MARK: - Config endpoint

  it('returns sanitized config via GET /chat/config', async () => {
    const res = await fetch(`http://localhost:${port}/chat/config`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.config).toBeDefined();
    expect(data.config.model).toBe('claude-sonnet-4-6');
    expect(data.config.permissionMode).toBeUndefined();
    expect(data.config.cwd).toBeUndefined();
  });

  // MARK: - Session lifecycle

  it('creates a session via POST /chat/start', async () => {
    const res = await fetch(`http://localhost:${port}/chat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: {} }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.sessionId).toMatch(/^[0-9a-f]{8}-/);
    expect(data.config).toBeDefined();
    expect(data.config.model).toBe('claude-sonnet-4-6');
  });

  it('creates a session with client-requested config', async () => {
    const res = await fetch(`http://localhost:${port}/chat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          model: 'claude-haiku-3-5',
          tools: ['Read', 'Grep'],
          maxTurns: 10,
        },
      }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.config.maxTurns).toBeLessThanOrEqual(10);
  });

  it('rejects message without sessionId', async () => {
    const res = await fetch(`http://localhost:${port}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello' }),
    });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('sessionId');
  });

  it('rejects message for non-existent session', async () => {
    const res = await fetch(`http://localhost:${port}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'non-existent-id', text: 'hello' }),
    });
    const data = await res.json();
    expect(res.status).toBe(404);
    expect(data.error).toContain('No active session');
  });

  it('lists sessions via GET /chat/sessions', async () => {
    const res = await fetch(`http://localhost:${port}/chat/sessions`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toHaveProperty('sessions');
    expect(Array.isArray(data.sessions)).toBe(true);
  });

  // MARK: - WebSocket handshake (mimics macOS client)

  it('completes WebSocket handshake with macos clientType', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);

    const ack = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WS timeout')), 5000);

      ws.on('open', () => {
        const handshake = createEnvelope(MSG_SYS_CONNECT, {
          clientType: 'macos',
          protocolVersion: PROTOCOL_VERSION,
        }, 'client');
        ws.send(JSON.stringify(handshake));
      });

      ws.on('message', (data) => {
        clearTimeout(timeout);
        resolve(JSON.parse(data.toString()));
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    expect(ack.type).toBe('sys:connect');
    expect(ack.payload.clientId).toBeTruthy();
    expect(ack.payload.serverVersion).toBe(PROTOCOL_VERSION);

    ws.close();
  });

  it('rejects WebSocket without handshake', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);

    const closeCode = await new Promise((resolve) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'chat:send', payload: { text: 'hi' } }));
      });
      ws.on('close', (code) => resolve(code));
      setTimeout(() => {
        ws.close();
        resolve(null);
      }, 3000);
    });

    expect(closeCode).toBe(4002);
  });

  // MARK: - Multiple concurrent sessions

  it('supports multiple concurrent sessions', async () => {
    const session1 = await (await fetch(`http://localhost:${port}/chat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: {} }),
    })).json();

    const session2 = await (await fetch(`http://localhost:${port}/chat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: {} }),
    })).json();

    expect(session1.ok).toBe(true);
    expect(session2.ok).toBe(true);
    expect(session1.sessionId).not.toBe(session2.sessionId);

    const health = await (await fetch(`http://localhost:${port}/health`)).json();
    expect(health.sessions).toBeGreaterThanOrEqual(2);
  });

  // MARK: - CORS headers

  it('includes CORS headers', async () => {
    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('responds to OPTIONS preflight', async () => {
    const res = await fetch(`http://localhost:${port}/chat/start`, {
      method: 'OPTIONS',
    });
    expect(res.status).toBe(204);
  });

  // MARK: - 404 for unknown routes

  it('returns 404 for unknown routes', async () => {
    const res = await fetch(`http://localhost:${port}/unknown`);
    expect(res.status).toBe(404);
  });
});
