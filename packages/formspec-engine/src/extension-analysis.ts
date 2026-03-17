/** @filedesc Validates x-extension usage in item trees against a registry catalog. */
import type { FormspecItem, RegistryEntry } from './index.js';

/** A single extension usage finding emitted while walking a definition item tree. */
export interface ExtensionUsageIssue {
  path: string;
  extension: string;
  severity: 'error' | 'warning' | 'info';
  code: 'UNRESOLVED_EXTENSION' | 'EXTENSION_RETIRED' | 'EXTENSION_DEPRECATED';
  message: string;
}

/** Lookup hooks required to validate extension usage against a registry-backed catalog. */
export interface ValidateExtensionUsageOptions {
  resolveEntry: (name: string) => RegistryEntry | undefined;
}

/** Collect all enabled extension names declared directly on an item or in its `extensions` bag. */
function declaredExtensions(item: FormspecItem): string[] {
  const found = new Set<string>();
  const dynamic = item as Record<string, unknown>;

  for (const [key, value] of Object.entries(dynamic)) {
    if (!key.startsWith('x-')) continue;
    if (value === null || value === undefined || value === false) continue;
    found.add(key);
  }

  const extensionBag = dynamic.extensions;
  if (extensionBag && typeof extensionBag === 'object' && !Array.isArray(extensionBag)) {
    for (const [name, enabled] of Object.entries(extensionBag as Record<string, unknown>)) {
      if (!name.startsWith('x-')) continue;
      if (!enabled) continue;
      found.add(name);
    }
  }

  return [...found];
}

/**
 * Validate x-extension usage in a definition item tree against a registry lookup.
 * The check is intentionally narrow and reusable: unresolved names, retired usage,
 * and deprecated usage.
 */
export function validateExtensionUsage(
  items: FormspecItem[],
  options: ValidateExtensionUsageOptions,
): ExtensionUsageIssue[] {
  const issues: ExtensionUsageIssue[] = [];

  const walk = (nodes: FormspecItem[], prefix: string) => {
    for (const item of nodes) {
      const path = prefix ? `${prefix}.${item.key}` : item.key;

      for (const extension of declaredExtensions(item)) {
        const entry = options.resolveEntry(extension);
        if (!entry) {
          issues.push({
            path,
            extension,
            severity: 'error',
            code: 'UNRESOLVED_EXTENSION',
            message: `Extension "${extension}" not found in any loaded registry`,
          });
          continue;
        }

        if (entry.status === 'retired') {
          issues.push({
            path,
            extension,
            severity: 'warning',
            code: 'EXTENSION_RETIRED',
            message: `Extension "${extension}" is retired and should not be used`,
          });
          continue;
        }

        if (entry.status === 'deprecated') {
          issues.push({
            path,
            extension,
            severity: 'info',
            code: 'EXTENSION_DEPRECATED',
            message: entry.deprecationNotice || `Extension "${extension}" is deprecated`,
          });
        }
      }

      if (item.children?.length) walk(item.children, path);
    }
  };

  walk(items, '');
  return issues;
}
