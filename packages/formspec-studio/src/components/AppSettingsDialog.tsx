/** @filedesc Modal dialog for app-level settings (AI provider API key). */
import { useState, useEffect, useId } from 'react';
import type { ProviderConfig, ProviderType } from '@formspec-org/chat';
import { validateProviderConfig } from '@formspec-org/chat';
import {
  loadProviderConfig,
  saveProviderConfig,
  clearProviderConfig,
} from '../lib/provider-config-storage.js';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { dispatchStudioEvent, STUDIO_EVENTS } from '../studio-events';

interface AppSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

function dispatchOpenAssistantWorkspace(detail: { resetFirstRun?: boolean } = {}): void {
  dispatchStudioEvent(STUDIO_EVENTS.OPEN_ASSISTANT_WORKSPACE, detail);
}

/** Returns the currently saved provider config, or null. */
export function getSavedProviderConfig(): ProviderConfig | null {
  return loadProviderConfig();
}

export function AppSettingsDialog({ open, onClose }: AppSettingsDialogProps) {
  const titleId = useId();
  const saved = loadProviderConfig();
  const [provider, setProvider] = useState<ProviderType>(saved?.provider ?? 'google');
  const [apiKey, setApiKey] = useState(saved?.apiKey ?? '');
  const [errors, setErrors] = useState<string[]>([]);
  const [saved_, setSaved_] = useState(false);

  useEffect(() => {
    if (!open) return;
    const config = loadProviderConfig();
    setProvider(config?.provider ?? 'google');
    setApiKey(config?.apiKey ?? '');
    setErrors([]);
    setSaved_(false);
  }, [open]);

  useEscapeKey(onClose, open);

  if (!open) return null;

  const handleSave = () => {
    const config: ProviderConfig = { provider, apiKey };
    const validationErrors = validateProviderConfig(config);
    if (validationErrors.length > 0) {
      setErrors(validationErrors.map(e => e.message));
      return;
    }
    setErrors([]);
    saveProviderConfig(config);
    setSaved_(true);
    setTimeout(() => onClose(), 600);
  };

  const handleClear = () => {
    clearProviderConfig();
    setProvider('google');
    setApiKey('');
    setSaved_(false);
  };

  const handleOpenAssistantWorkspaceOnly = () => {
    dispatchOpenAssistantWorkspace({});
    onClose();
  };

  const handleResetFirstRunAndOpenAssistant = () => {
    dispatchOpenAssistantWorkspace({ resetFirstRun: true });
    onClose();
  };

  const hasExisting = !!saved;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-surface border border-border rounded-lg shadow-xl w-full max-w-md"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border">
          <h2 id={titleId} className="text-[15px] font-bold text-ink">
            App Settings
          </h2>
          <p className="text-[12px] text-muted mt-0.5">
            Configure your AI provider for the chat assistant.
          </p>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="app-provider" className="font-mono text-[11px] text-muted uppercase tracking-tight">
              Provider
            </label>
            <select
              id="app-provider"
              value={provider}
              onChange={e => setProvider(e.target.value as ProviderType)}
              className="w-full rounded-[4px] border border-border bg-bg-default px-3 py-2 text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-shadow"
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="google">Google (Gemini)</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="app-api-key" className="font-mono text-[11px] text-muted uppercase tracking-tight">
              API Key
            </label>
            <input
              id="app-api-key"
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              className="w-full rounded-[4px] border border-border bg-bg-default px-3 py-2 text-[13px] font-mono outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-shadow"
            />
            <p className="text-[11px] text-muted">
              Stored locally in your browser. Never sent to our servers.
            </p>
          </div>

          {errors.length > 0 && (
            <div className="rounded-md border border-error/30 bg-error/5 px-3 py-2 space-y-0.5">
              {errors.map((err, i) => (
                <p key={i} className="text-[12px] text-error">{err}</p>
              ))}
            </div>
          )}

          {saved_ && (
            <div className="rounded-md border border-green/30 bg-green/5 px-3 py-2">
              <p className="text-[12px] text-green font-medium">Settings saved.</p>
            </div>
          )}

          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-[12px] font-semibold text-ink">AI authoring surface</p>
            <p className="text-[11px] text-muted">
              Open full-screen AI authoring (starters, import, chat) with your current project. Your API key and provider choice are not changed.
            </p>
            <button
              type="button"
              data-testid="app-settings-open-assistant"
              onClick={handleOpenAssistantWorkspaceOnly}
              className="w-full px-3 py-1.5 text-[12px] font-medium rounded-[4px] border border-border hover:bg-subtle transition-colors focus-ring"
            >
              Open AI authoring surface
            </button>
            <div className="rounded-[4px] border border-border/80 bg-bg-default/40 px-3 py-2">
              <p className="text-[11px] font-medium text-ink">Reset first-run and open</p>
              <p className="mt-1 text-[11px] text-muted leading-snug">
                Clears completion, orientation tips, and saved assistant/workspace preference. Then opens the AI authoring surface with this project.
              </p>
              <button
                type="button"
                data-testid="app-settings-reset-first-run-open-assistant"
                onClick={handleResetFirstRunAndOpenAssistant}
                className="mt-2 w-full px-3 py-1.5 text-[12px] font-medium rounded-[4px] border border-border text-ink hover:bg-subtle transition-colors focus-ring"
              >
                Reset first-run tips &amp; open assistant
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex justify-between">
          <div>
            {hasExisting && (
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-1.5 text-[12px] font-medium rounded-[4px] border border-error/30 text-error hover:bg-error/5 transition-colors focus-ring"
              >
                Disconnect
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-[12px] font-medium rounded-[4px] border border-border hover:bg-subtle transition-colors focus-ring"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-[4px] bg-accent text-white hover:bg-accent/90 transition-colors focus-ring"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
