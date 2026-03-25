/** @filedesc FormspecProvider — React context wrapping a FormEngine + optional layout plan. */
import React, { createContext, useContext, useMemo, useEffect, useRef, useCallback } from 'react';
import { signal } from '@preact/signals-core';
import type { ReadonlyEngineSignal } from 'formspec-engine';
import type { IFormEngine } from 'formspec-engine';
import { createFormEngine } from 'formspec-engine';
import type { LayoutNode, PlanContext } from 'formspec-layout';
import { planDefinitionFallback, planComponentTree } from 'formspec-layout';
import type { ComponentMap } from './component-map';

export interface FormspecContextValue {
    engine: IFormEngine;
    layoutPlan: LayoutNode | null;
    components: ComponentMap;
    /** Mark a field as touched (e.g., on blur). */
    touchField: (path: string) => void;
    /** Signal that increments when touched set changes — subscribe for reactivity. */
    touchedVersion: ReadonlyEngineSignal<number>;
    /** Check if a field has been touched. Read touchedVersion.value first for reactivity. */
    isTouched: (path: string) => boolean;
}

const FormspecContext = createContext<FormspecContextValue | null>(null);

export interface FormspecProviderProps {
    /** Pre-built FormEngine instance. Mutually exclusive with `definition`. */
    engine?: IFormEngine;
    /** Raw definition JSON. Will create a FormEngine internally. */
    definition?: any;
    /** Component document for layout planning. */
    componentDocument?: any;
    /** Theme document for presentation cascade. */
    themeDocument?: any;
    /** Component map overrides. */
    components?: ComponentMap;
    children: React.ReactNode;
}

/**
 * Provides FormEngine and layout plan to descendant hooks and renderers.
 *
 * Accepts either a pre-built `engine` or a raw `definition` (creates engine internally).
 */
export function FormspecProvider({
    engine: externalEngine,
    definition,
    componentDocument,
    themeDocument,
    components = {},
    children,
}: FormspecProviderProps) {
    const engine = useMemo(() => {
        if (externalEngine) return externalEngine;
        if (!definition) throw new Error('FormspecProvider requires either engine or definition');
        return createFormEngine(definition);
    }, [externalEngine, definition]);

    const layoutPlan = useMemo(() => {
        if (!engine) return null;
        const def = engine.getDefinition();
        const items = def.items || [];

        const planCtx: PlanContext = {
            items,
            formPresentation: def.formPresentation,
            componentDocument,
            theme: themeDocument,
            findItem: (key: string) => findItemByKey(items, key),
        };

        if (componentDocument?.pages || componentDocument?.tree) {
            return planComponentTree(componentDocument, planCtx);
        }
        // planDefinitionFallback returns an array — wrap in a root Stack node
        const nodes = planDefinitionFallback(items, planCtx);
        return {
            id: 'root',
            component: 'Stack',
            category: 'layout' as const,
            props: {},
            cssClasses: ['formspec-container'],
            children: nodes,
        };
    }, [engine, componentDocument, themeDocument]);

    // Touched tracking — stable across re-renders
    const touchedFieldsRef = useRef(new Set<string>());
    const touchedVersionSignal = useMemo(() => signal(0), []);

    const touchField = useCallback((path: string) => {
        if (!touchedFieldsRef.current.has(path)) {
            touchedFieldsRef.current.add(path);
            touchedVersionSignal.value += 1;
        }
    }, [touchedVersionSignal]);

    const isTouched = useCallback((path: string) => {
        return touchedFieldsRef.current.has(path);
    }, []);

    useEffect(() => {
        // Only dispose if we created the engine internally
        if (!externalEngine && engine) {
            return () => engine.dispose();
        }
    }, [engine, externalEngine]);

    const value = useMemo<FormspecContextValue>(
        () => ({ engine, layoutPlan, components, touchField, touchedVersion: touchedVersionSignal, isTouched }),
        [engine, layoutPlan, components, touchField, touchedVersionSignal, isTouched],
    );

    return (
        <FormspecContext.Provider value={value}>
            {children}
        </FormspecContext.Provider>
    );
}

/** Access the FormspecContext. Throws if used outside FormspecProvider. */
export function useFormspecContext(): FormspecContextValue {
    const ctx = useContext(FormspecContext);
    if (!ctx) throw new Error('useFormspecContext must be used within a FormspecProvider');
    return ctx;
}

/** Recursive item lookup by dotted key path. */
function findItemByKey(items: any[], key: string): any | null {
    const parts = key.split('.');
    let current = items;
    for (const part of parts) {
        const found = current.find((i: any) => i.key === part);
        if (!found) return null;
        if (parts.indexOf(part) === parts.length - 1) return found;
        current = found.children || [];
    }
    return null;
}
