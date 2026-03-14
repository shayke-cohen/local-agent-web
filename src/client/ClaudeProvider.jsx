/**
 * ClaudeProvider — React context provider for agent-web.
 *
 * Wraps the app with connection state, config defaults, and a message bus
 * that hooks can subscribe to.
 */

import { createContext, useCallback, useRef, useEffect, useMemo } from 'react';
import { useConnection } from './hooks/useConnection.js';

/**
 * @typedef {object} ClaudeContextValue
 * @property {string} httpUrl - HTTP base URL for REST endpoints
 * @property {string} wsUrl - WebSocket URL
 * @property {object} [config] - Default config for sessions
 * @property {string} status - Connection status
 * @property {string|null} transport - Active transport type
 * @property {function} subscribe - Subscribe to incoming messages
 * @property {function} sendEvent - Send a raw protocol event
 */

export const ClaudeContext = createContext(null);

/**
 * @param {object} props
 * @param {string} props.url - Server URL (e.g., 'http://localhost:3456')
 * @param {object} [props.config] - Default config for all sessions
 * @param {React.ReactNode} props.children
 */
export function ClaudeProvider({ url, config, children }) {
  const subscribersRef = useRef(new Set());

  const handleMessage = useCallback((msg) => {
    for (const fn of subscribersRef.current) {
      try { fn(msg); } catch { /* subscriber error */ }
    }
  }, []);

  const { status, transport, sendEvent } = useConnection({
    url,
    onMessage: handleMessage,
  });

  const subscribe = useCallback((fn) => {
    subscribersRef.current.add(fn);
    return () => subscribersRef.current.delete(fn);
  }, []);

  const httpUrl = useMemo(() => {
    if (!url) return 'http://localhost:3456';
    if (url.startsWith('http')) return url;
    return url.replace(/^ws/, 'http');
  }, [url]);

  const value = useMemo(() => ({
    httpUrl,
    wsUrl: url,
    config: config || {},
    status,
    transport,
    subscribe,
    sendEvent,
  }), [httpUrl, url, config, status, transport, subscribe, sendEvent]);

  return (
    <ClaudeContext.Provider value={value}>
      {children}
    </ClaudeContext.Provider>
  );
}
