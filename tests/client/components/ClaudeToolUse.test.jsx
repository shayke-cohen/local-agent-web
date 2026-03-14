/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ClaudeToolUse } from '../../../src/client/components/ClaudeToolUse.jsx';

describe('ClaudeToolUse component', () => {
  it('renders tool-use message with tool name', () => {
    const msg = {
      id: 't1',
      role: 'tool-use',
      data: { toolName: 'Read', input: { path: '/foo/bar.js' } },
      timestamp: Date.now(),
    };
    render(<ClaudeToolUse message={msg} />);

    expect(screen.getByText(/Read/)).toBeTruthy();
    expect(screen.getByText(/\/foo\/bar\.js/)).toBeTruthy();
  });

  it('shows icon letter for known tools', () => {
    const msg = {
      id: 't2',
      role: 'tool-use',
      data: { toolName: 'Bash(*)', input: { command: 'ls -la' } },
      timestamp: Date.now(),
    };
    render(<ClaudeToolUse message={msg} />);

    expect(screen.getByText('B')).toBeTruthy();
  });

  it('shows command for Bash tool', () => {
    const msg = {
      id: 't3',
      role: 'tool-use',
      data: { toolName: 'Bash', input: { command: 'npm test' } },
      timestamp: Date.now(),
    };
    render(<ClaudeToolUse message={msg} />);

    expect(screen.getByText(/npm test/)).toBeTruthy();
  });

  it('shows pattern for Grep tool', () => {
    const msg = {
      id: 't4',
      role: 'tool-use',
      data: { toolName: 'Grep', input: { pattern: 'TODO' } },
      timestamp: Date.now(),
    };
    render(<ClaudeToolUse message={msg} />);

    expect(screen.getByText(/TODO/)).toBeTruthy();
  });

  it('tool-result is hidden when not expanded', () => {
    const msg = {
      id: 't5',
      role: 'tool-result',
      data: { toolId: 'x', output: 'some output' },
      timestamp: Date.now(),
    };
    const { container } = render(<ClaudeToolUse message={msg} />);

    expect(container.firstChild).toBeNull();
  });

  it('toggles expand/collapse on click', () => {
    const msg = {
      id: 't6',
      role: 'tool-use',
      data: { toolName: 'Write', input: { path: '/file.js' } },
      timestamp: Date.now(),
    };
    const { container } = render(<ClaudeToolUse message={msg} />);

    expect(screen.getByText('▶')).toBeTruthy();

    fireEvent.click(container.firstChild);

    expect(screen.getByText('▼')).toBeTruthy();
  });

  it('truncates long Bash commands', () => {
    const longCmd = 'a'.repeat(100);
    const msg = {
      id: 't7',
      role: 'tool-use',
      data: { toolName: 'Bash', input: { command: longCmd } },
      timestamp: Date.now(),
    };
    render(<ClaudeToolUse message={msg} />);

    const label = screen.getByText(/\.\.\.$/);
    expect(label).toBeTruthy();
  });

  it('uses default icon for unknown tools', () => {
    const msg = {
      id: 't8',
      role: 'tool-use',
      data: { toolName: 'CustomTool', input: {} },
      timestamp: Date.now(),
    };
    render(<ClaudeToolUse message={msg} />);

    expect(screen.getByText('T')).toBeTruthy();
  });
});
