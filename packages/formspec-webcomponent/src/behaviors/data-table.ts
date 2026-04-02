/** @filedesc DataTable behavior hook — manages repeatable group table logic. */
import { effect } from '@preact/signals-core';
import type { DataTableBehavior, DataTableRefs, BehaviorContext } from './types';
import { displayHostSlice } from '../adapters/display-host';

export function useDataTable(ctx: BehaviorContext, comp: any): DataTableBehavior {
    const bindKey = comp.bind;
    const fullName = ctx.prefix ? `${ctx.prefix}.${bindKey}` : bindKey;
    const item = ctx.findItemByKey(bindKey);
    const groupLabel = item?.label || bindKey || '';
    const repeatCount = ctx.engine.repeats[fullName] || { value: 0 };

    const columns = (comp.columns || []) as any[];
    const showRowNumbers = comp.showRowNumbers === true;
    const allowAdd = comp.allowAdd === true;
    const allowRemove = comp.allowRemove === true;

    return {
        comp,
        host: displayHostSlice(ctx as any),
        id: comp.id,
        compOverrides: {
            cssClass: comp.cssClass,
            style: comp.style,
            accessibility: comp.accessibility,
        },
        bindKey,
        fullName,
        columns,
        showRowNumbers,
        allowAdd,
        allowRemove,
        groupLabel,
        repeatCount: repeatCount as any,

        addInstance() {
            ctx.engine.addRepeatInstance(fullName);
        },

        removeInstance(index: number) {
            ctx.engine.removeRepeatInstance(fullName, index);
        },

        bind(refs: DataTableRefs): () => void {
            const disposers: Array<() => void> = [];
            return () => disposers.forEach(d => d());
        }
    };
}
