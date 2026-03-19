/** @filedesc Default adapter for Toggle — renders a checkbox wrapped in a toggle container with labels. */
import type { ToggleBehavior } from '../../behaviors/types';
import type { AdapterRenderFn } from '../types';
import { createFieldDOM, finalizeFieldDOM, applyControlSlotClass } from './shared';

export const renderToggle: AdapterRenderFn<ToggleBehavior> = (
    behavior, parent, actx
) => {
    const fieldDOM = createFieldDOM(behavior, actx);

    // Toggle/Checkbox special case: when labelPosition is 'top' (default),
    // the original field-input.ts adds formspec-field--inline (lines 82-84).
    const effectiveLP = behavior.presentation.labelPosition || 'top';
    if (effectiveLP === 'top') {
        fieldDOM.root.classList.add('formspec-field--inline');
    }

    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'formspec-toggle';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'formspec-input';
    checkbox.name = behavior.fieldPath;
    checkbox.id = behavior.id;
    checkbox.setAttribute('role', 'switch');
    checkbox.setAttribute('aria-describedby', fieldDOM.describedBy.join(' '));
    toggleContainer.appendChild(checkbox);

    if (behavior.onLabel || behavior.offLabel) {
        const toggleLabel = document.createElement('span');
        toggleLabel.className = 'formspec-toggle-label';
        toggleLabel.textContent = behavior.offLabel || '';
        toggleContainer.appendChild(toggleLabel);
    }

    fieldDOM.root.appendChild(toggleContainer);
    applyControlSlotClass(toggleContainer, behavior, actx);
    finalizeFieldDOM(fieldDOM, behavior, actx);
    parent.appendChild(fieldDOM.root);

    const dispose = behavior.bind({
        root: fieldDOM.root,
        label: fieldDOM.label,
        control: toggleContainer,
        hint: fieldDOM.hint,
        error: fieldDOM.error,
    });
    actx.onDispose(dispose);
};
