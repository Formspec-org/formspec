/** @filedesc Slider behavior hook — extracts reactive state for range slider fields. */
import { effect } from '@preact/signals-core';
import type { SliderBehavior, FieldRefs, BehaviorContext } from './types';
import { resolveFieldPath, toFieldId, resolveAndStripTokens } from './shared';

export function useSlider(ctx: BehaviorContext, comp: any): SliderBehavior {
    const fieldPath = resolveFieldPath(comp.bind, ctx.prefix);
    const id = comp.id || toFieldId(fieldPath);
    const item = ctx.findItemByKey(comp.bind);
    const itemDesc = { key: item?.key || comp.bind, type: 'field' as const, dataType: item?.dataType || 'number' };
    const rawPresentation = ctx.resolveItemPresentation(itemDesc);
    const presentation = resolveAndStripTokens(rawPresentation, ctx.resolveToken);
    const widgetClassSlots = ctx.resolveWidgetClassSlots(rawPresentation);

    const labelText = comp.labelOverride || item?.label || item?.key || comp.bind;

    return {
        fieldPath,
        id,
        label: labelText,
        hint: null,
        description: null,
        presentation,
        widgetClassSlots,
        compOverrides: {
            cssClass: comp.cssClass,
            style: comp.style,
            accessibility: comp.accessibility,
        },
        remoteOptionsState: { loading: false, error: null },
        options: () => [],
        min: comp.min ?? undefined,
        max: comp.max ?? undefined,
        step: comp.step ?? undefined,
        showTicks: comp.showTicks === true,
        showValue: comp.showValue !== false,

        bind(refs: FieldRefs): () => void {
            const disposers: Array<() => void> = [];

            // Value sync: DOM → engine (input event on range control)
            const rangeInput = refs.control.querySelector('input[type="range"]') || refs.control;
            rangeInput.addEventListener('input', () => {
                const val = (rangeInput as HTMLInputElement).value === '' ? null : Number((rangeInput as HTMLInputElement).value);
                ctx.engine.setValue(fieldPath, val);
            });

            // Value sync: engine → DOM + value display update
            const valueDisplay = refs.root.querySelector('.formspec-slider-value') as HTMLElement | null;
            disposers.push(effect(() => {
                const sig = ctx.engine.signals[fieldPath];
                if (!sig) return;
                const val = sig.value;
                if (document.activeElement !== rangeInput) {
                    (rangeInput as HTMLInputElement).value = val ?? '';
                }
                // Show signal value, or fall back to the native input value (range defaults to midpoint)
                if (valueDisplay) {
                    valueDisplay.textContent = val != null ? String(val) : (rangeInput as HTMLInputElement).value;
                }
            }));

            // Relevance
            disposers.push(effect(() => {
                const isRelevant = ctx.engine.relevantSignals[fieldPath]?.value ?? true;
                refs.root.classList.toggle('formspec-hidden', !isRelevant);
            }));

            return () => disposers.forEach(d => d());
        }
    };
}
