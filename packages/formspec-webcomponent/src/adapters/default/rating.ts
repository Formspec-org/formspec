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
    container.setAttribute('role', 'slider');
    container.setAttribute('tabindex', '0');
    container.setAttribute('aria-valuemin', '0');
    container.setAttribute('aria-valuemax', String(behavior.maxRating));
    container.setAttribute('aria-valuenow', '0');
    container.setAttribute('aria-valuetext', `0 of ${behavior.maxRating}`);
    container.setAttribute('aria-label', behavior.label);

    const step = behavior.allowHalf ? 0.5 : 1;
    let currentValue = 0;

    const updateValue = (value: number) => {
        currentValue = Math.max(0, Math.min(value, behavior.maxRating));
        container.setAttribute('aria-valuenow', String(currentValue));
        container.setAttribute('aria-valuetext', `${currentValue} of ${behavior.maxRating}`);
        behavior.setValue(currentValue);
    };

    container.addEventListener('keydown', (e: KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowRight':
            case 'ArrowUp':
                e.preventDefault();
                updateValue(currentValue + step);
                break;
            case 'ArrowLeft':
            case 'ArrowDown':
                e.preventDefault();
                updateValue(currentValue - step);
                break;
            case 'Home':
                e.preventDefault();
                updateValue(0);
                break;
            case 'End':
                e.preventDefault();
                updateValue(behavior.maxRating);
                break;
        }
    });

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
            updateValue(value);
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
