import { useState, useEffect, useRef } from 'preact/hooks';
import { addPickerState } from '../../state/selection';
import { getCatalogByCategory, getCategoryColor, searchCatalog } from '../../logic/add-picker-catalog';
import type { AddPickerEntry, ComponentNode } from '../../types';
import { definition, updateDefinition } from '../../state/definition';

interface AddPickerProps {
    parentPath: string;
    insertIndex: number;
    onAdd: (node: ComponentNode) => void;
    onCancel: () => void;
}

export function AddPicker({ parentPath, insertIndex, onAdd, onCancel }: AddPickerProps) {
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<AddPickerEntry | null>(null);
    const [labelValue, setLabelValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const labelRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (selected && labelRef.current) {
            labelRef.current.focus();
        }
    }, [selected]);

    const catalogByCategory = query ? { results: searchCatalog(query) } : getCatalogByCategory();
    const isSearchMode = 'results' in catalogByCategory;

    function handleSelect(entry: AddPickerEntry) {
        if (entry.promptForLabel) {
            setSelected(entry);
            setLabelValue(entry.label);
        } else {
            commitAdd(entry, entry.label);
        }
    }

    function commitAdd(entry: AddPickerEntry, label: string) {
        const key = label.replace(/[^a-zA-Z0-9]/g, '').replace(/^./, (c) => c.toLowerCase()) || 'field';

        // Create definition item if needed
        if (entry.createsDefinitionItem) {
            updateDefinition((def) => {
                const newItem: Record<string, unknown> = {
                    key,
                    type: entry.definitionType ?? 'field',
                    label,
                };
                if (entry.defaultDataType) {
                    newItem.dataType = entry.defaultDataType;
                }
                def.items.push(newItem as any);
            });
        }

        const node: ComponentNode = {
            component: entry.component,
            ...(entry.createsDefinitionItem ? { bind: key } : {}),
            ...(entry.promptForLabel && !entry.createsDefinitionItem ? { title: label } : {}),
        };

        onAdd(node);
    }

    function handleLabelSubmit() {
        if (selected && labelValue.trim()) {
            commitAdd(selected, labelValue.trim());
        }
    }

    return (
        <div class="add-picker-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
            <div class="add-picker">
                <div class="add-picker-search">
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search components..."
                        value={query}
                        onInput={(e) => {
                            setQuery((e.target as HTMLInputElement).value);
                            setSelected(null);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') onCancel();
                        }}
                    />
                </div>
                <div class="add-picker-body">
                    {isSearchMode ? (
                        (catalogByCategory as { results: AddPickerEntry[] }).results.map((entry) => (
                            <div
                                key={entry.component}
                                class="add-picker-item"
                                onClick={() => handleSelect(entry)}
                            >
                                <span class="add-picker-item-dot" style={{ background: getCategoryColor(entry.category) }} />
                                <span class="add-picker-item-label">{entry.label}</span>
                                <span class="add-picker-item-type">{entry.component}</span>
                            </div>
                        ))
                    ) : (
                        Object.entries(catalogByCategory as Record<string, AddPickerEntry[]>).map(
                            ([category, entries]) =>
                                entries.length > 0 && (
                                    <div key={category} class="add-picker-category">
                                        <div class="add-picker-category-title">{category}</div>
                                        {entries.map((entry) => (
                                            <div
                                                key={entry.component}
                                                class="add-picker-item"
                                                onClick={() => handleSelect(entry)}
                                            >
                                                <span class="add-picker-item-dot" style={{ background: getCategoryColor(entry.category) }} />
                                                <span class="add-picker-item-label">{entry.label}</span>
                                                <span class="add-picker-item-type">{entry.component}</span>
                                            </div>
                                        ))}
                                    </div>
                                ),
                        )
                    )}
                </div>
                {selected && (
                    <div class="add-picker-label-prompt">
                        <input
                            ref={labelRef}
                            type="text"
                            placeholder="Enter label..."
                            value={labelValue}
                            onInput={(e) => setLabelValue((e.target as HTMLInputElement).value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleLabelSubmit();
                                if (e.key === 'Escape') { setSelected(null); inputRef.current?.focus(); }
                            }}
                        />
                        <button class="btn-primary" onClick={handleLabelSubmit}>Add</button>
                    </div>
                )}
            </div>
        </div>
    );
}
