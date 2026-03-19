/** @filedesc MoneyInput behavior hook — extracts reactive state for compound money (amount + currency) fields. */
import { effect } from '@preact/signals-core';
import type { MoneyInputBehavior, FieldRefs, BehaviorContext } from './types';
import { resolveFieldPath, toFieldId, resolveAndStripTokens, bindSharedFieldEffects, warnIfIncompatible } from './shared';

export function useMoneyInput(ctx: BehaviorContext, comp: any): MoneyInputBehavior {
    const fieldPath = resolveFieldPath(comp.bind, ctx.prefix);
    const id = comp.id || toFieldId(fieldPath);
    const item = ctx.findItemByKey(comp.bind);
    warnIfIncompatible('MoneyInput', item?.dataType || 'string');
    const itemDesc = { key: item?.key || comp.bind, type: 'field' as const, dataType: item?.dataType || 'money' };
    const rawPresentation = ctx.resolveItemPresentation(itemDesc);
    const presentation = resolveAndStripTokens(rawPresentation, ctx.resolveToken, comp);
    const widgetClassSlots = ctx.resolveWidgetClassSlots(rawPresentation);
    const labelText = comp.labelOverride || item?.label || item?.key || comp.bind;

    // Resolve currency: fixed from item or definition default, or null for editable
    const definition = (ctx.engine as any)._definition;
    const resolvedCurrency = item?.currency || definition?.formPresentation?.defaultCurrency || null;

    return {
        fieldPath,
        id,
        label: labelText,
        hint: comp.hintOverride || item?.hint || null,
        description: item?.description || null,
        presentation,
        widgetClassSlots,
        compOverrides: {
            cssClass: comp.cssClass,
            style: comp.style,
            accessibility: comp.accessibility,
        },
        remoteOptionsState: { loading: false, error: null },
        options: () => [],
        min: comp.min,
        max: comp.max,
        step: comp.step,
        placeholder: comp.placeholder,
        resolvedCurrency,

        bind(refs: FieldRefs): () => void {
            const disposers = bindSharedFieldEffects(ctx, fieldPath, labelText, refs);

            // Find amount and currency inputs by class name convention
            const amountInput = refs.control.querySelector('input[type="number"]') as HTMLInputElement | null;
            const currencyInput = refs.control.querySelector('.formspec-money-currency-input') as HTMLInputElement | null;
            const getCurrency = (): string => {
                if (resolvedCurrency) return resolvedCurrency;
                return currencyInput?.value || '';
            };

            // Amount input: DOM → engine
            if (amountInput) {
                const updateMoney = () => {
                    let amount = amountInput.value === '' ? null : Number(amountInput.value);
                    if (amount !== null && !isNaN(amount)) {
                        if (comp.min !== undefined && amount < Number(comp.min)) amount = Number(comp.min);
                        if (comp.max !== undefined && amount > Number(comp.max)) amount = Number(comp.max);
                    }
                    ctx.engine.setValue(fieldPath, { amount, currency: getCurrency() });
                };
                amountInput.addEventListener('input', updateMoney);

                // Amount: engine → DOM
                disposers.push(effect(() => {
                    const sig = ctx.engine.signals[fieldPath];
                    if (!sig) return;
                    const v = sig.value;
                    if (document.activeElement !== amountInput) {
                        if (v !== null && v !== undefined && typeof v === 'object' && 'amount' in v) {
                            const a = (v as any).amount;
                            amountInput.value = a !== null && a !== undefined
                                ? String(Math.round(a * 100) / 100)
                                : '';
                        } else if (typeof v === 'number') {
                            amountInput.value = String(Math.round(v * 100) / 100);
                        }
                    }
                }));
            }

            // Currency input: DOM → engine (only when editable)
            if (currencyInput) {
                currencyInput.addEventListener('input', () => {
                    const amount = amountInput ? (amountInput.value === '' ? null : Number(amountInput.value)) : null;
                    ctx.engine.setValue(fieldPath, { amount, currency: currencyInput.value });
                });

                // Currency: engine → DOM
                disposers.push(effect(() => {
                    const sig = ctx.engine.signals[fieldPath];
                    if (!sig) return;
                    const v = sig.value;
                    if (document.activeElement !== currencyInput && v != null && typeof v === 'object' && 'currency' in v) {
                        currencyInput.value = (v as any).currency || '';
                    }
                }));
            }

            return () => disposers.forEach(d => d());
        }
    };
}
