/** @filedesc Tailwind adapter for RadioGroup — card-style option grid. */
import type { RadioGroupBehavior, AdapterRenderFn } from 'formspec-webcomponent';
import { el, applyCascadeClasses, applyCascadeAccessibility } from '../helpers';
import { createTailwindError, TW, TW_CARD_OPTION } from './shared';

function buildRadioOptions(
    behavior: RadioGroupBehavior,
    container: HTMLElement,
    options: ReadonlyArray<{ value: string; label: string }>,
): Map<string, HTMLInputElement> {
    container.innerHTML = '';
    const controls = new Map<string, HTMLInputElement>();

    for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const optId = `${behavior.id}-${i}`;

        const card = el('label', { class: TW_CARD_OPTION, for: optId });

        const input = document.createElement('input') as HTMLInputElement;
        input.className = `${TW.radioSm} rounded-full`;
        input.id = optId;
        input.type = 'radio';
        input.name = behavior.inputName;
        input.value = opt.value;
        controls.set(opt.value, input);

        const text = el('span', { class: TW.optionLabelText });
        text.textContent = opt.label;

        card.appendChild(input);
        card.appendChild(text);
        container.appendChild(card);
    }

    return controls;
}

export const renderRadioGroup: AdapterRenderFn<RadioGroupBehavior> = (
    behavior, parent, actx
) => {
    const p = behavior.presentation;

    const fieldset = el('fieldset', { class: TW.fieldset });
    applyCascadeClasses(fieldset, p);
    applyCascadeAccessibility(fieldset, p);

    const legend = el('legend', {
        class: p.labelPosition === 'hidden' ? TW.labelHidden : TW.legend,
    });
    legend.textContent = behavior.label;
    fieldset.appendChild(legend);

    let hint: HTMLElement | undefined;
    if (behavior.hint) {
        const hintId = `${behavior.id}-hint`;
        hint = el('p', { class: TW.hint, id: hintId });
        hint.textContent = behavior.hint;
        fieldset.appendChild(hint);
    }

    const optionContainer = el('div', { class: 'grid gap-3 mt-3 sm:grid-cols-2' });
    const initialControls = buildRadioOptions(behavior, optionContainer, behavior.options());
    fieldset.appendChild(optionContainer);

    const error = createTailwindError(behavior.id);
    fieldset.appendChild(error);

    parent.appendChild(fieldset);

    const dispose = behavior.bind({
        root: fieldset,
        label: legend,
        control: fieldset,
        hint,
        error,
        optionControls: initialControls,
        rebuildOptions: (_container, newOptions) =>
            buildRadioOptions(behavior, optionContainer, newOptions),
        onValidationChange: (hasError) => {
            fieldset.classList.toggle('ring-2', hasError);
            fieldset.classList.toggle('ring-rose-400/60', hasError);
            fieldset.classList.toggle('rounded-xl', hasError);
        },
    });
    actx.onDispose(dispose);
};
