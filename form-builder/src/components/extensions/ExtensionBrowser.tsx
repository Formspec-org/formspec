import type { Signal } from '@preact/signals';
import { useMemo, useState } from 'preact/hooks';
import {
  loadExtensionRegistry,
  removeExtensionRegistry
} from '../../state/mutations';
import { buildExtensionCatalog } from '../../state/extensions';
import type {
  ExtensionEntryCategory,
  ExtensionEntryStatus,
  ExtensionRegistryEntry,
  ProjectState
} from '../../state/project';
import { RegistryLoader } from './RegistryLoader';

export interface ExtensionBrowserProps {
  project: Signal<ProjectState>;
}

type ExtensionCategoryFilter = 'all' | ExtensionEntryCategory;

interface RegistryEntryView {
  registryId: string;
  registryLabel: string;
  publisherName: string;
  entry: ExtensionRegistryEntry;
}

const ENTRY_CATEGORIES: ExtensionEntryCategory[] = [
  'dataType',
  'function',
  'constraint',
  'property',
  'namespace'
];

export function ExtensionBrowser(props: ExtensionBrowserProps) {
  const [categoryFilter, setCategoryFilter] = useState<ExtensionCategoryFilter>('all');
  const registries = props.project.value.extensions.registries;
  const catalog = useMemo(() => buildExtensionCatalog(registries), [registries]);

  const entries = useMemo(() => {
    const flat: RegistryEntryView[] = [];

    for (const registry of registries) {
      const publisherName = registry.document.publisher?.name ?? 'Unknown publisher';
      for (const entry of registry.document.entries ?? []) {
        flat.push({
          registryId: registry.id,
          registryLabel: registry.sourceLabel,
          publisherName,
          entry
        });
      }
    }

    return flat.sort((left, right) => {
      const byCategory = left.entry.category.localeCompare(right.entry.category);
      if (byCategory !== 0) {
        return byCategory;
      }

      const byName = left.entry.name.localeCompare(right.entry.name);
      if (byName !== 0) {
        return byName;
      }

      return right.entry.version.localeCompare(left.entry.version);
    });
  }, [registries]);

  const filteredEntries = useMemo(() => {
    if (categoryFilter === 'all') {
      return entries;
    }
    return entries.filter((entry) => entry.entry.category === categoryFilter);
  }, [categoryFilter, entries]);

  const handleLoad = async (payload: unknown, sourceType: 'url' | 'file', sourceLabel: string) => {
    loadExtensionRegistry(props.project, {
      payload,
      sourceType,
      sourceLabel
    });
  };

  return (
    <div class="extension-browser" data-testid="extensions-browser">
      <p class="extension-browser__title">Extension Registry</p>
      <p class="inspector-hint">
        Load registry documents to expose custom data types, FEL functions, and validation constraints.
      </p>

      <RegistryLoader onLoad={handleLoad} />

      <div class="extension-browser__summary" data-testid="extension-summary">
        <span data-testid="extension-summary-datatypes">Data types: {catalog.dataTypes.length}</span>
        <span data-testid="extension-summary-functions">Functions: {catalog.functions.length}</span>
        <span data-testid="extension-summary-constraints">Constraints: {catalog.constraints.length}</span>
      </div>

      <div class="extension-browser__registries" data-testid="extension-registry-list">
        {registries.length === 0 ? <p class="inspector-hint">No registries loaded.</p> : null}
        {registries.map((registry, index) => (
          <article
            class="extension-browser__registry-card"
            data-testid={`extension-registry-card-${index}`}
            key={registry.id}
          >
            <div>
              <p class="extension-browser__registry-name">{registry.sourceLabel}</p>
              <p class="extension-browser__registry-meta">
                {registry.document.publisher.name} • {registry.document.entries.length} entries
              </p>
            </div>
            <button
              type="button"
              class="extension-browser__remove"
              data-testid={`extension-registry-remove-${index}`}
              onClick={() => {
                removeExtensionRegistry(props.project, registry.id);
              }}
            >
              Remove
            </button>
          </article>
        ))}
      </div>

      {entries.length > 0 ? (
        <label class="inspector-control">
          <span class="inspector-control__label">Category filter</span>
          <select
            class="inspector-input"
            data-testid="extension-category-filter"
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter((event.currentTarget as HTMLSelectElement).value as ExtensionCategoryFilter);
            }}
          >
            <option value="all">All</option>
            {ENTRY_CATEGORIES.map((category) => (
              <option value={category} key={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {filteredEntries.length > 0 ? (
        <div class="extension-browser__entries" data-testid="extension-entry-list">
          {filteredEntries.map((entryView) => (
            <article
              class="extension-browser__entry"
              data-testid={`extension-entry-${entryView.entry.name}-${entryView.entry.version}`}
              key={`${entryView.registryId}-${entryView.entry.name}-${entryView.entry.version}`}
            >
              <div class="extension-browser__entry-header">
                <div>
                  <p class="extension-browser__entry-name">{entryView.entry.name}</p>
                  <p class="extension-browser__entry-meta">
                    {entryView.entry.category} • v{entryView.entry.version} • {entryView.registryLabel} • {entryView.publisherName}
                  </p>
                </div>
                <span
                  class={`extension-status-badge ${resolveStatusClassName(entryView.entry.status)}`}
                  data-testid={`extension-entry-status-${entryView.entry.name}`}
                >
                  {entryView.entry.status}
                </span>
              </div>
              <p class="extension-browser__entry-description">{entryView.entry.description}</p>
              {entryView.entry.status === 'deprecated' && entryView.entry.deprecationNotice ? (
                <p class="extension-browser__entry-note">{entryView.entry.deprecationNotice}</p>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function resolveStatusClassName(status: ExtensionEntryStatus): string {
  if (status === 'stable') {
    return 'is-stable';
  }
  if (status === 'deprecated') {
    return 'is-deprecated';
  }
  if (status === 'retired') {
    return 'is-retired';
  }
  return 'is-draft';
}
