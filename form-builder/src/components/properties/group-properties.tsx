import type { ComponentChildren } from 'preact';
import type { FormspecItem } from 'formspec-engine';
import { findItemByKey, updateDefinition } from '../../state/definition';

export function GroupProperties({ item }: { item: FormspecItem }) {
  function updateGroup(field: string, value: string) {
    updateDefinition((def) => {
      const found = findItemByKey(item.key, def.items);
      if (!found) {
        return;
      }
      const draft = found.item as Record<string, unknown>;
      if (field === 'repeatable') {
        draft.repeatable = value === 'true';
        return;
      }
      if (field === 'minRepeat' || field === 'maxRepeat') {
        draft[field] = value ? Number(value) : undefined;
        return;
      }
      draft[field] = value ? value : undefined;
    });
  }

  return (
    <div class="properties-content">
      <div class="property-type-header">
        <span
          class="tree-node-dot"
          style={{
            background: '#5A8FBB',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            display: 'inline-block',
          }}
        />
        Group
      </div>

      <div class="section-title">Identity</div>
      <PropertyRow label="Key">
        <input
          class="studio-input studio-input-mono"
          value={item.key}
          onInput={(event) => updateGroup('key', (event.target as HTMLInputElement).value)}
        />
      </PropertyRow>
      <PropertyRow label="Label">
        <input
          class="studio-input"
          value={item.label || ''}
          onInput={(event) => updateGroup('label', (event.target as HTMLInputElement).value)}
        />
      </PropertyRow>

      <div class="section-title">Behavior</div>
      <PropertyRow label="Relevant">
        <input
          class="studio-input studio-input-mono"
          value={item.relevant || ''}
          placeholder="FEL expression"
          onInput={(event) => updateGroup('relevant', (event.target as HTMLInputElement).value)}
        />
      </PropertyRow>
      <PropertyRow label="Read Only">
        <input
          class="studio-input studio-input-mono"
          value={typeof item.readonly === 'string' ? item.readonly : ''}
          placeholder="FEL expression"
          onInput={(event) => updateGroup('readonly', (event.target as HTMLInputElement).value)}
        />
      </PropertyRow>

      <div class="section-title">Repeat</div>
      <PropertyRow label="Repeatable">
        <select
          class="studio-select"
          value={item.repeatable ? 'true' : 'false'}
          onChange={(event) => updateGroup('repeatable', (event.target as HTMLSelectElement).value)}
        >
          <option value="false">false</option>
          <option value="true">true</option>
        </select>
      </PropertyRow>
      <PropertyRow label="Min Repeat">
        <input
          class="studio-input"
          type="number"
          min="0"
          value={typeof item.minRepeat === 'number' ? String(item.minRepeat) : ''}
          onInput={(event) => updateGroup('minRepeat', (event.target as HTMLInputElement).value)}
        />
      </PropertyRow>
      <PropertyRow label="Max Repeat">
        <input
          class="studio-input"
          type="number"
          min="0"
          value={typeof item.maxRepeat === 'number' ? String(item.maxRepeat) : ''}
          onInput={(event) => updateGroup('maxRepeat', (event.target as HTMLInputElement).value)}
        />
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
