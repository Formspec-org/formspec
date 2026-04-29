/** @filedesc Main studio shell; composes the header, blueprint sidebar, workspace tabs, and status bar. */
import { useEffect, useMemo, useCallback } from 'react';
import { type ColorScheme } from '../hooks/useColorScheme';
import { useWorkspaceRouter } from '../hooks/useWorkspaceRouter';
import { useEditorState } from '../hooks/useEditorState';
import { useShellLayout } from '../hooks/useShellLayout';
import { useShellPanels } from '../hooks/useShellPanels';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { createProject, buildDefLookup, type Project } from '@formspec-org/studio-core';
import { isOnboardingCompleted } from '../onboarding/onboarding-storage';
import { exportProjectZip } from '../lib/export-zip';
import {
  IconActivity,
  IconChevronRight,
  IconChevronLeft,
  IconMonitor,
} from './icons';
import { Header } from './Header';
import { StatusBar } from './StatusBar';
import { Blueprint } from './Blueprint';

import { FormHealthPanel } from '../workspaces/editor/FormHealthPanel';
import { LayoutLivePreviewSection } from '../workspaces/layout/LayoutLivePreviewSection';
import { PreviewCompanionPanel } from './PreviewCompanionPanel';
import { LayoutPreviewNavProvider } from '../workspaces/layout/LayoutPreviewNavContext';
import { ChatPanel } from './ChatPanel';
import { ResizeHandle } from './ui/ResizeHandle';
import { CanvasTargetsProvider } from '../state/useCanvasTargets';
import { LayoutModeProvider } from '../workspaces/layout/LayoutModeContext';
import { useProject } from '../state/useProject';
import { useSelection } from '../state/useSelection';
import {
  OpenDefinitionInEditorProvider,
  type DefinitionEditorItemKind,
} from '../state/OpenDefinitionInEditorContext';

import { BlueprintSidebar } from './shell/BlueprintSidebar';
import { UnloadGuard } from './UnloadGuard';
import { WorkspaceContent } from './shell/WorkspaceContent';
import { ShellDialogs } from './shell/ShellDialogs';
import { useBlueprintSectionResolution } from './shell/useBlueprintSectionResolution';
import { getShellBackgroundImage } from './shell/shell-background-image';

interface ShellProps {
  colorScheme?: ColorScheme;
  onSwitchToAssistant?: () => void;
}

export function Shell({ colorScheme, onSwitchToAssistant }: ShellProps = {}) {
  const project = useProject();
  const { primaryKey, primaryKeyForTab, deselect, select } = useSelection();

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
    assistantOpen,
    setAssistantOpen,
    showPreview,
    setShowPreview,
  } = panels;

  const activeTabScope = activeTab.toLowerCase();
  const scopedSelectedKey = primaryKeyForTab(activeTabScope);

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
    if (!isOnboardingCompleted()) {
      window.dispatchEvent(new CustomEvent('formspec:restart-onboarding'));
    }
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
  
  const { visibleSections, resolvedSection, SidebarComponent } = useBlueprintSectionResolution(activeTab, activeSection);

  const selectedItemLabel = primaryKey
    ? ((definitionLookup.get(primaryKey)?.item?.label as string | undefined) || primaryKey.split('.').pop() || primaryKey)
    : null;

  useEffect(() => {
    if (resolvedSection === activeSection) return;
    setActiveSection(resolvedSection);
  }, [activeSection, resolvedSection, setActiveSection]);

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
  const shellBackgroundImage = getShellBackgroundImage(colorScheme?.resolvedTheme ?? 'light');

  const workspaceContent = (
    <WorkspaceContent
      activeTab={activeTab}
      activeEditorView={activeEditorView}
      setActiveEditorView={setActiveEditorView}
      manageCount={manageCount}
      hasScreener={hasScreener}
      activeMappingTab={activeMappingTab}
      setActiveMappingTab={setActiveMappingTab}
      mappingConfigOpen={mappingConfigOpen}
      setMappingConfigOpen={setMappingConfigOpen}
      previewViewport={previewViewport}
      setPreviewViewport={setPreviewViewport}
      previewMode={previewMode}
      setPreviewMode={setPreviewMode}
      appearance={colorScheme?.resolvedTheme ?? 'light'}
    />
  );

  const handleExport = async () => {
    await exportProjectZip(project.export());
    project.markClean();
  };

  const handlePreviewFieldClick = useCallback(
    (path: string) => select(path, 'field', { tab: 'editor' }),
    [select],
  );

  return (
    <div
      data-testid="shell"
      className="relative flex h-screen flex-col overflow-hidden bg-bg-default text-ink font-ui"
      style={{ backgroundImage: shellBackgroundImage }}
    >
      <UnloadGuard project={project} />
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onNew={handleNewForm}
        onExport={handleExport}
        onImport={() => setShowImport(true)}
        onSearch={() => setShowPalette(true)}
        onHome={undefined}
        onOpenMetadata={() => setShowSettings(true)}
        onToggleAccountMenu={() => setShowAppSettings(true)}
        onToggleMenu={compactLayout ? () => setShowBlueprintDrawer(true) : undefined}
        assistantMenu={{
          compactLayout,
          sideChatOpen: assistantOpen,
          overlayChatOpen: false,
          onOpenSideChat: () => setAssistantOpen(true),
          onCloseAllChat: () => setAssistantOpen(false),
          onOpenOverlayChat: () => setAssistantOpen(true),
        }}
        onSwitchToAssistant={onSwitchToAssistant}
        isCompact={compactLayout}
        colorScheme={colorScheme}
      />
      <OpenDefinitionInEditorProvider value={openDefinitionInEditor}>
      <LayoutPreviewNavProvider>
      <LayoutModeProvider>
      <CanvasTargetsProvider>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className={`relative flex flex-1 min-h-0 overflow-hidden ${activeTab === 'Editor' ? 'bg-bg-default' : ''}`}
          aria-hidden={overlayOpen ? true : undefined}
        >
          {/* Desktop Left Sidebar */}
          <BlueprintSidebar
            activeTab={activeTab}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            activeEditorView={activeEditorView}
            compactLayout={compactLayout}
            leftWidth={leftWidth}
          />
          {!compactLayout && <ResizeHandle side="left" onResize={onResizeLeft} />}

          <main className="flex-1 overflow-y-auto min-w-0 shrink-0 bg-bg-default">
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
                      <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-muted">Selected</div>
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
                      <IconActivity />
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
                    <div className="rounded-[20px] border border-border bg-surface px-3 py-3">
                      <Blueprint activeSection={resolvedSection} onSectionChange={setActiveSection} sections={visibleSections} activeEditorView={activeEditorView} activeTab={activeTab} />
                    </div>
                    <div className="rounded-[20px] border border-border bg-surface px-3 py-3">
                      {SidebarComponent && <SidebarComponent />}
                    </div>
                    <div className="rounded-[22px] border border-border bg-surface px-2 py-2">
                      {workspaceContent}
                    </div>
                  </div>
                ) : (
                  workspaceContent
                )}
              </div>
            </div>
          </main>
          {activeTab === 'Editor' && !compactLayout && !assistantOpen && !showPreview && (
            showRightPanel ? (
              <>
                <ResizeHandle side="right" onResize={onResizeRight} />
                <aside
                  className="flex flex-col overflow-hidden shrink-0 border-l border-border/70 bg-surface"
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
                      <IconChevronRight size={14} />
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
                className="shrink-0 border-l border-border/70 bg-surface px-1.5 py-3 text-muted hover:text-ink hover:bg-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                onClick={() => setShowRightPanel(true)}
              >
                <IconChevronLeft size={14} />
              </button>
            )
          )}
          {activeTab === 'Layout' && !compactLayout && !assistantOpen && !showPreview && (
            showLayoutPreviewPanel ? (
              <>
                <ResizeHandle side="right" onResize={onResizeRight} />
                <aside
                  className="flex flex-col overflow-hidden shrink-0 border-l border-border/70 bg-surface"
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
                      <IconChevronRight size={14} />
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 px-3 pb-3">
                    <div className="h-full overflow-hidden rounded-[22px] border border-border/70 bg-surface/80">
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
                className="shrink-0 border-l border-border/70 bg-surface px-1.5 py-3 text-muted hover:text-ink hover:bg-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                onClick={() => setShowLayoutPreviewPanel(true)}
              >
                <IconChevronLeft size={14} />
              </button>
            )
          )}
          {showPreview && !assistantOpen && !compactLayout && (
            <>
              <ResizeHandle side="right" onResize={onResizeRight} />
              <PreviewCompanionPanel
                width={rightWidth}
                appearance={colorScheme?.resolvedTheme ?? 'light'}
                highlightFieldPath={primaryKey}
                onClose={() => setShowPreview(false)}
                onFieldClick={handlePreviewFieldClick}
              />
            </>
          )}
          {!showPreview && !assistantOpen && !compactLayout && (
            <button
              type="button"
              aria-label="Show live preview companion"
              title="Live preview"
              className="shrink-0 border-l border-border/70 bg-surface px-1.5 py-3 text-muted hover:text-accent hover:bg-accent/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
              onClick={() => setShowPreview(true)}
            >
              <IconMonitor size={14} />
            </button>
          )}
          {assistantOpen && (
            <div
              id="chat-panel-container"
              data-testid="chat-panel-container"
              aria-label="AI assistant"
              className="flex w-[360px] shrink-0 min-h-0 flex-col border-l border-border/70 bg-surface"
            >
              <ChatPanel
                project={project}
                surfaceLayout="rail"
                onClose={() => setAssistantOpen(false)}
              />
            </div>
          )}
        </div>
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
                <Blueprint activeSection={resolvedSection} onSectionChange={setActiveSection} sections={visibleSections} activeEditorView={activeEditorView} activeTab={activeTab} />
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
      <StatusBar onAskAI={onSwitchToAssistant} />
      <ShellDialogs
        showPalette={showPalette}
        setShowPalette={setShowPalette}
        showImport={showImport}
        setShowImport={setShowImport}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        showAppSettings={showAppSettings}
        setShowAppSettings={setShowAppSettings}
      />
    </div>
  );
}
