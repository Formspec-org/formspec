import { computed, signal } from '@preact/signals';
import type { FormEngine } from 'formspec-engine';
import type { BuilderDiagnostic, BuilderProject, ComponentDocument, EditorMode } from '../types';

export const project = signal<BuilderProject>({
    definition: null,
    component: null,
    theme: null,
    mappings: [],
    registries: [],
    changelogs: [],
});

export const engine = signal<FormEngine | null>(null);
export const diagnostics = signal<BuilderDiagnostic[]>([]);
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

// --- Component Document State ---

export const componentDoc = signal<ComponentDocument | null>(null);
export const componentVersion = signal(0);

export function setComponentDoc(doc: ComponentDocument | null) {
    componentDoc.value = doc;
    componentVersion.value += 1;
}

// --- Command Bar ---
export const commandBarOpen = signal(false);
