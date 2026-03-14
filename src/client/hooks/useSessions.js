/**
 * useSessions — React hook for session management.
 *
 * Lists, creates, and resumes Claude Code sessions.
 */

import { useState, useCallback, useContext, useEffect } from 'react';
import { ClaudeContext } from '../ClaudeProvider.js';

/**
 * @returns {{ sessions, loading, error, refresh, create, resume }}
 */
export function useSessions() {
  const ctx = useContext(ClaudeContext);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const httpUrl = ctx?.httpUrl || 'http://localhost:3456';

  const refresh = useCallback(async (dir) => {
    setLoading(true);
    setError(null);
    try {
      const params = dir ? `?dir=${encodeURIComponent(dir)}` : '';
      const resp = await fetch(`${httpUrl}/chat/sessions${params}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to list sessions');
      setSessions(data.sessions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [httpUrl]);

  const create = useCallback(async (config) => {
    setError(null);
    try {
      const mergedConfig = { ...(ctx?.config || {}), ...(config || {}) };
      const resp = await fetch(`${httpUrl}/chat/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: mergedConfig }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to create session');
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [httpUrl, ctx]);

  const resume = useCallback(async (sessionId, config) => {
    setError(null);
    try {
      const mergedConfig = { ...(ctx?.config || {}), ...(config || {}) };
      const resp = await fetch(`${httpUrl}/chat/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, config: mergedConfig }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to resume session');
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [httpUrl, ctx]);

  // Auto-refresh on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  return { sessions, loading, error, refresh, create, resume };
}
