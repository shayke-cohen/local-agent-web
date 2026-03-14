import { describe, it, expect } from 'vitest';
import { ConfigResolver } from '../../src/server/config-resolver.js';

describe('server/ConfigResolver', () => {
  describe('resolve() with defaults', () => {
    it('returns server defaults when no client config', () => {
      const resolver = new ConfigResolver({ model: 'claude-sonnet-4-6', tools: ['Read', 'Write'] });
      const { config, warnings } = resolver.resolve();

      expect(config.model).toBe('claude-sonnet-4-6');
      expect(config.tools).toContain('Read');
      expect(config.tools).toContain('Write');
      expect(warnings).toHaveLength(0);
    });
  });

  describe('model resolution', () => {
    it('uses client-requested model', () => {
      const resolver = new ConfigResolver({ model: 'claude-sonnet-4-6' });
      const { config } = resolver.resolve({ model: 'claude-haiku-3-5' });
      expect(config.model).toBe('claude-haiku-3-5');
    });

    it('clamps model to maxModel constraint', () => {
      const resolver = new ConfigResolver(
        { model: 'claude-sonnet-4-6' },
        { maxModel: 'claude-sonnet-4-6' }
      );
      const { config, warnings } = resolver.resolve({ model: 'claude-opus-4-6' });
      expect(config.model).toBe('claude-sonnet-4-6');
      expect(warnings.some(w => w.includes('clamped'))).toBe(true);
    });

    it('rejects model not in allowedModels', () => {
      const resolver = new ConfigResolver(
        { model: 'claude-sonnet-4-6' },
        { allowedModels: ['claude-sonnet-4-6', 'claude-haiku-3-5'] }
      );
      const { config, warnings } = resolver.resolve({ model: 'claude-opus-4-6' });
      expect(config.model).toBe('claude-sonnet-4-6'); // Falls back to server default
      expect(warnings.some(w => w.includes('allowedModels'))).toBe(true);
    });
  });

  describe('tools resolution', () => {
    it('client can narrow server tools', () => {
      const resolver = new ConfigResolver({ tools: ['Read', 'Write', 'Bash(*)'] });
      const { config } = resolver.resolve({ tools: ['Read'] });
      expect(config.tools).toEqual(['Read']);
    });

    it('client cannot expand beyond server tools', () => {
      const resolver = new ConfigResolver({ tools: ['Read'] });
      const { config, warnings } = resolver.resolve({ tools: ['Read', 'Write'] });
      expect(config.tools).toEqual(['Read']);
      expect(warnings.some(w => w.includes('Write'))).toBe(true);
    });

    it('uses server tools when client does not specify', () => {
      const resolver = new ConfigResolver({ tools: ['Read', 'Write'] });
      const { config } = resolver.resolve({});
      expect(config.tools).toEqual(['Read', 'Write']);
    });
  });

  describe('disallowedTools resolution', () => {
    it('unions server and client disallowed tools', () => {
      const resolver = new ConfigResolver(
        { disallowedTools: ['Write'] },
        { disallowedTools: ['Bash(*)'] }
      );
      const { config } = resolver.resolve({ disallowedTools: ['Edit'] });
      expect(config.disallowedTools).toContain('Write');
      expect(config.disallowedTools).toContain('Bash(*)');
      expect(config.disallowedTools).toContain('Edit');
    });

    it('removes disallowed tools from allowed tools', () => {
      const resolver = new ConfigResolver(
        { tools: ['Read', 'Write', 'Edit'], disallowedTools: ['Write'] }
      );
      const { config } = resolver.resolve();
      expect(config.tools).not.toContain('Write');
      expect(config.tools).toContain('Read');
      expect(config.tools).toContain('Edit');
    });
  });

  describe('systemPrompt resolution', () => {
    it('concatenates server and client prompts', () => {
      const resolver = new ConfigResolver({ systemPrompt: 'Server prompt' });
      const { config } = resolver.resolve({ systemPrompt: 'Client prompt' });
      expect(config.systemPrompt).toBe('Server prompt\n\nClient prompt');
    });

    it('uses only server prompt when client has none', () => {
      const resolver = new ConfigResolver({ systemPrompt: 'Server only' });
      const { config } = resolver.resolve({});
      expect(config.systemPrompt).toBe('Server only');
    });

    it('uses only client prompt when server has none', () => {
      const resolver = new ConfigResolver({});
      const { config } = resolver.resolve({ systemPrompt: 'Client only' });
      expect(config.systemPrompt).toBe('Client only');
    });
  });

  describe('server-only fields', () => {
    it('ignores client plugins', () => {
      const resolver = new ConfigResolver({ plugins: [{ type: 'local', path: '/a' }] });
      const { config } = resolver.resolve({ plugins: [{ type: 'local', path: '/hacked' }] });
      expect(config.plugins).toEqual([{ type: 'local', path: '/a' }]);
    });

    it('ignores client cwd', () => {
      const resolver = new ConfigResolver({ cwd: '/safe/dir' });
      const { config } = resolver.resolve({ cwd: '/etc/passwd' });
      expect(config.cwd).toBe('/safe/dir');
    });

    it('ignores client permissionMode', () => {
      const resolver = new ConfigResolver({ permissionMode: 'default' });
      const { config } = resolver.resolve({ permissionMode: 'bypassPermissions' });
      expect(config.permissionMode).toBe('default');
    });

    it('ignores client mcpServers', () => {
      const resolver = new ConfigResolver({ mcpServers: { db: { type: 'http', url: 'localhost' } } });
      const { config } = resolver.resolve({ mcpServers: { evil: { type: 'http', url: 'hacker.com' } } });
      expect(config.mcpServers).toHaveProperty('db');
      expect(config.mcpServers).not.toHaveProperty('evil');
    });
  });

  describe('maxTurns resolution', () => {
    it('uses min of server and client', () => {
      const resolver = new ConfigResolver({ maxTurns: 100 });
      const { config } = resolver.resolve({ maxTurns: 50 });
      expect(config.maxTurns).toBe(50);
    });

    it('uses min of all three (server, client, constraint)', () => {
      const resolver = new ConfigResolver(
        { maxTurns: 100 },
        { maxTurns: 75 }
      );
      const { config } = resolver.resolve({ maxTurns: 50 });
      expect(config.maxTurns).toBe(50);
    });

    it('ignores undefined values', () => {
      const resolver = new ConfigResolver({});
      const { config } = resolver.resolve({ maxTurns: 30 });
      expect(config.maxTurns).toBe(30);
    });
  });

  describe('agents resolution', () => {
    const serverAgents = {
      reviewer: { description: 'Reviews code', prompt: 'Review...' },
      tester: { description: 'Runs tests', prompt: 'Test...' },
    };

    it('client can select subset of server agents by name', () => {
      const resolver = new ConfigResolver({ agents: serverAgents });
      const { config } = resolver.resolve({ agents: ['reviewer'] });
      expect(Object.keys(config.agents)).toEqual(['reviewer']);
    });

    it('warns about unknown agent names', () => {
      const resolver = new ConfigResolver({ agents: serverAgents });
      const { warnings } = resolver.resolve({ agents: ['reviewer', 'hacker'] });
      expect(warnings.some(w => w.includes('hacker'))).toBe(true);
    });

    it('rejects client agent definitions', () => {
      const resolver = new ConfigResolver({ agents: serverAgents });
      const { config, warnings } = resolver.resolve({
        agents: { evil: { description: 'Evil', prompt: 'Hack...' } }
      });
      expect(config.agents).toEqual(serverAgents);
      expect(warnings.some(w => w.includes('cannot define agents'))).toBe(true);
    });
  });

  describe('toSDKOptions', () => {
    it('maps resolved config to SDK options', () => {
      const resolver = new ConfigResolver();
      const { config } = resolver.resolve({});
      const opts = resolver.toSDKOptions(config);

      expect(opts.model).toBe('claude-sonnet-4-6');
      expect(opts.allowedTools).toBeDefined();
      expect(opts.includePartialMessages).toBe(true);
    });

    it('includes plugins when present', () => {
      const resolver = new ConfigResolver({ plugins: [{ type: 'local', path: '/p' }] });
      const { config } = resolver.resolve({});
      const opts = resolver.toSDKOptions(config);
      expect(opts.plugins).toEqual([{ type: 'local', path: '/p' }]);
    });

    it('omits undefined fields', () => {
      const resolver = new ConfigResolver({});
      const { config } = resolver.resolve({});
      const opts = resolver.toSDKOptions(config);
      expect(opts).not.toHaveProperty('cwd');
      expect(opts).not.toHaveProperty('maxTurns');
    });

    it('includes systemPrompt when set', () => {
      const resolver = new ConfigResolver({ systemPrompt: 'Be helpful' });
      const { config } = resolver.resolve({});
      const opts = resolver.toSDKOptions(config);
      expect(opts.systemPrompt).toBe('Be helpful');
    });
  });

  describe('client config validation', () => {
    it('warns about invalid client config fields', () => {
      const resolver = new ConfigResolver();
      const { warnings } = resolver.resolve({ model: 123, tools: 'Read' });
      expect(warnings.some(w => w.includes('model'))).toBe(true);
      expect(warnings.some(w => w.includes('tools'))).toBe(true);
    });
  });
});
