/** @filedesc Signature behavior hook — extracts reactive state for signature canvas fields. */
import { effect } from '@preact/signals-core';
import type { SignatureBehavior, FieldRefs, BehaviorContext } from './types';
import { resolveFieldPath, toFieldId, resolveAndStripTokens, warnIfIncompatible } from './shared';

export function useSignature(ctx: BehaviorContext, comp: any): SignatureBehavior {
    const fieldPath = resolveFieldPath(comp.bind, ctx.prefix);
    const id = comp.id || toFieldId(fieldPath);
    const item = ctx.findItemByKey(comp.bind);
    warnIfIncompatible('Signature', item?.dataType || 'string');
    const itemDesc = { key: item?.key || comp.bind, type: 'field' as const, dataType: item?.dataType || 'string' };
    const rawPresentation = ctx.resolveItemPresentation(itemDesc);
    const presentation = resolveAndStripTokens(rawPresentation, ctx.resolveToken, comp);
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
        height: comp.height || 200,
        strokeColor: comp.strokeColor || '#000',

        bind(refs: FieldRefs): () => void {
            const disposers: Array<() => void> = [];

            // Listen for signature drawn event from adapter
            refs.root.addEventListener('formspec-signature-drawn', (e: Event) => {
                const detail = (e as CustomEvent).detail;
                if (detail?.dataUrl) ctx.engine.setValue(fieldPath, detail.dataUrl);
            });

            // Listen for signature cleared event from adapter
            refs.root.addEventListener('formspec-signature-cleared', () => {
                ctx.engine.setValue(fieldPath, null);
            });

            // Relevance
            disposers.push(effect(() => {
                const isRelevant = ctx.engine.relevantSignals[fieldPath]?.value ?? true;
                refs.root.classList.toggle('formspec-hidden', !isRelevant);
            }));

            return () => disposers.forEach(d => d());
        }
    };
}
