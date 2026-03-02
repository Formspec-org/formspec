import { signal } from '@preact/signals';
import { ArtifactEditor } from './components/artifact-editor';
import { EmptyTab } from './components/empty-tab';
import { JsonEditor } from './components/json-editor';
import { Preview } from './components/preview';
import { PropertiesPanel } from './components/properties/properties-panel';
import { Sidebar } from './components/sidebar';
import { Splitter } from './components/splitter';
import { ToastContainer } from './components/toast';
import { Topbar } from './components/topbar';
import { TreeEditor } from './components/tree/tree-editor';
import { activeTool } from './components/sidebar';
import { activeArtifact, project } from './state/project';
import './state/definition';

const propertiesCollapsed = signal(false);
const splitPercent = signal(50);

export function App() {
  const artifact = activeArtifact.value;
  const isDefinition = artifact === 'definition';
  const artifactData = isDefinition ? project.value.definition : project.value[artifact];
  const showEmpty = !isDefinition && artifactData === null;

  return (
    <div class="studio-root">
      <Topbar />
      <div class="studio-workspace">
        <Sidebar />
        <div class="studio-editor">
          {activeTool.value === 'build' && (
            <>
              <div class="studio-editor-panes">
                <div
                  class="studio-tree-pane"
                  style={{ flex: `0 0 ${splitPercent.value}%` }}
                >
                  <TreeEditor />
                </div>
                <Splitter
                  onResize={(delta) => {
                    if (delta === 0) {
                      splitPercent.value = 50;
                      return;
                    }
                    const editorEl = document.querySelector('.studio-editor-panes') as HTMLElement | null;
                    if (!editorEl || editorEl.clientWidth <= 0) {
                      return;
                    }
                    const nextPercent =
                      splitPercent.value + (delta / editorEl.clientWidth) * 100;
                    splitPercent.value = Math.max(20, Math.min(80, nextPercent));
                  }}
                />
                <div class="studio-preview-pane" style={{ flex: 1 }}>
                  <Preview />
                </div>
              </div>
            </>
          )}

          {activeTool.value === 'library' && (
            <div class="studio-editor-panes" style={{ padding: '24px' }}>
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-2)', width: '100%' }}>
                <h2 style={{ color: 'var(--text-0)', marginBottom: '12px' }}>Component Library</h2>
                <p>Drag and drop reusable form components.</p>
                <div style={{ marginTop: '24px', display: 'flex', gap: '16px', justifyContent: 'center' }}>
                  <div style={{ width: '150px', height: '100px', border: '1px dashed var(--border-focus)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    Address Block
                  </div>
                  <div style={{ width: '150px', height: '100px', border: '1px dashed var(--border-focus)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    Payment Details
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTool.value === 'design' && (
            <div class="studio-editor-panes" style={{ padding: '24px' }}>
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-2)', width: '100%' }}>
                <h2 style={{ color: 'var(--text-0)', marginBottom: '12px' }}>Global Design</h2>
                <p>Configure the global theme settings for this form.</p>
                <div style={{ marginTop: '24px', maxWidth: '400px', margin: '24px auto', textAlign: 'left' }}>
                  <div class="property-row" style={{ marginBottom: '16px' }}>
                    <label class="property-label">Form Density</label>
                    <input type="range" class="studio-input" min="1" max="3" value="2" />
                  </div>
                  <div class="property-row">
                    <label class="property-label">Primary Color Config</label>
                    <input type="color" class="studio-input" value="#d4a34a" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <PropertiesPanel
          collapsed={propertiesCollapsed.value}
          onToggle={() => {
            propertiesCollapsed.value = !propertiesCollapsed.value;
          }}
        />
      </div>
      <ToastContainer />
    </div>
  );
}
