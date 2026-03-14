import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createAgentServer } from '../../src/server/middleware.js';
import { SessionManager } from '../../src/server/session-manager.js';
import { createEnvelope, PROTOCOL_VERSION } from '../../src/protocol/envelope.js';
import { MSG_SYS_CONNECT } from '../../src/protocol/messages.js';

function mockSDK() {
  let callCount = 0;
  return {
    unstable_v2_createSession: (opts) => {
      const id = `mock-session-${++callCount}`;
      return {
        sessionId: id,
        send: vi.fn(),
        stream: vi.fn(async function* () {
          yield { type: 'assistant', message: { content: [{ type: 'text', text: 'Hello!' }] } };
          yield { type: 'result' };
        }),
        close: vi.fn(),
      };
    },
    unstable_v2_resumeSession: (sessionId, opts) => ({
      sessionId,
      send: vi.fn(),
      stream: vi.fn(async function* () { yield { type: 'result' }; }),
      close: vi.fn(),
    }),
    listSessions: vi.fn(async () => [
      { sessionId: 'hist-1', summary: 'History session', lastModified: Date.now(), cwd: '/tmp' },
    ]),
  };
}

describe('integration/server-full', () => {
  let agent;
  let port;
  let sdk;

  beforeAll(async () => {
    sdk = mockSDK();

    agent = createAgentServer({
      config: {
        model: 'claude-sonnet-4-6',
        tools: ['Read', 'Write', 'Bash(*)'],
        systemPrompt: 'Test server',
      },
      constraints: {
        maxModel: 'claude-sonnet-4-6',
        maxTurns: 50,
      },
      hooks: {
        onSessionStart: vi.fn(),
        onMessage: vi.fn(),
        onToolUse: vi.fn(),
        onClientConnect: vi.fn(),
        onClientDisconnect: vi.fn(),
      },
    });

    agent.sessions._sdk = sdk;

    await new Promise((resolve) => {
      agent.listen(0, ({ port: p }) => {
        port = p;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await agent.close();
  });

  it('GET /health returns status and metrics', async () => {
    const resp = await fetch(`http://localhost:${port}/health`);
    const data = await resp.json();
    expect(resp.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.version).toBe('0.1.0');
    expect(typeof data.sessions).toBe('number');
    expect(typeof data.uptime).toBe('number');
  });

  it('GET /chat/config returns sanitized config', async () => {
    const resp = await fetch(`http://localhost:${port}/chat/config`);
    const data = await resp.json();
    expect(resp.status).toBe(200);
    expect(data.config.model).toBe('claude-sonnet-4-6');
    expect(data.config.tools).toContain('Read');
    expect(data.config.permissionMode).toBeUndefined();
    expect(data.config.cwd).toBeUndefined();
  });

  it('POST /chat/start creates a session', async () => {
    const resp = await fetch(`http://localhost:${port}/chat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: { model: 'claude-sonnet-4-6' } }),
    });
    const data = await resp.json();
    expect(resp.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.sessionId).toBeTruthy();
    expect(data.config).toBeTruthy();
  });

  it('POST /chat/message sends to an active session', async () => {
    const start = await fetch(`http://localhost:${port}/chat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: {} }),
    });
    const { sessionId } = await start.json();

    const resp = await fetch(`http://localhost:${port}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, text: 'Hello' }),
    });
    const data = await resp.json();
    expect(resp.status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it('POST /chat/message returns 400 without text', async () => {
    const resp = await fetch(`http://localhost:${port}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'x' }),
    });
    expect(resp.status).toBe(400);
  });

  it('POST /chat/message returns 404 for unknown session', async () => {
    const resp = await fetch(`http://localhost:${port}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'nonexistent', text: 'hi' }),
    });
    expect(resp.status).toBe(404);
  });

  it('POST /chat/stop returns ok', async () => {
    const resp = await fetch(`http://localhost:${port}/chat/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'anything' }),
    });
    expect(resp.status).toBe(200);
  });

  it('POST /chat/resume resumes an existing session', async () => {
    const resp = await fetch(`http://localhost:${port}/chat/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'hist-1', config: {} }),
    });
    const data = await resp.json();
    expect(resp.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.sessionId).toBe('hist-1');
  });

  it('GET /chat/sessions lists sessions from SDK', async () => {
    const resp = await fetch(`http://localhost:${port}/chat/sessions`);
    const data = await resp.json();
    expect(resp.status).toBe(200);
    expect(Array.isArray(data.sessions)).toBe(true);
  });

  it('returns 404 for unknown paths', async () => {
    const resp = await fetch(`http://localhost:${port}/unknown`);
    expect(resp.status).toBe(404);
  });

  it('OPTIONS returns 204 for CORS preflight', async () => {
    const resp = await fetch(`http://localhost:${port}/chat/start`, { method: 'OPTIONS' });
    expect(resp.status).toBe(204);
  });

  it('sets CORS headers on responses', async () => {
    const resp = await fetch(`http://localhost:${port}/health`);
    expect(resp.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('POST /chat/start with invalid JSON returns 400', async () => {
    const resp = await fetch(`http://localhost:${port}/chat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    expect(resp.status).toBe(400);
  });
});

describe('integration/server-full WebSocket', () => {
  let agent;
  let port;
  let sdk;

  beforeAll(async () => {
    sdk = mockSDK();

    agent = createAgentServer({
      config: { model: 'claude-sonnet-4-6', tools: ['Read'] },
    });
    agent.sessions._sdk = sdk;

    await new Promise((resolve) => {
      agent.listen(0, ({ port: p }) => {
        port = p;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await agent.close();
  });

  it('WebSocket handshake completes with sys:connect', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);

    const ack = await new Promise((resolve, reject) => {
      ws.on('open', () => {
        ws.send(JSON.stringify(createEnvelope(MSG_SYS_CONNECT, {
          clientType: 'test',
          protocolVersion: PROTOCOL_VERSION,
        }, 'client')));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'sys:connect') resolve(msg);
      });

      ws.on('error', reject);
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    expect(ack.type).toBe('sys:connect');
    expect(ack.payload.clientId).toBeTruthy();
    expect(ack.payload.serverVersion).toBe(PROTOCOL_VERSION);

    ws.close();
  });

  it('WebSocket rejects non-handshake first messages', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);

    const closed = await new Promise((resolve) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'chat:send', payload: {} }));
      });

      ws.on('close', (code) => resolve(code));
      setTimeout(() => resolve('timeout'), 5000);
    });

    expect(closed).toBe(4002);
  });
});
