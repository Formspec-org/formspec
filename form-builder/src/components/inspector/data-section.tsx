import type { FormspecItem } from 'formspec-engine';
import { useState } from 'preact/hooks';
import { updateDefinition, findItemByKey } from '../../state/definition';

export function DataSection({ item }: { item: FormspecItem }) {
    function updateField(field: string, value: unknown) {
        updateDefinition((def) => {
            const found = findItemByKey(item.key, def.items);
            if (!found) return;
            const draft = found.item as Record<string, unknown>;
            if (value === '' || value === null || value === undefined) {
                draft[field] = undefined;
                return;
            }
            draft[field] = value;
        });
    }

    const isChoice = item.dataType === 'choice' || item.dataType === 'multiChoice';
    const rawOptions = (item as Record<string, unknown>).options;
    const options = Array.isArray(rawOptions) ? rawOptions as { value: string; label?: string }[] : [];

    function addOption() {
        updateDefinition((def) => {
            const found = findItemByKey(item.key, def.items);
            if (!found) return;
            const draft = found.item as Record<string, unknown>;
            const current = Array.isArray(draft.options) ? draft.options : [];
            draft.options = [...current, { value: '', label: '' }];
        });
    }

    function updateOption(index: number, field: 'value' | 'label', val: string) {
        updateDefinition((def) => {
            const found = findItemByKey(item.key, def.items);
            if (!found) return;
            const draft = found.item as Record<string, unknown>;
            const current = (draft.options as { value: string; label?: string }[]) ?? [];
            draft.options = current.map((opt, i) => (i === index ? { ...opt, [field]: val } : opt));
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
        <>
            <div class="section-title">Data</div>
            <div class="property-row">
                <label class="property-label">Data Type</label>
                <select
                    class="studio-select"
                    value={item.dataType || 'string'}
                    onChange={(e) => updateField('dataType', (e.target as HTMLSelectElement).value)}
                >
                    <option value="string">string</option>
                    <option value="text">text</option>
                    <option value="integer">integer</option>
                    <option value="decimal">decimal</option>
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
            </div>
            <div class="property-row">
                <label class="property-label">Placeholder</label>
                <input
                    class="studio-input"
                    value={String((item as Record<string, unknown>).placeholder ?? '')}
                    placeholder="Placeholder text"
                    onInput={(e) => updateField('placeholder', (e.target as HTMLInputElement).value)}
                />
            </div>

            {isChoice && (
                <div class="options-editor">
                    <div class="section-title">Options</div>
                    {options.map((opt, i) => (
                        <div class="option-row" key={i}>
                            <input
                                class="studio-input studio-input-mono"
                                value={opt.value}
                                placeholder="value"
                                aria-label={`Option ${i + 1} value`}
                                onInput={(e) => updateOption(i, 'value', (e.target as HTMLInputElement).value)}
                            />
                            <input
                                class="studio-input"
                                value={opt.label ?? ''}
                                placeholder="label"
                                aria-label={`Option ${i + 1} label`}
                                onInput={(e) => updateOption(i, 'label', (e.target as HTMLInputElement).value)}
                            />
                            <button
                                class="btn-ghost option-remove-btn"
                                aria-label={`Remove option ${i + 1}`}
                                onClick={() => removeOption(i)}
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                    <button class="tree-add-btn" onClick={addOption}>+ Add Option</button>
                </div>
            )}
        </>
    );
}
