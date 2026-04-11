# Headless Component Adapters Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the monolithic `field-input.ts` (540 lines) and inline input plugins into behavior hooks + render adapters per ADR 0046, enabling design-system-specific DOM without forking rendering code.

**Architecture:** Dependency inversion at the component render layer. Each field component splits into a behavior hook (owns reactive signal wiring, value coercion, ARIA management) and a render adapter (owns DOM structure). The default adapter reproduces today's DOM exactly. External adapters (USWDS Tailwind, etc.) can provide different DOM structures while reusing the same behavior hooks.

**Tech Stack:** TypeScript, Preact Signals (`@preact/signals-core`), Vitest + happy-dom

**Scope:** Phase 1 (infrastructure) + Phase 2 (all 13 field components) + Phase 4 (Wizard, Tabs) + Phase 5 (cleanup). Phase 3 (USWDS Tailwind adapter package) is a separate plan.

**Key invariant:** All existing tests must pass after every task. The default adapter reproduces the current DOM output exactly.

---

## File Structure

### New files

```
packages/formspec-webcomponent/src/
  behaviors/
    types.ts              — FieldBehavior, FieldRefs, ResolvedPresentationBlock, adapter types
    shared.ts             — resolveFieldPath, toFieldId, resolveAndStripTokens, createFieldBehavior
    text-input.ts         — useTextInput (plain text, textarea, prefix/suffix variants)
    number-input.ts       — useNumberInput
    radio-group.ts        — useRadioGroup (extends FieldBehavior with groupRole, inputName)
    checkbox-group.ts     — useCheckboxGroup
    select.ts             — useSelect
    toggle.ts             — useToggle
    checkbox.ts           — useCheckbox
    money-input.ts        — useMoneyInput
    date-picker.ts        — useDatePicker
    slider.ts             — useSlider
    rating.ts             — useRating
    file-upload.ts        — useFileUpload
    signature.ts          — useSignature
    wizard.ts             — useWizard
    tabs.ts               — useTabs
    index.ts              — barrel export
  adapters/
    types.ts              — RenderAdapter, AdapterRenderFn, AdapterContext
    registry.ts           — adapter map + resolution on ComponentRegistry
    default/
      index.ts            — defaultAdapter: RenderAdapter
      shared.ts           — common DOM helpers (createFieldWrapper, createLabel, createError, etc.)
      text-input.ts       — renderTextInput (text, textarea, prefix/suffix)
      number-input.ts     — renderNumberInput
      radio-group.ts      — renderRadioGroup
      checkbox-group.ts   — renderCheckboxGroup
      select.ts           — renderSelect
      toggle.ts           — renderToggle
      checkbox.ts         — renderCheckbox
      money-input.ts      — renderMoneyInput
      date-picker.ts      — renderDatePicker
      slider.ts           — renderSlider
      rating.ts           — renderRating
      file-upload.ts      — renderFileUpload
      signature.ts        — renderSignature
      wizard.ts           — renderWizard
      tabs.ts             — renderTabs
    index.ts              — barrel export

packages/formspec-webcomponent/tests/
  behaviors/
    shared.test.ts        — resolveFieldPath, toFieldId, resolveAndStripTokens tests
    text-input.test.ts    — useTextInput contract tests
  adapters/
    registry.test.ts      — adapter registration, resolution, fallback
```

### Modified files

```
packages/formspec-webcomponent/src/
  registry.ts             — Add adapter registration + resolution methods
  types.ts                — Re-export behavior/adapter types
  components/inputs.ts    — Plugins become thin orchestrators (behavior → adapter → bind)
  components/interactive.ts — Wizard/Tabs become orchestrators
  rendering/emit-node.ts  — Remove renderInputComponent from RenderContext construction
```

### Deleted files

```
packages/formspec-webcomponent/src/rendering/field-input.ts  — replaced entirely
```

---

## Reference: Current Code Map

Before implementing, understand these critical code locations:

| File | Lines | What it does | Role after refactor |
|------|-------|-------------|-------------------|
| `src/rendering/field-input.ts` | 1-540 | Monolithic field builder: DOM + signals + events + ARIA | **DELETED** — split into behaviors/ + adapters/default/ |
| `src/components/inputs.ts` | 1-458 | 13 input plugins. 8 delegate to `renderInputComponent`, 5 are self-contained | Thin orchestrators calling behavior → adapter |
| `src/components/interactive.ts` | 1-373 | Wizard (250 lines), Tabs (80 lines), SubmitButton | Wizard/Tabs become orchestrators. SubmitButton unchanged |
| `src/rendering/emit-node.ts` | 190-225 | Builds RenderContext, including `renderInputComponent` | Remove `renderInputComponent` from context |
| `src/registry.ts` | 1-52 | ComponentRegistry with plugin map | Add adapter registration + resolution |
| `src/types.ts` | 1-159 | RenderContext, ComponentPlugin interfaces | Remove `renderInputComponent` from RenderContext, re-export new types |

---

## Task 1: Behavior + Adapter Type Definitions

**Files:**
- Create: `packages/formspec-webcomponent/src/behaviors/types.ts`
- Create: `packages/formspec-webcomponent/src/adapters/types.ts`

> **ADR divergence note:** The ADR defines `AdapterContext` as minimal (`onDispose` only). This plan extends it with `applyCssClass`, `applyStyle`, `applyAccessibility`, `applyClassValue`, and `resolveWidgetClassSlots` because the default adapter needs these to reproduce the current DOM faithfully. External design-system adapters can ignore all but `onDispose`.

> **ADR divergence note:** The ADR lists `search-input.ts` and `textarea.ts` as separate behaviors. This plan treats Textarea as a variant of TextInput (`maxLines > 1`) and omits SearchInput (no current implementation exists). These can be added when needed.

- [ ] **Step 1: Create behavior types**

Create `src/behaviors/types.ts` with the core interfaces from ADR 0046:

```typescript
/** @filedesc Core behavior contract types for the headless component architecture. */
import type { Signal } from '@preact/signals-core';
import type { FormEngine } from 'formspec-engine';
import type { PresentationBlock, ItemDescriptor } from 'formspec-layout';

/**
 * Pre-resolved PresentationBlock — all $token. references already
 * substituted with concrete values. Adapters never need token resolution.
 */
export interface ResolvedPresentationBlock {
    widget?: string;
    widgetConfig?: Record<string, any>;
    labelPosition?: 'top' | 'start' | 'hidden';
    style?: Record<string, string>;
    accessibility?: { role?: string; description?: string; liveRegion?: string };
    cssClass?: string | string[];
    fallback?: string[];
}

export interface FieldRefs {
    root: HTMLElement;
    label: HTMLElement;
    control: HTMLElement;
    hint?: HTMLElement;
    error?: HTMLElement;
    optionControls?: Map<string, HTMLInputElement>;
    rebuildOptions?: (
        container: HTMLElement,
        options: ReadonlyArray<{ value: string; label: string }>
    ) => Map<string, HTMLInputElement>;
}

/** Returned by every field behavior hook. */
export interface FieldBehavior {
    fieldPath: string;
    id: string;
    label: string;
    hint: string | null;
    description: string | null;
    presentation: ResolvedPresentationBlock;
    /**
     * Widget class slots from resolveWidgetClassSlots(presentation).
     * The default adapter uses these for x-classes support.
     */
    widgetClassSlots: { root?: unknown; label?: unknown; control?: unknown; hint?: unknown; error?: unknown };
    /**
     * Component-level style/class/accessibility overrides (from comp descriptor).
     * Extracted by the behavior hook so adapters don't need the raw comp.
     */
    compOverrides: {
        cssClass?: any;
        style?: any;
        accessibility?: any;
    };
    /** Remote options loading/error state for status display. */
    remoteOptionsState: { loading: boolean; error: string | null };
    options(): ReadonlyArray<{ value: string; label: string }>;
    bind(refs: FieldRefs): () => void;
}

export interface RadioGroupBehavior extends FieldBehavior {
    groupRole: 'radiogroup';
    inputName: string;
    orientation?: string;
}

export interface CheckboxGroupBehavior extends FieldBehavior {
    groupRole: 'group';
    selectAll: boolean;
    columns?: number;
}

export interface SelectBehavior extends FieldBehavior {
    placeholder?: string;
    clearable?: boolean;
}

export interface ToggleBehavior extends FieldBehavior {
    onLabel?: string;
    offLabel?: string;
}

export interface TextInputBehavior extends FieldBehavior {
    placeholder?: string;
    inputMode?: string;
    maxLines?: number;
    prefix?: string;
    suffix?: string;
    /** Extension-resolved input type override (e.g., 'email', 'tel'). */
    resolvedInputType?: string;
    /** Extension-resolved attributes (autocomplete, pattern, maxLength, etc.). */
    extensionAttrs: Record<string, string>;
}

export interface NumberInputBehavior extends FieldBehavior {
    min?: number;
    max?: number;
    step?: number;
    dataType: string;
}

export interface DatePickerBehavior extends FieldBehavior {
    inputType: string; // 'date' | 'time' | 'datetime-local'
    minDate?: string;
    maxDate?: string;
}

export interface MoneyInputBehavior extends FieldBehavior {
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
    resolvedCurrency: string | null;
}

export interface SliderBehavior extends FieldBehavior {
    min?: number;
    max?: number;
    step?: number;
    showTicks: boolean;
    showValue: boolean;
}

export interface RatingBehavior extends FieldBehavior {
    maxRating: number;
    icon: string;
    allowHalf: boolean;
    isInteger: boolean;
}

export interface FileUploadBehavior extends FieldBehavior {
    accept?: string;
    multiple: boolean;
    dragDrop: boolean;
}

export interface SignatureBehavior extends FieldBehavior {
    height: number;
    strokeColor: string;
}

export interface WizardRefs {
    root: HTMLElement;
    stepIndicators?: HTMLElement[];
    stepContent: HTMLElement;
    prevButton?: HTMLButtonElement;
    nextButton?: HTMLButtonElement;
}

export interface WizardBehavior {
    steps: ReadonlyArray<{ id: string; title: string }>;
    showSideNav: boolean;
    showProgress: boolean;
    allowSkip: boolean;
    activeStep(): number;
    totalSteps(): number;
    canGoNext(): boolean;
    canGoPrev(): boolean;
    goNext(): void;
    goPrev(): void;
    goToStep(index: number): void;
    renderStep(index: number, parent: HTMLElement): void;
    bind(refs: WizardRefs): () => void;
}

export interface TabsRefs {
    root: HTMLElement;
    tabBar: HTMLElement;
    panels: HTMLElement[];
    buttons: HTMLButtonElement[];
}

export interface TabsBehavior {
    tabLabels: string[];
    position: 'top' | 'bottom';
    defaultTab: number;
    activeTab(): number;
    setActiveTab(index: number): void;
    renderTab(index: number, parent: HTMLElement): void;
    bind(refs: TabsRefs): () => void;
}

/**
 * Context passed to behavior hooks. Subset of RenderContext
 * focused on what behaviors actually need.
 */
export interface BehaviorContext {
    engine: FormEngine;
    prefix: string;
    cleanupFns: Array<() => void>;
    touchedFields: Set<string>;
    touchedVersion: Signal<number>;
    latestSubmitDetailSignal: Signal<any>;
    resolveToken: (val: any) => any;
    resolveItemPresentation: (item: ItemDescriptor) => PresentationBlock;
    resolveWidgetClassSlots: (presentation: PresentationBlock) => {
        root?: unknown; label?: unknown; control?: unknown; hint?: unknown; error?: unknown;
    };
    findItemByKey: (key: string) => any | null;
    renderComponent: (comp: any, parent: HTMLElement, prefix?: string) => void;
    submit: (options?: any) => any;
    registryEntries: Map<string, any>;
    /** Trigger full component re-render (fallback for option changes without rebuildOptions). */
    rerender: () => void;
}
```

- [ ] **Step 2: Create adapter types**

Create `src/adapters/types.ts`:

```typescript
/** @filedesc Render adapter types for the headless component architecture. */

/**
 * An adapter render function receives a behavior contract and a parent element.
 * It creates DOM, appends to parent, calls behavior.bind(refs), and registers dispose.
 */
export type AdapterRenderFn<B = any> = (behavior: B, parent: HTMLElement, actx: AdapterContext) => void;

/**
 * Context passed to adapter render functions.
 *
 * ADR 0046 defines this as minimal (onDispose only). Extended here with
 * styling helpers that the default adapter needs to reproduce current DOM.
 * External design-system adapters can ignore all but onDispose.
 */
export interface AdapterContext {
    /** Register a cleanup function called when the component is torn down. */
    onDispose(fn: () => void): void;
    /** Apply cssClass from a PresentationBlock or comp descriptor to an element. */
    applyCssClass(el: HTMLElement, comp: any): void;
    /** Apply inline styles with token resolution to an element. */
    applyStyle(el: HTMLElement, style: any): void;
    /** Apply accessibility attributes (role, aria-description, aria-live). */
    applyAccessibility(el: HTMLElement, comp: any): void;
    /** Apply a single class value (string or array) to an element's classList. */
    applyClassValue(el: HTMLElement, classValue: unknown): void;
}

/**
 * A render adapter provides DOM construction functions for component types.
 * Missing entries fall back to the default adapter.
 */
export interface RenderAdapter {
    name: string;
    components: Partial<Record<string, AdapterRenderFn>>;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/formspec-webcomponent/src/behaviors/types.ts packages/formspec-webcomponent/src/adapters/types.ts
git commit -m "feat: add behavior and adapter type definitions for headless component architecture"
```

---

## Task 2: Shared Behavior Helpers

**Files:**
- Create: `packages/formspec-webcomponent/src/behaviors/shared.ts`
- Create: `packages/formspec-webcomponent/tests/behaviors/shared.test.ts`

- [ ] **Step 1: Write tests for shared helpers**

Create `tests/behaviors/shared.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveFieldPath, toFieldId, resolveAndStripTokens } from '../../src/behaviors/shared';

describe('resolveFieldPath', () => {
    it('returns bind key when no prefix', () => {
        expect(resolveFieldPath('name', '')).toBe('name');
    });

    it('joins prefix and bind with dot', () => {
        expect(resolveFieldPath('name', 'group[0]')).toBe('group[0].name');
    });
});

describe('toFieldId', () => {
    it('replaces dots and brackets with hyphens', () => {
        expect(toFieldId('group[0].name')).toBe('field-group-0--name');
    });

    it('handles simple path', () => {
        expect(toFieldId('name')).toBe('field-name');
    });
});

describe('resolveAndStripTokens', () => {
    it('resolves $token references in style values', () => {
        const block = { style: { color: '$token.primary' } };
        const resolve = (v: any) => v === '$token.primary' ? '#007bff' : v;
        const result = resolveAndStripTokens(block as any, resolve);
        expect(result.style).toEqual({ color: '#007bff' });
    });

    it('resolves $token references in cssClass string', () => {
        const block = { cssClass: '$token.fieldClass' };
        const resolve = (v: any) => v === '$token.fieldClass' ? 'usa-input' : v;
        const result = resolveAndStripTokens(block as any, resolve);
        expect(result.cssClass).toBe('usa-input');
    });

    it('resolves $token references in cssClass array', () => {
        const block = { cssClass: ['static', '$token.dynamic'] };
        const resolve = (v: any) => v === '$token.dynamic' ? 'resolved' : v;
        const result = resolveAndStripTokens(block as any, resolve);
        expect(result.cssClass).toEqual(['static', 'resolved']);
    });

    it('passes through non-token values', () => {
        const block = { style: { color: 'red' }, cssClass: 'plain' };
        const resolve = (v: any) => v;
        const result = resolveAndStripTokens(block as any, resolve);
        expect(result.style).toEqual({ color: 'red' });
        expect(result.cssClass).toBe('plain');
    });

    it('preserves other properties unchanged', () => {
        const block = { widget: 'TextInput', labelPosition: 'top' as const, widgetConfig: { rows: 5 } };
        const resolve = (v: any) => v;
        const result = resolveAndStripTokens(block as any, resolve);
        expect(result.widget).toBe('TextInput');
        expect(result.labelPosition).toBe('top');
        expect(result.widgetConfig).toEqual({ rows: 5 });
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/formspec-webcomponent && npx vitest run tests/behaviors/shared.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement shared helpers**

Create `src/behaviors/shared.ts`:

```typescript
/** @filedesc Shared utilities for behavior hooks: path resolution, ID generation, token stripping. */
import { effect, Signal } from '@preact/signals-core';
import type { PresentationBlock } from 'formspec-layout';
import type { ResolvedPresentationBlock, FieldRefs, BehaviorContext } from './types';

/** Build full field path from bind key and prefix. */
export function resolveFieldPath(bind: string, prefix: string): string {
    return prefix ? `${prefix}.${bind}` : bind;
}

/** Convert a dotted field path to a DOM-safe element ID. */
export function toFieldId(fieldPath: string): string {
    return `field-${fieldPath.replace(/[\.\[\]]/g, '-')}`;
}

/**
 * Pre-resolve all $token. references in a PresentationBlock.
 * Adapters receive concrete values only — no token resolution needed.
 */
export function resolveAndStripTokens(
    block: PresentationBlock,
    resolveToken: (v: any) => any
): ResolvedPresentationBlock {
    const resolved: any = { ...block };
    if (resolved.style) {
        resolved.style = Object.fromEntries(
            Object.entries(resolved.style).map(([k, v]) => [k, resolveToken(v)])
        );
    }
    if (resolved.cssClass) {
        resolved.cssClass = Array.isArray(resolved.cssClass)
            ? resolved.cssClass.map((c: any) => resolveToken(c))
            : resolveToken(resolved.cssClass);
    }
    return resolved;
}

/**
 * Wire the shared reactive effects that all field behaviors need:
 * required indicator, validation display, readonly, relevance, touched tracking.
 *
 * Returns an array of dispose functions.
 */
export function bindSharedFieldEffects(
    ctx: BehaviorContext,
    fieldPath: string,
    labelText: string,
    refs: FieldRefs
): Array<() => void> {
    const disposers: Array<() => void> = [];

    // Required indicator
    disposers.push(effect(() => {
        const isRequired = ctx.engine.requiredSignals[fieldPath]?.value ?? false;
        if (isRequired) {
            refs.label.innerHTML = `${labelText} <span class="formspec-required">*</span>`;
        } else {
            refs.label.textContent = labelText;
        }
        refs.control.setAttribute('aria-required', String(isRequired));
    }));

    // Validation display
    disposers.push(effect(() => {
        ctx.touchedVersion.value; // subscribe to touch changes
        const error = ctx.engine.errorSignals[fieldPath]?.value;

        // Shape errors from latest submit (external 1-indexed paths)
        const submitDetail = ctx.latestSubmitDetailSignal?.value;
        const externalPath = fieldPath.replace(/\[(\d+)\]/g, (_, p1) => `[${parseInt(p1) + 1}]`);
        const submitError = submitDetail?.validationReport?.results?.find((r: any) =>
            r.severity === 'error' && (r.path === fieldPath || r.path === externalPath || r.path === `${fieldPath}[*]`)
        )?.message;

        const effectiveError = error || submitError;
        const showError = ctx.touchedFields.has(fieldPath) ? (effectiveError || '') : '';
        if (refs.error) refs.error.textContent = showError;
        refs.control.setAttribute('aria-invalid', String(!!showError));
    }));

    // Readonly
    disposers.push(effect(() => {
        const isReadonly = ctx.engine.readonlySignals[fieldPath]?.value ?? false;
        const target = refs.control.querySelector?.('input') || refs.control.querySelector?.('select') || refs.control.querySelector?.('textarea') || refs.control;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            target.readOnly = isReadonly;
        } else if (target instanceof HTMLSelectElement) {
            target.disabled = isReadonly;
        }
        refs.control.setAttribute('aria-readonly', String(isReadonly));
        refs.root.classList.toggle('formspec-field--readonly', isReadonly);
    }));

    // Relevance
    disposers.push(effect(() => {
        const isRelevant = ctx.engine.relevantSignals[fieldPath]?.value ?? true;
        refs.root.classList.toggle('formspec-hidden', !isRelevant);
        refs.control.setAttribute('aria-hidden', String(!isRelevant));
    }));

    // Touched tracking
    const markTouched = () => {
        if (!ctx.touchedFields.has(fieldPath)) {
            ctx.touchedFields.add(fieldPath);
            ctx.touchedVersion.value += 1;
        }
    };
    refs.root.addEventListener('focusout', markTouched);
    refs.root.addEventListener('change', markTouched);

    return disposers;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/formspec-webcomponent && npx vitest run tests/behaviors/shared.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-webcomponent/src/behaviors/shared.ts packages/formspec-webcomponent/tests/behaviors/shared.test.ts
git commit -m "feat: add shared behavior helpers — path resolution, token stripping, shared field effects"
```

---

## Task 3: Adapter Registry

**Files:**
- Create: `packages/formspec-webcomponent/src/adapters/registry.ts`
- Create: `packages/formspec-webcomponent/tests/adapters/registry.test.ts`
- Modify: `packages/formspec-webcomponent/src/registry.ts`

- [ ] **Step 1: Write adapter registry tests**

Create `tests/adapters/registry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ComponentRegistry } from '../../src/registry';
import type { RenderAdapter } from '../../src/adapters/types';

describe('ComponentRegistry adapter support', () => {
    it('registers and resolves an adapter', () => {
        const reg = new ComponentRegistry();
        const adapter: RenderAdapter = {
            name: 'test',
            components: { TextInput: () => {} },
        };
        reg.registerAdapter(adapter);
        reg.setAdapter('test');
        expect(reg.resolveAdapterFn('TextInput')).toBeDefined();
    });

    it('falls back to default adapter when active adapter lacks component', () => {
        const reg = new ComponentRegistry();
        const defaultAdapter: RenderAdapter = {
            name: 'default',
            components: { TextInput: () => {} },
        };
        const custom: RenderAdapter = {
            name: 'custom',
            components: { Select: () => {} },
        };
        reg.registerAdapter(defaultAdapter);
        reg.registerAdapter(custom);
        reg.setAdapter('custom');
        // TextInput not in custom → falls back to default
        expect(reg.resolveAdapterFn('TextInput')).toBe(defaultAdapter.components.TextInput);
    });

    it('returns undefined when no adapter has the component', () => {
        const reg = new ComponentRegistry();
        const adapter: RenderAdapter = { name: 'default', components: {} };
        reg.registerAdapter(adapter);
        expect(reg.resolveAdapterFn('Unknown')).toBeUndefined();
    });

    it('warns and keeps current adapter when setting unknown name', () => {
        const reg = new ComponentRegistry();
        const adapter: RenderAdapter = { name: 'default', components: {} };
        reg.registerAdapter(adapter);
        reg.setAdapter('nonexistent'); // should warn, not throw
        // activeAdapter stays 'default'
    });

    it('default adapter name is "default"', () => {
        const reg = new ComponentRegistry();
        // Before any adapter is registered, resolveAdapterFn returns undefined
        expect(reg.resolveAdapterFn('TextInput')).toBeUndefined();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/formspec-webcomponent && npx vitest run tests/adapters/registry.test.ts`
Expected: FAIL — methods not found

- [ ] **Step 3: Add adapter support to ComponentRegistry**

Modify `src/registry.ts` to add adapter registration + resolution:

```typescript
/** @filedesc ComponentRegistry class with plugin dispatch and adapter resolution. */
import { ComponentPlugin } from './types';
import type { RenderAdapter, AdapterRenderFn } from './adapters/types';

export class ComponentRegistry {
    private plugins: Map<string, ComponentPlugin> = new Map();
    private adapters: Map<string, RenderAdapter> = new Map();
    private activeAdapter: string = 'default';

    register(plugin: ComponentPlugin) {
        this.plugins.set(plugin.type, plugin);
    }

    get(type: string): ComponentPlugin | undefined {
        return this.plugins.get(type);
    }

    get size(): number {
        return this.plugins.size;
    }

    /** Register a render adapter. The 'default' adapter is always the fallback. */
    registerAdapter(adapter: RenderAdapter): void {
        this.adapters.set(adapter.name, adapter);
    }

    /** Set the active adapter by name. */
    setAdapter(name: string): void {
        if (!this.adapters.has(name)) {
            console.warn(`Adapter '${name}' not registered, keeping current adapter.`);
            return;
        }
        this.activeAdapter = name;
    }

    /** Resolve the render function for a component type. Falls back to default adapter. */
    resolveAdapterFn(componentType: string): AdapterRenderFn | undefined {
        const active = this.adapters.get(this.activeAdapter);
        return active?.components[componentType]
            ?? this.adapters.get('default')?.components[componentType];
    }

    /** Get the name of the currently active adapter. */
    get activeAdapterName(): string {
        return this.activeAdapter;
    }
}

export const globalRegistry = new ComponentRegistry();
```

- [ ] **Step 4: Run new tests + existing registry tests**

Run: `cd packages/formspec-webcomponent && npx vitest run tests/adapters/registry.test.ts tests/registry.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-webcomponent/src/registry.ts packages/formspec-webcomponent/src/adapters/types.ts packages/formspec-webcomponent/tests/adapters/registry.test.ts
git commit -m "feat: add adapter registration and resolution to ComponentRegistry"
```

---

## Task 4: Default Adapter Shared DOM Helpers

**Files:**
- Create: `packages/formspec-webcomponent/src/adapters/default/shared.ts`

These helpers replicate the common DOM patterns from `field-input.ts` (wrapper div, label, hint, description, error display, ID/aria-describedby wiring) so each default adapter component doesn't repeat this boilerplate.

- [ ] **Step 1: Create shared DOM helpers**

Create `src/adapters/default/shared.ts`:

```typescript
/** @filedesc Shared DOM construction helpers for the default render adapter. */
import type { FieldBehavior, ResolvedPresentationBlock } from '../../behaviors/types';
import type { AdapterContext } from '../types';

export interface FieldDOM {
    root: HTMLElement;
    label: HTMLElement;
    hint: HTMLElement | undefined;
    error: HTMLElement;
    describedBy: string[];
}

/**
 * Create the common field wrapper structure: root div, label, description, hint, error.
 * Uses behavior.widgetClassSlots for x-classes support (from theme widgetConfig).
 * Returns element references for adapter-specific control insertion.
 */
export function createFieldDOM(
    behavior: FieldBehavior,
    actx: AdapterContext,
): FieldDOM {
    const p = behavior.presentation;
    const slots = behavior.widgetClassSlots;
    const fieldId = behavior.id;
    const hintId = `${fieldId}-hint`;
    const errorId = `${fieldId}-error`;
    const describedBy: string[] = [];

    const root = document.createElement('div');
    root.className = 'formspec-field';
    root.dataset.name = behavior.fieldPath;
    if (slots.root) actx.applyClassValue(root, slots.root);

    const effectiveLabelPosition = p.labelPosition || 'top';

    const label = document.createElement('label');
    label.className = 'formspec-label';
    label.textContent = behavior.label;
    label.htmlFor = fieldId;
    if (slots.label) actx.applyClassValue(label, slots.label);

    if (effectiveLabelPosition === 'hidden') {
        label.classList.add('formspec-sr-only');
    } else if (effectiveLabelPosition === 'start') {
        root.classList.add('formspec-field--inline');
    }

    root.appendChild(label);

    if (behavior.description) {
        const desc = document.createElement('div');
        desc.className = 'formspec-description';
        desc.textContent = behavior.description;
        root.appendChild(desc);
    }

    let hint: HTMLElement | undefined;
    if (behavior.hint) {
        hint = document.createElement('div');
        hint.className = 'formspec-hint';
        hint.id = hintId;
        hint.textContent = behavior.hint;
        if (slots.hint) actx.applyClassValue(hint, slots.hint);
        root.appendChild(hint);
        describedBy.push(hintId);
    }

    const error = document.createElement('div');
    error.className = 'formspec-error';
    error.id = errorId;
    error.setAttribute('role', 'alert');
    error.setAttribute('aria-live', 'polite');
    if (slots.error) actx.applyClassValue(error, slots.error);
    describedBy.push(errorId);

    return { root, label, hint, error, describedBy };
}

/**
 * Finalize field DOM: append remote options status, error display, and apply theme styles.
 * Call this AFTER inserting the control element.
 */
export function finalizeFieldDOM(
    fieldDOM: FieldDOM,
    behavior: FieldBehavior,
    actx: AdapterContext,
): void {
    // Remote options loading/error status (from field-input.ts lines 382-393)
    const ros = behavior.remoteOptionsState;
    if (ros.loading || ros.error) {
        const status = document.createElement('div');
        status.className = 'formspec-hint formspec-remote-options-status';
        if (ros.loading) {
            status.textContent = 'Loading options...';
        } else if (ros.error) {
            status.textContent = behavior.options().length > 0
                ? 'Remote options unavailable; using fallback options.'
                : 'Failed to load options.';
        }
        fieldDOM.root.appendChild(status);
    }

    fieldDOM.root.appendChild(fieldDOM.error);

    // Theme cascade styles
    actx.applyCssClass(fieldDOM.root, behavior.presentation);
    actx.applyStyle(fieldDOM.root, behavior.presentation.style);
    actx.applyAccessibility(fieldDOM.root, behavior.presentation);

    // Component-level overrides (extracted by behavior hook, not raw comp)
    if (behavior.compOverrides.accessibility) {
        actx.applyAccessibility(fieldDOM.root, behavior.compOverrides);
    }
    if (behavior.compOverrides.cssClass) {
        actx.applyCssClass(fieldDOM.root, behavior.compOverrides);
    }
    if (behavior.compOverrides.style) {
        actx.applyStyle(fieldDOM.root, behavior.compOverrides.style);
    }
}

/**
 * Apply widgetClassSlots.control to the actual input element(s).
 * For radio/checkbox groups, applies to each input. For others, applies to the control.
 */
export function applyControlSlotClass(
    control: HTMLElement,
    behavior: FieldBehavior,
    actx: AdapterContext,
    isGroup: boolean = false,
): void {
    const controlSlot = behavior.widgetClassSlots.control;
    if (!controlSlot) return;
    if (isGroup) {
        control.querySelectorAll('input').forEach(el => actx.applyClassValue(el, controlSlot));
    } else {
        const target = control.querySelector('input') || control.querySelector('select') || control.querySelector('textarea') || control;
        if (target instanceof HTMLElement) actx.applyClassValue(target, controlSlot);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/formspec-webcomponent/src/adapters/default/shared.ts
git commit -m "feat: add shared DOM helpers for default adapter field construction"
```

---

## Task 5: Extract TextInput — Behavior Hook + Default Adapter

This is the reference implementation. All subsequent component extractions follow this pattern.

**Files:**
- Create: `packages/formspec-webcomponent/src/behaviors/text-input.ts`
- Create: `packages/formspec-webcomponent/src/adapters/default/text-input.ts`
- Create: `packages/formspec-webcomponent/tests/behaviors/text-input.test.ts`

- [ ] **Step 1: Write behavior hook test**

Create `tests/behaviors/text-input.test.ts`. Test the behavior contract — not DOM (that's the adapter's job). Use a real FormEngine with a minimal definition:

```typescript
import { describe, it, expect, beforeAll, afterEach } from 'vitest';

let useTextInput: any;
let singleFieldDef: any;
let FormEngine: any;

beforeAll(async () => {
    const behaviorMod = await import('../../src/behaviors/text-input');
    useTextInput = behaviorMod.useTextInput;
    const engineMod = await import('formspec-engine');
    FormEngine = engineMod.FormEngine;
    const fixtures = await import('../helpers/engine-fixtures');
    singleFieldDef = fixtures.singleFieldDef;
});

function makeBehaviorContext(def: any) {
    const { signal } = require('@preact/signals-core');
    const engine = new FormEngine();
    engine.setDefinition(def);
    return {
        engine,
        prefix: '',
        cleanupFns: [] as Array<() => void>,
        touchedFields: new Set<string>(),
        touchedVersion: signal(0),
        latestSubmitDetailSignal: signal(null),
        resolveToken: (v: any) => v,
        resolveItemPresentation: () => ({}),
        findItemByKey: (key: string) => def.items.find((i: any) => i.key === key) || null,
        renderComponent: () => {},
        submit: () => null,
        registryEntries: new Map(),
    };
}

describe('useTextInput', () => {
    it('returns a FieldBehavior with correct fieldPath and label', () => {
        const def = singleFieldDef({ label: 'Full Name' });
        const ctx = makeBehaviorContext(def);
        const comp = { component: 'TextInput', bind: 'name' };
        const behavior = useTextInput(ctx, comp);
        expect(behavior.fieldPath).toBe('name');
        expect(behavior.label).toBe('Full Name');
        expect(behavior.id).toBe('field-name');
        expect(behavior.options()).toEqual([]);
    });

    it('uses labelOverride when provided', () => {
        const def = singleFieldDef({ label: 'Full Name' });
        const ctx = makeBehaviorContext(def);
        const comp = { component: 'TextInput', bind: 'name', labelOverride: 'Your Name' };
        const behavior = useTextInput(ctx, comp);
        expect(behavior.label).toBe('Your Name');
    });

    it('extracts hint from comp or item', () => {
        const def = singleFieldDef({ hint: 'Enter your name' });
        const ctx = makeBehaviorContext(def);
        const comp = { component: 'TextInput', bind: 'name' };
        const behavior = useTextInput(ctx, comp);
        expect(behavior.hint).toBe('Enter your name');
    });

    it('extracts TextInput-specific props', () => {
        const def = singleFieldDef();
        const ctx = makeBehaviorContext(def);
        const comp = { component: 'TextInput', bind: 'name', placeholder: 'Type here', maxLines: 3, prefix: '$', suffix: '.00' };
        const behavior = useTextInput(ctx, comp);
        expect(behavior.placeholder).toBe('Type here');
        expect(behavior.maxLines).toBe(3);
        expect(behavior.prefix).toBe('$');
        expect(behavior.suffix).toBe('.00');
    });

    it('bind() returns a dispose function', () => {
        const def = singleFieldDef();
        const ctx = makeBehaviorContext(def);
        const comp = { component: 'TextInput', bind: 'name' };
        const behavior = useTextInput(ctx, comp);

        const refs = {
            root: document.createElement('div'),
            label: document.createElement('label'),
            control: document.createElement('input'),
            error: document.createElement('div'),
        };

        const dispose = behavior.bind(refs);
        expect(typeof dispose).toBe('function');
        dispose();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/formspec-webcomponent && npx vitest run tests/behaviors/text-input.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement useTextInput behavior hook**

Create `src/behaviors/text-input.ts`:

```typescript
/** @filedesc TextInput behavior hook — extracts reactive state for text/textarea fields. */
import { effect } from '@preact/signals-core';
import type { TextInputBehavior, FieldRefs, BehaviorContext } from './types';
import { resolveFieldPath, toFieldId, resolveAndStripTokens, bindSharedFieldEffects } from './shared';

export function useTextInput(ctx: BehaviorContext, comp: any): TextInputBehavior {
    const fieldPath = resolveFieldPath(comp.bind, ctx.prefix);
    const id = comp.id || toFieldId(fieldPath);
    const item = ctx.findItemByKey(comp.bind);
    const presentation = resolveAndStripTokens(
        ctx.resolveItemPresentation({ key: item?.key || comp.bind, type: 'field', dataType: item?.dataType || 'string' }),
        ctx.resolveToken
    );

    // Resolve extension-driven input attributes
    const extensionAttrs: Record<string, string> = {};
    let resolvedInputType: string | undefined;
    const exts = item?.extensions;
    if (exts && typeof exts === 'object') {
        for (const [extName, extEnabled] of Object.entries(exts)) {
            if (!extEnabled) continue;
            const entry = ctx.registryEntries.get(extName);
            if (!entry) continue;
            const meta = entry.metadata;
            const constraints = entry.constraints;
            if (meta?.inputType) {
                resolvedInputType = meta.inputType;
            } else if (meta?.inputMode === 'email') {
                resolvedInputType = 'email';
            } else if (meta?.inputMode === 'tel') {
                resolvedInputType = 'tel';
            }
            if (meta?.inputMode && !comp.inputMode) extensionAttrs.inputMode = meta.inputMode;
            if (meta?.autocomplete) extensionAttrs.autocomplete = meta.autocomplete;
            if (meta?.sensitive) extensionAttrs.autocomplete = 'off';
            if (constraints?.maxLength != null) extensionAttrs.maxLength = String(constraints.maxLength);
            if (constraints?.pattern) extensionAttrs.pattern = constraints.pattern;
            if (meta?.mask && !comp.placeholder) extensionAttrs.placeholder = meta.mask;
        }
    }

    // Compute widget class slots for x-classes support
    const widgetClassSlots = ctx.resolveWidgetClassSlots(
        ctx.resolveItemPresentation({ key: item?.key || comp.bind, type: 'field', dataType: item?.dataType || 'string' })
    );

    // Remote options state (TextInput doesn't use options, but interface requires it)
    const remoteOptionsState = { loading: false, error: null as string | null };

    return {
        fieldPath,
        id,
        label: comp.labelOverride || item?.label || item?.key || comp.bind,
        hint: comp.hintOverride || item?.hint || null,
        description: item?.description || null,
        presentation,
        widgetClassSlots,
        compOverrides: {
            cssClass: comp.cssClass,
            style: comp.style,
            accessibility: comp.accessibility,
        },
        remoteOptionsState,
        options: () => [],
        placeholder: comp.placeholder,
        inputMode: comp.inputMode,
        maxLines: comp.maxLines,
        prefix: comp.prefix,
        suffix: comp.suffix,
        resolvedInputType,
        extensionAttrs,

        bind(refs: FieldRefs): () => void {
            const disposers = bindSharedFieldEffects(ctx, fieldPath, this.label, refs);

            // Value sync: engine → DOM
            const bindableInput = refs.control.querySelector('input') || refs.control.querySelector('textarea') || refs.control;
            disposers.push(effect(() => {
                const sig = ctx.engine.signals[fieldPath];
                if (!sig) return;
                const val = sig.value;
                if (document.activeElement !== bindableInput) {
                    (bindableInput as HTMLInputElement).value = val ?? '';
                }
            }));

            // Value sync: DOM → engine
            const eventTarget = refs.control.querySelector('input') || refs.control.querySelector('textarea') || refs.control;
            eventTarget.addEventListener('input', (e) => {
                ctx.engine.setValue(fieldPath, (e.target as HTMLInputElement).value);
            });

            return () => disposers.forEach(d => d());
        }
    };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/formspec-webcomponent && npx vitest run tests/behaviors/text-input.test.ts`
Expected: PASS

- [ ] **Step 5: Create default TextInput adapter**

Create `src/adapters/default/text-input.ts`:

```typescript
/** @filedesc Default adapter for TextInput — reproduces current DOM structure. */
import type { TextInputBehavior } from '../../behaviors/types';
import type { AdapterRenderFn, AdapterContext } from '../types';
import { createFieldDOM, finalizeFieldDOM, applyControlSlotClass } from './shared';

export const renderTextInput: AdapterRenderFn<TextInputBehavior> = (
    behavior, parent, actx
) => {
    const fieldDOM = createFieldDOM(behavior, actx);
    const p = behavior.presentation;

    let control: HTMLElement;

    if (behavior.maxLines && behavior.maxLines > 1) {
        // Textarea variant
        const textarea = document.createElement('textarea');
        textarea.className = 'formspec-input';
        textarea.name = behavior.fieldPath;
        textarea.rows = behavior.maxLines;
        if (behavior.placeholder) textarea.placeholder = behavior.placeholder;
        textarea.id = behavior.id;
        textarea.setAttribute('aria-describedby', fieldDOM.describedBy.join(' '));
        control = textarea;
    } else if (behavior.prefix || behavior.suffix) {
        // Prefix/suffix wrapper variant
        const wrapper = document.createElement('div');
        wrapper.className = 'formspec-input-wrapper';

        if (behavior.prefix) {
            const prefixEl = document.createElement('span');
            prefixEl.className = 'formspec-prefix';
            prefixEl.textContent = behavior.prefix;
            wrapper.appendChild(prefixEl);
        }

        const input = document.createElement('input');
        input.type = behavior.resolvedInputType || 'text';
        input.className = 'formspec-input';
        input.name = behavior.fieldPath;
        input.id = behavior.id;
        if (behavior.placeholder) input.placeholder = behavior.placeholder;
        if (behavior.inputMode) input.inputMode = behavior.inputMode;
        // Apply extension attributes
        for (const [attr, val] of Object.entries(behavior.extensionAttrs)) {
            if (attr === 'inputMode') input.inputMode = val;
            else if (attr === 'maxLength') input.maxLength = Number(val);
            else input.setAttribute(attr, val);
        }
        input.setAttribute('aria-describedby', fieldDOM.describedBy.join(' '));
        wrapper.appendChild(input);

        if (behavior.suffix) {
            const suffixEl = document.createElement('span');
            suffixEl.className = 'formspec-suffix';
            suffixEl.textContent = behavior.suffix;
            wrapper.appendChild(suffixEl);
        }

        control = wrapper;
    } else {
        // Standard input
        const input = document.createElement('input');
        input.type = behavior.resolvedInputType || 'text';
        input.className = 'formspec-input';
        input.name = behavior.fieldPath;
        input.id = behavior.id;
        if (behavior.placeholder) input.placeholder = behavior.placeholder;
        if (behavior.inputMode) input.inputMode = behavior.inputMode;
        // Apply extension attributes
        for (const [attr, val] of Object.entries(behavior.extensionAttrs)) {
            if (attr === 'inputMode') input.inputMode = val;
            else if (attr === 'maxLength') input.maxLength = Number(val);
            else input.setAttribute(attr, val);
        }
        input.setAttribute('aria-describedby', fieldDOM.describedBy.join(' '));
        control = input;
    }

    fieldDOM.root.appendChild(control);
    applyControlSlotClass(control, behavior, actx);
    finalizeFieldDOM(fieldDOM, behavior, actx);
    parent.appendChild(fieldDOM.root);

    const dispose = behavior.bind({
        root: fieldDOM.root,
        label: fieldDOM.label,
        control,
        hint: fieldDOM.hint,
        error: fieldDOM.error,
    });
    actx.onDispose(dispose);
};
```

**Design note:** Component-level style/class/accessibility overrides are extracted by the behavior hook into `compOverrides` — a clean struct. No raw `comp` object is leaked to adapters. The `finalizeFieldDOM` shared helper applies these overrides using the same `applyCssClass`/`applyStyle`/`applyAccessibility` methods, but from the extracted properties.

- [ ] **Step 6: Run all existing tests**

Run: `cd packages/formspec-webcomponent && npx vitest run`
Expected: ALL PASS (we haven't changed any existing code yet, only added new files)

- [ ] **Step 7: Commit**

```bash
git add packages/formspec-webcomponent/src/behaviors/text-input.ts packages/formspec-webcomponent/src/adapters/default/text-input.ts packages/formspec-webcomponent/tests/behaviors/text-input.test.ts packages/formspec-webcomponent/src/behaviors/types.ts
git commit -m "feat: TextInput behavior hook and default adapter — reference implementation"
```

---

## Task 6: Extract All Group A Components (field-input.ts)

Follow the same pattern as Task 5 for each component. Each component gets:
1. A behavior hook in `src/behaviors/<name>.ts`
2. A default adapter in `src/adapters/default/<name>.ts`

The behavior hook extracts static properties + implements `bind()` with component-specific value sync. The default adapter reproduces the current DOM from `field-input.ts`.

**Files (per component):**
- Create: `src/behaviors/<name>.ts`
- Create: `src/adapters/default/<name>.ts`

### Group A components and their value sync patterns:

| Component | Value sync pattern | Key behaviors |
|-----------|-------------------|---------------|
| NumberInput | `input` event → `Number(target.value)`, min/max clamping | `step`, `min`, `max` attrs |
| RadioGroup | Per-option `change` → `setValue(rb.value)`, engine→DOM checks each radio | `role="radiogroup"`, orientation |
| CheckboxGroup | Per-option `change` → collect checked values as array | Optional selectAll, columns |
| Select | `change` event → `target.value` | Placeholder, clearable options |
| Toggle | `input` on checkbox → `target.checked`, toggle label text swap | `onLabel`/`offLabel` |
| Checkbox | `input` on checkbox → `target.checked` | Simple boolean |
| DatePicker | `input` event → `target.value`, type resolution (date/time/datetime-local) | `minDate`/`maxDate`, `showTime` |
| MoneyInput | Compound: amount input + currency input/badge → `{ amount, currency }` | Resolved currency, min/max clamping, 2-decimal rounding |

- [ ] **Step 1: Create NumberInput behavior + adapter**

`src/behaviors/number-input.ts` — value coercion: string→number, min/max clamping, null for empty.
`src/adapters/default/number-input.ts` — `<input type="number">` with step/min/max.

- [ ] **Step 2: Create RadioGroup behavior + adapter**

`src/behaviors/radio-group.ts` — extends FieldBehavior with `groupRole`, `inputName`. See skeleton below.
`src/adapters/default/radio-group.ts` — `<div role="radiogroup">` with `<label><input type="radio"> text</label>` per option.

**RadioGroup behavior skeleton** (this is the reference for all choice components):

```typescript
// src/behaviors/radio-group.ts
import { effect } from '@preact/signals-core';
import type { RadioGroupBehavior, FieldRefs, BehaviorContext } from './types';
import { resolveFieldPath, toFieldId, resolveAndStripTokens, bindSharedFieldEffects } from './shared';

export function useRadioGroup(ctx: BehaviorContext, comp: any): RadioGroupBehavior {
    const fieldPath = resolveFieldPath(comp.bind, ctx.prefix);
    const id = comp.id || toFieldId(fieldPath);
    const item = ctx.findItemByKey(comp.bind);
    const itemDesc = { key: item?.key || comp.bind, type: 'field' as const, dataType: item?.dataType || 'choice' };
    const rawPresentation = ctx.resolveItemPresentation(itemDesc);
    const presentation = resolveAndStripTokens(rawPresentation, ctx.resolveToken);
    const widgetClassSlots = ctx.resolveWidgetClassSlots(rawPresentation);

    // Remote options: watch signal and trigger re-render on change
    const optionSignal = ctx.engine.getOptionsSignal?.(fieldPath);
    const optionStateSignal = ctx.engine.getOptionsStateSignal?.(fieldPath);
    if (optionSignal || optionStateSignal) {
        let initialized = false;
        ctx.cleanupFns.push(effect(() => {
            optionSignal?.value;
            optionStateSignal?.value;
            if (!initialized) { initialized = true; return; }
            ctx.rerender();
        }));
    }
    const currentOptions = ctx.engine.getOptions?.(fieldPath) || item?.options || [];
    const remoteState = ctx.engine.getOptionsState?.(fieldPath) || { loading: false, error: null };

    return {
        fieldPath, id,
        label: comp.labelOverride || item?.label || item?.key || comp.bind,
        hint: comp.hintOverride || item?.hint || null,
        description: item?.description || null,
        presentation, widgetClassSlots,
        compOverrides: { cssClass: comp.cssClass, style: comp.style, accessibility: comp.accessibility },
        remoteOptionsState: remoteState,
        groupRole: 'radiogroup',
        inputName: fieldPath,
        orientation: comp.orientation,
        options: () => currentOptions,

        bind(refs: FieldRefs): () => void {
            const disposers = bindSharedFieldEffects(ctx, fieldPath, this.label, refs);

            // Engine → DOM: sync checked state on each radio
            disposers.push(effect(() => {
                const sig = ctx.engine.signals[fieldPath];
                if (!sig) return;
                const val = sig.value;
                if (refs.optionControls) {
                    for (const [optVal, radio] of refs.optionControls) {
                        radio.checked = optVal === String(val ?? '');
                    }
                }
            }));

            // DOM → Engine: register change listeners on each option control
            if (refs.optionControls) {
                for (const [optVal, radio] of refs.optionControls) {
                    radio.addEventListener('change', () => {
                        ctx.engine.setValue(fieldPath, radio.value);
                    });
                }
            }

            return () => disposers.forEach(d => d());
        }
    };
}
```

**Key patterns for choice components (RadioGroup, CheckboxGroup, Select):**
- Watch `optionSignal` / `optionStateSignal` via effect — call `ctx.rerender()` on change (current field-input.ts behavior, lines 39-52)
- Expose `remoteOptionsState` from `engine.getOptionsState()`
- `options()` returns current snapshot from `engine.getOptions()` with fallback to `item.options`
- `bind()` registers change listeners on `refs.optionControls` (radio/checkbox) or `refs.control` (select)

- [ ] **Step 3: Create CheckboxGroup behavior + adapter**

`src/behaviors/checkbox-group.ts` — bind() collects checked values as array. selectAll checkbox wiring.
`src/adapters/default/checkbox-group.ts` — `<div>` with checkboxes, optional selectAll.

Same remote options pattern as RadioGroup. The selectAll checkbox is an adapter concern (DOM), but its change handler must call through to engine. The simplest approach: the adapter creates the selectAll checkbox and registers a single click handler that reads all checkbox states and calls a `setValue` function exposed on the behavior.

Add `setValue(val: any): void` to `CheckboxGroupBehavior` — a thin wrapper around `ctx.engine.setValue(fieldPath, val)`.

- [ ] **Step 4: Create Select behavior + adapter**

`src/behaviors/select.ts` — bind() syncs via `change` event on `<select>`.
`src/adapters/default/select.ts` — `<select>` with placeholder/clearable options.

- [ ] **Step 5: Create Toggle behavior + adapter**

`src/behaviors/toggle.ts` — bind() syncs `.checked`, swaps onLabel/offLabel text via effect.
`src/adapters/default/toggle.ts` — Checkbox wrapped in `.formspec-toggle` div with toggle label span.

**GOTCHA — Toggle/Checkbox label position:** When `componentType === 'Toggle'` or `'Checkbox'` AND `labelPosition === 'top'` (the default), the current code adds `formspec-field--inline` to the wrapper (field-input.ts line 82-84). The default adapter MUST reproduce this: in `createFieldDOM`, if the behavior is Toggle or Checkbox AND labelPosition is 'top', add `formspec-field--inline`. The simplest approach: have the Toggle/Checkbox behavior hooks set `presentation.labelPosition = 'start'` when the original is 'top', so `createFieldDOM` adds the inline class naturally.

- [ ] **Step 6: Create Checkbox behavior + adapter**

`src/behaviors/checkbox.ts` — bind() syncs `.checked` boolean.
`src/adapters/default/checkbox.ts` — Simple `<input type="checkbox">`.
Same label position gotcha as Toggle above.

- [ ] **Step 7: Create DatePicker behavior + adapter**

`src/behaviors/date-picker.ts` — Resolves input type from dataType + showTime.
`src/adapters/default/date-picker.ts` — `<input type="date|time|datetime-local">` with min/max.

- [ ] **Step 8: Create MoneyInput behavior + adapter**

`src/behaviors/money-input.ts` — Compound value sync: `{ amount, currency }`. Two inputs or input + badge.
`src/adapters/default/money-input.ts` — `.formspec-money` div with amount input + currency element.

**MoneyInput behavior skeleton** (compound value, most complex field type):

```typescript
// src/behaviors/money-input.ts
import { effect } from '@preact/signals-core';
import type { MoneyInputBehavior, FieldRefs, BehaviorContext } from './types';
import { resolveFieldPath, toFieldId, resolveAndStripTokens, bindSharedFieldEffects } from './shared';

export function useMoneyInput(ctx: BehaviorContext, comp: any): MoneyInputBehavior {
    const fieldPath = resolveFieldPath(comp.bind, ctx.prefix);
    const id = comp.id || toFieldId(fieldPath);
    const item = ctx.findItemByKey(comp.bind);
    const itemDesc = { key: item?.key || comp.bind, type: 'field' as const, dataType: 'money' };
    const rawPresentation = ctx.resolveItemPresentation(itemDesc);
    const presentation = resolveAndStripTokens(rawPresentation, ctx.resolveToken);
    const widgetClassSlots = ctx.resolveWidgetClassSlots(rawPresentation);

    // Resolve currency: item.currency > definition defaultCurrency > null
    const definition = ctx.engine.getDefinition?.() as any;
    const resolvedCurrency = item?.currency || definition?.formPresentation?.defaultCurrency || null;

    return {
        fieldPath, id,
        label: comp.labelOverride || item?.label || item?.key || comp.bind,
        hint: comp.hintOverride || item?.hint || null,
        description: item?.description || null,
        presentation, widgetClassSlots,
        compOverrides: { cssClass: comp.cssClass, style: comp.style, accessibility: comp.accessibility },
        remoteOptionsState: { loading: false, error: null },
        options: () => [],
        min: comp.min, max: comp.max, step: comp.step,
        placeholder: comp.placeholder || 'Amount',
        resolvedCurrency,

        bind(refs: FieldRefs): () => void {
            const disposers = bindSharedFieldEffects(ctx, fieldPath, this.label, refs);

            // Money has TWO inputs: amount + currency.
            // The adapter creates these as children of refs.control.
            // bind() finds them by class name convention.
            const amountInput = refs.control.querySelector('.formspec-input') as HTMLInputElement;
            const currencyInput = refs.control.querySelector('.formspec-money-currency-input') as HTMLInputElement | null;

            const getCurrency = (): string => {
                if (resolvedCurrency) return resolvedCurrency;
                return currencyInput?.value || '';
            };

            // Amount → engine
            if (amountInput) {
                amountInput.addEventListener('input', () => {
                    let amount = amountInput.value === '' ? null : Number(amountInput.value);
                    if (amount !== null && !isNaN(amount)) {
                        if (comp.min !== undefined && amount < Number(comp.min)) amount = Number(comp.min);
                        if (comp.max !== undefined && amount > Number(comp.max)) amount = Number(comp.max);
                    }
                    ctx.engine.setValue(fieldPath, { amount, currency: getCurrency() });
                });
            }

            // Currency → engine (only when no resolved currency — editable input)
            if (currencyInput) {
                currencyInput.addEventListener('input', () => {
                    const amount = amountInput?.value === '' ? null : Number(amountInput?.value);
                    ctx.engine.setValue(fieldPath, { amount, currency: currencyInput.value });
                });

                // Engine → currency input
                disposers.push(effect(() => {
                    const sig = ctx.engine.signals[fieldPath];
                    if (!sig) return;
                    const v = sig.value;
                    if (document.activeElement !== currencyInput && v != null && typeof v === 'object' && 'currency' in v) {
                        currencyInput.value = (v as any).currency || '';
                    }
                }));
            }

            // Engine → amount input (with 2-decimal rounding)
            if (amountInput) {
                disposers.push(effect(() => {
                    const sig = ctx.engine.signals[fieldPath];
                    if (!sig) return;
                    const v = sig.value;
                    if (document.activeElement !== amountInput) {
                        if (v !== null && v !== undefined && typeof v === 'object' && 'amount' in v) {
                            const a = v.amount;
                            amountInput.value = a !== null && a !== undefined
                                ? String(Math.round(a * 100) / 100) : '';
                        } else if (typeof v === 'number') {
                            amountInput.value = String(Math.round(v * 100) / 100);
                        }
                    }
                }));
            }

            return () => disposers.forEach(d => d());
        }
    };
}
```

**Key MoneyInput patterns:**
- Compound value: `{ amount: number | null, currency: string }`
- Two sync paths: amount input + optional currency input
- Currency can be fixed (badge) or editable (input) — resolved by behavior, rendered by adapter
- 2-decimal rounding on engine→DOM sync: `Math.round(a * 100) / 100`
- Min/max clamping on DOM→engine sync

- [ ] **Step 9: Run full test suite to verify no regressions**

Run: `cd packages/formspec-webcomponent && npx vitest run`
Expected: ALL PASS (still haven't changed existing code)

- [ ] **Step 10: Commit**

```bash
git add packages/formspec-webcomponent/src/behaviors/ packages/formspec-webcomponent/src/adapters/default/
git commit -m "feat: behavior hooks and default adapters for all Group A field components"
```

---

## Task 7: Extract Group B Components (inputs.ts inline plugins)

Same pattern. These currently build DOM + signals inline in their plugin render functions.

| Component | Source | Key behaviors |
|-----------|--------|---------------|
| Slider | `inputs.ts:114-192` | Range input, ticks datalist, value display |
| Rating | `inputs.ts:210-279` | Click-based icon rating with half-step |
| FileUpload | `inputs.ts:286-354` | File input with drag-drop zone |
| Signature | `inputs.ts:361-445` | Canvas drawing with ResizeObserver |

- [ ] **Step 1: Create Slider behavior + adapter**

`src/behaviors/slider.ts` — bind() syncs range input, updates value display span.
`src/adapters/default/slider.ts` — range input + datalist + value display.

- [ ] **Step 2: Create Rating behavior + adapter**

`src/behaviors/rating.ts` — bind() syncs star selection classes. Click handler with half-step.
`src/adapters/default/rating.ts` — Star spans with click handlers.

Note: Rating is unique — the click handler for setting value is part of the adapter (it determines where the click lands on the star), but the value sync to engine is owned by bind(). This means the adapter must call a callback rather than directly setting engine value. Add a `setValue(value: number): void` method to RatingBehavior that adapters call on click.

- [ ] **Step 3: Create FileUpload behavior + adapter**

`src/behaviors/file-upload.ts` — bind() mostly handles relevance. File change handler stores metadata.
`src/adapters/default/file-upload.ts` — File input with optional drag-drop zone.

- [ ] **Step 4: Create Signature behavior + adapter**

`src/behaviors/signature.ts` — bind() handles relevance. Canvas drawing + clear are adapter concerns, but value sync (toDataURL → engine) goes through bind().
`src/adapters/default/signature.ts` — Canvas with mouse events, clear button.

- [ ] **Step 5: Run full test suite**

Run: `cd packages/formspec-webcomponent && npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add packages/formspec-webcomponent/src/behaviors/ packages/formspec-webcomponent/src/adapters/default/
git commit -m "feat: behavior hooks and default adapters for Group B inline input components"
```

---

## Task 8: Default Adapter Registration + Barrel Exports

**Files:**
- Create: `packages/formspec-webcomponent/src/adapters/default/index.ts`
- Create: `packages/formspec-webcomponent/src/adapters/index.ts`
- Create: `packages/formspec-webcomponent/src/behaviors/index.ts`

- [ ] **Step 1: Create default adapter index**

`src/adapters/default/index.ts` — import all default adapter render functions, export as `RenderAdapter`:

```typescript
/** @filedesc Default render adapter — reproduces the current DOM output. */
import type { RenderAdapter } from '../types';
import { renderTextInput } from './text-input';
import { renderNumberInput } from './number-input';
import { renderRadioGroup } from './radio-group';
import { renderCheckboxGroup } from './checkbox-group';
import { renderSelect } from './select';
import { renderToggle } from './toggle';
import { renderCheckbox } from './checkbox';
import { renderDatePicker } from './date-picker';
import { renderMoneyInput } from './money-input';
import { renderSlider } from './slider';
import { renderRating } from './rating';
import { renderFileUpload } from './file-upload';
import { renderSignature } from './signature';

export const defaultAdapter: RenderAdapter = {
    name: 'default',
    components: {
        TextInput: renderTextInput,
        NumberInput: renderNumberInput,
        RadioGroup: renderRadioGroup,
        CheckboxGroup: renderCheckboxGroup,
        Select: renderSelect,
        Toggle: renderToggle,
        Checkbox: renderCheckbox,
        DatePicker: renderDatePicker,
        MoneyInput: renderMoneyInput,
        Slider: renderSlider,
        Rating: renderRating,
        FileUpload: renderFileUpload,
        Signature: renderSignature,
    },
};
```

- [ ] **Step 2: Create barrel exports**

`src/adapters/index.ts`:
```typescript
/** @filedesc Barrel export for adapter types and default adapter. */
export type { RenderAdapter, AdapterRenderFn, AdapterContext } from './types';
export { defaultAdapter } from './default/index';
```

`src/behaviors/index.ts`:
```typescript
/** @filedesc Barrel export for behavior hooks and types. */
export type { FieldBehavior, FieldRefs, ResolvedPresentationBlock, BehaviorContext } from './types';
export * from './shared';
export { useTextInput } from './text-input';
export { useNumberInput } from './number-input';
export { useRadioGroup } from './radio-group';
export { useCheckboxGroup } from './checkbox-group';
export { useSelect } from './select';
export { useToggle } from './toggle';
export { useCheckbox } from './checkbox';
export { useDatePicker } from './date-picker';
export { useMoneyInput } from './money-input';
export { useSlider } from './slider';
export { useRating } from './rating';
export { useFileUpload } from './file-upload';
export { useSignature } from './signature';
```

- [ ] **Step 3: Commit**

```bash
git add packages/formspec-webcomponent/src/adapters/ packages/formspec-webcomponent/src/behaviors/index.ts
git commit -m "feat: default adapter registration and barrel exports"
```

---

## Task 9: Wire Plugins as Orchestrators

This is the critical integration step. Convert each input plugin from delegating to `renderInputComponent` / inline DOM to the new pattern: call behavior hook → resolve adapter → call adapter.

**Files:**
- Modify: `packages/formspec-webcomponent/src/components/inputs.ts`
- Modify: `packages/formspec-webcomponent/src/rendering/emit-node.ts`

- [ ] **Step 1: Register default adapter at module load**

In `src/components/index.ts` (where `registerDefaultComponents` lives), add:

```typescript
import { defaultAdapter } from '../adapters/default/index';
import { globalRegistry } from '../registry';

// After registering all plugins:
globalRegistry.registerAdapter(defaultAdapter);
```

- [ ] **Step 2: Add adapter context builder to emit-node.ts**

In `renderActualComponent` in `emit-node.ts`, build an `AdapterContext` alongside `RenderContext`:

```typescript
import type { AdapterContext } from '../adapters/types';

// Inside renderActualComponent, after building ctx:
const adapterCtx: AdapterContext = {
    onDispose: (fn: () => void) => host.cleanupFns.push(fn),
    applyCssClass: (el, comp) => host.applyCssClass(el, comp),
    applyStyle: (el, style) => host.applyStyle(el, style),
    applyAccessibility: (el, comp) => host.applyAccessibility(el, comp),
    applyClassValue: (el, classValue) => host.applyClassValue(el, classValue),
};
```

Pass both `ctx` and `adapterCtx` to plugins. The simplest way: add `adapterContext` to `RenderContext`.

- [ ] **Step 3: Add `_registryEntries` and `resolveWidgetClassSlots` to `RenderHost`**

The `RenderHost` interface in `emit-node.ts` must be updated to include properties that `BehaviorContext` needs:

```typescript
// Add to RenderHost interface in emit-node.ts:
_registryEntries: Map<string, any>;
resolveWidgetClassSlots(presentation: PresentationBlock): {
    root?: unknown; label?: unknown; control?: unknown; hint?: unknown; error?: unknown;
};
```

These already exist on the `FormspecRender` element class — the interface just needs to declare them.

- [ ] **Step 4: Add `BehaviorContext` builder**

Build `BehaviorContext` inline in `renderActualComponent`. This is a subset of what the host provides:

```typescript
import type { BehaviorContext } from '../behaviors/types';

// Inside renderActualComponent, after building adapterCtx:
const behaviorCtx: BehaviorContext = {
    engine: host.engine,
    prefix,
    cleanupFns: host.cleanupFns,
    touchedFields: host.touchedFields,
    touchedVersion: host.touchedVersion,
    latestSubmitDetailSignal: host._latestSubmitDetailSignal,
    resolveToken: (v) => host.resolveToken(v),
    resolveItemPresentation: (item) => host.resolveItemPresentation(item),
    resolveWidgetClassSlots: (p) => host.resolveWidgetClassSlots(p),
    findItemByKey: (key) => host.findItemByKey(key),
    renderComponent: (comp, parent, pfx) => renderComponent(host, comp, parent, pfx),
    submit: (opts) => host.submit(opts),
    registryEntries: host._registryEntries,
    rerender: () => host.render(),
};
```

Add `behaviorContext` and `adapterContext` to `RenderContext`.

- [ ] **Step 5: Convert TextInputPlugin to orchestrator pattern**

```typescript
export const TextInputPlugin: ComponentPlugin = {
    type: 'TextInput',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (!comp.bind) return;
        const item = ctx.findItemByKey(comp.bind);
        if (!item) return;

        const behavior = useTextInput(ctx.behaviorContext, comp);
        const adapterFn = globalRegistry.resolveAdapterFn('TextInput');
        if (adapterFn) {
            adapterFn(behavior, parent, ctx.adapterContext);
        }
    }
};
```

- [ ] **Step 6: Convert all remaining input plugins to orchestrator pattern**

Each simple plugin (NumberInput, Select, Toggle, Checkbox, DatePicker, RadioGroup, CheckboxGroup) follows the same 4-line pattern. MoneyInput transforms comp/item then uses `useMoneyInput`. Slider, Rating, FileUpload, Signature use their respective hooks.

- [ ] **Step 7: Run ALL tests — existing + new**

Run: `cd packages/formspec-webcomponent && npx vitest run`
Expected: ALL PASS — the default adapter must reproduce identical DOM

This is the critical verification step. If any existing test fails, the default adapter is not faithful to the original DOM. Fix the adapter, not the test.

- [ ] **Step 8: Commit**

```bash
git add packages/formspec-webcomponent/src/components/inputs.ts packages/formspec-webcomponent/src/rendering/emit-node.ts packages/formspec-webcomponent/src/components/index.ts packages/formspec-webcomponent/src/types.ts
git commit -m "feat: convert input plugins to behavior→adapter orchestrators"
```

---

## Task 10: Extract Wizard + Tabs (Interactive Components)

**Files:**
- Create: `packages/formspec-webcomponent/src/behaviors/wizard.ts`
- Create: `packages/formspec-webcomponent/src/behaviors/tabs.ts`
- Create: `packages/formspec-webcomponent/src/adapters/default/wizard.ts`
- Create: `packages/formspec-webcomponent/src/adapters/default/tabs.ts`
- Modify: `packages/formspec-webcomponent/src/components/interactive.ts`

- [ ] **Step 1: Create WizardBehavior hook**

`src/behaviors/wizard.ts` — Signal-based step state, navigation guards, soft validation on Next. `renderStep` delegates to `ctx.renderComponent` (accepted coupling per ADR). `bind()` wires panel show/hide, progress indicator updates, nav button enable/disable, page-change events, formspec-wizard-set-step listener.

- [ ] **Step 2: Create default Wizard adapter**

`src/adapters/default/wizard.ts` — Reproduces current DOM: sidenav layout (when enabled), progress steps bar, panels, prev/next/skip buttons. Must match existing CSS class names exactly.

- [ ] **Step 3: Create TabsBehavior hook**

`src/behaviors/tabs.ts` — Signal-based active tab, formspec-tabs-set-active listener. `renderTab` delegates to `ctx.renderComponent`. `bind()` wires panel/button active state toggle.

- [ ] **Step 4: Create default Tabs adapter**

`src/adapters/default/tabs.ts` — Tab bar + panels with position support.

- [ ] **Step 5: Convert WizardPlugin and TabsPlugin to orchestrators**

Modify `interactive.ts` — SubmitButton stays as-is (too simple to benefit from extraction).

- [ ] **Step 6: Register Wizard/Tabs in default adapter**

Update `src/adapters/default/index.ts` to include Wizard and Tabs.

- [ ] **Step 7: Run ALL tests including interactive plugin tests**

Run: `cd packages/formspec-webcomponent && npx vitest run`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add packages/formspec-webcomponent/src/behaviors/wizard.ts packages/formspec-webcomponent/src/behaviors/tabs.ts packages/formspec-webcomponent/src/adapters/default/wizard.ts packages/formspec-webcomponent/src/adapters/default/tabs.ts packages/formspec-webcomponent/src/components/interactive.ts packages/formspec-webcomponent/src/adapters/default/index.ts
git commit -m "feat: extract Wizard and Tabs into behavior hooks with default adapters"
```

---

## Task 11: Delete field-input.ts + Clean Up

**Files:**
- Delete: `packages/formspec-webcomponent/src/rendering/field-input.ts`
- Modify: `packages/formspec-webcomponent/src/rendering/emit-node.ts` — remove `renderInputComponent` import and from RenderContext
- Modify: `packages/formspec-webcomponent/src/types.ts` — remove `renderInputComponent` from RenderContext
- Modify: `packages/formspec-webcomponent/src/rendering/index.ts` — remove field-input re-export

- [ ] **Step 1: Remove renderInputComponent from RenderContext**

In `src/types.ts`, remove the `renderInputComponent` method from the `RenderContext` interface.

In `src/rendering/emit-node.ts`, remove:
- The import of `renderInputComponentFn` and `FieldInputHost`
- The `renderInputComponent` property from the ctx object in `renderActualComponent`

- [ ] **Step 2: Delete field-input.ts**

```bash
rm packages/formspec-webcomponent/src/rendering/field-input.ts
```

- [ ] **Step 3: Update rendering/index.ts barrel**

Remove the `field-input` re-export.

- [ ] **Step 4: Run ALL tests**

Run: `cd packages/formspec-webcomponent && npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: Run E2E tests**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 6: Run TypeScript build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add -u
git commit -m "refactor: delete field-input.ts — replaced by behavior hooks + default adapters"
```

---

## Task 12: Update Exports + Documentation

**Files:**
- Modify: `packages/formspec-webcomponent/src/index.ts` — export new public API
- Update: `thoughts/archive/adr/0046-headless-component-adapters.md` — mark status as Accepted

- [ ] **Step 1: Export public API from index.ts**

Add exports for the types and registry that external adapter authors need:

```typescript
export type { RenderAdapter, AdapterRenderFn, AdapterContext } from './adapters/types';
export type { FieldBehavior, FieldRefs, ResolvedPresentationBlock } from './behaviors/types';
```

- [ ] **Step 2: Update ADR status**

Change status from `Proposed` to `Accepted` in `thoughts/archive/adr/0046-headless-component-adapters.md`.

- [ ] **Step 3: Final full test run**

Run: `cd packages/formspec-webcomponent && npx vitest run && cd ../.. && npm test && npm run build`
Expected: ALL PASS, build clean

- [ ] **Step 4: Commit**

```bash
git add packages/formspec-webcomponent/src/index.ts thoughts/archive/adr/0046-headless-component-adapters.md
git commit -m "feat: export headless adapter public API, mark ADR 0046 as Accepted"
```

---

## Implementation Notes for Subagents

### How to extract a component from field-input.ts

1. **Read the branch** in `renderInputComponent()` that handles this component type. The branches are:
   - `componentType === 'RadioGroup'` → lines 116-136
   - `dataType === 'multiChoice' || componentType === 'CheckboxGroup'` → lines 137-178
   - `dataType === 'money'` → lines 179-248
   - `componentType === 'Select'` → lines 249-275
   - `componentType === 'Toggle' || componentType === 'Checkbox' || dataType === 'boolean'` → lines 276-298
   - `else` block handles NumberInput, DatePicker, TextInput → lines 299-377

2. **Behavior hook** gets: static props from `comp` and `item`, value sync logic, ARIA management. Everything that touches `host.engine.signals`, `host.engine.setValue`, `effect()`.

3. **Default adapter** gets: DOM element creation, CSS class names, element hierarchy. Everything that calls `document.createElement`.

4. **The shared effects** (required, readonly, relevance, validation, touched) are handled by `bindSharedFieldEffects` — don't duplicate them.

### Value sync patterns reference

| Type | Engine→DOM | DOM→Engine |
|------|-----------|-----------|
| string | `input.value = val ?? ''` | `input` event → `target.value` |
| number | `input.value = val ?? ''` | `input` event → `Number(target.value)` with clamping |
| boolean | `checkbox.checked = !!val` | `input` event → `target.checked` |
| choice (radio) | Loop radios, `rb.checked = rb.value === String(val)` | `change` event per radio → `rb.value` |
| multiChoice | Loop checkboxes, `cb.checked = val.includes(cb.value)` | `change` per checkbox → collect all checked |
| choice (select) | `select.value = val ?? ''` | `change` event → `target.value` |
| money | `amountInput.value = amount`, `currencyInput.value = currency` | `input` events → `{ amount, currency }` |
| date/time | `input.value = val ?? ''` | `input` event → `target.value` |

### Remote options handling

The current `field-input.ts` re-renders the entire component when options change (lines 39-52). In the new architecture:
- The behavior hook watches the option signal and calls `refs.rebuildOptions` if provided
- If `rebuildOptions` is not provided, it falls back to calling `host.render()` (full re-render)
- The default adapter provides `rebuildOptions` for RadioGroup, CheckboxGroup, and Select

### Key gotcha: Toggle label position

When `componentType === 'Toggle'` or `'Checkbox'` AND `labelPosition === 'top'`, the current code adds `formspec-field--inline` class (line 82-84). This special case must be preserved in the default adapter or behavior.
