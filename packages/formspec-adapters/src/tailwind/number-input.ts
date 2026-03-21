/** @filedesc Tailwind adapter for NumberInput — renders styled number input. */
import type { NumberInputBehavior, AdapterRenderFn } from 'formspec-webcomponent';
import { createTailwindFieldDOM, TW, toggleInputError } from './shared';

export const renderNumberInput: AdapterRenderFn<NumberInputBehavior> = (
    behavior, parent, actx
) => {
    const p = behavior.presentation;

    const { root, label, hint, error, describedBy } = createTailwindFieldDOM(behavior);

    if (p.labelPosition === 'start') root.style.display = 'flex';

    const input = document.createElement('input') as HTMLInputElement;
    input.className = TW.input;
    input.type = 'number';
    input.id = behavior.id;
    input.name = behavior.fieldPath;
    if (behavior.step != null) input.step = String(behavior.step);
    if (behavior.min != null) input.min = String(behavior.min);
    if (behavior.max != null) input.max = String(behavior.max);

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
