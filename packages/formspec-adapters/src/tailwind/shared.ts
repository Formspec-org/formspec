/** @filedesc Shared DOM construction for Tailwind field adapters — root, label, hint, error, describedBy. */
import type { FieldBehavior } from 'formspec-webcomponent';
import { el, applyCascadeClasses, applyCascadeAccessibility } from '../helpers';

// ── Tailwind utility class constants ──────────────────────────────

export const TW = {
    label: 'block text-sm font-medium text-gray-700 mb-1',
    labelHidden: 'sr-only',
    hint: 'mt-1 text-sm text-gray-500',
    error: 'mt-1 text-sm text-red-600',
    input: 'block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm',
    inputError: 'border-red-500 focus:ring-red-500',
    inputNormal: 'border-gray-300 focus:border-blue-500 focus:ring-blue-500',
    group: 'mb-4',
    fieldset: 'mb-4',
    legend: 'text-sm font-medium text-gray-700 mb-2',
    checkbox: 'h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500',
    radio: 'h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500',
    optionLabel: 'text-sm text-gray-700',
    optionWrapper: 'flex items-center gap-2',
    button: 'inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
    buttonOutline: 'inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
    buttonUnstyled: 'text-sm text-blue-600 hover:text-blue-800 underline',
} as const;

// ── Shared field DOM ──────────────────────────────────────────────

export interface TailwindFieldDOM {
    root: HTMLElement;
    label: HTMLElement;
    hint: HTMLElement | undefined;
    error: HTMLElement;
    describedBy: string;
}

export interface TailwindFieldOptions {
    labelFor?: boolean;
}

export function createTailwindFieldDOM(
    behavior: FieldBehavior,
    options?: TailwindFieldOptions,
): TailwindFieldDOM {
    const p = behavior.presentation;
    const labelFor = options?.labelFor ?? true;

    const root = el('div', { class: TW.group, 'data-name': behavior.fieldPath });
    applyCascadeClasses(root, p);
    applyCascadeAccessibility(root, p);

    // Label
    const labelAttrs: Record<string, string> = {
        class: p.labelPosition === 'hidden' ? TW.labelHidden : TW.label,
    };
    if (labelFor) labelAttrs.for = behavior.id;
    const label = el('label', labelAttrs);
    label.textContent = behavior.label;
    root.appendChild(label);

    // Hint
    let hint: HTMLElement | undefined;
    if (behavior.hint) {
        const hintId = `${behavior.id}-hint`;
        hint = el('p', { class: TW.hint, id: hintId });
        hint.textContent = behavior.hint;
        root.appendChild(hint);
    }

    // Error (not appended — adapter places it after control)
    const error = createTailwindError(behavior.id);

    // describedBy
    const describedBy = [
        hint ? `${behavior.id}-hint` : '',
        `${behavior.id}-error`,
    ].filter(Boolean).join(' ');

    return { root, label, hint, error, describedBy };
}

export function createTailwindError(behaviorId: string): HTMLElement {
    return el('p', {
        class: TW.error,
        id: `${behaviorId}-error`,
        role: 'alert',
        'aria-live': 'polite',
    });
}

export function toggleInputError(input: HTMLElement, hasError: boolean): void {
    if (hasError) {
        input.classList.add('border-red-500', 'focus:ring-red-500');
        input.classList.remove('border-gray-300', 'focus:border-blue-500', 'focus:ring-blue-500');
    } else {
        input.classList.remove('border-red-500', 'focus:ring-red-500');
        input.classList.add('border-gray-300', 'focus:border-blue-500', 'focus:ring-blue-500');
    }
}
