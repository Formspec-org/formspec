/** @filedesc Segmented mode switcher for the four primary Studio modes. */
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
import { useWorkspaceRouter } from '../providers/WorkspaceRouterProvider';
import { type Project, buildDefLookup, createProject } from '@formspec-org/studio-core';
import { isOnboardingCompleted, shouldShowOnboarding } from '../onboarding/onboarding-storage';
import { OnboardingOverlay } from '../onboarding/OnboardingOverlay';
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
import { dispatchStudioEvent, addStudioEventListener, STUDIO_EVENTS } from '../studio-events';

import {
  IconActivity,
  IconChevronRight,
  IconChevronLeft,
  IconMonitor,
  IconClock,
  IconGrid,
  IconSparkle,
} from '../components/icons';

export function UnifiedStudio(): ReactElement {
  const project = useProject();
  const [showOnboarding, setShowOnboarding] = useState(() => shouldShowOnboarding());
  const { mode } = useMode();
  const colorScheme = useColorScheme();
  const { primaryKey, primaryKeyForTab, deselect, select, reveal, selectionScopeTab } = useSelection();
  const [chatRailElement, setChatRailElement] = useState<HTMLDivElement | null>(null);

  const router = useWorkspaceRouter();
  const {
    activeTab,
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
    advancedTab,
    leftTab,
    setLeftTab,
    leftCollapsed,
    setLeftCollapsed,
    setStudioMode,
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

  const editor = useEditorState();
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
    showPreview,
    setShowPreview,
    assistantOpen,
    setAssistantOpen,
  } = panels;

  const scopedSelectedKey = primaryKeyForTab(activeTab.toLowerCase());
  useKeyboardShortcuts(activeTab, project, scopedSelectedKey, setShowPalette);

  // Blueprint sidebar
  const { visibleSections, resolvedSection } = useBlueprintSectionResolution(activeTab, activeSection);

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
      dispatchStudioEvent(STUDIO_EVENTS.TOGGLE_PREVIEW_COMPANION, { open });
      return { ok: true };
    },
    switchMode: (newMode: string) => {
      const valid = ['chat', 'edit', 'design', 'preview'];
      if (!valid.includes(newMode)) {
        return { ok: false, reason: `Invalid mode "${newMode}". Must be one of: ${valid.join(', ')}` };
      }
      router.setStudioMode(newMode as StudioMode);
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
      router.setStudioMode('preview');
      return { ok: true };
    },
  }), [project, reveal, mode, router]);

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
    router.setAdvancedTab(null);
    router.setStudioMode('chat');
    router.setActiveSection('Structure');
    router.setActiveEditorView('build');
    router.setActiveMappingTab('all');
    router.setMappingConfigOpen(true);
    router.setPreviewViewport('desktop');
    router.setPreviewMode('form');
    setShowPalette(false);
    setShowImport(false);
    deselect();
    if (!isOnboardingCompleted()) {
      dispatchStudioEvent(STUDIO_EVENTS.RESTART_ONBOARDING);
    }
  }, [project, router, setShowPalette, setShowImport, deselect]);

  const openDefinitionInEditor = useCallback(
    (defPath: string, kind: DefinitionEditorItemKind) => {
      router.setStudioMode('edit');
      router.setActiveEditorView('build');
      select(defPath, kind, { tab: 'editor', focusInspector: true });
      setShowRightPanel(true);
    },
    [select, router, setShowRightPanel],
  );

  useEffect(() => {
    const handleRestartOnboarding = () => {
      setShowOnboarding(true);
    };
    return addStudioEventListener(STUDIO_EVENTS.RESTART_ONBOARDING, handleRestartOnboarding);
  }, []);

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
    return addStudioEventListener(STUDIO_EVENTS.PUBLISH_PROJECT, handlePublish);
  }, [handleExport, project]);

  const handlePreviewFieldClick = useCallback(
    (path: string) => select(path, 'field', { tab: 'editor' }),
    [select],
  );

  const hasScreener = project.state.screener !== null;


  // Chat mode: chat is primary, canvas is context
  const isChatMode = mode === 'chat';
  const isEditMode = mode === 'edit' && !advancedTab;
  const isDesignMode = mode === 'design';
  const isPreviewMode = mode === 'preview';
  const isAdvancedWorkspace = advancedTab !== null;

  // Show chat rail in edit/design modes (collapsible)
  const showChatRail = (isEditMode || isDesignMode) && panels.assistantOpen;

  useEffect(() => {
    if (assistantOpen && !isChatMode) {
      setLeftTab('chat');
      setLeftCollapsed(false);
    } else if (!assistantOpen && !isChatMode && leftTab === 'chat') {
      setLeftTab('blueprint');
    }
  }, [assistantOpen, isChatMode, leftTab]);

  const activeLeftTab = isChatMode 
    ? (leftTab === 'chat' ? 'history' : leftTab) 
    : (leftTab === 'history' ? 'blueprint' : leftTab);

  return (
    <ActiveGroupProvider>
      <ChatSessionControllerProvider controller={controller}>
        <div
          data-testid="shell"
          className="relative flex h-screen flex-col overflow-hidden bg-bg-default text-ink font-ui"

        >
          <UnloadGuard project={project} />
          {/* Full shell: mode switcher plus workspace tabs so Evidence/Mapping stay reachable from the header. */}
          <Header
            activeTab={activeTab}
            onTabChange={router.setActiveTab}
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
              {/* Left sidebar — visible for editable project workspaces OR chat mode */}
              {(isEditMode || isAdvancedWorkspace || isDesignMode || isPreviewMode || isChatMode) && !compactLayout && (
                <>
                  {leftCollapsed ? (
                    <aside className="flex w-16 shrink-0 flex-col items-center gap-6 border-r border-border/40 bg-subtle/10 backdrop-blur-xl py-8 h-full z-10">
                      {!isChatMode && (
                        <button
                          type="button"
                          onClick={() => { setLeftTab('chat'); setAssistantOpen(true); setLeftCollapsed(false); }}
                          className={`flex items-center justify-center w-10 h-10 rounded-2xl border border-border/40 text-[11px] font-black shadow-premium-sm transition-all ${
                            activeLeftTab === 'chat' ? 'bg-accent/10 text-accent border-accent/40' : 'bg-surface text-muted hover:text-accent hover:border-accent/40'
                          }`}
                          aria-label="Expand Chat"
                          title="Chat"
                        >
                          <IconSparkle size={16} />
                        </button>
                      )}
                      {isChatMode && (
                        <button
                          type="button"
                          onClick={() => { setLeftTab('history'); setLeftCollapsed(false); }}
                          className={`flex items-center justify-center w-10 h-10 rounded-2xl border border-border/40 text-[11px] font-black shadow-premium-sm transition-all ${
                            activeLeftTab === 'history' ? 'bg-accent/10 text-accent border-accent/40' : 'bg-surface text-muted hover:text-accent hover:border-accent/40'
                          }`}
                          aria-label="Expand History"
                          title="History"
                        >
                          <IconClock size={16} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { setLeftTab('blueprint'); setLeftCollapsed(false); }}
                        className={`flex items-center justify-center w-10 h-10 rounded-2xl border border-border/40 text-[11px] font-black shadow-premium-sm transition-all ${
                          activeLeftTab === 'blueprint' ? 'bg-accent/10 text-accent border-accent/40' : 'bg-surface text-muted hover:text-accent hover:border-accent/40'
                        }`}
                        aria-label="Expand Blueprint"
                        title="Blueprint"
                      >
                        <IconGrid size={16} />
                      </button>
                    </aside>
                  ) : (
                    <>
                      <div 
                        className="flex shrink-0 flex-col overflow-y-auto border-r border-border/40 glass h-full"
                        style={{ width: `clamp(200px, ${leftWidth}px, calc(50vw - 300px))` }}
                      >
                        <div className="flex items-center gap-2 p-3 border-b border-border/20 bg-surface/50 shrink-0">
                          {isChatMode ? (
                            <button
                              className={`flex-1 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${
                                activeLeftTab === 'history' ? 'bg-accent/10 text-accent shadow-sm' : 'text-muted hover:bg-subtle'
                              }`}
                              onClick={() => setLeftTab('history')}
                            >
                              History
                            </button>
                          ) : (
                            <button
                              className={`flex-1 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                                activeLeftTab === 'chat' ? 'bg-accent/10 text-accent shadow-sm' : 'text-muted hover:bg-subtle'
                              }`}
                              onClick={() => { setLeftTab('chat'); setAssistantOpen(true); }}
                            >
                              <IconSparkle size={12} />
                              Chat
                            </button>
                          )}
                          <button
                            className={`flex-1 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${
                              activeLeftTab === 'blueprint' ? 'bg-accent/10 text-accent shadow-sm' : 'text-muted hover:bg-subtle'
                            }`}
                            onClick={() => setLeftTab('blueprint')}
                          >
                            Blueprint
                          </button>
                          <button
                            type="button"
                            onClick={() => setLeftCollapsed(true)}
                            className="flex shrink-0 items-center justify-center w-7 h-7 rounded-full border border-border/40 text-muted hover:bg-surface hover:text-accent hover:border-accent/40 transition-all shadow-sm ml-1"
                            aria-label="Collapse sidebar"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                          </button>
                        </div>
                        
                        <div 
                          className={`flex-1 min-h-0 overflow-y-auto scrollbar-none flex flex-col ${activeLeftTab !== 'history' ? 'hidden' : ''}`} 
                          ref={setChatRailElement} 
                        />
                        
                        <div className={`flex-1 min-h-0 flex flex-col ${activeLeftTab !== 'blueprint' ? 'hidden' : ''}`}>
                          <BlueprintSidebar
                            activeTab={activeTab}
                            activeSection={activeSection}
                            onSectionChange={setActiveSection}
                            activeEditorView={activeEditorView}
                            compactLayout={compactLayout}
                            leftWidth={leftWidth}
                            embedded={true}
                          />
                        </div>

                        {!isChatMode && (
                          <div className={`flex-1 min-h-0 flex flex-col ${activeLeftTab !== 'chat' ? 'hidden' : ''}`}>
                            <ChatPanel
                              project={project}
                              surfaceLayout="rail"
                              hideHeader={true}
                              workspaceRail={{ attach: 'omit' }}
                              onClose={() => { setLeftTab('blueprint'); setAssistantOpen(false); }}
                            />
                          </div>
                        )}
                      </div>
                      <ResizeHandle side="left" onResize={onResizeLeft} />
                    </>
                  )}
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
                        workspaceRail={{ attach: 'portal', portalContainer: chatRailElement ?? undefined }}
                      />
                    </div>
                    {/* Live canvas context — right (desktop only) */}
                    {!compactLayout && showPreview && (
                      <div className="glass w-[380px] shrink-0">
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
	                    <WorkspaceContent />
                  </div>
                )}


                {isAdvancedWorkspace && (
                  <div className="h-full flex flex-col" data-testid={`workspace-${activeTab}`}>
                    <WorkspaceContent />
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
                    <WorkspaceContent />
                  </div>
                )}
              </main>

              {/* Right panels — mode-dependent */}
              {isEditMode && !compactLayout && showRightPanel && (
                <>
                  <ResizeHandle side="right" onResize={onResizeRight} />
                  <aside
                    className="panel-aside"
                    style={{ width: `clamp(200px, ${rightWidth}px, calc(50vw - 340px))` }}
                    data-testid="properties-panel"
                  >
                    <div className="flex items-center justify-end px-3 pt-2 shrink-0">
                      <button
                        type="button"
                        aria-label="Hide panel"
                        className="panel-close-btn"
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
                      className="panel-aside"
                      style={{ width: `clamp(280px, ${rightWidth}px, calc(50vw - 260px))` }}
                      data-testid="layout-preview-panel"
                      aria-label="Layout live preview"
                    >
                      <div className="flex shrink-0 items-center justify-end px-3 pt-2">
                        <button
                          type="button"
                          aria-label="Hide layout preview panel"
                          className="panel-close-btn"
                          onClick={() => setShowLayoutPreviewPanel(false)}
                        >
                          <IconChevronRight size={14} />
                        </button>
                      </div>
                      <div className="min-h-0 flex-1 px-3 pb-3">
                        <div className="h-full overflow-hidden rounded-lg border border-border bg-surface">
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
                    className="shrink-0 border-l border-border/70 bg-surface px-1.5 py-3 text-muted transition-colors hover:bg-subtle hover:text-ink focus-ring"
                    onClick={() => setShowLayoutPreviewPanel(true)}
                  >
                    <IconChevronLeft size={14} />
                  </button>
                )
              )}



              {/* Preview floating chat pill */}
              {isPreviewMode && !compactLayout && (
                <button
                  type="button"
                  aria-label="Open AI assistant"
                  className="fixed bottom-20 right-6 z-30 rounded-md bg-accent px-4 py-3 text-surface shadow-lg hover:bg-accent/90 transition-colors"
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
          {showOnboarding && (
            <OnboardingOverlay 
              project={project} 
              onComplete={() => setShowOnboarding(false)} 
            />
          )}
        </div>
      </ChatSessionControllerProvider>
    </ActiveGroupProvider>
  );
}
