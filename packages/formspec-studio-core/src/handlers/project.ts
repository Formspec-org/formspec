/**
 * Project-level command handlers.
 *
 * Project commands manage the project lifecycle: importing complete artifact
 * bundles, merging subforms, loading/unloading extension registries, and
 * publishing versioned releases.
 *
 * Key behaviors:
 *
 *   - **Import** replaces the entire project state (definition, component,
 *     theme, mapping) from external artifacts. Missing artifacts in the payload
 *     retain their current values. Import preserves undo history so a load can
 *     be reversed like any other authoring action.
 *   - **Import subform** merges a definition fragment into the current project
 *     without replacing the whole state. Items can be scoped to a target group
 *     and optionally key-prefixed to avoid collisions.
 *   - **Load registry** adds an extension registry for constraint resolution.
 *     Entries are pre-indexed in a Map for fast lookup during validation.
 *   - **Publish** snapshots the current definition as a versioned release,
 *     updates the baseline for future diff/changelog generation, and records
 *     the release in the versioning subsystem.
 *
 * @module handlers/project
 */
import { registerHandler } from '../handler-registry.js';
import type { FormspecItem } from 'formspec-engine';
import { splitComponentState, hasAuthoredComponentTree } from '../component-documents.js';

/**
 * Replace the entire project state from imported artifacts.
 *
 * Any combination of artifacts may be provided -- missing artifacts retain
 * their current values. After replacement, `targetDefinition.url` on both
 * the component and theme documents is synced to the definition's URL to
 * maintain cross-artifact consistency.
 *
 * Leaves undo history intact so users can undo an import.
 *
 * @param payload.definition - Replacement FormspecDefinition (optional).
 * @param payload.component - Replacement FormspecComponentDocument (optional).
 * @param payload.theme - Replacement FormspecThemeDocument (optional).
 * @param payload.mapping - Replacement FormspecMappingDocument (optional).
 */
registerHandler('project.import', (state, payload) => {
  const p = payload as Record<string, any>;

  if (p.definition) state.definition = p.definition;
  if (p.component) {
    const componentState = splitComponentState(p.component, state.definition.url);
    state.component = componentState.component;
    state.generatedComponent = componentState.generatedComponent;
  }
  if (p.theme) state.theme = p.theme;
  if (p.mapping) state.mapping = p.mapping;

  // Sync targetDefinition URLs
  const url = state.definition.url;
  if (!state.component.targetDefinition) state.component.targetDefinition = { url };
  else state.component.targetDefinition.url = url;
  if (!state.generatedComponent.targetDefinition) state.generatedComponent.targetDefinition = { url };
  else state.generatedComponent.targetDefinition.url = url;
  if (!state.theme.targetDefinition) state.theme.targetDefinition = { url };
  else state.theme.targetDefinition.url = url;

  return { rebuildComponentTree: !hasAuthoredComponentTree(state.component), clearHistory: false };
});

/**
 * Merge a definition fragment into the current project as a nested group.
 *
 * Imports items from an external definition into the current project's
 * item tree. Items can be appended to the root or inserted into a specific
 * group via `targetGroupPath`. An optional `keyPrefix` prevents key
 * collisions when merging items from different sources.
 *
 * Triggers a component tree rebuild because the definition structure changes.
 *
 * @param payload.definition - The definition fragment containing items to merge.
 * @param payload.targetGroupPath - Dot-delimited path to the group to append
 *   items into (e.g. `"section1.details"`). Omit to append at root level.
 * @param payload.keyPrefix - String prepended to each imported item's key
 *   to avoid collisions (e.g. `"imported_"`).
 * @throws Error if `targetGroupPath` references a non-existent group.
 */
registerHandler('project.importSubform', (state, payload) => {
  const { definition, targetGroupPath, keyPrefix } = payload as {
    definition: any; targetGroupPath?: string; keyPrefix?: string;
  };

  const items = definition.items as FormspecItem[];
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
});

/**
 * Load an extension registry document into the project.
 *
 * Registries provide extension definitions that are used for constraint
 * resolution during validation (e.g. resolving `x-formspec-url` patterns).
 * Entries are pre-indexed into a Map keyed by entry name for O(1) lookup.
 *
 * Multiple registries can be loaded; they are appended to the registries array.
 *
 * @param payload.registry - The extension registry document. Must contain
 *   `url` (string) and optionally `entries` (array of registry entries).
 */
registerHandler('project.loadRegistry', (state, payload) => {
  const { registry } = payload as { registry: any };

  const catalog = new Map<string, unknown>();
  for (const entry of registry.entries ?? []) {
    catalog.set(entry.name, entry);
  }

  state.extensions.registries.push({
    url: registry.url,
    document: registry,
    catalog: { entries: catalog },
  });

  return { rebuildComponentTree: false };
});

/**
 * Unload a previously loaded extension registry by its URL.
 *
 * Removes the registry from the project's extensions state. Any extensions
 * that depended on entries from this registry will become unresolved and
 * produce `UNRESOLVED_EXTENSION` diagnostics.
 *
 * @param payload.url - The URL of the registry to remove.
 */
registerHandler('project.removeRegistry', (state, payload) => {
  const { url } = payload as { url: string };
  state.extensions.registries = state.extensions.registries.filter(r => r.url !== url);
  return { rebuildComponentTree: false };
});

/**
 * Snapshot the current definition as a versioned release.
 *
 * Sets the definition's version, deep-clones the current definition state
 * as a release snapshot, and updates the versioning baseline for future
 * diff/changelog generation. The release record includes a timestamp and
 * optional changelog summary.
 *
 * @param payload.version - Semver version string for this release (e.g. `"1.2.0"`).
 * @param payload.summary - Optional human-readable changelog summary.
 */
registerHandler('project.publish', (state, payload) => {
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
});
