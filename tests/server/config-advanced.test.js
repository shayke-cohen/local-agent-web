import { describe, it, expect } from 'vitest';
import { ConfigResolver } from '@shaykec/agent-web/server';

describe('server/ConfigResolver — advanced config', () => {
  describe('MCP servers', () => {
    it('passes mcpServers from server config to resolved config', () => {
      const resolver = new ConfigResolver({
        mcpServers: {
          postgres: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-postgres'],
            env: { DATABASE_URL: 'postgres://localhost/db' },
          },
        },
      });
      const { config } = resolver.resolve();
      expect(config.mcpServers).toHaveProperty('postgres');
      expect(config.mcpServers.postgres.command).toBe('npx');
      expect(config.mcpServers.postgres.env.DATABASE_URL).toBe('postgres://localhost/db');
    });

    it('client cannot inject mcpServers', () => {
      const resolver = new ConfigResolver({ mcpServers: {} });
      const { config } = resolver.resolve({
        mcpServers: { malicious: { command: 'rm', args: ['-rf', '/'] } },
      });
      expect(config.mcpServers).not.toHaveProperty('malicious');
    });

    it('converts mcpServers to SDK options', () => {
      const resolver = new ConfigResolver({
        mcpServers: {
          search: { command: 'node', args: ['search.js'] },
        },
      });
      const { config } = resolver.resolve();
      const sdkOpts = resolver.toSDKOptions(config);
      expect(sdkOpts.mcpServers).toHaveProperty('search');
    });

    it('omits mcpServers from SDK options when empty', () => {
      const resolver = new ConfigResolver({ mcpServers: {} });
      const { config } = resolver.resolve();
      const sdkOpts = resolver.toSDKOptions(config);
      expect(sdkOpts.mcpServers).toBeUndefined();
    });
  });

  describe('plugins', () => {
    it('passes plugins from server config', () => {
      const resolver = new ConfigResolver({
        plugins: [
          { type: 'local', path: './my-plugin' },
          { type: 'local', path: '/absolute/path/plugin' },
        ],
      });
      const { config } = resolver.resolve();
      expect(config.plugins).toHaveLength(2);
      expect(config.plugins[0].path).toBe('./my-plugin');
    });

    it('client cannot inject plugins', () => {
      const resolver = new ConfigResolver({ plugins: [] });
      const { config } = resolver.resolve({
        plugins: [{ type: 'local', path: '/evil' }],
      });
      expect(config.plugins).toHaveLength(0);
    });

    it('converts plugins to SDK options', () => {
      const resolver = new ConfigResolver({
        plugins: [{ type: 'local', path: './skill' }],
      });
      const { config } = resolver.resolve();
      const sdkOpts = resolver.toSDKOptions(config);
      expect(sdkOpts.plugins).toHaveLength(1);
    });

    it('omits plugins from SDK options when empty', () => {
      const resolver = new ConfigResolver({ plugins: [] });
      const { config } = resolver.resolve();
      const sdkOpts = resolver.toSDKOptions(config);
      expect(sdkOpts.plugins).toBeUndefined();
    });
  });

  describe('agents (subagents)', () => {
    const serverAgents = {
      reviewer: {
        description: 'Reviews code',
        prompt: 'You are a code reviewer...',
        tools: ['Read', 'Grep'],
      },
      writer: {
        description: 'Writes code',
        prompt: 'You are a writer...',
        tools: ['Read', 'Write', 'Edit'],
      },
    };

    it('exposes all server-defined agents when client sends no preference', () => {
      const resolver = new ConfigResolver({ agents: serverAgents });
      const { config } = resolver.resolve();
      expect(Object.keys(config.agents)).toEqual(['reviewer', 'writer']);
    });

    it('client selects a subset of agents by name array', () => {
      const resolver = new ConfigResolver({ agents: serverAgents });
      const { config, warnings } = resolver.resolve({ agents: ['reviewer'] });
      expect(Object.keys(config.agents)).toEqual(['reviewer']);
      expect(warnings).toHaveLength(0);
    });

    it('warns when client requests unknown agent', () => {
      const resolver = new ConfigResolver({ agents: serverAgents });
      const { config, warnings } = resolver.resolve({ agents: ['reviewer', 'hacker'] });
      expect(Object.keys(config.agents)).toEqual(['reviewer']);
      expect(warnings.some(w => w.includes('hacker'))).toBe(true);
    });

    it('client cannot define new agents (object form)', () => {
      const resolver = new ConfigResolver({ agents: serverAgents });
      const { config, warnings } = resolver.resolve({
        agents: { evil: { description: 'bad', prompt: 'do bad things' } },
      });
      expect(config.agents).toEqual(serverAgents);
      expect(warnings.some(w => w.includes('cannot define'))).toBe(true);
    });

    it('converts agents to SDK options', () => {
      const resolver = new ConfigResolver({ agents: serverAgents });
      const { config } = resolver.resolve();
      const sdkOpts = resolver.toSDKOptions(config);
      expect(sdkOpts.agents).toHaveProperty('reviewer');
      expect(sdkOpts.agents).toHaveProperty('writer');
    });

    it('omits agents from SDK options when empty', () => {
      const resolver = new ConfigResolver({ agents: {} });
      const { config } = resolver.resolve();
      const sdkOpts = resolver.toSDKOptions(config);
      expect(sdkOpts.agents).toBeUndefined();
    });
  });

  describe('permissionMode', () => {
    it('defaults to bypassPermissions', () => {
      const resolver = new ConfigResolver({});
      const { config } = resolver.resolve();
      expect(config.permissionMode).toBe('bypassPermissions');
    });

    it('uses server-configured permissionMode', () => {
      const resolver = new ConfigResolver({ permissionMode: 'default' });
      const { config } = resolver.resolve();
      expect(config.permissionMode).toBe('default');
    });

    it('client cannot override permissionMode', () => {
      const resolver = new ConfigResolver({ permissionMode: 'bypassPermissions' });
      const { config } = resolver.resolve({ permissionMode: 'default' });
      expect(config.permissionMode).toBe('bypassPermissions');
    });

    it('passes permissionMode to SDK options', () => {
      const resolver = new ConfigResolver({ permissionMode: 'bypassPermissions' });
      const { config } = resolver.resolve();
      const sdkOpts = resolver.toSDKOptions(config);
      expect(sdkOpts.permissionMode).toBe('bypassPermissions');
    });
  });

  describe('working directory (cwd)', () => {
    it('passes cwd from server config', () => {
      const resolver = new ConfigResolver({ cwd: '/app/workspace' });
      const { config } = resolver.resolve();
      expect(config.cwd).toBe('/app/workspace');
    });

    it('client cannot override cwd', () => {
      const resolver = new ConfigResolver({ cwd: '/safe/dir' });
      const { config } = resolver.resolve({ cwd: '/etc/shadow' });
      expect(config.cwd).toBe('/safe/dir');
    });

    it('passes cwd to SDK options', () => {
      const resolver = new ConfigResolver({ cwd: '/app' });
      const { config } = resolver.resolve();
      const sdkOpts = resolver.toSDKOptions(config);
      expect(sdkOpts.cwd).toBe('/app');
    });
  });

  describe('settingSources', () => {
    it('defaults to user + project', () => {
      const resolver = new ConfigResolver({});
      const { config } = resolver.resolve();
      expect(config.settingSources).toEqual(['user', 'project']);
    });

    it('uses server-configured settingSources', () => {
      const resolver = new ConfigResolver({ settingSources: ['project'] });
      const { config } = resolver.resolve();
      expect(config.settingSources).toEqual(['project']);
    });
  });

  describe('includeToolResults', () => {
    it('defaults to true', () => {
      const resolver = new ConfigResolver({});
      const { config } = resolver.resolve();
      expect(config.includeToolResults).toBe(true);
    });

    it('client can disable tool results', () => {
      const resolver = new ConfigResolver({});
      const { config } = resolver.resolve({ includeToolResults: false });
      expect(config.includeToolResults).toBe(false);
    });
  });

  describe('full production config', () => {
    it('resolves the full example from the README', () => {
      const resolver = new ConfigResolver(
        {
          model: 'claude-sonnet-4-6',
          tools: ['Read', 'Write', 'Edit', 'Bash(*)', 'Glob', 'Grep'],
          disallowedTools: ['Bash(rm -rf *)'],
          permissionMode: 'bypassPermissions',
          systemPrompt: 'You are a helpful coding assistant for an e-commerce platform.',
          cwd: '/app/workspace',
          maxTurns: 50,
          includeToolResults: true,
          settingSources: ['user', 'project'],
          plugins: [{ type: 'local', path: './plugins/db-helper' }],
          mcpServers: {
            postgres: {
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-postgres'],
              env: { DATABASE_URL: 'postgres://localhost/mydb' },
            },
          },
          agents: {
            reviewer: {
              description: 'Code reviewer',
              prompt: 'Review code for bugs, security, and performance.',
              tools: ['Read', 'Grep'],
            },
          },
        },
        {
          maxModel: 'claude-sonnet-4-6',
          disallowedTools: [],
          maxTurns: 100,
        }
      );

      const { config, warnings } = resolver.resolve();
      expect(warnings).toHaveLength(0);
      expect(config.model).toBe('claude-sonnet-4-6');
      expect(config.tools).toContain('Read');
      expect(config.tools).not.toContain('Bash(rm -rf *)');
      expect(config.permissionMode).toBe('bypassPermissions');
      expect(config.cwd).toBe('/app/workspace');
      expect(config.maxTurns).toBe(50);
      expect(config.plugins).toHaveLength(1);
      expect(config.mcpServers.postgres.command).toBe('npx');
      expect(config.agents.reviewer.description).toBe('Code reviewer');

      const sdkOpts = resolver.toSDKOptions(config);
      expect(sdkOpts.model).toBe('claude-sonnet-4-6');
      expect(sdkOpts.cwd).toBe('/app/workspace');
      expect(sdkOpts.maxTurns).toBe(50);
      expect(sdkOpts.plugins).toHaveLength(1);
      expect(sdkOpts.mcpServers).toHaveProperty('postgres');
      expect(sdkOpts.agents).toHaveProperty('reviewer');
      expect(sdkOpts.permissionMode).toBe('bypassPermissions');
    });

    it('client override on the full config works correctly', () => {
      const resolver = new ConfigResolver(
        {
          model: 'claude-sonnet-4-6',
          tools: ['Read', 'Write', 'Edit', 'Bash(*)', 'Glob', 'Grep'],
          systemPrompt: 'Server system prompt.',
          plugins: [{ type: 'local', path: './plugin' }],
          mcpServers: { db: { command: 'node', args: ['db.js'] } },
          agents: {
            reviewer: { description: 'Reviewer', prompt: '...', tools: ['Read'] },
            writer: { description: 'Writer', prompt: '...', tools: ['Write'] },
          },
        },
        { maxModel: 'claude-sonnet-4-6', maxTurns: 100 }
      );

      const { config, warnings } = resolver.resolve({
        model: 'claude-opus-4-6',
        tools: ['Read', 'Glob'],
        systemPrompt: 'Client context.',
        maxTurns: 25,
        agents: ['reviewer'],
      });

      expect(config.model).toBe('claude-sonnet-4-6');
      expect(warnings.some(w => w.includes('clamped'))).toBe(true);
      expect(config.tools).toEqual(['Read', 'Glob']);
      expect(config.systemPrompt).toContain('Server system prompt.');
      expect(config.systemPrompt).toContain('Client context.');
      expect(config.maxTurns).toBe(25);
      expect(Object.keys(config.agents)).toEqual(['reviewer']);
      expect(config.plugins).toHaveLength(1);
      expect(config.mcpServers).toHaveProperty('db');
    });
  });

  describe('sanitizeConfigForClient', () => {
    it('strips server-only fields from config sent to clients', () => {
      const resolver = new ConfigResolver({
        plugins: [{ type: 'local', path: './plugin' }],
        cwd: '/secret/path',
        permissionMode: 'bypassPermissions',
        mcpServers: { db: { command: 'node', args: ['db.js'] } },
      });
      const { config } = resolver.resolve();

      const { plugins, cwd, permissionMode, mcpServers, settingSources, ...clientSafe } = config;
      expect(clientSafe).not.toHaveProperty('plugins');
      expect(clientSafe).not.toHaveProperty('cwd');
      expect(clientSafe).not.toHaveProperty('permissionMode');
      expect(clientSafe).not.toHaveProperty('mcpServers');
      expect(clientSafe).toHaveProperty('model');
      expect(clientSafe).toHaveProperty('tools');
    });
  });
});
