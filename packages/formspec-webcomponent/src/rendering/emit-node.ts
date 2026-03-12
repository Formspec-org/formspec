import { effect, Signal } from '@preact/signals-core';
import { FormEngine } from 'formspec-engine';
import { globalRegistry } from '../registry';
import {
    RenderContext,
    ValidationTargetMetadata,
} from '../types';
import {
    PresentationBlock,
    ItemDescriptor,
    type LayoutNode,
} from 'formspec-layout';
import { renderInputComponent as renderInputComponentFn, type FieldInputHost } from './field-input';

/**
 * Interface for what emitNode/renderActualComponent need from FormspecRender.
 */
export interface RenderHost {
    engine: FormEngine;
    _definition: any;
    _componentDocument: any;
    _themeDocument: any;
    cleanupFns: Array<() => void>;
    touchedFields: Set<string>;
    touchedVersion: Signal<number>;
    _submitPendingSignal: Signal<boolean>;
    _latestSubmitDetailSignal: Signal<any>;
    resolveToken(val: any): any;
    resolveItemPresentation(itemDesc: ItemDescriptor): PresentationBlock;
    applyStyle(el: HTMLElement, style: any): void;
    applyCssClass(el: HTMLElement, comp: any): void;
    applyClassValue(el: HTMLElement, classValue: unknown): void;
    resolveWidgetClassSlots(presentation: PresentationBlock): {
        root?: unknown;
        label?: unknown;
        control?: unknown;
        hint?: unknown;
        error?: unknown;
    };
    applyAccessibility(el: HTMLElement, comp: any): void;
    findItemByKey(key: string, items?: any[]): any | null;
    submit(options?: any): any;
    resolveValidationTarget(resultOrPath: any): ValidationTargetMetadata;
    focusField(path: string): boolean;
    setSubmitPending(pending: boolean): void;
    isSubmitPending(): boolean;
    render(): void;
    activeBreakpoint: string | null;
}

/**
 * Walk a LayoutNode tree from the planner and emit DOM.
 */
export function emitNode(host: RenderHost, node: LayoutNode, parent: HTMLElement, prefix: string): void {
    let target = parent;

    if (node.when) {
        const wrapper = document.createElement('div');
        wrapper.className = 'formspec-when';
        target.appendChild(wrapper);
        let fallbackEl: HTMLElement | null = null;
        if (node.fallback) {
            fallbackEl = document.createElement('p');
            fallbackEl.className = 'formspec-conditional-fallback';
            fallbackEl.textContent = node.fallback;
            target.appendChild(fallbackEl);
        }
        const exprFn = host.engine.compileExpression(node.when, prefix);
        host.cleanupFns.push(effect(() => {
            const visible = !!exprFn();
            wrapper.classList.toggle('formspec-hidden', !visible);
            if (fallbackEl) fallbackEl.classList.toggle('formspec-hidden', visible);
        }));
        target = wrapper;
    }

    if (node.isRepeatTemplate && node.props.bind) {
        const bindKey = node.props.bind as string;
        const fullRepeatPath = prefix ? `${prefix}.${bindKey}` : bindKey;
        const container = document.createElement('div');
        container.className = 'formspec-repeat';
        container.dataset.bind = bindKey;
        target.appendChild(container);
        const item = host.findItemByKey(bindKey);
        let innerCleanupFns: Array<() => void> = [];

        const disposeInner = () => {
            for (const cleanup of innerCleanupFns.splice(0)) {
                cleanup();
            }
        };

        host.cleanupFns.push(effect(() => {
            const count = host.engine.repeats[fullRepeatPath]?.value || 0;
            disposeInner();
            container.replaceChildren();

            const nextInnerCleanupFns: Array<() => void> = [];
            const repeatHost = { ...host, cleanupFns: nextInnerCleanupFns };

            for (let idx = 0; idx < count; idx++) {
                const instanceWrapper = document.createElement('div');
                instanceWrapper.className = 'formspec-repeat-instance';
                container.appendChild(instanceWrapper);

                const instancePrefix = `${fullRepeatPath}[${idx}]`;
                for (const child of node.children) {
                    emitNode(repeatHost, child, instanceWrapper, instancePrefix);
                }

                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'formspec-repeat-add';
                removeBtn.textContent = `Remove ${item?.label || bindKey}`;
                const removeIdx = idx;
                removeBtn.addEventListener('click', () => {
                    host.engine.removeRepeatInstance(fullRepeatPath, removeIdx);
                });
                instanceWrapper.appendChild(removeBtn);
            }

            innerCleanupFns = nextInnerCleanupFns;
        }));
        host.cleanupFns.push(() => {
            disposeInner();
        });
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'formspec-repeat-add';
        addBtn.textContent = `Add ${item?.label || bindKey}`;
        addBtn.addEventListener('click', () => {
            host.engine.addRepeatInstance(fullRepeatPath);
        });
        target.appendChild(addBtn);
        return;
    }

    if (node.scopeChange && !node.isRepeatTemplate && node.props.bind) {
        const bindKey = node.props.bind as string;
        const nextPrefix = prefix ? `${prefix}.${bindKey}` : bindKey;
        const el = document.createElement('div');
        el.className = 'formspec-group';
        if (node.props.title) {
            const heading = document.createElement('h3');
            heading.textContent = node.props.title as string;
            el.appendChild(heading);
        }
        const groupFullPath = nextPrefix;
        if (host.engine.relevantSignals[groupFullPath]) {
            host.cleanupFns.push(effect(() => {
                const isRelevant = host.engine.relevantSignals[groupFullPath].value;
                el.classList.toggle('formspec-hidden', !isRelevant);
            }));
        }
        target.appendChild(el);

        for (const child of node.children) {
            emitNode(host, child, el, nextPrefix);
        }
        return;
    }

    const comp: any = {
        component: node.component,
        ...node.props,
    };
    if (node.style) comp.style = node.style;
    if (node.cssClasses.length > 0) comp.cssClass = node.cssClasses;
    if (node.accessibility) comp.accessibility = node.accessibility;
    comp.children = node.children;

    renderActualComponent(host, comp, target, prefix);
}

/**
 * Render a component, handling LayoutNode objects by delegating to emitNode.
 */
export function renderComponent(host: RenderHost, comp: any, parent: HTMLElement, prefix = ''): void {
    if (comp && typeof comp === 'object' && 'category' in comp && 'id' in comp) {
        emitNode(host, comp as LayoutNode, parent, prefix);
        return;
    }
    console.warn('renderComponent called with non-LayoutNode comp — this should not happen after planner integration', comp);
}

/**
 * Look up a component plugin and invoke its render function with a full RenderContext.
 */
export function renderActualComponent(host: RenderHost, comp: any, parent: HTMLElement, prefix = ''): void {
    const componentType = comp.component;
    const plugin = globalRegistry.get(componentType);

    const ctx: RenderContext = {
        engine: host.engine,
        componentDocument: host._componentDocument,
        themeDocument: host._themeDocument,
        prefix,
        submit: (opts?: any) => host.submit(opts),
        resolveValidationTarget: (r: any) => host.resolveValidationTarget(r),
        focusField: (p: string) => host.focusField(p),
        submitPendingSignal: host._submitPendingSignal,
        latestSubmitDetailSignal: host._latestSubmitDetailSignal,
        setSubmitPending: (pending: boolean) => host.setSubmitPending(pending),
        isSubmitPending: () => host.isSubmitPending(),
        renderComponent: (comp: any, parent: HTMLElement, pfx?: string) => renderComponent(host, comp, parent, pfx),
        resolveToken: (val: any) => host.resolveToken(val),
        applyStyle: (el: HTMLElement, style: any) => host.applyStyle(el, style),
        applyCssClass: (el: HTMLElement, comp: any) => host.applyCssClass(el, comp),
        applyAccessibility: (el: HTMLElement, comp: any) => host.applyAccessibility(el, comp),
        resolveItemPresentation: (itemDesc: ItemDescriptor) => host.resolveItemPresentation(itemDesc),
        cleanupFns: host.cleanupFns,
        findItemByKey: (key: string) => host.findItemByKey(key),
        renderInputComponent: (comp: any, item: any, fullName: string) => renderInputComponentFn(host as any as FieldInputHost, comp, item, fullName),
        activeBreakpoint: host.activeBreakpoint,
        touchedFields: host.touchedFields,
        touchedVersion: host.touchedVersion,
    };

    if (plugin) {
        plugin.render(comp, parent, ctx);
    } else {
        console.warn(`Unknown component type: ${componentType} (custom components should be expanded by planner)`);
    }
}
