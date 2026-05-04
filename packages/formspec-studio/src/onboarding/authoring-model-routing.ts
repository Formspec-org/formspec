/** @filedesc Model routing policy for AI-first authoring flows. */
import { dispatchStudioEvent, STUDIO_EVENTS } from '../studio-events';

export type AuthoringTaskTier = 'fast' | 'reasoning' | 'governance';

export interface ModelRoutingDecision {
  operation: string;
  tier: AuthoringTaskTier;
  model: string;
}

export interface ModelRoutingPolicy {
  fast: string;
  reasoning: string;
  governance: string;
}

export const DEFAULT_MODEL_ROUTING_POLICY: ModelRoutingPolicy = {
  fast: 'gemini-3-flash-preview',
  reasoning: 'gemini-2.5-pro-preview',
  governance: 'gemini-2.5-pro-preview',
};

export function selectModelForOperation(operation: string, policy: ModelRoutingPolicy = DEFAULT_MODEL_ROUTING_POLICY): ModelRoutingDecision {
  if (operation === 'commit_version' || operation === 'governance_review') {
    return { operation, tier: 'governance', model: policy.governance };
  }
  if (operation === 'compose_patch' || operation === 'scaffold_definition') {
    return { operation, tier: 'reasoning', model: policy.reasoning };
  }
  return { operation, tier: 'fast', model: policy.fast };
}

export function emitModelRoutingDecision(decision: ModelRoutingDecision): void {
  if (typeof window === 'undefined') return;
  dispatchStudioEvent(STUDIO_EVENTS.MODEL_ROUTING, decision);
}
