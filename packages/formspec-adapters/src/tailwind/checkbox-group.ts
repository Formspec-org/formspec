/** @filedesc Tailwind adapter for CheckboxGroup — renders fieldset with styled checkbox options. */
import type { CheckboxGroupBehavior, AdapterRenderFn } from 'formspec-webcomponent';
import { el, applyCascadeClasses, applyCascadeAccessibility } from '../helpers';
import { createTailwindError, TW } from './shared';

function buildCheckboxOptions(
    behavior: CheckboxGroupBehavior,
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
        input.className = TW.checkbox;
        input.id = optId;
        input.type = 'checkbox';
        input.name = behavior.fieldPath;
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

export const renderCheckboxGroup: AdapterRenderFn<CheckboxGroupBehavior> = (
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

    // Select All
    if (behavior.selectAll && behavior.options().length > 0) {
        const selectAllWrapper = el('div', { class: TW.optionWrapper });
        const selectAllId = `${behavior.id}-select-all`;

        const selectAllCb = document.createElement('input') as HTMLInputElement;
        selectAllCb.className = TW.checkbox;
        selectAllCb.id = selectAllId;
        selectAllCb.type = 'checkbox';
        selectAllCb.addEventListener('change', () => {
            const checked: string[] = [];
            for (const [optVal, cb] of optionControlsRef) {
                cb.checked = selectAllCb.checked;
                if (cb.checked) checked.push(optVal);
            }
            behavior.setValue(checked);
        });

        const selectAllLabel = el('label', { class: `${TW.optionLabel} font-medium`, for: selectAllId });
        selectAllLabel.textContent = 'Select All';
        selectAllWrapper.appendChild(selectAllCb);
        selectAllWrapper.appendChild(selectAllLabel);
        fieldset.appendChild(selectAllWrapper);
    }

    const optionContainer = el('div', { class: 'space-y-2 mt-2' });
    let optionControlsRef = buildCheckboxOptions(behavior, optionContainer, behavior.options());
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
        optionControls: optionControlsRef,
        rebuildOptions: (_container, newOptions) => {
            optionControlsRef = buildCheckboxOptions(behavior, optionContainer, newOptions);
            return optionControlsRef;
        },
        onValidationChange: (hasError) => {
            fieldset.classList.toggle('border-red-500', hasError);
        },
    });
    actx.onDispose(dispose);
};
