/** @filedesc Modal dialog for configuring the AI provider (Anthropic/Google) and API key. */
import React, { useState, useEffect, useId } from 'react';
import type { ProviderConfig, ProviderType } from 'formspec-chat';
import { validateProviderConfig } from 'formspec-chat';

interface ProviderSetupProps {
  open: boolean;
  onClose: () => void;
  onSave: (config: ProviderConfig) => void;
  initialConfig?: ProviderConfig;
  onClear?: () => void;
}

export function ProviderSetup({ open, onClose, onSave, initialConfig, onClear }: ProviderSetupProps) {
  const titleId = useId();
  const [provider, setProvider] = useState<ProviderType>(initialConfig?.provider ?? 'anthropic');
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey ?? '');
  const [errors, setErrors] = useState<string[]>([]);

  // Reset form state when dialog opens (avoids stale values from previous open)
  useEffect(() => {
    if (!open) return;
    setProvider(initialConfig?.provider ?? 'anthropic');
    setApiKey(initialConfig?.apiKey ?? '');
    setErrors([]);
  }, [open, initialConfig]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
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
    onSave(config);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md bg-surface border border-border rounded-lg shadow-xl shadow-black/10"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border">
          <h2 id={titleId} className="text-sm font-semibold text-ink">
            AI Provider Setup
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Configure an AI provider for conversational form building.
          </p>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="provider-select" className="text-xs font-medium text-ink">
              Provider
            </label>
            <select
              id="provider-select"
              value={provider}
              onChange={e => setProvider(e.target.value as ProviderType)}
              className="w-full rounded border border-border bg-bg-default px-3 py-2 text-sm text-ink outline-none focus:border-accent transition-colors"
            >
              <option value="anthropic">Anthropic</option>
              <option value="google">Google</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="api-key-input" className="text-xs font-medium text-ink">
              API Key
            </label>
            <input
              id="api-key-input"
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              className="w-full rounded border border-border bg-bg-default px-3 py-2 text-sm font-mono text-ink outline-none focus:border-accent transition-colors"
            />
          </div>

          {errors.length > 0 && (
            <div className="rounded-md bg-error/8 border border-error/20 px-3 py-2 space-y-0.5">
              {errors.map((err, i) => (
                <p key={i} className="text-xs text-error">{err}</p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-border flex justify-between">
          <div>
            {initialConfig && onClear && (
              <button
                onClick={onClear}
                className="px-3.5 py-1.5 text-sm rounded border border-error/30 text-error hover:bg-error/8 transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-sm rounded border border-border text-muted hover:text-ink hover:border-accent/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3.5 py-1.5 text-sm rounded bg-accent text-white font-medium hover:bg-accent/90 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
