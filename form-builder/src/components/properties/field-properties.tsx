import type { ComponentChildren } from 'preact';
import type { FormspecItem } from 'formspec-engine';
import { findItemByKey, updateDefinition } from '../../state/definition';
import { project, updateThemeSelector, updateFieldMapping } from '../../state/project';

import { useState } from 'preact/hooks';

type Tab = 'general' | 'data' | 'styles' | 'connections';

export function FieldProperties({ item }: { item: FormspecItem }) {
  const [activeTab, setActiveTab] = useState<Tab>('general');

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
        Field Properties
      </div>

      <div class="properties-sub-tabs" role="tablist">
        <button
          role="tab"
          class={`properties-sub-tab ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => { setActiveTab('general'); }}
        >
          General
        </button>
        <button
          role="tab"
          class={`properties-sub-tab ${activeTab === 'data' ? 'active' : ''}`}
          onClick={() => { setActiveTab('data'); }}
        >
          Data & Validation
        </button>
        <button
          role="tab"
          class={`properties-sub-tab ${activeTab === 'styles' ? 'active' : ''}`}
          onClick={() => { setActiveTab('styles'); }}
        >
          Styles
        </button>
        <button
          role="tab"
          class={`properties-sub-tab ${activeTab === 'connections' ? 'active' : ''}`}
          onClick={() => { setActiveTab('connections'); }}
        >
          Connections
        </button>
      </div>

      <div class="properties-tab-content">
        {activeTab === 'general' && (
          <div class="tab-pane">
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
            <PropertyRow label="Placeholder">
              <input
                class="studio-input"
                value={String((item as Record<string, unknown>).placeholder ?? '')}
                onInput={(event) => updateField('placeholder', (event.target as HTMLInputElement).value)}
              />
            </PropertyRow>
            <PropertyRow label="Relevant (Conditional)">
              <input
                class="studio-input studio-input-mono"
                value={item.relevant || ''}
                placeholder="FEL expression"
                onInput={(event) => updateField('relevant', (event.target as HTMLInputElement).value)}
              />
            </PropertyRow>
          </div>
        )}

        {activeTab === 'data' && (
          <div class="tab-pane">
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

            <div class="section-title">Validation Rule</div>
            <PropertyRow label="Constraint">
              <input
                class="studio-input studio-input-mono"
                value={item.constraint || ''}
                placeholder="FEL expression"
                onInput={(event) => updateField('constraint', (event.target as HTMLInputElement).value)}
              />
            </PropertyRow>
            <PropertyRow label="Error Message">
              <input
                class="studio-input"
                value={item.message || ''}
                placeholder="Validation error message"
                onInput={(event) => updateField('message', (event.target as HTMLInputElement).value)}
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
          </div>
        )}

        {activeTab === 'styles' && (() => {
          const themeObj = project.value.theme as any;
          const selectorName = `#${item.key}`;
          const currentRule = themeObj?.selectors?.find((s: any) => s.selector === selectorName);
          const currentCss = currentRule?.css || '';

          return (
            <div class="tab-pane">
              <div class="section-title">Visual Overrides</div>
              <PropertyRow label="Custom CSS for this field">
                <textarea
                  class="studio-input studio-input-mono"
                  rows={4}
                  value={currentCss}
                  placeholder="e.g. background-color: #f0f0f0;"
                  onInput={(event) => {
                    updateThemeSelector(selectorName, (event.target as HTMLTextAreaElement).value);
                  }}
                />
              </PropertyRow>
              <div class="properties-empty" style={{ paddingTop: '12px' }}>
                Note: In a full no-code version, this would be a visual color picker and spacing controls mapping to theme selectors.
              </div>
            </div>
          );
        })()}

        {activeTab === 'connections' && (() => {
          const mappingObj = project.value.mapping as any;
          const currentRule = mappingObj?.rules?.find((r: any) => r.source === item.key);
          const currentTarget = currentRule?.target || '';

          return (
            <div class="tab-pane">
              <div class="section-title">Data Binding</div>
              <PropertyRow label="Map to Target Field">
                <input
                  class="studio-input studio-input-mono"
                  value={currentTarget}
                  placeholder="e.g. user.firstName"
                  onInput={(event) => {
                    updateFieldMapping(item.key, { target: (event.target as HTMLInputElement).value });
                  }}
                />
              </PropertyRow>
              <div class="properties-empty" style={{ paddingTop: '12px' }}>
                This data will be synchronized according to the global mapping adapter.
              </div>
            </div>
          );
        })()}
      </div>
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
