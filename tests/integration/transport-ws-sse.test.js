import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Transport } from '../../src/server/transport.js';
import { createEnvelope, PROTOCOL_VERSION } from '../../src/protocol/envelope.js';
import { MSG_SYS_CONNECT, MSG_CHAT_STREAM } from '../../src/protocol/messages.js';

describe('integration/transport WS + SSE', () => {
  let server;
  let port;
  let transport;

  beforeAll(async () => {
    transport = new Transport();
    server = createServer((req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname === '/sse') {
        transport.handleSseConnection(req, res);
        return;
      }
      res.writeHead(404);
      res.end();
    });

    const wss = new WebSocketServer({ server, path: '/ws' });
    wss.on('connection', (ws) => {
      transport.handleWsConnection(ws, () => {}, () => {});
    });

    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    transport.closeAll();
    await new Promise((resolve) => server.close(resolve));
  });

  async function connectWs() {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise((resolve, reject) => {
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
      setTimeout(() => reject(new Error('WS timeout')), 5000);
    });
    return ws;
  }

  it('WS client is counted after handshake', async () => {
    const ws = await connectWs();
    const counts = transport.getClientCount();
    expect(counts.ws).toBeGreaterThanOrEqual(1);
    ws.close();
    await new Promise(r => setTimeout(r, 100));
  });

  it('SSE client is counted after connection', async () => {
    const resp = await fetch(`http://localhost:${port}/sse`);
    expect(resp.status).toBe(200);
    expect(resp.headers.get('content-type')).toBe('text/event-stream');

    const counts = transport.getClientCount();
    expect(counts.sse).toBeGreaterThanOrEqual(1);

    // Read initial connect message
    const reader = resp.body.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain('sys:connect');
    reader.cancel();
  });

  it('broadcast reaches all connected clients', async () => {
    const ws = await connectWs();
    const msgPromise = new Promise((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'chat:stream') resolve(msg);
      });
    });

    transport.broadcast(
      createEnvelope(MSG_CHAT_STREAM, { delta: 'test', fullText: 'test' }, 'server')
    );

    const msg = await msgPromise;
    expect(msg.type).toBe('chat:stream');
    expect(msg.payload.delta).toBe('test');

    ws.close();
    await new Promise(r => setTimeout(r, 100));
  });

  it('sendTo sends to specific client only', async () => {
    const ws1 = await connectWs();
    const ws2 = await connectWs();

    const ids = [...transport._wsClients.keys()];
    const targetId = ids[ids.length - 1];

    const messages1 = [];
    const messages2 = [];
    ws1.on('message', (data) => messages1.push(JSON.parse(data.toString())));
    ws2.on('message', (data) => messages2.push(JSON.parse(data.toString())));

    transport.sendTo(targetId,
      createEnvelope(MSG_CHAT_STREAM, { delta: 'specific' }, 'server')
    );

    await new Promise(r => setTimeout(r, 100));

    const specific2 = messages2.filter(m => m.type === 'chat:stream' && m.payload.delta === 'specific');
    expect(specific2.length).toBeGreaterThanOrEqual(1);

    ws1.close();
    ws2.close();
    await new Promise(r => setTimeout(r, 100));
  });

  it('client count decreases on disconnect', async () => {
    const before = transport.getClientCount();
    const ws = await connectWs();
    const during = transport.getClientCount();
    expect(during.ws).toBe(before.ws + 1);

    ws.close();
    await new Promise(r => setTimeout(r, 200));

    const after = transport.getClientCount();
    expect(after.ws).toBe(before.ws);
  });
});
