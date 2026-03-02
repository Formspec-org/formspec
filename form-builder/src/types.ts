import type { FormspecDefinition } from 'formspec-engine';

export type ArtifactKind = 'definition' | 'component' | 'theme' | 'mapping' | 'registry' | 'changelog';

export interface ArtifactState {
  kind: ArtifactKind;
  data: unknown | null;
  dirty: boolean;
}

export interface BuilderProject {
  definition: FormspecDefinition | null;
  component: unknown | null;
  theme: unknown | null;
  mapping: unknown | null;
  registry: unknown | null;
  changelog: unknown | null;
}

export interface BuilderDiagnostic {
  severity: 'error' | 'warning' | 'info';
  artifact: ArtifactKind;
  path: string;
  message: string;
  source: string;
}

export type ExportProfile = 'definition-only' | 'full-bundle';

export type EditorMode = 'guided' | 'json';

export type NewItemType = 'field' | 'group' | 'display';

export interface InlineAddState {
  parentKey: string | null;
  insertIndex: number;
}
