/** @filedesc Layout component plugins: Page, Stack, Grid, Divider, Columns, Panel, Accordion, Modal, Popover. */
import { effect, signal } from '@preact/signals-core';
import { ComponentPlugin, RenderContext } from '../types';
import { focusFirstIn } from '../dom-utils';

/** Resolve a component string via $component.<id>.<prop> locale key, falling back to inline. */
function resolveCompText(ctx: RenderContext, comp: any, prop: string, fallback: string): string {
    if (!comp.id) return fallback;
    return ctx.engine.resolveLocaleString(`$component.${comp.id}.${prop}`, fallback);
}

type PopupPlacement = 'top' | 'right' | 'bottom' | 'left';

const POPUP_EDGE_PADDING = 8;
const POPUP_TRIGGER_GAP = 8;

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Position an overlay near the trigger while keeping it on-screen.
 * Uses viewport-fixed positioning so native <dialog> and Popover API content
 * behave consistently across layouts.
 */
function positionOverlayNearTrigger(
    triggerEl: HTMLElement,
    overlayEl: HTMLElement,
    placement: PopupPlacement = 'bottom'
): void {
    const triggerRect = triggerEl.getBoundingClientRect();
    const overlayRect = overlayEl.getBoundingClientRect();
    if (overlayRect.width <= 0 || overlayRect.height <= 0) return;

    let left = triggerRect.left + ((triggerRect.width - overlayRect.width) / 2);
    let top = triggerRect.bottom + POPUP_TRIGGER_GAP;

    if (placement === 'top') {
        top = triggerRect.top - overlayRect.height - POPUP_TRIGGER_GAP;
    } else if (placement === 'right') {
        left = triggerRect.right + POPUP_TRIGGER_GAP;
        top = triggerRect.top + ((triggerRect.height - overlayRect.height) / 2);
    } else if (placement === 'left') {
        left = triggerRect.left - overlayRect.width - POPUP_TRIGGER_GAP;
        top = triggerRect.top + ((triggerRect.height - overlayRect.height) / 2);
    }

    left = clamp(left, POPUP_EDGE_PADDING, Math.max(POPUP_EDGE_PADDING, window.innerWidth - overlayRect.width - POPUP_EDGE_PADDING));
    top = clamp(top, POPUP_EDGE_PADDING, Math.max(POPUP_EDGE_PADDING, window.innerHeight - overlayRect.height - POPUP_EDGE_PADDING));

    overlayEl.style.position = 'fixed';
    overlayEl.style.inset = 'auto';
    overlayEl.style.left = `${Math.round(left)}px`;
    overlayEl.style.top = `${Math.round(top)}px`;
    overlayEl.style.margin = '0';
    overlayEl.style.maxHeight = `${Math.max(120, window.innerHeight - (POPUP_EDGE_PADDING * 2))}px`;
}

/** Renders a `<section>` page container with optional `<h2>` title and `<p>` description. */
export const PagePlugin: ComponentPlugin = {
    type: 'Page',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const el = document.createElement('section');
        if (comp.id) el.id = comp.id;
        el.className = 'formspec-page';
        ctx.applyCssClass(el, comp);
        ctx.applyAccessibility(el, comp);
        ctx.applyStyle(el, comp.style);
        if (comp.title) {
            const headingLevel = comp.headingLevel || 'h2';
            const h = document.createElement(headingLevel);
            h.textContent = resolveCompText(ctx, comp, 'title', comp.title);
            el.appendChild(h);
        }
        if (comp.description) {
            const desc = document.createElement('p');
            desc.className = 'formspec-page-description';
            desc.textContent = comp.description;
            el.appendChild(desc);
        }
        parent.appendChild(el);
        if (comp.children) {
            for (const child of comp.children) {
                ctx.renderComponent(child, el, ctx.prefix);
            }
        }
    }
};

/** Renders a flex `<div>` stack with configurable direction, alignment, wrap, and gap (token-resolved). */
export const StackPlugin: ComponentPlugin = {
    type: 'Stack',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const el = document.createElement('div');
        if (comp.id) el.id = comp.id;
        el.className = 'formspec-stack';
        if (comp.direction === 'horizontal') el.classList.add('formspec-stack--horizontal');
        if (comp.align) el.dataset.align = comp.align;
        if (comp.wrap) el.classList.add('formspec-stack--wrap');
        if (comp.gap) el.style.gap = String(ctx.resolveToken(comp.gap));
        ctx.applyCssClass(el, comp);
        ctx.applyAccessibility(el, comp);
        ctx.applyStyle(el, comp.style);
        parent.appendChild(el);
        if (comp.children) {
            for (const child of comp.children) {
                ctx.renderComponent(child, el, ctx.prefix);
            }
        }
    }
};

/** Renders a CSS grid `<div>` with configurable column count, gap, and row gap. */
export const GridPlugin: ComponentPlugin = {
    type: 'Grid',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const el = document.createElement('div');
        if (comp.id) el.id = comp.id;
        el.className = 'formspec-grid';
        if (comp.columns != null) {
            if (typeof comp.columns === 'number') {
                el.dataset.columns = String(comp.columns);
                // Inline style ensures the grid works for any column count,
                // not just the 1-6 range covered by formspec-layout.css rules.
                el.style.gridTemplateColumns = `repeat(${comp.columns}, 1fr)`;
            } else {
                el.style.gridTemplateColumns = comp.columns;
            }
        }
        if (comp.gap) el.style.gap = String(ctx.resolveToken(comp.gap));
        if (comp.rowGap) el.style.rowGap = String(comp.rowGap);
        ctx.applyCssClass(el, comp);
        ctx.applyAccessibility(el, comp);
        ctx.applyStyle(el, comp.style);
        parent.appendChild(el);
        if (comp.children) {
            for (const child of comp.children) {
                ctx.renderComponent(child, el, ctx.prefix);
            }
        }
    }
};

/** Renders an `<hr>` divider, or a labeled divider with `<hr>` lines flanking a `<span>` label. */
export const DividerPlugin: ComponentPlugin = {
    type: 'Divider',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        if (comp.label) {
            const wrapper = document.createElement('div');
            if (comp.id) wrapper.id = comp.id;
            wrapper.className = 'formspec-divider formspec-divider--labeled';

            const lineBefore = document.createElement('hr');
            lineBefore.className = 'formspec-divider-line';

            const labelEl = document.createElement('span');
            labelEl.className = 'formspec-divider-label';
            labelEl.textContent = resolveCompText(ctx, comp, 'label', comp.label);

            const lineAfter = document.createElement('hr');
            lineAfter.className = 'formspec-divider-line';

            wrapper.appendChild(lineBefore);
            wrapper.appendChild(labelEl);
            wrapper.appendChild(lineAfter);
            ctx.applyCssClass(wrapper, comp);
            ctx.applyAccessibility(wrapper, comp);
            ctx.applyStyle(wrapper, comp.style);
            parent.appendChild(wrapper);
        } else {
            const hr = document.createElement('hr');
            if (comp.id) hr.id = comp.id;
            hr.className = 'formspec-divider';
            ctx.applyCssClass(hr, comp);
            ctx.applyAccessibility(hr, comp);
            ctx.applyStyle(hr, comp.style);
            parent.appendChild(hr);
        }
    }
};

/** Renders a `<details>`/`<summary>` collapsible section with optional default-open state. */
export const CollapsiblePlugin: ComponentPlugin = {
    type: 'Collapsible',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const details = document.createElement('details');
        if (comp.id) details.id = comp.id;
        details.className = 'formspec-collapsible';
        if (comp.defaultOpen) details.open = true;

        const summary = document.createElement('summary');
        summary.textContent = resolveCompText(ctx, comp, 'title', comp.title || 'Details');
        details.appendChild(summary);

        const content = document.createElement('div');
        content.className = 'formspec-collapsible-content';
        details.appendChild(content);

        if (comp.children) {
            for (const child of comp.children) {
                ctx.renderComponent(child, content, ctx.prefix);
            }
        }

        ctx.applyCssClass(details, comp);
        ctx.applyAccessibility(details, comp);
        ctx.applyStyle(details, comp.style);
        parent.appendChild(details);
    }
};

/** Renders a multi-column `<div>` layout with configurable column count and token-resolved gap. */
export const ColumnsPlugin: ComponentPlugin = {
    type: 'Columns',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const el = document.createElement('div');
        if (comp.id) el.id = comp.id;
        el.className = 'formspec-columns';
        if (Array.isArray(comp.widths) && comp.widths.length > 0) {
            el.style.gridTemplateColumns = comp.widths.join(' ');
        } else if (comp.columnCount) {
            el.dataset.columns = String(comp.columnCount);
        }
        if (comp.gap) el.style.gap = String(ctx.resolveToken(comp.gap));
        ctx.applyCssClass(el, comp);
        ctx.applyAccessibility(el, comp);
        ctx.applyStyle(el, comp.style);
        parent.appendChild(el);
        if (comp.children) {
            for (const child of comp.children) {
                ctx.renderComponent(child, el, ctx.prefix);
            }
        }
    }
};

/** Renders a `<div>` panel container with optional header and configurable width. */
export const PanelPlugin: ComponentPlugin = {
    type: 'Panel',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const el = document.createElement('div');
        if (comp.id) el.id = comp.id;
        el.className = 'formspec-panel';
        if (comp.position) {
            el.dataset.position = comp.position;
            // Keep panel placement deterministic when mixed with main content in grid/flex containers.
            el.style.order = comp.position === 'left' ? '-1' : '1';
        }
        if (comp.width) el.style.width = comp.width;

        if (comp.title) {
            const header = document.createElement('div');
            header.className = 'formspec-panel-header';
            header.textContent = resolveCompText(ctx, comp, 'title', comp.title);
            el.appendChild(header);
        }

        const body = document.createElement('div');
        body.className = 'formspec-panel-body';
        el.appendChild(body);

        if (comp.children) {
            for (const child of comp.children) {
                ctx.renderComponent(child, body, ctx.prefix);
            }
        }

        ctx.applyCssClass(el, comp);
        ctx.applyAccessibility(el, comp);
        ctx.applyStyle(el, comp.style);
        parent.appendChild(el);
    }
};

/**
 * Renders an accordion using `<details>`/`<summary>` elements for each child.
 * Supports single-open mode (default) via toggle event listeners, or multi-open via `allowMultiple`.
 * If `bind` is present, each instance of the repeating group becomes one accordion section.
 */
export const AccordionPlugin: ComponentPlugin = {
    type: 'Accordion',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const el = document.createElement('div');
        if (comp.id) el.id = comp.id;
        el.className = 'formspec-accordion';
        ctx.applyCssClass(el, comp);
        ctx.applyAccessibility(el, comp);
        ctx.applyStyle(el, comp.style);
        parent.appendChild(el);

        const bindKey = comp.bind;
        const labels: string[] = comp.labels || [];
        const detailsEls: HTMLDetailsElement[] = [];
        let previousCount = 0;

        if (bindKey) {
            const fullName = ctx.prefix ? `${ctx.prefix}.${bindKey}` : bindKey;
            const item = ctx.findItemByKey(bindKey);
            ctx.cleanupFns.push(effect(() => {
                const count = ctx.engine.repeats[fullName]?.value || 0;
                const expandedIndex = typeof comp.defaultOpen === 'number'
                    ? comp.defaultOpen
                    : count > 0
                        ? count - 1
                        : -1;
                el.replaceChildren();
                detailsEls.length = 0;

                for (let i = 0; i < count; i++) {
                    const details = document.createElement('details');
                    details.className = 'formspec-accordion-item';
                    if (i === expandedIndex || (count > previousCount && i === count - 1)) {
                        details.open = true;
                    }

                    const summary = document.createElement('summary');
                    summary.textContent = labels[i] || `Section ${i + 1}`;
                    details.appendChild(summary);

                    const content = document.createElement('div');
                    content.className = 'formspec-accordion-content';
                    const instancePrefix = `${fullName}[${i}]`;
                    for (const child of comp.children || []) {
                        ctx.renderComponent(child, content, instancePrefix);
                    }
                    const removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'formspec-repeat-add';
                    removeBtn.textContent = `Remove ${item?.label || bindKey}`;
                    removeBtn.addEventListener('click', () => {
                        ctx.engine.removeRepeatInstance(fullName, i);
                    });
                    content.appendChild(removeBtn);
                    details.appendChild(content);

                    details.addEventListener('toggle', () => {
                        if (details.open && !comp.allowMultiple) {
                            detailsEls.forEach(d => { if (d !== details) d.open = false; });
                        }
                    });

                    el.appendChild(details);
                    detailsEls.push(details);
                }

                previousCount = count;
            }));

            // Add repeat-add button to match planner fallback behavior
            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'formspec-repeat-add';
            addBtn.textContent = `Add ${item?.label || bindKey}`;
            addBtn.addEventListener('click', () => {
                ctx.engine.addRepeatInstance(fullName);
            });
            parent.appendChild(addBtn);
        } else {
            const children: any[] = comp.children || [];
            for (let i = 0; i < children.length; i++) {
                const details = document.createElement('details');
                details.className = 'formspec-accordion-item';
                if (comp.defaultOpen === i) details.open = true;

                const summary = document.createElement('summary');
                summary.textContent = labels[i] || `Section ${i + 1}`;
                details.appendChild(summary);

                const content = document.createElement('div');
                content.className = 'formspec-accordion-content';
                ctx.renderComponent(children[i], content, ctx.prefix);
                details.appendChild(content);

                details.addEventListener('toggle', () => {
                    if (details.open && !comp.allowMultiple) {
                        detailsEls.forEach(d => { if (d !== details) d.open = false; });
                    }
                });

                el.appendChild(details);
                detailsEls.push(details);
            }
        }
    }
};

/** Renders a `<dialog>` modal with optional close button, title, and a trigger button that calls `showModal()`. */
export const ModalPlugin: ComponentPlugin = {
    type: 'Modal',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const placement: PopupPlacement = comp.placement || 'bottom';
        const dialog = document.createElement('dialog');
        if (comp.id) dialog.id = comp.id;
        dialog.className = 'formspec-modal';
        if (comp.size) dialog.dataset.size = comp.size;

        if (comp.closable !== false) {
            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'formspec-modal-close';
            closeBtn.innerHTML = '<span aria-hidden="true">\u00d7</span>';
            closeBtn.setAttribute('aria-label', 'Close');
            closeBtn.addEventListener('click', () => dialog.close());
            dialog.appendChild(closeBtn);
        }

        if (comp.title) {
            const titleId = `${comp.id || 'modal'}-title`;
            const titleEl = document.createElement('h2');
            titleEl.className = 'formspec-modal-title';
            titleEl.id = titleId;
            titleEl.textContent = resolveCompText(ctx, comp, 'title', comp.title);
            dialog.appendChild(titleEl);
            dialog.setAttribute('aria-labelledby', titleId);
        } else if (comp.triggerLabel) {
            dialog.setAttribute('aria-label', comp.triggerLabel);
        }

        const content = document.createElement('div');
        content.className = 'formspec-modal-content';
        dialog.appendChild(content);

        if (comp.children) {
            for (const child of comp.children) {
                ctx.renderComponent(child, content, ctx.prefix);
            }
        }

        ctx.applyCssClass(dialog, comp);
        ctx.applyAccessibility(dialog, comp);
        ctx.applyStyle(dialog, comp.style);
        parent.appendChild(dialog);

        const triggerMode = comp.trigger || 'button';
        if (triggerMode === 'auto') {
            if (comp.when) {
                const exprFn = ctx.engine.compileExpression(comp.when, ctx.prefix);
                ctx.cleanupFns.push(effect(() => {
                    const shouldOpen = !!exprFn();
                    if (shouldOpen && !dialog.open) {
                        dialog.showModal();
                        queueMicrotask(() => focusFirstIn(dialog));
                    } else if (!shouldOpen && dialog.open) {
                        dialog.close();
                    }
                }));
            } else {
                queueMicrotask(() => {
                    if (!dialog.open) dialog.showModal();
                    focusFirstIn(dialog);
                });
            }
            return;
        }

        const triggerBtn = document.createElement('button');
        triggerBtn.type = 'button';
        triggerBtn.className = 'formspec-modal-trigger';
        triggerBtn.textContent = resolveCompText(ctx, comp, 'triggerLabel', comp.triggerLabel || 'Open');
        const repositionDialog = () => {
            if (dialog.open) positionOverlayNearTrigger(triggerBtn, dialog, placement);
        };
        triggerBtn.addEventListener('click', () => {
            if (!dialog.open) dialog.showModal();
            queueMicrotask(() => {
                repositionDialog();
                focusFirstIn(dialog);
            });
        });
        window.addEventListener('resize', repositionDialog);
        window.addEventListener('scroll', repositionDialog, true);
        ctx.cleanupFns.push(() => {
            window.removeEventListener('resize', repositionDialog);
            window.removeEventListener('scroll', repositionDialog, true);
        });
        dialog.addEventListener('close', () => triggerBtn.focus());
        parent.appendChild(triggerBtn);
    }
};

/**
 * Renders a popover with a trigger button and content panel.
 * Trigger label can be bound to a field signal. Uses the Popover API when available, falls back to hidden toggle.
 */
export const PopoverPlugin: ComponentPlugin = {
    type: 'Popover',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const placement: PopupPlacement = comp.placement || 'bottom';
        const wrapper = document.createElement('div');
        if (comp.id) wrapper.id = comp.id;
        wrapper.className = 'formspec-popover';

        const triggerBtn = document.createElement('button');
        triggerBtn.type = 'button';
        triggerBtn.className = 'formspec-popover-trigger';
        triggerBtn.setAttribute('aria-haspopup', 'dialog');
        triggerBtn.setAttribute('aria-expanded', 'false');

        const triggerPath = comp.triggerBind
            ? (ctx.prefix ? `${ctx.prefix}.${comp.triggerBind}` : comp.triggerBind)
            : null;
        const triggerSignal = triggerPath ? ctx.engine.signals[triggerPath] : null;
        const fallbackLabel = comp.triggerLabel || 'Open';
        if (triggerSignal) {
            ctx.cleanupFns.push(effect(() => {
                const val = triggerSignal.value;
                triggerBtn.textContent = val === undefined || val === null || val === ''
                    ? fallbackLabel
                    : String(val);
            }));
        } else {
            triggerBtn.textContent = fallbackLabel;
        }

        const content = document.createElement('div');
        content.className = 'formspec-popover-content';
        content.setAttribute('role', 'dialog');
        content.setAttribute('aria-label', resolveCompText(ctx, comp, 'title', comp.title || comp.triggerLabel || 'Popover'));
        if (comp.placement) {
            content.dataset.placement = comp.placement;
        }

        if (comp.children) {
            for (const child of comp.children) {
                ctx.renderComponent(child, content, ctx.prefix);
            }
        }

        const focusFirstInContent = () => focusFirstIn(content);

        const closePopover = () => {
            const contentAny = content as any;
            if (typeof contentAny.hidePopover === 'function') {
                try { contentAny.hidePopover(); } catch { /* already hidden */ }
            } else {
                content.hidden = true;
            }
            triggerBtn.setAttribute('aria-expanded', 'false');
            triggerBtn.focus();
        };

        content.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                closePopover();
            }
        });

        const contentAny = content as any;
        if (typeof contentAny.showPopover === 'function') {
            contentAny.popover = 'auto';
            triggerBtn.addEventListener('click', () => {
                contentAny.togglePopover();
                const isOpen = contentAny.matches(':popover-open');
                triggerBtn.setAttribute('aria-expanded', String(isOpen));
                if (isOpen) {
                    queueMicrotask(() => {
                        positionOverlayNearTrigger(triggerBtn, content, placement);
                        focusFirstInContent();
                    });
                }
            });
        } else {
            content.hidden = true;
            const onClickOutside = (e: MouseEvent) => {
                if (!wrapper.contains(e.target as Node)) closePopover();
            };
            triggerBtn.addEventListener('click', () => {
                content.hidden = !content.hidden;
                triggerBtn.setAttribute('aria-expanded', String(!content.hidden));
                if (!content.hidden) {
                    queueMicrotask(() => {
                        positionOverlayNearTrigger(triggerBtn, content, placement);
                        focusFirstInContent();
                    });
                    document.addEventListener('click', onClickOutside, true);
                } else {
                    document.removeEventListener('click', onClickOutside, true);
                }
            });
            ctx.cleanupFns.push(() => document.removeEventListener('click', onClickOutside, true));
        }

        wrapper.appendChild(triggerBtn);
        wrapper.appendChild(content);
        ctx.applyCssClass(wrapper, comp);
        ctx.applyAccessibility(wrapper, comp);
        ctx.applyStyle(wrapper, comp.style);
        parent.appendChild(wrapper);
    }
};
