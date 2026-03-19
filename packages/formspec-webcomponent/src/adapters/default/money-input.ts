/** @filedesc Default adapter for MoneyInput — renders a compound amount + currency input. */
import type { MoneyInputBehavior } from '../../behaviors/types';
import type { AdapterRenderFn } from '../types';
import { createFieldDOM, finalizeFieldDOM, applyControlSlotClass } from './shared';

export const renderMoneyInput: AdapterRenderFn<MoneyInputBehavior> = (
    behavior, parent, actx
) => {
    const fieldDOM = createFieldDOM(behavior, actx);

    const container = document.createElement('div');
    container.className = 'formspec-money';

    const amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.className = 'formspec-input';
    amountInput.placeholder = behavior.placeholder || 'Amount';
    amountInput.name = `${behavior.fieldPath}__amount`;
    amountInput.id = behavior.id;
    if (behavior.step != null) amountInput.step = String(behavior.step);
    if (behavior.min != null) amountInput.min = String(behavior.min);
    if (behavior.max != null) amountInput.max = String(behavior.max);
    amountInput.setAttribute('aria-describedby', fieldDOM.describedBy.join(' '));

    container.appendChild(amountInput);

    if (behavior.resolvedCurrency) {
        const badge = document.createElement('span');
        badge.className = 'formspec-money-currency';
        badge.textContent = behavior.resolvedCurrency;
        badge.setAttribute('aria-label', `Currency: ${behavior.resolvedCurrency}`);
        container.appendChild(badge);
    } else {
        const currencyInput = document.createElement('input');
        currencyInput.type = 'text';
        currencyInput.className = 'formspec-input formspec-money-currency-input';
        currencyInput.placeholder = 'Currency';
        currencyInput.name = `${behavior.fieldPath}__currency`;
        container.appendChild(currencyInput);
    }

    fieldDOM.root.appendChild(container);
    applyControlSlotClass(container, behavior, actx);
    finalizeFieldDOM(fieldDOM, behavior, actx);
    parent.appendChild(fieldDOM.root);

    const dispose = behavior.bind({
        root: fieldDOM.root,
        label: fieldDOM.label,
        control: container,
        hint: fieldDOM.hint,
        error: fieldDOM.error,
    });
    actx.onDispose(dispose);
};
