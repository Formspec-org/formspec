import { signal } from '@preact/signals';
import { definitionVersion, findItemByKey } from '../../state/definition';
import { componentDoc, componentVersion, diagnostics } from '../../state/project';
import { selectedPath } from '../../state/selection';
import { resolveNode, classifyNode, nodeKindColor } from '../../logic/component-tree';

import { IdentitySection } from './identity-section';
import { DataSection } from './data-section';
import { BehaviorSection } from './behavior-section';
import { ValidationSection } from './validation-section';
import { LayoutSection } from './layout-section';
import { RootSection } from './root-section';

type InspectorTab = 'properties' | 'diagnostics';
const activeTab = signal<InspectorTab>('properties');

export function InspectorPanel({
    collapsed,
    onToggle,
}: {
    collapsed: boolean;
    onToggle: () => void;
}) {
    const diags = diagnostics.value;
    const errorCount = diags.filter((d) => d.severity === 'error').length;

    if (collapsed) {
        return (
            <button class="inspector-toggle-btn" onClick={onToggle} title="Open inspector">
                ◀
            </button>
        );
    }

    return (
        <div class="inspector-panel">
            <div class="inspector-header">
                <div class="inspector-tabs" role="tablist">
                    <button
                        role="tab"
                        class={`inspector-tab${activeTab.value === 'properties' ? ' active' : ''}`}
                        onClick={() => { activeTab.value = 'properties'; }}
                        aria-selected={activeTab.value === 'properties'}
                    >
                        Inspector
                    </button>
                    <button
                        role="tab"
                        class={`inspector-tab${activeTab.value === 'diagnostics' ? ' active' : ''}`}
                        onClick={() => { activeTab.value = 'diagnostics'; }}
                        aria-selected={activeTab.value === 'diagnostics'}
                    >
                        Diagnostics
                        {errorCount > 0 && <span class="diagnostics-badge">{errorCount}</span>}
                    </button>
                </div>
                <button class="inspector-close" onClick={onToggle} title="Close inspector">×</button>
            </div>

            <div class="inspector-body" role="tabpanel">
                {activeTab.value === 'properties' ? <PropertiesContent /> : <DiagnosticsContent />}
            </div>
        </div>
    );
}

function PropertiesContent() {
    definitionVersion.value;
    componentVersion.value;

    const path = selectedPath.value;

    if (path === null) {
        return (
            <div class="inspector-empty">
                <span class="inspector-empty-icon">👆</span>
                <span>Select an item in the tree<br />to inspect its properties</span>
            </div>
        );
    }

    if (path === '') {
        return <RootSection />;
    }

    const doc = componentDoc.value;
    if (!doc) {
        return <div class="inspector-empty">No component tree loaded</div>;
    }

    const node = resolveNode(doc.tree, path);
    if (!node) {
        return <div class="inspector-empty">Node not found</div>;
    }

    const kind = classifyNode(node);
    const color = nodeKindColor(kind);

    // For bound items (fields, groups, displays), show definition properties
    if ((kind === 'bound-input' || kind === 'group' || kind === 'bound-display') && node.bind) {
        const found = findItemByKey(node.bind);
        if (found) {
            const item = found.item;
            const kindLabel = kind === 'bound-input' ? 'Field' : kind === 'group' ? 'Group' : 'Display';

            return (
                <div class="properties-content">
                    <div class="property-type-header">
                        <span class="property-type-dot" style={{ background: color }} />
                        {kindLabel} — {node.component}
                    </div>
                    <IdentitySection item={item} />
                    {kind === 'bound-input' && (
                        <>
                            <DataSection item={item} />
                            <BehaviorSection item={item} />
                            <ValidationSection item={item} />
                        </>
                    )}
                    {kind === 'group' && <BehaviorSection item={item} />}
                </div>
            );
        }
    }

    // Layout or unbound node
    return <LayoutSection node={node} path={path} />;
}

function DiagnosticsContent() {
    const diags = diagnostics.value;

    if (diags.length === 0) {
        return (
            <div class="diagnostics-empty">
                <span class="diagnostics-check">✓</span>
                <span>No issues found</span>
            </div>
        );
    }

    const errors = diags.filter((d) => d.severity === 'error');
    const warnings = diags.filter((d) => d.severity === 'warning');
    const infos = diags.filter((d) => d.severity === 'info');

    return (
        <div class="diagnostics-list">
            <div class="diagnostics-summary">
                {errors.length > 0 && <span class="diagnostics-pill error">{errors.length} error{errors.length !== 1 ? 's' : ''}</span>}
                {warnings.length > 0 && <span class="diagnostics-pill warning">{warnings.length} warning{warnings.length !== 1 ? 's' : ''}</span>}
                {infos.length > 0 && <span class="diagnostics-pill info">{infos.length} info</span>}
            </div>

            {diags.map((diag, i) => (
                <div
                    key={`${diag.path}-${i}`}
                    class="diagnostics-row"
                    onClick={() => { if (diag.path) selectedPath.value = diag.path; }}
                >
                    <span class={`diagnostics-icon ${diag.severity}`}>
                        {diag.severity === 'error' ? '●' : diag.severity === 'warning' ? '▲' : 'ℹ'}
                    </span>
                    <div>
                        <div class="diagnostics-message">{diag.message}</div>
                        {diag.path && <div class="diagnostics-path">{diag.path}</div>}
                    </div>
                </div>
            ))}
        </div>
    );
}
