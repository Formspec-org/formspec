import { computed, signal } from '@preact/signals';
import type { FormEngine } from 'formspec-engine';
import type { ArtifactKind, BuilderDiagnostic, BuilderProject, EditorMode } from '../types';

export const project = signal<BuilderProject>({
  definition: null,
  component: null,
  theme: null,
  mapping: null,
  registry: null,
  changelog: null,
});

export const engine = signal<FormEngine | null>(null);
export const diagnostics = signal<BuilderDiagnostic[]>([]);
export const activeArtifact = signal<ArtifactKind>('definition');
export const editorMode = signal<EditorMode>('guided');

export const diagnosticCounts = computed(() => {
  const current = diagnostics.value;
  return {
    error: current.filter((d) => d.severity === 'error').length,
    warning: current.filter((d) => d.severity === 'warning').length,
    info: current.filter((d) => d.severity === 'info').length,
  };
});

export const hasBlockingErrors = computed(() => diagnosticCounts.value.error > 0);
