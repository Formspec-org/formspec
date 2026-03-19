/** @filedesc USWDS v3 adapter for Checkbox — renders a single boolean usa-checkbox. */
import type { FieldBehavior, AdapterRenderFn } from 'formspec-webcomponent';
import { el, applyCascadeClasses, applyCascadeAccessibility } from '../helpers';
import { createUSWDSError } from './shared';

export const renderCheckbox: AdapterRenderFn<FieldBehavior> = (
    behavior, parent, actx
) => {
    const p = behavior.presentation;

    const root = el('div', { class: 'usa-form-group', 'data-name': behavior.fieldPath });
    applyCascadeClasses(root, p);
    applyCascadeAccessibility(root, p);

    const wrapper = el('div', { class: 'usa-checkbox' });

    const input = document.createElement('input') as HTMLInputElement;
    input.className = 'usa-checkbox__input';
    input.id = behavior.id;
    input.type = 'checkbox';
    input.name = behavior.fieldPath;

    const describedBy = [
        behavior.hint ? `${behavior.id}-hint` : '',
        `${behavior.id}-error`,
    ].filter(Boolean).join(' ');
    input.setAttribute('aria-describedby', describedBy);

    // USWDS checkbox: label follows input, always visible (label text IS the checkbox label)
    const label = el('label', { class: 'usa-checkbox__label', for: behavior.id });
    label.textContent = behavior.label;
    if (p.labelPosition === 'hidden') label.classList.add('usa-sr-only');

    wrapper.appendChild(input);
    wrapper.appendChild(label);
    root.appendChild(wrapper);

    let hint: HTMLElement | undefined;
    if (behavior.hint) {
        const hintId = `${behavior.id}-hint`;
        hint = el('span', { class: 'usa-hint', id: hintId });
        hint.textContent = behavior.hint;
        root.appendChild(hint);
    }

    const error = createUSWDSError(behavior.id);
    root.appendChild(error);

    parent.appendChild(root);

    const dispose = behavior.bind({
        root, label, control: input, hint, error,
        onValidationChange: (hasError) => {
            root.classList.toggle('usa-form-group--error', hasError);
        },
    });
    actx.onDispose(dispose);
};
