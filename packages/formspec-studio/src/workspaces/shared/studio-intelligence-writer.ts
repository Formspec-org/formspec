/** @filedesc UI helpers for writing Studio intelligence metadata into definition extensions. */
import {
  STUDIO_EXTENSION_KEY,
  type EvidenceDocument,
  type FieldProvenance,
  type LayoutDocument,
  type StudioConfidence,
  type StudioOrigin,
  type StudioPatch,
  type StudioReviewStatus,
  type Project,
  type MutationClass,
} from '@formspec-org/studio-core';
import {
  emitAuthoringTelemetry,
  type AuthoringCapability,
} from '../../onboarding/authoring-method-telemetry.js';
import {
  AUTHORING_FALLBACK_REASONS,
  type AuthoringFallbackReason,
} from '../../onboarding/authoring-fallback-reasons.js';

export interface WritableStudioExtension {
  provenance: FieldProvenance[];
  evidence: { documents: EvidenceDocument[] };
  layouts: LayoutDocument[];
  patches: StudioPatch[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function currentExtension(project: Project): WritableStudioExtension {
  const rawExtensions = isRecord(project.definition.extensions) ? project.definition.extensions : {};
  const raw = isRecord(rawExtensions[STUDIO_EXTENSION_KEY]) ? rawExtensions[STUDIO_EXTENSION_KEY] : {};
  const evidence = isRecord(raw.evidence) ? raw.evidence : {};
  return {
    provenance: Array.isArray(raw.provenance) ? raw.provenance as FieldProvenance[] : [],
    evidence: {
      documents: Array.isArray(evidence.documents) ? evidence.documents as EvidenceDocument[] : [],
    },
    layouts: Array.isArray(raw.layouts) ? raw.layouts as LayoutDocument[] : [],
    patches: Array.isArray(raw.patches) ? raw.patches as StudioPatch[] : [],
  };
}

export function updateStudioExtension(project: Project, updater: (draft: WritableStudioExtension) => WritableStudioExtension): void {
  const bundle = project.export();
  const next = updater(currentExtension(project));
  const extensions = {
    ...(isRecord(bundle.definition.extensions) ? bundle.definition.extensions : {}),
    [STUDIO_EXTENSION_KEY]: next,
  };
  project.loadBundle({
    ...bundle,
    definition: {
      ...bundle.definition,
      extensions,
    },
  });
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function patchId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function upsertStudioPatch(project: Project, patch: StudioPatch): void {
  updateStudioExtension(project, (draft) => {
    const existingIndex = draft.patches.findIndex((entry) => entry.id === patch.id);
    if (existingIndex >= 0) {
      const nextPatches = [...draft.patches];
      nextPatches[existingIndex] = {
        ...nextPatches[existingIndex],
        ...patch,
        affectedRefs: unique([...(nextPatches[existingIndex].affectedRefs ?? []), ...(patch.affectedRefs ?? [])]),
      };
      return { ...draft, patches: nextPatches };
    }
    return {
      ...draft,
      patches: [...draft.patches, { ...patch, affectedRefs: unique(patch.affectedRefs ?? []) }],
    };
  });
}

export function upsertFieldProvenance(project: Project, entries: FieldProvenance[]): void {
  if (entries.length === 0) return;
  updateStudioExtension(project, (draft) => {
    const byRef = new Map(draft.provenance.map((entry) => [entry.objectRef, entry]));
    for (const incoming of entries) {
      const existing = byRef.get(incoming.objectRef);
      if (!existing) {
        byRef.set(incoming.objectRef, {
          ...incoming,
          sourceRefs: unique(incoming.sourceRefs ?? []),
          patchRefs: unique(incoming.patchRefs ?? []),
        });
        continue;
      }
      byRef.set(incoming.objectRef, {
        ...existing,
        ...incoming,
        sourceRefs: unique([...(existing.sourceRefs ?? []), ...(incoming.sourceRefs ?? [])]),
        patchRefs: unique([...(existing.patchRefs ?? []), ...(incoming.patchRefs ?? [])]),
      });
    }
    return { ...draft, provenance: [...byRef.values()] };
  });
}

export function recordManualPatchAndProvenance(
  project: Project,
  params: {
    summary: string;
    affectedRefs: string[];
    sourceRefs?: string[];
    confidence?: StudioConfidence;
    reviewStatus?: StudioReviewStatus;
    origin?: StudioOrigin;
    capability?: AuthoringCapability;
    surface?: 'assistant' | 'studio';
  },
): string {
  const id = patchId('manual');
  const affectedRefs = unique(params.affectedRefs);
  upsertStudioPatch(project, {
    id,
    source: params.origin ?? 'manual',
    scope: 'spec',
    summary: params.summary,
    affectedRefs,
    status: 'accepted',
  });
  upsertFieldProvenance(project, affectedRefs.map((ref) => ({
    objectRef: ref,
    origin: params.origin ?? 'manual',
    rationale: params.summary,
    confidence: params.confidence ?? 'medium',
    sourceRefs: params.sourceRefs ?? [],
    patchRefs: [id],
    reviewStatus: params.reviewStatus ?? 'confirmed',
  })));
  emitAuthoringTelemetry({
    name: 'authoring_capability_method_used',
    capability: params.capability ?? 'unknown',
    method: 'manual_only',
    surface: params.surface ?? 'studio',
    outcome: 'applied',
  });
  return id;
}

function capabilityToMutationClass(capability: AuthoringCapability | undefined): MutationClass | undefined {
  if (capability === 'bind_rules') return 'bind';
  if (capability === 'mappings') return 'Mapping';
  if (capability === 'layout_overrides') return 'shape';
  // field_group_crud could be Variable or OptionSet depending on the tool;
  // leave undefined here and let call sites pass explicit mutationClass when known.
  return undefined;
}

export function recordAiPatchLifecycle(
  project: Project,
  params: {
    changesetId: string;
    summary: string;
    affectedRefs: string[];
    status: StudioPatch['status'];
    scope?: StudioPatch['scope'];
    confidence?: StudioConfidence;
    provenanceReviewStatus?: StudioReviewStatus;
    capability?: AuthoringCapability;
    fallbackReason?: AuthoringFallbackReason;
  },
): string {
  const id = `changeset:${params.changesetId}`;
  const affectedRefs = unique(params.affectedRefs);
  upsertStudioPatch(project, {
    id,
    source: 'ai',
    scope: params.scope ?? 'spec',
    summary: params.summary,
    affectedRefs,
    status: params.status,
  });
  if (params.status === 'accepted' && affectedRefs.length > 0) {
    const mutationClass = capabilityToMutationClass(params.capability);
    upsertFieldProvenance(project, affectedRefs.map((ref) => ({
      objectRef: ref,
      origin: 'ai',
      rationale: params.summary,
      confidence: params.confidence ?? 'medium',
      sourceRefs: [`changeset.${params.changesetId}`],
      patchRefs: [id],
      reviewStatus: params.provenanceReviewStatus ?? 'confirmed',
      mutationClass,
      beforeAfterSummary: mutationClass ? `This ${mutationClass.toLowerCase()} change affects ${ref}.` : undefined,
    })));
  }
  const outcome = params.status === 'open' ? 'open' : params.status === 'accepted' ? 'accepted' : 'rejected';
  emitAuthoringTelemetry({
    name: 'authoring_capability_method_used',
    capability: params.capability ?? 'patch_lifecycle',
    method: 'ai_only',
    surface: 'assistant',
    outcome,
  });
  if (params.status === 'rejected') {
    emitAuthoringTelemetry({
      name: 'authoring_capability_fallback',
      capability: params.capability ?? 'patch_lifecycle',
      method: 'mixed',
      surface: 'assistant',
      outcome: 'fallback',
      fallbackReason: params.fallbackReason ?? AUTHORING_FALLBACK_REASONS.AI_CHANGESET_REJECTED,
    });
  }
  return id;
}
