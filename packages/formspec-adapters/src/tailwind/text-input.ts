/** @filedesc Tailwind adapter for TextInput — renders styled input or textarea. */
import type { TextInputBehavior, AdapterRenderFn } from 'formspec-webcomponent';
import { el } from '../helpers';
import { createTailwindFieldDOM, TW, toggleInputError } from './shared';

export const renderTextInput: AdapterRenderFn<TextInputBehavior> = (
    behavior, parent, actx
) => {
    const p = behavior.presentation;
    const isTextarea = behavior.maxLines != null && behavior.maxLines > 1;

    const { root, label, hint, error, describedBy } = createTailwindFieldDOM(behavior);

    if (p.labelPosition === 'start') root.style.display = 'flex';

    let control: HTMLElement;

    if (isTextarea) {
        const textarea = document.createElement('textarea') as HTMLTextAreaElement;
        textarea.className = TW.input;
        textarea.id = behavior.id;
        textarea.name = behavior.fieldPath;
        textarea.rows = behavior.maxLines!;
        if (behavior.placeholder) textarea.placeholder = behavior.placeholder;
        textarea.setAttribute('aria-describedby', describedBy);
        control = textarea;
    } else {
        const input = document.createElement('input') as HTMLInputElement;
        input.className = TW.input;
        input.id = behavior.id;
        input.name = behavior.fieldPath;
        input.type = behavior.resolvedInputType || 'text';
        if (behavior.placeholder) input.placeholder = behavior.placeholder;
        if (behavior.inputMode) input.inputMode = behavior.inputMode;
        for (const [attr, val] of Object.entries(behavior.extensionAttrs)) {
            if (attr === 'inputMode') input.inputMode = val;
            else if (attr === 'maxLength') input.maxLength = Number(val);
            else input.setAttribute(attr, val);
        }
        input.setAttribute('aria-describedby', describedBy);

        if (behavior.prefix || behavior.suffix) {
            const group = el('div', { class: 'flex rounded-md shadow-sm' });
            if (behavior.prefix) {
                const prefixEl = el('span', {
                    class: 'inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500',
                });
                prefixEl.textContent = behavior.prefix;
                group.appendChild(prefixEl);
                input.classList.remove('rounded-md');
                input.classList.add('rounded-none', 'rounded-r-md');
            }
            group.appendChild(input);
            if (behavior.suffix) {
                const suffixEl = el('span', {
                    class: 'inline-flex items-center rounded-r-md border border-l-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500',
                });
                suffixEl.textContent = behavior.suffix;
                group.appendChild(suffixEl);
                if (!behavior.prefix) {
                    input.classList.remove('rounded-md');
                    input.classList.add('rounded-none', 'rounded-l-md');
                } else {
                    input.classList.remove('rounded-r-md');
                    input.classList.add('rounded-none');
                }
            }
            root.appendChild(group);
            control = group;
        } else {
            control = input;
        }
    }

    if (!control.parentElement) root.appendChild(control);
    root.appendChild(error);
    parent.appendChild(root);

    const actualInput = control.querySelector('input') || control.querySelector('textarea') || control;

    const dispose = behavior.bind({
        root, label, control, hint, error,
        onValidationChange: (hasError) => {
            toggleInputError(actualInput, hasError);
        },
    });
    actx.onDispose(dispose);
};
