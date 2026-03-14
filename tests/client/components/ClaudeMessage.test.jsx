/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ClaudeMessage } from '@shaykec/agent-web/components';

describe('ClaudeMessage component', () => {
  it('renders a user message aligned right', () => {
    const msg = { id: 'm1', role: 'user', text: 'Hello Claude', timestamp: Date.now() };
    const { container } = render(<ClaudeMessage message={msg} />);

    expect(screen.getByText('Hello Claude')).toBeTruthy();
    const outer = container.firstChild;
    expect(outer.style.justifyContent).toBe('flex-end');
  });

  it('renders an assistant message aligned left', () => {
    const msg = { id: 'm2', role: 'assistant', text: 'Hi there', timestamp: Date.now() };
    const { container } = render(<ClaudeMessage message={msg} />);

    expect(screen.getByText('Hi there')).toBeTruthy();
    const outer = container.firstChild;
    expect(outer.style.justifyContent).toBe('flex-start');
  });

  it('renders an error message', () => {
    const msg = { id: 'm3', role: 'error', text: 'Something broke', timestamp: Date.now() };
    render(<ClaudeMessage message={msg} />);

    expect(screen.getByText('Something broke')).toBeTruthy();
  });

  it('renders inline code', () => {
    const msg = { id: 'm4', role: 'assistant', text: 'Use `console.log` here', timestamp: Date.now() };
    const { container } = render(<ClaudeMessage message={msg} />);

    const codes = container.querySelectorAll('code');
    expect(codes.length).toBeGreaterThanOrEqual(1);
    expect(codes[0].textContent).toBe('console.log');
  });

  it('renders code blocks', () => {
    const msg = {
      id: 'm5',
      role: 'assistant',
      text: '```javascript\nconsole.log("hi")\n```',
      timestamp: Date.now(),
    };
    const { container } = render(<ClaudeMessage message={msg} />);

    expect(container.querySelector('pre')).toBeTruthy();
    expect(container.querySelector('code').textContent).toContain('console.log');
  });

  it('shows streaming cursor when _streaming is true', () => {
    const msg = { id: 'm6', role: 'assistant', text: 'thinking...', timestamp: Date.now(), _streaming: true };
    const { container } = render(<ClaudeMessage message={msg} />);

    const cursor = container.querySelector('span[style*="animation"]');
    expect(cursor).toBeTruthy();
  });

  it('does not show streaming cursor when _streaming is false', () => {
    const msg = { id: 'm7', role: 'assistant', text: 'done', timestamp: Date.now(), _streaming: false };
    const { container } = render(<ClaudeMessage message={msg} />);

    const cursor = container.querySelector('span[style*="animation"]');
    expect(cursor).toBeNull();
  });

  it('handles empty text gracefully', () => {
    const msg = { id: 'm8', role: 'assistant', text: '', timestamp: Date.now() };
    const { container } = render(<ClaudeMessage message={msg} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders code block with language label', () => {
    const msg = {
      id: 'm9',
      role: 'assistant',
      text: '```python\nprint("hello")\n```',
      timestamp: Date.now(),
    };
    const { container } = render(<ClaudeMessage message={msg} />);

    expect(screen.getByText('python')).toBeTruthy();
  });
});
