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
 * @param {function} [props.onMessage] - Called for every incoming message (for non-chat routing)
 * @param {object} [props.handshake] - Extra fields merged into sys:connect payload
 * @param {string} [props.wsPath] - WebSocket endpoint path (default '/ws')
 * @param {string} [props.ssePath] - SSE endpoint path (default '/sse')
 * @param {React.ReactNode} props.children
 */
export function ClaudeProvider({ url, config, onMessage: onMessageProp, handshake, wsPath, ssePath, children }) {
  const subscribersRef = useRef(new Set());
  const onMessagePropRef = useRef(onMessageProp);
  useEffect(() => {
    onMessagePropRef.current = onMessageProp;
  }, [onMessageProp]);

  const handleMessage = useCallback((msg) => {
    if (onMessagePropRef.current) {
      try { onMessagePropRef.current(msg); } catch { /* caller error */ }
    }
    for (const fn of subscribersRef.current) {
      try { fn(msg); } catch { /* subscriber error */ }
    }
  }, []);

  const connectionOptions = useMemo(() => {
    const opts = { url, onMessage: handleMessage };
    if (handshake) opts.handshake = handshake;
    if (wsPath) opts.wsPath = wsPath;
    if (ssePath) opts.ssePath = ssePath;
    return opts;
  }, [url, handleMessage, handshake, wsPath, ssePath]);

  const { status, transport, sendEvent } = useConnection(connectionOptions);

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
