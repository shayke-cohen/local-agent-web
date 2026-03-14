/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ClaudeChat } from '@shaykec/agent-web/components';

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  constructor() {
    this.readyState = 0;
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
    setTimeout(() => { this.readyState = 1; if (this.onopen) this.onopen({}); }, 5);
  }
  send() {}
  close() { this.readyState = 3; }
}

class MockEventSource {
  constructor() { this.onopen = null; this.onerror = null; this.onmessage = null; }
  close() {}
}

describe('ClaudeChat component', () => {
  beforeEach(() => {
    globalThis.WebSocket = MockWebSocket;
    globalThis.EventSource = MockEventSource;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessions: [] }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the chat container with header and input', () => {
    const { container } = render(
      <ClaudeChat url="http://localhost:3456" />
    );

    expect(container.querySelector('.awc-chat')).toBeTruthy();
    expect(screen.getByText('Claude')).toBeTruthy();
    expect(screen.getByPlaceholderText('Ask Claude...')).toBeTruthy();
  });

  it('renders with dark theme by default', () => {
    const { container } = render(
      <ClaudeChat url="http://localhost:3456" />
    );

    expect(container.querySelector('.awc-dark')).toBeTruthy();
  });

  it('renders with light theme when specified', () => {
    const { container } = render(
      <ClaudeChat url="http://localhost:3456" theme="light" />
    );

    expect(container.querySelector('.awc-light')).toBeTruthy();
  });

  it('renders with custom placeholder', () => {
    render(
      <ClaudeChat url="http://localhost:3456" placeholder="Type here..." />
    );

    expect(screen.getByPlaceholderText('Type here...')).toBeTruthy();
  });

  it('shows empty state message when no messages', () => {
    render(
      <ClaudeChat url="http://localhost:3456" />
    );

    expect(screen.getByText('Start a conversation with Claude')).toBeTruthy();
  });

  it('shows Sessions button by default', () => {
    render(
      <ClaudeChat url="http://localhost:3456" />
    );

    expect(screen.getByText('Sessions')).toBeTruthy();
  });

  it('hides Sessions button when showSessions is false', () => {
    render(
      <ClaudeChat url="http://localhost:3456" showSessions={false} />
    );

    expect(screen.queryByText('Sessions')).toBeNull();
  });

  it('Send button is disabled when input is empty', () => {
    render(
      <ClaudeChat url="http://localhost:3456" />
    );

    const sendBtn = screen.getByText('Send');
    expect(sendBtn.disabled).toBe(true);
  });

  it('Send button enables when input has text', () => {
    render(
      <ClaudeChat url="http://localhost:3456" />
    );

    const input = screen.getByPlaceholderText('Ask Claude...');
    fireEvent.change(input, { target: { value: 'hello' } });

    const sendBtn = screen.getByText('Send');
    expect(sendBtn.disabled).toBe(false);
  });

  it('applies custom className', () => {
    const { container } = render(
      <ClaudeChat url="http://localhost:3456" className="my-chat" />
    );

    expect(container.querySelector('.my-chat')).toBeTruthy();
  });

  it('applies custom inline styles', () => {
    const { container } = render(
      <ClaudeChat url="http://localhost:3456" style={{ maxWidth: 500 }} />
    );

    const chat = container.querySelector('.awc-chat');
    expect(chat.style.maxWidth).toBe('500px');
  });

  it('toggles sessions panel when Sessions button is clicked', () => {
    render(
      <ClaudeChat url="http://localhost:3456" />
    );

    const btn = screen.getByText('Sessions');
    fireEvent.click(btn);

    expect(screen.getByText('No previous sessions')).toBeTruthy();
  });
});
