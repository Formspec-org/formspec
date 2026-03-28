/** @filedesc Default adapter for Slider — range input with track container and value display. */
import type { SliderBehavior } from '../../behaviors/types';
import type { AdapterRenderFn } from '../types';
import { createFieldDOM, finalizeFieldDOM } from './shared';

export const renderSlider: AdapterRenderFn<SliderBehavior> = (
    behavior, parent, actx
) => {
    const fieldDOM = createFieldDOM(behavior, actx);
    fieldDOM.root.classList.add('formspec-slider');

    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'formspec-slider-track';

    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'formspec-input';
    input.name = behavior.fieldPath;
    input.id = behavior.id;
    if (behavior.min != null) input.min = String(behavior.min);
    if (behavior.max != null) input.max = String(behavior.max);
    if (behavior.step != null) input.step = String(behavior.step);
    input.value = String(behavior.min ?? 0);

    if (behavior.showTicks && behavior.min != null && behavior.max != null && behavior.step != null) {
        const tickCount = Math.floor((behavior.max - behavior.min) / behavior.step) + 1;
        if (tickCount > 0 && tickCount <= 200) {
            const listId = `formspec-ticks-${behavior.fieldPath.replace(/\./g, '-')}`;
            const datalist = document.createElement('datalist');
            datalist.id = listId;
            for (let v = behavior.min; v <= behavior.max; v += behavior.step) {
                const opt = document.createElement('option');
                opt.value = String(v);
                datalist.appendChild(opt);
            }
            sliderContainer.appendChild(datalist);
            input.setAttribute('list', listId);
        }
    }

    sliderContainer.appendChild(input);

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'formspec-slider-value';
    if (behavior.showValue) {
        sliderContainer.appendChild(valueDisplay);
    }

    fieldDOM.root.appendChild(sliderContainer);
    finalizeFieldDOM(fieldDOM, behavior, actx);
    parent.appendChild(fieldDOM.root);

    const dispose = behavior.bind({
        root: fieldDOM.root,
        label: fieldDOM.label,
        control: sliderContainer,
        hint: fieldDOM.hint,
        error: fieldDOM.error,
    });
    actx.onDispose(dispose);
};
