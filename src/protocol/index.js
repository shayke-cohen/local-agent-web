/**
 * @module @shaykec/agent-web/protocol
 *
 * Protocol definitions: message types, envelope format, and config schema.
 * Shared between server and client.
 */

export {
  // Message type constants
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
  MESSAGE_TYPES,
  ChatStatus,
  isKnownType,
  isTypeInCategory,
} from './messages.js';

export {
  PROTOCOL_VERSION,
  createEnvelope,
  parseEnvelope,
  serializeEnvelope,
} from './envelope.js';

export {
  DEFAULT_CONFIG,
  DEFAULT_CONSTRAINTS,
  MODEL_TIERS,
  getModelTier,
  isModelAllowed,
  clampModel,
  validateConfig,
} from './config.js';
