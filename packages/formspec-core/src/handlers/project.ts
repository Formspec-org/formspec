/**
 * Project-level command handlers.
 *
 * Project commands manage the project lifecycle: importing complete artifact
 * bundles, merging subforms, loading/unloading extension registries, and
 * publishing versioned releases.
 *
 * @module handlers/project
 */
import type { CommandHandler } from '../types.js';
import type { FormItem } from 'formspec-types';
import { splitComponentState, hasAuthoredComponentTree } from '../component-documents.js';
import { normalizeDefinition } from '../normalization.js';

/** Every item key in the definition tree (any depth) — used to validate theme region keys. */
function collectDefinitionItemKeys(items: FormItem[] | undefined): Set<string> {
  const keys = new Set<string>();
  function walk(nodes: FormItem[]) {
    for (const item of nodes) {
      keys.add(item.key);
      if (item.children?.length) walk(item.children);
    }
  }
  walk(items ?? []);
  return keys;
}

export const projectHandlers: Record<string, CommandHandler> = {

  'project.import': (state, payload) => {
    const p = payload as Record<string, any>;

    if (p.definition) state.definition = normalizeDefinition(p.definition);
    if (p.component) {
      const componentState = splitComponentState(p.component, state.definition.url);
      state.component = componentState.component;
      state.generatedComponent = componentState.generatedComponent;
    }
    if (p.theme) {
      state.theme = p.theme;
    } else if (p.definition) {
      // Definition-only import: drop any page whose regions reference a key
      // that does not exist in the new definition. Valid pages are preserved;
      // only pages with at least one stale region key are removed.
      const themePages = (state.theme as any).pages as any[] | undefined;
      if (themePages && themePages.length > 0) {
        const flatKeys = collectDefinitionItemKeys((state.definition as any).items as FormItem[]);
        (state.theme as any).pages = themePages.filter((page: any) =>
          (page.regions ?? []).every((region: any) => {
            const k = region.key as string | undefined;
            return !k || flatKeys.has(k);
          }),
        );
      }
    }
    if (p.mappings) {
      state.mappings = p.mappings;
    } else if (p.mapping) {
      // Backward compat: old single-mapping bundles migrate to named collection
      state.mappings = { default: p.mapping };
    }

    // Sync targetDefinition URLs
    const url = state.definition.url;
    if (!state.component.targetDefinition) state.component.targetDefinition = { url };
    else state.component.targetDefinition.url = url;
    if (!state.generatedComponent.targetDefinition) state.generatedComponent.targetDefinition = { url };
    else state.generatedComponent.targetDefinition.url = url;
    if (!state.theme.targetDefinition) state.theme.targetDefinition = { url };
    else state.theme.targetDefinition.url = url;

    return { rebuildComponentTree: !hasAuthoredComponentTree(state.component), clearHistory: false };
  },

  'project.importSubform': (state, payload) => {
    const { definition, targetGroupPath, keyPrefix } = payload as {
      definition: any; targetGroupPath?: string; keyPrefix?: string;
    };

    const items = definition.items as FormItem[];
    const prefixed = keyPrefix
      ? items.map((item: any) => ({ ...item, key: `${keyPrefix}${item.key}` }))
      : items;

    if (targetGroupPath) {
      // Find the target group and append items
      const parts = targetGroupPath.split('.');
      let current = state.definition.items;
      for (const part of parts) {
        const found = current.find(it => it.key === part);
        if (!found) throw new Error(`Group not found: ${targetGroupPath}`);
        if (!found.children) found.children = [];
        current = found.children;
      }
      current.push(...prefixed);
    } else {
      state.definition.items.push(...prefixed);
    }

    return { rebuildComponentTree: true };
  },

  'project.loadRegistry': (state, payload) => {
    const { registry } = payload as { registry: any };

    const entries: Record<string, unknown> = {};
    for (const entry of (registry.entries ?? []) as any[]) {
      if (entry.name) entries[entry.name] = entry;
    }

    state.extensions.registries.push({
      url: registry.url,
      document: registry,
      entries,
    });

    return { rebuildComponentTree: false };
  },

  'project.removeRegistry': (state, payload) => {
    const { url } = payload as { url: string };
    state.extensions.registries = state.extensions.registries.filter(r => r.url !== url);
    return { rebuildComponentTree: false };
  },

  'project.publish': (state, payload) => {
    const { version, summary } = payload as { version: string; summary?: string };

    state.definition.version = version;

    state.versioning.releases.push({
      version,
      publishedAt: new Date().toISOString(),
      changelog: summary ?? null,
      snapshot: structuredClone(state.definition),
    });

    // Update baseline
    state.versioning.baseline = structuredClone(state.definition);

    return { rebuildComponentTree: false };
  },
};
