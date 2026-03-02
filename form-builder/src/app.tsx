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
import { activeArtifact, editorMode, project } from './state/project';
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
          {showEmpty ? (
            <EmptyTab kind={artifact} />
          ) : isDefinition ? (
            <>
              <div class="editor-mode-bar">
                <button
                  class={editorMode.value === 'guided' ? 'active' : ''}
                  onClick={() => {
                    editorMode.value = 'guided';
                  }}
                >
                  Guided
                </button>
                <button
                  class={editorMode.value === 'json' ? 'active' : ''}
                  onClick={() => {
                    editorMode.value = 'json';
                  }}
                >
                  JSON
                </button>
              </div>
              <div class="studio-editor-panes">
                <div
                  class="studio-tree-pane"
                  style={{ flex: `0 0 ${splitPercent.value}%` }}
                >
                  {editorMode.value === 'guided' ? <TreeEditor /> : <JsonEditor />}
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
          ) : (
            <ArtifactEditor kind={artifact} />
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
