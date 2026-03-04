import { signal } from '@preact/signals-core';
import { FormEngine } from 'formspec-engine';
import { globalRegistry } from './registry';
import {
    ValidationTargetMetadata,
    ScreenerRoute,
    ScreenerRouteType,
    ScreenerStateSnapshot,
} from './types';
import {
    ThemeDocument,
    PresentationBlock,
    ItemDescriptor,
    planComponentTree,
    planDefinitionFallback,
    type PlanContext,
} from 'formspec-layout';
import defaultThemeJson from './default-theme.json';

// Extracted modules
import { renderScreener, type ScreenerHost } from './rendering/screener';
import { setupBreakpoints as setupBreakpointsFn, cleanupBreakpoints, createBreakpointState, type BreakpointState } from './rendering/breakpoints';
import { emitNode as emitNodeFn } from './rendering/emit-node';
import {
    resolveToken as resolveTokenFn,
    resolveItemPresentation as resolveItemPresentationFn,
    applyStyle as applyStyleFn,
    applyCssClass as applyCssClassFn,
    applyClassValue as applyClassValueFn,
    resolveWidgetClassSlots as resolveWidgetClassSlotsFn,
    applyAccessibility as applyAccessibilityFn,
    emitTokenProperties as emitTokenPropertiesFn,
    loadStylesheets as loadStylesheetsFn,
    cleanupStylesheets as cleanupStylesheetsFn,
    type StylingHost,
} from './styling';
import {
    goToWizardStep as goToWizardStepFn,
    focusField as focusFieldFn,
    type NavigationHost,
} from './navigation';
import {
    submit as submitFn,
    touchAllFields as touchAllFieldsFn,
    setSubmitPending as setSubmitPendingFn,
    isSubmitPending as isSubmitPendingFn,
    resolveValidationTarget as resolveValidationTargetFn,
} from './submit';

/**
 * `<formspec-render>` custom element -- the entry point for rendering a
 * Formspec form in the browser.
 *
 * Orchestrates the full rendering pipeline:
 * - Accepts a definition, optional component document, and optional theme document.
 * - Creates and manages a {@link FormEngine} instance for reactive form state.
 * - Builds the DOM by walking the component tree (or falling back to definition items).
 * - Applies the 5-level theme cascade, token resolution, responsive breakpoints,
 *   and accessibility attributes.
 * - Manages ref-counted stylesheet injection, signal-driven DOM updates, and
 *   cleanup of effects and event listeners on disconnect.
 * - Supports replay, diagnostics snapshots, and runtime context injection.
 *
 * @example
 * ```html
 * <formspec-render></formspec-render>
 * <script>
 *   const el = document.querySelector('formspec-render');
 *   el.definition = myDefinition;
 *   el.componentDocument = myComponentDoc;
 *   el.themeDocument = myTheme;
 * </script>
 * ```
 */
export class FormspecRender extends HTMLElement {
    // ── Internal state ────────────────────────────────────────────────
    /** @internal */ _definition: any;
    /** @internal */ _componentDocument: any;
    /** @internal */ _themeDocument: ThemeDocument | null = null;
    /** @internal */ engine: FormEngine | null = null;
    /** @internal */ cleanupFns: Array<() => void> = [];
    private _breakpoints: BreakpointState = createBreakpointState();
    private get activeBreakpoint(): string | null { return this._breakpoints.activeBreakpointSignal.value ?? null; }
    /** @internal */ stylesheetHrefs: string[] = [];
    private rootContainer: HTMLDivElement | null = null;
    private _renderPending = false;

    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        shadow.appendChild(document.createElement('slot'));
    }

    /** Fields the user has interacted with (blur). Validation errors are hidden until touched. */
    /** @internal */ touchedFields: Set<string> = new Set();
    /** Incremented when touched state changes so error-display effects can react. */
    /** @internal */ touchedVersion = signal(0);
    /** Whether the screener has been completed (route selected). */
    /** @internal */ _screenerCompleted = false;
    /** The route selected by the screener, if any. */
    /** @internal */ _screenerRoute: ScreenerRoute | null = null;
    /** Shared pending state for submit flows (e.g. async host submits). */
    private _submitPendingSignal = signal(false);
    /** Latest submit detail payload (`{ response, validationReport }`). */
    private _latestSubmitDetailSignal = signal<{
        response: any;
        validationReport: {
            valid: boolean;
            results: any[];
            counts: { error: number; warning: number; info: number };
            timestamp: string;
        };
    } | null>(null);

    // ── Styling delegators ────────────────────────────────────────────
    private get _stylingHost(): StylingHost { return this as any; }

    /** @internal */ resolveToken = (val: any): any => resolveTokenFn(this._stylingHost, val);
    /** @internal */ resolveItemPresentation = (itemDesc: ItemDescriptor): PresentationBlock => resolveItemPresentationFn(this._stylingHost, itemDesc);
    /** @internal */ applyStyle = (el: HTMLElement, style: any): void => applyStyleFn(this._stylingHost, el, style);
    /** @internal */ applyCssClass = (el: HTMLElement, comp: any): void => applyCssClassFn(this._stylingHost, el, comp);
    /** @internal */ applyClassValue = (el: HTMLElement, classValue: unknown): void => applyClassValueFn(this._stylingHost, el, classValue);
    /** @internal */ resolveWidgetClassSlots = (presentation: PresentationBlock) => resolveWidgetClassSlotsFn(this._stylingHost, presentation);
    /** @internal */ applyAccessibility = (el: HTMLElement, comp: any): void => applyAccessibilityFn(this._stylingHost, el, comp);

    // ── Navigation delegators ─────────────────────────────────────────
    private get _navHost(): NavigationHost { return this as any; }

    // ── Screener helpers ──────────────────────────────────────────────
    private isInternalScreenerTarget(target: string): boolean {
        const defUrl = this._definition?.url;
        if (!defUrl || !target) return false;
        return target === defUrl || target.startsWith(defUrl + '/') || target.split('|')[0] === defUrl;
    }

    /** @internal */ classifyScreenerRoute(route: ScreenerRoute | null | undefined): ScreenerRouteType {
        if (!route?.target) return 'none';
        return this.isInternalScreenerTarget(route.target) ? 'internal' : 'external';
    }

    /** Returns the current screener completion + routing state. */
    getScreenerState(): ScreenerStateSnapshot {
        const hasScreener = !!this._definition?.screener?.items;
        return {
            hasScreener,
            completed: hasScreener ? this._screenerCompleted : true,
            routeType: this.classifyScreenerRoute(this._screenerRoute),
            route: this._screenerRoute,
        };
    }

    /** @internal */ emitScreenerStateChange(reason: string, answers?: Record<string, any>): void {
        this.dispatchEvent(new CustomEvent('formspec-screener-state-change', {
            detail: {
                ...this.getScreenerState(),
                reason,
                ...(answers ? { answers } : {}),
            },
            bubbles: true,
            composed: true,
        }));
    }

    private scheduleRender() {
        if (this._renderPending) return;
        this._renderPending = true;
        Promise.resolve().then(() => {
            this._renderPending = false;
            this.render();
        });
    }

    /**
     * Set the form definition. Creates a new {@link FormEngine} instance and
     * schedules a re-render. Throws if engine initialization fails.
     */
    set definition(val: any) {
        this._definition = val;
        this._screenerCompleted = false;
        this._screenerRoute = null;
        try {
            this.engine = new FormEngine(val);
        } catch (e) {
            console.error("Engine initialization failed", e);
            throw e;
        }
        this.emitScreenerStateChange('definition-set');
        this.scheduleRender();
    }

    /** The currently loaded form definition object. */
    get definition() {
        return this._definition;
    }

    /**
     * Set the component document (component tree, custom components, tokens,
     * breakpoints). Schedules a re-render.
     */
    set componentDocument(val: any) {
        this._componentDocument = val;
        this.scheduleRender();
    }

    /** The currently loaded component document. */
    get componentDocument() {
        return this._componentDocument;
    }

    /**
     * Set the theme document. Loads/unloads referenced stylesheets via
     * ref-counting and schedules a re-render.
     */
    set themeDocument(val: ThemeDocument | null) {
        this._themeDocument = val;
        loadStylesheetsFn(this._stylingHost);
        this.scheduleRender();
    }

    /** The currently loaded theme document, or `null` if none. */
    get themeDocument(): ThemeDocument | null {
        return this._themeDocument;
    }

    /**
     * Return the underlying {@link FormEngine} instance, or `null` if no
     * definition has been set yet. Useful for direct engine access in tests
     * or advanced integrations.
     */
    getEngine() {
        return this.engine;
    }

    /**
     * Capture a diagnostics snapshot from the engine, including current signal
     * values, validation state, and repeat counts.
     */
    getDiagnosticsSnapshot(options?: { mode?: 'continuous' | 'submit' }) {
        return this.engine?.getDiagnosticsSnapshot?.(options) || null;
    }

    /**
     * Apply a single replay event (e.g. `setValue`, `addRepeat`) to the engine.
     */
    applyReplayEvent(event: any) {
        if (!this.engine?.applyReplayEvent) {
            return { ok: false, event, error: 'Engine unavailable' };
        }
        return this.engine.applyReplayEvent(event);
    }

    /**
     * Replay a sequence of events against the engine in order.
     */
    replay(events: any[], options?: { stopOnError?: boolean }) {
        if (!this.engine?.replay) {
            return { applied: 0, results: [], errors: [{ index: 0, event: null, error: 'Engine unavailable' }] };
        }
        return this.engine.replay(events, options);
    }

    /**
     * Inject a runtime context (e.g. `now`, user metadata) into the engine.
     */
    setRuntimeContext(context: any) {
        this.engine?.setRuntimeContext?.(context);
    }

    /**
     * Mark all registered fields as touched so validation errors become visible.
     */
    touchAllFields() {
        touchAllFieldsFn(this as any);
    }

    /**
     * Build a submit payload and validation report from the current form state.
     * Optionally dispatches `formspec-submit` with `{ response, validationReport }`.
     */
    submit(options?: { mode?: 'continuous' | 'submit'; emitEvent?: boolean }) {
        return submitFn(this as any, options);
    }

    /**
     * Resolve a validation result/path to a navigation target with metadata.
     */
    resolveValidationTarget(resultOrPath: any): ValidationTargetMetadata {
        return resolveValidationTargetFn(this as any, resultOrPath);
    }

    /**
     * Toggle shared submit pending state and emit `formspec-submit-pending-change`
     * whenever the value changes.
     */
    setSubmitPending(pending: boolean): void {
        setSubmitPendingFn(this as any, pending);
    }

    /** Returns the current shared submit pending state. */
    isSubmitPending(): boolean {
        return isSubmitPendingFn(this as any);
    }

    /**
     * Programmatically navigate to a wizard step in the first rendered wizard.
     */
    goToWizardStep(index: number): boolean {
        return goToWizardStepFn(this._navHost, index);
    }

    /**
     * Reveal and focus a field by bind path.
     */
    focusField(path: string): boolean {
        return focusFieldFn(this._navHost, path);
    }

    /** @internal */ getEffectiveTheme(): ThemeDocument {
        return this._themeDocument || defaultThemeJson as ThemeDocument;
    }

    private cleanup() {
        for (const fn of this.cleanupFns) {
            fn();
        }
        this.cleanupFns = [];
        this.touchedFields.clear();
        this.touchedVersion.value += 1;
    }

    /**
     * Perform a full synchronous render of the form.
     */
    render() {
        this.cleanup();
        if (!this.engine || !this._definition) return;
        setupBreakpointsFn(this as any, this._breakpoints);

        if (this._componentDocument) {
            if (this._componentDocument.$formspecComponent !== '1.0') {
                console.warn(`Unsupported Component Document version: ${this._componentDocument.$formspecComponent}`);
            }

            if (this._componentDocument.targetDefinition) {
                const target = this._componentDocument.targetDefinition;
                if (target.url !== this._definition.url) {
                    console.warn(`Component Document target URL (${target.url}) does not match Definition URL (${this._definition.url})`);
                }
            }
        }

        if (!this.rootContainer) {
            this.rootContainer = document.createElement('div');
            this.rootContainer.className = 'formspec-container';
            this.appendChild(this.rootContainer);
        }

        const container = this.rootContainer;
        container.className = 'formspec-container';
        container.replaceChildren();

        emitTokenPropertiesFn(this._stylingHost, container);

        if (this._definition.screener?.items && !this._screenerCompleted) {
            renderScreener(this as any as ScreenerHost, container);
            return;
        }

        const planCtx: PlanContext = {
            items: this._definition.items,
            formPresentation: this._definition.formPresentation,
            componentDocument: this._componentDocument,
            theme: this._themeDocument || this.getEffectiveTheme(),
            activeBreakpoint: this.activeBreakpoint,
            findItem: (key: string) => this.findItemByKey(key),
            isComponentAvailable: (type: string) => !!globalRegistry.get(type),
        };

        if (this._componentDocument && this._componentDocument.tree) {
            const plan = planComponentTree(this._componentDocument.tree, planCtx);
            emitNodeFn(this as any, plan, container, '');
        } else {
            const plans = planDefinitionFallback(this._definition.items, planCtx);
            for (const plan of plans) {
                emitNodeFn(this as any, plan, container, '');
            }
        }
    }

    /** Returns the screener route selected during the screening phase, or null. */
    getScreenerRoute() {
        return this._screenerRoute;
    }

    /** Programmatically skip the screener and proceed to the main form. */
    skipScreener() {
        this._screenerCompleted = true;
        this._screenerRoute = null;
        this.emitScreenerStateChange('skip');
        this.scheduleRender();
    }

    /** Return to the screener from the main form. */
    restartScreener() {
        this._screenerCompleted = false;
        this._screenerRoute = null;
        this.emitScreenerStateChange('restart');
        this.scheduleRender();
    }

    /** @internal */ findItemByKey = (key: string, items: any[] = this._definition.items): any | null => {
        const dot = key.indexOf('.');
        if (dot !== -1) {
            const head = key.slice(0, dot);
            const rest = key.slice(dot + 1);
            for (const item of items) {
                if (item.key === head && item.children) {
                    return this.findItemByKey(rest, item.children);
                }
            }
            return null;
        }
        for (const item of items) {
            if (item.key === key) return item;
            if (item.children) {
                const found = this.findItemByKey(key, item.children);
                if (found) return found;
            }
        }
        return null;
    }

    /**
     * Custom element lifecycle callback. Disposes all signal effects,
     * decrements stylesheet ref-counts, tears down breakpoint listeners,
     * and removes the root container.
     */
    disconnectedCallback() {
        this.cleanup();
        cleanupStylesheetsFn(this._stylingHost);
        cleanupBreakpoints(this._breakpoints);
        if (this.rootContainer) {
            this.rootContainer.remove();
            this.rootContainer = null;
        }
    }
}
