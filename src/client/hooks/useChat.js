/**
 * useChat — React hook for Claude Code chat.
 *
 * Provides: messages array, send/stop functions, streaming status,
 * resolved config, and error state.
 */

import { useState, useCallback, useRef, useEffect, useContext } from 'react';
import { ClaudeContext } from '../ClaudeProvider.jsx';
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
  ChatStatus,
} from '../../protocol/messages.js';

/**
 * @typedef {object} ChatMessage
 * @property {string} id - Unique message ID
 * @property {'user'|'assistant'|'tool-use'|'tool-result'|'error'|'status'} role
 * @property {string} [text] - Message text
 * @property {object} [data] - Tool/status-specific data
 * @property {number} timestamp
 */

let messageIdCounter = 0;
function generateMsgId() {
  return `msg-${Date.now()}-${++messageIdCounter}`;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] - Per-hook config overrides
 * @param {function} [options.onMessage] - Callback for each message
 * @param {function} [options.onToolUse] - Callback for tool use events
 * @param {function} [options.onError] - Callback for errors
 * @returns {{ messages, send, stop, isStreaming, status, sessionId, resolvedConfig, error, clearMessages }}
 */
export function useChat(options = {}) {
  const ctx = useContext(ClaudeContext);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('idle');
  const [sessionId, setSessionId] = useState(null);
  const [resolvedConfig, setResolvedConfig] = useState(null);
  const [error, setError] = useState(null);
  const streamingTextRef = useRef('');
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const httpUrl = ctx?.httpUrl || 'http://localhost:3456';

  /**
   * Process an incoming protocol envelope.
   */
  const handleEnvelope = useCallback((envelope) => {
    if (!envelope?.type) return;

    const opts = optionsRef.current;

    switch (envelope.type) {
      case MSG_CHAT_STREAM: {
        streamingTextRef.current = envelope.payload.fullText || '';
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant' && last._streaming) {
            return [
              ...prev.slice(0, -1),
              { ...last, text: streamingTextRef.current },
            ];
          }
          return [...prev, {
            id: generateMsgId(),
            role: 'assistant',
            text: envelope.payload.fullText || envelope.payload.delta || '',
            timestamp: envelope.timestamp,
            _streaming: true,
          }];
        });
        setStatus('streaming');
        break;
      }

      case MSG_CHAT_ASSISTANT: {
        streamingTextRef.current = '';
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant' && last._streaming) {
            return [
              ...prev.slice(0, -1),
              { ...last, text: envelope.payload.text, _streaming: false },
            ];
          }
          return [...prev, {
            id: generateMsgId(),
            role: 'assistant',
            text: envelope.payload.text,
            timestamp: envelope.timestamp,
            _streaming: false,
          }];
        });
        break;
      }

      case MSG_CHAT_TOOL_USE: {
        const msg = {
          id: generateMsgId(),
          role: 'tool-use',
          text: `Using ${envelope.payload.toolName}`,
          data: envelope.payload,
          timestamp: envelope.timestamp,
        };
        setMessages(prev => [...prev, msg]);
        if (opts.onToolUse) opts.onToolUse(envelope.payload);
        break;
      }

      case MSG_CHAT_TOOL_RESULT: {
        setMessages(prev => [...prev, {
          id: generateMsgId(),
          role: 'tool-result',
          data: envelope.payload,
          timestamp: envelope.timestamp,
        }]);
        break;
      }

      case MSG_CHAT_STATUS: {
        setStatus(envelope.payload.status || 'idle');
        break;
      }

      case MSG_CHAT_ERROR: {
        const errMsg = envelope.payload.message || 'Unknown error';
        setError(errMsg);
        setMessages(prev => [...prev, {
          id: generateMsgId(),
          role: 'error',
          text: errMsg,
          timestamp: envelope.timestamp,
        }]);
        if (opts.onError) opts.onError(envelope.payload);
        break;
      }

      case MSG_CHAT_USER: {
        if (envelope.source === 'client') break;
        setMessages(prev => [...prev, {
          id: generateMsgId(),
          role: 'user',
          text: envelope.payload.text,
          timestamp: envelope.timestamp,
        }]);
        break;
      }

      case MSG_SESSION_CREATED:
      case MSG_SESSION_RESUMED: {
        setSessionId(envelope.payload.sessionId);
        if (envelope.payload.config) {
          setResolvedConfig(envelope.payload.config);
        }
        break;
      }
    }

    if (opts.onMessage) opts.onMessage(envelope);
  }, []);

  // Register with the provider's message bus
  useEffect(() => {
    if (ctx?.subscribe) {
      return ctx.subscribe(handleEnvelope);
    }
  }, [ctx, handleEnvelope]);

  /**
   * Start a new session and optionally send the first message.
   */
  const createSession = useCallback(async (firstMessage) => {
    setError(null);

    const mergedConfig = {
      ...(ctx?.config || {}),
      ...(options.config || {}),
    };

    try {
      const resp = await fetch(`${httpUrl}/chat/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: mergedConfig }),
      });
      const data = await resp.json();

      if (!resp.ok) throw new Error(data.error || 'Failed to start session');

      setSessionId(data.sessionId);
      if (data.config) setResolvedConfig(data.config);

      if (firstMessage) {
        await sendImpl(data.sessionId, firstMessage);
      }

      return data.sessionId;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [httpUrl, ctx, options.config]);

  /**
   * Send a message to the current session.
   */
  const send = useCallback(async (text) => {
    if (!text?.trim()) return;

    // Auto-create session on first message
    if (!sessionId) {
      await createSession(text);
      return;
    }

    await sendImpl(sessionId, text);
  }, [sessionId, createSession, httpUrl]);

  async function sendImpl(sid, text) {
    setMessages(prev => [...prev, {
      id: generateMsgId(),
      role: 'user',
      text,
      timestamp: Date.now(),
    }]);

    setError(null);

    try {
      const resp = await fetch(`${httpUrl}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, text }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send message');
      }
    } catch (err) {
      setError(err.message);
    }
  }

  /**
   * Stop the current generation.
   */
  const stop = useCallback(async () => {
    if (!sessionId) return;

    try {
      await fetch(`${httpUrl}/chat/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    } catch { /* best effort */ }
  }, [sessionId, httpUrl]);

  /**
   * Clear the message history.
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    streamingTextRef.current = '';
  }, []);

  const isStreaming = status === 'streaming' || status === 'thinking';

  return {
    messages,
    send,
    stop,
    isStreaming,
    status,
    sessionId,
    resolvedConfig,
    error,
    clearMessages,
    createSession,
  };
}
