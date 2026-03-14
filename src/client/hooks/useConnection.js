/**
 * useConnection — transport layer hook.
 *
 * Connects via WebSocket (primary) with SSE fallback.
 * Handles auto-reconnect with exponential backoff.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { MSG_SYS_CONNECT } from '../../protocol/messages.js';
import { PROTOCOL_VERSION } from '../../protocol/envelope.js';

/**
 * @param {object} options
 * @param {string} options.url - Server URL (e.g., 'ws://localhost:3456' or 'http://localhost:3456')
 * @param {function} [options.onMessage] - Callback for incoming messages
 * @param {boolean} [options.autoConnect=true] - Connect on mount
 * @param {object} [options.handshake] - Extra fields merged into sys:connect payload
 * @param {string} [options.wsPath='/ws'] - WebSocket endpoint path
 * @param {string} [options.ssePath='/sse'] - SSE endpoint path
 * @returns {{ status, transport, sendMessage, sendEvent }}
 */
export function useConnection(options = {}) {
  const {
    url,
    onMessage,
    autoConnect = true,
    handshake,
    wsPath = '/ws',
    ssePath = '/sse',
  } = options;

  const [status, setStatus] = useState('disconnected');
  const [transport, setTransport] = useState(null);
  const wsRef = useRef(null);
  const sseRef = useRef(null);
  const retryRef = useRef(0);
  const retryTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const wsUrl = deriveWsUrl(url);
  const httpUrl = deriveHttpUrl(url);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      if (wsRef.current.readyState === 1 /* OPEN */ ||
          wsRef.current.readyState === 0 /* CONNECTING */) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const handleMessage = useCallback((data) => {
    try {
      const msg = typeof data === 'string' ? JSON.parse(data) : data;
      if (onMessageRef.current) {
        onMessageRef.current(msg);
      }
    } catch (err) {
      console.warn('[useConnection] Failed to parse message:', err);
    }
  }, []);

  const handshakeRef = useRef(handshake);
  useEffect(() => {
    handshakeRef.current = handshake;
  }, [handshake]);

  const sendHandshake = useCallback((via) => {
    const msg = {
      v: PROTOCOL_VERSION,
      type: MSG_SYS_CONNECT,
      payload: {
        clientType: 'browser',
        protocolVersion: PROTOCOL_VERSION,
        ...handshakeRef.current,
      },
      source: 'client',
      timestamp: Date.now(),
    };

    if (via === 'ws' && wsRef.current?.readyState === 1 /* OPEN */) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    const delay = Math.min(1000 * Math.pow(2, retryRef.current), 30000);
    retryRef.current += 1;
    setStatus('disconnected');
    retryTimerRef.current = setTimeout(() => {
      if (mountedRef.current) connectWebSocket();
    }, delay);
  }, []);

  const connectSSE = useCallback(() => {
    if (!mountedRef.current) return;
    setStatus('connecting');

    try {
      const sse = new EventSource(`${httpUrl}${ssePath}`);
      sseRef.current = sse;

      sse.onopen = () => {
        if (!mountedRef.current) return;
        setStatus('connected');
        setTransport('sse');
        retryRef.current = 0;
      };

      sse.onmessage = (event) => {
        if (!mountedRef.current) return;
        handleMessage(event.data);
      };

      sse.onerror = () => {
        if (!mountedRef.current) return;
        sse.close();
        sseRef.current = null;
        setTransport(null);
        scheduleReconnect();
      };
    } catch {
      setTransport(null);
      scheduleReconnect();
    }
  }, [httpUrl, ssePath, handleMessage, scheduleReconnect]);

  const connectWebSocket = useCallback(() => {
    if (!mountedRef.current) return;
    cleanup();
    setStatus('connecting');

    try {
      const ws = new WebSocket(`${wsUrl}${wsPath}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setStatus('connected');
        setTransport('ws');
        retryRef.current = 0;
        sendHandshake('ws');
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        handleMessage(event.data);
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;
        wsRef.current = null;
        setTransport(null);
        if (event.code === 1000 || retryRef.current === 0) {
          connectSSE();
        } else {
          scheduleReconnect();
        }
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        if (retryRef.current === 0) {
          wsRef.current = null;
          setTransport(null);
          connectSSE();
        }
      };
    } catch {
      connectSSE();
    }
  }, [wsUrl, wsPath, cleanup, handleMessage, sendHandshake, connectSSE, scheduleReconnect]);

  /**
   * Send a raw envelope via WebSocket.
   * Falls back to REST POST for SSE transport.
   */
  const sendEvent = useCallback((type, payload, sessionId) => {
    const msg = {
      v: PROTOCOL_VERSION,
      type,
      payload,
      source: 'client',
      timestamp: Date.now(),
    };
    if (sessionId) msg.sessionId = sessionId;

    if (transport === 'ws' && wsRef.current?.readyState === 1 /* OPEN */) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      fetch(`${httpUrl}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: payload?.text, sessionId }),
      }).catch(err => {
        console.warn('[useConnection] REST fallback failed:', err);
      });
    }
  }, [transport, httpUrl]);

  useEffect(() => {
    mountedRef.current = true;
    if (autoConnect && url) connectWebSocket();
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [url]);

  return { status, transport, sendEvent };
}

function deriveWsUrl(url) {
  if (!url) return 'ws://localhost:3456';
  if (url.startsWith('ws://') || url.startsWith('wss://')) return url;
  return url.replace(/^http/, 'ws');
}

function deriveHttpUrl(url) {
  if (!url) return 'http://localhost:3456';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return url.replace(/^ws/, 'http');
}
