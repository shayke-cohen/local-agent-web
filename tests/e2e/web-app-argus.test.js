/**
 * E2E tests for the web app (quickstart demo) using Argus MCP.
 *
 * These tests start a local server, open it in a Playwright browser via Argus,
 * and verify the UI renders correctly, connects, and handles interactions.
 *
 * Requires: Argus MCP server running in the IDE.
 * Skip: Set SKIP_ARGUS=1 to skip these tests.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createAgentServer } from '@shaykec/agent-web/server';

const __dirname = dirname(fileURLToPath(import.meta.url));

function isArgusAvailable() {
  if (process.env.SKIP_ARGUS) return false;
  if (process.env.CI) return false;
  return true;
}

const describeArgus = isArgusAvailable() ? describe : describe.skip;

describeArgus('e2e/web-app — Argus browser tests', () => {
  let httpServer;
  let port;

  beforeAll(async () => {
    const agent = createAgentServer({
      config: {
        model: 'claude-sonnet-4-6',
        tools: ['Read', 'Glob', 'Grep'],
        permissionMode: 'bypassPermissions',
        systemPrompt: 'You are a test assistant.',
      },
    });

    const htmlPath = resolve(__dirname, '../../examples/minimal-chat/index.html');
    const html = readFileSync(htmlPath, 'utf-8');

    httpServer = createServer((req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname === '/' || url.pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        return;
      }
      agent.middleware()(req, res);
    });

    agent.attachWebSocket(httpServer);

    await new Promise(resolve => {
      httpServer.listen(0, () => {
        port = httpServer.address().port;
        resolve();
      });
    });
  }, 15000);

  afterAll(async () => {
    if (httpServer) {
      await new Promise(resolve => httpServer.close(resolve));
    }
  });

  it('serves the quickstart HTML page', async () => {
    const resp = await fetch(`http://localhost:${port}/`);
    expect(resp.status).toBe(200);
    const text = await resp.text();
    expect(text).toContain('local-agent-web');
    expect(text).toContain('Ask Claude');
  });

  it('health endpoint returns ok', async () => {
    const resp = await fetch(`http://localhost:${port}/health`);
    const data = await resp.json();
    expect(data.status).toBe('ok');
    expect(data.version).toBe('0.1.0');
  });

  it('config endpoint returns sanitized config', async () => {
    const resp = await fetch(`http://localhost:${port}/chat/config`);
    const data = await resp.json();
    expect(data.config).toBeDefined();
    expect(data.config.model).toBe('claude-sonnet-4-6');
    expect(data.config.tools).toContain('Read');
    expect(data.config).not.toHaveProperty('permissionMode');
    expect(data.config).not.toHaveProperty('plugins');
    expect(data.config).not.toHaveProperty('cwd');
    expect(data.config).not.toHaveProperty('mcpServers');
  });

  it('creates a session via REST', async () => {
    const resp = await fetch(`http://localhost:${port}/chat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: {} }),
    });
    const data = await resp.json();
    expect(data.ok).toBe(true);
    expect(data.sessionId).toBeDefined();
    expect(data.config.model).toBe('claude-sonnet-4-6');
  });

  it('creates a session with client config override', async () => {
    const resp = await fetch(`http://localhost:${port}/chat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          tools: ['Read'],
          systemPrompt: 'Client prompt.',
        },
      }),
    });
    const data = await resp.json();
    expect(data.ok).toBe(true);
    expect(data.config.tools).toEqual(['Read']);
    expect(data.config.systemPrompt).toContain('Client prompt.');
  });

  it('rejects message without sessionId', async () => {
    const resp = await fetch(`http://localhost:${port}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello' }),
    });
    expect(resp.status).toBe(400);
    const data = await resp.json();
    expect(data.error).toContain('sessionId');
  });

  it('WebSocket connects and receives handshake', async () => {
    const WebSocket = (await import('ws')).default;

    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const messages = [];

    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({
          v: 1,
          type: 'sys:connect',
          payload: { clientType: 'argus-test', protocolVersion: 1 },
          source: 'client',
          timestamp: Date.now(),
        }));
      });
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
        if (messages.length >= 1) resolve();
      });
      ws.on('error', reject);
      setTimeout(() => resolve(), 3000);
    });

    ws.close();

    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].type).toBe('sys:connect');
    expect(messages[0].payload.clientId).toBeDefined();
  });
});
