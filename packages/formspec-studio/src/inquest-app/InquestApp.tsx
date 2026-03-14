import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { TemplateGallery } from '../features/template-gallery/TemplateGallery';
import { ProviderSetup } from '../features/provider-setup/ProviderSetup';
import { RecentSessions } from '../features/recent-sessions/RecentSessions';
import { InputInventory } from '../features/input-inventory/InputInventory';
import { ReviewWorkspace } from '../features/review-workspace/ReviewWorkspace';
import { RefineWorkspace } from '../features/refine-workspace/RefineWorkspace';
import { InquestThread } from './InquestThread';
import type { ConnectionResult, InquestIssue, InquestSessionV1 } from '../shared/contracts/inquest';
import { inquestProviderAdapters, findProviderAdapter } from '../shared/providers';
import { inquestTemplates } from '../shared/templates/templates';
import { useSessionLifecycle, summarizeUpload } from './hooks/useSessionLifecycle';
import { useProviderManager } from './hooks/useProviderManager';
import { useInquestOps } from './hooks/useInquestOps';

/* ── Constants ────────────────────────────────── */

const PHASE_ORDER = ['inputs', 'review', 'refine'] as const;

function nowIso(): string {
  return new Date().toISOString();
}

/* ── Presentational components ────────────────── */

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#fdfcfa] flex items-center justify-center">
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
            <FormspecIcon size={28} />
          </div>
          <div className="absolute -inset-2 animate-ping rounded-3xl border border-accent/20" />
        </div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          Initializing Stack Assistant…
        </div>
      </div>
    </div>
  );
}

function FormspecIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <rect x="2" y="1.5" width="8" height="2" rx=".4" fill={color} />
      <rect x="2" y="5" width="8" height="2" rx=".4" fill={color} fillOpacity=".7" />
      <rect x="2" y="8.5" width="8" height="2" rx=".4" fill={color} fillOpacity=".4" />
    </svg>
  );
}

interface AppHeaderProps {
  phase: InquestSessionV1['phase'];
  phaseIndex: number;
  sessionTitle: string;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  connection: ConnectionResult | undefined;
  providerLabel: string;
  onNavigateToPhase?: (phase: InquestSessionV1['phase']) => void;
}

function AppHeader({
  phase,
  phaseIndex,
  sessionTitle,
  saveState,
  connection,
  providerLabel,
  onNavigateToPhase,
}: AppHeaderProps) {
  return (
    <header className="relative flex h-[60px] shrink-0 items-center justify-between border-b border-warm-border bg-white px-6 shadow-sm">
      {/* Logo + title */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent shadow-sm">
          <FormspecIcon size={14} color="white" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight leading-none">Stack Builder</h1>
          {phase === 'inputs' ? (
            <div className="mt-0.5 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
              Formspec AI Assistant
            </div>
          ) : (
            <div className="mt-0.5 max-w-[200px] truncate text-[11px] font-medium text-slate-500">
              {sessionTitle}
            </div>
          )}
        </div>
      </div>

      {/* Phase stepper — centered */}
      <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1" aria-label="Workflow phases">
        {PHASE_ORDER.map((p, i) => {
          const isCurrent = phase === p;
          const isDone = phaseIndex > i;
          const isNavigable = isDone && onNavigateToPhase;
          return (
            <div key={p} className="flex items-center gap-1">
              {i > 0 && (
                <div className={`w-5 h-px transition-colors ${isDone ? 'bg-accent/25' : 'bg-slate-200'}`} />
              )}
              <button
                type="button"
                disabled={!isNavigable}
                onClick={() => isNavigable && onNavigateToPhase(p)}
                className={[
                  'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all',
                  isCurrent ? 'bg-accent/8 text-accent' : isDone ? 'text-slate-400 hover:text-accent cursor-pointer' : 'text-slate-300 cursor-default',
                  isNavigable ? 'hover:bg-accent/5' : '',
                ].join(' ')}
              >
                <div className={[
                  'flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold transition-all',
                  isDone
                    ? 'bg-slate-200 text-slate-500'
                    : isCurrent
                      ? 'bg-accent text-white'
                      : 'border border-slate-200 text-slate-300',
                ].join(' ')}>
                  {isDone ? '✓' : i + 1}
                </div>
                <span className="capitalize tracking-wide">{p}</span>
              </button>
            </div>
          );
        })}
      </nav>

      {/* Right: save state + provider status */}
      <div className="flex items-center gap-3">
        {saveState === 'saving' && (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-slate-400" />
            Saving…
          </span>
        )}
        {saveState === 'saved' && (
          <span className="text-[11px] font-medium text-emerald-500">Saved</span>
        )}
        {saveState === 'error' && (
          <span className="text-[11px] font-medium text-red-500">Save failed</span>
        )}

        <div className="flex items-center gap-2 rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
          <div className={`h-1.5 w-1.5 rounded-full transition-colors ${connection?.ok ? 'bg-emerald-400' : 'bg-slate-300'}`} />
          {providerLabel}
        </div>
      </div>
    </header>
  );
}

interface GenerateCTAProps {
  isAnalyzing: boolean;
  onDraftFast: () => void;
  onVerifyCarefully: () => void;
}

function GenerateCTA({ isAnalyzing, onDraftFast, onVerifyCarefully }: GenerateCTAProps) {
  return (
    <div className="mt-8 rounded-3xl border border-warm-border bg-warm-subtle/40 p-7 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-6 text-center">
        <div className="text-[10px] font-bold uppercase tracking-widest text-brass mb-2">Ready to build</div>
        <h3 className="text-[17px] font-bold text-slate-900">Generate your form scaffold</h3>
        <p className="mt-1.5 text-[13px] text-slate-500">Choose how to proceed:</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onDraftFast}
          disabled={isAnalyzing}
          className="group flex flex-col items-center gap-3.5 rounded-2xl bg-white p-5 border-2 border-transparent hover:border-accent hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="h-11 w-11 rounded-xl bg-slate-900 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <div className="text-center">
            <div className="font-bold text-[14px] text-slate-900">Draft Fast</div>
            <div className="mt-0.5 text-[12px] text-slate-400 leading-snug">Optimize for speed</div>
          </div>
        </button>

        <button
          type="button"
          onClick={onVerifyCarefully}
          disabled={isAnalyzing}
          className="group flex flex-col items-center gap-3.5 rounded-2xl bg-white p-5 border-2 border-transparent hover:border-emerald-500 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="h-11 w-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="text-center">
            <div className="font-bold text-[14px] text-slate-900">Verify Carefully</div>
            <div className="mt-0.5 text-[12px] text-slate-400 leading-snug">Deep semantic analysis</div>
          </div>
        </button>
      </div>

      {isAnalyzing && (
        <div className="mt-4 flex items-center justify-center gap-2 text-[12px] font-medium text-slate-400">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-slate-400" />
          Working on it…
        </div>
      )}
    </div>
  );
}

interface TemplateSectionProps {
  showFull: boolean;
  selectedTemplateId: string | undefined;
  onToggleFull: () => void;
  onSelect: (templateId: string) => void;
}

function TemplateSection({ showFull, selectedTemplateId, onToggleFull, onSelect }: TemplateSectionProps) {
  return (
    <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-px w-8 bg-warm-border" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brass/70">
            {showFull ? 'Full Blueprint Library' : 'Quick Start Blueprints'}
          </span>
          <div className="h-px w-8 bg-warm-border" />
        </div>
        {showFull && (
          <button
            type="button"
            onClick={onToggleFull}
            className="text-[10px] font-bold text-accent hover:underline uppercase tracking-widest"
          >
            Dismiss
          </button>
        )}
      </div>
      <TemplateGallery
        templates={showFull ? inquestTemplates : inquestTemplates.slice(0, 3)}
        selectedTemplateId={selectedTemplateId}
        mode="inquest"
        onSelect={onSelect}
      />
    </div>
  );
}

function meaningfulInput(session: InquestSessionV1): boolean {
  return Boolean(
    session.input.templateId
    || session.input.description.trim().length >= 10
    || session.input.uploads.length > 0
    || session.input.messages.some((m) => m.role === 'user'),
  );
}

/* ── Main orchestrator ────────────────────────── */

export function InquestApp() {
  const locationPathname = typeof window !== 'undefined' ? window.location.pathname : '/inquest/';
  const locationSearch = typeof window !== 'undefined' ? window.location.search : '';

  const [showFullGallery, setShowFullGallery] = useState(false);

  // Core lifecycle: session load/save/routing
  const {
    session,
    draft,
    saveState,
    recentSessions,
    updateSession,
    setDraft,
    handleCreateFreshSession,
    handleDeleteSession,
    handleOpenSession,
  } = useSessionLifecycle(locationPathname, locationSearch);

  // Provider: key management, test connection
  const {
    providerApiKey,
    rememberKey,
    connection,
    isTesting,
    isSetupRequired,
    setProviderApiKey,
    setRememberKey,
    setProviderReady,
    handleTestConnection,
    handleProviderSelected,
    handleCredentialsCleared,
  } = useProviderManager(session);

  const provider = useMemo(
    () => session?.providerId ? findProviderAdapter(session.providerId) ?? inquestProviderAdapters[0] : inquestProviderAdapters[0],
    [session?.providerId],
  );

  const template = useMemo(
    () => session ? (inquestTemplates.find((t) => t.id === session.input.templateId)) : undefined,
    [session?.input.templateId],
  );

  // AI operations: analyze, propose, edit, open studio
  const {
    isAnalyzing,
    handleAnalyze,
    handleChatNew,
    handleGenerateProposal,
    handleEnterRefine,
    handleApplyPrompt,
    handleOpenStudio,
  } = useInquestOps(session, draft, setDraft, provider, template, updateSession);

  const handleTemplateSelect = useCallback((templateId: string) => {
    setShowFullGallery(false);
    updateSession((current) => ({
      ...current,
      title: inquestTemplates.find((t) => t.id === templateId)?.name ?? current.title,
      input: { ...current.input, templateId },
      updatedAt: nowIso(),
    }));
  }, [updateSession]);

  const handleIssueStatus = useCallback((issueId: string, status: InquestIssue['status']) => {
    updateSession((current) => ({
      ...current,
      issues: current.issues.map((issue) => issue.id === issueId ? { ...issue, status } : issue),
      updatedAt: nowIso(),
    }));
  }, [updateSession]);

  const handleNavigateToPhase = useCallback((phase: InquestSessionV1['phase']) => {
    updateSession((current) => ({ ...current, phase, updatedAt: nowIso() }));
  }, [updateSession]);

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const uploads = await Promise.all(Array.from(files).map(summarizeUpload));
    updateSession((current) => ({
      ...current,
      input: { ...current.input, uploads: [...current.input.uploads, ...uploads] },
      updatedAt: nowIso(),
    }));
  }, [updateSession]);

  if (!session) return <LoadingScreen />;

  const phaseIndex = PHASE_ORDER.indexOf(session.phase);
  const openIssues = session.issues.filter((issue) => issue.status === 'open');

  /* ── Thread slot content ── */

  const afterMessages: ReactNode = (
    <>
      {meaningfulInput(session) && (
        <GenerateCTA
          isAnalyzing={isAnalyzing}
          onDraftFast={() => {
            updateSession((c) => ({ ...c, workflowMode: 'draft-fast' }));
            void handleGenerateProposal();
          }}
          onVerifyCarefully={() => {
            updateSession((c) => ({ ...c, workflowMode: 'verify-carefully' }));
            void handleAnalyze();
          }}
        />
      )}

      {(showFullGallery || (session.input.messages.length === 1 && !meaningfulInput(session))) && (
        <TemplateSection
          showFull={showFullGallery}
          selectedTemplateId={session.input.templateId}
          onToggleFull={() => setShowFullGallery((v) => !v)}
          onSelect={handleTemplateSelect}
        />
      )}
    </>
  );

  const belowComposer: ReactNode = (
    <div className="mt-3 flex items-center justify-between px-1 text-[12px] font-medium text-slate-400">
      <div className="flex gap-4">
        <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-600 transition-colors">
          <input
            type="file"
            className="hidden"
            multiple
            onChange={(e) => void handleFileUpload(e.target.files)}
          />
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          <span>Add context</span>
          {session.input.uploads.length > 0 && (
            <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent">
              {session.input.uploads.length}
            </span>
          )}
        </label>

        <button
          type="button"
          onClick={() => setShowFullGallery(!showFullGallery)}
          className={`flex items-center gap-1.5 transition-colors ${showFullGallery ? 'text-accent' : 'hover:text-slate-600'}`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>Blueprints</span>
        </button>
      </div>
      <span>Enter to send</span>
    </div>
  );

  return (
    <div data-testid="stack-assistant" className="min-h-screen bg-[#fdfcfa] text-slate-900 font-ui flex flex-col">
      <AppHeader
        phase={session.phase}
        phaseIndex={phaseIndex}
        sessionTitle={session.title}
        saveState={saveState}
        connection={connection}
        providerLabel={provider?.label ?? 'No model'}
        onNavigateToPhase={handleNavigateToPhase}
      />

      {/* ── Inputs phase ── */}
      {session.phase === 'inputs' && (
        <main className="flex flex-1 overflow-hidden">
          {/* Left sidebar: history */}
          <aside className="w-[280px] border-r border-warm-border bg-warm-subtle/30 flex flex-col shrink-0">
            <div className="flex-1 overflow-y-auto p-4">
              <RecentSessions
                sessions={recentSessions}
                onOpen={handleOpenSession}
                onDelete={handleDeleteSession}
                onStartNew={handleCreateFreshSession}
              />
            </div>
          </aside>

          {/* Center: chat or provider setup */}
          <section className="relative flex flex-1 flex-col bg-white overflow-hidden">
            {isSetupRequired ? (
              <ProviderSetupPanel
                session={session}
                providerApiKey={providerApiKey}
                rememberKey={rememberKey}
                connection={connection}
                isTesting={isTesting}
                onContinue={() => setProviderReady(true)}
                onProviderSelected={(id) => handleProviderSelected(id, updateSession)}
                onApiKeyChange={(val) => { setProviderReady(false); setProviderApiKey(val); }}
                onRememberChange={setRememberKey}
                onTestConnection={handleTestConnection}
                onCredentialsCleared={() => handleCredentialsCleared(session.providerId)}
              />
            ) : (
              <InquestThread
                messages={session.input.messages}
                isRunning={isAnalyzing}
                onNew={handleChatNew}
                afterMessages={afterMessages}
                belowComposer={belowComposer}
              />
            )}
          </section>

          {/* Right sidebar: context panel */}
          <aside className="w-[320px] border-l border-warm-border bg-warm-subtle/30 flex flex-col shrink-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <InputInventory input={session.input} template={template} />
            </div>
          </aside>
        </main>
      )}

      {/* ── Review phase ── */}
      {session.phase === 'review' && session.analysis ? (
        <main className="flex-1 overflow-y-auto p-6">
          <ReviewWorkspace
            analysis={session.analysis}
            proposal={session.proposal}
            issues={openIssues}
            workflowMode={session.workflowMode}
            onGenerate={handleGenerateProposal}
            onProceedToRefine={handleEnterRefine}
            onResolveIssue={(id) => handleIssueStatus(id, 'resolved')}
            onDeferIssue={(id) => handleIssueStatus(id, 'deferred')}
            isGenerating={isAnalyzing}
          />
        </main>
      ) : null}

      {/* ── Refine phase ── */}
      {session.phase === 'refine' && draft ? (
        <main className="flex-1 overflow-y-auto p-6">
          <RefineWorkspace
            project={draft.getProject()}
            issues={openIssues}
            onResolveIssue={(id) => handleIssueStatus(id, 'resolved')}
            onDeferIssue={(id) => handleIssueStatus(id, 'deferred')}
            onApplyPrompt={handleApplyPrompt}
            onBack={() => handleNavigateToPhase('review')}
            onOpenStudio={handleOpenStudio}
          />
        </main>
      ) : null}
    </div>
  );
}

/* ── Provider setup panel ─────────────────────── */

interface ProviderSetupPanelProps {
  session: InquestSessionV1;
  providerApiKey: string;
  rememberKey: boolean;
  connection: ConnectionResult | undefined;
  isTesting: boolean;
  onContinue: () => void;
  onProviderSelected: (providerId: string) => void;
  onApiKeyChange: (val: string) => void;
  onRememberChange: (val: boolean) => void;
  onTestConnection: () => void;
  onCredentialsCleared: () => void;
}

function ProviderSetupPanel({
  session,
  providerApiKey,
  rememberKey,
  connection,
  isTesting,
  onContinue,
  onProviderSelected,
  onApiKeyChange,
  onRememberChange,
  onTestConnection,
  onCredentialsCleared,
}: ProviderSetupPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto p-8 flex justify-center">
      <div className="w-full max-w-3xl">
        <div className="mt-12 flex flex-col items-center">
          <div className="mb-8 text-center">
            <div className="h-16 w-16 mx-auto mb-5 flex items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3m-3-3l-2.25-2.25" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Connect Intelligence</h2>
            <p className="mt-2 text-[14px] text-slate-500 max-w-md mx-auto">
              To start building with <strong>Stack</strong>, connect an AI provider.
              Your keys stay in this browser and are never sent to our servers.
            </p>
          </div>

          <div className="w-full max-w-md">
            <ProviderSetup
              adapters={inquestProviderAdapters}
              selectedProviderId={session.providerId}
              apiKey={providerApiKey}
              rememberKey={rememberKey}
              connection={connection}
              isTesting={isTesting}
              onContinue={onContinue}
              onProviderSelected={onProviderSelected}
              onApiKeyChange={onApiKeyChange}
              onRememberChange={onRememberChange}
              onTestConnection={onTestConnection}
              onCredentialsCleared={onCredentialsCleared}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
