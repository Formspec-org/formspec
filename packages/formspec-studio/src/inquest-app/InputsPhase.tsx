import { useCallback, useState } from 'react';
import { TemplateGallery } from '../features/template-gallery/TemplateGallery';
import { ProviderSetup } from '../features/provider-setup/ProviderSetup';
import { RecentSessions } from '../features/recent-sessions/RecentSessions';
import { InquestThread } from './InquestThread';
import type {
  ConnectionResult,
  InquestSessionV1,
  InquestUploadSummary,
} from '../shared/contracts/inquest';
import { inquestProviderAdapters } from '../shared/providers';
import { inquestTemplates } from '../shared/templates/templates';
import type { RecentSessionEntry } from '../shared/persistence/inquest-store';
import { FormspecIcon } from './AppHeader';

/* ── Quick-start prompts ──────────────────────── */

const QUICK_START_PROMPTS = [
  {
    icon: 'user' as const,
    label: 'Patient intake',
    prompt: 'Build a patient intake form for a medical practice with demographics, medical history, current medications, and insurance information.',
  },
  {
    icon: 'document' as const,
    label: 'Grant application',
    prompt: 'Create a grant application form with organization details, project description, goals, budget breakdown, and expected impact metrics.',
  },
  {
    icon: 'chart' as const,
    label: 'Customer survey',
    prompt: 'Design a customer satisfaction survey with NPS rating, product feedback, open-ended comments, and demographic questions.',
  },
  {
    icon: 'calendar' as const,
    label: 'Event registration',
    prompt: 'Build an event registration form with attendee details, session selection, dietary requirements, and emergency contact.',
  },
];

function QuickStartIcon({ name }: { name: typeof QUICK_START_PROMPTS[number]['icon'] }) {
  const paths: Record<string, string> = {
    user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    document: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  };
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={paths[name]} />
    </svg>
  );
}

/* ── Small presentational components ──────────── */

function OperationErrorBanner({ error, onDismiss }: { error: string; onDismiss: () => void }) {
  return (
    <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-red-700">Something went wrong</div>
          <div className="mt-0.5 text-[11px] text-red-600 leading-relaxed">{error}</div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-red-400 hover:text-red-600 transition-colors"
          aria-label="Dismiss error"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function GenerateCTA({ isAnalyzing, onDraftFast, onVerifyCarefully }: {
  isAnalyzing: boolean;
  onDraftFast: () => void;
  onVerifyCarefully: () => void;
}) {
  return (
    <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-5">
        <div className="mb-3.5 flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-accent">Ready to generate</span>
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onDraftFast}
            disabled={isAnalyzing}
            className="group flex flex-1 items-center gap-3 rounded-xl border-2 border-transparent bg-white p-3.5 text-left shadow-sm transition-all hover:border-slate-900 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white transition-transform group-hover:scale-105 group-disabled:scale-100">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-[13px] text-slate-900">Draft Fast</div>
              <div className="mt-0.5 text-[11px] text-slate-400">Skip analysis, go straight to scaffold</div>
            </div>
          </button>

          <button
            type="button"
            onClick={onVerifyCarefully}
            disabled={isAnalyzing}
            className="group flex flex-1 items-center gap-3 rounded-xl border-2 border-transparent bg-white p-3.5 text-left shadow-sm transition-all hover:border-emerald-500 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white transition-transform group-hover:scale-105 group-disabled:scale-100">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-[13px] text-slate-900">Verify Carefully</div>
              <div className="mt-0.5 text-[11px] text-slate-400">Deep semantic analysis first</div>
            </div>
          </button>
        </div>

        {isAnalyzing && (
          <div className="mt-3 flex items-center gap-2 text-[11px] font-medium text-slate-400">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
            Working on it…
          </div>
        )}
      </div>
    </div>
  );
}

function WelcomeHero({ isAnalyzing, onQuickStart, onToggleGallery }: {
  isAnalyzing: boolean;
  onQuickStart: (text: string) => void;
  onToggleGallery: () => void;
}) {
  return (
    <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-4 flex items-center gap-2">
        <div className="h-px w-8 bg-warm-border" />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Quick starts</span>
        <div className="h-px flex-1 bg-warm-border" />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {QUICK_START_PROMPTS.map(({ icon, label, prompt }) => (
          <button
            key={label}
            type="button"
            disabled={isAnalyzing}
            onClick={() => onQuickStart(prompt)}
            className="group flex items-center gap-2.5 rounded-xl border border-warm-border bg-white p-3.5 text-left shadow-sm transition-all hover:border-accent/40 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warm-subtle text-brass transition-colors group-hover:bg-accent/10 group-hover:text-accent">
              <QuickStartIcon name={icon} />
            </div>
            <span className="font-semibold text-[13px] leading-tight text-slate-700">{label}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-warm-border" />
        <button
          type="button"
          onClick={onToggleGallery}
          className="whitespace-nowrap text-[11px] font-semibold text-slate-400 transition-colors hover:text-accent"
        >
          Browse all blueprints →
        </button>
        <div className="h-px flex-1 bg-warm-border" />
      </div>
    </div>
  );
}

function TemplateSection({ showFull, selectedTemplateId, onToggleFull, onSelect }: {
  showFull: boolean;
  selectedTemplateId: string | undefined;
  onToggleFull: () => void;
  onSelect: (templateId: string) => void;
}) {
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

function UploadChips({ uploads, onRemove }: { uploads: InquestUploadSummary[]; onRemove: (id: string) => void }) {
  if (uploads.length === 0) return null;
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {uploads.map((u) => (
        <div
          key={u.id}
          className="flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/[0.06] pl-2.5 pr-1.5 py-1 text-[11px] font-medium text-accent"
        >
          <svg className="h-3 w-3 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          <span className="max-w-[140px] truncate">{u.name}</span>
          <button
            type="button"
            onClick={() => onRemove(u.id)}
            className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-accent/60 transition-colors hover:bg-accent/15 hover:text-accent"
            aria-label={`Remove ${u.name}`}
          >
            <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

function ComposerToolbar({ showFullGallery, onFileUpload, onToggleGallery }: {
  showFullGallery: boolean;
  onFileUpload: (files: FileList | null) => void;
  onToggleGallery: () => void;
}) {
  return (
    <div className="mt-3 flex items-center justify-between px-1 text-[12px] font-medium text-slate-400">
      <div className="flex gap-4">
        <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-600 transition-colors">
          <input
            type="file"
            className="hidden"
            multiple
            onChange={(e) => onFileUpload(e.target.files)}
          />
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          <span>Add context</span>
        </label>

        <button
          type="button"
          onClick={onToggleGallery}
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
}

/* ── Provider setup (shown when no key configured) ── */

function ProviderSetupPanel({ session, providerApiKey, rememberKey, connection, isTesting, onContinue, onProviderSelected, onApiKeyChange, onRememberChange, onTestConnection, onCredentialsCleared }: {
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
}) {
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

/* ── Helpers ──────────────────────────────────── */

function meaningfulInput(session: InquestSessionV1): boolean {
  return Boolean(
    session.input.templateId
    || session.input.description.trim().length >= 10
    || session.input.uploads.length > 0
    || session.input.messages.some((m) => m.role === 'user'),
  );
}

/* ── Inputs phase (main export) ───────────────── */

export interface InputsPhaseProps {
  session: InquestSessionV1;
  isAnalyzing: boolean;
  operationError: string | null;
  recentSessions: RecentSessionEntry[];

  // Provider
  isSetupRequired: boolean;
  providerApiKey: string;
  rememberKey: boolean;
  connection: ConnectionResult | undefined;
  isTesting: boolean;

  // Callbacks
  onChatNew: (text: string) => Promise<void>;
  onDraftFast: () => void;
  onVerifyCarefully: () => void;
  onTemplateSelect: (templateId: string) => void;
  onFileUpload: (files: FileList | null) => void;
  onRemoveUpload: (id: string) => void;
  onDismissError: () => void;
  onOpenSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onCreateFreshSession: () => void;

  // Provider callbacks
  onProviderContinue: () => void;
  onProviderSelected: (id: string) => void;
  onApiKeyChange: (val: string) => void;
  onRememberChange: (val: boolean) => void;
  onTestConnection: () => void;
  onCredentialsCleared: () => void;
}

export function InputsPhase({
  session,
  isAnalyzing,
  operationError,
  recentSessions,
  isSetupRequired,
  providerApiKey,
  rememberKey,
  connection,
  isTesting,
  onChatNew,
  onDraftFast,
  onVerifyCarefully,
  onTemplateSelect,
  onFileUpload,
  onRemoveUpload,
  onDismissError,
  onOpenSession,
  onDeleteSession,
  onCreateFreshSession,
  onProviderContinue,
  onProviderSelected,
  onApiKeyChange,
  onRememberChange,
  onTestConnection,
  onCredentialsCleared,
}: InputsPhaseProps) {
  const [showFullGallery, setShowFullGallery] = useState(false);
  const handleToggleGallery = useCallback(() => setShowFullGallery((v) => !v), []);

  const isWelcomeState = session.input.messages.length === 1 && !meaningfulInput(session);

  return (
    <main className="flex flex-1 overflow-hidden">
      {/* Left sidebar: history */}
      <aside className="w-[280px] border-r border-warm-border bg-warm-subtle/30 flex flex-col shrink-0">
        <div className="flex-1 overflow-y-auto p-4">
          <RecentSessions
            sessions={recentSessions}
            onOpen={onOpenSession}
            onDelete={onDeleteSession}
            onStartNew={onCreateFreshSession}
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
            onContinue={onProviderContinue}
            onProviderSelected={onProviderSelected}
            onApiKeyChange={onApiKeyChange}
            onRememberChange={onRememberChange}
            onTestConnection={onTestConnection}
            onCredentialsCleared={onCredentialsCleared}
          />
        ) : (
          <InquestThread
            messages={session.input.messages}
            isRunning={isAnalyzing}
            onNew={onChatNew}
            afterMessages={
              <>
                {operationError && (
                  <OperationErrorBanner error={operationError} onDismiss={onDismissError} />
                )}
                {!operationError && meaningfulInput(session) && (
                  <GenerateCTA
                    isAnalyzing={isAnalyzing}
                    onDraftFast={onDraftFast}
                    onVerifyCarefully={onVerifyCarefully}
                  />
                )}
                {showFullGallery && (
                  <TemplateSection
                    showFull
                    selectedTemplateId={session.input.templateId}
                    onToggleFull={handleToggleGallery}
                    onSelect={onTemplateSelect}
                  />
                )}
                {!showFullGallery && isWelcomeState && (
                  <WelcomeHero
                    isAnalyzing={isAnalyzing}
                    onQuickStart={(text) => void onChatNew(text)}
                    onToggleGallery={handleToggleGallery}
                  />
                )}
              </>
            }
            belowComposer={
              <>
                <UploadChips
                  uploads={session.input.uploads}
                  onRemove={onRemoveUpload}
                />
                <ComposerToolbar
                  showFullGallery={showFullGallery}
                  onFileUpload={onFileUpload}
                  onToggleGallery={handleToggleGallery}
                />
              </>
            }
          />
        )}
      </section>
    </main>
  );
}

export { OperationErrorBanner };
