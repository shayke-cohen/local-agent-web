import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';

// We test the middleware's HTTP handling without the Agent SDK.
// The SDK is only needed when actually creating sessions.

import { ConfigResolver, Transport } from '@shaykec/agent-web/server';

describe('integration/middleware HTTP endpoints', () => {
  let server;
  let port;

  function makeServer() {
    const configResolver = new ConfigResolver(
      { model: 'claude-sonnet-4-6', tools: ['Read', 'Write'] },
      { maxModel: 'claude-sonnet-4-6' }
    );
    const transport = new Transport();

    const handler = (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host}`);

      if (req.method === 'GET' && url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          clients: transport.getClientCount(),
        }));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/chat/config') {
        const { config } = configResolver.resolve({});
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ config }));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/sse') {
        transport.handleSseConnection(req, res);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    };

    return { handler, transport, configResolver };
  }

  beforeEach((ctx) => {
    return new Promise((resolve) => {
      const { handler, transport } = makeServer();
      ctx.transport = transport;
      server = createServer(handler);
      server.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  afterEach(() => {
    return new Promise((resolve) => {
      if (server) server.close(resolve);
      else resolve();
    });
  });

  it('GET /health returns status ok', async () => {
    const resp = await fetch(`http://localhost:${port}/health`);
    const data = await resp.json();
    expect(resp.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.clients.total).toBe(0);
  });

  it('GET /chat/config returns resolved config', async () => {
    const resp = await fetch(`http://localhost:${port}/chat/config`);
    const data = await resp.json();
    expect(resp.status).toBe(200);
    expect(data.config.model).toBe('claude-sonnet-4-6');
    expect(data.config.tools).toContain('Read');
  });

  it('GET unknown path returns 404', async () => {
    const resp = await fetch(`http://localhost:${port}/unknown`);
    expect(resp.status).toBe(404);
  });

  it('OPTIONS returns 204 for CORS preflight', async () => {
    const resp = await fetch(`http://localhost:${port}/health`, { method: 'OPTIONS' });
    expect(resp.status).toBe(204);
  });

  it('SSE endpoint returns event stream', async () => {
    const resp = await fetch(`http://localhost:${port}/sse`);
    expect(resp.status).toBe(200);
    expect(resp.headers.get('content-type')).toBe('text/event-stream');

    // Read the first chunk (sys:connect)
    const reader = resp.body.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain('sys:connect');

    reader.cancel();
  });
});
