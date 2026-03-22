/** @filedesc Tailwind adapter for CheckboxGroup — card-style multi-select grid. */
import type { CheckboxGroupBehavior, AdapterRenderFn } from 'formspec-webcomponent';
import { el, applyCascadeClasses, applyCascadeAccessibility } from '../helpers';
import { createTailwindError, TW, TW_CARD_OPTION } from './shared';

function optionGridClass(columns?: number): string {
    if (columns === 3) return 'grid gap-3 mt-3 sm:grid-cols-2 lg:grid-cols-3';
    if (columns === 2) return 'grid gap-3 mt-3 sm:grid-cols-2';
    return 'grid gap-3 mt-3';
}

function buildCheckboxOptions(
    behavior: CheckboxGroupBehavior,
    container: HTMLElement,
    options: ReadonlyArray<{ value: string; label: string }>,
): Map<string, HTMLInputElement> {
    container.innerHTML = '';
    const controls = new Map<string, HTMLInputElement>();

    for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const optId = `${behavior.id}-${i}`;

        const card = el('label', { class: TW_CARD_OPTION, for: optId });

        const input = document.createElement('input') as HTMLInputElement;
        input.className = TW.controlSm;
        input.id = optId;
        input.type = 'checkbox';
        input.name = behavior.fieldPath;
        input.value = opt.value;
        controls.set(opt.value, input);

        const text = el('span', { class: TW.optionLabelText });
        text.textContent = opt.label;

        card.appendChild(input);
        card.appendChild(text);
        container.appendChild(card);
    }

    return controls;
}

export const renderCheckboxGroup: AdapterRenderFn<CheckboxGroupBehavior> = (
    behavior, parent, actx
) => {
    const p = behavior.presentation;

    const fieldset = el('fieldset', { class: TW.fieldset });
    applyCascadeClasses(fieldset, p);
    applyCascadeAccessibility(fieldset, p);

    const legend = el('legend', {
        class: p.labelPosition === 'hidden' ? TW.labelHidden : TW.legend,
    });
    legend.textContent = behavior.label;
    fieldset.appendChild(legend);

    let hint: HTMLElement | undefined;
    if (behavior.hint) {
        const hintId = `${behavior.id}-hint`;
        hint = el('p', { class: TW.hint, id: hintId });
        hint.textContent = behavior.hint;
        fieldset.appendChild(hint);
    }

    // Select All — compact row above the grid
    if (behavior.selectAll && behavior.options().length > 0) {
        const selectAllRow = el('div', {
            class: 'mt-2 flex items-center gap-3 rounded-lg border border-dashed border-zinc-700/80 bg-zinc-800/50 px-3 py-2.5',
        });
        const selectAllId = `${behavior.id}-select-all`;

        const selectAllCb = document.createElement('input') as HTMLInputElement;
        selectAllCb.className = TW.controlSm;
        selectAllCb.id = selectAllId;
        selectAllCb.type = 'checkbox';
        selectAllCb.addEventListener('change', () => {
            const checked: string[] = [];
            for (const [optVal, cb] of optionControlsRef) {
                cb.checked = selectAllCb.checked;
                if (cb.checked) checked.push(optVal);
            }
            behavior.setValue(checked);
        });

        const selectAllLabel = el('label', {
            class: 'cursor-pointer text-sm font-semibold text-zinc-300',
            for: selectAllId,
        });
        selectAllLabel.textContent = 'Select all';
        selectAllRow.appendChild(selectAllCb);
        selectAllRow.appendChild(selectAllLabel);
        fieldset.appendChild(selectAllRow);
    }

    const optionContainer = el('div', { class: optionGridClass(behavior.columns) });
    let optionControlsRef = buildCheckboxOptions(behavior, optionContainer, behavior.options());
    fieldset.appendChild(optionContainer);

    const error = createTailwindError(behavior.id);
    fieldset.appendChild(error);

    parent.appendChild(fieldset);

    const dispose = behavior.bind({
        root: fieldset,
        label: legend,
        control: fieldset,
        hint,
        error,
        optionControls: optionControlsRef,
        rebuildOptions: (_container, newOptions) => {
            optionControlsRef = buildCheckboxOptions(behavior, optionContainer, newOptions);
            return optionControlsRef;
        },
        onValidationChange: (hasError) => {
            fieldset.classList.toggle('ring-2', hasError);
            fieldset.classList.toggle('ring-rose-400/60', hasError);
            fieldset.classList.toggle('rounded-xl', hasError);
        },
    });
    actx.onDispose(dispose);
};
