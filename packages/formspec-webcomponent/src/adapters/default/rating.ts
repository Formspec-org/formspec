/** @filedesc Default adapter for Rating — reproduces current star-rating DOM structure. */
import type { RatingBehavior } from '../../behaviors/types';
import type { AdapterRenderFn } from '../types';

export const renderRating: AdapterRenderFn<RatingBehavior> = (
    behavior, parent, actx
) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'formspec-field formspec-rating';
    wrapper.dataset.name = behavior.fieldPath;

    const label = document.createElement('label');
    label.className = 'formspec-label';
    label.textContent = behavior.label;
    wrapper.appendChild(label);

    const container = document.createElement('div');
    container.className = 'formspec-rating-stars';

    for (let i = 1; i <= behavior.maxRating; i++) {
        const star = document.createElement('span');
        star.className = 'formspec-rating-star';
        star.textContent = behavior.icon;
        star.dataset.value = String(i);
        star.addEventListener('click', (event: MouseEvent) => {
            let value = i;
            if (behavior.allowHalf) {
                const rect = star.getBoundingClientRect();
                const clickedLeftHalf = rect.width > 0 && (event.clientX - rect.left) < rect.width / 2;
                value = clickedLeftHalf ? i - 0.5 : i;
            }
            behavior.setValue(value);
        });
        container.appendChild(star);
    }

    wrapper.appendChild(container);

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
        control: container,
    });
    actx.onDispose(dispose);
};
