/**
 * @module @shaykec/agent-web
 *
 * Generic framework for exposing Claude Code to web apps.
 *
 * Submodules:
 *   @shaykec/agent-web/protocol   — Message types, envelope, config
 *   @shaykec/agent-web/server     — createAgentServer, SessionManager, ConfigResolver, Transport
 *   @shaykec/agent-web/react      — ClaudeProvider, useChat, useSessions, useConnection
 *   @shaykec/agent-web/components — ClaudeChat, ClaudeMessage, ClaudeToolUse
 *   @shaykec/agent-web/client     — ClaudeClient (vanilla JS)
 */

export { createAgentServer } from './server/index.js';
export { ClaudeProvider, useChat, useSessions, useConnection } from './client/index.js';
export * from './protocol/index.js';
