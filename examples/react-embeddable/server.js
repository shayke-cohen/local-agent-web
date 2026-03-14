/**
 * React Embeddable Demo — drop-in <ClaudeChat /> component.
 *
 * Run: node examples/react-embeddable/server.js
 * Open: http://localhost:4010
 */

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createAgentServer } from '@shaykec/agent-web/server';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT, 10) || 4010;

const agent = createAgentServer({
  config: {
    model: 'claude-sonnet-4-6',
    tools: ['Bash(*)', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
    permissionMode: 'bypassPermissions',
    systemPrompt: 'You are a helpful coding assistant. Be concise.',
  },
  constraints: {
    maxModel: 'claude-sonnet-4-6',
    maxTurns: 30,
  },
  hooks: {
    onSessionStart: ({ sessionId }) => console.log(`Session started: ${sessionId}`),
    onClientConnect: ({ clientId, transport }) => console.log(`Client: ${clientId} (${transport})`),
  },
});

const html = readFileSync(resolve(__dirname, 'index.html'), 'utf-8');

const httpServer = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  agent.middleware()(req, res);
});

agent.attachWebSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`\nReact Embeddable Demo running at http://localhost:${PORT}`);
  console.log('Open in your browser to see the <ClaudeChat /> component.\n');
});
