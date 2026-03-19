/** @filedesc USWDS v3 adapter for Toggle — USWDS has no toggle; uses usa-checkbox with label. */
import type { ToggleBehavior, AdapterRenderFn } from 'formspec-webcomponent';
import { el, applyCascadeClasses, applyCascadeAccessibility } from '../helpers';
import { createUSWDSError } from './shared';

export const renderToggle: AdapterRenderFn<ToggleBehavior> = (
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

    // Use the field label as the checkbox label. Append on/off labels if present.
    const labelText = behavior.label + (behavior.offLabel ? ` (${behavior.offLabel})` : '');
    const label = el('label', { class: 'usa-checkbox__label', for: behavior.id });
    label.textContent = labelText;
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
