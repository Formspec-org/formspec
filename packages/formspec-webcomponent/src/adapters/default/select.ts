/** @filedesc Default adapter for Select — renders a dropdown select element. */
import type { SelectBehavior } from '../../behaviors/types';
import type { AdapterRenderFn } from '../types';
import { createFieldDOM, finalizeFieldDOM, applyControlSlotClass } from './shared';

export const renderSelect: AdapterRenderFn<SelectBehavior> = (
    behavior, parent, actx
) => {
    const fieldDOM = createFieldDOM(behavior, actx);

    const select = document.createElement('select');
    select.className = 'formspec-input';
    select.name = behavior.fieldPath;
    select.id = behavior.id;

    {
        const placeholderOpt = document.createElement('option');
        placeholderOpt.value = '';
        placeholderOpt.textContent = behavior.placeholder || 'Select\u2026';
        placeholderOpt.disabled = true;
        placeholderOpt.selected = true;
        select.appendChild(placeholderOpt);
    }

    if (behavior.clearable) {
        const clearOpt = document.createElement('option');
        clearOpt.value = '';
        clearOpt.textContent = '\u2014 Clear \u2014';
        select.appendChild(clearOpt);
    }

    const options = behavior.options();
    for (const opt of options) {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        select.appendChild(option);
    }

    select.setAttribute('aria-describedby', fieldDOM.describedBy.join(' '));

    fieldDOM.root.appendChild(select);
    applyControlSlotClass(select, behavior, actx);
    finalizeFieldDOM(fieldDOM, behavior, actx);
    parent.appendChild(fieldDOM.root);

    const dispose = behavior.bind({
        root: fieldDOM.root,
        label: fieldDOM.label,
        control: select,
        hint: fieldDOM.hint,
        error: fieldDOM.error,
        rebuildOptions: (_container, newOptions) => {
            // Keep placeholder/clear options, remove the rest
            const keepCount = (behavior.placeholder ? 1 : 0) + (behavior.clearable ? 1 : 0);
            while (select.options.length > keepCount) select.remove(select.options.length - 1);
            const controls = new Map<string, HTMLInputElement>();
            for (const opt of newOptions) {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                select.appendChild(option);
            }
            return controls;
        },
    });
    actx.onDispose(dispose);
};
