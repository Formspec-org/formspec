/** @filedesc FileUpload behavior hook — extracts reactive state for file input fields. */
import { effect } from '@preact/signals-core';
import type { FileUploadBehavior, FieldRefs, BehaviorContext } from './types';
import { resolveFieldPath, toFieldId, resolveAndStripTokens } from './shared';

export function useFileUpload(ctx: BehaviorContext, comp: any): FileUploadBehavior {
    const fieldPath = resolveFieldPath(comp.bind, ctx.prefix);
    const id = comp.id || toFieldId(fieldPath);
    const item = ctx.findItemByKey(comp.bind);
    const itemDesc = { key: item?.key || comp.bind, type: 'field' as const, dataType: item?.dataType || 'string' };
    const rawPresentation = ctx.resolveItemPresentation(itemDesc);
    const presentation = resolveAndStripTokens(rawPresentation, ctx.resolveToken);
    const widgetClassSlots = ctx.resolveWidgetClassSlots(rawPresentation);

    const labelText = comp.labelOverride || item?.label || item?.key || comp.bind;
    const multiple = comp.multiple === true;

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
        accept: comp.accept,
        multiple,
        dragDrop: comp.dragDrop === true,

        bind(refs: FieldRefs): () => void {
            const disposers: Array<() => void> = [];

            const storeFiles = (fileData: Array<{ name: string; size: number; type: string }>) => {
                ctx.engine.setValue(fieldPath, multiple ? fileData : fileData[0] || null);
            };

            // File change handler on the file input
            const fileInput = refs.control.tagName === 'INPUT' ? refs.control : refs.control.querySelector('input[type="file"]');
            if (fileInput) {
                fileInput.addEventListener('change', () => {
                    const files = Array.from((fileInput as HTMLInputElement).files || []);
                    storeFiles(files.map(f => ({ name: f.name, size: f.size, type: f.type })));
                });
            }

            // Listen for drag-drop file data from adapter
            const onFilesDrop = (e: Event) => {
                const detail = (e as CustomEvent).detail;
                if (detail?.fileData) storeFiles(detail.fileData);
            };
            refs.root.addEventListener('formspec-files-dropped', onFilesDrop);

            // Relevance
            disposers.push(effect(() => {
                const isRelevant = ctx.engine.relevantSignals[fieldPath]?.value ?? true;
                refs.root.classList.toggle('formspec-hidden', !isRelevant);
            }));

            return () => disposers.forEach(d => d());
        }
    };
}
