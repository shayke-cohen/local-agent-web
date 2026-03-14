/**
 * @module @shaykec/agent-web/server
 *
 * Server-side framework for exposing Claude Code to web apps.
 */

export { createAgentServer } from './middleware.js';
export { SessionManager } from './session-manager.js';
export { ConfigResolver } from './config-resolver.js';
export { Transport, generateClientId } from './transport.js';
