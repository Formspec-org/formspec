/** @filedesc USWDS v3 adapter for Slider — usa-range input with optional value display and ticks. */
import type { SliderBehavior, AdapterRenderFn } from '@formspec-org/webcomponent';
import { el } from '../helpers';
import { createUSWDSFieldDOM } from './shared';

export const renderSlider: AdapterRenderFn<SliderBehavior> = (
    behavior, parent, actx
) => {
    const { root, label, hint, error, describedBy: _describedBy } = createUSWDSFieldDOM(behavior);

    const input = document.createElement('input') as HTMLInputElement;
    input.className = 'usa-range';
    input.id = behavior.id;
    input.name = behavior.fieldPath;
    input.type = 'range';
    if (behavior.min != null) input.min = String(behavior.min);
    if (behavior.max != null) input.max = String(behavior.max);
    if (behavior.step != null) input.step = String(behavior.step);

    // Ticks datalist
    if (behavior.showTicks && behavior.min != null && behavior.max != null && behavior.step != null) {
        const tickCount = Math.floor((behavior.max - behavior.min) / behavior.step) + 1;
        if (tickCount > 0 && tickCount <= 200) {
            const listId = `usa-ticks-${behavior.fieldPath.replace(/\./g, '-')}`;
            const datalist = document.createElement('datalist');
            datalist.id = listId;
            for (let v = behavior.min; v <= behavior.max; v += behavior.step) {
                const opt = document.createElement('option');
                opt.value = String(v);
                datalist.appendChild(opt);
            }
            root.appendChild(datalist);
            input.setAttribute('list', listId);
        }
    }

    // Wrap range + optional value in an inline track container
    if (behavior.showValue) {
        const track = el('div', { class: 'formspec-slider-track' });
        track.appendChild(input);
        const valueDisplay = el('span', { class: 'formspec-slider-value', 'aria-live': 'polite' });
        track.appendChild(valueDisplay);
        root.appendChild(track);
    } else {
        root.appendChild(input);
    }

    root.appendChild(error);

    parent.appendChild(root);

    const dispose = behavior.bind({
        root, label, control: input, hint, error,
        onValidationChange: (hasError) => {
            root.classList.toggle('usa-form-group--error', hasError);
            input.classList.toggle('usa-range--error', hasError);
        },
    });
    actx.onDispose(dispose);
};
