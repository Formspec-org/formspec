import { useCallback, useMemo } from 'react';
import { ReviewWorkspace } from '../features/review-workspace/ReviewWorkspace';
import { RefineWorkspace } from '../features/refine-workspace/RefineWorkspace';
import type { InquestIssue, InquestSessionV1 } from '../shared/contracts/inquest';
import { findProviderAdapter, inquestProviderAdapters } from '../shared/providers';
import { inquestTemplates } from '../shared/templates/templates';
import { useSessionLifecycle, summarizeUpload } from './hooks/useSessionLifecycle';
import { useProviderManager } from './hooks/useProviderManager';
import { useInquestOps } from './hooks/useInquestOps';
import { nowIso } from './utils';
import { AppHeader, FormspecIcon } from './AppHeader';
import { InputsPhase, OperationErrorBanner } from './InputsPhase';

/* ── Constants ────────────────────────────────── */

const PHASE_ORDER = ['inputs', 'review', 'refine'] as const;

/* ── Loading screen ──────────────────────────── */

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

/* ── Main orchestrator ────────────────────────── */

export function InquestApp() {
  const locationPathname = typeof window !== 'undefined' ? window.location.pathname : '/inquest/';
  const locationSearch = typeof window !== 'undefined' ? window.location.search : '';

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
    operationError,
    clearOperationError,
    handleAnalyze,
    handleChatNew,
    handleGenerateProposal,
    handleEnterRefine,
    handleApplyPrompt,
    handleOpenStudio,
  } = useInquestOps(session, draft, setDraft, provider, template, updateSession);

  /* ── Callbacks ────────────────────────────────── */

  const handleTemplateSelect = useCallback((templateId: string) => {
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

  const handleRemoveUpload = useCallback((uploadId: string) => {
    updateSession((current) => ({
      ...current,
      input: { ...current.input, uploads: current.input.uploads.filter((u) => u.id !== uploadId) },
      updatedAt: nowIso(),
    }));
  }, [updateSession]);

  /* ── Render ───────────────────────────────────── */

  if (!session) return <LoadingScreen />;

  const phaseIndex = PHASE_ORDER.indexOf(session.phase);
  const openIssues = session.issues.filter((issue) => issue.status === 'open');

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

      {session.phase === 'inputs' && (
        <InputsPhase
          session={session}
          isAnalyzing={isAnalyzing}
          operationError={operationError}
          recentSessions={recentSessions}
          isSetupRequired={isSetupRequired}
          providerApiKey={providerApiKey}
          rememberKey={rememberKey}
          connection={connection}
          isTesting={isTesting}
          onChatNew={handleChatNew}
          onDraftFast={() => {
            updateSession((c) => ({ ...c, workflowMode: 'draft-fast' }));
            void handleGenerateProposal();
          }}
          onVerifyCarefully={() => {
            updateSession((c) => ({ ...c, workflowMode: 'verify-carefully' }));
            void handleAnalyze();
          }}
          onTemplateSelect={handleTemplateSelect}
          onFileUpload={(files) => void handleFileUpload(files)}
          onRemoveUpload={handleRemoveUpload}
          onDismissError={clearOperationError}
          onOpenSession={handleOpenSession}
          onDeleteSession={handleDeleteSession}
          onCreateFreshSession={handleCreateFreshSession}
          onProviderContinue={() => setProviderReady(true)}
          onProviderSelected={(id) => handleProviderSelected(id, updateSession)}
          onApiKeyChange={(val) => { setProviderReady(false); setProviderApiKey(val); }}
          onRememberChange={setRememberKey}
          onTestConnection={handleTestConnection}
          onCredentialsCleared={() => handleCredentialsCleared(session.providerId)}
        />
      )}

      {session.phase === 'review' && session.analysis && (
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
      )}

      {session.phase === 'refine' && draft && (
        <main className="flex-1 overflow-y-auto p-6">
          {operationError && (
            <div className="mx-auto mb-4 max-w-3xl">
              <OperationErrorBanner error={operationError} onDismiss={clearOperationError} />
            </div>
          )}
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
      )}
    </div>
  );
}
