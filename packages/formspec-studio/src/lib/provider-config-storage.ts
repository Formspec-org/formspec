/** @filedesc Unified localStorage access for the AI provider config shared by studio and chat-v2. */
import { validateProviderConfig } from '@formspec-org/chat';
import type { ProviderConfig, StorageBackend } from '@formspec-org/chat';

/** Canonical localStorage key — not tied to either surface. */
export const CANONICAL_PROVIDER_CONFIG_KEY = 'formspec:provider-config';

/**
 * Legacy keys that predate unification. Listed in priority order for migration:
 * studio first because it was the primary configuration surface.
 */
export const LEGACY_PROVIDER_CONFIG_KEYS = [
  'formspec-studio:provider-config',
  'formspec-chat:provider',
] as const;

function resolveStorage(storage?: StorageBackend): StorageBackend {
  return storage ?? localStorage;
}

export function loadProviderConfig(storage?: StorageBackend): ProviderConfig | null {
  try {
    const raw = resolveStorage(storage).getItem(CANONICAL_PROVIDER_CONFIG_KEY);
    return raw ? (JSON.parse(raw) as ProviderConfig) : null;
  } catch {
    return null;
  }
}

export function saveProviderConfig(config: ProviderConfig, storage?: StorageBackend): void {
  resolveStorage(storage).setItem(CANONICAL_PROVIDER_CONFIG_KEY, JSON.stringify(config));
}

export function clearProviderConfig(storage?: StorageBackend): void {
  resolveStorage(storage).removeItem(CANONICAL_PROVIDER_CONFIG_KEY);
}

/**
 * One-time migration: if any legacy key exists and the canonical key is empty,
 * promote the first VALID legacy value found into the canonical slot. Corrupt
 * or schema-invalid legacy values are dropped rather than poisoning the canonical
 * key. Always clears every legacy key afterward so they stop drifting.
 *
 * Safe to call on every app boot — idempotent and cheap.
 */
// Why: migrating from split keys added before 2026-04-14
export function migrateLegacyProviderConfigKeys(storage?: StorageBackend): void {
  const target = resolveStorage(storage);
  const hasCanonical = target.getItem(CANONICAL_PROVIDER_CONFIG_KEY) !== null;

  if (!hasCanonical) {
    for (const legacyKey of LEGACY_PROVIDER_CONFIG_KEYS) {
      const value = target.getItem(legacyKey);
      if (value !== null && isValidSerializedProviderConfig(value)) {
        target.setItem(CANONICAL_PROVIDER_CONFIG_KEY, value);
        break;
      }
    }
  }

  for (const legacyKey of LEGACY_PROVIDER_CONFIG_KEYS) {
    target.removeItem(legacyKey);
  }
}

function isValidSerializedProviderConfig(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as ProviderConfig;
    return validateProviderConfig(parsed).length === 0;
  } catch {
    return false;
  }
}
