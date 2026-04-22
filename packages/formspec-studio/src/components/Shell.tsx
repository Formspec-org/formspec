/** @filedesc Main studio shell; composes the header, blueprint sidebar, workspace tabs, and status bar. */
import { useEffect, useMemo, useCallback } from 'react';
import { type ColorScheme } from '../hooks/useColorScheme';
import { useWorkspaceRouter } from '../hooks/useWorkspaceRouter';
import { useEditorState } from '../hooks/useEditorState';
import { useShellLayout } from '../hooks/useShellLayout';
import { useShellPanels } from '../hooks/useShellPanels';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { createProject, buildDefLookup, type Project } from '@formspec-org/studio-core';
import { exportProjectZip } from '../lib/export-zip';
import { Header } from './Header';
import { StatusBar } from './StatusBar';
import { Blueprint } from './Blueprint';
import { StructureTree } from './blueprint/StructureTree';
import { DefinitionTreeEditor } from '../workspaces/editor/DefinitionTreeEditor';
import { LayoutCanvas as LayoutWorkspace } from '../workspaces/layout/LayoutCanvas';
import { ManageView } from '../workspaces/editor/ManageView';
import { ScreenerWorkspace } from '../workspaces/editor/ScreenerWorkspace';
import { FormHealthPanel } from '../workspaces/editor/FormHealthPanel';
import { BuildManageToggle, type EditorView } from '../workspaces/editor/BuildManageToggle';
import { MappingTab } from '../workspaces/mapping/MappingTab';
import { PreviewTab } from '../workspaces/preview/PreviewTab';
import { LayoutLivePreviewSection } from '../workspaces/layout/LayoutLivePreviewSection';
import { LayoutPreviewNavProvider } from '../workspaces/layout/LayoutPreviewNavContext';
import { CommandPalette } from './CommandPalette';
import { ImportDialog } from './ImportDialog';
import { ChatPanel } from './ChatPanel';
import { AppSettingsDialog } from './AppSettingsDialog';
import { ResizeHandle } from './ui/ResizeHandle';
import { CanvasTargetsProvider } from '../state/useCanvasTargets';
import { LayoutModeProvider, useOptionalLayoutMode } from '../workspaces/layout/LayoutModeContext';
import { useProject } from '../state/useProject';
import { useSelection } from '../state/useSelection';
import {
  OpenDefinitionInEditorProvider,
  type DefinitionEditorItemKind,
} from '../state/OpenDefinitionInEditorContext';
import { ComponentTree } from './blueprint/ComponentTree';
import { ScreenerSummary } from './blueprint/ScreenerSummary';
import { VariablesList } from './blueprint/VariablesList';
import { DataSourcesList } from './blueprint/DataSourcesList';
import { OptionSetsList } from './blueprint/OptionSetsList';
import { MappingsList } from './blueprint/MappingsList';

import { SettingsSection } from './blueprint/SettingsSection';
import { SettingsDialog } from './SettingsDialog';
import { ThemeOverview } from './blueprint/ThemeOverview';
import { ColorPalette } from '../workspaces/theme/ColorPalette';
import { TypographySpacing } from '../workspaces/theme/TypographySpacing';
import { DefaultFieldStyle } from '../workspaces/theme/DefaultFieldStyle';
import { FieldTypeRules } from '../workspaces/theme/FieldTypeRules';
import { ScreenSizes } from '../workspaces/theme/ScreenSizes';
import { AllTokens } from '../workspaces/theme/AllTokens';

const WORKSPACES: Record<string, React.FC> = {
  Layout: LayoutWorkspace,
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
  'Colors': ColorPalette,
  'Typography': TypographySpacing,
  'Field Defaults': DefaultFieldStyle,
  'Field Rules': FieldTypeRules,
  'Breakpoints': ScreenSizes,
  'All Tokens': AllTokens,
};

const THEME_MODE_BLUEPRINT_SECTIONS = ['Colors', 'Typography', 'Field Defaults', 'Field Rules', 'Breakpoints', 'All Tokens', 'Settings'];

const BLUEPRINT_SECTIONS_BY_TAB: Record<string, string[]> = {
  Editor: ['Structure', 'Variables', 'Data Sources', 'Option Sets', 'Screener', 'Settings'],
  Layout: ['Structure', 'Component Tree', 'Screener', 'Variables', 'Data Sources', 'Option Sets', 'Mappings', 'Settings', 'Theme'],
  Mapping: ['Mappings', 'Structure', 'Data Sources', 'Option Sets', 'Settings'],
  Preview: ['Structure', 'Component Tree', 'Theme', 'Settings'],
};

interface ShellProps {
  colorScheme?: ColorScheme;
}

function BlueprintSidebarInner({
  activeTab,
  activeSection,
  onSectionChange,
  activeEditorView,
  compactLayout,
  leftWidth,
}: {
  activeTab: string;
  activeSection: string;
  onSectionChange: (section: string) => void;
  activeEditorView: EditorView | undefined;
  compactLayout: boolean;
  leftWidth: number;
}) {
  const layoutModeCtx = useOptionalLayoutMode();

  useEffect(() => {
    if (activeTab !== 'Layout' || !layoutModeCtx) return;
    const first = THEME_MODE_BLUEPRINT_SECTIONS[0] ?? 'Colors';
    if (!THEME_MODE_BLUEPRINT_SECTIONS.includes(activeSection)) {
      onSectionChange(first);
      return;
    }
    layoutModeCtx.setThemeModeSection(activeSection);
  }, [activeTab, activeSection, layoutModeCtx, onSectionChange]);

  const visibleSections =
    activeTab === 'Layout'
      ? THEME_MODE_BLUEPRINT_SECTIONS
      : (BLUEPRINT_SECTIONS_BY_TAB[activeTab] ?? Object.keys(SIDEBAR_COMPONENTS));

  const resolvedSection = visibleSections.includes(activeSection)
    ? activeSection
    : (visibleSections[0] ?? 'Structure');

  const SidebarComponent = SIDEBAR_COMPONENTS[resolvedSection];

  return (
    <aside
      data-testid="blueprint-sidebar"
      className={`overflow-y-auto flex flex-col shrink-0 border-r border-border/70 bg-[linear-gradient(180deg,rgba(255,252,247,0.94),rgba(248,241,231,0.88))] dark:bg-[linear-gradient(180deg,rgba(26,35,47,0.94),rgba(32,44,59,0.92))] backdrop-blur-sm ${compactLayout ? 'hidden' : ''}`}
      style={{ width: `clamp(140px, ${leftWidth}px, calc(50vw - 340px))` }}
      aria-label="Blueprint sidebar"
    >
      <Blueprint activeSection={resolvedSection} onSectionChange={onSectionChange} sections={visibleSections} activeEditorView={activeEditorView} activeTab={activeTab} />
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {SidebarComponent && <SidebarComponent />}
      </div>
    </aside>
  );
}

export function Shell({ colorScheme }: ShellProps = {}) {
  const project = useProject();
  const { selectedKey, selectedKeyForTab, deselect, select } = useSelection();

  const router = useWorkspaceRouter();
  const {
    activeTab,
    setActiveTab,
    activeSection,
    setActiveSection,
    activeEditorView,
    setActiveEditorView,
    activeMappingTab,
    setActiveMappingTab,
    mappingConfigOpen,
    setMappingConfigOpen,
    previewViewport,
    setPreviewViewport,
    previewMode,
    setPreviewMode,
  } = router;

  const layout = useShellLayout();
  const {
    compactLayout,
    leftWidth,
    rightWidth,
    showBlueprintDrawer,
    setShowBlueprintDrawer,
    showLayoutPreviewPanel,
    setShowLayoutPreviewPanel,
    onResizeLeft,
    onResizeRight,
    blueprintCloseRef,
    overlayOpen,
  } = layout;

  const editor = useEditorState(activeTab, compactLayout);
  const {
    manageCount,
    showRightPanel,
    setShowRightPanel,
    showHealthSheet,
    setShowHealthSheet,
  } = editor;

  const panels = useShellPanels();
  const {
    showPalette,
    setShowPalette,
    showImport,
    setShowImport,
    showSettings,
    setShowSettings,
    showAppSettings,
    setShowAppSettings,
    showChatPanel,
    setShowChatPanel,
    chatPrompt,
    setChatPrompt,
  } = panels;

  const activeTabScope = activeTab.toLowerCase();
  const scopedSelectedKey = selectedKeyForTab(activeTabScope);

  useKeyboardShortcuts(activeTab, project, scopedSelectedKey, setShowPalette);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleNewForm = useCallback(() => {
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
  }, [project]);

  const openDefinitionInEditor = useCallback(
    (defPath: string, kind: DefinitionEditorItemKind) => {
      setActiveTab('Editor');
      setActiveEditorView('build');
      select(defPath, kind, { tab: 'editor', focusInspector: true });
      setShowRightPanel(true);
    },
    [select, setActiveTab, setActiveEditorView, setShowRightPanel],
  );

  const definitionLookup = useMemo(() => buildDefLookup(project.definition.items ?? []), [project.definition.items]);

  const activePanelId = `studio-panel-${activeTab.toLowerCase()}`;
  const activeTabId = `studio-tab-${activeTab.toLowerCase()}`;
  const visibleBlueprintSections =
    activeTab === 'Layout'
      ? THEME_MODE_BLUEPRINT_SECTIONS
      : (BLUEPRINT_SECTIONS_BY_TAB[activeTab] ?? Object.keys(SIDEBAR_COMPONENTS));
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
  }, [activeSection, resolvedActiveSection, setActiveSection]);

  useEffect(() => {
    if (!compactLayout || activeTab !== 'Editor') return;
    setShowBlueprintDrawer(false);
    setShowHealthSheet(false);
  }, [compactLayout, activeTab, setShowBlueprintDrawer, setShowHealthSheet]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('e2e') !== '1') return;
    (window as unknown as { __FORMSPEC_TEST_EXPORT?: () => ReturnType<Project['export']> }).__FORMSPEC_TEST_EXPORT = () => project.export();
    return () => {
      delete (window as unknown as { __FORMSPEC_TEST_EXPORT?: unknown }).__FORMSPEC_TEST_EXPORT;
    };
  }, [project]);

  const hasScreener = project.state.screener !== null;
  const shellBackgroundImage = colorScheme?.resolvedTheme === 'dark'
    ? [
        'radial-gradient(circle at 0% 0%, rgba(123,161,255,0.13), transparent 26%)',
        'radial-gradient(circle at 100% 0%, rgba(131,216,219,0.11), transparent 28%)',
        'linear-gradient(180deg, rgba(19,24,33,0.96), rgba(23,32,46,0.98) 34%, rgba(27,38,54,0.94) 100%)',
      ].join(', ')
    : [
        'radial-gradient(circle at 0% 0%, rgba(183,121,31,0.12), transparent 26%)',
        'radial-gradient(circle at 100% 0%, rgba(47,107,126,0.12), transparent 28%)',
        'linear-gradient(180deg, rgba(255,249,241,0.8), rgba(246,240,232,0.96) 34%, rgba(241,232,220,0.82) 100%)',
      ].join(', ');

  const workspaceContent = (() => {
    if (activeTab === 'Editor') {
      return (
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="px-3 pt-3 md:px-6 md:pt-4 xl:px-8">
            <BuildManageToggle activeView={activeEditorView} onViewChange={setActiveEditorView} manageCount={manageCount} showScreener={hasScreener} />
          </div>
          <div key={activeEditorView} className="flex-1 animate-in fade-in duration-150">
            {activeEditorView === 'build'
              ? <DefinitionTreeEditor />
              : activeEditorView === 'screener'
                ? <ScreenerWorkspace />
                : <ManageView />}
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
            appearance={colorScheme?.resolvedTheme ?? 'light'}
          />
        );
      default: {
        const WorkspaceComponent = WORKSPACES[activeTab];
        return WorkspaceComponent ? <WorkspaceComponent /> : activeTab;
      }
    }
  })();

  const handleExport = () => exportProjectZip(project.export());

  return (
    <div
      data-testid="shell"
      className="relative flex h-screen flex-col overflow-hidden bg-bg-default text-ink font-ui"
      style={{ backgroundImage: shellBackgroundImage }}
    >
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
        onToggleChat={() => setShowChatPanel(!showChatPanel)}
        isCompact={compactLayout}
        colorScheme={colorScheme}
      />
      <OpenDefinitionInEditorProvider value={openDefinitionInEditor}>
      <LayoutPreviewNavProvider>
      <LayoutModeProvider>
      <CanvasTargetsProvider>
        <div
          className={`flex flex-1 overflow-hidden ${activeTab === 'Editor' ? 'bg-[linear-gradient(180deg,rgba(255,252,247,0.42)_0%,rgba(244,235,224,0.7)_100%)] dark:bg-[linear-gradient(180deg,rgba(26,35,47,0.38)_0%,rgba(20,28,39,0.74)_100%)]' : ''}`}
          aria-hidden={overlayOpen ? true : undefined}
        >
          {/* Desktop Left Sidebar */}
          <BlueprintSidebarInner
            activeTab={activeTab}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            activeEditorView={activeEditorView}
            compactLayout={compactLayout}
            leftWidth={leftWidth}
          />
          {!compactLayout && <ResizeHandle side="left" onResize={onResizeLeft} />}

          <main className="flex-1 overflow-y-auto min-w-0 shrink-0 bg-[linear-gradient(180deg,rgba(255,252,247,0.66),rgba(246,238,227,0.92))] dark:bg-[linear-gradient(180deg,rgba(26,35,47,0.74),rgba(19,24,33,0.94))]">
            <div
              id={activePanelId}
              role="tabpanel"
              aria-labelledby={activeTabId}
              data-testid={`workspace-${activeTab}`}
              data-workspace={activeTab}
              className="h-full flex flex-col"
              onClick={(e) => {
                if (e.target === e.currentTarget) deselect();
              }}
            >
              {compactLayout && activeTab === 'Editor' && (
                <div className="sticky top-0 z-20 border-b border-border/70 bg-[linear-gradient(180deg,rgba(255,252,247,0.94),rgba(248,241,231,0.9))] dark:bg-[linear-gradient(180deg,rgba(26,35,47,0.94),rgba(32,44,59,0.9))] px-3 py-3 backdrop-blur" data-testid="mobile-editor-chrome">
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
              <div
                data-testid={activeTab === 'Editor' ? 'editor-canvas-shell' : undefined}
                className={activeTab === 'Editor'
                  ? 'flex-1 px-3 py-3 md:px-6 md:py-5 xl:px-8'
                  : 'flex-1'}
                onClick={activeTab === 'Editor'
                  ? (event) => {
                      if (event.target === event.currentTarget) deselect();
                    }
                  : undefined}
              >
                {compactLayout && activeTab === 'Editor' ? (
                  <div data-testid="mobile-editor-structure" className="space-y-3">
                    <div className="rounded-[24px] border border-border/70 bg-[linear-gradient(180deg,rgba(255,253,249,0.95),rgba(249,242,232,0.92))] dark:bg-[linear-gradient(180deg,rgba(26,35,47,0.95),rgba(32,44,59,0.94))] px-3 py-3 shadow-[0_20px_45px_rgba(77,57,30,0.08)] dark:shadow-[0_20px_45px_rgba(0,0,0,0.28)]">
                      <Blueprint activeSection={resolvedActiveSection} onSectionChange={setActiveSection} sections={visibleBlueprintSections} activeEditorView={activeEditorView} activeTab={activeTab} />
                    </div>
                    <div className="rounded-[24px] border border-border/70 bg-[linear-gradient(180deg,rgba(255,253,249,0.95),rgba(249,242,232,0.92))] dark:bg-[linear-gradient(180deg,rgba(26,35,47,0.95),rgba(32,44,59,0.94))] px-3 py-3 shadow-[0_20px_45px_rgba(77,57,30,0.08)] dark:shadow-[0_20px_45px_rgba(0,0,0,0.28)]">
                      {SidebarComponent && <SidebarComponent />}
                    </div>
                    <div className="rounded-[26px] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(249,242,232,0.92))] dark:bg-[linear-gradient(180deg,rgba(26,35,47,0.96),rgba(32,44,59,0.95))] px-2 py-2 shadow-[0_24px_60px_rgba(77,57,30,0.1)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
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
                  className="flex flex-col overflow-hidden shrink-0 border-l border-border/70 bg-[linear-gradient(180deg,rgba(255,252,247,0.95),rgba(246,238,227,0.9))] dark:bg-[linear-gradient(180deg,rgba(26,35,47,0.94),rgba(32,44,59,0.92))]"
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
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
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
                className="shrink-0 border-l border-border/70 bg-[linear-gradient(180deg,rgba(255,252,247,0.95),rgba(246,238,227,0.9))] dark:bg-[linear-gradient(180deg,rgba(26,35,47,0.94),rgba(32,44,59,0.92))] px-1.5 py-3 text-muted hover:text-ink hover:bg-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                onClick={() => setShowRightPanel(true)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
              </button>
            )
          )}
          {activeTab === 'Layout' && !compactLayout && !showChatPanel && (
            showLayoutPreviewPanel ? (
              <>
                <ResizeHandle side="right" onResize={onResizeRight} />
                <aside
                  className="flex flex-col overflow-hidden shrink-0 border-l border-border/70 bg-[linear-gradient(180deg,rgba(255,252,247,0.95),rgba(246,238,227,0.9))] dark:bg-[linear-gradient(180deg,rgba(26,35,47,0.94),rgba(32,44,59,0.92))]"
                  style={{ width: `clamp(280px, ${rightWidth}px, calc(50vw - 260px))` }}
                  data-testid="layout-preview-panel"
                  aria-label="Layout live preview"
                >
                  <div className="flex items-center justify-end px-3 pt-2 shrink-0">
                    <button
                      type="button"
                      aria-label="Hide layout preview panel"
                      className="rounded p-1 text-muted hover:text-ink hover:bg-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                      onClick={() => setShowLayoutPreviewPanel(false)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 px-3 pb-3">
                    <div className="h-full overflow-hidden rounded-[22px] border border-border/70 bg-surface/80 shadow-[0_18px_40px_rgba(23,32,51,0.08)] dark:shadow-[0_18px_36px_rgba(0,0,0,0.24)]">
                      <LayoutLivePreviewSection
                        width="100%"
                        className="h-full"
                        appearance={colorScheme?.resolvedTheme ?? 'light'}
                      />
                    </div>
                  </div>
                </aside>
              </>
            ) : (
              <button
                type="button"
                aria-label="Show layout preview panel"
                className="shrink-0 border-l border-border/70 bg-[linear-gradient(180deg,rgba(255,252,247,0.95),rgba(246,238,227,0.9))] dark:bg-[linear-gradient(180deg,rgba(26,35,47,0.94),rgba(32,44,59,0.92))] px-1.5 py-3 text-muted hover:text-ink hover:bg-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                onClick={() => setShowLayoutPreviewPanel(true)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
              </button>
            )
          )}
          {showChatPanel && !compactLayout && (
            <aside className="w-[360px] shrink-0" data-testid="chat-panel-container" aria-label="AI chat panel">
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

      </CanvasTargetsProvider>
      </LayoutModeProvider>
      </LayoutPreviewNavProvider>
      </OpenDefinitionInEditorProvider>
      <StatusBar />
      <CommandPalette open={showPalette} onClose={() => setShowPalette(false)} />
      <ImportDialog open={showImport} onClose={() => setShowImport(false)} />
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      <AppSettingsDialog open={showAppSettings} onClose={() => setShowAppSettings(false)} />
    </div>
  );
}
