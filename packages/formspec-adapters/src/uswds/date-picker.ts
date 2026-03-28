/** @filedesc USWDS v3 adapter for DatePicker — renders native date input with USWDS styling. */
import type { DatePickerBehavior, AdapterRenderFn } from '@formspec-org/webcomponent';
import { applyUSWDSValidationState, createUSWDSFieldDOM } from './shared';

export const renderDatePicker: AdapterRenderFn<DatePickerBehavior> = (
    behavior, parent, actx
) => {
    const p = behavior.presentation;

    const { root, label, hint, error, describedBy } = createUSWDSFieldDOM(behavior);

    if (p.labelPosition === 'start') root.style.display = 'flex';

    // USWDS has a usa-date-picker component, but its JS owns calendar behavior.
    // Since bind() owns all interaction, we use a native input with usa-input styling.
    const input = document.createElement('input') as HTMLInputElement;
    input.className = 'usa-input';
    input.type = behavior.inputType;
    input.id = behavior.id;
    input.name = behavior.fieldPath;
    if (behavior.minDate) input.min = behavior.minDate;
    if (behavior.maxDate) input.max = behavior.maxDate;

    input.setAttribute('aria-describedby', describedBy);
    root.appendChild(input);

    root.appendChild(error);

    parent.appendChild(root);

    const dispose = behavior.bind({
        root, label, control: input, hint, error,
        onValidationChange: (hasError) => {
            applyUSWDSValidationState(root, label, hasError, input);
        },
    });
    actx.onDispose(dispose);
};
