import { effect, signal } from '@preact/signals-core';
import { FormEngine } from 'formspec-engine';
import { globalRegistry } from './registry';
import { registerDefaultComponents } from './components';
import { RenderContext, ComponentPlugin } from './types';
import { ThemeDocument, PresentationBlock, ItemDescriptor, Tier1Hints, resolvePresentation, resolveWidget } from './theme-resolver';
import defaultThemeJson from './default-theme.json';
import './formspec-base.css';

export { resolvePresentation, resolveWidget } from './theme-resolver';
export type { ThemeDocument, PresentationBlock, ItemDescriptor, AccessibilityBlock, ThemeSelector, SelectorMatch, Tier1Hints, FormspecDataType, Page, Region, LayoutHints, StyleHints } from './theme-resolver';
export { defaultThemeJson as defaultTheme };

// ── Standalone utility functions (extracted for testability) ────────

/** Replace `{param}` placeholders in a tree node with values from `params`. */
export function interpolateParams(node: any, params: any): void {
    for (const key of Object.keys(node)) {
        if (typeof node[key] === 'string') {
            node[key] = node[key].replace(/\{(\w+)\}/g, (_: string, param: string) => {
                return params[param] !== undefined ? params[param] : `{${param}}`;
            });
        } else if (Array.isArray(node[key])) {
            for (const child of node[key]) {
                if (typeof child === 'object' && child !== null) {
                    interpolateParams(child, params);
                }
            }
        } else if (typeof node[key] === 'object' && node[key] !== null) {
            interpolateParams(node[key], params);
        }
    }
}

/** Merge responsive breakpoint overrides onto a component descriptor. */
export function resolveResponsiveProps(comp: any, activeBreakpoint: string | null): any {
    if (!comp.responsive || !activeBreakpoint) return comp;
    const overrides = comp.responsive[activeBreakpoint];
    if (!overrides) return comp;
    return { ...comp, ...overrides };
}

/**
 * Resolve a `$token.xxx` reference against component and theme token maps.
 * Non-token values pass through unchanged.
 */
export function resolveToken(
    val: any,
    componentTokens: Record<string, string | number> | undefined,
    themeTokens: Record<string, string | number> | undefined,
): any {
    if (typeof val === 'string' && val.startsWith('$token.')) {
        const tokenKey = val.substring(7);
        if (componentTokens && componentTokens[tokenKey] !== undefined) {
            return componentTokens[tokenKey];
        }
        if (themeTokens && themeTokens[tokenKey] !== undefined) {
            return themeTokens[tokenKey];
        }
        console.warn(`Unresolved token reference: ${val}`);
    }
    return val;
}

registerDefaultComponents();

/** Counter for generating unique IDs for accessibility description elements. */
let a11yDescIdCounter = 0;

export class FormspecRender extends HTMLElement {
    private _definition: any;
    private _componentDocument: any;
    private _themeDocument: ThemeDocument | null = null;
    private engine: FormEngine | null = null;
    private cleanupFns: Array<() => void> = [];
    private _activeBreakpointSignal = signal<string | null>(null);
    private get activeBreakpoint(): string | null { return this._activeBreakpointSignal.value; }
    private set activeBreakpoint(val: string | null) { this._activeBreakpointSignal.value = val; }
    private breakpointCleanups: Array<() => void> = [];
    private customComponentStack: Set<string> = new Set();
    private stylesheetHrefs: string[] = [];
    private static stylesheetRefCounts: Map<string, number> = new Map();
    private rootContainer: HTMLDivElement | null = null;

    set definition(val: any) {
        this._definition = val;
        try {
            this.engine = new FormEngine(val);
        } catch (e) {
            console.error("Engine initialization failed", e);
            throw e;
        }
        this.render();
    }

    get definition() {
        return this._definition;
    }

    set componentDocument(val: any) {
        this._componentDocument = val;
        this.render();
    }

    get componentDocument() {
        return this._componentDocument;
    }

    set themeDocument(val: ThemeDocument | null) {
        this._themeDocument = val;
        this.loadStylesheets();
        this.render();
    }

    get themeDocument(): ThemeDocument | null {
        return this._themeDocument;
    }

    getEngine() {
        return this.engine;
    }

    getDiagnosticsSnapshot(options?: { mode?: 'continuous' | 'submit' }) {
        return this.engine?.getDiagnosticsSnapshot?.(options) || null;
    }

    applyReplayEvent(event: any) {
        if (!this.engine?.applyReplayEvent) {
            return { ok: false, event, error: 'Engine unavailable' };
        }
        return this.engine.applyReplayEvent(event);
    }

    replay(events: any[], options?: { stopOnError?: boolean }) {
        if (!this.engine?.replay) {
            return { applied: 0, results: [], errors: [{ index: 0, event: null, error: 'Engine unavailable' }] };
        }
        return this.engine.replay(events, options);
    }

    setRuntimeContext(context: any) {
        this.engine?.setRuntimeContext?.(context);
    }

    private getEffectiveTheme(): ThemeDocument {
        return this._themeDocument || defaultThemeJson as ThemeDocument;
    }

    private cleanup() {
        for (const fn of this.cleanupFns) {
            fn();
        }
        this.cleanupFns = [];
    }

    private cleanupStylesheets() {
        for (const hrefKey of this.stylesheetHrefs) {
            const count = FormspecRender.stylesheetRefCounts.get(hrefKey) ?? 0;
            if (count <= 1) {
                FormspecRender.stylesheetRefCounts.delete(hrefKey);
                const link = FormspecRender.findThemeStylesheet(hrefKey);
                if (link) link.remove();
            } else {
                FormspecRender.stylesheetRefCounts.set(hrefKey, count - 1);
            }
        }
        this.stylesheetHrefs = [];
    }

    private static canonicalizeStylesheetHref(href: string): string {
        try {
            return new URL(href, document.baseURI).href;
        } catch {
            return href;
        }
    }

    private static findThemeStylesheet(hrefKey: string): HTMLLinkElement | null {
        const links = document.head.querySelectorAll('link[data-formspec-theme-href]');
        for (const link of links) {
            const htmlLink = link as HTMLLinkElement;
            if (htmlLink.dataset.formspecThemeHref === hrefKey) return htmlLink;
        }
        return null;
    }

    private loadStylesheets() {
        this.cleanupStylesheets();
        if (!this._themeDocument?.stylesheets) return;
        const uniqueHrefs = new Set<string>();
        for (const rawHref of this._themeDocument.stylesheets) {
            if (!rawHref || typeof rawHref !== 'string') continue;
            const hrefKey = FormspecRender.canonicalizeStylesheetHref(rawHref);
            if (uniqueHrefs.has(hrefKey)) continue;
            uniqueHrefs.add(hrefKey);

            const existingCount = FormspecRender.stylesheetRefCounts.get(hrefKey) ?? 0;
            if (existingCount === 0) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = rawHref;
                link.dataset.formspecTheme = 'true';
                link.dataset.formspecThemeHref = hrefKey;
                document.head.appendChild(link);
            }
            FormspecRender.stylesheetRefCounts.set(hrefKey, existingCount + 1);
            this.stylesheetHrefs.push(hrefKey);
        }
    }

    private emitTokenProperties(container: HTMLElement) {
        const effectiveTheme = this.getEffectiveTheme();
        const tokens = {
            ...(effectiveTheme.tokens || {}),
            ...(this._componentDocument?.tokens || {}),
        };
        for (const [key, value] of Object.entries(tokens)) {
            container.style.setProperty(
                `--formspec-${key.replace(/\./g, '-')}`,
                String(value)
            );
        }
    }

    render() {
        this.cleanup();
        if (!this.engine || !this._definition) return;
        this.setupBreakpoints();

        // Verify Component Document §2.1 & §2.2
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

        // §10.5 Emit CSS custom properties from theme/component tokens
        this.emitTokenProperties(container);

        if (this._componentDocument && this._componentDocument.tree) {
            this.renderComponent(this._componentDocument.tree, container);
        } else {
            for (const item of this._definition.items) {
                this.renderItem(item, container);
            }
        }

        const submitBtn = document.createElement('button');
        submitBtn.type = 'button';
        submitBtn.className = 'formspec-submit';
        submitBtn.textContent = 'Submit';
        submitBtn.addEventListener('click', () => {
            const response = this.engine!.getResponse();
            this.dispatchEvent(new CustomEvent('formspec-submit', {
                detail: response,
                bubbles: true
            }));
        });
        container.appendChild(submitBtn);

    }

    private findItemByKey = (key: string, items: any[] = this._definition.items): any | null => {
        // Support dotted paths like "equipmentGroup.equipmentId"
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

    private resolveToken = (val: any): any => {
        return resolveToken(
            val,
            this._componentDocument?.tokens,
            this.getEffectiveTheme().tokens,
        );
    }

    private resolveItemPresentation = (itemDesc: ItemDescriptor): PresentationBlock => {
        const item = this.findItemByKey(itemDesc.key);
        const tier1: Tier1Hints = {
            formPresentation: this._definition?.formPresentation,
            itemPresentation: item?.presentation
        };
        const theme: ThemeDocument = this.getEffectiveTheme();
        return resolvePresentation(theme, itemDesc, tier1);
    }

    private applyStyle = (el: HTMLElement, style: any) => {
        if (!style) return;
        for (const [key, val] of Object.entries(style)) {
            const resolved = this.resolveToken(val);
            (el.style as any)[key] = resolved;
        }
    }

    private applyCssClass = (el: HTMLElement, comp: any) => {
        if (!comp.cssClass) return;
        const classes = Array.isArray(comp.cssClass) ? comp.cssClass : [comp.cssClass];
        for (const cls of classes) {
            const resolved = String(this.resolveToken(cls));
            // Split on whitespace in case a single string has multiple classes
            for (const c of resolved.split(/\s+/)) {
                if (c) el.classList.add(c);
            }
        }
    }

    private applyClassValue = (el: HTMLElement, classValue: unknown): void => {
        if (classValue === undefined || classValue === null) return;
        const values = Array.isArray(classValue) ? classValue : [classValue];
        for (const cls of values) {
            const resolved = String(this.resolveToken(cls));
            for (const c of resolved.split(/\s+/)) {
                if (c) el.classList.add(c);
            }
        }
    }

    private resolveWidgetClassSlots = (presentation: PresentationBlock): {
        root?: unknown;
        label?: unknown;
        control?: unknown;
        hint?: unknown;
        error?: unknown;
    } => {
        const widgetConfig = presentation.widgetConfig;
        if (!widgetConfig || typeof widgetConfig !== 'object') return {};

        const config = widgetConfig as Record<string, unknown>;
        const extensionSlots = (
            config['x-classes'] &&
            typeof config['x-classes'] === 'object' &&
            !Array.isArray(config['x-classes'])
        )
            ? config['x-classes'] as Record<string, unknown>
            : {};

        return {
            root: config.rootClass ?? extensionSlots.root,
            label: config.labelClass ?? extensionSlots.label,
            control: config.controlClass ?? config.inputClass ?? extensionSlots.control ?? extensionSlots.input,
            hint: config.hintClass ?? extensionSlots.hint,
            error: config.errorClass ?? extensionSlots.error,
        };
    }

    private applyAccessibility = (el: HTMLElement, comp: any) => {
        if (!comp.accessibility) return;
        const a11y = comp.accessibility;
        if (a11y.role) el.setAttribute('role', a11y.role);
        const description = a11y.description ?? a11y.ariaDescription;
        if (description) {
            // Schema-level intent is aria-description; keep aria-describedby fallback
            // for user agents with limited support.
            el.setAttribute('aria-description', description);
            const descId = `formspec-a11y-desc-${++a11yDescIdCounter}`;
            const descEl = document.createElement('span');
            descEl.id = descId;
            descEl.className = 'formspec-sr-only';
            descEl.textContent = description;
            el.appendChild(descEl);
            const existing = el.getAttribute('aria-describedby');
            el.setAttribute('aria-describedby', existing ? `${existing} ${descId}` : descId);
        }
        if (a11y.liveRegion) el.setAttribute('aria-live', a11y.liveRegion);
    }

    private setupBreakpoints() {
        // Clean up old listeners
        for (const fn of this.breakpointCleanups) fn();
        this.breakpointCleanups = [];
        this.activeBreakpoint = null;

        if (!this._componentDocument?.breakpoints) return;
        const breakpoints: Record<string, number | string> = this._componentDocument.breakpoints;

        // Convert to media query strings and sort by min-width ascending (mobile-first)
        const entries = Object.entries(breakpoints)
            .map(([name, val]) => {
                // Schema says integer pixels; also accept pre-built media query strings
                const query = typeof val === 'number' ? `(min-width: ${val}px)` : String(val);
                const width = typeof val === 'number' ? val : (parseInt(String(val).replace(/[^0-9]/g, '')) || 0);
                return { name, query, width };
            })
            .sort((a, b) => a.width - b.width);

        for (const { name, query } of entries) {
            const mql = window.matchMedia(query);
            const handler = () => {
                // Re-evaluate: pick the largest matching breakpoint (mobile-first)
                let active: string | null = null;
                for (const entry of entries) {
                    if (window.matchMedia(entry.query).matches) active = entry.name;
                }
                if (active !== this.activeBreakpoint) {
                    this.activeBreakpoint = active;
                    // Signal update triggers reactive re-renders in responsive components
                }
            };
            mql.addEventListener('change', handler);
            this.breakpointCleanups.push(() => mql.removeEventListener('change', handler));
            if (mql.matches) this.activeBreakpoint = name;
        }
    }

    private resolveResponsiveProps(comp: any): any {
        return resolveResponsiveProps(comp, this.activeBreakpoint);
    }

    private renderComponent = (comp: any, parent: HTMLElement, prefix = '') => {
        if (comp.responsive) {
            this.renderResponsiveComponent(comp, parent, prefix);
            return;
        }
        this.renderComponentInner(comp, parent, prefix);
    }

    private renderComponentInner(comp: any, parent: HTMLElement, prefix = '') {
        // Apply responsive overrides (mobile-first cascade)
        comp = this.resolveResponsiveProps(comp);

        // Handle 'when' condition (§8)
        if (comp.when) {
            const wrapper = document.createElement('div');
            wrapper.className = 'formspec-when';
            parent.appendChild(wrapper);
            const exprFn = this.engine!.compileExpression(comp.when, prefix);
            this.cleanupFns.push(effect(() => {
                const visible = !!exprFn();
                wrapper.classList.toggle('formspec-hidden', !visible);
            }));
            parent = wrapper;
        }

        const componentType = comp.component;

        // Handle Repeatable Group Binding (§4.4)
        if (comp.bind && comp.component !== 'DataTable') {
            const item = this.findItemByKey(comp.bind);
            if (item && item.type === 'group' && item.repeatable) {
                const fullName = prefix ? `${prefix}.${comp.bind}` : comp.bind;
                const container = document.createElement('div');
                container.className = 'formspec-repeat';
                container.dataset.bind = comp.bind;
                parent.appendChild(container);

                this.cleanupFns.push(effect(() => {
                    const count = this.engine!.repeats[fullName]?.value || 0;
                    while (container.children.length > count) {
                        container.removeChild(container.lastChild!);
                    }
                    while (container.children.length < count) {
                        const idx = container.children.length;
                        const instanceWrapper = document.createElement('div');
                        instanceWrapper.className = 'formspec-repeat-instance';
                        container.appendChild(instanceWrapper);

                        const instancePrefix = `${fullName}[${idx}]`;
                        this.renderActualComponent(comp, instanceWrapper, instancePrefix);
                    }
                }));

                const addBtn = document.createElement('button');
                addBtn.type = 'button';
                addBtn.className = 'formspec-repeat-add';
                addBtn.textContent = `Add ${item.label || comp.bind}`;
                addBtn.addEventListener('click', () => {
                    this.engine!.addRepeatInstance(fullName);
                });
                parent.appendChild(addBtn);
                return;
            }
        }

        this.renderActualComponent(comp, parent, prefix);
    }

    /**
     * Renders a component that has responsive overrides inside a display:contents wrapper.
     * Uses a Preact signal effect so only this component's subtree is re-rendered when the
     * active breakpoint changes — the rest of the form DOM is untouched.
     */
    private renderResponsiveComponent(comp: any, parent: HTMLElement, prefix: string) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display: contents';
        parent.appendChild(wrapper);

        type ResponsiveVariant = {
            mount: HTMLElement;
            cleanups: Array<() => void>;
        };
        const variants = new Map<string, ResponsiveVariant>();
        const keyFor = (bp: string | null): string => bp ?? '__base__';

        const ensureVariant = (bp: string | null): string => {
            const key = keyFor(bp);
            if (variants.has(key)) return key;

            const mount = document.createElement('div');
            mount.style.cssText = 'display: contents';
            wrapper.appendChild(mount);

            const cleanups: Array<() => void> = [];
            const resolved = resolveResponsiveProps(comp, bp);
            // Strip `responsive` to prevent re-entry into this method
            const { responsive: _ignored, ...resolvedWithout } = resolved;
            this.withCleanupScope(cleanups, () => this.renderComponentInner(resolvedWithout, mount, prefix));
            variants.set(key, { mount, cleanups });
            return key;
        };

        const setVisibleVariant = (activeKey: string) => {
            for (const [key, variant] of variants.entries()) {
                variant.mount.style.display = key === activeKey ? 'contents' : 'none';
            }
        };

        const effectDispose = effect(() => {
            const bp = this._activeBreakpointSignal.value;
            const activeKey = ensureVariant(bp);
            setVisibleVariant(activeKey);
        });

        this.cleanupFns.push(() => {
            effectDispose();
            for (const variant of variants.values()) {
                for (const fn of variant.cleanups) fn();
            }
            variants.clear();
            wrapper.replaceChildren();
        });
    }

    /** Temporarily redirects cleanupFns to a scoped array, then restores it. */
    private withCleanupScope(scope: Array<() => void>, fn: () => void): void {
        const saved = this.cleanupFns;
        this.cleanupFns = scope;
        try { fn(); } finally { this.cleanupFns = saved; }
    }

    private renderActualComponent(comp: any, parent: HTMLElement, prefix = '') {
        const componentType = comp.component;
        const plugin = globalRegistry.get(componentType);

        const ctx: RenderContext = {
            engine: this.engine!,
            componentDocument: this._componentDocument,
            themeDocument: this._themeDocument,
            prefix,
            renderComponent: this.renderComponent,
            resolveToken: this.resolveToken,
            applyStyle: this.applyStyle,
            applyCssClass: this.applyCssClass,
            applyAccessibility: this.applyAccessibility,
            resolveItemPresentation: this.resolveItemPresentation,
            cleanupFns: this.cleanupFns,
            findItemByKey: this.findItemByKey,
            renderInputComponent: this.renderInputComponent,
            activeBreakpoint: this.activeBreakpoint
        };

        if (plugin) {
            plugin.render(comp, parent, ctx);
        } else if (this._componentDocument?.components?.[componentType]) {
            // Custom component expansion
            if (this.customComponentStack.has(componentType)) {
                console.warn(`Recursive custom component detected: ${componentType}`);
                return;
            }
            this.customComponentStack.add(componentType);
            try {
                const customDef = this._componentDocument.components[componentType];
                const template = JSON.parse(JSON.stringify(customDef.tree));
                // Interpolate {param} references
                this.interpolateParams(template, comp);
                this.renderComponent(template, parent, prefix);
            } finally {
                this.customComponentStack.delete(componentType);
            }
        } else {
            console.warn(`Unknown component type: ${componentType}`);
        }
    }

    private interpolateParams(node: any, params: any) {
        interpolateParams(node, params);
    }

    private renderInputComponent = (comp: any, item: any, fullName: string): HTMLElement => {
        const dataType = item.dataType;

        // Resolve theme cascade for this item
        const itemDesc: ItemDescriptor = { key: item.key, type: item.type || 'field', dataType };
        const themePresentation = this.resolveItemPresentation(itemDesc);
        const widgetClassSlots = this.resolveWidgetClassSlots(themePresentation);

        // In the component-document path, comp.component was explicitly chosen — don't override it.
        // Theme widget resolution only applies in the definition-fallback renderItem path.
        const componentType = comp.component;

        const optionSignal = this.engine!.getOptionsSignal?.(fullName);
        const optionStateSignal = this.engine!.getOptionsStateSignal?.(fullName);
        if (optionSignal || optionStateSignal) {
            let initialized = false;
            this.cleanupFns.push(effect(() => {
                optionSignal?.value;
                optionStateSignal?.value;
                if (!initialized) {
                    initialized = true;
                    return;
                }
                this.render();
            }));
        }
        const options = this.engine!.getOptions?.(fullName) || item.options || [];
        const remoteOptionsState = this.engine!.getOptionsState?.(fullName) || { loading: false, error: null };

        // §4.6 Bind/dataType Compatibility Matrix
        const matrix: Record<string, string[]> = {
            'string': ['TextInput', 'Select', 'RadioGroup'],
            'text': ['TextInput'],
            'decimal': ['NumberInput', 'Slider', 'Rating', 'TextInput'],
            'integer': ['NumberInput', 'Slider', 'Rating', 'TextInput'],
            'boolean': ['Toggle', 'Checkbox'],
            'date': ['DatePicker', 'TextInput'],
            'dateTime': ['DatePicker', 'TextInput'],
            'time': ['DatePicker', 'TextInput'],
            'uri': ['TextInput'],
            'choice': ['Select', 'RadioGroup', 'TextInput'],
            'multiChoice': ['CheckboxGroup'],
            'attachment': ['FileUpload', 'Signature'],
            'money': ['NumberInput', 'TextInput']
        };

        if (matrix[dataType] && !matrix[dataType].includes(componentType)) {
            console.warn(`Incompatible component ${componentType} for dataType ${dataType}.`);
        }

        const fieldWrapper = document.createElement('div');
        fieldWrapper.className = 'formspec-field';
        fieldWrapper.dataset.name = fullName;
        this.applyClassValue(fieldWrapper, widgetClassSlots.root);

        // Generate unique IDs for ARIA linkage
        const fieldId = comp.id || `field-${fullName.replace(/[\.\[\]]/g, '-')}`;
        const hintId = `${fieldId}-hint`;
        const errorId = `${fieldId}-error`;
        const describedBy: string[] = [];

        // Resolve effective label position: comp override > theme cascade > 'top'
        const effectiveLabelPosition = comp.labelPosition || themePresentation.labelPosition || 'top';

        const label = document.createElement('label');
        label.className = 'formspec-label';
        label.textContent = comp.labelOverride || item.label || item.key;
        label.htmlFor = fieldId;
        this.applyClassValue(label, widgetClassSlots.label);

        if (effectiveLabelPosition === 'hidden') {
            label.classList.add('formspec-sr-only');
        } else if (effectiveLabelPosition === 'start') {
            fieldWrapper.classList.add('formspec-field--inline');
        }

        fieldWrapper.appendChild(label);

        // §4.2.3 Required indicator
        this.cleanupFns.push(effect(() => {
            const isRequired = this.engine!.requiredSignals[fullName]?.value;
            if (isRequired) {
                label.innerHTML = `${comp.labelOverride || item.label || item.key} <span class="formspec-required">*</span>`;
            } else {
                label.textContent = comp.labelOverride || item.label || item.key;
            }
        }));

        if (item.hint || comp.hintOverride) {
            const hint = document.createElement('div');
            hint.className = 'formspec-hint';
            hint.id = hintId;
            hint.textContent = comp.hintOverride || item.hint;
            this.applyClassValue(hint, widgetClassSlots.hint);
            fieldWrapper.appendChild(hint);
            describedBy.push(hintId);
        }

        let input: HTMLElement;

        if (componentType === 'RadioGroup') {
            const container = document.createElement('div');
            container.className = 'formspec-radio-group';
            container.setAttribute('role', 'radiogroup');
            if (options.length > 0) {
                for (const opt of options) {
                    const lbl = document.createElement('label');
                    const rb = document.createElement('input');
                    rb.type = 'radio';
                    rb.value = opt.value;
                    rb.name = fullName;
                    rb.addEventListener('change', () => {
                        this.engine!.setValue(fullName, rb.value);
                    });
                    lbl.appendChild(rb);
                    lbl.appendChild(document.createTextNode(` ${opt.label}`));
                    container.appendChild(lbl);
                }
            }
            input = container;
        } else if (dataType === 'multiChoice' || componentType === 'CheckboxGroup') {
            const container = document.createElement('div');
            container.className = 'formspec-checkbox-group';
            if (comp.columns && comp.columns > 1) {
                container.dataset.columns = String(comp.columns);
            }
            if (options.length > 0) {
                // CheckboxGroup selectAll prop
                if (comp.selectAll) {
                    const selectAllLbl = document.createElement('label');
                    selectAllLbl.className = 'formspec-select-all';
                    const selectAllCb = document.createElement('input');
                    selectAllCb.type = 'checkbox';
                    selectAllCb.addEventListener('change', () => {
                        const allCbs = container.querySelectorAll(`input[type="checkbox"][name="${fullName}"]`) as NodeListOf<HTMLInputElement>;
                        allCbs.forEach(cb => { cb.checked = selectAllCb.checked; });
                        const checked: string[] = [];
                        allCbs.forEach(cb => { if (cb.checked) checked.push(cb.value); });
                        this.engine!.setValue(fullName, checked);
                    });
                    selectAllLbl.appendChild(selectAllCb);
                    selectAllLbl.appendChild(document.createTextNode(' Select All'));
                    container.appendChild(selectAllLbl);
                }
                for (const opt of options) {
                    const lbl = document.createElement('label');
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.value = opt.value;
                    cb.name = fullName;
                    cb.addEventListener('change', () => {
                        const checked: string[] = [];
                        container.querySelectorAll(`input[type="checkbox"][name="${fullName}"]`).forEach((el: any) => {
                            if (el.checked) checked.push(el.value);
                        });
                        this.engine!.setValue(fullName, checked);
                    });
                    lbl.appendChild(cb);
                    lbl.appendChild(document.createTextNode(` ${opt.label}`));
                    container.appendChild(lbl);
                }
            }
            input = container;
        } else if (dataType === 'money') {
            const container = document.createElement('div');
            container.className = 'formspec-money';
            const amountInput = document.createElement('input');
            amountInput.type = 'number';
            amountInput.className = 'formspec-input';
            amountInput.placeholder = 'Amount';
            amountInput.name = `${fullName}__amount`;
            const currencyInput = document.createElement('input');
            currencyInput.type = 'text';
            currencyInput.className = 'formspec-input';
            currencyInput.placeholder = 'Currency';
            currencyInput.name = `${fullName}__currency`;
            const updateMoney = () => {
                const amount = amountInput.value === '' ? null : Number(amountInput.value);
                const currency = currencyInput.value || '';
                this.engine!.setValue(fullName, { amount, currency });
            };
            amountInput.addEventListener('input', updateMoney);
            currencyInput.addEventListener('input', updateMoney);
            // Sync signal value back to sub-inputs (handles default bind and external updates)
            this.cleanupFns.push(effect(() => {
                const sig = this.engine!.signals[fullName];
                if (!sig) return;
                const v = sig.value;
                if (document.activeElement !== amountInput && document.activeElement !== currencyInput) {
                    if (v !== null && v !== undefined && typeof v === 'object' && 'amount' in v) {
                        amountInput.value = v.amount !== null && v.amount !== undefined ? String(v.amount) : '';
                        currencyInput.value = (v as any).currency || '';
                    } else if (typeof v === 'number') {
                        amountInput.value = String(v);
                    }
                }
            }));
            container.appendChild(amountInput);
            container.appendChild(currencyInput);
            input = container;
        } else if (componentType === 'Select' || (dataType === 'choice' && componentType === 'TextInput')) {
             const select = document.createElement('select');
             select.className = 'formspec-input';
             select.name = fullName;
             if (comp.placeholder) {
                 const placeholderOpt = document.createElement('option');
                 placeholderOpt.value = '';
                 placeholderOpt.textContent = comp.placeholder;
                 placeholderOpt.disabled = true;
                 placeholderOpt.selected = true;
                 select.appendChild(placeholderOpt);
             }
             if (comp.clearable) {
                 const clearOpt = document.createElement('option');
                 clearOpt.value = '';
                 clearOpt.textContent = '\u2014 Clear \u2014';
                 select.appendChild(clearOpt);
             }
             if (options.length > 0) {
                 for (const opt of options) {
                     const option = document.createElement('option');
                     option.value = opt.value;
                     option.textContent = opt.label;
                     select.appendChild(option);
                 }
             }
             input = select;
        } else if (componentType === 'Toggle' || componentType === 'Checkbox' || dataType === 'boolean') {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'formspec-input';
            checkbox.name = fullName;
            if (comp.onLabel || comp.offLabel) {
                const toggleContainer = document.createElement('div');
                toggleContainer.className = 'formspec-toggle';
                const toggleLabel = document.createElement('span');
                toggleLabel.className = 'formspec-toggle-label';
                toggleLabel.textContent = comp.offLabel || '';
                toggleContainer.appendChild(checkbox);
                toggleContainer.appendChild(toggleLabel);
                this.cleanupFns.push(effect(() => {
                    const sig = this.engine!.signals[fullName];
                    toggleLabel.textContent = sig?.value ? (comp.onLabel || '') : (comp.offLabel || '');
                }));
                input = toggleContainer;
            } else {
                input = checkbox;
            }
        } else {
            const htmlInput = document.createElement('input');
            htmlInput.className = 'formspec-input';
            htmlInput.name = fullName;
            if (componentType === 'NumberInput' || ['integer', 'decimal', 'number', 'money'].includes(dataType)) {
                htmlInput.type = 'number';
                if (comp.step != null) htmlInput.step = String(comp.step);
                if (comp.min != null) htmlInput.min = String(comp.min);
                if (comp.max != null) htmlInput.max = String(comp.max);
            } else if (componentType === 'DatePicker' || ['date', 'dateTime', 'time'].includes(dataType)) {
                htmlInput.type = dataType === 'date' ? 'date' : (dataType === 'time' ? 'time' : 'datetime-local');
                if (comp.minDate) htmlInput.min = comp.minDate;
                if (comp.maxDate) htmlInput.max = comp.maxDate;
            } else {
                htmlInput.type = 'text';
            }

            if (componentType === 'TextInput') {
                if (comp.placeholder) htmlInput.placeholder = comp.placeholder;
                if (comp.inputMode) htmlInput.inputMode = comp.inputMode;
                if (comp.maxLines && comp.maxLines > 1) {
                    const textarea = document.createElement('textarea');
                    textarea.className = 'formspec-input';
                    textarea.name = fullName;
                    textarea.rows = comp.maxLines;
                    if (comp.placeholder) textarea.placeholder = comp.placeholder;
                    input = textarea;
                } else if (comp.prefix || comp.suffix) {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'formspec-input-wrapper';
                    if (comp.prefix) {
                        const prefixEl = document.createElement('span');
                        prefixEl.className = 'formspec-prefix';
                        prefixEl.textContent = comp.prefix;
                        wrapper.appendChild(prefixEl);
                    }
                    wrapper.appendChild(htmlInput);
                    if (comp.suffix) {
                        const suffixEl = document.createElement('span');
                        suffixEl.className = 'formspec-suffix';
                        suffixEl.textContent = comp.suffix;
                        wrapper.appendChild(suffixEl);
                    }
                    input = wrapper;
                } else {
                    input = htmlInput;
                }
            } else {
                input = htmlInput;
            }
        }

        fieldWrapper.appendChild(input);

        if (remoteOptionsState.loading || remoteOptionsState.error) {
            const status = document.createElement('div');
            status.className = 'formspec-hint formspec-remote-options-status';
            if (remoteOptionsState.loading) {
                status.textContent = 'Loading options...';
            } else if (remoteOptionsState.error) {
                status.textContent = options.length > 0
                    ? 'Remote options unavailable; using fallback options.'
                    : 'Failed to load options.';
            }
            fieldWrapper.appendChild(status);
        }

        // Set ID on the actual input element for label[for] and ARIA
        const actualInputEl = input.querySelector('input') || input.querySelector('select') || input.querySelector('textarea') || input;
        if (actualInputEl instanceof HTMLElement) {
            actualInputEl.id = fieldId;
            this.applyClassValue(actualInputEl, widgetClassSlots.control);
        }

        const errorDisplay = document.createElement('div');
        errorDisplay.className = 'formspec-error';
        errorDisplay.id = errorId;
        errorDisplay.setAttribute('role', 'alert');
        errorDisplay.setAttribute('aria-live', 'polite');
        this.applyClassValue(errorDisplay, widgetClassSlots.error);
        fieldWrapper.appendChild(errorDisplay);
        describedBy.push(errorId);

        // Apply ARIA attributes to the actual input
        if (actualInputEl instanceof HTMLElement) {
            actualInputEl.setAttribute('aria-describedby', describedBy.join(' '));
        }

        // Apply theme cascade presentation (lower priority)
        this.applyCssClass(fieldWrapper, themePresentation);
        this.applyStyle(fieldWrapper, themePresentation.style);
        this.applyAccessibility(fieldWrapper, themePresentation);

        // Apply component document overrides (higher priority)
        this.applyAccessibility(fieldWrapper, comp);
        this.applyCssClass(fieldWrapper, comp);

        // Bind events (skip for multiChoice, money, RadioGroup — they handle their own)
        const isCustomInput = dataType === 'multiChoice' || componentType === 'CheckboxGroup' || dataType === 'money' || componentType === 'RadioGroup';
        if (!isCustomInput) {
            const actualInput = (comp.onLabel || comp.offLabel) && input.querySelector('input') ? input.querySelector('input')! : input;
            const eventName = actualInput instanceof HTMLSelectElement ? 'change' : 'input';
            actualInput.addEventListener(eventName, (e) => {
                const target = e.target as any;
                let val: any;
                if (dataType === 'boolean') {
                    val = target.checked;
                } else if (['integer', 'decimal', 'number'].includes(dataType)) {
                    val = target.value === '' ? null : Number(target.value);
                } else {
                    val = target.value;
                }
                this.engine!.setValue(fullName, val);
            });

            const bindableInput = input.querySelector('input') || input.querySelector('textarea') || input;

            this.cleanupFns.push(effect(() => {
                const sig = this.engine!.signals[fullName];
                if (!sig) return;
                const val = sig.value;
                if (dataType === 'boolean') {
                    if (document.activeElement !== bindableInput) (bindableInput as HTMLInputElement).checked = !!val;
                } else {
                    if (document.activeElement !== bindableInput) (bindableInput as HTMLInputElement).value = val ?? '';
                }
            }));
        } else if (componentType === 'RadioGroup') {
            this.cleanupFns.push(effect(() => {
                const sig = this.engine!.signals[fullName];
                if (!sig) return;
                const val = sig.value;
                const radios = input.querySelectorAll('input[type="radio"]') as NodeListOf<HTMLInputElement>;
                radios.forEach(rb => { rb.checked = rb.value === String(val ?? ''); });
            }));
        }

        // Relevancy, Readonly, Error signals (§4.2) with ARIA attributes
        this.cleanupFns.push(effect(() => {
            const isRelevant = this.engine!.relevantSignals[fullName]?.value ?? true;
            fieldWrapper.classList.toggle('formspec-hidden', !isRelevant);
            if (actualInputEl instanceof HTMLElement) {
                actualInputEl.setAttribute('aria-hidden', String(!isRelevant));
            }
        }));

        this.cleanupFns.push(effect(() => {
            const isRequired = this.engine!.requiredSignals[fullName]?.value ?? false;
            if (actualInputEl instanceof HTMLElement) {
                actualInputEl.setAttribute('aria-required', String(isRequired));
            }
        }));

        this.cleanupFns.push(effect(() => {
            const isReadonly = this.engine!.readonlySignals[fullName]?.value ?? false;
            // Target the actual input element, not a wrapper container
            const readonlyTarget = input.querySelector('input') || input.querySelector('select') || input.querySelector('textarea') || input;
            if (readonlyTarget instanceof HTMLInputElement || readonlyTarget instanceof HTMLTextAreaElement) {
                readonlyTarget.readOnly = isReadonly;
            } else if (readonlyTarget instanceof HTMLSelectElement) {
                readonlyTarget.disabled = isReadonly;
            }
            if (actualInputEl instanceof HTMLElement) {
                actualInputEl.setAttribute('aria-readonly', String(isReadonly));
            }
        }));

        this.cleanupFns.push(effect(() => {
            const error = this.engine!.errorSignals[fullName]?.value;
            errorDisplay.textContent = error || '';
            if (actualInputEl instanceof HTMLElement) {
                actualInputEl.setAttribute('aria-invalid', String(!!error));
            }
        }));

        this.applyStyle(fieldWrapper, comp.style);
        return fieldWrapper;
    }

    private renderItem(item: any, parent: HTMLElement, prefix = '') {
        const key = item.key;
        const fullName = prefix ? `${prefix}.${key}` : key;

        // Resolve theme cascade for this item in fallback rendering path
        const itemDesc: ItemDescriptor = { key, type: item.type, dataType: item.dataType };
        const themePresentation = this.resolveItemPresentation(itemDesc);

        if (item.type === 'group' && item.repeatable) {
            const fullNameForRepeat = prefix ? `${prefix}.${key}` : key;
            const container = document.createElement('div');
            container.className = 'formspec-repeat';
            container.dataset.bind = key;
            parent.appendChild(container);

            this.cleanupFns.push(effect(() => {
                const count = this.engine!.repeats[fullNameForRepeat]?.value || 0;
                while (container.children.length > count) {
                    container.removeChild(container.lastChild!);
                }
                while (container.children.length < count) {
                    const idx = container.children.length;
                    const instanceWrapper = document.createElement('div');
                    instanceWrapper.className = 'formspec-repeat-instance';
                    container.appendChild(instanceWrapper);
                    const instancePrefix = `${fullNameForRepeat}[${idx}]`;
                    if (item.children) {
                        for (const child of item.children) {
                            this.renderItem(child, instanceWrapper, instancePrefix);
                        }
                    }
                }
            }));

            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'formspec-repeat-add';
            addBtn.textContent = `Add ${item.label || key}`;
            addBtn.addEventListener('click', () => {
                this.engine!.addRepeatInstance(fullNameForRepeat);
            });
            parent.appendChild(addBtn);
        } else if (item.type === 'group') {
            const groupWrapper = document.createElement('div');
            groupWrapper.className = 'formspec-group';
            this.applyCssClass(groupWrapper, themePresentation);
            this.applyStyle(groupWrapper, themePresentation.style);
            this.applyAccessibility(groupWrapper, themePresentation);
            const title = document.createElement('h3');
            title.textContent = item.label || key;
            groupWrapper.appendChild(title);
            if (item.children) {
                for (const child of item.children) {
                    this.renderItem(child, groupWrapper, fullName);
                }
            }
            parent.appendChild(groupWrapper);
        } else if (item.type === 'field') {
            // Widget selection: theme widget > Tier 1 widgetHint > default from dataType
            const themeWidget = resolveWidget(themePresentation, (t) => !!globalRegistry.get(t));
            const widget = themeWidget || item.presentation?.widgetHint || this.getDefaultComponent(item);
            const comp = {
                component: widget,
                bind: key
            };
            const fieldWrapper = this.renderInputComponent(comp, item, fullName);
            parent.appendChild(fieldWrapper);
        } else if (item.type === 'display') {
            const el = document.createElement('p');
            el.className = 'formspec-display';
            this.applyCssClass(el, themePresentation);
            this.applyStyle(el, themePresentation.style);
            this.applyAccessibility(el, themePresentation);
            el.textContent = item.label || '';
            parent.appendChild(el);
            if (this.engine!.relevantSignals[fullName]) {
                this.cleanupFns.push(effect(() => {
                    const isRelevant = this.engine!.relevantSignals[fullName].value;
                    el.classList.toggle('formspec-hidden', !isRelevant);
                }));
            }
        }
    }

    private getDefaultComponent(item: any): string {
        const dataType = item.dataType;
        switch (dataType) {
            case 'string': return 'TextInput';
            case 'text': return 'TextInput';
            case 'integer':
            case 'decimal':
            case 'number': return 'NumberInput';
            case 'boolean': return 'Toggle';
            case 'date': return 'DatePicker';
            case 'dateTime': return 'DatePicker';
            case 'time': return 'DatePicker';
            case 'uri': return 'TextInput';
            case 'choice': return 'Select';
            case 'multiChoice': return 'CheckboxGroup';
            case 'attachment': return 'FileUpload';
            case 'money': return 'NumberInput';
            default: return 'TextInput';
        }
    }

    disconnectedCallback() {
        this.cleanup();
        this.cleanupStylesheets();
        for (const fn of this.breakpointCleanups) fn();
        this.breakpointCleanups = [];
        if (this.rootContainer) {
            this.rootContainer.remove();
            this.rootContainer = null;
        }
    }
}
