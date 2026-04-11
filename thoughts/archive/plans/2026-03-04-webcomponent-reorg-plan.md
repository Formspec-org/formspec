# Webcomponent Package Reorganization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganize `packages/formspec-webcomponent/` from a flat file structure with a 737-line god class into domain-grouped directories with a thin orchestrator element.

**Architecture:** Extract rendering, submit, styling, and navigation into separate directories with host-interface patterns. FormspecRender becomes a ~200-line thin shell that delegates to extracted modules. Delete dead `theme-resolver.ts`. Reorganize tests to mirror source structure.

**Tech Stack:** TypeScript, Preact Signals, Vitest (happy-dom), formspec-engine, formspec-layout

**Reference:** See `thoughts/archive/plans/2026-03-04-webcomponent-reorg-design.md` for full design.

**Baseline check:** Run `cd packages/formspec-webcomponent && npx vitest run` before starting. All ~148 tests must pass. Run again after every task.

---

## Task 1: Delete dead theme-resolver.ts and update imports

The `src/theme-resolver.ts` file (308 lines) is dead code — its types/functions were moved to `formspec-layout`. Only 3 test files still import from it.

**Files:**
- Delete: `packages/formspec-webcomponent/src/theme-resolver.ts`
- Modify: `packages/formspec-webcomponent/tests/theme-resolver.test.ts` — update imports to `formspec-layout`
- Modify: `packages/formspec-webcomponent/tests/helpers/engine-fixtures.ts` — update type imports to `formspec-layout`

**Step 1: Update test imports**

In `tests/theme-resolver.test.ts`, change:
```typescript
import { resolvePresentation, resolveWidget } from '../src/theme-resolver';
import type { ThemeDocument, PresentationBlock, ItemDescriptor, Tier1Hints } from '../src/theme-resolver';
```
to:
```typescript
import { resolvePresentation, resolveWidget } from 'formspec-layout';
import type { ThemeDocument, PresentationBlock, ItemDescriptor, Tier1Hints } from 'formspec-layout';
```

In `tests/helpers/engine-fixtures.ts`, change:
```typescript
import type { ThemeDocument, PresentationBlock } from '../../src/theme-resolver';
```
to:
```typescript
import type { ThemeDocument, PresentationBlock } from 'formspec-layout';
```

**Step 2: Delete the file**

```bash
rm packages/formspec-webcomponent/src/theme-resolver.ts
```

**Step 3: Run tests**

```bash
cd packages/formspec-webcomponent && npx vitest run
```

Expected: All ~148 tests pass.

**Step 4: Commit**

```bash
git add -A packages/formspec-webcomponent/src/theme-resolver.ts packages/formspec-webcomponent/tests/theme-resolver.test.ts packages/formspec-webcomponent/tests/helpers/engine-fixtures.ts
git commit -m "refactor(webcomponent): delete dead theme-resolver.ts, update imports to formspec-layout"
```

---

## Task 2: Create styling/ directory (split styling.ts)

Split the flat `src/styling.ts` into domain-specific files under `src/styling/`.

**Files:**
- Create: `packages/formspec-webcomponent/src/styling/index.ts`
- Create: `packages/formspec-webcomponent/src/styling/tokens.ts`
- Create: `packages/formspec-webcomponent/src/styling/classes.ts`
- Create: `packages/formspec-webcomponent/src/styling/style.ts`
- Create: `packages/formspec-webcomponent/src/styling/accessibility.ts`
- Create: `packages/formspec-webcomponent/src/styling/stylesheets.ts`
- Delete: `packages/formspec-webcomponent/src/styling.ts`
- Modify: `packages/formspec-webcomponent/src/index.ts` — update imports from `./styling` (barrel stays the same path)

**Step 1: Create `src/styling/tokens.ts`**

```typescript
import {
    ThemeDocument,
    resolveToken as resolveTokenBase,
} from 'formspec-layout';
import type { StylingHost } from './index';

export function resolveToken(host: StylingHost, val: any): any {
    return resolveTokenBase(
        val,
        host._componentDocument?.tokens,
        host.getEffectiveTheme().tokens,
    );
}

export function emitTokenProperties(host: StylingHost, container: HTMLElement): void {
    const effectiveTheme = host.getEffectiveTheme();
    const tokens = {
        ...(effectiveTheme.tokens || {}),
        ...(host._componentDocument?.tokens || {}),
    };
    for (const [key, value] of Object.entries(tokens)) {
        container.style.setProperty(
            `--formspec-${key.replace(/\./g, '-')}`,
            String(value)
        );
    }
}
```

**Step 2: Create `src/styling/classes.ts`**

```typescript
import type { PresentationBlock } from 'formspec-layout';
import type { StylingHost } from './index';
import { resolveToken } from './tokens';

export function applyCssClass(host: StylingHost, el: HTMLElement, comp: any): void {
    if (!comp.cssClass) return;
    const classes = Array.isArray(comp.cssClass) ? comp.cssClass : [comp.cssClass];
    for (const cls of classes) {
        const resolved = String(resolveToken(host, cls));
        for (const c of resolved.split(/\s+/)) {
            if (c) el.classList.add(c);
        }
    }
}

export function applyClassValue(host: StylingHost, el: HTMLElement, classValue: unknown): void {
    if (classValue === undefined || classValue === null) return;
    const values = Array.isArray(classValue) ? classValue : [classValue];
    for (const cls of values) {
        const resolved = String(resolveToken(host, cls));
        for (const c of resolved.split(/\s+/)) {
            if (c) el.classList.add(c);
        }
    }
}

export function resolveWidgetClassSlots(_host: StylingHost, presentation: PresentationBlock): {
    root?: unknown;
    label?: unknown;
    control?: unknown;
    hint?: unknown;
    error?: unknown;
} {
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
```

**Step 3: Create `src/styling/style.ts`**

```typescript
import type { StylingHost } from './index';
import { resolveToken } from './tokens';

export function applyStyle(host: StylingHost, el: HTMLElement, style: any): void {
    if (!style) return;
    for (const [key, val] of Object.entries(style)) {
        const resolved = resolveToken(host, val);
        (el.style as any)[key] = resolved;
    }
}
```

**Step 4: Create `src/styling/accessibility.ts`**

```typescript
import type { StylingHost } from './index';

let a11yDescIdCounter = 0;

export function applyAccessibility(_host: StylingHost, el: HTMLElement, comp: any): void {
    if (!comp.accessibility) return;
    const a11y = comp.accessibility;
    if (a11y.role) el.setAttribute('role', a11y.role);
    const description = a11y.description ?? a11y.ariaDescription;
    if (description) {
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
```

**Step 5: Create `src/styling/stylesheets.ts`**

```typescript
import type { StylingHost } from './index';

/** Module-level ref counts for shared theme stylesheets. */
export const stylesheetRefCounts: Map<string, number> = new Map();

export function canonicalizeStylesheetHref(href: string): string {
    try {
        return new URL(href, document.baseURI).href;
    } catch {
        return href;
    }
}

export function findThemeStylesheet(hrefKey: string): HTMLLinkElement | null {
    const links = document.head.querySelectorAll('link[data-formspec-theme-href]');
    for (const link of links) {
        const htmlLink = link as HTMLLinkElement;
        if (htmlLink.dataset.formspecThemeHref === hrefKey) return htmlLink;
    }
    return null;
}

export function loadStylesheets(host: StylingHost): void {
    cleanupStylesheets(host);
    if (!host._themeDocument?.stylesheets) return;
    const uniqueHrefs = new Set<string>();
    for (const rawHref of host._themeDocument.stylesheets) {
        if (!rawHref || typeof rawHref !== 'string') continue;
        const hrefKey = canonicalizeStylesheetHref(rawHref);
        if (uniqueHrefs.has(hrefKey)) continue;
        uniqueHrefs.add(hrefKey);

        const existingCount = stylesheetRefCounts.get(hrefKey) ?? 0;
        if (existingCount === 0) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = rawHref;
            link.dataset.formspecTheme = 'true';
            link.dataset.formspecThemeHref = hrefKey;
            document.head.appendChild(link);
        }
        stylesheetRefCounts.set(hrefKey, existingCount + 1);
        host.stylesheetHrefs.push(hrefKey);
    }
}

export function cleanupStylesheets(host: StylingHost): void {
    for (const hrefKey of host.stylesheetHrefs) {
        const count = stylesheetRefCounts.get(hrefKey) ?? 0;
        if (count <= 1) {
            stylesheetRefCounts.delete(hrefKey);
            const link = findThemeStylesheet(hrefKey);
            if (link) link.remove();
        } else {
            stylesheetRefCounts.set(hrefKey, count - 1);
        }
    }
    host.stylesheetHrefs = [];
}
```

**Step 6: Create `src/styling/index.ts` (barrel + StylingHost)**

```typescript
import type { ThemeDocument } from 'formspec-layout';

export interface StylingHost {
    _componentDocument: any;
    _definition: any;
    _themeDocument: ThemeDocument | null;
    stylesheetHrefs: string[];
    getEffectiveTheme(): ThemeDocument;
    findItemByKey(key: string, items?: any[]): any | null;
}

export { resolveToken, emitTokenProperties } from './tokens';
export { applyCssClass, applyClassValue, resolveWidgetClassSlots } from './classes';
export { applyStyle } from './style';
export { applyAccessibility } from './accessibility';
export { loadStylesheets, cleanupStylesheets, canonicalizeStylesheetHref, findThemeStylesheet, stylesheetRefCounts } from './stylesheets';
```

**Step 7: Delete old file and verify imports**

```bash
rm packages/formspec-webcomponent/src/styling.ts
```

The import in `src/index.ts` is already `from './styling'` which will now resolve to `./styling/index.ts`. No changes needed in `index.ts` for this step.

**Step 8: Run tests**

```bash
cd packages/formspec-webcomponent && npx vitest run
```

Expected: All tests pass.

**Step 9: Commit**

```bash
git add packages/formspec-webcomponent/src/styling/ packages/formspec-webcomponent/src/styling.ts
git commit -m "refactor(webcomponent): split styling.ts into styling/ directory"
```

---

## Task 3: Create navigation/ directory (split navigation.ts)

Split `src/navigation.ts` into domain-specific files under `src/navigation/`.

**Files:**
- Create: `packages/formspec-webcomponent/src/navigation/index.ts`
- Create: `packages/formspec-webcomponent/src/navigation/paths.ts`
- Create: `packages/formspec-webcomponent/src/navigation/field-focus.ts`
- Create: `packages/formspec-webcomponent/src/navigation/wizard.ts`
- Delete: `packages/formspec-webcomponent/src/navigation.ts`

**Step 1: Create `src/navigation/paths.ts`**

```typescript
export function normalizeFieldPath(path: unknown): string {
    return typeof path === 'string' ? path.trim() : '';
}

export function externalPathToInternal(path: string): string {
    return path.replace(/\[(\d+)\]/g, (_match: string, rawIndex: string) => {
        const parsed = Number.parseInt(rawIndex, 10);
        if (!Number.isFinite(parsed)) return `[${rawIndex}]`;
        return `[${Math.max(0, parsed - 1)}]`;
    });
}
```

**Step 2: Create `src/navigation/field-focus.ts`**

```typescript
import type { NavigationHost } from './index';
import { normalizeFieldPath } from './paths';

export function findFieldElement(host: NavigationHost, path: string): HTMLElement | null {
    if (!path || path === '#') return null;
    const escapedPath = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(path) : path;
    let fieldEl = host.querySelector(`.formspec-field[data-name="${escapedPath}"]`) as HTMLElement | null;
    if (fieldEl) return fieldEl;
    const allFields = Array.from(host.querySelectorAll('.formspec-field[data-name]'));
    fieldEl = allFields.find((el) => {
        const name = el.getAttribute('data-name');
        return name === path || name?.startsWith(`${path}.`) || name?.startsWith(`${path}[`);
    }) as HTMLElement | undefined || null;
    return fieldEl;
}

export function revealTabsForField(_host: NavigationHost, fieldEl: HTMLElement): void {
    let tabPanel = fieldEl.closest('.formspec-tab-panel') as HTMLElement | null;
    while (tabPanel) {
        const tabsRoot = tabPanel.closest('.formspec-tabs');
        if (tabsRoot instanceof HTMLElement) {
            const panelContainer = tabPanel.parentElement;
            const panels = panelContainer
                ? Array.from(panelContainer.children).filter((child) => child.classList.contains('formspec-tab-panel'))
                : [];
            const panelIndex = panels.indexOf(tabPanel);
            if (panelIndex >= 0) {
                tabsRoot.dispatchEvent(new CustomEvent('formspec-tabs-set-active', {
                    detail: { index: panelIndex },
                    bubbles: false,
                }));
            }
        }
        tabPanel = tabPanel.parentElement?.closest('.formspec-tab-panel') as HTMLElement | null;
    }
}

export function focusField(host: NavigationHost, path: string): boolean {
    const normalizedPath = normalizeFieldPath(path);
    let fieldEl = findFieldElement(host, normalizedPath);
    if (!fieldEl) return false;

    const wizardPanel = fieldEl.closest('.formspec-wizard-panel');
    const wizardRoot = wizardPanel?.closest('.formspec-wizard');
    if (wizardPanel instanceof HTMLElement && wizardRoot instanceof HTMLElement) {
        const panelList = Array.from(wizardRoot.children)
            .filter((child) => child.classList.contains('formspec-wizard-panel'));
        const panelIndex = panelList.indexOf(wizardPanel);
        if (panelIndex >= 0) {
            wizardRoot.dispatchEvent(new CustomEvent('formspec-wizard-set-step', {
                detail: { index: panelIndex },
                bubbles: false,
            }));
            fieldEl = findFieldElement(host, normalizedPath);
            if (!fieldEl) return false;
        }
    }

    revealTabsForField(host, fieldEl);
    fieldEl = findFieldElement(host, normalizedPath);
    if (!fieldEl) return false;

    let collapsible = fieldEl.closest('details.formspec-collapsible') as HTMLDetailsElement | null;
    while (collapsible) {
        collapsible.open = true;
        collapsible = collapsible.parentElement?.closest('details.formspec-collapsible') as HTMLDetailsElement | null;
    }

    const inputEl = fieldEl.querySelector('input, select, textarea, button, [tabindex]');
    fieldEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (inputEl instanceof HTMLElement) {
        inputEl.focus({ preventScroll: true });
    }
    return true;
}
```

**Step 3: Create `src/navigation/wizard.ts`**

```typescript
import type { NavigationHost } from './index';

export function goToWizardStep(host: NavigationHost, index: number): boolean {
    const wizardEl = host.querySelector('.formspec-wizard');
    if (wizardEl && 'dispatchEvent' in wizardEl) {
        wizardEl.dispatchEvent(new CustomEvent('formspec-wizard-set-step', {
            detail: { index },
            bubbles: false,
        }));
        return true;
    }
    return false;
}
```

**Step 4: Create `src/navigation/index.ts` (barrel + NavigationHost)**

```typescript
export interface NavigationHost {
    querySelector(selectors: string): Element | null;
    querySelectorAll(selectors: string): NodeListOf<Element>;
}

export { normalizeFieldPath, externalPathToInternal } from './paths';
export { findFieldElement, revealTabsForField, focusField } from './field-focus';
export { goToWizardStep } from './wizard';
```

**Step 5: Delete old file**

```bash
rm packages/formspec-webcomponent/src/navigation.ts
```

Import in `index.ts` is already `from './navigation'` — resolves to `./navigation/index.ts` automatically.

**Step 6: Run tests**

```bash
cd packages/formspec-webcomponent && npx vitest run
```

Expected: All tests pass.

**Step 7: Commit**

```bash
git add packages/formspec-webcomponent/src/navigation/ packages/formspec-webcomponent/src/navigation.ts
git commit -m "refactor(webcomponent): split navigation.ts into navigation/ directory"
```

---

## Task 4: Move field-input.ts and screener.ts into rendering/

Move existing files into a new `rendering/` directory. No code changes — just file moves and import path updates.

**Files:**
- Create: `packages/formspec-webcomponent/src/rendering/index.ts`
- Move: `src/field-input.ts` → `src/rendering/field-input.ts`
- Move: `src/screener.ts` → `src/rendering/screener.ts`
- Modify: `packages/formspec-webcomponent/src/index.ts` — update import paths

**Step 1: Create directory and move files**

```bash
mkdir -p packages/formspec-webcomponent/src/rendering
mv packages/formspec-webcomponent/src/field-input.ts packages/formspec-webcomponent/src/rendering/field-input.ts
mv packages/formspec-webcomponent/src/screener.ts packages/formspec-webcomponent/src/rendering/screener.ts
```

**Step 2: Fix import paths in moved files**

In `src/rendering/screener.ts`, change:
```typescript
import { ScreenerRoute } from './types.js';
```
to:
```typescript
import { ScreenerRoute } from '../types';
```

In `src/rendering/field-input.ts`, no import path changes needed (imports are from external packages only).

**Step 3: Create `src/rendering/index.ts` barrel**

```typescript
export { renderInputComponent, type FieldInputHost } from './field-input';
export { renderScreener, type ScreenerHost } from './screener';
```

**Step 4: Update imports in `src/index.ts`**

Change:
```typescript
import { renderScreener, type ScreenerHost } from './screener';
import { renderInputComponent as renderInputComponentFn, type FieldInputHost } from './field-input';
```
to:
```typescript
import { renderScreener, type ScreenerHost } from './rendering/screener';
import { renderInputComponent as renderInputComponentFn, type FieldInputHost } from './rendering/field-input';
```

**Step 5: Run tests**

```bash
cd packages/formspec-webcomponent && npx vitest run
```

Expected: All tests pass.

**Step 6: Commit**

```bash
git add packages/formspec-webcomponent/src/rendering/ packages/formspec-webcomponent/src/index.ts
git commit -m "refactor(webcomponent): move field-input and screener into rendering/"
```

---

## Task 5: Extract breakpoints into rendering/breakpoints.ts

Extract `setupBreakpoints()` and breakpoint state from `FormspecRender` into `rendering/breakpoints.ts`.

**Files:**
- Create: `packages/formspec-webcomponent/src/rendering/breakpoints.ts`
- Modify: `packages/formspec-webcomponent/src/rendering/index.ts` — add barrel export
- Modify: `packages/formspec-webcomponent/src/index.ts` — remove breakpoint code, import from rendering

**Step 1: Create `src/rendering/breakpoints.ts`**

```typescript
import { signal } from '@preact/signals-core';

export interface BreakpointHost {
    _componentDocument: any;
    scheduleRender(): void;
}

export interface BreakpointState {
    activeBreakpointSignal: ReturnType<typeof signal<string | null>>;
    cleanups: Array<() => void>;
}

export function createBreakpointState(): BreakpointState {
    return {
        activeBreakpointSignal: signal<string | null>(null),
        cleanups: [],
    };
}

export function setupBreakpoints(host: BreakpointHost, state: BreakpointState): void {
    for (const fn of state.cleanups) fn();
    state.cleanups = [];
    state.activeBreakpointSignal.value = null;

    if (!host._componentDocument?.breakpoints) return;
    const breakpoints: Record<string, number | string> = host._componentDocument.breakpoints;

    const entries = Object.entries(breakpoints)
        .map(([name, val]) => {
            const query = typeof val === 'number' ? `(min-width: ${val}px)` : String(val);
            const width = typeof val === 'number' ? val : (parseInt(String(val).replace(/[^0-9]/g, '')) || 0);
            return { name, query, width };
        })
        .sort((a, b) => a.width - b.width);

    for (const { name, query } of entries) {
        const mql = window.matchMedia(query);
        const handler = () => {
            let active: string | null = null;
            for (const entry of entries) {
                if (window.matchMedia(entry.query).matches) active = entry.name;
            }
            if (active !== state.activeBreakpointSignal.value) {
                state.activeBreakpointSignal.value = active;
                host.scheduleRender();
            }
        };
        mql.addEventListener('change', handler);
        state.cleanups.push(() => mql.removeEventListener('change', handler));
        if (mql.matches) state.activeBreakpointSignal.value = name;
    }
}

export function cleanupBreakpoints(state: BreakpointState): void {
    for (const fn of state.cleanups) fn();
    state.cleanups = [];
}
```

**Step 2: Update barrel**

Add to `src/rendering/index.ts`:
```typescript
export { setupBreakpoints, cleanupBreakpoints, createBreakpointState, type BreakpointHost, type BreakpointState } from './breakpoints';
```

**Step 3: Update `src/index.ts`**

Replace the breakpoint-related private fields and `setupBreakpoints()` method in `FormspecRender`:

- Remove: `private _activeBreakpointSignal`, `private get/set activeBreakpoint`, `private breakpointCleanups`, `private setupBreakpoints()`
- Add: import `{ setupBreakpoints, cleanupBreakpoints, createBreakpointState, BreakpointState }` from `./rendering/breakpoints`
- Add field: `private _breakpoints: BreakpointState = createBreakpointState();`
- Add getter: `private get activeBreakpoint(): string | null { return this._breakpoints.activeBreakpointSignal.value; }`
- In `render()`: replace `this.setupBreakpoints()` with `setupBreakpoints(this as any, this._breakpoints)`
- In `disconnectedCallback()`: replace `for (const fn of this.breakpointCleanups) fn(); this.breakpointCleanups = [];` with `cleanupBreakpoints(this._breakpoints);`
- The `scheduleRender` method needs to be accessible — make it non-private or add to BreakpointHost interface (it's already there).

**Step 4: Run tests**

```bash
cd packages/formspec-webcomponent && npx vitest run
```

Expected: All tests pass.

**Step 5: Commit**

```bash
git add packages/formspec-webcomponent/src/rendering/ packages/formspec-webcomponent/src/index.ts
git commit -m "refactor(webcomponent): extract breakpoint management into rendering/breakpoints"
```

---

## Task 6: Extract submit flow into submit/

Extract `submit()`, `touchAllFields()`, `setSubmitPending()`, `isSubmitPending()`, and `resolveValidationTarget()` from `FormspecRender`.

**Files:**
- Create: `packages/formspec-webcomponent/src/submit/index.ts`
- Modify: `packages/formspec-webcomponent/src/index.ts` — remove submit code, delegate to module

**Step 1: Create `src/submit/index.ts`**

```typescript
import type { Signal } from '@preact/signals-core';
import type { FormEngine } from 'formspec-engine';
import { normalizeFieldPath, externalPathToInternal, findFieldElement } from '../navigation';
import type { NavigationHost } from '../navigation';
import type { ValidationTargetMetadata } from '../types';

export interface SubmitHost extends NavigationHost {
    engine: FormEngine | null;
    _definition: any;
    touchedFields: Set<string>;
    touchedVersion: Signal<number>;
    _submitPendingSignal: Signal<boolean>;
    _latestSubmitDetailSignal: Signal<{
        response: any;
        validationReport: {
            valid: boolean;
            results: any[];
            counts: { error: number; warning: number; info: number };
            timestamp: string;
        };
    } | null>;
    dispatchEvent(event: Event): boolean;
    findItemByKey(key: string, items?: any[]): any | null;
}

export function touchAllFields(host: SubmitHost): void {
    if (!host.engine) return;
    let touchedAny = false;
    for (const key of Object.keys(host.engine.errorSignals)) {
        if (host.touchedFields.has(key)) continue;
        host.touchedFields.add(key);
        touchedAny = true;
    }
    if (touchedAny) {
        host.touchedVersion.value += 1;
    }
}

export function submit(host: SubmitHost, options?: { mode?: 'continuous' | 'submit'; emitEvent?: boolean }): {
    response: any;
    validationReport: {
        valid: boolean;
        results: any[];
        counts: { error: number; warning: number; info: number };
        timestamp: string;
    };
} | null {
    if (!host.engine) return null;
    const mode = options?.mode || 'submit';
    const emitEvent = options?.emitEvent !== false;

    touchAllFields(host);

    const response = host.engine.getResponse({ mode });
    const results = Array.isArray(response?.validationResults) ? response.validationResults : [];
    const counts = { error: 0, warning: 0, info: 0 };
    for (const result of results) {
        const severity = result?.severity as 'error' | 'warning' | 'info' | undefined;
        if (severity === 'error' || severity === 'warning' || severity === 'info') {
            counts[severity] += 1;
        }
    }
    const validationReport = {
        valid: counts.error === 0,
        results,
        counts,
        timestamp: response?.authored || new Date().toISOString(),
    };
    const detail = { response, validationReport };
    host._latestSubmitDetailSignal.value = detail;

    if (emitEvent) {
        host.dispatchEvent(new CustomEvent('formspec-submit', {
            detail,
            bubbles: true,
            composed: true,
        }));
    }

    return detail;
}

export function setSubmitPending(host: SubmitHost, pending: boolean): void {
    const next = !!pending;
    if (next === host._submitPendingSignal.value) return;
    host._submitPendingSignal.value = next;
    host.dispatchEvent(new CustomEvent('formspec-submit-pending-change', {
        detail: { pending: next },
        bubbles: true,
        composed: true,
    }));
}

export function isSubmitPending(host: SubmitHost): boolean {
    return host._submitPendingSignal.value;
}

export function resolveValidationTarget(host: SubmitHost, resultOrPath: any): ValidationTargetMetadata {
    const rawPath = typeof resultOrPath === 'string'
        ? resultOrPath
        : (typeof resultOrPath?.sourceId === 'string'
            ? resultOrPath.sourceId
            : (typeof resultOrPath?.path === 'string' ? resultOrPath.path : ''));
    const normalizedPath = normalizeFieldPath(rawPath);
    const formLevel = normalizedPath === '' || normalizedPath === '#';

    let path = formLevel ? '' : normalizedPath;
    let fieldElement: HTMLElement | null = null;

    if (!formLevel) {
        const candidatePaths = [normalizedPath, externalPathToInternal(normalizedPath)]
            .filter((candidate, index, all) => candidate && all.indexOf(candidate) === index);
        for (const candidate of candidatePaths) {
            const match = findFieldElement(host, candidate);
            if (!match) continue;
            path = candidate;
            fieldElement = match;
            break;
        }
    }

    const keyPath = (path || normalizedPath).replace(/\[\d+\]/g, '');
    const item = keyPath ? host.findItemByKey(keyPath) : null;
    const label = formLevel
        ? (host._definition?.title || 'Form')
        : (item?.label || keyPath || normalizedPath || 'Field');

    return {
        path,
        label,
        formLevel,
        jumpable: !!fieldElement,
        fieldElement,
    };
}
```

**Step 2: Update `src/index.ts`**

- Add import: `import { submit as submitFn, touchAllFields as touchAllFieldsFn, setSubmitPending as setSubmitPendingFn, isSubmitPending as isSubmitPendingFn, resolveValidationTarget as resolveValidationTargetFn, type SubmitHost } from './submit';`
- Replace method bodies with delegation:
  - `submit(options?) { return submitFn(this as any, options); }`
  - `touchAllFields() { touchAllFieldsFn(this as any); }`
  - `setSubmitPending(pending) { setSubmitPendingFn(this as any, pending); }`
  - `isSubmitPending() { return isSubmitPendingFn(this as any); }`
  - `resolveValidationTarget(resultOrPath) { return resolveValidationTargetFn(this as any, resultOrPath); }`
- Remove the old method bodies (the full implementations).
- Remove the now-unused `normalizeFieldPath` and `externalPathToInternal` imports from `./navigation` in `index.ts` (they're still used via submit module internally).

**Step 3: Run tests**

```bash
cd packages/formspec-webcomponent && npx vitest run
```

Expected: All tests pass.

**Step 4: Commit**

```bash
git add packages/formspec-webcomponent/src/submit/ packages/formspec-webcomponent/src/index.ts
git commit -m "refactor(webcomponent): extract submit flow into submit/ directory"
```

---

## Task 7: Extract emitNode and renderActualComponent into rendering/emit-node.ts

This is the biggest extraction — the tree-walking render logic moves out of `FormspecRender`.

**Files:**
- Create: `packages/formspec-webcomponent/src/rendering/emit-node.ts`
- Modify: `packages/formspec-webcomponent/src/rendering/index.ts` — add barrel export
- Modify: `packages/formspec-webcomponent/src/index.ts` — remove emitNode/renderActualComponent/renderComponent, delegate

**Step 1: Create `src/rendering/emit-node.ts`**

This file contains `emitNode()`, `renderActualComponent()`, and `renderComponent()` extracted as standalone functions. They need a `RenderHost` interface:

```typescript
import { effect, signal } from '@preact/signals-core';
import type { FormEngine } from 'formspec-engine';
import type { LayoutNode } from 'formspec-layout';
import { globalRegistry } from '../registry';
import type { RenderContext, ComponentPlugin, ValidationTargetMetadata } from '../types';
import type { FieldInputHost } from './field-input';
import { renderInputComponent } from './field-input';

export interface RenderHost {
    engine: FormEngine;
    _definition: any;
    _componentDocument: any;
    _themeDocument: any;
    cleanupFns: Array<() => void>;
    touchedFields: Set<string>;
    touchedVersion: ReturnType<typeof signal<number>>;
    _submitPendingSignal: ReturnType<typeof signal<boolean>>;
    _latestSubmitDetailSignal: ReturnType<typeof signal<any>>;

    // Styling
    resolveToken(val: any): any;
    resolveItemPresentation(itemDesc: any): any;
    applyStyle(el: HTMLElement, style: any): void;
    applyCssClass(el: HTMLElement, comp: any): void;
    applyClassValue(el: HTMLElement, classValue: unknown): void;
    resolveWidgetClassSlots(presentation: any): any;
    applyAccessibility(el: HTMLElement, comp: any): void;

    // Navigation
    findItemByKey(key: string, items?: any[]): any | null;

    // Submit
    submit(options?: any): any;
    resolveValidationTarget(resultOrPath: any): ValidationTargetMetadata;
    focusField(path: string): boolean;
    setSubmitPending(pending: boolean): void;
    isSubmitPending(): boolean;

    // Self-reference for render delegation
    render(): void;
    activeBreakpoint: string | null;
}

export function emitNode(host: RenderHost, node: LayoutNode, parent: HTMLElement, prefix: string): void {
    let target = parent;

    if (node.when) {
        const wrapper = document.createElement('div');
        wrapper.className = 'formspec-when';
        target.appendChild(wrapper);
        let fallbackEl: HTMLElement | null = null;
        if (node.fallback) {
            fallbackEl = document.createElement('p');
            fallbackEl.className = 'formspec-conditional-fallback';
            fallbackEl.textContent = node.fallback;
            target.appendChild(fallbackEl);
        }
        const exprFn = host.engine.compileExpression(node.when, prefix);
        host.cleanupFns.push(effect(() => {
            const visible = !!exprFn();
            wrapper.classList.toggle('formspec-hidden', !visible);
            if (fallbackEl) fallbackEl.classList.toggle('formspec-hidden', visible);
        }));
        target = wrapper;
    }

    if (node.isRepeatTemplate && node.props.bind) {
        const bindKey = node.props.bind as string;
        const fullRepeatPath = prefix ? `${prefix}.${bindKey}` : bindKey;
        const container = document.createElement('div');
        container.className = 'formspec-repeat';
        container.dataset.bind = bindKey;
        target.appendChild(container);

        host.cleanupFns.push(effect(() => {
            const count = host.engine.repeats[fullRepeatPath]?.value || 0;
            while (container.children.length > count) {
                container.removeChild(container.lastChild!);
            }
            while (container.children.length < count) {
                const idx = container.children.length;
                const instanceWrapper = document.createElement('div');
                instanceWrapper.className = 'formspec-repeat-instance';
                container.appendChild(instanceWrapper);

                const instancePrefix = `${fullRepeatPath}[${idx}]`;
                for (const child of node.children) {
                    emitNode(host, child, instanceWrapper, instancePrefix);
                }
            }
        }));

        const item = host.findItemByKey(bindKey);
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'formspec-repeat-add';
        addBtn.textContent = `Add ${item?.label || bindKey}`;
        addBtn.addEventListener('click', () => {
            host.engine.addRepeatInstance(fullRepeatPath);
        });
        target.appendChild(addBtn);
        return;
    }

    if (node.scopeChange && !node.isRepeatTemplate && node.props.bind) {
        const bindKey = node.props.bind as string;
        const nextPrefix = prefix ? `${prefix}.${bindKey}` : bindKey;
        const el = document.createElement('div');
        el.className = 'formspec-group';
        if (node.props.title) {
            const heading = document.createElement('h3');
            heading.textContent = node.props.title as string;
            el.appendChild(heading);
        }
        const groupFullPath = nextPrefix;
        if (host.engine.relevantSignals[groupFullPath]) {
            host.cleanupFns.push(effect(() => {
                const isRelevant = host.engine.relevantSignals[groupFullPath].value;
                el.classList.toggle('formspec-hidden', !isRelevant);
            }));
        }
        target.appendChild(el);

        for (const child of node.children) {
            emitNode(host, child, el, nextPrefix);
        }
        return;
    }

    const comp: any = {
        component: node.component,
        ...node.props,
    };
    if (node.style) comp.style = node.style;
    if (node.cssClasses.length > 0) comp.cssClass = node.cssClasses;
    if (node.accessibility) comp.accessibility = node.accessibility;
    comp.children = node.children;

    renderActualComponent(host, comp, parent, prefix);
}

export function renderComponent(host: RenderHost, comp: any, parent: HTMLElement, prefix = ''): void {
    if (comp && typeof comp === 'object' && 'category' in comp && 'id' in comp) {
        emitNode(host, comp as LayoutNode, parent, prefix);
        return;
    }
    console.warn('renderComponent called with non-LayoutNode comp — this should not happen after planner integration', comp);
}

export function renderActualComponent(host: RenderHost, comp: any, parent: HTMLElement, prefix = ''): void {
    const componentType = comp.component;
    const plugin = globalRegistry.get(componentType);

    const ctx: RenderContext = {
        engine: host.engine,
        componentDocument: host._componentDocument,
        themeDocument: host._themeDocument,
        prefix,
        submit: host.submit.bind(host),
        resolveValidationTarget: host.resolveValidationTarget.bind(host),
        focusField: host.focusField.bind(host),
        submitPendingSignal: host._submitPendingSignal,
        latestSubmitDetailSignal: host._latestSubmitDetailSignal,
        setSubmitPending: host.setSubmitPending.bind(host),
        isSubmitPending: host.isSubmitPending.bind(host),
        renderComponent: (comp: any, parent: HTMLElement, pfx?: string) => renderComponent(host, comp, parent, pfx),
        resolveToken: host.resolveToken.bind(host),
        applyStyle: host.applyStyle.bind(host),
        applyCssClass: host.applyCssClass.bind(host),
        applyAccessibility: host.applyAccessibility.bind(host),
        resolveItemPresentation: host.resolveItemPresentation.bind(host),
        cleanupFns: host.cleanupFns,
        findItemByKey: host.findItemByKey,
        renderInputComponent: (comp: any, item: any, fullName: string) => renderInputComponent(host as any, comp, item, fullName),
        activeBreakpoint: host.activeBreakpoint,
    };

    if (plugin) {
        plugin.render(comp, parent, ctx);
    } else {
        console.warn(`Unknown component type: ${componentType} (custom components should be expanded by planner)`);
    }
}
```

**Step 2: Update rendering barrel**

Add to `src/rendering/index.ts`:
```typescript
export { emitNode, renderComponent, renderActualComponent, type RenderHost } from './emit-node';
```

**Step 3: Update `src/index.ts`**

- Add import: `import { emitNode, renderComponent as renderComponentFn, type RenderHost } from './rendering/emit-node';`
- Remove: the `private emitNode()`, `private renderComponent`, and `private renderActualComponent()` methods entirely
- Replace the body of `render()` where it calls `this.emitNode(plan, container, '')` with `emitNode(this as any, plan, container, '')`
- Remove the `private renderInputComponent` arrow function (it's now called internally by emit-node)
- Make `scheduleRender()` visible to breakpoints module (change from `private` to just remove the private keyword, or keep it and cast)

**Step 4: Run tests**

```bash
cd packages/formspec-webcomponent && npx vitest run
```

Expected: All tests pass.

**Step 5: Commit**

```bash
git add packages/formspec-webcomponent/src/rendering/ packages/formspec-webcomponent/src/index.ts
git commit -m "refactor(webcomponent): extract emitNode and render logic into rendering/emit-node"
```

---

## Task 8: Rename index.ts to element.ts and create slim barrel

Now that `FormspecRender` is a thin shell, rename it and create a proper barrel.

**Files:**
- Rename: `src/index.ts` → `src/element.ts`
- Create: `src/index.ts` (new slim barrel)

**Step 1: Rename**

```bash
mv packages/formspec-webcomponent/src/index.ts packages/formspec-webcomponent/src/element.ts
```

**Step 2: Create new `src/index.ts` barrel**

```typescript
// Barrel re-exports
export { FormspecRender } from './element';
export { ComponentRegistry, globalRegistry } from './registry';
export { formatMoney } from './format';

// Re-exports from formspec-layout (unchanged public API)
export { resolvePresentation, resolveWidget, interpolateParams, resolveResponsiveProps, resolveToken, getDefaultComponent } from 'formspec-layout';
export type { ThemeDocument, PresentationBlock, ItemDescriptor, AccessibilityBlock, ThemeSelector, SelectorMatch, Tier1Hints, FormspecDataType, Page, Region, LayoutHints, StyleHints } from 'formspec-layout';

// Types
export type { RenderContext, ComponentPlugin, ValidationTargetMetadata, ScreenerRoute, ScreenerRouteType, ScreenerStateSnapshot } from './types';

// Default theme
import defaultThemeJson from './default-theme.json';
export { defaultThemeJson as defaultTheme };

// CSS side-effect
import './formspec-base.css';

// Register built-in components on import
import { registerDefaultComponents } from './components';
registerDefaultComponents();
```

**Step 3: Update `src/element.ts`**

Remove from `element.ts`:
- The `registerDefaultComponents()` call (moved to barrel)
- The re-exports of `formspec-layout` types/functions (moved to barrel)
- The `export { formatMoney }` (moved to barrel)
- The `export { defaultThemeJson as defaultTheme }` (moved to barrel)
- The CSS import (moved to barrel)
- The `registerDefaultComponents` import (moved to barrel)

Keep in `element.ts`:
- The `FormspecRender` class export
- All imports needed by the class itself

**Step 4: Run tests**

```bash
cd packages/formspec-webcomponent && npx vitest run
```

Expected: All tests pass.

**Step 5: Build check**

```bash
cd packages/formspec-webcomponent && npx tsc --noEmit
```

Expected: No type errors.

**Step 6: Commit**

```bash
git add packages/formspec-webcomponent/src/
git commit -m "refactor(webcomponent): split index.ts into element.ts + slim barrel"
```

---

## Task 9: Reorganize test files to mirror source structure

Move test files into subdirectories that mirror the source layout.

**Files:**
- Create: `tests/rendering/`, `tests/styling/`, `tests/components/`
- Move test files into appropriate directories
- Verify vitest glob still matches

**Step 1: Create directories and move files**

```bash
cd packages/formspec-webcomponent
mkdir -p tests/rendering tests/styling tests/components

# Rendering tests
mv tests/input-rendering.test.ts tests/rendering/input-rendering.test.ts

# Styling tests
mv tests/token-resolution.test.ts tests/styling/token-resolution.test.ts
mv tests/a11y-attributes.test.ts tests/styling/a11y-attributes.test.ts

# Component tests
mv tests/layout-components.test.ts tests/components/layout-components.test.ts
mv tests/interactive-plugins.test.ts tests/components/interactive-plugins.test.ts
mv tests/component-props.test.ts tests/components/component-props.test.ts
mv tests/custom-components.test.ts tests/components/custom-components.test.ts
```

**Step 2: Fix relative import paths in moved test files**

Each moved test file's imports from `../src/index` become `../../src/index`, and `./helpers/` becomes `../helpers/`.

For files in `tests/rendering/`:
- `../src/index` → `../../src/index`
- `./helpers/engine-fixtures` → `../helpers/engine-fixtures`

Same pattern for `tests/styling/` and `tests/components/`.

Check each moved file and update its relative imports accordingly.

**Step 3: Verify vitest config**

The existing glob `tests/**/*.test.ts` already matches subdirectories. No config change needed.

**Step 4: Run tests**

```bash
cd packages/formspec-webcomponent && npx vitest run
```

Expected: All ~148 tests pass.

**Step 5: Commit**

```bash
git add packages/formspec-webcomponent/tests/
git commit -m "refactor(webcomponent): reorganize test files to mirror source structure"
```

---

## Task 10: Final verification and cleanup

**Step 1: Full test suite**

```bash
cd packages/formspec-webcomponent && npx vitest run
```

Expected: All ~148 tests pass.

**Step 2: Type check**

```bash
cd packages/formspec-webcomponent && npx tsc --noEmit
```

Expected: No errors.

**Step 3: Build**

```bash
npm run build --workspace=packages/formspec-webcomponent
```

Expected: Clean build.

**Step 4: E2E smoke test**

```bash
npx playwright test tests/e2e/playwright/grant-app/ --reporter=list
```

Expected: All grant-app E2E tests pass (these exercise the webcomponent end-to-end).

**Step 5: Verify no stale files**

```bash
ls packages/formspec-webcomponent/src/*.ts
```

Expected: Only `index.ts`, `element.ts`, `types.ts`, `registry.ts`, `format.ts`, `global.d.ts` at root level. No `theme-resolver.ts`, `styling.ts`, `navigation.ts`, `field-input.ts`, `screener.ts`.

**Step 6: Commit if any cleanup needed**

```bash
git add -A packages/formspec-webcomponent/
git commit -m "refactor(webcomponent): final cleanup after reorganization"
```
