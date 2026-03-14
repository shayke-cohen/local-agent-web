/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConnection } from '@shaykec/agent-web/react';

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
    this._sent = [];
    MockWebSocket.instances.push(this);

    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) this.onopen({});
    }, 5);
  }

  send(data) { this._sent.push(data); }

  close(code, reason) {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose({ code: code || 1000 });
  }
}

MockWebSocket.OPEN = 1;
MockWebSocket.CONNECTING = 0;
MockWebSocket.instances = [];

class MockEventSource {
  constructor(url) {
    this.url = url;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    MockEventSource.instances.push(this);
    setTimeout(() => { if (this.onopen) this.onopen({}); }, 5);
  }
  close() { this._closed = true; }
}

MockEventSource.instances = [];

describe('useConnection', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    MockEventSource.instances = [];
    globalThis.WebSocket = MockWebSocket;
    globalThis.EventSource = MockEventSource;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('connects via WebSocket and sends handshake', async () => {
    const { result } = renderHook(() =>
      useConnection({ url: 'http://localhost:3456', autoConnect: true })
    );

    await vi.advanceTimersByTimeAsync(50);

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toBe('ws://localhost:3456/ws');
    expect(MockWebSocket.instances[0]._sent.length).toBeGreaterThanOrEqual(1);

    const handshake = JSON.parse(MockWebSocket.instances[0]._sent[0]);
    expect(handshake.type).toBe('sys:connect');
    // Transport state is set asynchronously via React setState
    expect(result.current.status).toBe('connected');
  });

  it('derives ws URL from http URL', async () => {
    renderHook(() =>
      useConnection({ url: 'http://localhost:4000', autoConnect: true })
    );

    await vi.advanceTimersByTimeAsync(50);

    expect(MockWebSocket.instances[0].url).toBe('ws://localhost:4000/ws');
  });

  it('does not connect when autoConnect is false', async () => {
    renderHook(() =>
      useConnection({ url: 'http://localhost:3456', autoConnect: false })
    );

    await vi.advanceTimersByTimeAsync(50);

    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('calls onMessage when messages arrive', async () => {
    const onMessage = vi.fn();
    renderHook(() =>
      useConnection({ url: 'http://localhost:3456', onMessage })
    );

    await vi.advanceTimersByTimeAsync(50);

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.onmessage({ data: JSON.stringify({ type: 'chat:stream', payload: {} }) });
    });

    expect(onMessage).toHaveBeenCalledOnce();
    expect(onMessage.mock.calls[0][0].type).toBe('chat:stream');
  });

  it('sendEvent sends via WebSocket when connected', async () => {
    const { result } = renderHook(() =>
      useConnection({ url: 'http://localhost:3456' })
    );

    await vi.advanceTimersByTimeAsync(50);

    act(() => {
      result.current.sendEvent('chat:send', { text: 'hi' }, 'session-1');
    });

    const ws = MockWebSocket.instances[0];
    const lastSent = JSON.parse(ws._sent[ws._sent.length - 1]);
    expect(lastSent.type).toBe('chat:send');
    expect(lastSent.payload.text).toBe('hi');
    expect(lastSent.sessionId).toBe('session-1');
  });

  it('falls back to SSE when WebSocket fails on first try', async () => {
    const OriginalWS = globalThis.WebSocket;
    globalThis.WebSocket = class FailingWS extends MockWebSocket {
      constructor(url) {
        super(url);
        setTimeout(() => {
          this.readyState = MockWebSocket.CLOSED;
          if (this.onerror) this.onerror({});
        }, 2);
      }
    };

    renderHook(() =>
      useConnection({ url: 'http://localhost:3456' })
    );

    await vi.advanceTimersByTimeAsync(100);

    expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(1);
    globalThis.WebSocket = OriginalWS;
  });

  it('returns disconnected status initially', () => {
    const { result } = renderHook(() =>
      useConnection({ url: 'http://localhost:3456', autoConnect: false })
    );

    expect(result.current.status).toBe('disconnected');
    expect(result.current.transport).toBeNull();
  });
});
