/** @filedesc Tailwind adapter for Checkbox — single boolean as a compact selectable card. */
import type { FieldBehavior, AdapterRenderFn } from 'formspec-webcomponent';
import { el, applyCascadeClasses, applyCascadeAccessibility } from '../helpers';
import { createTailwindError, TW, TW_CARD_OPTION } from './shared';

export const renderCheckbox: AdapterRenderFn<FieldBehavior> = (
    behavior, parent, actx
) => {
    const p = behavior.presentation;

    const root = el('div', { class: TW.group, 'data-name': behavior.fieldPath });
    applyCascadeClasses(root, p);
    applyCascadeAccessibility(root, p);

    const card = el('label', { class: TW_CARD_OPTION, for: behavior.id });

    const input = document.createElement('input') as HTMLInputElement;
    input.className = TW.controlSm;
    input.id = behavior.id;
    input.type = 'checkbox';
    input.name = behavior.fieldPath;

    const describedBy = [
        behavior.hint ? `${behavior.id}-hint` : '',
        `${behavior.id}-error`,
    ].filter(Boolean).join(' ');
    input.setAttribute('aria-describedby', describedBy);

    const text = el('span', {
        class: p.labelPosition === 'hidden' ? 'sr-only' : TW.optionLabelText,
    });
    text.textContent = behavior.label;

    card.appendChild(input);
    card.appendChild(text);
    root.appendChild(card);

    let hint: HTMLElement | undefined;
    if (behavior.hint) {
        const hintId = `${behavior.id}-hint`;
        hint = el('p', { class: TW.hint, id: hintId });
        hint.textContent = behavior.hint;
        root.appendChild(hint);
    }

    const error = createTailwindError(behavior.id);
    root.appendChild(error);

    parent.appendChild(root);

    const dispose = behavior.bind({
        root, label: card, control: input, hint, error,
        onValidationChange: (hasError) => {
            card.classList.toggle('border-rose-500', hasError);
            card.classList.toggle('ring-2', hasError);
            card.classList.toggle('ring-rose-400/50', hasError);
        },
    });
    actx.onDispose(dispose);
};
