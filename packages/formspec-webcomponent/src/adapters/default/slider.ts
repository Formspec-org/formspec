/** @filedesc Default adapter for Slider — reproduces current range input DOM structure. */
import type { SliderBehavior } from '../../behaviors/types';
import type { AdapterRenderFn } from '../types';

export const renderSlider: AdapterRenderFn<SliderBehavior> = (
    behavior, parent, actx
) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'formspec-field formspec-slider';
    wrapper.dataset.name = behavior.fieldPath;

    const label = document.createElement('label');
    label.className = 'formspec-label';
    label.textContent = behavior.label;
    wrapper.appendChild(label);

    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'formspec-slider-track';

    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'formspec-input';
    input.name = behavior.fieldPath;
    if (behavior.min != null) input.min = String(behavior.min);
    if (behavior.max != null) input.max = String(behavior.max);
    if (behavior.step != null) input.step = String(behavior.step);

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

    wrapper.appendChild(sliderContainer);

    actx.applyCssClass(wrapper, behavior.presentation);
    actx.applyAccessibility(wrapper, behavior.presentation);
    actx.applyStyle(wrapper, behavior.presentation.style);
    if (behavior.compOverrides.cssClass) actx.applyCssClass(wrapper, behavior.compOverrides);
    if (behavior.compOverrides.accessibility) actx.applyAccessibility(wrapper, behavior.compOverrides);
    if (behavior.compOverrides.style) actx.applyStyle(wrapper, behavior.compOverrides.style);
    parent.appendChild(wrapper);

    const dispose = behavior.bind({
        root: wrapper,
        label,
        control: sliderContainer,
    });
    actx.onDispose(dispose);
};
