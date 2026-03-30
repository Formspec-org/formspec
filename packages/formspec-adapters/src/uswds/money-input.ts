/** @filedesc USWDS v3 adapter for MoneyInput — usa-input-group (fixed currency) or grid row (editable code + amount). */
import type { MoneyInputBehavior, AdapterRenderFn } from '@formspec-org/webcomponent';
import { el } from '../helpers';
import { applyUSWDSValidationState, createUSWDSFieldDOM } from './shared';

export const renderMoneyInput: AdapterRenderFn<MoneyInputBehavior> = (
    behavior, parent, actx
) => {
    const { root, label, hint, error } = createUSWDSFieldDOM(behavior);

    const amountInput = document.createElement('input') as HTMLInputElement;
    amountInput.className = 'usa-input formspec-money-amount';
    amountInput.id = behavior.id;
    amountInput.name = `${behavior.fieldPath}__amount`;
    amountInput.type = 'number';
    if (behavior.placeholder) amountInput.placeholder = behavior.placeholder;
    if (behavior.step != null) amountInput.step = String(behavior.step);
    if (behavior.min != null) amountInput.min = String(behavior.min);
    if (behavior.max != null) amountInput.max = String(behavior.max);

    let container: HTMLElement;

    if (behavior.resolvedCurrency) {
        const group = el('div', { class: 'usa-input-group' });
        const prefix = el('div', { class: 'usa-input-prefix' });
        prefix.textContent = behavior.resolvedCurrency;
        group.appendChild(prefix);
        group.appendChild(amountInput);
        container = group;
    } else {
        const currencyInput = document.createElement('input') as HTMLInputElement;
        currencyInput.className = 'usa-input usa-input--2xs formspec-money-currency-input';
        currencyInput.type = 'text';
        currencyInput.placeholder = 'USD';
        currencyInput.id = `${behavior.id}-currency`;
        currencyInput.name = `${behavior.fieldPath}__currency`;
        currencyInput.setAttribute('aria-label', `${behavior.label} currency code`);
        currencyInput.maxLength = 3;

        const row = el('div', { class: 'grid-row grid-gap-1' });
        const curCell = el('div', { class: 'grid-col-12 tablet:grid-col-3' });
        const amtCell = el('div', { class: 'grid-col-12 tablet:grid-col-9' });
        curCell.appendChild(currencyInput);
        amtCell.appendChild(amountInput);
        row.appendChild(curCell);
        row.appendChild(amtCell);
        container = row;
    }

    root.appendChild(container);

    parent.appendChild(root);

    const dispose = behavior.bind({
        root, label, control: container, hint, error,
        onValidationChange: (hasError) => {
            applyUSWDSValidationState(root, label, hasError);
            if (container.classList.contains('usa-input-group')) {
                container.classList.toggle('usa-input-group--error', hasError);
            }
        },
    });
    actx.onDispose(dispose);
};
