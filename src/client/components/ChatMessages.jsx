/**
 * ChatMessages — renders a scrollable list of chat messages.
 *
 * Building block for custom layouts. Use with useChat() for data.
 */

import React, { useRef, useEffect } from 'react';
import { ClaudeMessage } from './ClaudeMessage.jsx';
import { ClaudeToolUse } from './ClaudeToolUse.jsx';

/**
 * @param {object} props
 * @param {Array} props.messages - Messages array from useChat()
 * @param {string} [props.theme='dark']
 * @param {boolean} [props.showToolUse=true]
 * @param {function} [props.renderMessage] - Custom message renderer (message, theme) => ReactNode
 * @param {function} [props.renderToolUse] - Custom tool-use renderer (message, theme) => ReactNode
 * @param {function} [props.renderWelcome] - Custom empty state renderer () => ReactNode
 * @param {string} [props.welcomeText] - Default empty state text
 * @param {object} [props.style] - Container style overrides
 */
export function ChatMessages({
  messages = [],
  theme = 'dark',
  showToolUse = true,
  renderMessage: renderMessageProp,
  renderToolUse: renderToolUseProp,
  renderWelcome,
  welcomeText = 'Start a conversation with Claude',
  style = {},
}) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={{
      flex: 1, overflowY: 'auto', padding: 16,
      backgroundColor: 'var(--awc-bg)',
      ...style,
    }}>
      {messages.length === 0 && (
        renderWelcome ? renderWelcome() : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: 'var(--awc-text-secondary)',
          }}>
            {welcomeText}
          </div>
        )
      )}
      {messages.map((msg) => {
        if (msg.role === 'tool-use' || msg.role === 'tool-result') {
          if (!showToolUse) return null;
          if (renderToolUseProp) return <React.Fragment key={msg.id}>{renderToolUseProp(msg, theme)}</React.Fragment>;
          return <ClaudeToolUse key={msg.id} message={msg} theme={theme} />;
        }
        if (renderMessageProp) return <React.Fragment key={msg.id}>{renderMessageProp(msg, theme)}</React.Fragment>;
        return <ClaudeMessage key={msg.id} message={msg} theme={theme} />;
      })}
      <div ref={endRef} />
    </div>
  );
}
