/**
 * ClaudeChat — drop-in embeddable chat component.
 *
 * Wires everything: provider, connection, hooks, and full chat UI.
 * Import and render with just a `url` prop for a complete Claude Code chat.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ClaudeProvider } from '../ClaudeProvider.jsx';
import { useChat } from '../hooks/useChat.js';
import { useSessions } from '../hooks/useSessions.js';
import { ClaudeMessage } from './ClaudeMessage.jsx';
import { ClaudeToolUse } from './ClaudeToolUse.jsx';

/**
 * @param {object} props
 * @param {string} props.url - Server URL
 * @param {string} [props.model] - Model override
 * @param {string[]} [props.tools] - Tools override
 * @param {string} [props.systemPrompt] - System prompt override
 * @param {string} [props.theme='dark'] - 'dark' or 'light'
 * @param {string} [props.placeholder='Ask Claude...']
 * @param {boolean} [props.showSessions=true] - Show session picker
 * @param {boolean} [props.showToolUse=true] - Show tool use details
 * @param {function} [props.onMessage] - Message callback
 * @param {function} [props.onToolUse] - Tool use callback
 * @param {function} [props.onError] - Error callback
 * @param {string} [props.className] - Additional CSS class
 * @param {object} [props.style] - Additional inline styles
 */
export function ClaudeChat(props) {
  const {
    url,
    model,
    tools,
    systemPrompt,
    theme = 'dark',
    handshake,
    wsPath,
    ssePath,
    onRawMessage,
    ...chatProps
  } = props;

  const config = {};
  if (model) config.model = model;
  if (tools) config.tools = tools;
  if (systemPrompt) config.systemPrompt = systemPrompt;

  return (
    <ClaudeProvider url={url} config={config} onMessage={onRawMessage} handshake={handshake} wsPath={wsPath} ssePath={ssePath}>
      <ChatInner theme={theme} {...chatProps} />
    </ClaudeProvider>
  );
}

function ChatInner({
  theme = 'dark',
  themeTokens,
  placeholder = 'Ask Claude...',
  showSessions = true,
  showToolUse = true,
  onMessage,
  onToolUse,
  onError,
  className = '',
  style = {},
  labels = {},
  renderHeader,
  renderWelcome,
  renderMessage,
  renderToolUse,
  renderInput,
  renderSessionItem,
  renderError,
  renderStatus,
}) {
  const {
    messages,
    send,
    stop,
    isStreaming,
    status,
    sessionId,
    resolvedConfig,
    error,
  } = useChat({ onMessage, onToolUse, onError });

  const { sessions, refresh: refreshSessions, resume } = useSessions();

  const [input, setInput] = useState('');
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    send(input.trim());
    setInput('');
  }, [input, isStreaming, send]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);

  const handleResume = useCallback(async (sid) => {
    await resume(sid);
    setSessionsOpen(false);
  }, [resume]);

  const themeClass = theme === 'light' ? 'awc-light' : 'awc-dark';

  return (
    <div
      className={`awc-chat ${themeClass} ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 400,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 14,
        ...getThemeVars(theme, themeTokens),
        ...style,
      }}
    >
      {/* Header */}
      {renderHeader ? renderHeader({ status, resolvedConfig, sessions, sessionsOpen, setSessionsOpen, refreshSessions, showSessions }) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          borderBottom: '1px solid var(--awc-border)',
          backgroundColor: 'var(--awc-bg-secondary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, color: 'var(--awc-text)' }}>{labels.title || 'Claude'}</span>
            {resolvedConfig?.model && (
              <span style={{ fontSize: 12, color: 'var(--awc-text-secondary)', backgroundColor: 'var(--awc-bg-tertiary)', padding: '2px 6px', borderRadius: 4 }}>
                {resolvedConfig.model}
              </span>
            )}
            <StatusDot status={status} />
          </div>
          {showSessions && (
            <button
              onClick={() => { setSessionsOpen(!sessionsOpen); refreshSessions(); }}
              style={{
                background: 'none', border: '1px solid var(--awc-border)', borderRadius: 4,
                padding: '4px 8px', cursor: 'pointer', color: 'var(--awc-text-secondary)', fontSize: 12,
              }}
            >
              {labels.sessions || 'Sessions'}
            </button>
          )}
        </div>
      )}

      {/* Sessions dropdown */}
      {sessionsOpen && (
        <div style={{
          padding: 8, borderBottom: '1px solid var(--awc-border)',
          backgroundColor: 'var(--awc-bg-secondary)', maxHeight: 200, overflowY: 'auto',
        }}>
          {sessions.length === 0 && (
            <div style={{ color: 'var(--awc-text-secondary)', fontSize: 12, padding: 8 }}>
              No previous sessions
            </div>
          )}
          {sessions.map(s => renderSessionItem ? (
            <React.Fragment key={s.sessionId}>
              {renderSessionItem(s, handleResume, s.sessionId === sessionId)}
            </React.Fragment>
          ) : (
            <div
              key={s.sessionId}
              onClick={() => handleResume(s.sessionId)}
              style={{
                padding: '6px 8px', borderRadius: 4, cursor: 'pointer',
                color: 'var(--awc-text)', fontSize: 12,
                backgroundColor: s.sessionId === sessionId ? 'var(--awc-bg-tertiary)' : 'transparent',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--awc-bg-tertiary)'; }}
              onMouseLeave={(e) => {
                if (s.sessionId !== sessionId) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div style={{ fontWeight: 500 }}>{s.summary || 'Untitled session'}</div>
              <div style={{ color: 'var(--awc-text-secondary)', fontSize: 11 }}>
                {new Date(s.lastModified).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: 16,
        backgroundColor: 'var(--awc-bg)',
      }}>
        {messages.length === 0 && (
          renderWelcome ? renderWelcome({ send }) : (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', color: 'var(--awc-text-secondary)',
            }}>
              {labels.welcome || 'Start a conversation with Claude'}
            </div>
          )
        )}
        {messages.map((msg) => {
          if (msg.role === 'tool-use' || msg.role === 'tool-result') {
            if (!showToolUse) return null;
            if (renderToolUse) return <React.Fragment key={msg.id}>{renderToolUse(msg, theme)}</React.Fragment>;
            return <ClaudeToolUse key={msg.id} message={msg} theme={theme} />;
          }
          if (renderMessage) return <React.Fragment key={msg.id}>{renderMessage(msg, theme)}</React.Fragment>;
          return <ClaudeMessage key={msg.id} message={msg} theme={theme} />;
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      {error && (
        renderError ? renderError(error) : (
          <div style={{
            padding: '8px 16px', backgroundColor: 'var(--awc-error-bg)',
            color: 'var(--awc-error)', fontSize: 12, borderTop: '1px solid var(--awc-error)',
          }}>
            {error}
          </div>
        )
      )}

      {/* Input */}
      {renderInput ? renderInput({ input, setInput, handleSubmit, handleKeyDown, isStreaming, send, stop, placeholder: labels.placeholder || placeholder, inputRef }) : (
        <form onSubmit={handleSubmit} style={{
          display: 'flex', gap: 8, padding: '12px 16px',
          borderTop: '1px solid var(--awc-border)',
          backgroundColor: 'var(--awc-bg-secondary)',
        }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={labels.placeholder || placeholder}
            disabled={false}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 6,
              border: '1px solid var(--awc-border)', backgroundColor: 'var(--awc-bg)',
              color: 'var(--awc-text)', outline: 'none', fontSize: 14,
            }}
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={stop}
              style={{
                padding: '8px 16px', borderRadius: 6, border: 'none',
                backgroundColor: 'var(--awc-error)', color: '#fff',
                cursor: 'pointer', fontWeight: 500, fontSize: 14,
              }}
            >
              {labels.stop || 'Stop'}
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              style={{
                padding: '8px 16px', borderRadius: 6, border: 'none',
                backgroundColor: input.trim() ? 'var(--awc-accent)' : 'var(--awc-bg-tertiary)',
                color: input.trim() ? '#fff' : 'var(--awc-text-secondary)',
                cursor: input.trim() ? 'pointer' : 'default', fontWeight: 500, fontSize: 14,
              }}
            >
              {labels.send || 'Send'}
            </button>
          )}
        </form>
      )}
    </div>
  );
}

function StatusDot({ status }) {
  const color =
    status === 'streaming' || status === 'thinking' ? '#f59e0b' :
    status === 'idle' || status === 'connected' ? '#3fb950' :
    status === 'error' || status === 'stopped' ? '#f85149' :
    '#6b7280';

  return (
    <span style={{
      width: 8, height: 8, borderRadius: '50%',
      backgroundColor: color, display: 'inline-block',
    }} title={status} />
  );
}

export const THEME_PRESETS = {
  dark: {
    '--awc-bg': '#0d1117',
    '--awc-bg-secondary': '#161b22',
    '--awc-bg-tertiary': '#21262d',
    '--awc-text': '#c9d1d9',
    '--awc-text-secondary': '#8b949e',
    '--awc-border': '#30363d',
    '--awc-accent': '#58a6ff',
    '--awc-error': '#f85149',
    '--awc-error-bg': '#1a0000',
    '--awc-code-bg': '#161b22',
  },
  light: {
    '--awc-bg': '#ffffff',
    '--awc-bg-secondary': '#f9fafb',
    '--awc-bg-tertiary': '#f3f4f6',
    '--awc-text': '#111827',
    '--awc-text-secondary': '#6b7280',
    '--awc-border': '#e5e7eb',
    '--awc-accent': '#2563eb',
    '--awc-error': '#dc2626',
    '--awc-error-bg': '#fef2f2',
    '--awc-code-bg': '#f3f4f6',
  },
  github: {
    '--awc-bg': '#0d1117',
    '--awc-bg-secondary': '#161b22',
    '--awc-bg-tertiary': '#21262d',
    '--awc-text': '#c9d1d9',
    '--awc-text-secondary': '#8b949e',
    '--awc-border': '#30363d',
    '--awc-accent': '#58a6ff',
    '--awc-error': '#f85149',
    '--awc-error-bg': '#3d1416',
    '--awc-code-bg': '#161b22',
  },
};

/**
 * Resolve theme vars from a preset name, custom tokens, or both.
 * Custom tokens use short names (e.g., 'background') that map to CSS vars.
 */
const TOKEN_MAP = {
  background: '--awc-bg',
  surface: '--awc-bg-secondary',
  surfaceAlt: '--awc-bg-tertiary',
  text: '--awc-text',
  textSecondary: '--awc-text-secondary',
  border: '--awc-border',
  primary: '--awc-accent',
  accent: '--awc-accent',
  error: '--awc-error',
  errorBackground: '--awc-error-bg',
  codeBackground: '--awc-code-bg',
};

function getThemeVars(theme, themeTokens) {
  const base = THEME_PRESETS[theme] || THEME_PRESETS.dark;
  if (!themeTokens) return base;

  const overrides = {};
  for (const [key, value] of Object.entries(themeTokens)) {
    const cssVar = TOKEN_MAP[key] || key;
    overrides[cssVar] = value;
  }
  return { ...base, ...overrides };
}
