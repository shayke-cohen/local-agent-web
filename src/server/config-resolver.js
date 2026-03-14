/**
 * ConfigResolver — merges server defaults + client-requested config.
 *
 * Merge rules:
 *   model:           client can request, server clamps via maxModel
 *   tools:           server defines superset, client can narrow (never expand)
 *   disallowedTools: union of server + client (both can block)
 *   systemPrompt:    server first + client appended
 *   plugins:         server-only (clients cannot inject)
 *   cwd:             server-only
 *   permissionMode:  server-only
 *   maxTurns:        min(server, client)
 *   agents:          server defines, client can select subset
 *   mcpServers:      server-only
 */

import { DEFAULT_CONFIG, DEFAULT_CONSTRAINTS, clampModel, validateConfig } from '../protocol/config.js';

export class ConfigResolver {
  /**
   * @param {import('../protocol/config.js').AgentConfig} serverDefaults
   * @param {import('../protocol/config.js').ServerConstraints} constraints
   */
  constructor(serverDefaults = {}, constraints = {}) {
    this._serverDefaults = { ...DEFAULT_CONFIG, ...serverDefaults };
    this._constraints = { ...DEFAULT_CONSTRAINTS, ...constraints };
  }

  /**
   * Resolve a client config request against server defaults and constraints.
   * Returns the effective config to pass to the Agent SDK.
   *
   * @param {object} [clientConfig] - Config requested by the client
   * @returns {{ config: import('../protocol/config.js').AgentConfig, warnings: string[] }}
   */
  resolve(clientConfig = {}) {
    const warnings = [];
    const server = this._serverDefaults;
    const constraints = this._constraints;
    const client = clientConfig || {};

    const errors = validateConfig(client);
    if (errors.length > 0) {
      warnings.push(...errors.map(e => `Client config warning: ${e}`));
    }

    const resolved = {};

    // Model: client can request, server clamps
    resolved.model = client.model || server.model;
    if (constraints.maxModel && resolved.model !== clampModel(resolved.model, constraints.maxModel)) {
      warnings.push(`Model "${resolved.model}" exceeds maxModel "${constraints.maxModel}", clamped`);
      resolved.model = clampModel(resolved.model, constraints.maxModel);
    }
    if (constraints.allowedModels && !constraints.allowedModels.includes(resolved.model)) {
      warnings.push(`Model "${resolved.model}" not in allowedModels, using server default`);
      resolved.model = server.model;
    }

    // Tools: server defines superset, client can narrow
    const serverTools = new Set(server.tools || []);
    if (client.tools && Array.isArray(client.tools)) {
      const narrowed = client.tools.filter(t => serverTools.has(t));
      const rejected = client.tools.filter(t => !serverTools.has(t));
      if (rejected.length > 0) {
        warnings.push(`Client requested tools not in server superset: ${rejected.join(', ')}`);
      }
      resolved.tools = narrowed;
    } else {
      resolved.tools = [...serverTools];
    }

    // DisallowedTools: union of server + client + constraints
    const disallowed = new Set([
      ...(server.disallowedTools || []),
      ...(constraints.disallowedTools || []),
      ...(client.disallowedTools || []),
    ]);
    resolved.disallowedTools = [...disallowed];

    // Remove disallowed from allowed tools
    resolved.tools = resolved.tools.filter(t => !disallowed.has(t));

    // SystemPrompt: server first + client appended
    const parts = [];
    if (server.systemPrompt) parts.push(server.systemPrompt);
    if (client.systemPrompt) parts.push(client.systemPrompt);
    resolved.systemPrompt = parts.join('\n\n');

    // Server-only fields (client cannot set)
    resolved.plugins = server.plugins || [];
    resolved.cwd = server.cwd;
    resolved.permissionMode = server.permissionMode || 'bypassPermissions';
    resolved.mcpServers = server.mcpServers || {};
    resolved.settingSources = server.settingSources || ['user', 'project'];

    // MaxTurns: min(server, client, constraint)
    const turns = [server.maxTurns, client.maxTurns, constraints.maxTurns]
      .filter(t => typeof t === 'number' && t > 0);
    resolved.maxTurns = turns.length > 0 ? Math.min(...turns) : undefined;

    // Agents: server defines, client can select subset
    const serverAgents = server.agents || {};
    if (client.agents && typeof client.agents === 'object') {
      if (Array.isArray(client.agents)) {
        // Client sends array of agent names to activate
        const selected = {};
        for (const name of client.agents) {
          if (serverAgents[name]) {
            selected[name] = serverAgents[name];
          } else {
            warnings.push(`Client requested unknown agent: ${name}`);
          }
        }
        resolved.agents = selected;
      } else {
        // Client sends agent definitions — ignore, server-only
        warnings.push('Client cannot define agents, using server-defined agents');
        resolved.agents = serverAgents;
      }
    } else {
      resolved.agents = serverAgents;
    }

    // IncludeToolResults: either side can set
    resolved.includeToolResults = client.includeToolResults ?? server.includeToolResults ?? true;

    return { config: resolved, warnings };
  }

  /**
   * Convert resolved config to Agent SDK V1 query() options.
   * @param {import('../protocol/config.js').AgentConfig} config
   * @returns {object} Options for query()
   */
  toSDKOptions(config) {
    const opts = {
      model: config.model,
      allowedTools: config.tools,
      disallowedTools: config.disallowedTools?.length > 0 ? config.disallowedTools : undefined,
      permissionMode: config.permissionMode,
      allowDangerouslySkipPermissions: config.permissionMode === 'bypassPermissions' ? true : undefined,
      settingSources: config.settingSources,
    };

    if (config.cwd) opts.cwd = config.cwd;
    if (config.maxTurns) opts.maxTurns = config.maxTurns;
    if (config.systemPrompt) opts.systemPrompt = config.systemPrompt;

    if (config.plugins?.length > 0) {
      opts.plugins = config.plugins;
    }

    if (config.agents && Object.keys(config.agents).length > 0) {
      opts.agents = config.agents;
    }

    if (config.mcpServers && Object.keys(config.mcpServers).length > 0) {
      opts.mcpServers = config.mcpServers;
    }

    // Clean up undefined values
    for (const key of Object.keys(opts)) {
      if (opts[key] === undefined) delete opts[key];
    }

    return opts;
  }
}
