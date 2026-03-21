/** @filedesc Tailwind adapter for Checkbox — renders a single boolean checkbox. */
import type { FieldBehavior, AdapterRenderFn } from 'formspec-webcomponent';
import { el, applyCascadeClasses, applyCascadeAccessibility } from '../helpers';
import { createTailwindError, TW } from './shared';

export const renderCheckbox: AdapterRenderFn<FieldBehavior> = (
    behavior, parent, actx
) => {
    const p = behavior.presentation;

    const root = el('div', { class: TW.group, 'data-name': behavior.fieldPath });
    applyCascadeClasses(root, p);
    applyCascadeAccessibility(root, p);

    const wrapper = el('div', { class: TW.optionWrapper });

    const input = document.createElement('input') as HTMLInputElement;
    input.className = TW.checkbox;
    input.id = behavior.id;
    input.type = 'checkbox';
    input.name = behavior.fieldPath;

    const describedBy = [
        behavior.hint ? `${behavior.id}-hint` : '',
        `${behavior.id}-error`,
    ].filter(Boolean).join(' ');
    input.setAttribute('aria-describedby', describedBy);

    const label = el('label', { class: TW.optionLabel, for: behavior.id });
    label.textContent = behavior.label;
    if (p.labelPosition === 'hidden') label.classList.add('sr-only');

    wrapper.appendChild(input);
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
            input.classList.toggle('border-red-500', hasError);
        },
    });
    actx.onDispose(dispose);
};
