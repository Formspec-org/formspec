import type { ComponentChildren } from 'preact';
import { definition, updateDefinition } from '../../state/definition';

export function RootProperties() {
  const def = definition.value;

  function updateRoot(field: string, value: string) {
    updateDefinition((draft) => {
      (draft as Record<string, unknown>)[field] = value ? value : undefined;
    });
  }

  return (
    <div class="properties-content">
      <div class="property-type-header">
        <span
          class="tree-node-dot"
          style={{
            background: 'var(--accent)',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            display: 'inline-block',
          }}
        />
        Form Metadata
      </div>

      <div class="section-title">Document</div>
      <PropertyRow label="URL">
        <input
          class="studio-input studio-input-mono"
          value={def.url}
          onInput={(event) => updateRoot('url', (event.target as HTMLInputElement).value)}
        />
      </PropertyRow>
      <PropertyRow label="Title">
        <input
          class="studio-input"
          value={def.title}
          onInput={(event) => updateRoot('title', (event.target as HTMLInputElement).value)}
        />
      </PropertyRow>
      <PropertyRow label="Version">
        <input
          class="studio-input studio-input-mono"
          value={def.version}
          onInput={(event) => updateRoot('version', (event.target as HTMLInputElement).value)}
        />
      </PropertyRow>
      <PropertyRow label="Description">
        <input
          class="studio-input"
          value={String((def as Record<string, unknown>).description ?? '')}
          onInput={(event) => updateRoot('description', (event.target as HTMLInputElement).value)}
        />
      </PropertyRow>
      <PropertyRow label="Status">
        <select
          class="studio-select"
          value={String((def as Record<string, unknown>).status ?? 'draft')}
          onChange={(event) => updateRoot('status', (event.target as HTMLSelectElement).value)}
        >
          <option value="draft">draft</option>
          <option value="active">active</option>
          <option value="deprecated">deprecated</option>
        </select>
      </PropertyRow>
    </div>
  );
}

function PropertyRow({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div class="property-row">
      <label class="property-label">{label}</label>
      {children}
    </div>
  );
}
