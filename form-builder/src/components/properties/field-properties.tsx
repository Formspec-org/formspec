import type { ComponentChildren } from 'preact';
import type { FormspecItem } from 'formspec-engine';
import { findItemByKey, updateDefinition } from '../../state/definition';
import { FelExpressionInput } from './fel-expression-input';
import { FelHelper } from './fel-helper';

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

  const isChoice = item.dataType === 'choice' || item.dataType === 'multiChoice';
  const options = (item as Record<string, unknown>).options as
    | { value: string; label?: string }[]
    | undefined;

  function addOption() {
    updateDefinition((def) => {
      const found = findItemByKey(item.key, def.items);
      if (!found) return;
      const draft = found.item as Record<string, unknown>;
      const current = (draft.options as { value: string; label?: string }[] | undefined) ?? [];
      draft.options = [...current, { value: '', label: '' }];
    });
  }

  function updateOption(index: number, field: 'value' | 'label', val: string) {
    updateDefinition((def) => {
      const found = findItemByKey(item.key, def.items);
      if (!found) return;
      const draft = found.item as Record<string, unknown>;
      const current = (draft.options as { value: string; label?: string }[]) ?? [];
      const updated = current.map((opt, i) =>
        i === index ? { ...opt, [field]: val } : opt,
      );
      draft.options = updated;
    });
  }

  function removeOption(index: number) {
    updateDefinition((def) => {
      const found = findItemByKey(item.key, def.items);
      if (!found) return;
      const draft = found.item as Record<string, unknown>;
      const current = (draft.options as { value: string; label?: string }[]) ?? [];
      draft.options = current.filter((_, i) => i !== index);
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

      {isChoice && (
        <div class="options-editor">
          <div class="section-title">Options</div>
          {(options ?? []).map((opt, i) => (
            <div class="option-row" key={i}>
              <input
                class="studio-input studio-input-mono option-value-input"
                value={opt.value}
                placeholder="value"
                aria-label={`Option ${i + 1} value`}
                onInput={(event) =>
                  updateOption(i, 'value', (event.target as HTMLInputElement).value)
                }
              />
              <input
                class="studio-input option-label-input"
                value={opt.label ?? ''}
                placeholder="label (optional)"
                aria-label={`Option ${i + 1} label`}
                onInput={(event) =>
                  updateOption(i, 'label', (event.target as HTMLInputElement).value)
                }
              />
              <button
                class="btn-ghost option-remove-btn"
                aria-label={`Remove option ${i + 1}`}
                onClick={() => removeOption(i)}
              >
                ×
              </button>
            </div>
          ))}
          <button class="btn-ghost add-option-btn" onClick={addOption}>
            + Add Option
          </button>
        </div>
      )}

      <div class="section-title">Behavior</div>
      <PropertyRow label={<span class="label-with-helper">Relevant <FelHelper /></span>}>
        <FelExpressionInput
          value={item.relevant || ''}
          placeholder="FEL expression"
          onValueChange={(value) => updateField('relevant', value)}
        />
      </PropertyRow>
      <PropertyRow label={<span class="label-with-helper">Required <FelHelper /></span>}>
        <FelExpressionInput
          value={typeof item.required === 'string' ? item.required : ''}
          placeholder="FEL expression or true()"
          onValueChange={(value) => updateField('required', value)}
        />
      </PropertyRow>
      <PropertyRow label={<span class="label-with-helper">Read Only <FelHelper /></span>}>
        <FelExpressionInput
          value={typeof item.readonly === 'string' ? item.readonly : ''}
          placeholder="FEL expression"
          onValueChange={(value) => updateField('readonly', value)}
        />
      </PropertyRow>
      <PropertyRow label={<span class="label-with-helper">Calculate <FelHelper /></span>}>
        <FelExpressionInput
          value={item.calculate || ''}
          placeholder="FEL expression"
          onValueChange={(value) => updateField('calculate', value)}
        />
      </PropertyRow>

      <div class="section-title">Validation</div>
      <PropertyRow label={<span class="label-with-helper">Constraint <FelHelper /></span>}>
        <FelExpressionInput
          value={item.constraint || ''}
          placeholder="FEL expression"
          onValueChange={(value) => updateField('constraint', value)}
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

function PropertyRow({ label, children }: { label: string | ComponentChildren; children: ComponentChildren }) {
  return (
    <div class="property-row">
      <label class="property-label">{label}</label>
      {children}
    </div>
  );
}
