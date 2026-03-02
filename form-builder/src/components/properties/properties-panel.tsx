import { signal } from '@preact/signals';
import { definitionVersion, findItemByKey } from '../../state/definition';
import { diagnosticCounts, diagnostics } from '../../state/project';
import { selectedPath } from '../../state/selection';
import { FieldProperties } from './field-properties';
import { GroupProperties } from './group-properties';
import { RootProperties } from './root-properties';

type PropertiesTab = 'properties' | 'diagnostics';
const activeTab = signal<PropertiesTab>('properties');

export function PropertiesPanel({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  if (collapsed) {
    return (
      <button class="properties-toggle-btn" onClick={onToggle} title="Open properties panel">
        ◀
      </button>
    );
  }

  return (
    <div class="studio-properties">
      <div class="properties-header">
        <div class="properties-tabs" role="tablist">
          <button
            role="tab"
            class={`properties-tab ${activeTab.value === 'properties' ? 'active' : ''}`}
            onClick={() => {
              activeTab.value = 'properties';
            }}
            aria-selected={activeTab.value === 'properties'}
          >
            Properties
          </button>
          <button
            role="tab"
            class={`properties-tab ${activeTab.value === 'diagnostics' ? 'active' : ''}`}
            onClick={() => {
              activeTab.value = 'diagnostics';
            }}
            aria-selected={activeTab.value === 'diagnostics'}
          >
            Diagnostics
            {diagnosticCounts.value.error > 0 && (
              <span class="diagnostics-badge">{diagnosticCounts.value.error}</span>
            )}
          </button>
        </div>
        <button class="properties-close" onClick={onToggle} title="Close panel">
          ×
        </button>
      </div>

      <div class="properties-body" role="tabpanel">
        {activeTab.value === 'properties' ? <PropertiesContent /> : <DiagnosticsContent />}
      </div>
    </div>
  );
}

function PropertiesContent() {
  definitionVersion.value;
  const path = selectedPath.value;

  if (path === null) {
    return <div class="properties-empty">Select an item to edit its properties</div>;
  }

  if (path === '') {
    return <RootProperties />;
  }

  const found = findItemByKey(path);
  if (!found) {
    return <div class="properties-empty">Item not found</div>;
  }

  if (found.item.type === 'group') {
    return <GroupProperties item={found.item} />;
  }

  return <FieldProperties item={found.item} />;
}

function DiagnosticsContent() {
  const current = diagnostics.value;
  const counts = diagnosticCounts.value;

  if (current.length === 0) {
    return (
      <div class="diagnostics-empty">
        <span class="diagnostics-check">✓</span>
        <span>No issues found</span>
      </div>
    );
  }

  return (
    <div class="diagnostics-list">
      <div class="diagnostics-summary">
        {counts.error > 0 && <span class="diagnostics-pill error">{counts.error} errors</span>}
        {counts.warning > 0 && (
          <span class="diagnostics-pill warning">{counts.warning} warnings</span>
        )}
        {counts.info > 0 && <span class="diagnostics-pill info">{counts.info} info</span>}
      </div>

      {current.map((diag, index) => (
        <div
          key={`${diag.path}-${index}`}
          class="diagnostics-row"
          onClick={() => {
            if (diag.path) {
              selectedPath.value = diag.path;
            }
          }}
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
