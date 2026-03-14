/**
 * Protocol message types for agent-web.
 *
 * Three categories:
 *   chat:*    — conversation messages between user and Claude
 *   session:* — session lifecycle events
 *   sys:*     — transport-level system messages
 *   config:*  — configuration negotiation
 */

// --- Chat messages ---

/** Streaming text delta from assistant */
export const MSG_CHAT_STREAM = 'chat:stream';

/** Final complete assistant message */
export const MSG_CHAT_ASSISTANT = 'chat:assistant';

/** Claude is invoking a tool */
export const MSG_CHAT_TOOL_USE = 'chat:tool-use';

/** Result of a tool invocation */
export const MSG_CHAT_TOOL_RESULT = 'chat:tool-result';

/** Status changes: thinking, idle, error, stopped */
export const MSG_CHAT_STATUS = 'chat:status';

/** Error during chat */
export const MSG_CHAT_ERROR = 'chat:error';

/** User message (echoed back for multi-client sync) */
export const MSG_CHAT_USER = 'chat:user';

// --- Session messages ---

/** Session was created */
export const MSG_SESSION_CREATED = 'session:created';

/** Session was resumed */
export const MSG_SESSION_RESUMED = 'session:resumed';

/** Session list response */
export const MSG_SESSION_LIST = 'session:list';

/** Session was closed */
export const MSG_SESSION_CLOSED = 'session:closed';

// --- Config messages ---

/** Client requests config for a session */
export const MSG_CONFIG_REQUEST = 'config:request';

/** Server responds with resolved config */
export const MSG_CONFIG_RESOLVED = 'config:resolved';

// --- System messages ---

/** Connection established */
export const MSG_SYS_CONNECT = 'sys:connect';

/** Connection lost */
export const MSG_SYS_DISCONNECT = 'sys:disconnect';

/** Keepalive heartbeat */
export const MSG_SYS_HEARTBEAT = 'sys:heartbeat';


/** All known message types */
export const MESSAGE_TYPES = new Set([
  MSG_CHAT_STREAM,
  MSG_CHAT_ASSISTANT,
  MSG_CHAT_TOOL_USE,
  MSG_CHAT_TOOL_RESULT,
  MSG_CHAT_STATUS,
  MSG_CHAT_ERROR,
  MSG_CHAT_USER,
  MSG_SESSION_CREATED,
  MSG_SESSION_RESUMED,
  MSG_SESSION_LIST,
  MSG_SESSION_CLOSED,
  MSG_CONFIG_REQUEST,
  MSG_CONFIG_RESOLVED,
  MSG_SYS_CONNECT,
  MSG_SYS_DISCONNECT,
  MSG_SYS_HEARTBEAT,
]);

/**
 * Chat status values used in MSG_CHAT_STATUS payloads.
 */
export const ChatStatus = {
  THINKING: 'thinking',
  STREAMING: 'streaming',
  IDLE: 'idle',
  ERROR: 'error',
  STOPPED: 'stopped',
};

/**
 * Check if a string is a known message type.
 * @param {string} type
 * @returns {boolean}
 */
export function isKnownType(type) {
  return MESSAGE_TYPES.has(type);
}

/**
 * Check if a message type belongs to a category.
 * @param {string} type
 * @param {'chat'|'session'|'config'|'sys'} category
 * @returns {boolean}
 */
export function isTypeInCategory(type, category) {
  return typeof type === 'string' && type.startsWith(`${category}:`);
}
