/** @filedesc USWDS v3 adapter for MoneyInput — usa-input-group with currency prefix. */
import type { MoneyInputBehavior, AdapterRenderFn } from 'formspec-webcomponent';
import { el } from '../helpers';
import { createUSWDSFieldDOM } from './shared';

export const renderMoneyInput: AdapterRenderFn<MoneyInputBehavior> = (
    behavior, parent, actx
) => {
    const { root, label, hint, error, describedBy } = createUSWDSFieldDOM(behavior);

    // Input group with currency prefix
    const container = el('div', { class: 'usa-input-group' });

    if (behavior.resolvedCurrency) {
        const prefix = el('div', { class: 'usa-input-prefix', 'aria-hidden': 'true' });
        prefix.textContent = behavior.resolvedCurrency;
        container.appendChild(prefix);
    }

    const amountInput = document.createElement('input') as HTMLInputElement;
    amountInput.className = 'usa-input';
    amountInput.id = behavior.id;
    amountInput.name = `${behavior.fieldPath}__amount`;
    amountInput.type = 'number';
    if (behavior.placeholder) amountInput.placeholder = behavior.placeholder;
    if (behavior.step != null) amountInput.step = String(behavior.step);
    if (behavior.min != null) amountInput.min = String(behavior.min);
    if (behavior.max != null) amountInput.max = String(behavior.max);
    amountInput.setAttribute('aria-describedby', describedBy);
    container.appendChild(amountInput);

    if (!behavior.resolvedCurrency) {
        const currencyInput = document.createElement('input') as HTMLInputElement;
        currencyInput.className = 'usa-input formspec-money-currency-input';
        currencyInput.type = 'text';
        currencyInput.placeholder = 'Currency';
        currencyInput.name = `${behavior.fieldPath}__currency`;
        currencyInput.setAttribute('aria-label', 'Currency code');
        container.appendChild(currencyInput);
    }

    root.appendChild(container);

    root.appendChild(error);

    parent.appendChild(root);

    const dispose = behavior.bind({
        root, label, control: container, hint, error,
        onValidationChange: (hasError) => {
            root.classList.toggle('usa-form-group--error', hasError);
            amountInput.classList.toggle('usa-input--error', hasError);
        },
    });
    actx.onDispose(dispose);
};
