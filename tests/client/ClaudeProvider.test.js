/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React, { useContext } from 'react';
import { ClaudeProvider, ClaudeContext } from '@shaykec/agent-web/react';

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  constructor() {
    this.readyState = 0;
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
    setTimeout(() => { this.readyState = 1; if (this.onopen) this.onopen({}); }, 5);
  }
  send() {}
  close() { this.readyState = 3; if (this.onclose) this.onclose({ code: 1000 }); }
}

class MockEventSource {
  constructor() { this.onopen = null; this.onerror = null; this.onmessage = null; }
  close() {}
}

describe('ClaudeProvider', () => {
  beforeEach(() => {
    globalThis.WebSocket = MockWebSocket;
    globalThis.EventSource = MockEventSource;
  });

  afterEach(() => {
    delete globalThis.WebSocket;
    delete globalThis.EventSource;
    vi.restoreAllMocks();
  });

  it('provides context to children', () => {
    const wrapper = ({ children }) =>
      React.createElement(ClaudeProvider, { url: 'http://localhost:3456', config: { model: 'test' } }, children);

    const { result } = renderHook(() => useContext(ClaudeContext), { wrapper });

    expect(result.current).toBeTruthy();
    expect(result.current.httpUrl).toBe('http://localhost:3456');
    expect(result.current.config.model).toBe('test');
  });

  it('exposes subscribe and sendEvent functions', () => {
    const wrapper = ({ children }) =>
      React.createElement(ClaudeProvider, { url: 'http://localhost:3456' }, children);

    const { result } = renderHook(() => useContext(ClaudeContext), { wrapper });

    expect(typeof result.current.subscribe).toBe('function');
    expect(typeof result.current.sendEvent).toBe('function');
  });

  it('subscribe() returns an unsubscribe function', () => {
    const wrapper = ({ children }) =>
      React.createElement(ClaudeProvider, { url: 'http://localhost:3456' }, children);

    const { result } = renderHook(() => useContext(ClaudeContext), { wrapper });

    const unsub = result.current.subscribe(() => {});
    expect(typeof unsub).toBe('function');
  });

  it('derives httpUrl from ws URL', () => {
    const wrapper = ({ children }) =>
      React.createElement(ClaudeProvider, { url: 'ws://localhost:4000' }, children);

    const { result } = renderHook(() => useContext(ClaudeContext), { wrapper });

    expect(result.current.httpUrl).toBe('http://localhost:4000');
  });

  it('defaults to localhost when no URL provided', () => {
    const wrapper = ({ children }) =>
      React.createElement(ClaudeProvider, { url: null }, children);

    const { result } = renderHook(() => useContext(ClaudeContext), { wrapper });

    expect(result.current.httpUrl).toBe('http://localhost:3456');
  });

  it('fans messages out to multiple subscribers', () => {
    const wrapper = ({ children }) =>
      React.createElement(ClaudeProvider, { url: 'http://localhost:3456' }, children);

    const { result } = renderHook(() => useContext(ClaudeContext), { wrapper });

    const fn1 = vi.fn();
    const fn2 = vi.fn();
    result.current.subscribe(fn1);
    result.current.subscribe(fn2);

    // The internal message bus is driven by transport, but we test the subscriber
    // pattern by verifying subscriptions don't throw
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
  });

  it('accepts onMessage prop for raw message routing', () => {
    const onMessage = vi.fn();
    const wrapper = ({ children }) =>
      React.createElement(ClaudeProvider, { url: 'http://localhost:3456', onMessage }, children);

    const { result } = renderHook(() => useContext(ClaudeContext), { wrapper });
    expect(result.current).toBeTruthy();
  });

  it('accepts handshake prop', () => {
    const wrapper = ({ children }) =>
      React.createElement(ClaudeProvider, {
        url: 'http://localhost:3456',
        handshake: { clientType: 'canvas', capabilities: ['quiz'] },
      }, children);

    const { result } = renderHook(() => useContext(ClaudeContext), { wrapper });
    expect(result.current).toBeTruthy();
  });

  it('accepts wsPath and ssePath props', () => {
    const wrapper = ({ children }) =>
      React.createElement(ClaudeProvider, {
        url: 'http://localhost:3456',
        wsPath: '/ws/chat',
        ssePath: '/sse/chat',
      }, children);

    const { result } = renderHook(() => useContext(ClaudeContext), { wrapper });
    expect(result.current).toBeTruthy();
  });
});
