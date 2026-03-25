/** @filedesc Main studio shell; composes the header, blueprint sidebar, workspace tabs, and status bar. */
import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { createProject, type Project } from 'formspec-studio-core';
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
import { ChatPanel } from './ChatPanel';
import { AppSettingsDialog } from './AppSettingsDialog';
import { CanvasTargetsProvider } from '../state/useCanvasTargets';
import { useProject } from '../state/useProject';
import { useSelection } from '../state/useSelection';

import { ComponentTree } from './blueprint/ComponentTree';
import { ScreenerSection } from './blueprint/ScreenerSection';
import { VariablesList } from './blueprint/VariablesList';
import { DataSourcesList } from './blueprint/DataSourcesList';
import { OptionSetsList } from './blueprint/OptionSetsList';
import { MappingsList } from './blueprint/MappingsList';

import { SettingsSection } from './blueprint/SettingsSection';
import { SettingsDialog } from './SettingsDialog';
import { ThemeOverview } from './blueprint/ThemeOverview';
import { DataTab, type DataSectionFilter } from '../workspaces/data/DataTab';
import { PagesTab } from '../workspaces/pages/PagesTab';
import { type MappingTabId } from '../workspaces/mapping/MappingTab';
import { type Viewport } from '../workspaces/preview/ViewportSwitcher';
import { type PreviewMode } from '../workspaces/preview/PreviewTab';

const WORKSPACES: Record<string, React.FC> = {
  Editor: EditorCanvas,
  Logic: LogicTab,
  Data: DataTab,
  Layout: PagesTab,
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
  'Settings': SettingsSection,
  'Theme': ThemeOverview,
};

export function Shell() {
  const [activeTab, setActiveTab] = useState<string>('Editor');
  const [activeSection, setActiveSection] = useState<string>('Structure');
  const [showPalette, setShowPalette] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [activeDataFilter, setActiveDataFilter] = useState<DataSectionFilter>('all');
  const [activeMappingTab, setActiveMappingTab] = useState<MappingTabId>('all');
  const [mappingConfigOpen, setMappingConfigOpen] = useState(true);
  const [previewViewport, setPreviewViewport] = useState<Viewport>('desktop');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('form');
  const [showSettings, setShowSettings] = useState(false);
  const [showAppSettings, setShowAppSettings] = useState(false);
  const [showBlueprintDrawer, setShowBlueprintDrawer] = useState(false);
  const [showPropertiesModal, setShowPropertiesModal] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [chatPrompt, setChatPrompt] = useState<string | null>(null);
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
        return (
          <DataTab
            sectionFilter={activeDataFilter}
            onSectionFilterChange={setActiveDataFilter}
          />
        );
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

  // Sync mobile drawer/modal states with selection
  useEffect(() => {
    if (compactLayout && selectedKey) {
      setShowPropertiesModal(true);
      setShowBlueprintDrawer(false);
    } else if (!selectedKey) {
      setShowPropertiesModal(false);
    }
  }, [selectedKey, compactLayout]);

  // E2E: expose project.export() when ?e2e=1 so tests can validate exported bundle
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('e2e') !== '1') return;
    (window as unknown as { __FORMSPEC_TEST_EXPORT?: () => ReturnType<Project['export']> }).__FORMSPEC_TEST_EXPORT = () => project.export();
    return () => {
      delete (window as unknown as { __FORMSPEC_TEST_EXPORT?: unknown }).__FORMSPEC_TEST_EXPORT;
    };
  }, [project]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      handleKeyboardShortcut(event, {
        undo: () => project.undo(),
        redo: () => project.redo(),
        delete: () => {
          if (selectedKey) {
            project.removeItem(selectedKey);
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
      const { tab, subTab } = (event as CustomEvent<{ tab?: string; subTab?: string }>).detail ?? {};
      if (tab && WORKSPACES[tab]) {
        setActiveTab(tab);
        if (subTab) {
          if (tab === 'Mapping') setActiveMappingTab(subTab as MappingTabId);
        }
      }
    };
    window.addEventListener('formspec:navigate-workspace', onNavigateWorkspace);
    return () => window.removeEventListener('formspec:navigate-workspace', onNavigateWorkspace);
  }, []);

  useEffect(() => {
    const onOpenSettings = () => setShowSettings(true);
    window.addEventListener('formspec:open-settings', onOpenSettings);
    return () => window.removeEventListener('formspec:open-settings', onOpenSettings);
  }, []);

  useEffect(() => {
    const onAIAction = (event: Event) => {
      const { prompt } = (event as CustomEvent<{ prompt: string }>).detail ?? {};
      if (prompt) {
        setChatPrompt(prompt);
        setShowChatPanel(true);
      }
    };
    window.addEventListener('formspec:ai-action', onAIAction);
    return () => window.removeEventListener('formspec:ai-action', onAIAction);
  }, []);

  const handleNewForm = () => {
    project.loadBundle(createProject().export());
    setActiveTab('Editor');
    setActiveSection('Structure');
    setActiveDataFilter('all');
    setActiveMappingTab('config');
    setMappingConfigOpen(true);
    setPreviewViewport('desktop');
    setPreviewMode('form');
    setShowPalette(false);
    setShowImport(false);
    deselect();
  };

  const handleExport = async () => {
    const bundle = project.export();
    const { definition } = bundle;
    const baseName = definition.title?.trim()
      ? definition.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      : 'formspec-project';

    const zip = new JSZip();
    zip.file('definition.json', JSON.stringify(bundle.definition, null, 2));
    zip.file('component.json', JSON.stringify(bundle.component, null, 2));
    zip.file('theme.json', JSON.stringify(bundle.theme, null, 2));

    if (bundle.mappings && Object.keys(bundle.mappings).length > 0) {
      const mappingsFolder = zip.folder('mappings');
      if (mappingsFolder) {
        for (const [key, mapping] of Object.entries(bundle.mappings)) {
          mappingsFolder.file(`${key}.json`, JSON.stringify(mapping, null, 2));
        }
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const href = URL.createObjectURL(content);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `${baseName}.zip`;
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
        onHome={() => setShowSettings(true)}
        onOpenMetadata={() => setShowSettings(true)}
        onToggleAccountMenu={() => setShowAppSettings(true)}
        onToggleMenu={compactLayout ? () => setShowBlueprintDrawer(true) : undefined}
        onToggleChat={() => setShowChatPanel((p) => !p)}
        isCompact={compactLayout}
      />
      <CanvasTargetsProvider>
        <div className="flex flex-1 overflow-hidden">
          {/* Desktop Left Sidebar */}
          <aside className={`w-[230px] border-r border-border bg-surface overflow-y-auto flex flex-col shrink-0 ${compactLayout ? 'hidden' : ''}`}>
            <Blueprint activeSection={activeSection} onSectionChange={setActiveSection} />
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {SidebarComponent && <SidebarComponent />}
            </div>
          </aside>

          {/* Compact Blueprint Drawer */}
          {compactLayout && showBlueprintDrawer && (
            <div
              className="fixed inset-0 z-40 bg-black/40 transition-opacity"
              onClick={() => setShowBlueprintDrawer(false)}
            >
              <aside
                className="w-[280px] h-full bg-surface shadow-xl flex flex-col animate-in slide-in-from-left duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <span className="font-bold text-sm">Blueprint</span>
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-subtle"
                    onClick={() => setShowBlueprintDrawer(false)}
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <Blueprint activeSection={activeSection} onSectionChange={setActiveSection} />
                  <div className="px-4 py-2">
                    {SidebarComponent && <SidebarComponent />}
                  </div>
                </div>
              </aside>
            </div>
          )}

          {/* Compact Properties Modal (Full Screen) */}
          {compactLayout && showPropertiesModal && selectedKey && (
            <div className="fixed inset-0 z-50 bg-surface flex flex-col animate-in slide-in-from-bottom duration-300">
              <div className="flex items-center justify-between p-4 border-b border-border bg-surface shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="p-1 -ml-1 rounded hover:bg-subtle"
                    onClick={() => deselect()}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m15 18-6-6 6-6"/>
                    </svg>
                  </button>
                  <span className="font-bold text-sm truncate max-w-[200px]">{selectedKey}</span>
                </div>
                <button
                  type="button"
                  className="px-3 py-1.5 bg-accent text-white text-[13px] font-bold rounded hover:bg-accent/90 transition-colors"
                  onClick={() => setShowPropertiesModal(false)}
                >
                  Done
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 pb-24">
                <ItemProperties showActions={activeTab === 'Editor'} />
              </div>
            </div>
          )}

          <main className="flex-1 overflow-y-auto bg-bg-default min-w-0">
            <div
              data-testid={`workspace-${activeTab}`}
              data-workspace={activeTab}
              className="h-full flex flex-col"
              onClick={(e) => {
                if (e.target === e.currentTarget) deselect();
              }}
            >
              {workspaceContent}
            </div>
          </main>
          <aside
            className={`w-[270px] border-l border-border bg-surface overflow-y-auto shrink-0 ${compactLayout || showChatPanel ? 'hidden' : ''}`}
            data-testid="properties"
            data-responsive-hidden={compactLayout ? 'true' : 'false'}
          >
            <ItemProperties showActions={activeTab === 'Editor'} />
          </aside>
          {showChatPanel && !compactLayout && (
            <aside className="w-[360px] shrink-0" data-testid="chat-panel-container">
              <ChatPanel
                project={project}
                onClose={() => { setShowChatPanel(false); setChatPrompt(null); }}
                initialPrompt={chatPrompt}
              />
            </aside>
          )}
        </div>
      </CanvasTargetsProvider>
      <StatusBar />
      <CommandPalette open={showPalette} onClose={() => setShowPalette(false)} />
      <ImportDialog open={showImport} onClose={() => setShowImport(false)} />
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      <AppSettingsDialog open={showAppSettings} onClose={() => setShowAppSettings(false)} />
    </div>
  );
}
