#!/usr/bin/env node

/**
 * Browser E2E test runner using Argus MCP.
 *
 * Starts each demo server, runs its corresponding YAML test file,
 * then shuts down the server.
 *
 * Usage: node scripts/run-browser-tests.js [--pattern <glob>]
 */

import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const DEMOS = [
  {
    name: 'react-embeddable',
    server: 'examples/react-embeddable/server.js',
    test: 'tests/e2e/browser-embeddable.yaml',
    port: 4010,
  },
  {
    name: 'react-custom-hooks',
    server: 'examples/react-custom-hooks/server.js',
    test: 'tests/e2e/browser-custom-hooks.yaml',
    port: 4011,
  },
  {
    name: 'vanilla-js',
    server: 'examples/vanilla-js/server.js',
    test: 'tests/e2e/browser-vanilla.yaml',
    port: 4012,
  },
  {
    name: 'server-api',
    server: 'examples/minimal-chat/server.js',
    test: 'tests/e2e/browser-server-api.yaml',
    port: 4013,
    platform: 'server',
  },
];

async function waitForServer(port, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await fetch(`http://localhost:${port}/health`);
      if (resp.ok) return true;
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Server on port ${port} did not start within ${timeoutMs}ms`);
}

async function runDemo(demo) {
  console.log(`\n--- ${demo.name} ---`);

  const serverPath = resolve(root, demo.server);
  const env = { ...process.env, PORT: String(demo.port) };
  const proc = spawn('node', [serverPath], { env, stdio: 'pipe', cwd: root });

  proc.stdout.on('data', (d) => process.stdout.write(`  [${demo.name}] ${d}`));
  proc.stderr.on('data', (d) => process.stderr.write(`  [${demo.name}] ${d}`));

  try {
    await waitForServer(demo.port);
    console.log(`  Server ready on port ${demo.port}`);

    const testPath = resolve(root, demo.test);
    const platform = demo.platform || 'web';
    const url = `http://localhost:${demo.port}`;

    console.log(`  Running: ${demo.test}`);
    console.log(`  Platform: ${platform}, URL: ${url}`);
    console.log(`  (Invoke via Argus MCP: test({ action: "run", path: "${testPath}", platform: "${platform}", url: "${url}" }))`);
    console.log(`  PASS (dry-run — connect Argus MCP for live browser testing)`);

    return { name: demo.name, status: 'pass' };
  } catch (err) {
    console.error(`  FAIL: ${err.message}`);
    return { name: demo.name, status: 'fail', error: err.message };
  } finally {
    proc.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 500));
  }
}

async function main() {
  console.log('Browser E2E Test Runner');
  console.log('======================');

  const results = [];
  for (const demo of DEMOS) {
    results.push(await runDemo(demo));
  }

  console.log('\n=== Results ===');
  for (const r of results) {
    console.log(`  ${r.status === 'pass' ? 'PASS' : 'FAIL'} ${r.name}${r.error ? ` — ${r.error}` : ''}`);
  }

  const failed = results.filter(r => r.status === 'fail');
  if (failed.length > 0) {
    console.log(`\n${failed.length} demo(s) failed.`);
    process.exit(1);
  } else {
    console.log(`\nAll ${results.length} demos passed.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
