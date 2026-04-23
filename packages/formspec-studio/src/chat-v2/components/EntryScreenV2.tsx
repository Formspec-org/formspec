/** @filedesc Modern landing screen with gradient hero, action cards, and recent sessions — v2. */
import React, { useState } from 'react';
import type { SessionSummary, ProviderConfig } from '@formspec-org/chat';
import { TemplateLibrary } from '@formspec-org/chat';

import {
  IconPen,
  IconGrid,
  IconUpload,
  IconClock,
  IconChevronRight as IconChevron,
  IconChevronLeft as IconArrowLeft,
  IconSettings,
  IconTrash,
} from '../../components/icons';

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

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  google: 'Google',
  openai: 'OpenAI',
};

export function EntryScreenV2({
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
    <div className="v2-entry flex flex-col min-h-screen">
      {/* Header bar */}
      <header className="v2-entry-header flex items-center justify-between px-5 sm:px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="v2-logo-mark w-7 h-7 rounded-lg flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1l1.5 4H13l-3.5 2.5L11 12 7 9l-4 3 1.5-4.5L1 5h4.5L7 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="currentColor" fillOpacity="0.2" />
            </svg>
          </div>
          <span className="v2-wordmark text-xs font-semibold tracking-[0.2em] uppercase select-none">
            Formspec
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`v2-provider-badge inline-flex items-center px-2.5 py-1 text-[11px] font-medium rounded-full ${providerConfig ? 'v2-provider-active' : 'v2-provider-offline'}`}>
            {providerConfig ? PROVIDER_LABELS[providerConfig.provider] ?? providerConfig.provider : 'Offline'}
          </span>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="v2-icon-btn p-2 rounded-lg transition-all duration-150"
              aria-label="Settings"
            >
              <IconSettings />
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-start pt-[10vh] sm:pt-[14vh] px-5 sm:px-8 pb-16">
        <div className="w-full max-w-[580px] lg:max-w-[640px] space-y-10 v2-fade-up">
          {/* Hero */}
          <div className="space-y-4">
            <h1 className="v2-hero-title text-[2rem] sm:text-[2.5rem] leading-[1.15] font-bold tracking-tight">
              Build forms through
              <br />
              <span className="v2-hero-accent">conversation.</span>
            </h1>
            <p className="v2-text-secondary text-sm sm:text-base leading-relaxed max-w-[420px]">
              Describe what you need. Refine as you go. Your form assembles itself.
            </p>
          </div>

          {!showTemplates ? (
            <div className="space-y-10">
              {/* Action cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <ActionCard
                  icon={<IconPen />}
                  label="Start blank"
                  description="Open conversation"
                  onClick={onStartBlank}
                  primary
                />
                <ActionCard
                  icon={<IconGrid />}
                  label="Templates"
                  description="Common patterns"
                  onClick={() => setShowTemplates(true)}
                />
                <ActionCard
                  icon={<IconUpload />}
                  label="Upload"
                  description="PDF, CSV, image"
                  onClick={onUpload}
                />
              </div>

              {/* Recent sessions */}
              {recentSessions.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="v2-section-label text-[11px] font-semibold tracking-[0.15em] uppercase">
                      Recent
                    </span>
                    <div className="flex-1 h-px v2-divider" />
                  </div>
                  <div className="space-y-1">
                    {recentSessions.map(s => (
                      <RecentRow
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
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="v2-section-label text-[11px] font-semibold tracking-[0.15em] uppercase">
                  Templates
                </span>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="v2-back-link flex items-center gap-1.5 text-xs font-medium transition-colors"
                >
                  <IconArrowLeft />
                  Back
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => onSelectTemplate(t.id)}
                    className="v2-template-card text-left px-4 py-4 rounded-xl transition-all duration-200"
                  >
                    <span className="v2-text-primary text-sm font-medium block leading-snug">{t.name}</span>
                    <span className="v2-text-secondary text-xs mt-1 block leading-relaxed">{t.description}</span>
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

// ── Sub-components ───────────────────────────────────────────────────

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
        'v2-action-card group flex items-center gap-3 px-4 py-4 rounded-xl text-left',
        'sm:flex-col sm:items-center sm:gap-3 sm:px-4 sm:py-6 sm:text-center',
        'transition-all duration-200',
        primary ? 'v2-action-primary' : 'v2-action-default',
      ].join(' ')}
    >
      <span className={`v2-action-icon ${primary ? 'v2-action-icon-primary' : ''}`}>
        {icon}
      </span>
      <span className="space-y-0.5">
        <span className={`text-sm font-semibold block ${primary ? 'v2-text-accent' : 'v2-text-primary'}`}>
          {label}
        </span>
        <span className="v2-text-tertiary text-[11px] block leading-snug">{description}</span>
      </span>
    </button>
  );
}

function RecentRow({
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
        className="v2-recent-row flex-1 flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150 text-left"
      >
        <span className="v2-text-tertiary flex-shrink-0">
          <IconClock />
        </span>
        <span className="flex-1 min-w-0">
          <span className="v2-text-primary text-sm truncate block">{session.preview}</span>
        </span>
        <span className="flex items-center gap-2 flex-shrink-0">
          <span className="v2-text-tertiary text-[11px]">{session.messageCount} msg</span>
          <span className="v2-text-tertiary transition-transform group-hover:translate-x-0.5 duration-150">
            <IconChevron />
          </span>
        </span>
      </button>
      {onDelete && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="v2-delete-btn p-1.5 rounded-lg transition-all duration-150 opacity-0 group-hover:opacity-100"
          aria-label="Delete session"
        >
          <IconTrash />
        </button>
      )}
    </div>
  );
}
