/**
 * ClaudeToolUse — renders a tool use / tool result pair.
 */

import React, { useState } from 'react';

const TOOL_ICONS = {
  Read: 'R',
  Write: 'W',
  Edit: 'E',
  Bash: 'B',
  Glob: 'G',
  Grep: 'S',
  WebSearch: 'Q',
  WebFetch: 'F',
  Task: 'T',
};

/**
 * @param {object} props
 * @param {import('../hooks/useChat.js').ChatMessage} props.message
 * @param {string} [props.theme='dark']
 */
export function ClaudeToolUse({ message, theme = 'dark' }) {
  const [expanded, setExpanded] = useState(false);

  if (message.role === 'tool-result' && !expanded) {
    return null;
  }

  const data = message.data || {};
  const toolName = data.toolName || 'Tool';
  const icon = TOOL_ICONS[toolName.replace(/\(.*\)/, '')] || 'T';

  const getToolLabel = () => {
    if (toolName.startsWith('Bash')) {
      const cmd = data.input?.command;
      return cmd ? `$ ${cmd.slice(0, 60)}${cmd.length > 60 ? '...' : ''}` : 'Running command...';
    }
    if (toolName === 'Read' || toolName === 'Write' || toolName === 'Edit') {
      const path = data.input?.path || data.input?.file_path;
      return path ? `${toolName}: ${path}` : toolName;
    }
    if (toolName === 'Grep' || toolName === 'Glob') {
      return `${toolName}: ${data.input?.pattern || data.input?.glob_pattern || ''}`;
    }
    return toolName;
  };

  if (message.role === 'tool-result') {
    const output = typeof data.output === 'string' ? data.output : JSON.stringify(data.output, null, 2);
    return (
      <div style={{
        margin: '4px 0 12px 32px',
        padding: '8px 10px',
        backgroundColor: 'var(--awc-code-bg, #161b22)',
        borderRadius: 6,
        border: '1px solid var(--awc-border, #30363d)',
        fontSize: 12,
        color: 'var(--awc-text-secondary, #8b949e)',
        maxHeight: 200,
        overflowY: 'auto',
        whiteSpace: 'pre-wrap',
        fontFamily: '"SF Mono", "Fira Code", monospace',
      }}>
        {output?.slice(0, 2000)}
        {output?.length > 2000 && '... (truncated)'}
      </div>
    );
  }

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        margin: '4px 0',
        borderRadius: 6,
        backgroundColor: 'var(--awc-bg-secondary, #161b22)',
        border: '1px solid var(--awc-border, #30363d)',
        cursor: 'pointer',
        fontSize: 12,
        color: 'var(--awc-text-secondary, #8b949e)',
      }}
    >
      <span style={{
        width: 20, height: 20, borderRadius: 4,
        backgroundColor: 'var(--awc-bg-tertiary, #21262d)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 600, fontSize: 10,
      }}>
        {icon}
      </span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {getToolLabel()}
      </span>
      <span style={{ fontSize: 10 }}>{expanded ? '▼' : '▶'}</span>
    </div>
  );
}
