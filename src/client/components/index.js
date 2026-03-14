/**
 * @module @shaykec/agent-web/components
 *
 * Pre-built embeddable UI components for Claude Code chat.
 *
 * Two levels of usage:
 *   Drop-in:   ClaudeChat (wires everything, just pass a URL)
 *   Composable: ChatMessages, ChatInput, ChatStatus, SessionPicker
 *               (use with useChat/useSessions hooks for full layout control)
 */

export { ClaudeChat, THEME_PRESETS } from './ClaudeChat.jsx';
export { ClaudeMessage } from './ClaudeMessage.jsx';
export { ClaudeToolUse } from './ClaudeToolUse.jsx';

export { ChatMessages } from './ChatMessages.jsx';
export { ChatInput } from './ChatInput.jsx';
export { ChatStatus } from './ChatStatus.jsx';
export { SessionPicker } from './SessionPicker.jsx';
