/** @filedesc USWDS v3 adapter for RadioGroup — renders usa-radio markup inside a fieldset. */
import type { RadioGroupBehavior, AdapterRenderFn } from 'formspec-webcomponent';
import { el, applyCascadeClasses, applyCascadeAccessibility } from '../helpers';
import { createUSWDSError } from './shared';

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

        const wrapper = el('div', { class: 'usa-radio' });

        const input = document.createElement('input') as HTMLInputElement;
        input.className = 'usa-radio__input';
        input.id = optId;
        input.type = 'radio';
        input.name = behavior.inputName;
        input.value = opt.value;
        controls.set(opt.value, input);

        const label = el('label', { class: 'usa-radio__label', for: optId });
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

    const fieldset = el('fieldset', { class: 'usa-fieldset' });
    applyCascadeClasses(fieldset, p);
    applyCascadeAccessibility(fieldset, p);

    const legendClasses = p.labelPosition === 'hidden'
        ? 'usa-legend usa-sr-only'
        : 'usa-legend';
    const legend = el('legend', { class: legendClasses });
    legend.textContent = behavior.label;
    fieldset.appendChild(legend);

    let hint: HTMLElement | undefined;
    if (behavior.hint) {
        const hintId = `${behavior.id}-hint`;
        hint = el('span', { class: 'usa-hint', id: hintId });
        hint.textContent = behavior.hint;
        fieldset.appendChild(hint);
    }

    const optionContainer = el('div', {});
    const initialControls = buildRadioOptions(behavior, optionContainer, behavior.options());
    fieldset.appendChild(optionContainer);

    const error = createUSWDSError(behavior.id);
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
            fieldset.classList.toggle('usa-fieldset--error', hasError);
        },
    });
    actx.onDispose(dispose);
};
