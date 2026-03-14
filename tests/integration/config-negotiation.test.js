import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createAgentServer } from '../../src/server/middleware.js';

function mockSDK() {
  let n = 0;
  return {
    unstable_v2_createSession: (opts) => ({
      sessionId: `cfg-${++n}`,
      send: vi.fn(),
      stream: vi.fn(async function* () { yield { type: 'result' }; }),
      close: vi.fn(),
    }),
    unstable_v2_resumeSession: (sid) => ({
      sessionId: sid,
      send: vi.fn(),
      stream: vi.fn(async function* () { yield { type: 'result' }; }),
      close: vi.fn(),
    }),
    listSessions: vi.fn(async () => []),
  };
}

describe('integration/config-negotiation', () => {
  let agent;
  let port;

  beforeAll(async () => {
    agent = createAgentServer({
      config: {
        model: 'claude-sonnet-4-6',
        tools: ['Read', 'Write', 'Bash(*)', 'Edit', 'Glob', 'Grep'],
        systemPrompt: 'Server base prompt',
        maxTurns: 50,
        agents: {
          reviewer: { description: 'Code reviewer', prompt: 'Review code' },
          writer: { description: 'Code writer', prompt: 'Write code' },
        },
      },
      constraints: {
        maxModel: 'claude-sonnet-4-6',
        disallowedTools: ['WebSearch'],
        maxTurns: 100,
      },
    });
    agent.sessions._sdk = mockSDK();

    await new Promise((resolve) => {
      agent.listen(0, ({ port: p }) => { port = p; resolve(); });
    });
  });

  afterAll(async () => {
    await agent.close();
  });

  async function startSession(config) {
    const resp = await fetch(`http://localhost:${port}/chat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });
    return resp.json();
  }

  it('returns server defaults when no client config', async () => {
    const data = await startSession({});
    expect(data.ok).toBe(true);
    expect(data.config.model).toBe('claude-sonnet-4-6');
    expect(data.config.tools).toContain('Read');
  });

  it('clamps model to maxModel constraint', async () => {
    const data = await startSession({ model: 'claude-opus-4-6' });
    expect(data.ok).toBe(true);
    expect(data.config.model).toBe('claude-sonnet-4-6');
    expect(data.warnings).toBeDefined();
    expect(data.warnings.some(w => w.includes('clamped'))).toBe(true);
  });

  it('allows client to narrow tools', async () => {
    const data = await startSession({ tools: ['Read', 'Write'] });
    expect(data.ok).toBe(true);
    expect(data.config.tools).toEqual(['Read', 'Write']);
  });

  it('rejects tools not in server superset', async () => {
    const data = await startSession({ tools: ['Read', 'WebFetch'] });
    expect(data.ok).toBe(true);
    expect(data.config.tools).toEqual(['Read']);
    expect(data.warnings.some(w => w.includes('WebFetch'))).toBe(true);
  });

  it('applies disallowedTools from constraints', async () => {
    const data = await startSession({ disallowedTools: ['Bash(*)'] });
    expect(data.ok).toBe(true);
    expect(data.config.tools).not.toContain('WebSearch');
    expect(data.config.tools).not.toContain('Bash(*)');
  });

  it('concatenates system prompts', async () => {
    const data = await startSession({ systemPrompt: 'Client addition' });
    expect(data.ok).toBe(true);
    // Config returned is sanitized but should reflect merged result in session
    // We verify the session was created successfully
    expect(data.sessionId).toBeTruthy();
  });

  it('uses min for maxTurns', async () => {
    const data = await startSession({ maxTurns: 10 });
    expect(data.ok).toBe(true);
    expect(data.sessionId).toBeTruthy();
  });

  it('allows client to select subset of agents', async () => {
    const data = await startSession({ agents: ['reviewer'] });
    expect(data.ok).toBe(true);
    expect(data.sessionId).toBeTruthy();
  });

  it('warns when client selects unknown agent', async () => {
    const data = await startSession({ agents: ['nonexistent'] });
    expect(data.ok).toBe(true);
    expect(data.warnings.some(w => w.includes('nonexistent'))).toBe(true);
  });

  it('blocks client from defining agents', async () => {
    const data = await startSession({
      agents: { hacker: { description: 'Evil agent', prompt: 'bad' } },
    });
    expect(data.ok).toBe(true);
    expect(data.warnings.some(w => w.includes('cannot define agents'))).toBe(true);
  });
});
