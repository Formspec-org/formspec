/** @filedesc Tailwind adapter for Toggle — renders a toggle switch with Tailwind styling. */
import type { ToggleBehavior, AdapterRenderFn } from 'formspec-webcomponent';
import { el, applyCascadeClasses, applyCascadeAccessibility } from '../helpers';
import { createTailwindError, TW } from './shared';

export const renderToggle: AdapterRenderFn<ToggleBehavior> = (
    behavior, parent, actx
) => {
    const p = behavior.presentation;

    const root = el('div', { class: TW.group, 'data-name': behavior.fieldPath });
    applyCascadeClasses(root, p);
    applyCascadeAccessibility(root, p);

    const wrapper = el('div', { class: 'flex items-center gap-3' });

    // Hidden checkbox for form semantics
    const input = document.createElement('input') as HTMLInputElement;
    input.type = 'checkbox';
    input.id = behavior.id;
    input.name = behavior.fieldPath;
    input.className = 'sr-only peer';

    // Visual toggle track
    const track = el('label', {
        class: 'relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full bg-gray-200 transition-colors peer-checked:bg-blue-600 peer-focus:ring-2 peer-focus:ring-blue-500 peer-focus:ring-offset-2',
        for: behavior.id,
        role: 'switch',
    });

    // Toggle knob
    const knob = el('span', {
        class: 'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform translate-x-1 peer-checked:translate-x-6',
    });
    track.appendChild(knob);

    const describedBy = [
        behavior.hint ? `${behavior.id}-hint` : '',
        `${behavior.id}-error`,
    ].filter(Boolean).join(' ');
    input.setAttribute('aria-describedby', describedBy);

    // Label text
    const labelText = behavior.label + (behavior.offLabel ? ` (${behavior.offLabel})` : '');
    const label = el('span', {
        class: p.labelPosition === 'hidden' ? 'sr-only' : 'text-sm text-gray-700',
    });
    label.textContent = labelText;

    wrapper.appendChild(input);
    wrapper.appendChild(track);
    wrapper.appendChild(label);
    root.appendChild(wrapper);

    let hint: HTMLElement | undefined;
    if (behavior.hint) {
        const hintId = `${behavior.id}-hint`;
        hint = el('p', { class: TW.hint, id: hintId });
        hint.textContent = behavior.hint;
        root.appendChild(hint);
    }

    const error = createTailwindError(behavior.id);
    root.appendChild(error);

    parent.appendChild(root);

    const dispose = behavior.bind({
        root, label, control: input, hint, error,
        onValidationChange: (hasError) => {
            track.classList.toggle('ring-2', hasError);
            track.classList.toggle('ring-red-500', hasError);
        },
    });
    actx.onDispose(dispose);
};
