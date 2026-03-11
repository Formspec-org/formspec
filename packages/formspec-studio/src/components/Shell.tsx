import { useState } from 'react';
import { Header } from './Header';
import { StatusBar } from './StatusBar';
import { Blueprint } from './Blueprint';
import { EditorCanvas } from '../workspaces/editor/EditorCanvas';
import { ItemProperties } from '../workspaces/editor/ItemProperties';
import { LogicTab } from '../workspaces/logic/LogicTab';
import { DataTab } from '../workspaces/data/DataTab';
import { ThemeTab } from '../workspaces/theme/ThemeTab';
import { MappingTab } from '../workspaces/mapping/MappingTab';
import { PreviewTab } from '../workspaces/preview/PreviewTab';

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
  const WorkspaceComponent = WORKSPACES[activeTab];

  return (
    <div data-testid="shell" className="h-screen flex flex-col bg-bg-default text-ink font-ui">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 border-r border-border bg-surface overflow-y-auto">
          <Blueprint activeSection={activeSection} onSectionChange={setActiveSection} />
        </aside>
        <main className="flex-1 overflow-y-auto p-4">
          <div data-testid={`workspace-${activeTab}`} data-workspace={activeTab}>
            {WorkspaceComponent ? <WorkspaceComponent /> : activeTab}
          </div>
        </main>
        <aside className="w-72 border-l border-border bg-surface overflow-y-auto" data-testid="properties">
          <ItemProperties />
        </aside>
      </div>
      <StatusBar />
    </div>
  );
}
