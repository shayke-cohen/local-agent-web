/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { useSessions } from '../../src/client/hooks/useSessions.js';
import { ClaudeContext } from '../../src/client/ClaudeProvider.jsx';

function makeContextValue(overrides = {}) {
  return {
    httpUrl: 'http://localhost:9999',
    config: {},
    ...overrides,
  };
}

function wrapper(ctx) {
  return ({ children }) =>
    React.createElement(ClaudeContext.Provider, { value: ctx }, children);
}

describe('useSessions', () => {
  let mockFetch;

  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('auto-refreshes sessions on mount', async () => {
    const sessions = [
      { sessionId: 's1', summary: 'Test session', lastModified: Date.now() },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessions }),
    });

    const ctx = makeContextValue();
    const { result } = renderHook(() => useSessions(), { wrapper: wrapper(ctx) });

    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1);
    });

    expect(result.current.sessions[0].sessionId).toBe('s1');
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('refresh() fetches sessions from server', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessions: [] }),
    });

    const ctx = makeContextValue();
    const { result } = renderHook(() => useSessions(), { wrapper: wrapper(ctx) });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    await act(async () => {
      await result.current.refresh('/some/dir');
    });

    const refreshCall = mockFetch.mock.calls.find(c =>
      c[0].includes('/chat/sessions') && c[0].includes('dir=')
    );
    expect(refreshCall).toBeTruthy();
  });

  it('create() posts to /chat/start and returns session data', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ sessions: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessionId: 'new-1', config: { model: 'claude-sonnet-4-6' } }),
      });

    const ctx = makeContextValue();
    const { result } = renderHook(() => useSessions(), { wrapper: wrapper(ctx) });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    let data;
    await act(async () => {
      data = await result.current.create({ model: 'claude-sonnet-4-6' });
    });

    expect(data.sessionId).toBe('new-1');
    const createCall = mockFetch.mock.calls.find(c => c[0].includes('/chat/start'));
    expect(createCall).toBeTruthy();
  });

  it('resume() posts to /chat/resume with session ID', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ sessions: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessionId: 'res-1', ok: true }),
      });

    const ctx = makeContextValue();
    const { result } = renderHook(() => useSessions(), { wrapper: wrapper(ctx) });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    let data;
    await act(async () => {
      data = await result.current.resume('res-1');
    });

    expect(data.sessionId).toBe('res-1');
    const resumeCall = mockFetch.mock.calls.find(c => c[0].includes('/chat/resume'));
    expect(resumeCall).toBeTruthy();
  });

  it('sets error on fetch failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Server error' }),
    });

    const ctx = makeContextValue();
    const { result } = renderHook(() => useSessions(), { wrapper: wrapper(ctx) });

    await waitFor(() => {
      expect(result.current.error).toBe('Server error');
    });
    expect(result.current.loading).toBe(false);
  });

  it('create() sets error on failure', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ sessions: [] }) })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Cannot create' }),
      });

    const ctx = makeContextValue();
    const { result } = renderHook(() => useSessions(), { wrapper: wrapper(ctx) });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    await act(async () => {
      try {
        await result.current.create();
      } catch { /* expected */ }
    });

    expect(result.current.error).toBe('Cannot create');
  });

  it('merges provider config into create() request', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ sessions: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessionId: 'x' }),
      });

    const ctx = makeContextValue({ config: { model: 'claude-haiku-3-5' } });
    const { result } = renderHook(() => useSessions(), { wrapper: wrapper(ctx) });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    await act(async () => {
      await result.current.create({ tools: ['Read'] });
    });

    const createCall = mockFetch.mock.calls.find(c => c[0].includes('/chat/start'));
    const body = JSON.parse(createCall[1].body);
    expect(body.config.model).toBe('claude-haiku-3-5');
    expect(body.config.tools).toEqual(['Read']);
  });
});
