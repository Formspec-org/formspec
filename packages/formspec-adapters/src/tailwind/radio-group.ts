/** @filedesc Tailwind adapter for RadioGroup — renders fieldset with styled radio options. */
import type { RadioGroupBehavior, AdapterRenderFn } from 'formspec-webcomponent';
import { el, applyCascadeClasses, applyCascadeAccessibility } from '../helpers';
import { createTailwindError, TW } from './shared';

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

        const wrapper = el('div', { class: TW.optionWrapper });

        const input = document.createElement('input') as HTMLInputElement;
        input.className = TW.radio;
        input.id = optId;
        input.type = 'radio';
        input.name = behavior.inputName;
        input.value = opt.value;
        controls.set(opt.value, input);

        const label = el('label', { class: TW.optionLabel, for: optId });
        label.textContent = opt.label;

        wrapper.appendChild(input);
        wrapper.appendChild(label);
        container.appendChild(wrapper);
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

    const optionContainer = el('div', { class: 'space-y-2 mt-2' });
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
            fieldset.classList.toggle('border-red-500', hasError);
        },
    });
    actx.onDispose(dispose);
};
