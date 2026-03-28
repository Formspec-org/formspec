/** @filedesc Shared DOM construction for USWDS field adapters — root, label, hint, error, describedBy. */
import type { FieldBehavior } from '@formspec-org/webcomponent';
import { el, applyCascadeClasses, applyCascadeAccessibility } from '../helpers';

export interface USWDSFieldDOM {
    root: HTMLElement;
    label: HTMLElement;
    hint: HTMLElement | undefined;
    error: HTMLElement;
    /** Space-separated id string for aria-describedby (hint + error). */
    describedBy: string;
}

export interface USWDSFieldOptions {
    /** Set false for components where label doesn't target a specific input (e.g. rating, signature). Default true. */
    labelFor?: boolean;
}

/**
 * Create the common USWDS field wrapper: usa-form-group root, usa-label,
 * usa-hint (if present), usa-error-message, and describedBy string.
 *
 * The error element is NOT appended to root — adapters insert it after
 * their control element.
 */
export function createUSWDSFieldDOM(
    behavior: FieldBehavior,
    options?: USWDSFieldOptions,
): USWDSFieldDOM {
    const p = behavior.presentation;
    const labelFor = options?.labelFor ?? true;

    const root = el('div', { class: 'usa-form-group', 'data-name': behavior.fieldPath });
    applyCascadeClasses(root, p);
    applyCascadeAccessibility(root, p);

    // Label
    const labelAttrs: Record<string, string> = {
        class: p.labelPosition === 'hidden' ? 'usa-label usa-sr-only' : 'usa-label',
    };
    if (labelFor) labelAttrs.for = behavior.id;
    const label = el('label', labelAttrs);
    label.textContent = behavior.label;
    root.appendChild(label);

    // Hint
    let hint: HTMLElement | undefined;
    if (behavior.hint) {
        const hintId = `${behavior.id}-hint`;
        hint = el('span', { class: 'usa-hint', id: hintId });
        hint.textContent = behavior.hint;
        root.appendChild(hint);
    }

    // Error (not appended — adapter places it after control)
    const error = createUSWDSError(behavior.id);

    // describedBy
    const describedBy = [
        hint ? `${behavior.id}-hint` : '',
        `${behavior.id}-error`,
    ].filter(Boolean).join(' ');

    return { root, label, hint, error, describedBy };
}

/** Create a USWDS error message element with correct ARIA live-region attributes. */
export function createUSWDSError(behaviorId: string): HTMLElement {
    return el('span', {
        class: 'usa-error-message',
        id: `${behaviorId}-error`,
        role: 'alert',
        'aria-live': 'polite',
    });
}

/** Apply native USWDS error classes to the wrapper, label/legend, and optional control. */
export function applyUSWDSValidationState(
    root: HTMLElement,
    label: HTMLElement,
    hasError: boolean,
    control?: HTMLElement | null,
): void {
    root.classList.toggle('usa-form-group--error', hasError);
    label.classList.toggle('usa-label--error', hasError);
    if (control) control.classList.toggle('usa-input--error', hasError);
}
