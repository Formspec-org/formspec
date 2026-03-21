/** @filedesc Tailwind adapter for MoneyInput — input group with currency prefix. */
import type { MoneyInputBehavior, AdapterRenderFn } from 'formspec-webcomponent';
import { el } from '../helpers';
import { createTailwindFieldDOM, TW, toggleInputError } from './shared';

export const renderMoneyInput: AdapterRenderFn<MoneyInputBehavior> = (
    behavior, parent, actx
) => {
    const { root, label, hint, error, describedBy } = createTailwindFieldDOM(behavior);

    const container = el('div', { class: 'flex rounded-md shadow-sm' });

    if (behavior.resolvedCurrency) {
        const prefix = el('span', {
            class: 'inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500',
            'aria-hidden': 'true',
        });
        prefix.textContent = behavior.resolvedCurrency;
        container.appendChild(prefix);
    }

    const amountInput = document.createElement('input') as HTMLInputElement;
    amountInput.className = TW.input;
    amountInput.id = behavior.id;
    amountInput.name = `${behavior.fieldPath}__amount`;
    amountInput.type = 'number';
    if (behavior.placeholder) amountInput.placeholder = behavior.placeholder;
    if (behavior.step != null) amountInput.step = String(behavior.step);
    if (behavior.min != null) amountInput.min = String(behavior.min);
    if (behavior.max != null) amountInput.max = String(behavior.max);
    amountInput.setAttribute('aria-describedby', describedBy);

    if (behavior.resolvedCurrency) {
        amountInput.classList.remove('rounded-md');
        amountInput.classList.add('rounded-none', 'rounded-r-md');
    }
    container.appendChild(amountInput);

    if (!behavior.resolvedCurrency) {
        const currencyInput = document.createElement('input') as HTMLInputElement;
        currencyInput.className = 'block w-20 rounded-r-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm';
        currencyInput.type = 'text';
        currencyInput.placeholder = 'Currency';
        currencyInput.name = `${behavior.fieldPath}__currency`;
        currencyInput.setAttribute('aria-label', 'Currency code');
        amountInput.classList.remove('rounded-md');
        amountInput.classList.add('rounded-none', 'rounded-l-md');
        container.appendChild(currencyInput);
    }

    root.appendChild(container);
    root.appendChild(error);
    parent.appendChild(root);

    const dispose = behavior.bind({
        root, label, control: container, hint, error,
        onValidationChange: (hasError) => {
            toggleInputError(amountInput, hasError);
        },
    });
    actx.onDispose(dispose);
};
