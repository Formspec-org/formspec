/** @filedesc Shared DOM construction helpers for the default render adapter. */
import type { FieldBehavior } from '../../behaviors/types';
import type { AdapterContext } from '../types';

export interface FieldDOMOptions {
    /** Set false for group controls where the label shouldn't target a single input. Default true. */
    labelFor?: boolean;
}

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
    options?: FieldDOMOptions,
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
    if (options?.labelFor !== false) {
        label.htmlFor = fieldId;
    }
    if (slots.label) actx.applyClassValue(label, slots.label);

    if (effectiveLabelPosition === 'hidden') {
        label.classList.add('formspec-sr-only');
    } else if (effectiveLabelPosition === 'start') {
        root.classList.add('formspec-field--inline');
    }

    root.appendChild(label);

    if (behavior.description) {
        const descId = `${fieldId}-desc`;
        const desc = document.createElement('div');
        desc.className = 'formspec-description';
        desc.id = descId;
        desc.textContent = behavior.description;
        root.appendChild(desc);
        describedBy.push(descId);
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
    // Remote options loading/error status
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
