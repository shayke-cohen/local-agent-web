/**
 * ChatInput — text input with send/stop buttons.
 *
 * Building block for custom layouts. Use with useChat() for callbacks.
 */

import React, { useState, useRef, useCallback } from 'react';

/**
 * @param {object} props
 * @param {function} props.onSend - Called with text when user sends (from useChat().send)
 * @param {function} props.onStop - Called when user clicks stop (from useChat().stop)
 * @param {boolean} [props.isStreaming=false] - Whether Claude is currently streaming
 * @param {string} [props.placeholder='Ask Claude...']
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.sendLabel='Send']
 * @param {string} [props.stopLabel='Stop']
 * @param {object} [props.style] - Container style overrides
 */
export function ChatInput({
  onSend,
  onStop,
  isStreaming = false,
  placeholder = 'Ask Claude...',
  disabled = false,
  sendLabel = 'Send',
  stopLabel = 'Stop',
  style = {},
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef(null);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (!input.trim() || isStreaming || disabled) return;
    onSend(input.trim());
    setInput('');
  }, [input, isStreaming, disabled, onSend]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);

  return (
    <form onSubmit={handleSubmit} style={{
      display: 'flex', gap: 8, padding: '12px 16px',
      borderTop: '1px solid var(--awc-border)',
      backgroundColor: 'var(--awc-bg-secondary)',
      ...style,
    }}>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          flex: 1, padding: '8px 12px', borderRadius: 6,
          border: '1px solid var(--awc-border)', backgroundColor: 'var(--awc-bg)',
          color: 'var(--awc-text)', outline: 'none', fontSize: 14,
        }}
      />
      {isStreaming ? (
        <button
          type="button"
          onClick={onStop}
          style={{
            padding: '8px 16px', borderRadius: 6, border: 'none',
            backgroundColor: 'var(--awc-error)', color: '#fff',
            cursor: 'pointer', fontWeight: 500, fontSize: 14,
          }}
        >
          {stopLabel}
        </button>
      ) : (
        <button
          type="submit"
          disabled={!input.trim() || disabled}
          style={{
            padding: '8px 16px', borderRadius: 6, border: 'none',
            backgroundColor: input.trim() && !disabled ? 'var(--awc-accent)' : 'var(--awc-bg-tertiary)',
            color: input.trim() && !disabled ? '#fff' : 'var(--awc-text-secondary)',
            cursor: input.trim() && !disabled ? 'pointer' : 'default', fontWeight: 500, fontSize: 14,
          }}
        >
          {sendLabel}
        </button>
      )}
    </form>
  );
}
