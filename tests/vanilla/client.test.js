/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaudeClient } from '../../src/vanilla/index.js';

let wsInstances = [];

class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
    this._sent = [];
    wsInstances.push(this);
  }

  send(data) { this._sent.push(data); }
  close() {
    this.readyState = 3;
    if (this.onclose) this.onclose({ code: 1000 });
  }

  _simulateOpen() {
    this.readyState = 1;
    if (this.onopen) this.onopen({});
  }

  _simulateMessage(data) {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(data) });
  }
}

describe('ClaudeClient (vanilla)', () => {
  let mockFetch;

  beforeEach(() => {
    wsInstances = [];
    globalThis.WebSocket = MockWebSocket;
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    delete globalThis.WebSocket;
    vi.restoreAllMocks();
  });

  it('constructs with url and config', () => {
    const client = new ClaudeClient('http://localhost:3456', { model: 'test' });
    expect(client.connected).toBe(false);
    expect(client.clientId).toBeNull();
  });

  it('connect() opens WebSocket and resolves on handshake', async () => {
    const client = new ClaudeClient('http://localhost:3456');
    const connectPromise = client.connect();

    await vi.waitFor(() => expect(wsInstances).toHaveLength(1));
    const ws = wsInstances[0];

    expect(ws.url).toBe('ws://localhost:3456/ws');

    ws._simulateOpen();

    const handshake = JSON.parse(ws._sent[0]);
    expect(handshake.type).toBe('sys:connect');

    ws._simulateMessage({
      type: 'sys:connect',
      payload: { clientId: 'c-1' },
      source: 'server',
    });

    await connectPromise;

    expect(client.connected).toBe(true);
    expect(client.clientId).toBe('c-1');
  });

  it('onMessage() delivers envelopes after handshake', async () => {
    const client = new ClaudeClient('http://localhost:3456');
    const connectPromise = client.connect();

    const ws = wsInstances[0];
    ws._simulateOpen();
    ws._simulateMessage({ type: 'sys:connect', payload: { clientId: 'c-1' }, source: 'server' });
    await connectPromise;

    const listener = vi.fn();
    client.onMessage(listener);

    ws._simulateMessage({ type: 'chat:stream', payload: { delta: 'hi' } });

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].type).toBe('chat:stream');
  });

  it('onMessage() returns unsubscribe function', async () => {
    const client = new ClaudeClient('http://localhost:3456');
    const connectPromise = client.connect();
    const ws = wsInstances[0];
    ws._simulateOpen();
    ws._simulateMessage({ type: 'sys:connect', payload: { clientId: 'c-1' }, source: 'server' });
    await connectPromise;

    const listener = vi.fn();
    const unsub = client.onMessage(listener);

    ws._simulateMessage({ type: 'chat:stream', payload: {} });
    expect(listener).toHaveBeenCalledOnce();

    unsub();

    ws._simulateMessage({ type: 'chat:stream', payload: {} });
    expect(listener).toHaveBeenCalledOnce();
  });

  it('createSession() posts to /chat/start', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionId: 'ses-1', config: { model: 'claude-sonnet-4-6' } }),
    });

    const client = new ClaudeClient('http://localhost:3456', { model: 'claude-sonnet-4-6' });
    const result = await client.createSession({ tools: ['Read'] });

    expect(result.sessionId).toBe('ses-1');
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:3456/chat/start');
    expect(opts.method).toBe('POST');

    const body = JSON.parse(opts.body);
    expect(body.config.model).toBe('claude-sonnet-4-6');
    expect(body.config.tools).toEqual(['Read']);
  });

  it('send() posts to /chat/message', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });

    const client = new ClaudeClient('http://localhost:3456');
    await client.send('ses-1', 'Hello');

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:3456/chat/message');
    const body = JSON.parse(opts.body);
    expect(body.sessionId).toBe('ses-1');
    expect(body.text).toBe('Hello');
  });

  it('stop() posts to /chat/stop', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const client = new ClaudeClient('http://localhost:3456');
    await client.stop('ses-1');

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:3456/chat/stop');
  });

  it('resumeSession() posts to /chat/resume', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionId: 'res-1', ok: true }),
    });

    const client = new ClaudeClient('http://localhost:3456', { model: 'base' });
    const result = await client.resumeSession('res-1', { tools: ['Write'] });

    expect(result.sessionId).toBe('res-1');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.sessionId).toBe('res-1');
    expect(body.config.tools).toEqual(['Write']);
  });

  it('listSessions() fetches from /chat/sessions', async () => {
    const sessions = [{ sessionId: 's1' }, { sessionId: 's2' }];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessions }),
    });

    const client = new ClaudeClient('http://localhost:3456');
    const result = await client.listSessions();

    expect(result).toEqual(sessions);
    expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:3456/chat/sessions');
  });

  it('listSessions() includes dir parameter', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessions: [] }),
    });

    const client = new ClaudeClient('http://localhost:3456');
    await client.listSessions('/project');

    expect(mockFetch.mock.calls[0][0]).toContain('dir=%2Fproject');
  });

  it('createSession() throws on server error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'SDK not available' }),
    });

    const client = new ClaudeClient('http://localhost:3456');
    await expect(client.createSession()).rejects.toThrow('SDK not available');
  });

  it('disconnect() closes WebSocket and clears state', async () => {
    const client = new ClaudeClient('http://localhost:3456');
    const connectPromise = client.connect();
    const ws = wsInstances[0];
    ws._simulateOpen();
    ws._simulateMessage({ type: 'sys:connect', payload: { clientId: 'c-1' }, source: 'server' });
    await connectPromise;

    expect(client.connected).toBe(true);

    client.disconnect();

    expect(client.connected).toBe(false);
  });

  it('connect() rejects if WebSocket closes before handshake', async () => {
    const client = new ClaudeClient('http://localhost:3456');
    const connectPromise = client.connect();
    const ws = wsInstances[0];

    ws.readyState = 3;
    if (ws.onclose) ws.onclose({ code: 1006 });

    await expect(connectPromise).rejects.toThrow('Connection closed before handshake');
  });
});
