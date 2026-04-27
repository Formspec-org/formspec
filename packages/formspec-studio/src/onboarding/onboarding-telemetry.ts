/** @filedesc Telemetry helpers for first-run onboarding events. */
import { loadProviderConfig } from '../lib/provider-config-storage.js';
import type { EnterWorkspaceSource } from './enter-workspace-source.js';

export type OnboardingEventName =
  | 'onboarding_viewed'
  | 'onboarding_completed'
  | 'onboarding_first_meaningful_edit'
  | 'onboarding_starter_selected'
  | 'onboarding_diagnostics_snapshot'
  | 'onboarding_enter_workspace_intent';

export interface OnboardingTelemetryDetail {
  schemaVersion: 1;
  name: OnboardingEventName;
  variant: 'assistant-first';
  buildMode: 'demo-internal-default' | 'user-configured' | 'no-provider';
  starterId?: string;
  trigger?: 'field_count_increase' | 'preview_open';
  diagnosticTotal?: number;
  diagnosticErrors?: number;
  diagnosticWarnings?: number;
  enterWorkspaceSource?: EnterWorkspaceSource;
}

function resolveBuildMode(): OnboardingTelemetryDetail['buildMode'] {
  const config = loadProviderConfig();
  const hasProviderConfig = Boolean(config?.apiKey);
  const hasSeededDevKey = Boolean(import.meta.env.VITE_GEMINI_DEV_KEY);
  if (hasProviderConfig && hasSeededDevKey) return 'demo-internal-default';
  if (hasProviderConfig) return 'user-configured';
  return 'no-provider';
}

export function emitOnboardingTelemetry(
  name: OnboardingEventName,
  partialDetail: Omit<OnboardingTelemetryDetail, 'schemaVersion' | 'name' | 'variant' | 'buildMode'> = {},
): void {
  if (typeof window === 'undefined') return;
  const detail: OnboardingTelemetryDetail = {
    schemaVersion: 1,
    name,
    variant: 'assistant-first',
    buildMode: resolveBuildMode(),
    ...partialDetail,
  };
  window.dispatchEvent(new CustomEvent('formspec:onboarding-telemetry', { detail }));
}
