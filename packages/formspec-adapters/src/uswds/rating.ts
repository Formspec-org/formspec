/** @filedesc USWDS v3 adapter for Rating — star-rating with USWDS form-group wrapper and ARIA slider. */
import type { RatingBehavior, AdapterRenderFn } from '@formspec-org/webcomponent';
import { el } from '../helpers';
import { applyUSWDSValidationState, createUSWDSFieldDOM } from './shared';

export const renderRating: AdapterRenderFn<RatingBehavior> = (
    behavior, parent, actx
) => {
    const { root, label, hint, error } = createUSWDSFieldDOM(behavior, { labelFor: false });

    // Stars container — ARIA slider pattern (matches default adapter)
    const container = el('div', { class: 'formspec-rating-stars', role: 'slider' });
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

    // Container-level keyboard handling
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

    // Star elements — click only (keyboard handled at container level)
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

    root.appendChild(container);

    parent.appendChild(root);

    const dispose = behavior.bind({
        root, label, control: container, hint, error,
        onValidationChange: (hasError) => {
            applyUSWDSValidationState(root, label, hasError);
        },
    });
    actx.onDispose(dispose);
};
