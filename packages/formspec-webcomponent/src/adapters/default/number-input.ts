/** @filedesc Default adapter for NumberInput — renders a numeric input element. */
import type { NumberInputBehavior } from '../../behaviors/types';
import type { AdapterRenderFn } from '../types';
import { createFieldDOM, finalizeFieldDOM, applyControlSlotClass } from './shared';

export const renderNumberInput: AdapterRenderFn<NumberInputBehavior> = (
    behavior, parent, actx
) => {
    const fieldDOM = createFieldDOM(behavior, actx);

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'formspec-input';
    input.name = behavior.fieldPath;
    input.id = behavior.id;
    if (behavior.step != null) input.step = String(behavior.step);
    if (behavior.min != null) input.min = String(behavior.min);
    if (behavior.max != null) input.max = String(behavior.max);
    input.setAttribute('aria-describedby', fieldDOM.describedBy.join(' '));

    fieldDOM.root.appendChild(input);
    applyControlSlotClass(input, behavior, actx);
    finalizeFieldDOM(fieldDOM, behavior, actx);
    parent.appendChild(fieldDOM.root);

    const dispose = behavior.bind({
        root: fieldDOM.root,
        label: fieldDOM.label,
        control: input,
        hint: fieldDOM.hint,
        error: fieldDOM.error,
    });
    actx.onDispose(dispose);
};
