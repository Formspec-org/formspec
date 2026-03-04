import type { ComponentNode } from '../../types';
import { componentDoc, setComponentDoc } from '../../state/project';
import { updateNodeProps } from '../../logic/component-tree-ops';

export function LayoutSection({ node, path }: { node: ComponentNode; path: string }) {
    function updateProp(key: string, value: unknown) {
        const doc = componentDoc.value;
        if (!doc) return;
        const newTree = updateNodeProps(doc.tree, path, { [key]: value || undefined });
        setComponentDoc({ ...doc, tree: newTree });
    }

    return (
        <div class="properties-content">
            <div class="property-type-header">
                <span class="property-type-dot" style={{ background: 'var(--color-layout)' }} />
                Layout — {node.component}
            </div>

            <div class="section-title">Properties</div>
            <div class="property-row">
                <label class="property-label">Component</label>
                <div class="property-static-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                    {node.component}
                </div>
            </div>
            {typeof node.title === 'string' && (
                <div class="property-row">
                    <label class="property-label">Title</label>
                    <input
                        class="studio-input"
                        value={node.title}
                        onInput={(e) => updateProp('title', (e.target as HTMLInputElement).value)}
                    />
                </div>
            )}
            <div class="property-row">
                <label class="property-label">CSS Class</label>
                <input
                    class="studio-input studio-input-mono"
                    value={node.cssClass ?? ''}
                    placeholder="custom-class"
                    onInput={(e) => updateProp('cssClass', (e.target as HTMLInputElement).value)}
                />
            </div>
            <div class="property-row">
                <label class="property-label">Conditional (when)</label>
                <input
                    class="studio-input studio-input-mono"
                    value={node.when ?? ''}
                    placeholder="FEL expression"
                    onInput={(e) => updateProp('when', (e.target as HTMLInputElement).value)}
                />
            </div>
        </div>
    );
}
