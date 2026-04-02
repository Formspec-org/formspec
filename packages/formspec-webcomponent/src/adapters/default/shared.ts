/** @filedesc Shared DOM construction helpers for the default render adapter. */
import type { FieldBehavior } from '../../behaviors/types';
import type { AdapterContext } from '../types';

export interface FieldDOMOptions {
    /** Set false for group controls where the label shouldn't target a single input. Default true. */
    labelFor?: boolean;
    /** When true, use <fieldset> for root and <legend> for label. */
    asGroup?: boolean;
}

export interface FieldDOM {
    root: HTMLElement;
    label: HTMLElement;
    hint: HTMLElement | undefined;
    error: HTMLElement;
    /** Initial space-separated ID string for aria-describedby. */
    initialDescribedBy: string;
}

/**
 * Create the common field wrapper structure: root div (or fieldset), label (or legend),
 * description, hint, error.
 *
 * Uses behavior.widgetClassSlots for x-classes support (from theme widgetConfig).
 * When a FieldViewModel is available, reads current locale-resolved values from VM signals.
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
    const asGroup = options?.asGroup === true;

    // Read from VM signals when available; fall back to static behavior properties.
    const vm = behavior.vm;
    const labelText = vm ? vm.label.value : behavior.label;
    const hintText = vm ? vm.hint.value : behavior.hint;
    const descText = vm ? vm.description.value : behavior.description;

    const root = document.createElement(asGroup ? 'fieldset' : 'div');
    root.className = asGroup ? 'formspec-fieldset' : 'formspec-field';
    root.dataset.name = behavior.fieldPath;
    if (slots.root) actx.applyClassValue(root, slots.root);

    const effectiveLabelPosition = p.labelPosition || 'top';

    const label = document.createElement(asGroup ? 'legend' : 'label');
    label.className = asGroup ? 'formspec-legend' : 'formspec-label';
    label.textContent = labelText;
    if (asGroup) {
        label.id = `${fieldId}-label`;
    } else if (options?.labelFor !== false) {
        (label as HTMLLabelElement).htmlFor = fieldId;
    }
    if (slots.label) actx.applyClassValue(label, slots.label);

    if (effectiveLabelPosition === 'hidden') {
        label.classList.add('formspec-sr-only');
    } else if (!asGroup && effectiveLabelPosition === 'start') {
        root.classList.add('formspec-field--inline');
    }

    root.appendChild(label);

    if (descText) {
        const descId = `${fieldId}-desc`;
        const desc = document.createElement('div');
        desc.className = 'formspec-description';
        desc.id = descId;
        desc.textContent = descText;
        root.appendChild(desc);
    }

    let hint: HTMLElement | undefined;
    if (hintText) {
        hint = document.createElement('p');
        hint.className = 'formspec-hint';
        hint.id = hintId;
        hint.textContent = hintText;
        if (slots.hint) actx.applyClassValue(hint, slots.hint);
        root.appendChild(hint);
    }

    const error = document.createElement('p');
    error.className = 'formspec-error';
    error.id = errorId;
    if (slots.error) actx.applyClassValue(error, slots.error);

    const initialDescribedBy = [hintId, errorId].join(' ');

    return { root, label, hint, error, initialDescribedBy };
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
    const isRequired = behavior.vm ? behavior.vm.required.value : false;
    if (isRequired && !fieldDOM.label.querySelector('.formspec-required')) {
        const marker = document.createElement('abbr');
        marker.className = 'formspec-required usa-label--required';
        marker.setAttribute('title', 'required');
        marker.textContent = ' *';
        fieldDOM.label.appendChild(marker);
    }

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
