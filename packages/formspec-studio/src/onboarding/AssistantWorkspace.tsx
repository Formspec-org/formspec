/** @filedesc Full-screen assistant workspace — starters, import, and composer before the tabbed builder. */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { DragEvent, RefObject } from 'react';
import type { Project, ProjectBundle } from '@formspec-org/studio-core';
import { ChatPanel, type SourceUploadSummary } from '../components/ChatPanel.js';
import { Header } from '../components/Header.js';
import { StatusBar } from '../components/StatusBar.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { StudioWorkspaceModals } from '../components/shell/StudioWorkspaceModals.js';
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
import { ONBOARDING_ORIENTATION_KEY } from './onboarding-storage.js';
import type { EnterWorkspaceSource } from './enter-workspace-source.js';
import {
  IconArrowUp,
  IconCheck,
  IconClose,
  IconGrid,
  IconUpload,
  IconWarning,
} from '../components/icons/index.js';

export interface AssistantWorkspaceProps {
  project: Project;
  onEnterStudio: () => void;
  /** When provided, theme toggle matches the tabbed Studio shell. */
  colorScheme?: ColorScheme;
}

type MobileSheet = 'start' | 'snapshot' | 'diagnostics' | null;

interface SourceState {
  status: 'empty' | 'processing' | 'ready' | 'error';
  name?: string;
  type?: string;
  size?: number;
  fieldCount?: number;
  message?: string;
}

export function AssistantWorkspace({ project, onEnterStudio, colorScheme }: AssistantWorkspaceProps) {
  const { compactLayout } = useShellLayout();
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
  const [assistantTouched, setAssistantTouched] = useState(false);
  const replaceResolveRef = useRef<((confirmed: boolean) => void) | null>(null);
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false);
  const [replaceConfirmDescription, setReplaceConfirmDescription] = useState('');
  const [sourceState, setSourceState] = useState<SourceState>({ status: 'empty' });
  const [uploadHandler, setUploadHandler] = useState<((file: File) => void) | null>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const starterRailRef = useRef<HTMLDivElement>(null);
  const viewedEventSentRef = useRef(false);
  const firstEditEventSentRef = useRef(false);
  const initialFieldCountRef = useRef<number | null>(null);
  const [, forceRender] = useState(0);

  const stats = project.statistics();
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

  const replaceProject = useCallback((bundle: Partial<ProjectBundle>, label: string) => {
    const apply = () => {
      project.loadBundle(bundle);
      project.markClean();
      setAssistantTouched(false);
      forceRender((value) => value + 1);
    };
    if (project.isDirty || assistantTouched) {
      void requestReplaceConfirm(label).then((ok) => {
        if (ok) apply();
      });
      return;
    }
    apply();
  }, [assistantTouched, project, requestReplaceConfirm]);

  const useStarter = (starter: StarterCatalogEntry) => {
    setSelectedStarterId(starter.id);
    emitOnboardingTelemetry('onboarding_starter_selected', { starterId: starter.id });
    replaceProject(starter.bundle, `Use ${starter.title}`);
  };

  const resetBlank = () => {
    replaceProject({ definition: blankDefinition }, 'Blank form reset');
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
    } catch (error) {
      setSourceState({
        status: 'error',
        name: file.name,
        type: 'JSON',
        size: file.size,
        message: error instanceof Error ? error.message : 'Could not load JSON source.',
      });
    }
  }, [requestReplaceConfirm, project]);

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

  const handleSourceUploadComplete = useCallback((summary: SourceUploadSummary) => {
    setSourceState({
      status: 'ready',
      name: summary.name,
      type: summary.type.toUpperCase(),
      fieldCount: summary.fieldCount,
      message: summary.message,
    });
    forceRender((value) => value + 1);
  }, []);

  const handleUploadHandlerReady = useCallback((handler: ((file: File) => void) | null) => {
    setUploadHandler(() => handler);
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

      <main className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[300px_minmax(420px,1fr)_340px]">
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
        />

        <section className="relative flex min-h-0 flex-col overflow-hidden border-x border-border/60 bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--color-accent)_14%,transparent),transparent_34%),linear-gradient(180deg,color-mix(in_srgb,var(--color-surface)_90%,var(--color-bg-default))_0%,color-mix(in_srgb,var(--color-bg-default)_92%,var(--color-subtle))_100%)]">
          <div className="border-b border-border/70 px-5 py-5 onboarding-enter">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Assistant workspace</p>
                <h1 className="mt-2 max-w-2xl font-display text-[24px] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[30px] lg:text-[38px]">What form are you building?</h1>
                <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted">
                  Start from a source, a starter, or a blank project. Keep the draft intact, shape it with the assistant, then enter Studio when the structure is worth editing.
                </p>
              </div>
              <div className="grid gap-3 lg:justify-self-end">
                <div className="rounded-[8px] border border-border/70 bg-[color-mix(in_srgb,var(--color-surface)_72%,transparent)] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Next steps</p>
                  <ol className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-muted">
                    <li>1. Load or describe the form.</li>
                    <li>2. Review the generated structure.</li>
                    <li>3. Enter Studio for detailed editing.</li>
                  </ol>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <button type="button" className="rounded-[4px] border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-subtle" onClick={() => document.getElementById(ASSISTANT_COMPOSER_INPUT_TEST_ID)?.focus()}>
                  Describe it
                </button>
                <button
                  type="button"
                  className="rounded-[4px] border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-subtle"
                  onClick={() => starterRailRef.current?.focus()}
                >
                  Browse starters
                </button>
                <button type="button" className="rounded-[4px] border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-subtle" onClick={() => setShowImport(true)}>
                  Import
                </button>
                </div>
              </div>
            </div>
          </div>

          {orientationOpen && (
            <aside className="absolute right-4 top-24 z-20 hidden w-[300px] rounded-[10px] border border-border/80 bg-surface/95 p-4 shadow-xl lg:block onboarding-slide-in" aria-label="Studio setup orientation">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-semibold text-ink">Studio setup</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted">
                    Choose, import, or create a form here. Then enter the form builder to inspect structure, preview behavior, validate diagnostics, and export.
                  </p>
                </div>
                <button type="button" className="p-1 text-muted hover:text-ink" onClick={dismissOrientation} aria-label="Dismiss orientation">
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
            />
          </div>

          <div className="grid grid-cols-3 border-t border-border bg-surface lg:hidden">
            {(
              [
                { id: 'start' as const, label: 'Starters' },
                { id: 'snapshot' as const, label: 'Overview' },
                { id: 'diagnostics' as const, label: 'Issues' },
              ] as const
            ).map(({ id, label }) => (
              <button key={id} type="button" className="px-2 py-2 text-[11px] font-semibold hover:bg-subtle sm:text-[12px]" onClick={() => setMobileSheet(id)}>
                {label}
              </button>
            ))}
          </div>
        </section>

        <SnapshotPanel
          project={project}
          selectedStarter={selectedStarter}
          stats={stats}
          diagnosticCount={diagnosticEntries.length}
          pendingProposalCount={pendingProposalCount}
          onUseStarter={() => selectedStarter && useStarter(selectedStarter)}
          onEnterStudio={() => enterWorkspaceFromAssistant('snapshot_panel')}
        />
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
                  Choose, import, or create a form here. Then inspect structure, preview respondent behavior, validate diagnostics, and export from Studio.
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
}: {
  project: Project;
  onUserMessage: () => void;
  hasStarterLoaded: boolean;
  onUploadHandlerReady: (handler: ((file: File) => void) | null) => void;
  onSourceUploadStart: (file: File) => void;
  onSourceUploadComplete: (summary: SourceUploadSummary) => void;
}) {
  return (
    <div className="h-full min-h-0 onboarding-enter [animation-delay:80ms] [&_[data-testid=chat-panel]]:border-l-0 [&_[data-testid=chat-panel]]:bg-transparent [&_[data-testid=chat-panel]>div:first-child]:hidden [&_textarea]:text-[14px]">
      <div id="assistant-composer-anchor" />
      <ChatPanel
        project={project}
        onClose={() => {}}
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
      aria-label="Start controls and starter catalog"
      className={`${compact ? '' : 'hidden lg:block'} overflow-y-auto bg-surface px-4 py-4 onboarding-slide-in`}
    >
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Choose a starting path</p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Load a real source, reset to blank, or pick a starter that is already shaped for review.
        </p>
      </div>
      <div
        data-testid="source-dropzone"
        aria-live="polite"
        className={`mb-4 rounded-[10px] border px-3 py-4 transition-colors ${dragActive ? 'border-accent bg-accent/5' : 'border-border bg-bg-default/45 hover:bg-subtle/55'}`}
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
            <span className="block text-[13px] font-semibold text-ink">Drop PDF, form, or JSON</span>
            <span className="mt-1 block text-[12px] leading-snug text-muted">
              {uploadReady ? 'Analyze a source into a reviewable draft.' : 'JSON loads now; PDF analysis needs a provider.'}
            </span>
          </span>
        </button>
        <SourceStatus sourceState={sourceState} />
      </div>

      <div className="space-y-2">
        <button type="button" className="flex w-full items-center justify-between rounded-[8px] border border-border px-3 py-2 text-left text-[13px] font-semibold hover:bg-subtle" onClick={onBlank}>
          <span className="flex items-center gap-2"><IconGrid size={16} /> Blank form</span>
          <span className="text-[11px] text-muted">Reset</span>
        </button>
        <button type="button" className="flex w-full items-center justify-between rounded-[8px] border border-border px-3 py-2 text-left text-[13px] font-semibold hover:bg-subtle" onClick={onImport}>
          <span className="flex items-center gap-2"><IconUpload size={16} /> Import JSON</span>
          <span className="text-[11px] text-muted">Bundle</span>
        </button>
      </div>

      <div className="mt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Starters</p>
        <div className="mt-2 space-y-2">
          {starterCatalog.map((starter) => {
            const active = starter.id === selectedStarterId;
            return (
              <div key={starter.id} className={`group rounded-[10px] border px-3 py-3 transition-colors ${active ? 'border-accent bg-accent/5 shadow-[inset_0_0_0_1px_rgba(125,154,255,0.12)]' : 'border-border hover:bg-subtle/70'}`}>
                <button type="button" className="w-full text-left" onClick={() => onSelectStarter(starter.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[13px] font-semibold text-ink">{starter.title}</p>
                    <span className="rounded-[3px] bg-green/10 px-1.5 py-0.5 text-[10px] font-semibold text-green">{starter.diagnosticStatus}</span>
                  </div>
                  <p className="mt-1 text-[12px] leading-snug text-muted">{starter.description}</p>
                  <p className="mt-2 font-mono text-[10px] text-muted">{starter.stats.fieldCount} fields · {starter.stats.pageCount} pages · {starter.localeAssumptions.join(', ')}</p>
                </button>
                <button type="button" className="mt-3 flex w-full items-center justify-center gap-1 rounded-[8px] bg-accent px-2 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-accent/90" onClick={() => onUseStarter(starter)}>
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

/** Snapshot rail deliberately duplicates header "Enter workspace" for discoverability; all paths call `enterWorkspaceFromAssistant` with a distinct `EnterWorkspaceSource`. */
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
            Track whether this draft is still blank, ready for review, or worth opening in the full editor.
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
          Enter workspace
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
