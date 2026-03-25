/** @filedesc NumberInput behavior hook — extracts reactive state for numeric fields. */
import { effect } from '@preact/signals-core';
import type { NumberInputBehavior, FieldRefs, BehaviorContext } from './types';
import { resolveFieldPath, toFieldId, resolveAndStripTokens, bindSharedFieldEffects, warnIfIncompatible } from './shared';

export function useNumberInput(ctx: BehaviorContext, comp: any): NumberInputBehavior {
    const fieldPath = resolveFieldPath(comp.bind, ctx.prefix);
    const id = comp.id || toFieldId(fieldPath);
    const item = ctx.findItemByKey(comp.bind);
    warnIfIncompatible('NumberInput', item?.dataType || 'string');
    const itemDesc = { key: item?.key || comp.bind, type: 'field' as const, dataType: item?.dataType || 'decimal' };
    const rawPresentation = ctx.resolveItemPresentation(itemDesc);
    const presentation = resolveAndStripTokens(rawPresentation, ctx.resolveToken, comp);
    const widgetClassSlots = ctx.resolveWidgetClassSlots(rawPresentation);
    const labelText = comp.labelOverride || item?.label || item?.key || comp.bind;

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
        dataType: item?.dataType || 'decimal',

        bind(refs: FieldRefs): () => void {
            const disposers = bindSharedFieldEffects(ctx, fieldPath, labelText, refs);

            const bindableInput = refs.control.querySelector('input') || refs.control;

            // Value sync: engine → DOM
            disposers.push(effect(() => {
                const sig = ctx.engine.signals[fieldPath];
                if (!sig) return;
                const val = sig.value;
                if (document.activeElement !== bindableInput) {
                    (bindableInput as HTMLInputElement).value = val ?? '';
                }
            }));

            // Value sync: DOM → engine
            bindableInput.addEventListener('input', (e) => {
                const target = e.target as HTMLInputElement;
                let val: number | null = target.value === '' ? null : Number(target.value);
                if (val !== null && !isNaN(val)) {
                    if (comp.min !== undefined && val < Number(comp.min)) val = Number(comp.min);
                    if (comp.max !== undefined && val > Number(comp.max)) val = Number(comp.max);
                }
                if (String(val) !== target.value) {
                    target.value = val === null ? '' : String(val);
                }
                ctx.engine.setValue(fieldPath, val);
            });

            return () => disposers.forEach(d => d());
        }
    };
}
