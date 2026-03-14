/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useChat, ClaudeContext } from '@shaykec/agent-web/react';
import {
  MSG_CHAT_STREAM,
  MSG_CHAT_ASSISTANT,
  MSG_CHAT_TOOL_USE,
  MSG_CHAT_TOOL_RESULT,
  MSG_CHAT_STATUS,
  MSG_CHAT_ERROR,
  MSG_CHAT_USER,
  MSG_SESSION_CREATED,
  MSG_SESSION_RESUMED,
} from '@shaykec/agent-web/protocol';

function makeContextValue(overrides = {}) {
  return {
    httpUrl: 'http://localhost:9999',
    wsUrl: 'ws://localhost:9999',
    config: {},
    status: 'connected',
    transport: 'ws',
    subscribe: vi.fn(() => vi.fn()),
    sendEvent: vi.fn(),
    ...overrides,
  };
}

function wrapper(ctx) {
  return ({ children }) =>
    React.createElement(ClaudeContext.Provider, { value: ctx }, children);
}

describe('useChat', () => {
  let mockFetch;

  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with empty state', () => {
    const ctx = makeContextValue();
    const { result } = renderHook(() => useChat(), { wrapper: wrapper(ctx) });

    expect(result.current.messages).toEqual([]);
    expect(result.current.status).toBe('idle');
    expect(result.current.sessionId).toBeNull();
    expect(result.current.resolvedConfig).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isStreaming).toBe(false);
  });

  it('subscribes to the provider on mount', () => {
    const ctx = makeContextValue();
    renderHook(() => useChat(), { wrapper: wrapper(ctx) });
    expect(ctx.subscribe).toHaveBeenCalledOnce();
  });

  it('handles chat:stream messages and updates streaming text', () => {
    const ctx = makeContextValue();
    let subscriber;
    ctx.subscribe = vi.fn((fn) => { subscriber = fn; return () => {}; });

    const { result } = renderHook(() => useChat(), { wrapper: wrapper(ctx) });

    act(() => {
      subscriber({ type: MSG_CHAT_STREAM, payload: { delta: 'Hello', fullText: 'Hello' }, timestamp: 1 });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe('assistant');
    expect(result.current.messages[0].text).toBe('Hello');
    expect(result.current.messages[0]._streaming).toBe(true);
    expect(result.current.status).toBe('streaming');

    act(() => {
      subscriber({ type: MSG_CHAT_STREAM, payload: { delta: ' world', fullText: 'Hello world' }, timestamp: 2 });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe('Hello world');
  });

  it('handles chat:assistant finalization', () => {
    const ctx = makeContextValue();
    let subscriber;
    ctx.subscribe = vi.fn((fn) => { subscriber = fn; return () => {}; });

    const { result } = renderHook(() => useChat(), { wrapper: wrapper(ctx) });

    act(() => {
      subscriber({ type: MSG_CHAT_STREAM, payload: { fullText: 'partial' }, timestamp: 1 });
    });
    act(() => {
      subscriber({ type: MSG_CHAT_ASSISTANT, payload: { text: 'final text' }, timestamp: 2 });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe('final text');
    expect(result.current.messages[0]._streaming).toBe(false);
  });

  it('handles chat:tool-use messages', () => {
    const ctx = makeContextValue();
    let subscriber;
    ctx.subscribe = vi.fn((fn) => { subscriber = fn; return () => {}; });
    const onToolUse = vi.fn();

    const { result } = renderHook(() => useChat({ onToolUse }), { wrapper: wrapper(ctx) });

    act(() => {
      subscriber({
        type: MSG_CHAT_TOOL_USE,
        payload: { toolName: 'Read', toolId: 't1', input: { path: '/foo' } },
        timestamp: 1,
      });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe('tool-use');
    expect(onToolUse).toHaveBeenCalledWith({ toolName: 'Read', toolId: 't1', input: { path: '/foo' } });
  });

  it('handles chat:tool-result messages', () => {
    const ctx = makeContextValue();
    let subscriber;
    ctx.subscribe = vi.fn((fn) => { subscriber = fn; return () => {}; });

    const { result } = renderHook(() => useChat(), { wrapper: wrapper(ctx) });

    act(() => {
      subscriber({
        type: MSG_CHAT_TOOL_RESULT,
        payload: { toolId: 't1', output: 'file content' },
        timestamp: 1,
      });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe('tool-result');
  });

  it('handles chat:error messages', () => {
    const ctx = makeContextValue();
    let subscriber;
    ctx.subscribe = vi.fn((fn) => { subscriber = fn; return () => {}; });
    const onError = vi.fn();

    const { result } = renderHook(() => useChat({ onError }), { wrapper: wrapper(ctx) });

    act(() => {
      subscriber({
        type: MSG_CHAT_ERROR,
        payload: { message: 'Something went wrong' },
        timestamp: 1,
      });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe('error');
    expect(result.current.error).toBe('Something went wrong');
    expect(onError).toHaveBeenCalledWith({ message: 'Something went wrong' });
  });

  it('handles chat:status messages', () => {
    const ctx = makeContextValue();
    let subscriber;
    ctx.subscribe = vi.fn((fn) => { subscriber = fn; return () => {}; });

    const { result } = renderHook(() => useChat(), { wrapper: wrapper(ctx) });

    act(() => {
      subscriber({ type: MSG_CHAT_STATUS, payload: { status: 'thinking' }, timestamp: 1 });
    });

    expect(result.current.status).toBe('thinking');
    expect(result.current.isStreaming).toBe(true);
  });

  it('handles session:created messages', () => {
    const ctx = makeContextValue();
    let subscriber;
    ctx.subscribe = vi.fn((fn) => { subscriber = fn; return () => {}; });

    const { result } = renderHook(() => useChat(), { wrapper: wrapper(ctx) });

    act(() => {
      subscriber({
        type: MSG_SESSION_CREATED,
        payload: { sessionId: 'ses-1', config: { model: 'claude-sonnet-4-6' } },
        timestamp: 1,
      });
    });

    expect(result.current.sessionId).toBe('ses-1');
    expect(result.current.resolvedConfig).toEqual({ model: 'claude-sonnet-4-6' });
  });

  it('handles session:resumed messages', () => {
    const ctx = makeContextValue();
    let subscriber;
    ctx.subscribe = vi.fn((fn) => { subscriber = fn; return () => {}; });

    const { result } = renderHook(() => useChat(), { wrapper: wrapper(ctx) });

    act(() => {
      subscriber({
        type: MSG_SESSION_RESUMED,
        payload: { sessionId: 'ses-2', config: { model: 'claude-haiku-3-5' } },
        timestamp: 1,
      });
    });

    expect(result.current.sessionId).toBe('ses-2');
    expect(result.current.resolvedConfig).toEqual({ model: 'claude-haiku-3-5' });
  });

  it('fires onMessage callback for every message', () => {
    const ctx = makeContextValue();
    let subscriber;
    ctx.subscribe = vi.fn((fn) => { subscriber = fn; return () => {}; });
    const onMessage = vi.fn();

    renderHook(() => useChat({ onMessage }), { wrapper: wrapper(ctx) });

    act(() => {
      subscriber({ type: MSG_CHAT_STATUS, payload: { status: 'idle' }, timestamp: 1 });
    });

    expect(onMessage).toHaveBeenCalledOnce();
  });

  it('send() auto-creates a session on first message', async () => {
    const ctx = makeContextValue();
    ctx.subscribe = vi.fn(() => () => {});

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessionId: 'auto-1', config: { model: 'claude-sonnet-4-6' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

    const { result } = renderHook(() => useChat(), { wrapper: wrapper(ctx) });

    await act(async () => {
      await result.current.send('hello');
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toContain('/chat/start');
    expect(mockFetch.mock.calls[1][0]).toContain('/chat/message');
    expect(result.current.messages.length).toBeGreaterThanOrEqual(1);
  });

  it('clearMessages() empties the message array', () => {
    const ctx = makeContextValue();
    let subscriber;
    ctx.subscribe = vi.fn((fn) => { subscriber = fn; return () => {}; });

    const { result } = renderHook(() => useChat(), { wrapper: wrapper(ctx) });

    act(() => {
      subscriber({ type: MSG_CHAT_ASSISTANT, payload: { text: 'hi' }, timestamp: 1 });
    });
    expect(result.current.messages).toHaveLength(1);

    act(() => {
      result.current.clearMessages();
    });
    expect(result.current.messages).toEqual([]);
  });

  it('ignores chat:user messages from client source', () => {
    const ctx = makeContextValue();
    let subscriber;
    ctx.subscribe = vi.fn((fn) => { subscriber = fn; return () => {}; });

    const { result } = renderHook(() => useChat(), { wrapper: wrapper(ctx) });

    act(() => {
      subscriber({
        type: MSG_CHAT_USER,
        source: 'client',
        payload: { text: 'echo' },
        timestamp: 1,
      });
    });

    expect(result.current.messages).toHaveLength(0);
  });

  it('stop() calls the server stop endpoint', async () => {
    const ctx = makeContextValue();
    let subscriber;
    ctx.subscribe = vi.fn((fn) => { subscriber = fn; return () => {}; });

    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    const { result } = renderHook(() => useChat(), { wrapper: wrapper(ctx) });

    act(() => {
      subscriber({ type: MSG_SESSION_CREATED, payload: { sessionId: 's1' }, timestamp: 1 });
    });

    await act(async () => {
      await result.current.stop();
    });

    const stopCall = mockFetch.mock.calls.find(c => c[0].includes('/chat/stop'));
    expect(stopCall).toBeTruthy();
  });
});
