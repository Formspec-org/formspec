/** @filedesc Capability-level telemetry for AI/manual authoring method parity tracking. */
import type { AuthoringFallbackReason } from './authoring-fallback-reasons.js';
import { dispatchStudioEvent, STUDIO_EVENTS } from '../studio-events';

export type AuthoringMethod = 'ai_only' | 'manual_only' | 'mixed';

export type AuthoringCapability =
  | 'metadata'
  | 'field_group_crud'
  | 'bind_rules'
  | 'layout_overrides'
  | 'mappings'
  | 'evidence_links'
  | 'patch_lifecycle'
  | 'export_publish'
  | 'unknown';

export type AuthoringTelemetryEventName =
  | 'authoring_capability_method_used'
  | 'authoring_capability_fallback';

export interface AuthoringTelemetryDetail {
  schemaVersion: 1;
  name: AuthoringTelemetryEventName;
  capability: AuthoringCapability;
  method: AuthoringMethod;
  surface: 'assistant' | 'studio';
  outcome: 'open' | 'accepted' | 'rejected' | 'applied' | 'fallback';
  fallbackReason?: AuthoringFallbackReason;
}

export function emitAuthoringTelemetry(
  detail: Omit<AuthoringTelemetryDetail, 'schemaVersion'>,
): void {
  if (typeof window === 'undefined') return;
  dispatchStudioEvent(STUDIO_EVENTS.AUTHORING_TELEMETRY, {
    schemaVersion: 1,
    ...detail,
  } satisfies AuthoringTelemetryDetail);
}

