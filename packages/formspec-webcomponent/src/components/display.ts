import { effect } from '@preact/signals-core';
import { ComponentPlugin, RenderContext } from '../types';

export const HeadingPlugin: ComponentPlugin = {
    type: 'Heading',
    render: (comp, parent, ctx) => {
        const el = document.createElement(`h${comp.level || 1}`);
        if (comp.id) el.id = comp.id;
        el.textContent = comp.text || '';
        ctx.applyStyle(el, comp.style);
        parent.appendChild(el);
    }
};

export const TextPlugin: ComponentPlugin = {
    type: 'Text',
    render: (comp, parent, ctx) => {
        const el = document.createElement('p');
        if (comp.id) el.id = comp.id;
        el.className = `text-variant-${comp.variant || 'body'}`;
        if (comp.bind) {
            const itemFullName = ctx.prefix ? `${ctx.prefix}.${comp.bind}` : comp.bind;
            ctx.cleanupFns.push(effect(() => {
                const sig = ctx.engine.signals[itemFullName];
                el.textContent = sig ? String(sig.value ?? '') : '';
            }));
        } else {
            el.textContent = comp.text || '';
        }
        ctx.applyStyle(el, comp.style);
        parent.appendChild(el);
    }
};

export const CardPlugin: ComponentPlugin = {
    type: 'Card',
    render: (comp, parent, ctx) => {
        const el = document.createElement('div');
        if (comp.id) el.id = comp.id;
        el.className = 'formspec-card';
        el.style.border = '1px solid #ddd';
        el.style.borderRadius = ctx.resolveToken('$token.border.radius') || '8px';
        el.style.padding = ctx.resolveToken('$token.spacing.md') || '1rem';
        if (comp.title) {
            const h3 = document.createElement('h3');
            h3.textContent = comp.title;
            el.appendChild(h3);
        }
        ctx.applyStyle(el, comp.style);
        parent.appendChild(el);
        if (comp.children) {
            for (const child of comp.children) {
                ctx.renderComponent(child, el, ctx.prefix);
            }
        }
    }
};

export const SpacerPlugin: ComponentPlugin = {
    type: 'Spacer',
    render: (comp, parent, ctx) => {
        const el = document.createElement('div');
        if (comp.id) el.id = comp.id;
        el.style.height = ctx.resolveToken(comp.size) || '1rem';
        ctx.applyStyle(el, comp.style);
        parent.appendChild(el);
    }
};

export const AlertPlugin: ComponentPlugin = {
    type: 'Alert',
    render: (comp, parent, ctx) => {
        const el = document.createElement('div');
        if (comp.id) el.id = comp.id;
        el.className = `formspec-alert alert-${comp.severity || 'info'}`;
        el.style.padding = '0.75rem 1.25rem';
        el.style.marginBottom = '1rem';
        el.style.border = '1px solid transparent';
        el.style.borderRadius = '0.25rem';
        if (comp.severity === 'error') {
            el.style.color = '#721c24';
            el.style.backgroundColor = '#f8d7da';
            el.style.borderColor = '#f5c6cb';
        } else if (comp.severity === 'warning') {
            el.style.color = '#856404';
            el.style.backgroundColor = '#fff3cd';
            el.style.borderColor = '#ffeeba';
        } else if (comp.severity === 'success') {
            el.style.color = '#155724';
            el.style.backgroundColor = '#d4edda';
            el.style.borderColor = '#c3e6cb';
        } else {
            el.style.color = '#0c5460';
            el.style.backgroundColor = '#d1ecf1';
            el.style.borderColor = '#bee5eb';
        }
        el.textContent = comp.text || '';
        ctx.applyStyle(el, comp.style);
        parent.appendChild(el);
    }
};

export const BadgePlugin: ComponentPlugin = {
    type: 'Badge',
    render: (comp, parent, ctx) => {
        const el = document.createElement('span');
        if (comp.id) el.id = comp.id;
        el.className = `formspec-badge badge-${comp.variant || 'default'}`;
        el.style.padding = '0.25em 0.4em';
        el.style.fontSize = '75%';
        el.style.fontWeight = '700';
        el.style.borderRadius = '0.25rem';
        el.style.backgroundColor = '#6c757d';
        el.style.color = '#fff';
        el.textContent = comp.text || '';
        ctx.applyStyle(el, comp.style);
        parent.appendChild(el);
    }
};

export const SummaryPlugin: ComponentPlugin = {
    type: 'Summary',
    render: (comp, parent, ctx) => {
        const el = document.createElement('dl');
        if (comp.id) el.id = comp.id;
        el.className = 'formspec-summary';
        
        if (comp.items) {
            for (const item of comp.items) {
                const dt = document.createElement('dt');
                dt.textContent = item.label || '';
                el.appendChild(dt);
                
                const dd = document.createElement('dd');
                el.appendChild(dd);
                
                if (item.bind) {
                    const fullName = ctx.prefix ? `${ctx.prefix}.${item.bind}` : item.bind;
                    ctx.cleanupFns.push(effect(() => {
                        const sig = ctx.engine.signals[fullName];
                        dd.textContent = sig ? String(sig.value ?? '') : '';
                    }));
                }
            }
        }
        
        ctx.applyStyle(el, comp.style);
        parent.appendChild(el);
    }
};
