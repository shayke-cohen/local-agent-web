import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONFIG,
  DEFAULT_CONSTRAINTS,
  MODEL_TIERS,
  getModelTier,
  isModelAllowed,
  clampModel,
  validateConfig,
} from '../../src/protocol/config.js';

describe('protocol/config', () => {
  describe('DEFAULT_CONFIG', () => {
    it('has sensible defaults', () => {
      expect(DEFAULT_CONFIG.model).toBe('claude-sonnet-4-6');
      expect(DEFAULT_CONFIG.tools).toContain('Read');
      expect(DEFAULT_CONFIG.tools).toContain('Write');
      expect(DEFAULT_CONFIG.tools).toContain('Bash(*)');
      expect(DEFAULT_CONFIG.disallowedTools).toEqual([]);
      expect(DEFAULT_CONFIG.systemPrompt).toBe('');
      expect(DEFAULT_CONFIG.plugins).toEqual([]);
      expect(DEFAULT_CONFIG.includeToolResults).toBe(true);
    });
  });

  describe('DEFAULT_CONSTRAINTS', () => {
    it('has no constraints by default', () => {
      expect(DEFAULT_CONSTRAINTS.maxModel).toBeUndefined();
      expect(DEFAULT_CONSTRAINTS.allowedModels).toBeUndefined();
      expect(DEFAULT_CONSTRAINTS.disallowedTools).toEqual([]);
      expect(DEFAULT_CONSTRAINTS.maxTurns).toBeUndefined();
    });
  });

  describe('MODEL_TIERS', () => {
    it('lists models from cheapest to most expensive', () => {
      expect(MODEL_TIERS[0]).toBe('claude-haiku-3-5');
      expect(MODEL_TIERS[1]).toBe('claude-sonnet-4-6');
      expect(MODEL_TIERS[2]).toBe('claude-opus-4-6');
    });
  });

  describe('getModelTier', () => {
    it('returns correct index for known models', () => {
      expect(getModelTier('claude-haiku-3-5')).toBe(0);
      expect(getModelTier('claude-sonnet-4-6')).toBe(1);
      expect(getModelTier('claude-opus-4-6')).toBe(2);
    });

    it('returns -1 for unknown models', () => {
      expect(getModelTier('gpt-4')).toBe(-1);
      expect(getModelTier('unknown')).toBe(-1);
    });

    it('returns -1 for null/undefined', () => {
      expect(getModelTier(null)).toBe(-1);
      expect(getModelTier(undefined)).toBe(-1);
    });
  });

  describe('isModelAllowed', () => {
    it('allows model at or below max tier', () => {
      expect(isModelAllowed('claude-haiku-3-5', 'claude-sonnet-4-6')).toBe(true);
      expect(isModelAllowed('claude-sonnet-4-6', 'claude-sonnet-4-6')).toBe(true);
    });

    it('rejects model above max tier', () => {
      expect(isModelAllowed('claude-opus-4-6', 'claude-sonnet-4-6')).toBe(false);
    });

    it('allows any model when max is undefined', () => {
      expect(isModelAllowed('claude-opus-4-6', undefined)).toBe(true);
    });

    it('allows unknown models (permissive for custom models)', () => {
      expect(isModelAllowed('custom-model', 'claude-sonnet-4-6')).toBe(true);
    });
  });

  describe('clampModel', () => {
    it('returns requested model when within bounds', () => {
      expect(clampModel('claude-haiku-3-5', 'claude-sonnet-4-6')).toBe('claude-haiku-3-5');
      expect(clampModel('claude-sonnet-4-6', 'claude-sonnet-4-6')).toBe('claude-sonnet-4-6');
    });

    it('returns max model when requested exceeds bounds', () => {
      expect(clampModel('claude-opus-4-6', 'claude-sonnet-4-6')).toBe('claude-sonnet-4-6');
    });

    it('returns requested when no max', () => {
      expect(clampModel('claude-opus-4-6', undefined)).toBe('claude-opus-4-6');
    });
  });

  describe('validateConfig', () => {
    it('returns empty array for valid config', () => {
      expect(validateConfig({ model: 'claude-sonnet-4-6', tools: ['Read'] })).toEqual([]);
    });

    it('returns empty array for empty config', () => {
      expect(validateConfig({})).toEqual([]);
    });

    it('reports non-string model', () => {
      const errors = validateConfig({ model: 123 });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/model/);
    });

    it('reports non-array tools', () => {
      const errors = validateConfig({ tools: 'Read' });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/tools/);
    });

    it('reports non-array disallowedTools', () => {
      const errors = validateConfig({ disallowedTools: 'Write' });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/disallowedTools/);
    });

    it('reports non-string systemPrompt', () => {
      const errors = validateConfig({ systemPrompt: 42 });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/systemPrompt/);
    });

    it('reports non-array plugins', () => {
      const errors = validateConfig({ plugins: {} });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/plugins/);
    });

    it('reports invalid maxTurns', () => {
      expect(validateConfig({ maxTurns: 0 })).toHaveLength(1);
      expect(validateConfig({ maxTurns: -5 })).toHaveLength(1);
      expect(validateConfig({ maxTurns: 'many' })).toHaveLength(1);
    });

    it('reports multiple errors', () => {
      const errors = validateConfig({ model: 123, tools: 'Read', maxTurns: -1 });
      expect(errors.length).toBe(3);
    });
  });
});
