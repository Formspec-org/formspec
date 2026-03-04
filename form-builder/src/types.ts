import type { FormspecDefinition } from 'formspec-engine';

/* ── Artifact Types ─────────────────────────────────────────── */

export type ArtifactKind = 'definition' | 'component' | 'theme' | 'mapping' | 'registry' | 'changelog';

export interface BuilderProject {
    definition: FormspecDefinition | null;
    component: unknown | null;
    theme: unknown | null;
    mappings: unknown[];
    registries: unknown[];
    changelogs: unknown[];
}

export interface BuilderDiagnostic {
    severity: 'error' | 'warning' | 'info';
    artifact: ArtifactKind;
    path: string;
    message: string;
    source: string;
}

/* ── Editor Modes ───────────────────────────────────────────── */

export type EditorMode = 'guided' | 'json';

/* ── Component Tree Types ───────────────────────────────────── */

export interface ComponentNode {
    component: string;
    bind?: string;
    when?: string;
    style?: Record<string, unknown>;
    cssClass?: string;
    title?: string;
    children?: ComponentNode[];
    [key: string]: unknown;
}

export interface ComponentDocument {
    $formspecComponent: '1.0';
    version: string;
    url?: string;
    name?: string;
    title?: string;
    description?: string;
    targetDefinition: { url: string; compatibleVersions?: string };
    breakpoints?: Record<string, number>;
    tokens?: Record<string, string | number>;
    components?: Record<string, { params?: string[]; tree: ComponentNode }>;
    tree: ComponentNode;
}

export type NodeKind = 'layout' | 'bound-input' | 'bound-display' | 'group' | 'structure-only';

export type ComponentTreePath = string;

/* ── Add Picker ─────────────────────────────────────────────── */

export type AddCategory = 'layout' | 'input' | 'display' | 'structure';

export interface AddPickerEntry {
    component: string;
    label: string;
    category: AddCategory;
    defaultDataType?: string;
    createsDefinitionItem?: boolean;
    definitionType?: 'field' | 'group' | 'display';
    promptForLabel?: boolean;
}
