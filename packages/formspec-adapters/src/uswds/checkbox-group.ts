/** @filedesc USWDS v3 adapter for CheckboxGroup — renders usa-checkbox markup inside a fieldset. */
import type { CheckboxGroupBehavior, AdapterRenderFn } from '@formspec-org/webcomponent';
import { el, applyCascadeClasses, applyCascadeAccessibility } from '../helpers';
import { applyUSWDSValidationState, createUSWDSError } from './shared';

/** Removes previously-rendered option elements (marked with data-checkbox-option). */
function clearCheckboxOptions(fieldset: HTMLElement): void {
    for (const old of Array.from(fieldset.querySelectorAll(':scope > [data-checkbox-option]'))) {
        old.remove();
    }
}

function buildCheckboxOptions(
    behavior: CheckboxGroupBehavior,
    fieldset: HTMLElement,
    insertBefore: HTMLElement,
    options: ReadonlyArray<{ value: string; label: string }>,
): Map<string, HTMLInputElement> {
    clearCheckboxOptions(fieldset);
    const controls = new Map<string, HTMLInputElement>();

    for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const optId = `${behavior.id}-${i}`;

        const wrapper = el('div', { class: 'usa-checkbox' });
        wrapper.setAttribute('data-checkbox-option', '');

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
        fieldset.insertBefore(wrapper, insertBefore);
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

    const error = createUSWDSError(behavior.id);
    fieldset.appendChild(error);

    let optionControlsRef = buildCheckboxOptions(behavior, fieldset, error, behavior.options());

    parent.appendChild(fieldset);

    const dispose = behavior.bind({
        root: fieldset,
        label: legend,
        control: fieldset,
        hint,
        error,
        optionControls: optionControlsRef,
        rebuildOptions: (_container, newOptions) => {
            optionControlsRef = buildCheckboxOptions(behavior, fieldset, error, newOptions);
            return optionControlsRef;
        },
        onValidationChange: (hasError) => {
            applyUSWDSValidationState(fieldset, legend, hasError);
        },
    });
    actx.onDispose(dispose);
};
