/** @filedesc USWDS v3 adapter for TextInput — renders usa-input or usa-textarea markup. */
import type { TextInputBehavior, AdapterRenderFn } from '@formspec-org/webcomponent';
import { el } from '../helpers';
import { applyUSWDSValidationState, createUSWDSFieldDOM } from './shared';

export const renderTextInput: AdapterRenderFn<TextInputBehavior> = (
    behavior, parent, actx
) => {
    const p = behavior.presentation;
    const isTextarea = behavior.maxLines != null && behavior.maxLines > 1;

    const { root, label, hint, error, describedBy } = createUSWDSFieldDOM(behavior);

    if (p.labelPosition === 'start') root.style.display = 'flex';

    // Control
    let control: HTMLElement;

    if (isTextarea) {
        const textarea = document.createElement('textarea') as HTMLTextAreaElement;
        textarea.className = 'usa-textarea';
        textarea.id = behavior.id;
        textarea.name = behavior.fieldPath;
        textarea.rows = behavior.maxLines!;
        if (behavior.placeholder) textarea.placeholder = behavior.placeholder;
        textarea.setAttribute('aria-describedby', describedBy);
        control = textarea;
    } else {
        const input = document.createElement('input') as HTMLInputElement;
        input.className = 'usa-input';
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

        // Prefix/suffix: USWDS uses usa-input-prefix/usa-input-suffix
        if (behavior.prefix || behavior.suffix) {
            const group = el('div', { class: 'usa-input-group' });
            if (behavior.prefix) {
                const prefixEl = el('div', { class: 'usa-input-prefix' });
                prefixEl.textContent = behavior.prefix;
                group.appendChild(prefixEl);
            }
            group.appendChild(input);
            if (behavior.suffix) {
                const suffixEl = el('div', { class: 'usa-input-suffix' });
                suffixEl.textContent = behavior.suffix;
                group.appendChild(suffixEl);
            }
            root.appendChild(group);
            // control is the wrapper — bind() finds the deepest input inside
            control = group;
        } else {
            control = input;
        }
    }

    if (!control.parentElement) root.appendChild(control);

    root.appendChild(error);

    parent.appendChild(root);

    // Find the actual input element for error-class toggling
    const actualInput = control.querySelector('input') || control.querySelector('textarea') || control;

    const dispose = behavior.bind({
        root, label, control, hint, error,
        onValidationChange: (hasError) => {
            applyUSWDSValidationState(root, label, hasError, actualInput as HTMLElement);
        },
    });
    actx.onDispose(dispose);
};
