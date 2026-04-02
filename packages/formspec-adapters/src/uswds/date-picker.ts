/** @filedesc USWDS v3 adapter for DatePicker — usa-date-picker markup + text input (parity with RealUSWDSStory). */
import type { DatePickerBehavior, AdapterRenderFn } from '@formspec-org/webcomponent';
import { el } from '../helpers';
import { applyUSWDSValidationState, createUSWDSFieldDOM } from './shared';

export const renderDatePicker: AdapterRenderFn<DatePickerBehavior> = (
    behavior, parent, actx
) => {
    const p = behavior.presentation;

    const { root, label, hint: hintFromDef, error } = createUSWDSFieldDOM(behavior);

    if (p.labelPosition === 'start') root.style.display = 'flex';

    let hint = hintFromDef;
    if (!hint) {
        hint = el('span', { class: 'usa-hint', id: `${behavior.id}-hint` });
        hint.textContent = 'MM/DD/YYYY';
        root.appendChild(hint);
    }

    const input = document.createElement('input') as HTMLInputElement;
    input.className = 'usa-input';
    const useTextDate = behavior.inputType === 'date';
    input.type = useTextDate ? 'text' : behavior.inputType;
    input.id = behavior.id;
    input.name = behavior.fieldPath;
    if (input.type === 'datetime-local') {
        if (behavior.minDate) input.min = behavior.minDate;
        if (behavior.maxDate) input.max = behavior.maxDate;
    }

    // USWDS date-picker wrapper matches Storybook “Real USWDS” pane for plain dates.
    if (useTextDate) {
        const shell = el('div', { class: 'usa-date-picker' });
        shell.appendChild(input);
        root.appendChild(shell);
    } else {
        root.appendChild(input);
    }

    parent.appendChild(root);

    const dispose = behavior.bind({
        root, label, control: input, hint, error,
        onValidationChange: (hasError) => {
            applyUSWDSValidationState(root, label, hasError, input);
        },
    });
    actx.onDispose(dispose);
};
