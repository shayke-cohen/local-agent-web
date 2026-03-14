/**
 * E2E tests using the real Claude Agent SDK.
 * Uses the local Claude Code CLI subscription - no API key env var needed.
 * Skips if the Claude CLI is not installed or SKIP_E2E env var is set.
 *
 * Run: npm run test:e2e
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { WebSocket } from 'ws';
import { createAgentServer } from '@shaykec/agent-web/server';
import { createEnvelope, PROTOCOL_VERSION, MSG_SYS_CONNECT } from '@shaykec/agent-web/protocol';

function isClaudeCliAvailable() {
  if (process.env.SKIP_E2E) return false;
  try {
    execSync('claude --version', { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

const HAS_CLI = isClaudeCliAvailable();
if (!HAS_CLI) {
  console.log('[e2e] Skipping - Claude CLI not found or SKIP_E2E is set');
}
const describeE2E = HAS_CLI ? describe : describe.skip;

describeE2E('e2e/real-sdk — session lifecycle', () => {
  let agent;
  let port;

  beforeAll(async () => {
    agent = createAgentServer({
      config: {
        model: 'claude-sonnet-4-6',
        tools: ['Read', 'Glob', 'Grep'],
        permissionMode: 'bypassPermissions',
        systemPrompt: 'You are a test assistant. Be very brief.',
        maxTurns: 5,
      },
      constraints: {
        maxModel: 'claude-sonnet-4-6',
        maxTurns: 5,
      },
    });

    await new Promise((resolve) => {
      agent.listen(0, ({ port: p }) => { port = p; resolve(); });
    });
  }, 30000);

  afterAll(async () => {
    await agent.close();
  });

  it('creates a session and gets a valid sessionId', async () => {
    const resp = await fetch(`http://localhost:${port}/chat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: {} }),
    });
    const data = await resp.json();
    expect(data.ok).toBe(true);
    expect(data.sessionId).toBeTruthy();
    expect(typeof data.sessionId).toBe('string');
  }, 30000);

  it('sends a message and receives streaming response via WebSocket', async () => {
    const startResp = await fetch(`http://localhost:${port}/chat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: {} }),
    });
    const { sessionId } = await startResp.json();

    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const messages = [];

    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        ws.send(JSON.stringify(createEnvelope(MSG_SYS_CONNECT, {
          clientType: 'test',
          protocolVersion: PROTOCOL_VERSION,
        }, 'client')));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        messages.push(msg);
        if (msg.type === 'sys:connect') {
          resolve();
        }
      });

      ws.on('error', reject);
      setTimeout(() => reject(new Error('Timeout')), 10000);
    });

    await fetch(`http://localhost:${port}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, text: 'What is 2+2? Reply with just the number.' }),
    });

    await new Promise((resolve) => {
      const check = (data) => {
        const msg = JSON.parse(data.toString());
        messages.push(msg);
        if (msg.type === 'chat:assistant' || msg.type === 'chat:status') {
          if (msg.payload?.status === 'idle' || msg.type === 'chat:assistant') {
            ws.removeListener('message', check);
            resolve();
          }
        }
      };
      ws.on('message', check);
      setTimeout(resolve, 60000);
    });

    ws.close();

    const streamMsgs = messages.filter(m => m.type === 'chat:stream');
    const assistantMsgs = messages.filter(m => m.type === 'chat:assistant');
    const statusMsgs = messages.filter(m => m.type === 'chat:status');

    expect(streamMsgs.length).toBeGreaterThan(0);
    expect(assistantMsgs.length).toBeGreaterThan(0);

    const finalText = assistantMsgs[0].payload.text;
    expect(finalText).toContain('4');

    expect(statusMsgs.some(m => m.payload.status === 'thinking')).toBe(true);
  }, 90000);

  it('lists sessions from SDK', async () => {
    const resp = await fetch(`http://localhost:${port}/chat/sessions`);
    const data = await resp.json();
    expect(resp.status).toBe(200);
    expect(Array.isArray(data.sessions)).toBe(true);
  }, 30000);

  it('stops a streaming session', async () => {
    const startResp = await fetch(`http://localhost:${port}/chat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: {} }),
    });
    const { sessionId } = await startResp.json();

    const stopResp = await fetch(`http://localhost:${port}/chat/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    const data = await stopResp.json();
    expect(data.ok).toBe(true);
  }, 30000);
});

describeE2E('e2e/real-sdk — tool use', () => {
  let agent;
  let port;

  beforeAll(async () => {
    agent = createAgentServer({
      config: {
        model: 'claude-sonnet-4-6',
        tools: ['Bash(*)', 'Read', 'Glob'],
        permissionMode: 'bypassPermissions',
        systemPrompt: 'You are a test assistant. Be very brief. When asked about files, use the Glob or Bash tool.',
        maxTurns: 5,
      },
    });

    await new Promise((resolve) => {
      agent.listen(0, ({ port: p }) => { port = p; resolve(); });
    });
  }, 30000);

  afterAll(async () => {
    await agent.close();
  });

  it('completes a session with tool-enabled config and streams response', async () => {
    const startResp = await fetch(`http://localhost:${port}/chat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: {} }),
    });
    const { sessionId } = await startResp.json();

    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const messages = [];

    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        ws.send(JSON.stringify(createEnvelope(MSG_SYS_CONNECT, {
          clientType: 'test',
          protocolVersion: PROTOCOL_VERSION,
        }, 'client')));
      });
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        messages.push(msg);
        if (msg.type === 'sys:connect') resolve();
      });
      ws.on('error', reject);
      setTimeout(() => reject(new Error('Timeout')), 10000);
    });

    await fetch(`http://localhost:${port}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        text: 'Use the Read tool to read the file "package.json" in the current directory. Show the name field.',
      }),
    });

    await new Promise((resolve) => {
      const check = (data) => {
        const msg = JSON.parse(data.toString());
        messages.push(msg);
        if (msg.type === 'chat:status' && msg.payload?.status === 'idle') {
          ws.removeListener('message', check);
          resolve();
        }
      };
      ws.on('message', check);
      setTimeout(resolve, 90000);
    });

    ws.close();

    const toolUseMsgs = messages.filter(m => m.type === 'chat:tool-use');
    const toolResultMsgs = messages.filter(m => m.type === 'chat:tool-result');
    const assistantMsgs = messages.filter(m => m.type === 'chat:assistant');
    const streamMsgs = messages.filter(m => m.type === 'chat:stream');

    const gotResponse = streamMsgs.length > 0 || assistantMsgs.length > 0;
    expect(gotResponse).toBe(true);

    if (toolUseMsgs.length > 0) {
      expect(toolUseMsgs[0].payload.toolName).toBeTruthy();
      expect(toolResultMsgs.length).toBeGreaterThan(0);
    }
  }, 120000);
});
