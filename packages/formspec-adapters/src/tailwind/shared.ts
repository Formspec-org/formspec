/** @filedesc Shared DOM construction for Tailwind field adapters — root, label, hint, error, describedBy. */
import type { FieldBehavior } from 'formspec-webcomponent';
import { el, applyCascadeClasses, applyCascadeAccessibility } from '../helpers';

// ── Tailwind utility class constants (teal / zinc dark — matches dark mesh background) ──

export const TW = {
    label: 'block text-sm font-semibold tracking-tight text-zinc-200 mb-1.5',
    labelHidden: 'sr-only',
    hint: 'mt-1.5 text-sm leading-relaxed text-zinc-400',
    error: 'mt-1.5 text-sm font-medium text-rose-400',
    input:
        'block w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3.5 py-2.5 text-sm text-zinc-100 shadow-sm transition placeholder:text-zinc-500 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/15',
    inputError: 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20',
    inputNormal: 'border-zinc-700 focus:border-teal-500 focus:ring-teal-500/15',
    group: 'mb-5',
    fieldset: 'mb-6 space-y-1 border-0 p-0',
    legend: 'text-base font-semibold tracking-tight text-zinc-100 mb-1',
    /** Native checkbox / radio inside cards — slightly larger hit target */
    controlSm:
        'peer mt-0.5 size-[1.125rem] shrink-0 cursor-pointer rounded-md border-zinc-600 text-teal-500 transition focus:ring-2 focus:ring-teal-500 focus:ring-offset-0',
    radioSm:
        'peer mt-0.5 size-[1.125rem] shrink-0 cursor-pointer border-zinc-600 text-teal-500 focus:ring-2 focus:ring-teal-500 focus:ring-offset-0',
    optionLabelText: 'text-sm font-medium leading-snug text-zinc-200',
    /** @deprecated use cardOption for new layouts */
    optionLabel: 'text-sm font-medium leading-snug text-zinc-200',
    optionWrapper: 'flex items-start gap-3',
    button:
        'inline-flex items-center justify-center rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-stone-950 shadow-md shadow-teal-500/25 transition hover:bg-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900',
    buttonOutline:
        'inline-flex items-center justify-center rounded-xl border border-zinc-600 bg-zinc-800 px-5 py-2.5 text-sm font-semibold text-zinc-200 shadow-sm transition hover:border-zinc-500 hover:bg-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900',
    buttonUnstyled: 'text-sm font-semibold text-teal-400 underline-offset-2 hover:text-teal-300 hover:underline',
} as const;

/** Classes for a selectable card row (checkbox / radio). */
export const TW_CARD_OPTION =
    'group flex cursor-pointer items-start gap-3 rounded-xl border-2 border-zinc-700/60 bg-zinc-900/50 px-4 py-3.5 shadow-sm transition-all duration-200 hover:border-teal-500/50 hover:shadow-md has-[:checked]:border-teal-500 has-[:checked]:bg-gradient-to-br has-[:checked]:from-teal-900/30 has-[:checked]:to-zinc-900 has-[:checked]:shadow-md has-[:checked]:ring-2 has-[:checked]:ring-teal-500/20';

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
        input.classList.add(...TW.inputError.split(/\s+/));
        input.classList.remove(...TW.inputNormal.split(/\s+/));
    } else {
        input.classList.remove(...TW.inputError.split(/\s+/));
        input.classList.add(...TW.inputNormal.split(/\s+/));
    }
}
