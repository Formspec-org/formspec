/** @filedesc USWDS v3 adapter for MoneyInput — composed prefix + amount field. */
import type { MoneyInputBehavior, AdapterRenderFn } from '@formspec-org/webcomponent';
import { el } from '../helpers';
import { applyUSWDSValidationState, createUSWDSFieldDOM } from './shared';

export const renderMoneyInput: AdapterRenderFn<MoneyInputBehavior> = (
    behavior, parent, actx
) => {
    const { root, label, hint, error, describedBy } = createUSWDSFieldDOM(behavior);

    const container = el('div', { class: 'formspec-money-field' });

    if (behavior.resolvedCurrency) {
        const prefix = el('span', { class: 'formspec-money-prefix', 'aria-hidden': 'true' });
        prefix.textContent = behavior.resolvedCurrency;
        container.appendChild(prefix);
    } else {
        const currencyInput = document.createElement('input') as HTMLInputElement;
        currencyInput.className = 'usa-input usa-input--2xs formspec-money-currency-input';
        currencyInput.type = 'text';
        currencyInput.placeholder = 'USD';
        currencyInput.id = `${behavior.id}-currency`;
        currencyInput.name = `${behavior.fieldPath}__currency`;
        currencyInput.setAttribute('aria-label', `${behavior.label} currency code`);
        currencyInput.maxLength = 3;
        container.appendChild(currencyInput);
    }

    const amountInput = document.createElement('input') as HTMLInputElement;
    amountInput.className = 'usa-input formspec-money-amount';
    amountInput.id = behavior.id;
    amountInput.name = `${behavior.fieldPath}__amount`;
    amountInput.type = 'number';
    if (behavior.placeholder) amountInput.placeholder = behavior.placeholder;
    if (behavior.step != null) amountInput.step = String(behavior.step);
    if (behavior.min != null) amountInput.min = String(behavior.min);
    if (behavior.max != null) amountInput.max = String(behavior.max);
    amountInput.setAttribute('aria-describedby', describedBy);
    container.appendChild(amountInput);

    root.appendChild(container);
    root.appendChild(error);

    parent.appendChild(root);

    const dispose = behavior.bind({
        root, label, control: container, hint, error,
        onValidationChange: (hasError) => {
            applyUSWDSValidationState(root, label, hasError);
            container.classList.toggle('formspec-money-field--error', hasError);
        },
    });
    actx.onDispose(dispose);
};
