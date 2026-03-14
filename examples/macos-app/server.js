/**
 * macOS Demo Server — backend for the native SwiftUI chat app.
 *
 * Run: node examples/macos-app/server.js
 * The macOS app connects to ws://localhost:4020/ws
 */

import { createAgentServer } from '@shaykec/agent-web/server';

const PORT = parseInt(process.env.PORT, 10) || 4020;

const agent = createAgentServer({
  config: {
    model: 'claude-sonnet-4-6',
    tools: ['Bash(*)', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
    permissionMode: 'bypassPermissions',
    systemPrompt: 'You are a helpful coding assistant running inside a native macOS app. Be concise and format code with markdown fences.',
  },
  constraints: {
    maxModel: 'claude-sonnet-4-6',
    maxTurns: 50,
  },
  hooks: {
    onSessionStart: ({ sessionId, config }) => {
      console.log(`[macOS] Session started: ${sessionId} (model: ${config.model})`);
    },
    onToolUse: (payload, sessionId) => {
      console.log(`[macOS] Tool: ${payload.toolName} (session: ${sessionId})`);
    },
    onClientConnect: ({ clientId, transport }) => {
      console.log(`[macOS] Client connected: ${clientId} via ${transport}`);
    },
    onClientDisconnect: ({ clientId }) => {
      console.log(`[macOS] Client disconnected: ${clientId}`);
    },
  },
});

agent.listen(PORT, () => {
  console.log(`\nmacOS Demo Server running on http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log('Open the AgentChat Xcode project and run the app.\n');
});
