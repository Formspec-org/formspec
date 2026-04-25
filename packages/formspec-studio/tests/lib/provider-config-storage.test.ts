/** @filedesc Tests for the unified provider-config localStorage module and legacy-key migration. */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CANONICAL_PROVIDER_CONFIG_KEY,
  LEGACY_PROVIDER_CONFIG_KEYS,
  loadProviderConfig,
  saveProviderConfig,
  clearProviderConfig,
  migrateLegacyProviderConfigKeys,
} from '../../src/lib/provider-config-storage';

const STUDIO_LEGACY = 'formspec-studio:provider-config';
const CHAT_LEGACY = 'formspec-chat:provider';

beforeEach(() => {
  localStorage.clear();
});

describe('provider-config storage key', () => {
  it('uses a single canonical key not tied to either surface', () => {
    expect(CANONICAL_PROVIDER_CONFIG_KEY).toBe('formspec:provider-config');
  });

  it('lists both historical keys as legacy', () => {
    expect(LEGACY_PROVIDER_CONFIG_KEYS).toContain(STUDIO_LEGACY);
    expect(LEGACY_PROVIDER_CONFIG_KEYS).toContain(CHAT_LEGACY);
  });
});

describe('loadProviderConfig / saveProviderConfig / clearProviderConfig', () => {
  it('round-trips a config through the canonical key', () => {
    saveProviderConfig({ provider: 'google', apiKey: 'abc' });
    expect(localStorage.getItem(CANONICAL_PROVIDER_CONFIG_KEY)).toBe(
      JSON.stringify({ provider: 'google', apiKey: 'abc' }),
    );
    expect(loadProviderConfig()).toEqual({ provider: 'google', apiKey: 'abc' });
  });

  it('returns null when nothing is stored', () => {
    expect(loadProviderConfig()).toBeNull();
  });

  it('returns null (not a throw) when stored value is malformed JSON', () => {
    localStorage.setItem(CANONICAL_PROVIDER_CONFIG_KEY, '{not json');
    expect(loadProviderConfig()).toBeNull();
  });

  it('clearProviderConfig removes the canonical key', () => {
    saveProviderConfig({ provider: 'anthropic', apiKey: 'k' });
    clearProviderConfig();
    expect(localStorage.getItem(CANONICAL_PROVIDER_CONFIG_KEY)).toBeNull();
  });
});

describe('migrateLegacyProviderConfigKeys', () => {
  it('copies studio legacy key to the canonical key and deletes it', () => {
    localStorage.setItem(STUDIO_LEGACY, JSON.stringify({ provider: 'google', apiKey: 'studio-k' }));

    migrateLegacyProviderConfigKeys();

    expect(localStorage.getItem(CANONICAL_PROVIDER_CONFIG_KEY)).toBe(
      JSON.stringify({ provider: 'google', apiKey: 'studio-k' }),
    );
    expect(localStorage.getItem(STUDIO_LEGACY)).toBeNull();
  });

  it('copies chat legacy key to the canonical key and deletes it', () => {
    localStorage.setItem(CHAT_LEGACY, JSON.stringify({ provider: 'anthropic', apiKey: 'chat-k' }));

    migrateLegacyProviderConfigKeys();

    expect(localStorage.getItem(CANONICAL_PROVIDER_CONFIG_KEY)).toBe(
      JSON.stringify({ provider: 'anthropic', apiKey: 'chat-k' }),
    );
    expect(localStorage.getItem(CHAT_LEGACY)).toBeNull();
  });

  it('does NOT overwrite an existing canonical value', () => {
    saveProviderConfig({ provider: 'openai', apiKey: 'current' });
    localStorage.setItem(STUDIO_LEGACY, JSON.stringify({ provider: 'google', apiKey: 'stale' }));

    migrateLegacyProviderConfigKeys();

    // Canonical untouched
    expect(loadProviderConfig()).toEqual({ provider: 'openai', apiKey: 'current' });
    // Legacy still cleared — it's stale and no longer needed
    expect(localStorage.getItem(STUDIO_LEGACY)).toBeNull();
  });

  it('prefers studio legacy over chat legacy when both exist (studio is primary surface)', () => {
    localStorage.setItem(STUDIO_LEGACY, JSON.stringify({ provider: 'google', apiKey: 'studio-wins' }));
    localStorage.setItem(CHAT_LEGACY, JSON.stringify({ provider: 'anthropic', apiKey: 'chat-loses' }));

    migrateLegacyProviderConfigKeys();

    expect(loadProviderConfig()).toEqual({ provider: 'google', apiKey: 'studio-wins' });
    expect(localStorage.getItem(STUDIO_LEGACY)).toBeNull();
    expect(localStorage.getItem(CHAT_LEGACY)).toBeNull();
  });

  it('is a no-op when no legacy keys are present', () => {
    migrateLegacyProviderConfigKeys();
    expect(localStorage.getItem(CANONICAL_PROVIDER_CONFIG_KEY)).toBeNull();
  });

  it('does NOT promote a corrupt-JSON legacy value to the canonical key', () => {
    localStorage.setItem(STUDIO_LEGACY, '{not valid json');

    migrateLegacyProviderConfigKeys();

    expect(localStorage.getItem(CANONICAL_PROVIDER_CONFIG_KEY)).toBeNull();
    expect(localStorage.getItem(STUDIO_LEGACY)).toBeNull();
  });

  it('does not promote legacy when canonical key exists even if value is malformed JSON', () => {
    localStorage.setItem(CANONICAL_PROVIDER_CONFIG_KEY, '{not valid json');
    localStorage.setItem(STUDIO_LEGACY, JSON.stringify({ provider: 'google', apiKey: 'from-legacy' }));

    migrateLegacyProviderConfigKeys();

    expect(localStorage.getItem(CANONICAL_PROVIDER_CONFIG_KEY)).toBe('{not valid json');
    expect(localStorage.getItem(STUDIO_LEGACY)).toBeNull();
  });

  it('does NOT promote a schema-invalid legacy value to the canonical key', () => {
    localStorage.setItem(STUDIO_LEGACY, JSON.stringify({ provider: 'google' }));

    migrateLegacyProviderConfigKeys();

    expect(localStorage.getItem(CANONICAL_PROVIDER_CONFIG_KEY)).toBeNull();
    expect(localStorage.getItem(STUDIO_LEGACY)).toBeNull();
  });

  it('falls through to the next legacy key when the first one is corrupt', () => {
    localStorage.setItem(STUDIO_LEGACY, '{corrupt');
    localStorage.setItem(CHAT_LEGACY, JSON.stringify({ provider: 'anthropic', apiKey: 'chat-k' }));

    migrateLegacyProviderConfigKeys();

    expect(loadProviderConfig()).toEqual({ provider: 'anthropic', apiKey: 'chat-k' });
    expect(localStorage.getItem(STUDIO_LEGACY)).toBeNull();
    expect(localStorage.getItem(CHAT_LEGACY)).toBeNull();
  });

  it('is idempotent — running twice has the same effect as once', () => {
    localStorage.setItem(STUDIO_LEGACY, JSON.stringify({ provider: 'google', apiKey: 'k' }));

    migrateLegacyProviderConfigKeys();
    migrateLegacyProviderConfigKeys();

    expect(loadProviderConfig()).toEqual({ provider: 'google', apiKey: 'k' });
    expect(localStorage.getItem(STUDIO_LEGACY)).toBeNull();
  });
});

describe('cross-surface unification', () => {
  it('studio-embedded surface reads and writes the canonical key', async () => {
    const { getSavedProviderConfig } = await import('../../src/components/AppSettingsDialog');

    saveProviderConfig({ provider: 'google', apiKey: 'shared' });
    expect(getSavedProviderConfig()).toEqual({ provider: 'google', apiKey: 'shared' });
  });

  it('no source file references a legacy storage key anymore (only the legacy constant itself)', async () => {
    // If a caller ever drifts back to a hardcoded legacy string the unification is broken.
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, resolve } = await import('node:path');

    const here = dirname(fileURLToPath(import.meta.url));
    const srcRoot = resolve(here, '../../src');
    const files = [
      resolve(srcRoot, 'components/AppSettingsDialog.tsx'),
      resolve(srcRoot, 'components/ChatPanel.tsx'),
      resolve(srcRoot, 'main.tsx'),
    ];

    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(text, `${file} must not hardcode formspec-studio:provider-config`).not.toMatch(
        /['"]formspec-studio:provider-config['"]/,
      );
      expect(text, `${file} must not hardcode formspec-chat:provider`).not.toMatch(
        /['"]formspec-chat:provider['"]/,
      );
    }
  });
});
