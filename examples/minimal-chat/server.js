/**
 * Minimal agent-web server example.
 *
 * Run: node examples/minimal-chat/server.js
 * Then open http://localhost:3456 in your browser.
 */

import { createAgentServer } from '../../src/server/index.js';

const agent = createAgentServer({
  config: {
    model: 'claude-sonnet-4-6',
    tools: ['Bash(*)', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
    permissionMode: 'bypassPermissions',
    systemPrompt: 'You are a helpful coding assistant. Be concise.',
  },
  constraints: {
    maxModel: 'claude-sonnet-4-6',
    maxTurns: 50,
  },
  hooks: {
    onSessionStart: ({ sessionId, config }) => {
      console.log(`Session started: ${sessionId} (model: ${config.model})`);
    },
    onToolUse: (payload, sessionId) => {
      console.log(`Tool: ${payload.toolName} (session: ${sessionId})`);
    },
    onClientConnect: ({ clientId, transport }) => {
      console.log(`Client connected: ${clientId} via ${transport}`);
    },
    onClientDisconnect: ({ clientId }) => {
      console.log(`Client disconnected: ${clientId}`);
    },
  },
});

agent.listen(3456, () => {
  console.log('\nMinimal agent-web example running.');
  console.log('Use the React component or vanilla client to connect.\n');
});
