/** @filedesc Modal dialog for app-level settings (AI provider API key). */
import { useState, useEffect, useId } from 'react';
import type { ProviderConfig, ProviderType } from 'formspec-chat';
import { validateProviderConfig } from 'formspec-chat';

const STORAGE_KEY = 'formspec-studio:provider-config';

interface AppSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

function loadConfig(): ProviderConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveConfig(config: ProviderConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function clearConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

/** Returns the currently saved provider config, or null. */
export function getSavedProviderConfig(): ProviderConfig | null {
  return loadConfig();
}

export function AppSettingsDialog({ open, onClose }: AppSettingsDialogProps) {
  const titleId = useId();
  const saved = loadConfig();
  const [provider, setProvider] = useState<ProviderType>(saved?.provider ?? 'google');
  const [apiKey, setApiKey] = useState(saved?.apiKey ?? '');
  const [errors, setErrors] = useState<string[]>([]);
  const [saved_, setSaved_] = useState(false);

  useEffect(() => {
    if (!open) return;
    const config = loadConfig();
    setProvider(config?.provider ?? 'google');
    setApiKey(config?.apiKey ?? '');
    setErrors([]);
    setSaved_(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = () => {
    const config: ProviderConfig = { provider, apiKey };
    const validationErrors = validateProviderConfig(config);
    if (validationErrors.length > 0) {
      setErrors(validationErrors.map(e => e.message));
      return;
    }
    setErrors([]);
    saveConfig(config);
    setSaved_(true);
    setTimeout(() => onClose(), 600);
  };

  const handleClear = () => {
    clearConfig();
    setProvider('google');
    setApiKey('');
    setSaved_(false);
  };

  const hasExisting = !!saved;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
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
              className="w-full rounded-md border border-border bg-bg-default px-3 py-2 text-[13px] outline-none focus:border-accent/50 transition-colors"
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
              className="w-full rounded-md border border-border bg-bg-default px-3 py-2 text-[13px] font-mono outline-none focus:border-accent/50 transition-colors"
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
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex justify-between">
          <div>
            {hasExisting && (
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-1.5 text-[12px] font-medium rounded-md border border-error/30 text-error hover:bg-error/5 transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-[12px] font-medium rounded-md border border-border hover:bg-subtle transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-md bg-accent text-white hover:bg-accent/90 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
