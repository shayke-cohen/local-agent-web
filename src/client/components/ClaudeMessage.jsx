/**
 * ClaudeMessage — renders a single chat message (user or assistant).
 */

import React from 'react';

/**
 * @param {object} props
 * @param {import('../hooks/useChat.js').ChatMessage} props.message
 * @param {string} [props.theme='dark']
 */
export function ClaudeMessage({ message, theme = 'dark' }) {
  const isUser = message.role === 'user';
  const isError = message.role === 'error';

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 12,
    }}>
      <div style={{
        maxWidth: '80%',
        padding: '10px 14px',
        borderRadius: 12,
        backgroundColor: isUser
          ? 'var(--awc-accent, #58a6ff)'
          : isError
            ? 'var(--awc-error-bg, #1a0000)'
            : 'var(--awc-bg-tertiary, #21262d)',
        color: isUser ? '#fff' : isError ? 'var(--awc-error, #f85149)' : 'var(--awc-text, #c9d1d9)',
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontSize: 14,
      }}>
        {renderText(message.text || '', theme)}
        {message._streaming && (
          <span style={{
            display: 'inline-block',
            width: 6,
            height: 14,
            backgroundColor: 'var(--awc-accent, #58a6ff)',
            marginLeft: 2,
            animation: 'awc-blink 1s infinite',
            verticalAlign: 'text-bottom',
          }} />
        )}
      </div>
    </div>
  );
}

/**
 * Simple markdown-ish renderer for code blocks and inline code.
 * Keeps it lightweight — no external dependency.
 */
function renderText(text, theme) {
  if (!text) return null;

  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);

  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const inner = part.slice(3, -3);
      const newlineIdx = inner.indexOf('\n');
      const lang = newlineIdx > 0 ? inner.slice(0, newlineIdx).trim() : '';
      const code = newlineIdx > 0 ? inner.slice(newlineIdx + 1) : inner;

      return (
        <pre key={i} style={{
          backgroundColor: 'var(--awc-code-bg, #161b22)',
          padding: '10px 12px',
          borderRadius: 6,
          overflow: 'auto',
          margin: '8px 0',
          fontSize: 13,
          lineHeight: 1.4,
          border: '1px solid var(--awc-border, #30363d)',
        }}>
          {lang && (
            <div style={{
              fontSize: 11, color: 'var(--awc-text-secondary, #8b949e)',
              marginBottom: 6, fontFamily: 'sans-serif',
            }}>
              {lang}
            </div>
          )}
          <code style={{ fontFamily: '"SF Mono", "Fira Code", monospace' }}>{code}</code>
        </pre>
      );
    }

    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} style={{
          backgroundColor: 'var(--awc-code-bg, #161b22)',
          padding: '2px 5px',
          borderRadius: 3,
          fontSize: 13,
          fontFamily: '"SF Mono", "Fira Code", monospace',
        }}>
          {part.slice(1, -1)}
        </code>
      );
    }

    return <span key={i}>{part}</span>;
  });
}
