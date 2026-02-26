import { effect, signal } from '@preact/signals-core';
import { ComponentPlugin, RenderContext } from '../types';

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
            const h2 = document.createElement('h2');
            h2.textContent = comp.title;
            el.appendChild(h2);
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

export const GridPlugin: ComponentPlugin = {
    type: 'Grid',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const el = document.createElement('div');
        if (comp.id) el.id = comp.id;
        el.className = 'formspec-grid';
        if (comp.columns) el.dataset.columns = String(comp.columns);
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
            labelEl.textContent = comp.label;

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

export const CollapsiblePlugin: ComponentPlugin = {
    type: 'Collapsible',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const details = document.createElement('details');
        if (comp.id) details.id = comp.id;
        details.className = 'formspec-collapsible';
        if (comp.defaultOpen) details.open = true;

        const summary = document.createElement('summary');
        summary.textContent = comp.title || 'Details';
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

export const ColumnsPlugin: ComponentPlugin = {
    type: 'Columns',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const el = document.createElement('div');
        if (comp.id) el.id = comp.id;
        el.className = 'formspec-columns';
        if (comp.columnCount) el.dataset.columns = String(comp.columnCount);
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

export const PanelPlugin: ComponentPlugin = {
    type: 'Panel',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const el = document.createElement('div');
        if (comp.id) el.id = comp.id;
        el.className = 'formspec-panel';
        if (comp.width) el.style.width = comp.width;

        if (comp.title) {
            const header = document.createElement('div');
            header.className = 'formspec-panel-header';
            header.textContent = comp.title;
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

        const children: any[] = comp.children || [];
        const labels: string[] = comp.labels || [];
        const detailsEls: HTMLDetailsElement[] = [];

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
};

export const ModalPlugin: ComponentPlugin = {
    type: 'Modal',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const dialog = document.createElement('dialog');
        if (comp.id) dialog.id = comp.id;
        dialog.className = 'formspec-modal';
        if (comp.size) dialog.dataset.size = comp.size;

        if (comp.closable !== false) {
            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'formspec-modal-close';
            closeBtn.textContent = '\u00d7';
            closeBtn.setAttribute('aria-label', 'Close');
            closeBtn.addEventListener('click', () => dialog.close());
            dialog.appendChild(closeBtn);
        }

        if (comp.title) {
            const titleEl = document.createElement('h2');
            titleEl.className = 'formspec-modal-title';
            titleEl.textContent = comp.title;
            dialog.appendChild(titleEl);
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

        const triggerBtn = document.createElement('button');
        triggerBtn.type = 'button';
        triggerBtn.className = 'formspec-modal-trigger';
        triggerBtn.textContent = comp.triggerLabel || 'Open';
        triggerBtn.addEventListener('click', () => dialog.showModal());
        parent.appendChild(triggerBtn);
    }
};

export const PopoverPlugin: ComponentPlugin = {
    type: 'Popover',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const wrapper = document.createElement('div');
        if (comp.id) wrapper.id = comp.id;
        wrapper.className = 'formspec-popover';

        const triggerBtn = document.createElement('button');
        triggerBtn.type = 'button';
        triggerBtn.className = 'formspec-popover-trigger';

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
        if (comp.placement) {
            content.dataset.placement = comp.placement;
        }

        if (comp.children) {
            for (const child of comp.children) {
                ctx.renderComponent(child, content, ctx.prefix);
            }
        }

        const contentAny = content as any;
        if (typeof contentAny.showPopover === 'function') {
            contentAny.popover = 'auto';
            triggerBtn.addEventListener('click', () => contentAny.togglePopover());
        } else {
            content.hidden = true;
            triggerBtn.addEventListener('click', () => {
                content.hidden = !content.hidden;
            });
        }

        wrapper.appendChild(triggerBtn);
        wrapper.appendChild(content);
        ctx.applyCssClass(wrapper, comp);
        ctx.applyAccessibility(wrapper, comp);
        ctx.applyStyle(wrapper, comp.style);
        parent.appendChild(wrapper);
    }
};
