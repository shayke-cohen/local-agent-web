/**
 * Vanilla JS Demo — no framework, pure DOM manipulation.
 *
 * Run: node examples/vanilla-js/server.js
 * Open: http://localhost:4012
 */

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createAgentServer } from '../../src/server/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT, 10) || 4012;

const agent = createAgentServer({
  config: {
    model: 'claude-sonnet-4-6',
    tools: ['Bash(*)', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
    permissionMode: 'bypassPermissions',
    systemPrompt: 'You are a helpful assistant. Be concise.',
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
  console.log(`\nVanilla JS Demo at http://localhost:${PORT}\n`);
});
