/** @filedesc Tailwind adapter for DatePicker — renders native date input with Tailwind styling. */
import type { DatePickerBehavior, AdapterRenderFn } from 'formspec-webcomponent';
import { createTailwindFieldDOM, TW, toggleInputError } from './shared';

export const renderDatePicker: AdapterRenderFn<DatePickerBehavior> = (
    behavior, parent, actx
) => {
    const p = behavior.presentation;

    const { root, label, hint, error, describedBy } = createTailwindFieldDOM(behavior);

    if (p.labelPosition === 'start') root.style.display = 'flex';

    const input = document.createElement('input') as HTMLInputElement;
    input.className = TW.input;
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
            toggleInputError(input, hasError);
        },
    });
    actx.onDispose(dispose);
};
