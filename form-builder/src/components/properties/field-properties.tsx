import type { ComponentChildren } from 'preact';
import type { FormspecItem } from 'formspec-engine';
import { findItemByKey, updateDefinition } from '../../state/definition';

export function FieldProperties({ item }: { item: FormspecItem }) {
  function updateField(field: string, value: string) {
    updateDefinition((def) => {
      const found = findItemByKey(item.key, def.items);
      if (!found) {
        return;
      }
      const draft = found.item as Record<string, unknown>;
      draft[field] = value ? value : undefined;
    });
  }

  return (
    <div class="properties-content">
      <div class="property-type-header">
        <span
          class="tree-node-dot"
          style={{
            background: '#D4A34A',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            display: 'inline-block',
          }}
        />
        Field
      </div>

      <div class="section-title">Identity</div>
      <PropertyRow label="Key">
        <input
          class="studio-input studio-input-mono"
          value={item.key}
          onInput={(event) => updateField('key', (event.target as HTMLInputElement).value)}
        />
      </PropertyRow>
      <PropertyRow label="Label">
        <input
          class="studio-input"
          value={item.label || ''}
          onInput={(event) => updateField('label', (event.target as HTMLInputElement).value)}
        />
      </PropertyRow>

      <div class="section-title">Data</div>
      <PropertyRow label="Data Type">
        <select
          class="studio-select"
          value={item.dataType || 'string'}
          onChange={(event) => updateField('dataType', (event.target as HTMLSelectElement).value)}
        >
          <option value="string">string</option>
          <option value="text">text</option>
          <option value="integer">integer</option>
          <option value="decimal">decimal</option>
          <option value="number">number</option>
          <option value="boolean">boolean</option>
          <option value="date">date</option>
          <option value="dateTime">dateTime</option>
          <option value="time">time</option>
          <option value="choice">choice</option>
          <option value="multiChoice">multiChoice</option>
          <option value="money">money</option>
          <option value="uri">uri</option>
          <option value="attachment">attachment</option>
        </select>
      </PropertyRow>
      <PropertyRow label="Placeholder">
        <input
          class="studio-input"
          value={String((item as Record<string, unknown>).placeholder ?? '')}
          onInput={(event) => updateField('placeholder', (event.target as HTMLInputElement).value)}
        />
      </PropertyRow>

      <div class="section-title">Behavior</div>
      <PropertyRow label="Relevant">
        <input
          class="studio-input studio-input-mono"
          value={item.relevant || ''}
          placeholder="FEL expression"
          onInput={(event) => updateField('relevant', (event.target as HTMLInputElement).value)}
        />
      </PropertyRow>
      <PropertyRow label="Required">
        <input
          class="studio-input studio-input-mono"
          value={typeof item.required === 'string' ? item.required : ''}
          placeholder="FEL expression or true()"
          onInput={(event) => updateField('required', (event.target as HTMLInputElement).value)}
        />
      </PropertyRow>
      <PropertyRow label="Read Only">
        <input
          class="studio-input studio-input-mono"
          value={typeof item.readonly === 'string' ? item.readonly : ''}
          placeholder="FEL expression"
          onInput={(event) => updateField('readonly', (event.target as HTMLInputElement).value)}
        />
      </PropertyRow>
      <PropertyRow label="Calculate">
        <input
          class="studio-input studio-input-mono"
          value={item.calculate || ''}
          placeholder="FEL expression"
          onInput={(event) => updateField('calculate', (event.target as HTMLInputElement).value)}
        />
      </PropertyRow>

      <div class="section-title">Validation</div>
      <PropertyRow label="Constraint">
        <input
          class="studio-input studio-input-mono"
          value={item.constraint || ''}
          placeholder="FEL expression"
          onInput={(event) => updateField('constraint', (event.target as HTMLInputElement).value)}
        />
      </PropertyRow>
      <PropertyRow label="Message">
        <input
          class="studio-input"
          value={item.message || ''}
          placeholder="Validation error message"
          onInput={(event) => updateField('message', (event.target as HTMLInputElement).value)}
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
