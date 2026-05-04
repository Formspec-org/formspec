/** @filedesc Unified Studio surface — single component replacing the studioView toggle. */
import { useState, useEffect, useCallback, useMemo, type ReactElement } from 'react';
import { useMode, type StudioMode } from './ModeProvider';
import { useProject } from '../state/useProject';
import { useSelection } from '../state/useSelection';
import { useChatSessionController, type ChatSessionController } from '../hooks/useChatSessionController';
import { useColorScheme, type ColorScheme } from '../hooks/useColorScheme';
import { useShellLayout } from '../hooks/useShellLayout';
import { useShellPanels } from '../hooks/useShellPanels';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useEditorState } from '../hooks/useEditorState';
import { type Project, buildDefLookup, createProject } from '@formspec-org/studio-core';
import { isOnboardingCompleted } from '../onboarding/onboarding-storage';
import { exportProjectZip } from '../lib/export-zip';
import { Header } from '../components/Header';
import { StatusBar } from '../components/StatusBar';
import { Blueprint } from '../components/Blueprint';
import { ChatPanel } from '../components/ChatPanel';
import { PreviewCompanionPanel } from '../components/PreviewCompanionPanel';
import { ResizeHandle } from '../components/ui/ResizeHandle';
import { UnloadGuard } from '../components/UnloadGuard';
import { BlueprintSidebar } from '../components/shell/BlueprintSidebar';
import { WorkspaceContent } from '../components/shell/WorkspaceContent';
import { ShellDialogs } from '../components/shell/ShellDialogs';
import { useBlueprintSectionResolution } from '../components/shell/useBlueprintSectionResolution';
import { BLUEPRINT_SECTIONS_BY_TAB } from '../components/shell/ShellConstants';
import { getShellBackgroundImage } from '../components/shell/shell-background-image';
import { ChatSessionControllerProvider } from '../state/ChatSessionControllerContext';
import { ActiveGroupProvider } from '../state/useActiveGroup';
import { CanvasTargetsProvider } from '../state/useCanvasTargets';
import { LayoutPreviewNavProvider } from '../workspaces/layout/LayoutPreviewNavContext';
import { LayoutModeProvider } from '../workspaces/layout/LayoutModeContext';
import {
  OpenDefinitionInEditorProvider,
  type DefinitionEditorItemKind,
} from '../state/OpenDefinitionInEditorContext';
import { telemetry } from '../services/telemetry-adapter';
import { LayoutCanvas } from '../workspaces/layout/LayoutCanvas';
import { LayoutLivePreviewSection } from '../workspaces/layout/LayoutLivePreviewSection';
import { FormHealthPanel } from '../workspaces/editor/FormHealthPanel';
import type { StudioUIHandlers } from '../components/chat/studio-ui-tools';
import type { EditorView } from '../workspaces/editor/BuildManageToggle';
import type { MappingTabId } from '../workspaces/mapping/MappingTab';
import type { Viewport } from '../workspaces/preview/ViewportSwitcher';
import type { PreviewMode } from '../workspaces/preview/PreviewTab';

import {
  IconActivity,
  IconChevronRight,
  IconChevronLeft,
  IconMonitor,
} from '../components/icons';

/** Map Studio modes to workspace tab names for backward compatibility with existing components. */
function modeToWorkspaceTab(mode: StudioMode): string {
  switch (mode) {
    case 'chat': return 'Editor'; // Chat mode uses Editor workspace as canvas context
    case 'edit': return 'Editor';
    case 'design': return 'Design';
    case 'preview': return 'Preview';
  }
}

const ADVANCED_WORKSPACE_TABS = new Set(['Evidence', 'Mapping']);
const VALID_MAPPING_TAB_IDS = new Set<string>(['all', 'config', 'rules', 'adapter', 'preview']);
const VALID_EDITOR_VIEWS = new Set<string>(['build', 'manage', 'screener', 'health']);

export function UnifiedStudio(): ReactElement {
  const project = useProject();
  const { mode, setMode } = useMode();
  const colorScheme = useColorScheme();
  const { primaryKey, primaryKeyForTab, deselect, select, reveal, selectionScopeTab } = useSelection();
  const [advancedTab, setAdvancedTab] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('Structure');
  const [activeMappingTab, setActiveMappingTab] = useState<MappingTabId>('all');
  const [mappingConfigOpen, setMappingConfigOpen] = useState(true);
  const [previewViewport, setPreviewViewport] = useState<Viewport>('desktop');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('form');
  const [activeEditorView, setActiveEditorView] = useState<EditorView>('build');

  // Layout
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

  // Workspace tab compatibility
  const activeTab = advancedTab ?? modeToWorkspaceTab(mode);

  // Editor state
  const editor = useEditorState(activeTab, compactLayout);
  const {
    manageCount,
    showRightPanel,
    setShowRightPanel,
    showHealthSheet,
    setShowHealthSheet,
  } = editor;

  // Panels
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
    showPreview,
    setShowPreview,
    assistantOpen,
  } = panels;

  const scopedSelectedKey = primaryKeyForTab(activeTab.toLowerCase());
  useKeyboardShortcuts(activeTab, project, scopedSelectedKey, setShowPalette);

  // Blueprint sidebar
  const { visibleSections, resolvedSection } = useBlueprintSectionResolution(activeTab, activeSection);

  const setStudioMode = useCallback((nextMode: StudioMode) => {
    setAdvancedTab(null);
    setMode(nextMode);
  }, [setMode]);

  useEffect(() => {
    if (resolvedSection !== activeSection) {
      setActiveSection(resolvedSection);
    }
  }, [activeSection, activeTab, resolvedSection]);

  // Studio UI handlers for chat
  const getWorkspaceContext = useCallback(() => {
    const path = primaryKeyForTab(selectionScopeTab);
    return {
      selection: path ? { path, sourceTab: selectionScopeTab } : null,
      viewport: null as ('desktop' | 'tablet' | 'mobile' | null),
    };
  }, [selectionScopeTab, primaryKeyForTab]);

  const studioUIHandlers = useMemo<StudioUIHandlers>(() => ({
    revealField: (path: string) => {
      if (!project.itemAt(path)) {
        return { ok: false, reason: `Path "${path}" not found in current definition.` };
      }
      reveal(path);
      return { ok: true };
    },
    setRightPanelOpen: (open: boolean) => {
      if (mode === 'chat') {
        return { ok: false, reason: 'Preview companion is only available in edit/design modes.' };
      }
      window.dispatchEvent(new CustomEvent('formspec:toggle-preview-companion', { detail: { open } }));
      return { ok: true };
    },
    switchMode: (newMode: string) => {
      const valid = ['chat', 'edit', 'design', 'preview'];
      if (!valid.includes(newMode)) {
        return { ok: false, reason: `Invalid mode "${newMode}". Must be one of: ${valid.join(', ')}` };
      }
      setStudioMode(newMode as StudioMode);
      return { ok: true };
    },
    highlightField: (path: string) => {
      if (!project.itemAt(path)) {
        return { ok: false, reason: `Path "${path}" not found in current definition.` };
      }
      reveal(path);
      return { ok: true, reason: `Highlighted "${path}" on canvas.` };
    },
    openPreview: () => {
      setStudioMode('preview');
      return { ok: true };
    },
  }), [project, reveal, mode, setStudioMode]);

  // Chat session controller
  const controller = useChatSessionController({
    project,
    studioUIHandlers,
    getWorkspaceContext,
  });

  // Definition lookup
  const definitionLookup = useMemo(
    () => buildDefLookup(project.definition.items ?? []),
    [project.definition.items],
  );

  const selectedItemLabel = primaryKey
    ? ((definitionLookup.get(primaryKey)?.item?.label as string | undefined) || primaryKey.split('.').pop() || primaryKey)
    : null;

  // Handlers
  const handleNewForm = useCallback(() => {
    project.loadBundle(createProject().exportBundle());
    setAdvancedTab(null);
    setStudioMode('chat');
    setActiveSection('Structure');
    setActiveEditorView('build');
    setActiveMappingTab('all');
    setMappingConfigOpen(true);
    setPreviewViewport('desktop');
    setPreviewMode('form');
    setShowPalette(false);
    setShowImport(false);
    deselect();
    if (!isOnboardingCompleted()) {
      window.dispatchEvent(new CustomEvent('formspec:restart-onboarding'));
    }
  }, [project, setStudioMode, setShowPalette, setShowImport, deselect]);

  const openDefinitionInEditor = useCallback(
    (defPath: string, kind: DefinitionEditorItemKind) => {
      setStudioMode('edit');
      setActiveEditorView('build');
      select(defPath, kind, { tab: 'editor', focusInspector: true });
      setShowRightPanel(true);
    },
    [select, setStudioMode, setShowRightPanel],
  );

  useEffect(() => {
    const onNavigateWorkspace = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail;
      if (!detail || typeof detail !== 'object') return;

      const tab = typeof detail.tab === 'string' ? detail.tab : undefined;
      const view = typeof detail.view === 'string' ? detail.view : undefined;
      const subTab = typeof detail.subTab === 'string' ? detail.subTab : undefined;
      const section = typeof detail.section === 'string' ? detail.section : undefined;

      if (tab === 'Theme' || tab === 'Design' || tab === 'Layout') {
        setAdvancedTab(null);
        setMode('design');
        setActiveSection(section ?? 'Colors');
        return;
      }

      if (tab === 'Preview' || tab === 'Playthrough') {
        setAdvancedTab(null);
        setMode('preview');
        return;
      }

      if (tab === 'Editor') {
        setAdvancedTab(null);
        setMode('edit');
        if (view && VALID_EDITOR_VIEWS.has(view)) {
          setActiveEditorView(view as EditorView);
          // Only reset blueprint to Structure when entering Build; Manage/Screener/Health
          // should keep the user's sidebar section (e.g. Variables when opening Manage).
          if (view === 'build') {
            setActiveSection('Structure');
          } else if (
            section &&
            BLUEPRINT_SECTIONS_BY_TAB.Editor.includes(section)
          ) {
            setActiveSection(section);
          }
        }
        return;
      }

      if (tab && ADVANCED_WORKSPACE_TABS.has(tab)) {
        setMode('edit');
        setAdvancedTab(tab);
        setActiveSection(tab === 'Mapping' ? 'Mappings' : 'Structure');
        if (subTab && tab === 'Mapping' && VALID_MAPPING_TAB_IDS.has(subTab)) {
          setActiveMappingTab(subTab as MappingTabId);
        }
      }
    };

    window.addEventListener('formspec:navigate-workspace', onNavigateWorkspace);
    return () => window.removeEventListener('formspec:navigate-workspace', onNavigateWorkspace);
  }, [setMode]);

  const handleExport = async () => {
    await exportProjectZip(project.exportBundle());
    project.markClean();
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('e2e') !== '1') return;
    (window as unknown as { __FORMSPEC_TEST_EXPORT?: () => ReturnType<Project['exportBundle']> }).__FORMSPEC_TEST_EXPORT = () => project.exportBundle();
    return () => {
      delete (window as unknown as { __FORMSPEC_TEST_EXPORT?: unknown }).__FORMSPEC_TEST_EXPORT;
    };
  }, [project]);

  useEffect(() => {
    const handlePublish = async () => {
      if (project.diagnose().counts.error > 0) {
        alert('Cannot publish a form with validation errors. Please fix them before publishing.');
        return;
      }
      await handleExport();
      project.setMetadata({ status: 'active' });
      telemetry.emit('studio_publish_completed', { fieldCount: project.statistics().fieldCount });
    };
    window.addEventListener('formspec:publish-project', handlePublish);
    return () => window.removeEventListener('formspec:publish-project', handlePublish);
  }, [handleExport, project]);

  const handlePreviewFieldClick = useCallback(
    (path: string) => select(path, 'field', { tab: 'editor' }),
    [select],
  );

  const hasScreener = project.state.screener !== null;
  const shellBackgroundImage = getShellBackgroundImage(colorScheme?.resolvedTheme ?? 'light');

  // Chat mode: chat is primary, canvas is context
  const isChatMode = mode === 'chat';
  const isEditMode = mode === 'edit' && !advancedTab;
  const isDesignMode = mode === 'design';
  const isPreviewMode = mode === 'preview';
  const isAdvancedWorkspace = advancedTab !== null;

  // Show chat rail in edit/design modes (collapsible)
  const showChatRail = (isEditMode || isDesignMode) && panels.assistantOpen;

  return (
    <ActiveGroupProvider>
      <ChatSessionControllerProvider controller={controller}>
        <div
          data-testid="shell"
          className="relative flex h-screen flex-col overflow-hidden bg-bg-default text-ink font-ui"
          style={{ backgroundImage: shellBackgroundImage }}
        >
          <UnloadGuard project={project} />
          <Header
            activeTab={activeTab}
            onTabChange={(tab) => {
              if (tab === 'Editor') setStudioMode('edit');
              else if (tab === 'Layout' || tab === 'Design') setStudioMode('design');
              else if (tab === 'Preview') setStudioMode('preview');
              else if (ADVANCED_WORKSPACE_TABS.has(tab)) {
                setMode('edit');
                setAdvancedTab(tab);
              }
            }}
            onNew={handleNewForm}
            onExport={handleExport}
            onImport={() => setShowImport(true)}
            onSearch={() => setShowPalette(true)}
            onHome={undefined}
            onOpenMetadata={() => setShowSettings(true)}
            onToggleAccountMenu={() => setShowAppSettings(true)}
            onToggleMenu={compactLayout ? () => setShowBlueprintDrawer(true) : undefined}
            isCompact={compactLayout}
            colorScheme={colorScheme}
            mode={mode}
            onModeChange={setStudioMode}
          />
          <OpenDefinitionInEditorProvider value={openDefinitionInEditor}>
          <LayoutPreviewNavProvider>
          <LayoutModeProvider>
          <CanvasTargetsProvider>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              className={`relative flex flex-1 min-h-0 overflow-hidden ${isEditMode ? 'bg-bg-default' : ''}`}
              aria-hidden={overlayOpen ? true : undefined}
            >
              {/* Left sidebar — visible for editable project workspaces */}
              {(isEditMode || isAdvancedWorkspace || isDesignMode || isPreviewMode) && !compactLayout && (
                <>
                  <div className="glass h-full shadow-premium">
                    <BlueprintSidebar
                      activeTab={activeTab}
                      activeSection={activeSection}
                      onSectionChange={setActiveSection}
                      activeEditorView={activeEditorView}
                      compactLayout={compactLayout}
                      leftWidth={leftWidth}
                    />
                  </div>
                  <ResizeHandle side="left" onResize={onResizeLeft} />
                </>
              )}

              {/* Main content area */}
              <main className="flex min-h-0 flex-1 shrink-0 min-w-0 flex-col overflow-y-auto">
                {isChatMode && (
                  <div className="flex h-full">
                    {/* Chat thread — center */}
                    <div className="flex-1 min-w-0">
                      <ChatPanel
                        project={project}
                        surfaceLayout="primary"
                      />
                    </div>
                    {/* Live canvas context — right (desktop only) */}
                    {!compactLayout && showPreview && (
                      <div className="glass w-[380px] shrink-0 shadow-premium">
                        <PreviewCompanionPanel
                          width={380}
                          appearance={colorScheme?.resolvedTheme ?? 'light'}
                          highlightFieldPath={primaryKey}
                          onFieldClick={handlePreviewFieldClick}
                          onClose={() => setShowPreview(false)}
                        />
                      </div>
                    )}
                  </div>
                )}

                {isEditMode && (
                  <div
                    data-testid="workspace-Editor"
                    className="h-full flex flex-col px-4 py-4 md:px-8 md:py-6 lg:px-12 lg:py-8 xl:px-16"
                    onClick={(event) => {
                      if (event.target === event.currentTarget) deselect();
                    }}
                  >
                    <div
                      data-testid="editor-deselect-hitbox"
                      className="h-4 shrink-0 w-full cursor-default"
                      aria-hidden
                      onClick={(event) => {
                        event.stopPropagation();
                        deselect();
                      }}
                    />
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
                  </div>
                )}


                {isAdvancedWorkspace && (
                  <div className="h-full flex flex-col" data-testid={`workspace-${activeTab}`}>
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
                  </div>
                )}

                {isDesignMode && (
                  <div className="flex min-h-0 flex-1 flex-col" data-testid="workspace-Design">
                    <div
                      data-testid="design-canvas-shell"
                      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-subtle/30"
                    >
                      <div data-testid="workspace-Layout" className="min-h-0 min-w-0 flex-1">
                        <LayoutCanvas />
                      </div>
                    </div>
                  </div>
                )}

                {isPreviewMode && (
                  <div className="h-full flex flex-col" data-testid="workspace-Preview">
                    <WorkspaceContent
                      activeTab="Preview"
                      activeEditorView="build"
                      setActiveEditorView={() => {}}
                      manageCount={0}
                      hasScreener={false}
                      activeMappingTab="all"
                      setActiveMappingTab={setActiveMappingTab}
                      mappingConfigOpen={mappingConfigOpen}
                      setMappingConfigOpen={setMappingConfigOpen}
                      previewViewport={previewViewport}
                      setPreviewViewport={setPreviewViewport}
                      previewMode={previewMode}
                      setPreviewMode={setPreviewMode}
                      appearance={colorScheme?.resolvedTheme ?? 'light'}
                    />
                  </div>
                )}
              </main>

              {/* Right panels — mode-dependent */}
              {isEditMode && !compactLayout && showRightPanel && (
                <>
                  <ResizeHandle side="right" onResize={onResizeRight} />
                  <aside
                    className="flex flex-col overflow-hidden shrink-0 border-l border-border/70 bg-surface"
                    style={{ width: `clamp(200px, ${rightWidth}px, calc(50vw - 340px))` }}
                    data-testid="properties-panel"
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
                    <div className="min-h-0 flex-1 overflow-hidden">
                      <FormHealthPanel />
                    </div>
                  </aside>
                </>
              )}

              {isDesignMode && !compactLayout && !assistantOpen && !showPreview && (
                showLayoutPreviewPanel ? (
                  <>
                    <ResizeHandle side="right" onResize={onResizeRight} />
                    <aside
                      className="flex shrink-0 flex-col overflow-hidden border-l border-border/70 bg-surface"
                      style={{ width: `clamp(280px, ${rightWidth}px, calc(50vw - 260px))` }}
                      data-testid="layout-preview-panel"
                      aria-label="Layout live preview"
                    >
                      <div className="flex shrink-0 items-center justify-end px-3 pt-2">
                        <button
                          type="button"
                          aria-label="Hide layout preview panel"
                          className="rounded p-1 text-muted transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                          onClick={() => setShowLayoutPreviewPanel(false)}
                        >
                          <IconChevronRight size={14} />
                        </button>
                      </div>
                      <div className="min-h-0 flex-1 px-3 pb-3">
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
                    className="shrink-0 border-l border-border/70 bg-surface px-1.5 py-3 text-muted transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                    onClick={() => setShowLayoutPreviewPanel(true)}
                  >
                    <IconChevronLeft size={14} />
                  </button>
                )
              )}

              {/* Chat rail in edit/design modes */}
              {showChatRail && (
                <div
                  id="chat-panel-container"
                  data-testid="chat-rail"
                  aria-label="AI assistant"
                  className="flex w-[360px] shrink-0 min-h-0 flex-col border-l border-border/70 bg-surface"
                >
                  <ChatPanel
                    project={project}
                    surfaceLayout="rail"
                    onClose={() => panels.setAssistantOpen(false)}
                  />
                </div>
              )}

              {/* Preview floating chat pill */}
              {isPreviewMode && !compactLayout && (
                <button
                  type="button"
                  aria-label="Open AI assistant"
                  className="fixed bottom-20 right-6 z-30 rounded-full bg-accent px-4 py-3 text-white shadow-lg hover:bg-accent/90 transition-colors"
                  onClick={() => setStudioMode('chat')}
                >
                  Ask AI
                </button>
              )}
            </div>
            </div>
          </CanvasTargetsProvider>
          </LayoutModeProvider>
          </LayoutPreviewNavProvider>
          </OpenDefinitionInEditorProvider>
          <StatusBar onAskAI={() => setStudioMode('chat')} />
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
      </ChatSessionControllerProvider>
    </ActiveGroupProvider>
  );
}
