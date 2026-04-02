/** @filedesc Host slice passed to display/special adapter renderers (engine, prefix, validation helpers). */
import type { RenderContext, ValidationTargetMetadata } from '../types';
import type { IFormEngine } from '@formspec-org/engine/render';

export interface DisplayHostSlice {
    engine: IFormEngine;
    prefix: string;
    cleanupFns: Array<() => void>;
    resolveCompText(comp: any, prop: string, fallback: string): string;
    renderComponent(comp: any, parent: HTMLElement, prefix?: string): void;
    resolveToken(val: any): any;
    findItemByKey(key: string, items?: any[]): any | null;
    resolveValidationTarget(resultOrPath: any): ValidationTargetMetadata;
    focusField(path: string): boolean;
    latestSubmitDetailSignal: RenderContext['latestSubmitDetailSignal'];
    touchedVersion: RenderContext['touchedVersion'];
}

export function displayHostSlice(ctx: RenderContext): DisplayHostSlice {
    return {
        engine: ctx.engine,
        prefix: ctx.prefix,
        cleanupFns: ctx.cleanupFns,
        resolveCompText(comp, prop, fallback) {
            if (!comp?.id) return fallback;
            return ctx.engine.resolveLocaleString(`$component.${comp.id}.${prop}`, fallback);
        },
        renderComponent: (comp, parent, pfx) => ctx.renderComponent(comp, parent, pfx),
        resolveToken: (val) => ctx.resolveToken(val),
        findItemByKey: (key, items) => ctx.findItemByKey(key, items),
        resolveValidationTarget: (r) => ctx.resolveValidationTarget(r),
        focusField: (path) => ctx.focusField(path),
        latestSubmitDetailSignal: ctx.latestSubmitDetailSignal,
        touchedVersion: ctx.touchedVersion,
    };
}
