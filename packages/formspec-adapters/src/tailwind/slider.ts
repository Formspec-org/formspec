/** @filedesc Tailwind adapter for Slider — range input with optional value display and ticks. */
import type { SliderBehavior, AdapterRenderFn } from 'formspec-webcomponent';
import { el } from '../helpers';
import { createTailwindFieldDOM } from './shared';

export const renderSlider: AdapterRenderFn<SliderBehavior> = (
    behavior, parent, actx
) => {
    const { root, label, hint, error } = createTailwindFieldDOM(behavior);

    const container = el('div', { class: 'flex flex-wrap items-center gap-2' });

    const input = document.createElement('input') as HTMLInputElement;
    input.className =
        'formspec-tw-range min-w-[10rem] flex-1 h-2 cursor-pointer rounded-full bg-zinc-700 accent-teal-500 appearance-none';
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
            const listId = `tw-ticks-${behavior.fieldPath.replace(/\./g, '-')}`;
            const datalist = document.createElement('datalist');
            datalist.id = listId;
            for (let v = behavior.min; v <= behavior.max; v += behavior.step) {
                const opt = document.createElement('option');
                opt.value = String(v);
                datalist.appendChild(opt);
            }
            container.appendChild(datalist);
            input.setAttribute('list', listId);
        }
    }

    container.appendChild(input);

    if (behavior.showValue) {
        const valueDisplay = el('span', {
            class: 'inline-flex min-w-[2.25rem] shrink-0 items-center justify-center rounded-lg bg-teal-900/40 px-2 py-0.5 text-sm font-semibold tabular-nums text-teal-200 ring-1 ring-teal-500/20 formspec-slider-value',
        });
        container.appendChild(valueDisplay);
    }

    root.appendChild(container);
    root.appendChild(error);
    parent.appendChild(root);

    const dispose = behavior.bind({
        root, label, control: container, hint, error,
        onValidationChange: (hasError) => {
            input.classList.toggle('accent-rose-500', hasError);
        },
    });
    actx.onDispose(dispose);
};
