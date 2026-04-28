/** @filedesc Full-screen assistant workspace — starters, import, and composer before the tabbed builder. */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { DragEvent, RefObject } from 'react';
import type { Project, ProjectBundle } from '@formspec-org/studio-core';
import { ChatPanel, type SourceUploadSummary, type WorkspaceRailPlacement } from '../components/ChatPanel.js';
import {
  createLocalChatThreadRepository,
  deriveChatProjectScope,
  type ChatThreadRepository,
} from '../components/chat/chat-thread-repository.js';
import { createLocalVersionRepository, type VersionRepository } from '../components/chat/version-repository.js';
import { Header } from '../components/Header.js';
import { StatusBar } from '../components/StatusBar.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { StudioWorkspaceModals } from '../components/shell/StudioWorkspaceModals.js';
import { BlueprintSidebar } from '../components/shell/BlueprintSidebar.js';
import { getShellBackgroundImage } from '../components/shell/shell-background-image.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import { useShellLayout } from '../hooks/useShellLayout.js';
import { useProject } from '../state/useProject.js';
import { useSelection } from '../state/useSelection.js';
import {
  ASSISTANT_COMPOSER_INPUT_TEST_ID,
  ASSISTANT_KEYBOARD_WORKSPACE,
  ASSISTANT_WORKSPACE_TEST_ID,
} from '../constants/assistant-dom.js';
import type { ColorScheme } from '../hooks/useColorScheme.js';
import { blankDefinition } from '../fixtures/blank-definition.js';
import { starterCatalog, type StarterCatalogEntry } from './starter-catalog.js';
import { emitOnboardingTelemetry } from './onboarding-telemetry.js';
import {
  ONBOARDING_ORIENTATION_KEY,
  isAssistantStartDrawerPinned,
  setAssistantStartDrawerPinned,
} from './onboarding-storage.js';
import type { EnterWorkspaceSource } from './enter-workspace-source.js';
import {
  IconArrowUp,
  IconCheck,
  IconClose,
  IconGrid,
  IconPen,
  IconStack,
  IconUpload,
  IconWarning,
} from '../components/icons/index.js';

export interface AssistantWorkspaceProps {
  project: Project;
  onEnterStudio: () => void;
  /** When provided, theme toggle matches the tabbed Studio shell. */
  colorScheme?: ColorScheme;
  chatThreadRepository?: import('../components/chat/chat-thread-repository').ChatThreadRepository;
  versionRepository?: import('../components/chat/version-repository').VersionRepository;
  chatProjectScope?: string;
}

type MobileSheet = 'start' | 'snapshot' | 'diagnostics' | null;

/** Which panel is open in the lg slide-over (one at a time). */
type SetupDrawerTab = 'start' | 'blueprint' | 'workspace';

interface SourceState {
  status: 'empty' | 'processing' | 'ready' | 'error';
  name?: string;
  type?: string;
  size?: number;
  fieldCount?: number;
  message?: string;
}

export function AssistantWorkspace({ project, onEnterStudio, colorScheme, chatThreadRepository, versionRepository, chatProjectScope }: AssistantWorkspaceProps) {
  const { compactLayout, leftWidth } = useShellLayout();
  const projectFromContext = useProject();
  const { selectedKeyForTab, deselect } = useSelection();
  const scopedEditorSelection = selectedKeyForTab('editor');
  const shellBackgroundImage = getShellBackgroundImage(colorScheme?.resolvedTheme ?? 'light');
  const [selectedStarterId, setSelectedStarterId] = useState(starterCatalog[0]?.id ?? '');
  const [showImport, setShowImport] = useState(false);
  const [showAppSettings, setShowAppSettings] = useState(false);
  const [showFormSettings, setShowFormSettings] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [orientationOpen, setOrientationOpen] = useState(() => {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem(ONBOARDING_ORIENTATION_KEY) !== 'dismissed';
  });
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null);
  const [startDrawerPinned, setStartDrawerPinned] = useState(() =>
    typeof localStorage !== 'undefined' && isAssistantStartDrawerPinned(localStorage),
  );
  const [startDrawerOpen, setStartDrawerOpen] = useState(true);
  const [setupDrawerTab, setSetupDrawerTab] = useState<SetupDrawerTab>('start');
  const [assistantBlueprintSection, setAssistantBlueprintSection] = useState('Structure');
  const startDrawerPinnedRef = useRef(startDrawerPinned);
  const [assistantTouched, setAssistantTouched] = useState(false);
  const replaceResolveRef = useRef<((confirmed: boolean) => void) | null>(null);
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false);
  const [replaceConfirmDescription, setReplaceConfirmDescription] = useState('');
  const [sourceState, setSourceState] = useState<SourceState>({ status: 'empty' });
  const [uploadHandler, setUploadHandler] = useState<((file: File) => void) | null>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const starterRailRef = useRef<HTMLDivElement>(null);
  const assistantWorkspaceRailSlotRef = useRef<HTMLDivElement>(null);
  const assistantBlueprintPanelRef = useRef<HTMLDivElement>(null);
  const [assistantWorkspaceRailHost, setAssistantWorkspaceRailHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    startDrawerPinnedRef.current = startDrawerPinned;
  }, [startDrawerPinned]);

  useLayoutEffect(() => {
    if (compactLayout || !startDrawerOpen || setupDrawerTab !== 'workspace') {
      setAssistantWorkspaceRailHost(null);
      return;
    }
    setAssistantWorkspaceRailHost(assistantWorkspaceRailSlotRef.current);
  }, [compactLayout, setupDrawerTab, startDrawerOpen]);

  useEffect(() => {
    if (!startDrawerOpen) return;
    const id = window.setTimeout(() => {
      if (setupDrawerTab === 'start') {
        starterRailRef.current?.focus();
      } else if (setupDrawerTab === 'blueprint') {
        assistantBlueprintPanelRef.current?.focus();
      } else {
        assistantWorkspaceRailSlotRef.current?.focus();
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [setupDrawerTab, startDrawerOpen]);

  /** Left toolbar: second click on the active tab closes the drawer. */
  const toggleSetupDrawerFromToolbar = useCallback(
    (tab: SetupDrawerTab) => {
      if (startDrawerOpen && setupDrawerTab === tab) {
        setStartDrawerOpen(false);
        return;
      }
      setSetupDrawerTab(tab);
      setStartDrawerOpen(true);
    },
    [setupDrawerTab, startDrawerOpen],
  );

  const onboardingWorkspaceRail = useMemo((): WorkspaceRailPlacement => {
    if (compactLayout) return { attach: 'dock' };
    if (startDrawerOpen && setupDrawerTab === 'workspace' && assistantWorkspaceRailHost) {
      return { attach: 'portal', portalContainer: assistantWorkspaceRailHost };
    }
    return { attach: 'omit' };
  }, [assistantWorkspaceRailHost, compactLayout, setupDrawerTab, startDrawerOpen]);
  const viewedEventSentRef = useRef(false);
  const firstEditEventSentRef = useRef(false);
  const initialFieldCountRef = useRef<number | null>(null);
  const [, forceRender] = useState(0);

  const stats = project.statistics();
  /** True once the draft has any top-level items; hides first-run marketing hero (subscribe so AI/scaffold updates apply). */
  const definitionItemCount = useSyncExternalStore(
    useCallback((onStoreChange) => project.onChange(onStoreChange), [project]),
    useCallback(() => (project.state.definition.items?.length ?? 0), [project]),
    useCallback(() => (project.state.definition.items?.length ?? 0), [project]),
  );
  const hasFormStructure = definitionItemCount > 0;
  const diagnostics = project.diagnose();
  const selectedStarter = starterCatalog.find((starter) => starter.id === selectedStarterId) ?? starterCatalog[0];
  const changeset = useSyncExternalStore(
    useCallback((onStoreChange) => project.proposals?.subscribe(onStoreChange) ?? (() => {}), [project]),
    useCallback(() => project.proposals?.getChangeset() ?? null, [project]),
    useCallback(() => project.proposals?.getChangeset() ?? null, [project]),
  );
  const pendingProposalCount = changeset && (changeset.status === 'pending' || changeset.status === 'open')
    ? changeset.aiEntries.length + changeset.userOverlay.length
    : 0;
  const diagnosticEntries = useMemo(() => {
    const entries = [
      ...(diagnostics.structural ?? []),
      ...(diagnostics.expressions ?? []),
      ...(diagnostics.extensions ?? []),
      ...(diagnostics.consistency ?? []),
    ];
    return entries.map((entry) => ({
      severity: entry.severity === 'warning' ? 'warning' : 'error',
      message: entry.message ?? String(entry),
      path: entry.path,
    }));
  }, [diagnostics]);

  const localChatRepoRef = useRef<import('../components/chat/chat-thread-repository').ChatThreadRepository | null>(null);
  const localVersionRepoRef = useRef<import('../components/chat/version-repository').VersionRepository | null>(null);
  if (!chatThreadRepository && !localChatRepoRef.current) {
    localChatRepoRef.current = createLocalChatThreadRepository();
  }
  if (!versionRepository && !localVersionRepoRef.current) {
    localVersionRepoRef.current = createLocalVersionRepository();
  }
  const derivedChatProjectScope = useMemo(() => deriveChatProjectScope(project), [project]);
  const assistantChatRepository = chatThreadRepository ?? localChatRepoRef.current!;
  const assistantVersionRepository = versionRepository ?? localVersionRepoRef.current!;
  const assistantPersistenceScope = chatProjectScope ?? derivedChatProjectScope;

  useEffect(() => {
    const openSettings = () => setShowAppSettings(true);
    window.addEventListener('formspec:open-app-settings', openSettings);
    return () => window.removeEventListener('formspec:open-app-settings', openSettings);
  }, []);

  const dismissOrientation = useCallback(() => {
    localStorage.setItem(ONBOARDING_ORIENTATION_KEY, 'dismissed');
    setOrientationOpen(false);
  }, []);

  const reopenOrientation = useCallback(() => {
    localStorage.removeItem(ONBOARDING_ORIENTATION_KEY);
    setOrientationOpen(true);
  }, []);

  const enterWorkspaceFromAssistant = useCallback(
    (source: EnterWorkspaceSource) => {
      emitOnboardingTelemetry('onboarding_enter_workspace_intent', { enterWorkspaceSource: source });
      onEnterStudio();
    },
    [onEnterStudio],
  );

  const onAssistantEscape = useCallback(() => {
    if (startDrawerOpen) {
      setStartDrawerOpen(false);
      return;
    }
    if (showImport) {
      setShowImport(false);
      return;
    }
    if (showFormSettings) {
      setShowFormSettings(false);
      return;
    }
    if (showAppSettings) {
      setShowAppSettings(false);
      return;
    }
    if (showPalette) {
      setShowPalette(false);
      return;
    }
    if (mobileSheet) {
      setMobileSheet(null);
      return;
    }
    if (orientationOpen && compactLayout) {
      dismissOrientation();
      return;
    }
    deselect();
  }, [
    startDrawerOpen,
    showImport,
    showFormSettings,
    showAppSettings,
    showPalette,
    mobileSheet,
    orientationOpen,
    compactLayout,
    dismissOrientation,
    deselect,
  ]);

  useKeyboardShortcuts(ASSISTANT_KEYBOARD_WORKSPACE, projectFromContext, scopedEditorSelection, setShowPalette, {
    escape: onAssistantEscape,
  });

  useEffect(() => {
    if (viewedEventSentRef.current) return;
    viewedEventSentRef.current = true;
    emitOnboardingTelemetry('onboarding_viewed');
  }, []);

  useEffect(() => {
    if (initialFieldCountRef.current === null) {
      initialFieldCountRef.current = stats.fieldCount;
      return;
    }
    if (firstEditEventSentRef.current) return;
    if (stats.fieldCount <= initialFieldCountRef.current) return;
    firstEditEventSentRef.current = true;
    emitOnboardingTelemetry('onboarding_first_meaningful_edit', { trigger: 'field_count_increase' });
  }, [stats.fieldCount]);

  const requestReplaceConfirm = useCallback((label: string): Promise<boolean> => {
    if (!project.isDirty && !assistantTouched) return Promise.resolve(true);
    return new Promise((resolve) => {
      replaceResolveRef.current = resolve;
      setReplaceConfirmDescription(`${label} will replace the current project. Continue?`);
      setReplaceConfirmOpen(true);
    });
  }, [assistantTouched, project]);

  const completeReplaceConfirm = useCallback((confirmed: boolean) => {
    replaceResolveRef.current?.(confirmed);
    replaceResolveRef.current = null;
    setReplaceConfirmOpen(false);
  }, []);

  /** After starter / blank / import / upload — show structure in the blueprint drawer. */
  const openAssistantBlueprint = useCallback(() => {
    setSetupDrawerTab('blueprint');
    setStartDrawerOpen(true);
    setMobileSheet(null);
  }, []);

  const replaceProject = useCallback(
    (bundle: Partial<ProjectBundle>, label: string, afterReplace?: 'open-blueprint-drawer') => {
      const apply = () => {
        project.loadBundle(bundle);
        project.markClean();
        setAssistantTouched(false);
        forceRender((value) => value + 1);
        if (afterReplace === 'open-blueprint-drawer') {
          openAssistantBlueprint();
        }
      };
      if (project.isDirty || assistantTouched) {
        void requestReplaceConfirm(label).then((ok) => {
          if (ok) apply();
        });
        return;
      }
      apply();
    },
    [assistantTouched, project, requestReplaceConfirm, openAssistantBlueprint],
  );

  const useStarter = (starter: StarterCatalogEntry) => {
    setSelectedStarterId(starter.id);
    emitOnboardingTelemetry('onboarding_starter_selected', { starterId: starter.id });
    replaceProject(starter.bundle, `Use ${starter.title}`, 'open-blueprint-drawer');
  };

  const resetBlank = () => {
    replaceProject({ definition: blankDefinition }, 'Blank form reset', 'open-blueprint-drawer');
  };

  const loadJsonSourceFile = useCallback(async (file: File) => {
    setSourceState({
      status: 'processing',
      name: file.name,
      type: classifySourceType(file),
      size: file.size,
      message: 'Reading JSON source.',
    });
    try {
      const bundle = parseJsonSourceBundle(await file.text());
      const ok = await requestReplaceConfirm(`Load ${file.name}`);
      if (!ok) {
        setSourceState({ status: 'empty' });
        return;
      }
      project.loadBundle(bundle);
      setAssistantTouched(true);
      setSourceState({
        status: 'ready',
        name: file.name,
        type: 'JSON',
        size: file.size,
        fieldCount: project.statistics().fieldCount,
        message: `Loaded ${file.name} into this project.`,
      });
      forceRender((value) => value + 1);
      openAssistantBlueprint();
    } catch (error) {
      setSourceState({
        status: 'error',
        name: file.name,
        type: 'JSON',
        size: file.size,
        message: error instanceof Error ? error.message : 'Could not load JSON source.',
      });
    }
  }, [requestReplaceConfirm, project, openAssistantBlueprint]);

  const handleSourceFile = useCallback((file: File | null) => {
    if (!file) return;
    if (isJsonSourceFile(file)) {
      void loadJsonSourceFile(file);
      return;
    }
    if (!uploadHandler) {
      setSourceState({
        status: 'error',
        name: file.name,
        type: classifySourceType(file),
        size: file.size,
        message: 'Configure the assistant provider before analyzing source files. JSON bundles can still be imported.',
      });
      setShowAppSettings(true);
      return;
    }
    uploadHandler(file);
  }, [loadJsonSourceFile, uploadHandler]);

  const handleSourceUploadStart = useCallback((file: File) => {
    setAssistantTouched(true);
    setSourceState({
      status: 'processing',
      name: file.name,
      type: classifySourceType(file),
      size: file.size,
      message: 'Reading the source and asking the assistant to extract form structure.',
    });
  }, []);

  const markAssistantTouched = useCallback(() => {
    setAssistantTouched(true);
  }, []);

  const handleSourceUploadComplete = useCallback(
    (summary: SourceUploadSummary) => {
      setSourceState({
        status: 'ready',
        name: summary.name,
        type: summary.type.toUpperCase(),
        fieldCount: summary.fieldCount,
        message: summary.message,
      });
      forceRender((value) => value + 1);
      openAssistantBlueprint();
    },
    [openAssistantBlueprint],
  );

  const handleUploadHandlerReady = useCallback((handler: ((file: File) => void) | null) => {
    setUploadHandler(() => handler);
  }, []);

  const handleStartDrawerPinChange = useCallback((pinned: boolean) => {
    setStartDrawerPinned(pinned);
    setAssistantStartDrawerPinned(pinned);
    if (pinned) {
      setStartDrawerOpen(true);
      setSetupDrawerTab('start');
    }
  }, []);

  return (
    <div
      data-testid={ASSISTANT_WORKSPACE_TEST_ID}
      className="relative flex h-screen min-h-0 flex-col overflow-hidden bg-bg-default text-ink font-ui"
      style={{ backgroundImage: shellBackgroundImage }}
    >
      <a href={`#${ASSISTANT_COMPOSER_INPUT_TEST_ID}`} className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-accent focus:px-3 focus:py-2 focus:text-white">
        Skip to assistant composer
      </a>
      <Header
        activeTab="Editor"
        onTabChange={() => {}}
        onImport={() => setShowImport(true)}
        onSearch={() => setShowPalette(true)}
        onOpenMetadata={() => setShowFormSettings(true)}
        onToggleAccountMenu={() => setShowAppSettings(true)}
        assistantMenu={null}
        assistantSurface={{
          onEnterWorkspace: enterWorkspaceFromAssistant,
          onReopenHelp: reopenOrientation,
          showHelpButton: !orientationOpen,
        }}
        isCompact={compactLayout}
        colorScheme={colorScheme}
      />

      <main className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className="hidden w-[52px] shrink-0 flex-col items-stretch border-r border-border/80 bg-surface/90 dark:bg-surface/85 lg:flex"
          role="toolbar"
          aria-label="Assistant setup, blueprint, and workspace"
        >
          <button
            type="button"
            data-testid="assistant-start-open"
            className={`mx-1 mt-2 flex w-[calc(100%-8px)] flex-col items-center gap-1 rounded-md border border-transparent px-0.5 py-2.5 text-[9px] font-semibold uppercase tracking-[0.08em] transition-colors hover:bg-subtle/80 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 ${
              startDrawerOpen && setupDrawerTab === 'start'
                ? 'border-accent/25 bg-accent/10 text-ink shadow-[inset_0_0_0_1px_rgba(125,154,255,0.15)]'
                : 'text-muted'
            }`}
            onClick={() => toggleSetupDrawerFromToolbar('start')}
            aria-pressed={startDrawerOpen && setupDrawerTab === 'start'}
            aria-expanded={startDrawerOpen && setupDrawerTab === 'start'}
            aria-controls="assistant-start-drawer"
            title="Start — templates, import, starters"
          >
            <IconGrid size={18} className={startDrawerOpen && setupDrawerTab === 'start' ? 'text-accent' : 'text-accent/80'} aria-hidden />
            <span className="max-w-[2.75rem] text-center leading-[1.15]">Start</span>
          </button>
          <button
            type="button"
            data-testid="assistant-blueprint-open"
            className={`mx-1 flex w-[calc(100%-8px)] flex-col items-center gap-1 rounded-md border border-transparent px-0.5 py-2.5 text-[9px] font-semibold uppercase tracking-[0.08em] transition-colors hover:bg-subtle/80 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 ${
              startDrawerOpen && setupDrawerTab === 'blueprint'
                ? 'border-accent/25 bg-accent/10 text-ink shadow-[inset_0_0_0_1px_rgba(125,154,255,0.15)]'
                : 'text-muted'
            }`}
            onClick={() => toggleSetupDrawerFromToolbar('blueprint')}
            aria-pressed={startDrawerOpen && setupDrawerTab === 'blueprint'}
            aria-expanded={startDrawerOpen && setupDrawerTab === 'blueprint'}
            aria-controls="assistant-start-drawer"
            title="Blueprint — same structure sidebar as the workspace (Editor)"
          >
            <IconPen size={17} className={startDrawerOpen && setupDrawerTab === 'blueprint' ? 'text-accent' : 'text-accent/80'} aria-hidden />
            <span className="max-w-[2.75rem] text-center leading-[1.15]">BP</span>
          </button>
          <button
            type="button"
            data-testid="assistant-workspace-open"
            className={`mx-1 mb-1 flex w-[calc(100%-8px)] flex-col items-center gap-1 rounded-md border border-transparent px-0.5 py-2.5 text-[9px] font-semibold uppercase tracking-[0.08em] transition-colors hover:bg-subtle/80 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 ${
              startDrawerOpen && setupDrawerTab === 'workspace'
                ? 'border-accent/25 bg-accent/10 text-ink shadow-[inset_0_0_0_1px_rgba(125,154,255,0.15)]'
                : 'text-muted'
            }`}
            onClick={() => toggleSetupDrawerFromToolbar('workspace')}
            aria-pressed={startDrawerOpen && setupDrawerTab === 'workspace'}
            aria-expanded={startDrawerOpen && setupDrawerTab === 'workspace'}
            aria-controls="assistant-start-drawer"
            title="Workspace — versions and conversations"
          >
            <IconStack size={17} className={startDrawerOpen && setupDrawerTab === 'workspace' ? 'text-accent' : 'text-accent/80'} aria-hidden />
            <span className="max-w-[2.75rem] text-center leading-[1.15]">WS</span>
          </button>
        </div>

        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-l border-border/70 bg-bg-default lg:flex-row lg:items-stretch">
          {startDrawerOpen && (
              <aside
                id="assistant-start-drawer"
                data-testid="assistant-start-drawer"
                className="flex w-full max-h-[min(44vh,380px)] shrink-0 flex-col border-b border-border/90 bg-surface shadow-[0_1px_0_rgba(15,23,42,0.06)] dark:shadow-[0_1px_0_rgba(0,0,0,0.35)] lg:h-full lg:max-h-none lg:w-[min(392px,40vw)] lg:max-w-[420px] lg:min-h-0 lg:border-b-0 lg:border-r lg:border-border/80 lg:shadow-[6px_0_32px_-14px_rgba(15,23,42,0.14)] dark:lg:shadow-[6px_0_32px_-12px_rgba(0,0,0,0.45)]"
              >
                <div className="flex shrink-0 items-center justify-between border-b border-border/80 bg-surface px-4 py-3">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink/90">
                    {setupDrawerTab === 'start' ? 'Start' : setupDrawerTab === 'blueprint' ? 'Blueprint' : 'Workspace'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setStartDrawerOpen(false)}
                    className="rounded-lg p-2 text-muted transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                    aria-label={
                      setupDrawerTab === 'start'
                        ? 'Close start panel'
                        : setupDrawerTab === 'blueprint'
                          ? 'Close blueprint panel'
                          : 'Close workspace panel'
                    }
                  >
                    <IconClose />
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  {setupDrawerTab === 'start' ? (
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      <StartRail
                        railRef={starterRailRef}
                        selectedStarterId={selectedStarterId}
                        onSelectStarter={setSelectedStarterId}
                        onUseStarter={useStarter}
                        onBlank={resetBlank}
                        onImport={() => setShowImport(true)}
                        sourceState={sourceState}
                        sourceInputRef={sourceInputRef}
                        onSourceFile={handleSourceFile}
                        uploadReady={!!uploadHandler}
                        compact
                      />
                    </div>
                  ) : setupDrawerTab === 'blueprint' ? (
                    <div
                      ref={assistantBlueprintPanelRef}
                      tabIndex={-1}
                      className="flex min-h-0 flex-1 flex-col outline-none"
                      aria-label="Blueprint sidebar"
                    >
                      <BlueprintSidebar
                        activeTab="Editor"
                        activeSection={assistantBlueprintSection}
                        onSectionChange={setAssistantBlueprintSection}
                        activeEditorView={undefined}
                        compactLayout={false}
                        leftWidth={leftWidth}
                        embedded
                      />
                    </div>
                  ) : (
                    <div
                      ref={assistantWorkspaceRailSlotRef}
                      tabIndex={-1}
                      className="min-h-0 flex-1 outline-none"
                      aria-label="Versions and conversations"
                    />
                  )}
                </div>
                <div className="shrink-0 border-t border-border/80 bg-subtle/25 px-4 py-3 dark:bg-subtle/10">
                  <label className="flex cursor-pointer items-start gap-3 text-[12px] leading-snug text-ink/80">
                    <input
                      type="checkbox"
                      className="mt-1 size-3.5 shrink-0 rounded border-border text-accent focus:ring-accent/40"
                      checked={startDrawerPinned}
                      onChange={(e) => handleStartDrawerPinChange(e.target.checked)}
                    />
                    <span>Keep this side panel open when I return (this device only).</span>
                  </label>
                </div>
              </aside>
          )}

          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {!hasFormStructure && (
              <div className="border-b border-border/80 bg-gradient-to-b from-surface/90 via-surface/40 to-transparent px-6 py-7 onboarding-enter sm:px-8 lg:py-8">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">AI authoring method</p>
                  <h1 className="mt-3 max-w-[min(42rem,100%)] font-display text-[26px] font-semibold leading-[1.06] tracking-[-0.035em] text-ink sm:text-[32px] lg:text-[40px]">
                    Describe the form once. Iterate quickly.
                  </h1>
                  <p className="mt-4 max-w-xl text-[14px] leading-[1.55] text-ink/65 dark:text-ink/55">
                    Start from a source, a starter, or blank draft. Keep the center focused on one thing: getting to a reviewable structure fast.
                  </p>
                </div>
              </div>
            )}

            {orientationOpen && (
            <aside className="absolute right-4 top-24 z-20 hidden w-[min(320px,calc(100vw-2rem))] rounded-xl border border-border/90 bg-surface/98 p-5 shadow-xl ring-1 ring-ink/5 backdrop-blur-sm dark:ring-white/10 lg:block onboarding-slide-in" aria-label="Studio setup orientation">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-ink">Studio setup</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink/70 dark:text-ink/60">
                    Choose, import, or create a form here. Continue with AI or open manual controls to inspect structure, preview behavior, validate diagnostics, and export.
                  </p>
                </div>
                <button type="button" className="rounded-lg p-1.5 text-muted transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35" onClick={dismissOrientation} aria-label="Dismiss orientation">
                  <IconClose />
                </button>
              </div>
            </aside>
            )}

            <div className="flex min-h-0 flex-1 flex-col">
            <SourceReviewStrip sourceState={sourceState} pendingProposalCount={pendingProposalCount} />
            <OnboardingChatPanel
              project={project}
              onUserMessage={markAssistantTouched}
              hasStarterLoaded={stats.fieldCount > 0}
              onUploadHandlerReady={handleUploadHandlerReady}
              onSourceUploadStart={handleSourceUploadStart}
              onSourceUploadComplete={handleSourceUploadComplete}
              chatThreadRepository={assistantChatRepository}
              chatProjectScope={assistantPersistenceScope}
              versionRepository={assistantVersionRepository}
              versionScope={assistantPersistenceScope}
              workspaceRail={onboardingWorkspaceRail}
            />
            </div>

            <div className="grid grid-cols-3 border-t border-border/80 bg-surface/95 backdrop-blur-sm supports-[backdrop-filter]:bg-surface/85 lg:hidden">
            {(
              [
                { id: 'start' as const, label: 'Starters' },
                { id: 'snapshot' as const, label: 'Overview' },
                { id: 'diagnostics' as const, label: 'Issues' },
              ] as const
            ).map(({ id, label }) => (
              <button key={id} type="button" className="border-r border-border/60 px-2 py-3 text-[12px] font-medium text-ink/75 transition-colors last:border-r-0 hover:bg-subtle hover:text-ink focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40" onClick={() => setMobileSheet(id)}>
                {label}
              </button>
            ))}
            </div>
          </div>
        </section>
      </main>

      <StatusBar variant="assistant" />

      {mobileSheet && (
        <div className="fixed inset-0 z-40 bg-black/25 lg:hidden" onClick={() => setMobileSheet(null)}>
          <div className="absolute inset-x-0 bottom-0 max-h-[78dvh] overflow-y-auto border-t border-border bg-surface p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-ink">
                {mobileSheet === 'start' ? 'Starters & import' : mobileSheet === 'snapshot' ? 'Form overview' : 'Diagnostics'}
              </p>
              <button type="button" className="p-2 text-muted" onClick={() => setMobileSheet(null)} aria-label="Close sheet"><IconClose /></button>
            </div>
            {mobileSheet === 'start' && <StartRail railRef={starterRailRef} selectedStarterId={selectedStarterId} onSelectStarter={setSelectedStarterId} onUseStarter={useStarter} onBlank={resetBlank} onImport={() => setShowImport(true)} sourceState={sourceState} sourceInputRef={sourceInputRef} onSourceFile={handleSourceFile} uploadReady={!!uploadHandler} compact />}
            {mobileSheet === 'snapshot' && <SnapshotPanel project={project} selectedStarter={selectedStarter} stats={stats} diagnosticCount={diagnosticEntries.length} pendingProposalCount={pendingProposalCount} onUseStarter={() => selectedStarter && useStarter(selectedStarter)} onEnterStudio={() => enterWorkspaceFromAssistant('snapshot_mobile_sheet')} compact />}
            {mobileSheet === 'diagnostics' && <DiagnosticsList entries={diagnosticEntries} />}
          </div>
        </div>
      )}

      {orientationOpen && (
        <div className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={dismissOrientation}>
          <aside className="absolute inset-x-0 bottom-0 border-t border-border bg-surface p-4 shadow-xl onboarding-enter" aria-label="Studio setup orientation" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-ink">Studio setup</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  Choose, import, or create a form here. Continue with AI or open manual controls to inspect structure, preview respondent behavior, validate diagnostics, and export.
                </p>
              </div>
              <button type="button" className="p-2 text-muted hover:text-ink" onClick={dismissOrientation} aria-label="Dismiss orientation">
                <IconClose />
              </button>
            </div>
          </aside>
        </div>
      )}

      <StudioWorkspaceModals
        showPalette={showPalette}
        setShowPalette={setShowPalette}
        showImport={showImport}
        setShowImport={setShowImport}
        showSettings={showFormSettings}
        setShowSettings={setShowFormSettings}
        showAppSettings={showAppSettings}
        setShowAppSettings={setShowAppSettings}
        importOnBeforeLoad={() => requestReplaceConfirm('Import')}
        importOnSuccess={openAssistantBlueprint}
        onImportClosed={() => forceRender((value) => value + 1)}
        commandPaletteSurface="assistant"
      />
      <ConfirmDialog
        open={replaceConfirmOpen}
        title="Replace this project?"
        description={replaceConfirmDescription}
        confirmLabel="Replace"
        cancelLabel="Cancel"
        onConfirm={() => completeReplaceConfirm(true)}
        onCancel={() => completeReplaceConfirm(false)}
      />
    </div>
  );
}

function OnboardingChatPanel({
  project,
  onUserMessage,
  hasStarterLoaded,
  onUploadHandlerReady,
  onSourceUploadStart,
  onSourceUploadComplete,
  chatThreadRepository,
  chatProjectScope,
  versionRepository,
  versionScope,
  workspaceRail,
}: {
  project: Project;
  onUserMessage: () => void;
  hasStarterLoaded: boolean;
  onUploadHandlerReady: (handler: ((file: File) => void) | null) => void;
  onSourceUploadStart: (file: File) => void;
  onSourceUploadComplete: (summary: SourceUploadSummary) => void;
  chatThreadRepository: ChatThreadRepository;
  chatProjectScope: string;
  versionRepository: VersionRepository;
  versionScope: string;
  workspaceRail: WorkspaceRailPlacement;
}) {
  return (
    <div className="h-full min-h-0 onboarding-enter [animation-delay:80ms] [&_[data-testid=chat-panel]]:border-l-0 [&_[data-testid=chat-panel]]:bg-transparent [&_textarea]:text-[14px]">
      <div id="assistant-composer-anchor" />
      <ChatPanel
        project={project}
        onClose={() => {}}
        hideHeader
        chatThreadRepository={chatThreadRepository}
        chatProjectScope={chatProjectScope}
        versionRepository={versionRepository}
        versionScope={versionScope}
        onUserMessage={onUserMessage}
        onUploadHandlerReady={onUploadHandlerReady}
        onSourceUploadStart={onSourceUploadStart}
        onSourceUploadComplete={onSourceUploadComplete}
        emptyDescription={hasStarterLoaded
          ? 'Ask for concrete edits to this starter: fields, validation, page order, labels, mappings, or review flow.'
          : 'Drop a source file on the left or describe the form you need: audience, sections, required fields, validation, and export target.'}
        placeholder={hasStarterLoaded ? 'Ask for a specific change to this starter…' : 'Describe the form or ask about the uploaded source…'}
        inputId={ASSISTANT_COMPOSER_INPUT_TEST_ID}
        composerInputTestId={ASSISTANT_COMPOSER_INPUT_TEST_ID}
        inputAriaLabel="Assistant composer"
        workspaceRail={workspaceRail}
      />
    </div>
  );
}

interface StartRailProps {
  railRef: RefObject<HTMLDivElement | null>;
  selectedStarterId: string;
  onSelectStarter: (id: string) => void;
  onUseStarter: (starter: StarterCatalogEntry) => void;
  onBlank: () => void;
  onImport: () => void;
  sourceState: SourceState;
  sourceInputRef: RefObject<HTMLInputElement | null>;
  onSourceFile: (file: File | null) => void;
  uploadReady: boolean;
  compact?: boolean;
}

function StartRail({
  railRef,
  selectedStarterId,
  onSelectStarter,
  onUseStarter,
  onBlank,
  onImport,
  sourceState,
  sourceInputRef,
  onSourceFile,
  uploadReady,
  compact = false,
}: StartRailProps) {
  const [dragActive, setDragActive] = useState(false);
  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragActive(false);
    onSourceFile(event.dataTransfer.files?.[0] ?? null);
  };

  return (
    <aside
      ref={railRef}
      tabIndex={-1}
      aria-label="Start — templates, import, and starter catalog"
      className={`${compact ? '' : 'hidden lg:block'} overflow-y-auto bg-surface px-5 py-5 onboarding-slide-in`}
    >
      <div className="mb-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Start</p>
        <p className="mt-2.5 text-[14px] leading-relaxed text-ink/70 dark:text-ink/60">
          Choose one input path, then continue in the composer.
        </p>
      </div>
      <div
        data-testid="source-dropzone"
        aria-live="polite"
        className={`mb-5 rounded-xl border px-4 py-4 shadow-sm transition-colors ${dragActive ? 'border-accent bg-accent/5 ring-2 ring-accent/20' : 'border-border/90 bg-bg-default/50 hover:border-accent/25 hover:bg-subtle/60'}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <input
          ref={sourceInputRef}
          type="file"
          name="source-document"
          accept=".pdf,.json,.txt,.md,application/pdf,application/json,text/plain,text/markdown"
          className="sr-only"
          aria-label="Upload source document"
          onChange={(event) => onSourceFile(event.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          className="flex w-full items-start gap-3 text-left"
          onClick={() => sourceInputRef.current?.click()}
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-accent/10 text-accent">
            <IconUpload size={18} />
          </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-ink">Upload source document</span>
            <span className="mt-1 block text-[12px] leading-snug text-muted">
              {uploadReady ? 'Analyze a source into a reviewable draft.' : 'JSON loads now; PDF analysis needs a provider.'}
            </span>
          </span>
        </button>
        <SourceStatus sourceState={sourceState} />
      </div>

      <div className="space-y-2.5">
        <button type="button" className="flex w-full items-center justify-between rounded-lg border border-border/90 px-3.5 py-2.5 text-left text-[13px] font-semibold text-ink shadow-sm transition-colors hover:border-accent/30 hover:bg-subtle" onClick={onBlank}>
          <span className="flex items-center gap-2"><IconGrid size={16} /> Blank form</span>
          <span className="text-[11px] font-medium text-muted">Reset</span>
        </button>
        <button type="button" className="flex w-full items-center justify-between rounded-lg border border-border/90 px-3.5 py-2.5 text-left text-[13px] font-semibold text-ink shadow-sm transition-colors hover:border-accent/30 hover:bg-subtle" onClick={onImport}>
          <span className="flex items-center gap-2"><IconUpload size={16} /> Import JSON</span>
          <span className="text-[11px] font-medium text-muted">Bundle</span>
        </button>
      </div>

      <div className="mt-6 border-t border-border/60 pt-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink/55 dark:text-ink/45">Starter templates</p>
        <div className="mt-3 space-y-2.5">
          {starterCatalog.map((starter) => {
            const active = starter.id === selectedStarterId;
            return (
              <div key={starter.id} className={`group rounded-xl border px-3.5 py-3.5 transition-colors ${active ? 'border-accent bg-accent/5 shadow-[inset_0_0_0_1px_rgba(125,154,255,0.12)]' : 'border-border/90 hover:border-border hover:bg-subtle/70'}`}>
                <button type="button" className="w-full text-left" onClick={() => onSelectStarter(starter.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[14px] font-semibold leading-snug text-ink">{starter.title}</p>
                    <span className="rounded-md bg-green/10 px-1.5 py-0.5 text-[10px] font-semibold text-green">{starter.diagnosticStatus}</span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-snug text-ink/65 dark:text-ink/55">{starter.description}</p>
                  <p className="mt-2.5 font-mono text-[10px] leading-relaxed text-muted">{starter.stats.fieldCount} fields · {starter.stats.pageCount} pages · {starter.localeAssumptions.join(', ')}</p>
                </button>
                <button type="button" className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg bg-accent px-2 py-2 text-[12px] font-semibold text-white shadow-sm ring-1 ring-ink/5 transition-colors hover:bg-accent/90" onClick={() => onUseStarter(starter)}>
                  Use starter <IconArrowUp size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

/** Snapshot rail deliberately duplicates header "Open manual controls" for discoverability; all paths call `enterWorkspaceFromAssistant` with a distinct `EnterWorkspaceSource`. */
function SnapshotPanel({ project, selectedStarter, stats, diagnosticCount, pendingProposalCount, onUseStarter, onEnterStudio, compact = false }: {
  project: Project;
  selectedStarter?: StarterCatalogEntry;
  stats: ReturnType<Project['statistics']>;
  diagnosticCount: number;
  pendingProposalCount: number;
  onUseStarter: () => void;
  onEnterStudio: () => void;
  compact?: boolean;
}) {
  const outline = project.definition.items?.slice(0, 8) ?? [];
  return (
    <aside className={`${compact ? '' : 'hidden lg:block'} overflow-y-auto bg-surface px-4 py-4 onboarding-slide-in [animation-delay:120ms]`}>
      <div className="space-y-5">
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Workspace status</p>
          <h2 className="mt-2 font-display text-[24px] font-semibold leading-tight">{project.definition.title ?? 'Untitled form'}</h2>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            Track whether this draft is still blank, ready for review, or worth opening manual controls.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Metric label="Fields" value={stats.fieldCount} />
            <Metric label="Sections" value={stats.groupCount} />
            <Metric label="Rules" value={stats.bindCount + stats.shapeCount} />
          </div>
        </section>

        <section className="border-t border-border pt-4">
          <p className="text-[12px] font-semibold text-ink">Outline</p>
          {outline.length === 0 ? (
            <p className="mt-2 text-[12px] leading-relaxed text-muted">Blank project. Ask the assistant for fields or choose a starter.</p>
          ) : (
            <ol className="mt-2 space-y-1.5">
              {outline.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-3 text-[12px]">
                  <span className="truncate">{item.label ?? item.key}</span>
                  <span className="font-mono text-[10px] text-muted">{item.type}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="border-t border-border pt-4">
          <p className="text-[12px] font-semibold text-ink">Review state</p>
          <div className={`mt-2 flex items-center gap-2 text-[12px] ${pendingProposalCount > 0 ? 'text-amber' : 'text-muted'}`}>
            {pendingProposalCount > 0 ? <IconWarning /> : <IconCheck className="text-green" />}
            {pendingProposalCount > 0 ? `${pendingProposalCount} proposed change(s) pending.` : 'No pending proposals.'}
          </div>
        </section>

        <section className="border-t border-border pt-4">
          <p className="text-[12px] font-semibold text-ink">Diagnostics</p>
          <div className={`mt-2 flex items-center gap-2 text-[12px] ${diagnosticCount === 0 ? 'text-green' : 'text-amber'}`}>
            {diagnosticCount === 0 ? <IconCheck /> : <IconWarning />}
            {diagnosticCount === 0 ? 'No diagnostics reported.' : `${diagnosticCount} diagnostic item(s).`}
          </div>
        </section>

        {selectedStarter && (
          <section className="border-t border-border pt-4">
            <p className="text-[12px] font-semibold text-ink">Selected starter</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">{selectedStarter.title}: {selectedStarter.description}</p>
            <button type="button" className="mt-3 w-full rounded-[4px] border border-accent px-3 py-2 text-[12px] font-semibold text-accent hover:bg-accent/5" onClick={onUseStarter}>
              Use selected starter
            </button>
          </section>
        )}

        <button type="button" className="w-full rounded-[4px] bg-accent px-3 py-2 text-[13px] font-semibold text-white hover:bg-accent/90" onClick={onEnterStudio}>
          Open manual controls
        </button>
      </div>
    </aside>
  );
}

function SourceStatus({ sourceState }: { sourceState: SourceState }) {
  if (sourceState.status === 'empty') {
    return <p className="mt-3 font-mono text-[10px] text-muted">Accepted: PDF · JSON · TXT · MD</p>;
  }
  const tone = sourceState.status === 'ready' ? 'text-green' : sourceState.status === 'error' ? 'text-error' : 'text-amber';
  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="truncate text-[12px] font-semibold text-ink">{sourceState.name}</p>
      <p className={`mt-1 text-[12px] leading-snug ${tone}`}>
        {sourceState.status === 'processing'
          ? 'Processing source…'
          : sourceState.message}
      </p>
      {sourceState.status === 'ready' && (
        <p className="mt-1 font-mono text-[10px] text-muted">{sourceState.fieldCount ?? 0} candidate field(s) · {sourceState.type}</p>
      )}
    </div>
  );
}

function SourceReviewStrip({ sourceState, pendingProposalCount }: { sourceState: SourceState; pendingProposalCount: number }) {
  if (sourceState.status === 'empty') return null;
  return (
    <div className="border-b border-border bg-surface/85 px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Source review</p>
          <p className="mt-1 text-[13px] font-semibold text-ink">
            {sourceState.status === 'processing'
              ? `Reading ${sourceState.name}`
              : sourceState.status === 'ready'
                ? sourceState.message?.startsWith('Loaded ')
                  ? `${sourceState.name} loaded as current draft`
                  : `${sourceState.name} generated a draft`
                : `Source issue: ${sourceState.name}`}
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-muted">
            {sourceState.message ?? 'Review the assistant proposal before accepting generated structure.'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <span className="rounded-[4px] border border-border px-2 py-1 font-mono text-muted">
            {sourceState.fieldCount ?? 0} fields
          </span>
          <span className={`rounded-[4px] border px-2 py-1 font-semibold ${pendingProposalCount > 0 ? 'border-amber/30 bg-amber/10 text-amber' : 'border-border text-muted'}`}>
            {pendingProposalCount > 0 ? `${pendingProposalCount} pending` : 'review ready'}
          </span>
        </div>
      </div>
    </div>
  );
}

function classifySourceType(file: File): string {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'pdf' || file.type === 'application/pdf') return 'PDF';
  if (extension === 'json' || file.type === 'application/json') return 'JSON';
  if (extension === 'md' || file.type === 'text/markdown') return 'Markdown';
  return 'Text';
}

function isJsonSourceFile(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase();
  return extension === 'json' || file.type === 'application/json';
}

function parseJsonSourceBundle(raw: string): Partial<ProjectBundle> {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  if (parsed.definition || parsed.component || parsed.theme || parsed.mapping || parsed.mappings) {
    return parsed as Partial<ProjectBundle>;
  }
  if (parsed.$formspec === '1.0' || parsed.items || parsed.title) {
    return { definition: parsed as ProjectBundle['definition'] };
  }
  throw new Error('JSON source must be a Formspec definition or project bundle.');
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[8px] border border-border bg-bg-default px-2 py-2">
      <p className="font-mono text-[16px] font-semibold">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-[0.06em] text-muted">{label}</p>
    </div>
  );
}

function DiagnosticsList({ entries }: { entries: Array<{ severity: string; message: string; path?: string }> }) {
  if (entries.length === 0) {
    return <p className="text-[13px] text-muted">No diagnostics reported for the current project.</p>;
  }
  return (
    <div className="space-y-2">
      {entries.map((entry, index) => (
        <div key={`${entry.message}-${index}`} className="border border-border px-3 py-2">
          <p className="text-[12px] font-semibold capitalize">{entry.severity}</p>
          <p className="mt-1 text-[12px] text-muted">{entry.message}</p>
          {entry.path && <p className="mt-1 font-mono text-[10px] text-muted">{entry.path}</p>}
        </div>
      ))}
    </div>
  );
}
