/** @filedesc USWDS v3 adapter for CheckboxGroup — renders usa-checkbox markup inside a fieldset. */
import type { CheckboxGroupBehavior, AdapterRenderFn } from '@formspec-org/webcomponent';
import { el, applyCascadeClasses, applyCascadeAccessibility } from '../helpers';
import { applyUSWDSValidationState, createUSWDSError } from './shared';

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

        const wrapper = el('div', { class: 'usa-checkbox' });

        const input = document.createElement('input') as HTMLInputElement;
        input.className = 'usa-checkbox__input';
        input.id = optId;
        input.type = 'checkbox';
        input.name = behavior.fieldPath;
        input.value = opt.value;
        controls.set(opt.value, input);

        const label = el('label', { class: 'usa-checkbox__label', for: optId });
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

    // Select All — USWDS doesn't have a built-in select-all, but we use
    // the same usa-checkbox markup for consistency
    if (behavior.selectAll && behavior.options().length > 0) {
        const selectAllWrapper = el('div', { class: 'usa-checkbox' });
        const selectAllId = `${behavior.id}-select-all`;
        const selectAllCb = document.createElement('input') as HTMLInputElement;
        selectAllCb.className = 'usa-checkbox__input';
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
        const selectAllLabel = el('label', { class: 'usa-checkbox__label', for: selectAllId });
        selectAllLabel.textContent = 'Select All';
        selectAllWrapper.appendChild(selectAllCb);
        selectAllWrapper.appendChild(selectAllLabel);
        fieldset.appendChild(selectAllWrapper);
    }

    const optionContainer = el('div', {});
    let optionControlsRef = buildCheckboxOptions(behavior, optionContainer, behavior.options());
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
        optionControls: optionControlsRef,
        rebuildOptions: (_container, newOptions) => {
            optionControlsRef = buildCheckboxOptions(behavior, optionContainer, newOptions);
            return optionControlsRef;
        },
        onValidationChange: (hasError) => {
            applyUSWDSValidationState(fieldset, legend, hasError);
        },
    });
    actx.onDispose(dispose);
};
