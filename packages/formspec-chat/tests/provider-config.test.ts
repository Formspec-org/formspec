import { describe, it, expect } from 'vitest';
import { validateProviderConfig } from '../src/provider-config.js';
import type { ProviderConfig } from '../src/types.js';

describe('validateProviderConfig', () => {
  it('accepts a valid Anthropic config', () => {
    const config: ProviderConfig = {
      provider: 'anthropic',
      apiKey: 'sk-ant-api03-abc123',
    };
    const errors = validateProviderConfig(config);
    expect(errors).toEqual([]);
  });

  it('accepts a valid Google config', () => {
    const config: ProviderConfig = {
      provider: 'google',
      apiKey: 'mock-gemini-key',
    };
    expect(validateProviderConfig(config)).toEqual([]);
  });

  it('accepts a valid OpenAI config', () => {
    const config: ProviderConfig = {
      provider: 'openai',
      apiKey: 'sk-proj-abc123',
    };
    expect(validateProviderConfig(config)).toEqual([]);
  });

  it('rejects empty API key', () => {
    const config: ProviderConfig = {
      provider: 'anthropic',
      apiKey: '',
    };
    const errors = validateProviderConfig(config);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('apiKey');
    expect(errors[0].message).toMatch(/required/i);
  });

  it('rejects whitespace-only API key', () => {
    const config: ProviderConfig = {
      provider: 'openai',
      apiKey: '   ',
    };
    const errors = validateProviderConfig(config);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('apiKey');
  });

  it('rejects unknown provider type', () => {
    const config = {
      provider: 'mistral' as any,
      apiKey: 'some-key',
    };
    const errors = validateProviderConfig(config);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('provider');
    expect(errors[0].message).toMatch(/anthropic|google|openai/);
  });

  it('accepts optional model field', () => {
    const config: ProviderConfig = {
      provider: 'anthropic',
      apiKey: 'sk-ant-api03-abc123',
      model: 'claude-sonnet-4-6-20250514',
    };
    expect(validateProviderConfig(config)).toEqual([]);
  });

  it('returns multiple errors when multiple fields are invalid', () => {
    const config = {
      provider: 'bad' as any,
      apiKey: '',
    };
    const errors = validateProviderConfig(config);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});
