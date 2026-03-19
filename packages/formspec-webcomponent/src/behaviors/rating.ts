/** @filedesc Rating behavior hook — extracts reactive state for icon-rating fields. */
import { effect } from '@preact/signals-core';
import type { RatingBehavior, FieldRefs, BehaviorContext } from './types';
import { resolveFieldPath, toFieldId, resolveAndStripTokens } from './shared';

const RATING_ICON_MAP: Record<string, string> = {
    star: '\u2605',
    heart: '\u2665',
    circle: '\u25cf',
};

function resolveRatingIcon(icon?: string): string {
    if (!icon) return RATING_ICON_MAP.star;
    return RATING_ICON_MAP[icon] || icon;
}

export function useRating(ctx: BehaviorContext, comp: any): RatingBehavior {
    const fieldPath = resolveFieldPath(comp.bind, ctx.prefix);
    const id = comp.id || toFieldId(fieldPath);
    const item = ctx.findItemByKey(comp.bind);
    const itemDesc = { key: item?.key || comp.bind, type: 'field' as const, dataType: item?.dataType || 'number' };
    const rawPresentation = ctx.resolveItemPresentation(itemDesc);
    const presentation = resolveAndStripTokens(rawPresentation, ctx.resolveToken);
    const widgetClassSlots = ctx.resolveWidgetClassSlots(rawPresentation);

    const labelText = comp.labelOverride || item?.label || item?.key || comp.bind;
    const maxRating = comp.max || 5;
    const isInteger = item?.dataType === 'integer';
    const allowHalf = comp.allowHalf === true;
    const icon = resolveRatingIcon(comp.icon);

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
        maxRating,
        icon,
        allowHalf,
        isInteger,

        setValue(value: number): void {
            const finalValue = isInteger ? Math.round(value) : value;
            ctx.engine.setValue(fieldPath, finalValue);
        },

        bind(refs: FieldRefs): () => void {
            const disposers: Array<() => void> = [];

            // Sync star selection classes from engine value
            const stars = refs.control.querySelectorAll('.formspec-rating-star');
            disposers.push(effect(() => {
                const sig = ctx.engine.signals[fieldPath];
                const val = sig?.value ?? 0;
                stars.forEach((star, idx) => {
                    const fullValue = idx + 1;
                    const halfValue = idx + 0.5;
                    const isSelected = fullValue <= val;
                    const isHalfSelected = allowHalf && !isSelected && halfValue <= val;
                    star.classList.toggle('formspec-rating-star--selected', isSelected);
                    star.classList.toggle('formspec-rating-star--half', isHalfSelected);
                });
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
