import { useState, useEffect } from 'react';
import { Header } from './Header';
import { StatusBar } from './StatusBar';
import { Blueprint } from './Blueprint';
import { StructureTree } from './blueprint/StructureTree';
import { EditorCanvas } from '../workspaces/editor/EditorCanvas';
import { ItemProperties } from '../workspaces/editor/ItemProperties';
import { LogicTab } from '../workspaces/logic/LogicTab';
import { DataTab } from '../workspaces/data/DataTab';
import { ThemeTab } from '../workspaces/theme/ThemeTab';
import { MappingTab } from '../workspaces/mapping/MappingTab';
import { PreviewTab } from '../workspaces/preview/PreviewTab';
import { CommandPalette } from './CommandPalette';
import { ImportDialog } from './ImportDialog';
import { handleKeyboardShortcut } from '../lib/keyboard';
import { useProject } from '../state/useProject';
import { useSelection } from '../state/useSelection';

const WORKSPACES: Record<string, React.FC> = {
  Editor: EditorCanvas,
  Logic: LogicTab,
  Data: DataTab,
  Theme: ThemeTab,
  Mapping: MappingTab,
  Preview: PreviewTab,
};

export function Shell() {
  const [activeTab, setActiveTab] = useState<string>('Editor');
  const [activeSection, setActiveSection] = useState<string>('Structure');
  const [showPalette, setShowPalette] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const WorkspaceComponent = WORKSPACES[activeTab];
  const project = useProject();
  const { deselect } = useSelection();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      handleKeyboardShortcut(event, {
        undo: () => project.undo(),
        redo: () => project.redo(),
        delete: () => {},
        escape: () => { setShowPalette(false); deselect(); },
        search: () => setShowPalette(true),
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [project, deselect]);

  return (
    <div data-testid="shell" className="h-screen flex flex-col bg-bg-default text-ink font-ui">
      <Header activeTab={activeTab} onTabChange={setActiveTab} onImport={() => setShowImport(true)} />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 border-r border-border bg-surface overflow-y-auto flex flex-col">
          <Blueprint activeSection={activeSection} onSectionChange={setActiveSection} />
          {activeSection === 'Structure' && <StructureTree />}
        </aside>
        <main className="flex-1 overflow-y-auto p-4">
          <div
            data-testid={`workspace-${activeTab}`}
            data-workspace={activeTab}
            onClick={(e) => {
              // Deselect when clicking directly on the workspace background, not on a child item
              if (e.target === e.currentTarget) deselect();
            }}
          >
            {WorkspaceComponent ? <WorkspaceComponent /> : activeTab}
          </div>
        </main>
        <aside className="w-72 border-l border-border bg-surface overflow-y-auto" data-testid="properties">
          <ItemProperties />
        </aside>
      </div>
      <StatusBar />
      <CommandPalette open={showPalette} onClose={() => setShowPalette(false)} />
      <ImportDialog open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
