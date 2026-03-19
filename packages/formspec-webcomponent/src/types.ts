/** @filedesc Shared type definitions: RenderContext, ComponentPlugin, and screener types. */
import { FormEngine } from 'formspec-engine';
import type { Signal } from '@preact/signals-core';
import { ThemeDocument, PresentationBlock, ItemDescriptor } from 'formspec-layout';
import type { BehaviorContext } from './behaviors/types';
import type { AdapterContext } from './adapters/types';

/** Metadata describing where a validation result points and whether it is jumpable. */
export interface ValidationTargetMetadata {
    path: string;
    label: string;
    formLevel: boolean;
    jumpable: boolean;
    fieldElement?: HTMLElement | null;
}

/** Selected screener route target (if any). */
export interface ScreenerRoute {
    target: string;
    label?: string;
    extensions?: Record<string, any>;
}

/** Classifies the screener route relative to the current definition URL. */
export type ScreenerRouteType = 'none' | 'internal' | 'external';

/** Snapshot of current screener completion and routing state. */
export interface ScreenerStateSnapshot {
    hasScreener: boolean;
    completed: boolean;
    routeType: ScreenerRouteType;
    route: ScreenerRoute | null;
}

/**
 * Context object passed to every {@link ComponentPlugin} render function.
 *
 * Provides access to the form engine, theme/component documents, and a
 * toolkit of rendering helpers so plugins can build DOM, resolve tokens,
 * apply theme styles, and recursively render child components without
 * depending on the `FormspecRender` element directly.
 */
export interface RenderContext {
    /** The active FormEngine instance managing reactive form state. */
    engine: FormEngine;

    /** The loaded component document (component tree, custom components, tokens, breakpoints). */
    componentDocument: any;

    /** The loaded theme document, or `null` when no theme is provided. */
    themeDocument: ThemeDocument | null;

    /** Dotted path prefix for the current render scope (e.g. `"group[0]"`). */
    prefix: string;

    /** Build submit payload + validation report and optionally dispatch `formspec-submit`. */
    submit: (options?: { mode?: 'continuous' | 'submit'; emitEvent?: boolean }) => {
        response: any;
        validationReport: {
            valid: boolean;
            results: any[];
            counts: { error: number; warning: number; info: number };
            timestamp: string;
        };
    } | null;

    /** Resolve a validation result/path to a target path + label + jump metadata. */
    resolveValidationTarget: (resultOrPath: any) => ValidationTargetMetadata;

    /** Reveal and focus a field by path; returns false when no target field is found. */
    focusField: (path: string) => boolean;

    /** Reactive shared submit pending signal used by submit-oriented plugins. */
    submitPendingSignal: Signal<boolean>;

    /** Latest renderer submit detail (`{ response, validationReport }`), or null before first submit. */
    latestSubmitDetailSignal: Signal<{
        response: any;
        validationReport: {
            valid: boolean;
            results: any[];
            counts: { error: number; warning: number; info: number };
            timestamp: string;
        };
    } | null>;

    /** Set shared submit pending state and emit change event when it toggles. */
    setSubmitPending: (pending: boolean) => void;

    /** Read shared submit pending state. */
    isSubmitPending: () => boolean;

    /** Recursively render a child component descriptor into a parent element. */
    renderComponent: (comp: any, parent: HTMLElement, prefix?: string) => void;

    /** Resolve a `$token.xxx` reference against component and theme token maps. Non-token values pass through unchanged. */
    resolveToken: (val: any) => any;

    /** Apply an inline style object to an element, resolving token references in values. */
    applyStyle: (el: HTMLElement, style: any) => void;

    /** Apply `cssClass` entries from a component descriptor to an element's classList. */
    applyCssClass: (el: HTMLElement, comp: any) => void;

    /** Apply accessibility attributes (role, aria-description, aria-live) from a component descriptor. */
    applyAccessibility: (el: HTMLElement, comp: any) => void;

    /** Resolve the effective PresentationBlock for a definition item via the 5-level theme cascade. */
    resolveItemPresentation: (item: ItemDescriptor) => PresentationBlock;

    /** Disposal callbacks for signal effects and event listeners created during this render cycle. */
    cleanupFns: Array<() => void>;

    /**
     * Set of field paths that have been interacted with (blurred/changed).
     * Errors are only displayed for touched fields. Plugins can add paths here
     * to force inline error display (e.g. wizard soft-validation on Next click).
     */
    touchedFields: Set<string>;

    /**
     * Monotonic counter that increments whenever touched state changes.
     * Error-display effects subscribe to this so they re-run when fields are
     * touched programmatically (e.g. wizard Next click).
     */
    touchedVersion: Signal<number>;

    /** Look up a definition item by key (supports dotted paths like `"group.field"`). Returns `null` if not found. */
    findItemByKey: (key: string, items?: any[]) => any | null;

    /**
     * Build and return a fully-wired field input element (label, input control,
     * hint, error display, signal bindings, ARIA attributes) for a bound field.
     */
    renderInputComponent: (comp: any, item: any, fullName: string) => HTMLElement;

    /** The currently active responsive breakpoint name, or `null` when no breakpoint matches. */
    activeBreakpoint: string | null;

    /** Behavior context for the headless behavior→adapter pipeline. */
    behaviorContext: BehaviorContext;

    /** Adapter context for the headless behavior→adapter pipeline. */
    adapterContext: AdapterContext;
}

/**
 * Contract for a component plugin registered with the {@link ComponentRegistry}.
 *
 * Each plugin declares a `type` string (e.g. `"TextInput"`, `"Wizard"`) that
 * maps to a component document's `component` field, and a `render` function
 * that builds the DOM for that component type.
 */
export interface ComponentPlugin {
    /** Component type identifier matched against `comp.component` at render time. */
    type: string;

    /**
     * Build DOM for this component and append it to `parent`.
     *
     * @param comp   - The component descriptor object from the component tree.
     * @param parent - The parent DOM element to append rendered content into.
     * @param ctx    - Rendering context providing engine access, helpers, and cleanup tracking.
     */
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => void;
}
