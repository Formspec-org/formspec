/** @filedesc Modern provider setup modal with glassmorphism styling — v2. */
import React, { useState, useEffect, useId } from 'react';
import type { ProviderConfig, ProviderType } from '@formspec-org/chat';
import { validateProviderConfig } from '@formspec-org/chat';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface ProviderSetupProps {
  open: boolean;
  onClose: () => void;
  onSave: (config: ProviderConfig) => void;
  initialConfig?: ProviderConfig;
  onClear?: () => void;
  isInitialSetup?: boolean;
}

export function ProviderSetupV2({ open, onClose, onSave, initialConfig, onClear, isInitialSetup }: ProviderSetupProps) {
  const titleId = useId();
  const [provider, setProvider] = useState<ProviderType>(initialConfig?.provider ?? 'anthropic');
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey ?? '');
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setProvider(initialConfig?.provider ?? 'anthropic');
    setApiKey(initialConfig?.apiKey ?? '');
    setErrors([]);
  }, [open, initialConfig]);

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
    onSave(config);
  };

  return (
    <div
      className="v2-modal-overlay fixed inset-0 z-50 flex items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="v2-modal w-full max-w-md rounded-2xl v2-fade-up"
      >
        {/* Header */}
        <div className="v2-modal-header px-6 py-5">
          <h2 id={titleId} className="text-base font-bold v2-text-primary">
            {isInitialSetup ? 'Welcome' : 'AI Provider'}
          </h2>
          <p className="text-xs v2-text-secondary mt-1 leading-relaxed">
            {isInitialSetup
              ? 'Add your API key to get started. Stored locally, never sent to our servers.'
              : 'Configure your AI provider for conversational form building.'}
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <div className="space-y-2">
            <label htmlFor="v2-provider-select" className="text-xs font-semibold v2-text-primary">
              Provider
            </label>
            <select
              id="v2-provider-select"
              value={provider}
              onChange={e => setProvider(e.target.value as ProviderType)}
              className="v2-form-select w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all duration-150"
            >
              <option value="anthropic">Anthropic</option>
              <option value="google">Google</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="v2-api-key-input" className="text-xs font-semibold v2-text-primary">
              API Key
            </label>
            <input
              id="v2-api-key-input"
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              className="v2-form-input w-full rounded-xl px-3.5 py-2.5 text-sm font-mono outline-none transition-all duration-150"
            />
          </div>

          {errors.length > 0 && (
            <div className="v2-error-box rounded-xl px-4 py-3 space-y-0.5">
              {errors.map((err, i) => (
                <p key={i} className="text-xs">{err}</p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="v2-modal-footer px-6 py-4 flex justify-between">
          <div>
            {initialConfig && onClear && (
              <button onClick={onClear} className="v2-btn-danger px-4 py-2 text-sm rounded-xl font-medium transition-all duration-150">
                Disconnect
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="v2-btn-ghost px-4 py-2 text-sm rounded-xl font-medium transition-all duration-150">
              {isInitialSetup ? 'Skip for now' : 'Cancel'}
            </button>
            <button onClick={handleSave} className="v2-btn-primary px-4 py-2 text-sm rounded-xl font-semibold transition-all duration-200">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
