/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatMessages } from '../../src/client/components/ChatMessages.jsx';
import { ChatInput } from '../../src/client/components/ChatInput.jsx';
import { ChatStatus } from '../../src/client/components/ChatStatus.jsx';
import { SessionPicker } from '../../src/client/components/SessionPicker.jsx';
import { THEME_PRESETS } from '../../src/client/components/ClaudeChat.jsx';

describe('ChatMessages', () => {
  it('renders welcome text when messages are empty', () => {
    const { container } = render(
      React.createElement(ChatMessages, { messages: [], welcomeText: 'Hello world' })
    );
    expect(container.textContent).toContain('Hello world');
  });

  it('uses custom renderWelcome when provided', () => {
    const { container } = render(
      React.createElement(ChatMessages, {
        messages: [],
        renderWelcome: () => React.createElement('div', null, 'Custom welcome'),
      })
    );
    expect(container.textContent).toContain('Custom welcome');
  });

  it('renders messages with default renderer', () => {
    const messages = [
      { id: '1', role: 'user', text: 'Hello' },
      { id: '2', role: 'assistant', text: 'Hi there' },
    ];
    const { container } = render(
      React.createElement(ChatMessages, { messages })
    );
    expect(container.textContent).toContain('Hello');
    expect(container.textContent).toContain('Hi there');
  });

  it('uses custom renderMessage when provided', () => {
    const messages = [{ id: '1', role: 'user', text: 'Hello' }];
    const { container } = render(
      React.createElement(ChatMessages, {
        messages,
        renderMessage: (msg) => React.createElement('span', { key: msg.id }, `custom:${msg.text}`),
      })
    );
    expect(container.textContent).toContain('custom:Hello');
  });

  it('hides tool-use messages when showToolUse is false', () => {
    const messages = [
      { id: '1', role: 'tool-use', data: { toolName: 'Read' } },
    ];
    const { container } = render(
      React.createElement(ChatMessages, { messages, showToolUse: false })
    );
    expect(container.textContent).not.toContain('Read');
  });
});

describe('ChatInput', () => {
  it('renders with placeholder', () => {
    const { container } = render(
      React.createElement(ChatInput, {
        onSend: () => {},
        onStop: () => {},
        placeholder: 'Type here...',
      })
    );
    const input = container.querySelector('input');
    expect(input.placeholder).toBe('Type here...');
  });

  it('renders custom labels', () => {
    const { container } = render(
      React.createElement(ChatInput, {
        onSend: () => {},
        onStop: () => {},
        sendLabel: 'Go',
      })
    );
    expect(container.textContent).toContain('Go');
  });

  it('shows stop button when streaming', () => {
    const { container } = render(
      React.createElement(ChatInput, {
        onSend: () => {},
        onStop: () => {},
        isStreaming: true,
        stopLabel: 'Cancel',
      })
    );
    expect(container.textContent).toContain('Cancel');
  });

  it('disables send when disabled prop is true', () => {
    const { container } = render(
      React.createElement(ChatInput, {
        onSend: () => {},
        onStop: () => {},
        disabled: true,
      })
    );
    const input = container.querySelector('input');
    expect(input.disabled).toBe(true);
  });
});

describe('ChatStatus', () => {
  it('renders as a dot element', () => {
    const { container } = render(
      React.createElement(ChatStatus, { status: 'connected' })
    );
    const dot = container.querySelector('span');
    expect(dot).toBeTruthy();
    expect(dot.title).toBe('connected');
  });

  it('shows green for connected status', () => {
    const { container } = render(
      React.createElement(ChatStatus, { status: 'connected' })
    );
    const dot = container.querySelector('span');
    expect(dot.style.backgroundColor).toBe('rgb(63, 185, 80)');
  });

  it('shows yellow for streaming status', () => {
    const { container } = render(
      React.createElement(ChatStatus, { status: 'streaming' })
    );
    const dot = container.querySelector('span');
    expect(dot.style.backgroundColor).toBe('rgb(245, 158, 11)');
  });
});

describe('SessionPicker', () => {
  it('shows empty message when no sessions', () => {
    const { container } = render(
      React.createElement(SessionPicker, { sessions: [], onResume: () => {} })
    );
    expect(container.textContent).toContain('No previous sessions');
  });

  it('renders session items', () => {
    const sessions = [
      { sessionId: 's1', summary: 'First session', lastModified: Date.now() },
      { sessionId: 's2', summary: 'Second session', lastModified: Date.now() },
    ];
    const { container } = render(
      React.createElement(SessionPicker, { sessions, onResume: () => {} })
    );
    expect(container.textContent).toContain('First session');
    expect(container.textContent).toContain('Second session');
  });

  it('uses custom renderItem when provided', () => {
    const sessions = [
      { sessionId: 's1', summary: 'Test', lastModified: Date.now() },
    ];
    const { container } = render(
      React.createElement(SessionPicker, {
        sessions,
        onResume: () => {},
        renderItem: (s) => React.createElement('div', { key: s.sessionId }, `custom:${s.summary}`),
      })
    );
    expect(container.textContent).toContain('custom:Test');
  });
});

describe('THEME_PRESETS', () => {
  it('exports dark, light, and github presets', () => {
    expect(THEME_PRESETS.dark).toBeTruthy();
    expect(THEME_PRESETS.light).toBeTruthy();
    expect(THEME_PRESETS.github).toBeTruthy();
  });

  it('dark preset has all required CSS vars', () => {
    const vars = Object.keys(THEME_PRESETS.dark);
    expect(vars).toContain('--awc-bg');
    expect(vars).toContain('--awc-text');
    expect(vars).toContain('--awc-accent');
    expect(vars).toContain('--awc-border');
    expect(vars).toContain('--awc-error');
  });

  it('github preset uses GitHub dark colors', () => {
    expect(THEME_PRESETS.github['--awc-bg']).toBe('#0d1117');
    expect(THEME_PRESETS.github['--awc-accent']).toBe('#58a6ff');
  });
});
