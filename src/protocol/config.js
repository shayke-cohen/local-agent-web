/**
 * Configuration schema and defaults for agent-web.
 *
 * Config flows: Component → Provider → Client Request → Server Merge → Agent SDK
 * Server is the security boundary with veto power.
 */

/**
 * Default session config applied when no overrides are provided.
 * @type {AgentConfig}
 */
export const DEFAULT_CONFIG = {
  model: 'claude-sonnet-4-6',
  tools: ['Bash(*)', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
  disallowedTools: [],
  permissionMode: 'bypassPermissions',
  systemPrompt: '',
  plugins: [],
  cwd: undefined,
  maxTurns: undefined,
  includeToolResults: true,
  agents: {},
  mcpServers: {},
  settingSources: ['user', 'project'],
};

/**
 * Default server constraints. These are hard limits clients cannot exceed.
 * @type {ServerConstraints}
 */
export const DEFAULT_CONSTRAINTS = {
  maxModel: undefined,
  allowedModels: undefined,
  disallowedTools: [],
  maxTurns: undefined,
};

/**
 * Model tier ordering for constraint enforcement.
 * Lower index = cheaper/faster, higher index = more capable/expensive.
 */
export const MODEL_TIERS = [
  'claude-haiku-3-5',
  'claude-sonnet-4-6',
  'claude-opus-4-6',
];

/**
 * Get the tier index for a model string.
 * Returns -1 if the model is not in the known tiers.
 * @param {string} model
 * @returns {number}
 */
export function getModelTier(model) {
  if (!model) return -1;
  const idx = MODEL_TIERS.findIndex(m =>
    model === m || model.startsWith(m.replace(/-\d+-\d+$/, ''))
  );
  return idx;
}

/**
 * Check if a model is at or below a max model tier.
 * @param {string} requested
 * @param {string} max
 * @returns {boolean}
 */
export function isModelAllowed(requested, max) {
  if (!max) return true;
  const reqTier = getModelTier(requested);
  const maxTier = getModelTier(max);
  if (reqTier === -1 || maxTier === -1) return true;
  return reqTier <= maxTier;
}

/**
 * Clamp a model to the max allowed tier.
 * Returns the max model if the requested model exceeds it.
 * @param {string} requested
 * @param {string} max
 * @returns {string}
 */
export function clampModel(requested, max) {
  if (!max) return requested;
  if (isModelAllowed(requested, max)) return requested;
  return max;
}

/**
 * Validate a config object. Returns an array of error strings (empty = valid).
 * @param {object} config
 * @returns {string[]}
 */
export function validateConfig(config) {
  const errors = [];

  if (config.model && typeof config.model !== 'string') {
    errors.push('model must be a string');
  }

  if (config.tools && !Array.isArray(config.tools)) {
    errors.push('tools must be an array');
  }

  if (config.disallowedTools && !Array.isArray(config.disallowedTools)) {
    errors.push('disallowedTools must be an array');
  }

  if (config.systemPrompt && typeof config.systemPrompt !== 'string') {
    errors.push('systemPrompt must be a string');
  }

  if (config.plugins && !Array.isArray(config.plugins)) {
    errors.push('plugins must be an array');
  }

  if (config.maxTurns !== undefined && (typeof config.maxTurns !== 'number' || config.maxTurns < 1)) {
    errors.push('maxTurns must be a positive number');
  }

  return errors;
}

/**
 * @typedef {object} AgentConfig
 * @property {string} [model] - Model to use
 * @property {string[]} [tools] - Available tools
 * @property {string[]} [disallowedTools] - Blocked tools
 * @property {string} [permissionMode] - Permission handling mode
 * @property {string} [systemPrompt] - Additional system prompt
 * @property {Array} [plugins] - Plugin definitions (server-only)
 * @property {string} [cwd] - Working directory (server-only)
 * @property {number} [maxTurns] - Max agentic turns
 * @property {boolean} [includeToolResults] - Stream tool results to client
 * @property {Object<string, object>} [agents] - Subagent definitions
 * @property {Object<string, object>} [mcpServers] - MCP server configs
 * @property {string[]} [settingSources] - Config file sources
 */

/**
 * @typedef {object} ServerConstraints
 * @property {string} [maxModel] - Maximum model tier clients can request
 * @property {string[]} [allowedModels] - Explicit allowlist of models
 * @property {string[]} [disallowedTools] - Tools blocked at server level
 * @property {number} [maxTurns] - Maximum turns clients can request
 */
