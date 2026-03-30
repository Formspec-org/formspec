/** @filedesc USWDS v3 adapter for Slider — usa-range input with optional value display and ticks. */
import type { SliderBehavior, AdapterRenderFn } from '@formspec-org/webcomponent';
import { el } from '../helpers';
import { applyUSWDSValidationState, createUSWDSFieldDOM } from './shared';

export const renderSlider: AdapterRenderFn<SliderBehavior> = (
    behavior, parent, actx
) => {
    const { root, label, hint, error } = createUSWDSFieldDOM(behavior);

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

    if (behavior.showValue) {
        const track = el('div', { class: 'grid-row grid-gap-2' });
        const rangeCol = el('div', { class: 'grid-col-12 tablet:grid-col-fill' });
        const valCol = el('div', { class: 'grid-col-12 tablet:grid-col-auto' });
        rangeCol.appendChild(input);
        const valueDisplay = el('span', { class: 'usa-hint formspec-slider-value', 'aria-live': 'polite' });
        valCol.appendChild(valueDisplay);
        track.appendChild(rangeCol);
        track.appendChild(valCol);
        root.appendChild(track);
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
