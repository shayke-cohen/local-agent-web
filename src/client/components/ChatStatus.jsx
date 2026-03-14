/**
 * ChatStatus — connection/streaming status indicator.
 *
 * Building block for custom layouts.
 */

import React from 'react';

/**
 * @param {object} props
 * @param {string} props.status - Status from useChat() or useConnection()
 * @param {string} [props.size='8'] - Dot size in px
 */
export function ChatStatus({ status, size = 8 }) {
  const color =
    status === 'streaming' || status === 'thinking' ? '#f59e0b' :
    status === 'idle' || status === 'connected' ? '#3fb950' :
    status === 'error' || status === 'stopped' ? '#f85149' :
    '#6b7280';

  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        display: 'inline-block',
      }}
      title={status}
    />
  );
}
