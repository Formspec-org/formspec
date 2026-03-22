/** @filedesc Tailwind adapter for Rating — star-rating with ARIA slider pattern. */
import type { RatingBehavior, AdapterRenderFn } from 'formspec-webcomponent';
import { el } from '../helpers';
import { createTailwindFieldDOM } from './shared';

export const renderRating: AdapterRenderFn<RatingBehavior> = (
    behavior, parent, actx
) => {
    const { root, label, hint, error, describedBy } = createTailwindFieldDOM(behavior, { labelFor: false });

    const container = el('div', {
        class: 'formspec-rating-stars flex flex-wrap items-center gap-1 rounded-xl border border-zinc-700/80 bg-zinc-900/50 px-3 py-2',
        role: 'slider',
    });
    container.setAttribute('tabindex', '0');
    container.setAttribute('aria-valuemin', '0');
    container.setAttribute('aria-valuemax', String(behavior.maxRating));
    container.setAttribute('aria-valuenow', '0');
    container.setAttribute('aria-valuetext', `0 of ${behavior.maxRating}`);
    container.setAttribute('aria-label', behavior.label);
    container.setAttribute('aria-describedby', describedBy);

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
        star.className =
            'formspec-rating-star cursor-pointer select-none text-3xl text-zinc-600 transition-colors hover:scale-110 hover:text-teal-400';
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
    root.appendChild(error);
    parent.appendChild(root);

    const dispose = behavior.bind({
        root, label, control: container, hint, error,
        onValidationChange: (hasError) => {
            container.classList.toggle('ring-2', hasError);
            container.classList.toggle('ring-red-500', hasError);
            container.classList.toggle('rounded', hasError);
        },
    });
    actx.onDispose(dispose);
};
