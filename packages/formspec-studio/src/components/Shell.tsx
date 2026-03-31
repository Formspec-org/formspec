/** @filedesc Main studio shell; composes the header, blueprint sidebar, workspace tabs, and status bar. */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { type ColorScheme } from '../hooks/useColorScheme';
import JSZip from 'jszip';
import { createProject, handleKeyboardShortcut, buildDefLookup, type Project } from '@formspec-org/studio-core';
import { Header } from './Header';
import { StatusBar } from './StatusBar';
import { Blueprint } from './Blueprint';
import { StructureTree } from './blueprint/StructureTree';
import { DefinitionTreeEditor } from '../workspaces/editor/DefinitionTreeEditor';
import { LayoutCanvas } from '../workspaces/layout/LayoutCanvas';
import { ComponentProperties } from '../workspaces/layout/properties/ComponentProperties';
import { ManageView } from '../workspaces/editor/ManageView';
import { FormHealthPanel } from '../workspaces/editor/FormHealthPanel';
import { BuildManageToggle, type EditorView } from '../workspaces/editor/BuildManageToggle';
import { ThemeTab } from '../workspaces/theme/ThemeTab';
import { MappingTab } from '../workspaces/mapping/MappingTab';
import { PreviewTab } from '../workspaces/preview/PreviewTab';
import { CommandPalette } from './CommandPalette';
import { ImportDialog } from './ImportDialog';
import { ChatPanel } from './ChatPanel';
import { AppSettingsDialog } from './AppSettingsDialog';
import { ResizeHandle } from './ui/ResizeHandle';
import { CanvasTargetsProvider } from '../state/useCanvasTargets';
import { useProject } from '../state/useProject';
import { useSelection } from '../state/useSelection';
import { ComponentTree } from './blueprint/ComponentTree';
import { ScreenerSummary } from './blueprint/ScreenerSummary';
import { VariablesList } from './blueprint/VariablesList';
import { DataSourcesList } from './blueprint/DataSourcesList';
import { OptionSetsList } from './blueprint/OptionSetsList';
import { MappingsList } from './blueprint/MappingsList';

import { SettingsSection } from './blueprint/SettingsSection';
import { SettingsDialog } from './SettingsDialog';
import { ThemeOverview } from './blueprint/ThemeOverview';
import { type MappingTabId } from '../workspaces/mapping/MappingTab';
import { type Viewport } from '../workspaces/preview/ViewportSwitcher';
import { type PreviewMode } from '../workspaces/preview/PreviewTab';

const WORKSPACES: Record<string, React.FC> = {
  Layout: LayoutCanvas,
  Theme: ThemeTab,
  Mapping: MappingTab,
  Preview: PreviewTab,
};

const SIDEBAR_COMPONENTS: Record<string, React.FC> = {
  'Structure': StructureTree,
  'Component Tree': ComponentTree,
  'Screener': ScreenerSummary,
  'Variables': VariablesList,
  'Data Sources': DataSourcesList,
  'Option Sets': OptionSetsList,
  'Mappings': MappingsList,
  'Settings': SettingsSection,
  'Theme': ThemeOverview,
};

const BLUEPRINT_SECTIONS_BY_TAB: Record<string, string[]> = {
  Editor: ['Structure', 'Variables', 'Data Sources', 'Option Sets', 'Screener', 'Settings'],
  Layout: ['Structure', 'Component Tree', 'Screener', 'Variables', 'Data Sources', 'Option Sets', 'Mappings', 'Settings', 'Theme'],
  Theme: ['Theme', 'Structure', 'Settings'],
  Mapping: ['Mappings', 'Structure', 'Data Sources', 'Option Sets', 'Settings'],
  Preview: ['Structure', 'Component Tree', 'Theme', 'Settings'],
};

interface ShellProps {
  colorScheme?: ColorScheme;
}

export function Shell({ colorScheme }: ShellProps = {}) {
  const [activeTab, setActiveTab] = useState<string>('Editor');
  const [activeSection, setActiveSection] = useState<string>('Structure');
  const [showPalette, setShowPalette] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [activeEditorView, setActiveEditorView] = useState<EditorView>('build');
  const [activeMappingTab, setActiveMappingTab] = useState<MappingTabId>('all');
  const [mappingConfigOpen, setMappingConfigOpen] = useState(true);
  const [previewViewport, setPreviewViewport] = useState<Viewport>('desktop');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('form');
  const [showSettings, setShowSettings] = useState(false);
  const [showAppSettings, setShowAppSettings] = useState(false);
  const [showBlueprintDrawer, setShowBlueprintDrawer] = useState(false);
  const [showPropertiesModal, setShowPropertiesModal] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [showHealthSheet, setShowHealthSheet] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [chatPrompt, setChatPrompt] = useState<string | null>(null);
  const [isTabletLayout, setIsTabletLayout] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 1024);
  const [leftWidth, setLeftWidth] = useState(214);
  const [rightWidth, setRightWidth] = useState(320);
  const onResizeLeft = useCallback((delta: number) => {
    setLeftWidth((w) => Math.min(Math.max(w + delta, 160), 400));
  }, []);
  const onResizeRight = useCallback((delta: number) => {
    setRightWidth((w) => Math.min(Math.max(w + delta, 220), 500));
  }, []);
  const blueprintCloseRef = useRef<HTMLButtonElement | null>(null);
  const propertiesBackRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const project = useProject();
  const { selectedKey, selectedKeyForTab, deselect } = useSelection();
  const activeTabScope = activeTab.toLowerCase();
  const scopedSelectedKey = selectedKeyForTab(activeTabScope);
  const definitionLookup = useMemo(() => buildDefLookup(project.definition.items ?? []), [project.definition.items]);
  const manageCount = useMemo(() => {
    const def = project.definition;
    return (def.binds?.length ?? 0) +
      (Array.isArray(def.shapes) ? def.shapes.length : 0) +
      (def.variables?.length ?? 0) +
      Object.keys(def.optionSets ?? {}).length +
      Object.keys(def.instances ?? {}).length +
      (def.screener?.routes?.length ?? 0);
  }, [project.definition]);
  const viewportWidth = typeof window !== 'undefined'
    ? Math.min(window.innerWidth, document.documentElement?.clientWidth || window.innerWidth)
    : Infinity;
  const compactLayout = isTabletLayout || viewportWidth <= 1024;
  const overlayOpen = compactLayout && (showBlueprintDrawer || showPropertiesModal);
  const activePanelId = `studio-panel-${activeTab.toLowerCase()}`;
  const activeTabId = `studio-tab-${activeTab.toLowerCase()}`;
  const visibleBlueprintSections = BLUEPRINT_SECTIONS_BY_TAB[activeTab] ?? Object.keys(SIDEBAR_COMPONENTS);
  const resolvedActiveSection = visibleBlueprintSections.includes(activeSection)
    ? activeSection
    : (visibleBlueprintSections[0] ?? 'Structure');
  const SidebarComponent = SIDEBAR_COMPONENTS[resolvedActiveSection];
  const selectedItemLabel = selectedKey
    ? ((definitionLookup.get(selectedKey)?.item?.label as string | undefined) || selectedKey.split('.').pop() || selectedKey)
    : null;

  useEffect(() => {
    if (resolvedActiveSection === activeSection) return;
    setActiveSection(resolvedActiveSection);
  }, [activeSection, resolvedActiveSection]);

  const workspaceContent = (() => {
    if (activeTab === 'Editor') {
      return (
        <div className="flex flex-col h-full">
          <div className="sticky top-0 z-20 border-b border-border/70 bg-bg-default/80 backdrop-blur-md px-6 py-3">
            <BuildManageToggle activeView={activeEditorView} onViewChange={setActiveEditorView} manageCount={manageCount} />
          </div>
          <div key={activeEditorView} className="flex-1 overflow-y-auto animate-in fade-in duration-150">
            {activeEditorView === 'build' ? <DefinitionTreeEditor /> : <ManageView />}
          </div>
        </div>
      );
    }
    switch (activeTab) {
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
    if (!compactLayout || activeTab !== 'Editor') return;
    setShowBlueprintDrawer(false);
    setShowPropertiesModal(false);
    setShowHealthSheet(false);
  }, [compactLayout, activeTab]);

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
          if (scopedSelectedKey) {
            project.removeItem(scopedSelectedKey);
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
  }, [activeTab, project, scopedSelectedKey, deselect]);

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
      const detail = (event as CustomEvent<{ tab?: string; subTab?: string; view?: EditorView; section?: string }>).detail ?? {};
      const { tab, subTab, view, section } = detail;
      if (tab && (tab === 'Editor' || WORKSPACES[tab])) {
        setActiveTab(tab);
        if (tab === 'Editor' && view) {
          setActiveEditorView(view);
        }
        if (subTab) {
          if (tab === 'Mapping') setActiveMappingTab(subTab as MappingTabId);
        }
        if (section) {
          window.dispatchEvent(new CustomEvent('formspec:scroll-to-section', {
            detail: { section },
          }));
        }
      }
    };
    window.addEventListener('formspec:navigate-workspace', onNavigateWorkspace);
    return () => window.removeEventListener('formspec:navigate-workspace', onNavigateWorkspace);
  }, []);

  useEffect(() => {
    const onOpenSettings = () => setShowSettings(true);
    const onOpenAppSettings = () => setShowAppSettings(true);
    window.addEventListener('formspec:open-settings', onOpenSettings);
    window.addEventListener('formspec:open-app-settings', onOpenAppSettings);
    return () => {
      window.removeEventListener('formspec:open-settings', onOpenSettings);
      window.removeEventListener('formspec:open-app-settings', onOpenAppSettings);
    };
  }, []);

  useEffect(() => {
    if (!compactLayout || !showBlueprintDrawer) return;
    lastFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    blueprintCloseRef.current?.focus();
    return () => {
      lastFocusRef.current?.focus();
    };
  }, [compactLayout, showBlueprintDrawer]);

  useEffect(() => {
    if (!compactLayout || !showPropertiesModal || !selectedKey) return;
    lastFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    propertiesBackRef.current?.focus();
    return () => {
      lastFocusRef.current?.focus();
    };
  }, [compactLayout, showPropertiesModal, selectedKey]);

  useEffect(() => {
    if (!overlayOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (showPropertiesModal) {
        deselect();
        return;
      }
      if (showBlueprintDrawer) {
        setShowBlueprintDrawer(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [overlayOpen, showBlueprintDrawer, showPropertiesModal, deselect]);

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
    setActiveEditorView('build');
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
    <div data-testid="shell" className="relative h-screen flex flex-col overflow-hidden bg-bg-default text-ink font-ui">
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
        colorScheme={colorScheme}
      />
      <CanvasTargetsProvider>
        <div className="flex flex-1 overflow-hidden bg-bg-default" aria-hidden={overlayOpen ? true : undefined}>
          {/* Desktop Left Sidebar */}
          <aside
            data-testid="blueprint-sidebar"
            className={`border-r border-border/80 bg-surface overflow-y-auto flex flex-col shrink-0 ${compactLayout ? 'hidden' : ''}`}
            style={{ width: `clamp(140px, ${leftWidth}px, calc(50vw - 340px))` }}
            aria-label="Blueprint sidebar"
          >
            <Blueprint activeSection={resolvedActiveSection} onSectionChange={setActiveSection} sections={visibleBlueprintSections} activeEditorView={activeEditorView} activeTab={activeTab} />
            <div className="flex-1 overflow-y-auto px-3 py-4">
              {SidebarComponent && <SidebarComponent />}
            </div>
          </aside>
          {!compactLayout && <ResizeHandle side="left" onResize={onResizeLeft} />}

          <main className="flex-1 overflow-y-auto bg-bg-default min-w-0 shrink-0">
            <div
              id={activePanelId}
              role="tabpanel"
              aria-labelledby={activeTabId}
              data-testid={`workspace-${activeTab}`}
              data-workspace={activeTab}
              className={`h-full flex flex-col ${activeTab === 'Editor' && activeEditorView === 'build' ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(246,243,238,0.9)_100%)] dark:bg-none' : ''}`}
              onClick={(e) => {
                if (e.target === e.currentTarget) deselect();
              }}
            >
              {compactLayout && activeTab === 'Editor' && (
                <div className="sticky top-0 z-20 border-b border-border/70 bg-surface/95 px-3 py-3 backdrop-blur" data-testid="mobile-editor-chrome">
                  <div className="flex items-center justify-between">
                    <div data-testid="mobile-selection-context" className="min-h-10 flex-1 rounded-[14px] border border-border/60 bg-bg-default/75 px-3 py-2">
                      <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted">Selected</div>
                      <div className="truncate text-[13px] font-medium text-ink">
                        {selectedItemLabel ?? 'Nothing selected'}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Form health"
                      className="ml-2 shrink-0 rounded-full border border-border/60 bg-bg-default/75 p-2.5 text-muted hover:text-ink hover:bg-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                      onClick={() => setShowHealthSheet(true)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
              <div
                data-testid={activeTab === 'Editor' ? 'editor-canvas-shell' : undefined}
                className={activeTab === 'Editor'
                  ? 'flex-1 px-3 py-3 md:px-6 md:py-4 xl:px-8'
                  : 'flex-1'}
                onClick={activeTab === 'Editor'
                  ? (event) => {
                      if (event.target === event.currentTarget) deselect();
                    }
                  : undefined}
              >
                {compactLayout && activeTab === 'Editor' ? (
                  <div data-testid="mobile-editor-structure" className="space-y-3">
                    <div className="rounded-[18px] border border-border/70 bg-surface px-3 py-3 shadow-sm">
                      <Blueprint activeSection={resolvedActiveSection} onSectionChange={setActiveSection} sections={visibleBlueprintSections} activeEditorView={activeEditorView} activeTab={activeTab} />
                    </div>
                    <div className="rounded-[18px] border border-border/70 bg-surface px-3 py-3 shadow-sm">
                      {SidebarComponent && <SidebarComponent />}
                    </div>
                    <div className="rounded-[18px] border border-border/70 bg-surface px-2 py-2 shadow-sm">
                      {workspaceContent}
                    </div>
                  </div>
                ) : (
                  workspaceContent
                )}
              </div>
            </div>
          </main>
          {activeTab === 'Editor' && !compactLayout && !showChatPanel && (
            showRightPanel ? (
              <>
                <ResizeHandle side="right" onResize={onResizeRight} />
                <aside
                  className="flex flex-col border-l border-border/80 bg-surface overflow-hidden shrink-0"
                  style={{ width: `clamp(200px, ${rightWidth}px, calc(50vw - 340px))` }}
                  data-testid="properties-panel"
                  aria-label="Form health panel"
                >
                  <div className="flex items-center justify-end px-3 pt-2 shrink-0">
                    <button
                      type="button"
                      aria-label="Hide panel"
                      className="rounded p-1 text-muted hover:text-ink hover:bg-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                      onClick={() => setShowRightPanel(false)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                  </div>
                  <div className="flex-1 min-h-0">
                    <FormHealthPanel />
                  </div>
                </aside>
              </>
            ) : (
              <button
                type="button"
                aria-label="Show form health panel"
                className="shrink-0 border-l border-border/80 bg-surface px-1.5 py-3 text-muted hover:text-ink hover:bg-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                onClick={() => setShowRightPanel(true)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
            )
          )}
          {activeTab === 'Layout' && !compactLayout && !showChatPanel && (
            showRightPanel ? (
              <>
                <ResizeHandle side="right" onResize={onResizeRight} />
                <aside
                  className="flex flex-col border-l border-border/80 bg-surface overflow-hidden shrink-0"
                  style={{ width: `clamp(200px, ${rightWidth}px, calc(50vw - 340px))` }}
                  data-testid="properties-panel"
                  aria-label="Properties panel"
                >
                  <div className="flex items-center justify-end px-3 pt-2 shrink-0">
                    <button
                      type="button"
                      aria-label="Hide panel"
                      className="rounded p-1 text-muted hover:text-ink hover:bg-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                      onClick={() => setShowRightPanel(false)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                  </div>
                  <div className="flex-1 min-h-0">
                    <ComponentProperties />
                  </div>
                </aside>
              </>
            ) : (
              <button
                type="button"
                aria-label="Show properties panel"
                className="shrink-0 border-l border-border/80 bg-surface px-1.5 py-3 text-muted hover:text-ink hover:bg-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                onClick={() => setShowRightPanel(true)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
            )
          )}
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

        {/* Compact Blueprint Drawer */}
        {compactLayout && showBlueprintDrawer && (
          <div
            className="fixed inset-0 z-40 bg-black/40 transition-opacity"
            onClick={() => setShowBlueprintDrawer(false)}
          >
            <aside
              role="dialog"
              aria-modal="true"
              aria-labelledby="blueprint-drawer-title"
              className="w-[280px] h-full bg-surface shadow-xl flex flex-col animate-in slide-in-from-left duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 id="blueprint-drawer-title" className="font-bold text-sm">Blueprint</h2>
                <button
                  ref={blueprintCloseRef}
                  type="button"
                  aria-label="Close blueprint drawer"
                  className="rounded p-1 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                  onClick={() => setShowBlueprintDrawer(false)}
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <Blueprint activeSection={resolvedActiveSection} onSectionChange={setActiveSection} sections={visibleBlueprintSections} activeEditorView={activeEditorView} activeTab={activeTab} />
                <div className="px-4 py-2">
                  {SidebarComponent && <SidebarComponent />}
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Compact Form Health Bottom Sheet */}
        {compactLayout && activeTab === 'Editor' && showHealthSheet && (
          <div
            className="fixed inset-0 z-40 bg-black/40 transition-opacity"
            onClick={() => setShowHealthSheet(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Form health"
              className="absolute bottom-0 left-0 right-0 max-h-[70vh] bg-surface rounded-t-2xl shadow-xl flex flex-col animate-in slide-in-from-bottom duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                <h2 className="text-[15px] font-semibold text-ink tracking-tight font-ui">Form Health</h2>
                <button
                  type="button"
                  aria-label="Close health sheet"
                  className="rounded p-1 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                  onClick={() => setShowHealthSheet(false)}
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <FormHealthPanel />
              </div>
            </div>
          </div>
        )}

        {/* Compact Properties Modal (Full Screen) */}
        {compactLayout && activeTab === 'Layout' && showPropertiesModal && selectedKey && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="properties-modal-title properties-modal-item-label"
            className="fixed inset-0 z-50 bg-surface flex flex-col animate-in slide-in-from-bottom duration-300"
          >
            <div className="flex items-center justify-between p-4 border-b border-border bg-surface shrink-0">
              <div className="flex items-center gap-2">
                <button
                  ref={propertiesBackRef}
                  type="button"
                  aria-label="Close properties panel"
                  className="rounded p-1 -ml-1 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                  onClick={() => deselect()}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6"/>
                  </svg>
                </button>
                <div className="min-w-0">
                  <h2 id="properties-modal-title" className="font-bold text-[13px] truncate max-w-[200px]">Properties</h2>
                  <div id="properties-modal-item-label" data-testid="compact-properties-item-label" className="font-mono text-[11px] text-muted truncate max-w-[200px]">
                    {selectedItemLabel}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="rounded bg-accent px-3 py-1.5 text-[13px] font-bold text-white transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                onClick={() => setShowPropertiesModal(false)}
              >
                Done
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pb-24">
              <ComponentProperties />
            </div>
          </div>
        )}
      </CanvasTargetsProvider>
      <StatusBar />
      <CommandPalette open={showPalette} onClose={() => setShowPalette(false)} />
      <ImportDialog open={showImport} onClose={() => setShowImport(false)} />
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      <AppSettingsDialog open={showAppSettings} onClose={() => setShowAppSettings(false)} />
    </div>
  );
}
