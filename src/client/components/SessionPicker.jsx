/**
 * SessionPicker — list of sessions with resume support.
 *
 * Building block for custom layouts. Use with useSessions() for data.
 */

import React from 'react';

/**
 * @param {object} props
 * @param {Array} props.sessions - Sessions array from useSessions()
 * @param {string|null} [props.activeSessionId] - Currently active session
 * @param {function} props.onResume - Called with sessionId when user picks a session
 * @param {function} [props.renderItem] - Custom item renderer (session, onResume, isActive) => ReactNode
 * @param {object} [props.style] - Container style overrides
 */
export function SessionPicker({
  sessions = [],
  activeSessionId,
  onResume,
  renderItem,
  style = {},
}) {
  if (sessions.length === 0) {
    return (
      <div style={{
        padding: 8, borderBottom: '1px solid var(--awc-border)',
        backgroundColor: 'var(--awc-bg-secondary)',
        color: 'var(--awc-text-secondary)', fontSize: 12,
        ...style,
      }}>
        No previous sessions
      </div>
    );
  }

  return (
    <div style={{
      padding: 8, borderBottom: '1px solid var(--awc-border)',
      backgroundColor: 'var(--awc-bg-secondary)', maxHeight: 200, overflowY: 'auto',
      ...style,
    }}>
      {sessions.map(s => {
        const isActive = s.sessionId === activeSessionId;
        if (renderItem) return <React.Fragment key={s.sessionId}>{renderItem(s, onResume, isActive)}</React.Fragment>;
        return (
          <div
            key={s.sessionId}
            onClick={() => onResume(s.sessionId)}
            style={{
              padding: '6px 8px', borderRadius: 4, cursor: 'pointer',
              color: 'var(--awc-text)', fontSize: 12,
              backgroundColor: isActive ? 'var(--awc-bg-tertiary)' : 'transparent',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--awc-bg-tertiary)'; }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <div style={{ fontWeight: 500 }}>{s.summary || 'Untitled session'}</div>
            <div style={{ color: 'var(--awc-text-secondary)', fontSize: 11 }}>
              {new Date(s.lastModified).toLocaleDateString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
