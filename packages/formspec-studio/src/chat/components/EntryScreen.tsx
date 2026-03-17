/** @filedesc Landing screen for starting a new chat session, picking a template, uploading, or resuming. */
import React, { useState } from 'react';
import type { SessionSummary, ProviderConfig } from 'formspec-chat';
import { TemplateLibrary } from 'formspec-chat';

const library = new TemplateLibrary();
const templates = library.getAll();

interface EntryScreenProps {
  onStartBlank: () => void;
  onSelectTemplate: (templateId: string) => void;
  onUpload: () => void;
  onResumeSession: (sessionId: string) => void;
  recentSessions: SessionSummary[];
  providerConfig?: ProviderConfig | null;
  onOpenSettings?: () => void;
  onDeleteSession?: (id: string) => void;
}

// SVG icons — inline, consistent stroke style at 20px
function IconEdit() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.5 3.5l3 3L7 16H4v-3L13.5 3.5z" />
    </svg>
  );
}

function IconTemplate() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" rx="1.5" />
      <line x1="3" y1="7.5" x2="17" y2="7.5" />
      <line x1="8" y1="7.5" x2="8" y2="17" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13V4M6.5 7.5L10 4l3.5 3.5" />
      <path d="M4 14v2a1 1 0 001 1h10a1 1 0 001-1v-2" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7" cy="7" r="5.5" />
      <path d="M7 4.5V7l2 1.5" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 3l4 4-4 4" />
    </svg>
  );
}

function IconArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 3L5 7l4 4" />
    </svg>
  );
}

function IconGear() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="2" />
      <path d="M13.5 8a5.5 5.5 0 01-.3 1.4l1.2.7-.8 1.4-1.2-.7a5.5 5.5 0 01-1.2 1.2l.7 1.2-1.4.8-.7-1.2a5.5 5.5 0 01-1.4.3v1.4H7V13.1a5.5 5.5 0 01-1.4-.3l-.7 1.2-1.4-.8.7-1.2a5.5 5.5 0 01-1.2-1.2l-1.2.7-.8-1.4 1.2-.7A5.5 5.5 0 012.5 8H1.1V6.6h1.4a5.5 5.5 0 01.3-1.4l-1.2-.7.8-1.4 1.2.7a5.5 5.5 0 011.2-1.2L4.1 1.4l1.4-.8.7 1.2A5.5 5.5 0 017.6 1.5V.1h1.4v1.4a5.5 5.5 0 011.4.3l.7-1.2 1.4.8-.7 1.2a5.5 5.5 0 011.2 1.2l1.2-.7.8 1.4-1.2.7a5.5 5.5 0 01.3 1.4h1.4V8z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 4h9M5 4V2.5h4V4M5.5 6v4M8.5 6v4M3.5 4l.5 7.5a1 1 0 001 .5h4a1 1 0 001-.5L10.5 4" />
    </svg>
  );
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  google: 'Google',
  openai: 'OpenAI',
};

export function EntryScreen({
  onStartBlank,
  onSelectTemplate,
  onUpload,
  onResumeSession,
  recentSessions,
  providerConfig,
  onOpenSettings,
  onDeleteSession,
}: EntryScreenProps) {
  const [showTemplates, setShowTemplates] = useState(false);

  return (
    <div className="entry-screen flex flex-col min-h-screen bg-bg-default font-ui">
      {/* Top strip — wordmark + provider indicator + settings */}
      <header className="flex items-center justify-between px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted/60 tracking-widest uppercase select-none">
            formspec
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={[
            'inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full border',
            providerConfig
              ? 'bg-accent/8 text-accent border-accent/25'
              : 'bg-subtle text-muted border-border',
          ].join(' ')}>
            {providerConfig ? PROVIDER_LABELS[providerConfig.provider] ?? providerConfig.provider : 'Offline'}
          </span>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-1.5 text-muted hover:text-ink rounded hover:bg-subtle transition-colors"
              aria-label="Settings"
            >
              <IconGear />
            </button>
          )}
        </div>
      </header>

      {/* Main content — upper golden ratio zone, not dead center */}
      <main className="flex-1 flex flex-col items-center justify-start pt-[12vh] sm:pt-[15vh] px-4 sm:px-6 lg:px-8 pb-16">
        <div className="w-full max-w-[540px] lg:max-w-[672px] space-y-10">

          {/* Hero heading */}
          <div className="space-y-3">
            <h1 className="text-[1.75rem] sm:text-[2rem] leading-tight font-semibold tracking-tight text-ink">
              Build forms through<br />
              <span className="text-accent">conversation</span>
            </h1>
            <p className="text-sm text-muted leading-relaxed max-w-sm">
              Describe what you need. Ask questions. Refine.
              The form assembles itself.
            </p>
          </div>

          {!showTemplates ? (
            <div className="space-y-8">
              {/* Primary action cards — stack on mobile, 3-col on sm+ */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                <ActionCard
                  icon={<IconEdit />}
                  label="Start blank"
                  description="Open conversation"
                  onClick={onStartBlank}
                  primary
                />
                <ActionCard
                  icon={<IconTemplate />}
                  label="Pick a template"
                  description="Common patterns"
                  onClick={() => setShowTemplates(true)}
                />
                <ActionCard
                  icon={<IconUpload />}
                  label="Upload files"
                  description="PDF, image, CSV"
                  onClick={onUpload}
                />
              </div>

              {/* Recent sessions */}
              {recentSessions.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono uppercase tracking-widest text-muted/60">
                      Recent
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="space-y-1.5">
                    {recentSessions.map(s => (
                      <RecentSessionRow
                        key={s.id}
                        session={s}
                        onClick={() => onResumeSession(s.id)}
                        onDelete={onDeleteSession ? () => onDeleteSession(s.id) : undefined}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Template grid */
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono uppercase tracking-widest text-muted/60">
                    Templates
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="flex items-center gap-1 text-xs text-muted hover:text-ink transition-colors group"
                >
                  <span className="group-hover:-translate-x-0.5 transition-transform">
                    <IconArrowLeft />
                  </span>
                  Back
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => onSelectTemplate(t.id)}
                    className="group text-left px-4 py-3.5 rounded-md border border-border bg-surface hover:border-accent hover:bg-accent/[0.02] transition-all duration-150"
                  >
                    <span className="text-sm font-medium text-ink block leading-snug">
                      {t.name}
                    </span>
                    <span className="text-xs text-muted mt-0.5 block leading-relaxed">
                      {t.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function ActionCard({
  icon,
  label,
  description,
  onClick,
  primary = false,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'group flex items-center gap-3 px-4 py-4 rounded-lg border text-left',
        // On sm+, switch to vertical centered layout
        'sm:flex-col sm:items-center sm:gap-2.5 sm:px-3 sm:py-5 sm:text-center',
        'transition-all duration-150',
        primary
          ? 'border-accent/40 bg-accent/[0.04] hover:bg-accent/[0.08] hover:border-accent/70 hover:-translate-y-0.5 hover:shadow-sm'
          : 'border-border bg-surface hover:border-accent/60 hover:bg-accent/[0.02] hover:-translate-y-0.5 hover:shadow-sm',
      ].join(' ')}
    >
      <span className={primary ? 'text-accent' : 'text-muted group-hover:text-ink transition-colors'}>
        {icon}
      </span>
      <span className="space-y-0.5">
        <span className={`text-sm font-medium block ${primary ? 'text-accent' : 'text-ink'}`}>
          {label}
        </span>
        <span className="text-[11px] text-muted block leading-snug">{description}</span>
      </span>
    </button>
  );
}

function RecentSessionRow({
  session,
  onClick,
  onDelete,
}: {
  session: SessionSummary;
  onClick: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="group flex items-center gap-0.5">
      <button
        onClick={onClick}
        className="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-md border border-transparent hover:border-border hover:bg-surface transition-all duration-150 text-left"
      >
        <span className="text-muted/50 flex-shrink-0">
          <IconClock />
        </span>
        <span className="flex-1 min-w-0">
          <span className="text-sm text-ink truncate block">{session.preview}</span>
        </span>
        <span className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[11px] text-muted/60">{session.messageCount} msg</span>
          <span className="text-muted/40 group-hover:text-muted/70 transition-colors">
            <IconChevronRight />
          </span>
        </span>
      </button>
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 text-muted/40 hover:text-error rounded hover:bg-error/8 transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Delete session"
        >
          <IconTrash />
        </button>
      )}
    </div>
  );
}
