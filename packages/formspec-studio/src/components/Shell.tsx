import { useState, useEffect } from 'react';
import { createProject } from 'formspec-studio-core';
import { Header } from './Header';
import { StatusBar } from './StatusBar';
import { Blueprint } from './Blueprint';
import { StructureTree } from './blueprint/StructureTree';
import { EditorCanvas } from '../workspaces/editor/EditorCanvas';
import { ItemProperties } from '../workspaces/editor/ItemProperties';
import { LogicTab } from '../workspaces/logic/LogicTab';
import { ThemeTab } from '../workspaces/theme/ThemeTab';
import { MappingTab } from '../workspaces/mapping/MappingTab';
import { PreviewTab } from '../workspaces/preview/PreviewTab';
import { CommandPalette } from './CommandPalette';
import { ImportDialog } from './ImportDialog';
import { handleKeyboardShortcut } from '../lib/keyboard';
import { CanvasTargetsProvider } from '../state/useCanvasTargets';
import { useProject } from '../state/useProject';
import { useSelection } from '../state/useSelection';

import { ComponentTree } from './blueprint/ComponentTree';
import { ScreenerSection } from './blueprint/ScreenerSection';
import { VariablesList } from './blueprint/VariablesList';
import { DataSourcesList } from './blueprint/DataSourcesList';
import { OptionSetsList } from './blueprint/OptionSetsList';
import { MappingsList } from './blueprint/MappingsList';
import { MigrationsSection } from './blueprint/MigrationsSection';

import { SettingsSection } from './blueprint/SettingsSection';
import { ThemeOverview } from './blueprint/ThemeOverview';
import { type Tab as DataWorkspaceTab, DataTab } from '../workspaces/data/DataTab';
import { type ThemeTabId } from '../workspaces/theme/ThemeTab';
import { type MappingTabId } from '../workspaces/mapping/MappingTab';
import { type Viewport } from '../workspaces/preview/ViewportSwitcher';
import { type PreviewMode } from '../workspaces/preview/PreviewTab';

const WORKSPACES: Record<string, React.FC> = {
  Editor: EditorCanvas,
  Logic: LogicTab,
  Theme: ThemeTab,
  Mapping: MappingTab,
  Preview: PreviewTab,
};

const SIDEBAR_COMPONENTS: Record<string, React.FC> = {
  'Structure': StructureTree,
  'Component Tree': ComponentTree,
  'Screener': ScreenerSection,
  'Variables': VariablesList,
  'Data Sources': DataSourcesList,
  'Option Sets': OptionSetsList,
  'Mappings': MappingsList,
  'Migrations': MigrationsSection,
  'Settings': SettingsSection,
  'Theme': ThemeOverview,
};

export function Shell() {
  const [activeTab, setActiveTab] = useState<string>('Editor');
  const [activeSection, setActiveSection] = useState<string>('Structure');
  const [showPalette, setShowPalette] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAppMenu, setShowAppMenu] = useState(false);
  const [activeDataTab, setActiveDataTab] = useState<DataWorkspaceTab>('Response Schema');
  const [activeThemeTab, setActiveThemeTab] = useState<ThemeTabId>('tokens');
  const [activeMappingTab, setActiveMappingTab] = useState<MappingTabId>('config');
  const [mappingConfigOpen, setMappingConfigOpen] = useState(true);
  const [previewViewport, setPreviewViewport] = useState<Viewport>('desktop');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('form');
  const [isTabletLayout, setIsTabletLayout] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 1024);
  const SidebarComponent = SIDEBAR_COMPONENTS[activeSection];
  const project = useProject();
  const { selectedKey, deselect } = useSelection();
  const viewportWidth = typeof window !== 'undefined'
    ? Math.min(window.innerWidth, document.documentElement?.clientWidth || window.innerWidth)
    : Infinity;
  const compactLayout = isTabletLayout || viewportWidth <= 1024;

  const workspaceContent = (() => {
    switch (activeTab) {
      case 'Data':
        return <DataTab activeTab={activeDataTab} onActiveTabChange={setActiveDataTab} />;
      case 'Theme':
        return <ThemeTab activeTab={activeThemeTab} onActiveTabChange={setActiveThemeTab} />;
      case 'Mapping':
        return (
          <MappingTab
            activeTab={activeMappingTab}
            onActiveTabChange={setActiveMappingTab}
            configOpen={mappingConfigOpen}
            onConfigOpenChange={setMappingConfigOpen}
          />
        );
      case 'Preview':
        return (
          <PreviewTab
            viewport={previewViewport}
            onViewportChange={setPreviewViewport}
            mode={previewMode}
            onModeChange={setPreviewMode}
          />
        );
      default: {
        const WorkspaceComponent = WORKSPACES[activeTab];
        return WorkspaceComponent ? <WorkspaceComponent /> : activeTab;
      }
    }
  })();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      handleKeyboardShortcut(event, {
        undo: () => project.undo(),
        redo: () => project.redo(),
        delete: () => {
          if (selectedKey) {
            project.dispatch({ type: 'definition.deleteItem', payload: { path: selectedKey } });
            deselect();
          }
        },
        escape: () => { setShowPalette(false); deselect(); },
        search: () => setShowPalette(true),
      }, {
        activeWorkspace: activeTab,
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, project, selectedKey, deselect]);

  useEffect(() => {
    const updateViewport = () => {
      setIsTabletLayout(window.innerWidth <= 1024);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    const onNavigateWorkspace = (event: Event) => {
      const tab = (event as CustomEvent<{ tab?: string }>).detail?.tab;
      if (tab && (tab === 'Data' || WORKSPACES[tab])) {
        setActiveTab(tab);
      }
    };
    window.addEventListener('formspec:navigate-workspace', onNavigateWorkspace);
    return () => window.removeEventListener('formspec:navigate-workspace', onNavigateWorkspace);
  }, []);

  const handleNewForm = () => {
    project.dispatch({
      type: 'project.import',
      payload: createProject().export(),
    });
    project.resetHistory();
    setActiveTab('Editor');
    setActiveSection('Structure');
    setActiveDataTab('Response Schema');
    setActiveThemeTab('tokens');
    setActiveMappingTab('config');
    setMappingConfigOpen(true);
    setPreviewViewport('desktop');
    setPreviewMode('form');
    setShowPalette(false);
    setShowImport(false);
    setShowAppMenu(false);
    deselect();
  };

  const handleExport = () => {
    const definition = project.export().definition;
    const baseName = definition.title?.trim()
      ? definition.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      : 'formspec-definition';
    const blob = new Blob([JSON.stringify(definition, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `${baseName || 'formspec-definition'}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
  };

  return (
    <div data-testid="shell" className="relative h-screen flex flex-col overflow-x-hidden bg-bg-default text-ink font-ui">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onNew={handleNewForm}
        onExport={handleExport}
        onImport={() => setShowImport(true)}
        onSearch={() => setShowPalette(true)}
        onHome={() => setShowAppMenu((current) => !current)}
        onOpenMetadata={() => {
          setActiveTab('Editor');
          setActiveSection('Settings');
        }}
        onToggleAccountMenu={() => setShowAppMenu((current) => !current)}
        isCompact={compactLayout}
      />
      {showAppMenu ? (
        <div
          role="menu"
          data-testid="app-menu"
          className="absolute right-4 top-[56px] z-50 min-w-[180px] rounded-[6px] border border-border bg-surface p-2 shadow-lg"
        >
          <button
            type="button"
            className="w-full rounded-[4px] px-3 py-2 text-left text-sm hover:bg-subtle"
            onClick={() => {
              setActiveTab('Editor');
              setActiveSection('Settings');
              setShowAppMenu(false);
            }}
          >
            Project settings
          </button>
        </div>
      ) : null}
      <CanvasTargetsProvider>
        <div className="flex flex-1 overflow-hidden">
          <aside className="w-[230px] border-r border-border bg-surface overflow-y-auto flex flex-col shrink-0">
            <Blueprint activeSection={activeSection} onSectionChange={setActiveSection} />
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {SidebarComponent && <SidebarComponent />}
            </div>
          </aside>
          <main className="flex-1 overflow-y-auto bg-bg-default">
            <div
              data-testid={`workspace-${activeTab}`}
              data-workspace={activeTab}
              className="h-full"
              onClick={(e) => {
                if (e.target === e.currentTarget) deselect();
              }}
            >
              {workspaceContent}
            </div>
          </main>
          <aside
            className={`w-[270px] border-l border-border bg-surface overflow-y-auto shrink-0 ${compactLayout ? 'hidden' : ''}`}
            data-testid="properties"
            data-responsive-hidden={compactLayout ? 'true' : 'false'}
          >
            <ItemProperties showActions={activeTab === 'Editor'} />
          </aside>
        </div>
      </CanvasTargetsProvider>
      <StatusBar />
      <CommandPalette open={showPalette} onClose={() => setShowPalette(false)} />
      <ImportDialog open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
