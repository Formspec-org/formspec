/**
 * Project-level command handlers.
 *
 * Project commands manage the project lifecycle: importing complete artifact
 * bundles, merging subforms, loading/unloading extension registries, and
 * publishing versioned releases.
 *
 * @module handlers/project
 */
import type { CommandHandler, LocaleState } from '../types.js';
import type { FormItem } from '@formspec-org/types';
import { normalizeComponentState } from '../component-documents.js';
import { normalizeBcp47 } from '../locale-utils.js';
import { normalizeDefinition } from '../normalization.js';

export const projectHandlers: Record<string, CommandHandler> = {

  'project.import': (state, payload) => {
    const p = payload as Record<string, any>;

    if (p.definition) state.definition = normalizeDefinition(p.definition);
    if (p.component) {
      state.component = normalizeComponentState(p.component, state.definition.url);
    } else if (p.definition) {
      state.component = normalizeComponentState(state.component, state.definition.url);
    }
    if (p.theme) {
      state.theme = p.theme;
    }

    if (p.mappings) {
      state.mappings = p.mappings;
    } else if (p.mapping) {
      // Backward compat: old single-mapping bundles migrate to named collection
      state.mappings = { default: p.mapping };
    }

    // Import locale documents
    if (p.locales && typeof p.locales === 'object') {
      state.locales = {};
      for (const [code, localeData] of Object.entries(p.locales)) {
        const locale = normalizeBcp47((localeData as LocaleState).locale ?? code);
        state.locales[locale] = {
          ...(localeData as LocaleState),
          locale,
        };
      }

      // Clear dangling selection if imported locales do not contain it.
      if (state.selectedLocaleId && !state.locales[state.selectedLocaleId]) {
        state.selectedLocaleId = undefined;
      }
    }

    // Sync targetDefinition URLs
    const url = state.definition.url;
    if (!state.component.targetDefinition) state.component.targetDefinition = { url };
    else state.component.targetDefinition.url = url;
    if (!state.theme.targetDefinition) state.theme.targetDefinition = { url };
    else state.theme.targetDefinition.url = url;

    const needsTreeRebuild = !!p.definition || !!p.component;
    return { rebuildComponentTree: needsTreeRebuild, clearHistory: false };
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
