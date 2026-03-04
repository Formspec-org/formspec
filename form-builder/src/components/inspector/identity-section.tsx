import type { FormspecItem } from 'formspec-engine';
import { updateDefinition, findItemByKey } from '../../state/definition';
import { componentDoc, setComponentDoc } from '../../state/project';
import { selectedPath } from '../../state/selection';
import { resolveNode } from '../../logic/component-tree';
import { updateNodeProps } from '../../logic/component-tree-ops';

export function IdentitySection({ item }: { item: FormspecItem }) {
    function updateField(field: string, value: unknown) {
        updateDefinition((def) => {
            const found = findItemByKey(field === 'key' ? item.key : item.key, def.items);
            if (!found) return;
            const draft = found.item as Record<string, unknown>;
            if (value === '' || value === null || value === undefined) {
                draft[field] = undefined;
                return;
            }
            draft[field] = value;
        });
    }

    function handleKeyChange(newKey: string) {
        const oldKey = item.key;
        updateDefinition((def) => {
            const found = findItemByKey(oldKey, def.items);
            if (!found) return;
            (found.item as Record<string, unknown>).key = newKey;
        });

        // Sync component tree bind
        const doc = componentDoc.value;
        const path = selectedPath.value;
        if (doc && path) {
            const node = resolveNode(doc.tree, path);
            if (node?.bind === oldKey) {
                const newTree = updateNodeProps(doc.tree, path, { bind: newKey });
                setComponentDoc({ ...doc, tree: newTree });
            }
        }
    }

    return (
        <>
            <div class="section-title">Identity</div>
            <div class="property-row">
                <label class="property-label">Key</label>
                <input
                    class="studio-input studio-input-mono"
                    value={item.key}
                    onInput={(e) => handleKeyChange((e.target as HTMLInputElement).value)}
                />
            </div>
            <div class="property-row">
                <label class="property-label">Label</label>
                <input
                    class="studio-input"
                    value={item.label || ''}
                    onInput={(e) => updateField('label', (e.target as HTMLInputElement).value)}
                />
            </div>
            <div class="property-row">
                <label class="property-label">Description</label>
                <input
                    class="studio-input"
                    value={item.description || ''}
                    placeholder="Optional description"
                    onInput={(e) => updateField('description', (e.target as HTMLInputElement).value)}
                />
            </div>
            <div class="property-row">
                <label class="property-label">Hint</label>
                <input
                    class="studio-input"
                    value={item.hint || ''}
                    placeholder="Hint text for users"
                    onInput={(e) => updateField('hint', (e.target as HTMLInputElement).value)}
                />
            </div>
        </>
    );
}
