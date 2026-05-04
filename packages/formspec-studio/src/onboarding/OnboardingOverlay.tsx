/** @filedesc First-run onboarding overlay: welcome, starter catalog selection, and AI intro. */
import { useState, type ReactElement } from 'react';
import { starterCatalog, type StarterCatalogEntry } from './starter-catalog';
import { markOnboardingCompleted } from './onboarding-storage';
import { IconSparkle, IconClose, IconPlus, IconArrowUp } from '../components/icons';
import { FormDefinition, Project } from '@formspec-org/studio-core';

interface OnboardingOverlayProps {
  project: Project;
  onComplete: () => void;
}

export function OnboardingOverlay({ project, onComplete }: OnboardingOverlayProps): ReactElement {
  const [step, setStep] = useState<'welcome' | 'catalog'>('welcome');

  const handleSelectStarter = (entry: StarterCatalogEntry) => {
    if (entry.bundle) {
      project.loadBundle(entry.bundle as any);
    }
    markOnboardingCompleted();
    onComplete();
  };

  const handleStartBlank = () => {
    markOnboardingCompleted();
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-default/40 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl overflow-hidden rounded-lg border border-border bg-surface shadow-premium-xl animate-onboarding-enter">
        {step === 'welcome' && (
          <div className="flex flex-col items-center p-10 text-center space-y-6">
            <div className="w-12 h-12 rounded-md bg-accent text-white flex items-center justify-center shadow-sm">
              <IconSparkle size={24} />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-xl font-display font-semibold tracking-tight text-ink">
                Welcome to Formspec Studio
              </h1>
              <p className="text-[13px] text-muted max-w-sm leading-relaxed">
                The document-first authoring environment for manifestation of complex forms.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full pt-4">
              <button
                onClick={() => setStep('catalog')}
                className="flex flex-col items-start p-4 rounded-md border border-border bg-subtle/50 hover:border-accent/40 hover:bg-surface transition-all text-left group"
              >
                <div className="w-8 h-8 rounded bg-surface border border-border flex items-center justify-center text-accent shadow-sm mb-3 group-hover:bg-accent group-hover:text-white transition-colors">
                  <IconPlus size={16} />
                </div>
                <h3 className="font-semibold text-[14px] text-ink">Use a Starter</h3>
                <p className="text-[11px] text-muted leading-normal mt-1">
                  Begin with a curated template for housing, benefits, or intake.
                </p>
              </button>

              <button
                onClick={handleStartBlank}
                className="flex flex-col items-start p-4 rounded-md border border-border bg-subtle/50 hover:border-accent/40 hover:bg-surface transition-all text-left group"
              >
                <div className="w-8 h-8 rounded bg-surface border border-border flex items-center justify-center text-accent shadow-sm mb-3 group-hover:bg-accent group-hover:text-white transition-colors">
                  <IconArrowUp size={16} className="rotate-45" />
                </div>
                <h3 className="font-semibold text-[14px] text-ink">Start Fresh</h3>
                <p className="text-[11px] text-muted leading-normal mt-1">
                  Begin with a blank canvas and build using AI or visual tools.
                </p>
              </button>
            </div>

            <p className="text-[11px] text-muted pt-4">
              Your preferences and projects are stored locally in your browser.
            </p>
          </div>
        )}

        {step === 'catalog' && (
          <div className="flex flex-col h-[600px]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setStep('welcome')}
                  className="p-1.5 hover:bg-subtle rounded transition-colors"
                >
                  <IconClose size={16} className="rotate-90" />
                </button>
                <h2 className="text-[15px] font-semibold tracking-tight">Starter Catalog</h2>
              </div>
              <button 
                onClick={handleStartBlank}
                className="text-[13px] font-medium text-muted hover:text-ink transition-colors"
              >
                Skip to Blank
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {starterCatalog.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => handleSelectStarter(entry)}
                  className="w-full flex items-start gap-4 p-4 rounded-md border border-border bg-subtle/20 hover:border-accent/40 hover:bg-surface transition-all text-left group"
                >
                  <div className="w-10 h-10 shrink-0 rounded bg-white border border-border flex items-center justify-center text-accent shadow-sm group-hover:bg-accent group-hover:text-white transition-all">
                    <IconSparkle size={18} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-[16px] text-ink">{entry.title}</h3>
                      {entry.diagnosticStatus === 'ready' && (
                        <span className="px-1.5 py-0.5 rounded-md bg-green/10 text-green text-[9px] font-extrabold uppercase tracking-wider">Ready</span>
                      )}
                    </div>
                    <p className="text-[13px] text-muted leading-relaxed line-clamp-2">
                      {entry.description}
                    </p>
                    <div className="flex items-center gap-4 pt-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted">
                        <span className="font-bold text-muted">{entry.stats.fieldCount}</span> fields
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted">
                        <span className="font-bold text-muted">{entry.stats.pageCount}</span> pages
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
