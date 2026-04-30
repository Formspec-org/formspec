/**
 * Normalize definition `binds` from JSON import (object map or array) to the
 * array shape the studio and queries expect — mirrors createDefaultState.
 */
import type { FormBind } from '@formspec-org/types';

export function normalizeBindsFromUnknown(binds: unknown): FormBind[] | undefined {
  if (binds == null) return undefined;
  if (Array.isArray(binds)) return binds as FormBind[];
  if (typeof binds === 'object') {
    return Object.entries(binds as Record<string, unknown>).map(([path, value]) => ({
      path,
      ...(typeof value === 'object' && value !== null ? value : {}),
    })) as FormBind[];
  }
  return undefined;
}
