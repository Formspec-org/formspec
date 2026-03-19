/** @filedesc Default adapter for Rating — star-rating DOM with shared field infrastructure. */
import type { RatingBehavior } from '../../behaviors/types';
import type { AdapterRenderFn } from '../types';
import { createFieldDOM, finalizeFieldDOM } from './shared';

export const renderRating: AdapterRenderFn<RatingBehavior> = (
    behavior, parent, actx
) => {
    const fieldDOM = createFieldDOM(behavior, actx);
    fieldDOM.root.classList.add('formspec-rating');

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

    fieldDOM.root.appendChild(container);
    finalizeFieldDOM(fieldDOM, behavior, actx);
    parent.appendChild(fieldDOM.root);

    const dispose = behavior.bind({
        root: fieldDOM.root,
        label: fieldDOM.label,
        control: container,
        hint: fieldDOM.hint,
        error: fieldDOM.error,
    });
    actx.onDispose(dispose);
};
