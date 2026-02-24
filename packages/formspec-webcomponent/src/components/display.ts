import { effect } from '@preact/signals-core';
import { ComponentPlugin, RenderContext } from '../types';

export const HeadingPlugin: ComponentPlugin = {
    type: 'Heading',
    render: (comp, parent, ctx) => {
        const el = document.createElement(`h${comp.level || 1}`);
        if (comp.id) el.id = comp.id;
        el.className = 'formspec-heading';
        el.textContent = comp.text || '';
        ctx.applyCssClass(el, comp);
        ctx.applyAccessibility(el, comp);
        ctx.applyStyle(el, comp.style);
        parent.appendChild(el);
    }
};

export const TextPlugin: ComponentPlugin = {
    type: 'Text',
    render: (comp, parent, ctx) => {
        const el = document.createElement('p');
        if (comp.id) el.id = comp.id;
        el.className = 'formspec-text';
        if (comp.format === 'markdown') el.classList.add('formspec-text--markdown');
        if (comp.bind) {
            const itemFullName = ctx.prefix ? `${ctx.prefix}.${comp.bind}` : comp.bind;
            ctx.cleanupFns.push(effect(() => {
                const sig = ctx.engine.signals[itemFullName];
                el.textContent = sig ? String(sig.value ?? '') : '';
            }));
        } else {
            el.textContent = comp.text || '';
        }
        ctx.applyCssClass(el, comp);
        ctx.applyAccessibility(el, comp);
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
        if (comp.elevation != null && comp.elevation > 0) {
            el.dataset.elevation = String(comp.elevation);
        }
        if (comp.title) {
            const h3 = document.createElement('h3');
            h3.className = 'formspec-card-title';
            h3.textContent = comp.title;
            el.appendChild(h3);
        }
        if (comp.subtitle) {
            const sub = document.createElement('p');
            sub.className = 'formspec-card-subtitle';
            sub.textContent = comp.subtitle;
            el.appendChild(sub);
        }
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

export const SpacerPlugin: ComponentPlugin = {
    type: 'Spacer',
    render: (comp, parent, ctx) => {
        const el = document.createElement('div');
        if (comp.id) el.id = comp.id;
        el.className = 'formspec-spacer';
        // Spacer height from size prop (only structural inline style kept)
        if (comp.size) el.style.height = String(ctx.resolveToken(comp.size));
        ctx.applyCssClass(el, comp);
        ctx.applyStyle(el, comp.style);
        parent.appendChild(el);
    }
};

export const AlertPlugin: ComponentPlugin = {
    type: 'Alert',
    render: (comp, parent, ctx) => {
        const severity = comp.severity || 'info';
        const el = document.createElement('div');
        if (comp.id) el.id = comp.id;
        el.className = `formspec-alert formspec-alert--${severity}`;
        if (comp.dismissible) {
            el.classList.add('formspec-alert--dismissible');
            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'formspec-alert-close';
            closeBtn.textContent = '\u00d7';
            closeBtn.setAttribute('aria-label', 'Dismiss');
            closeBtn.addEventListener('click', () => {
                el.remove();
            });
            el.appendChild(closeBtn);
        }
        const textSpan = document.createElement('span');
        textSpan.textContent = comp.text || '';
        el.appendChild(textSpan);
        ctx.applyCssClass(el, comp);
        ctx.applyAccessibility(el, comp);
        ctx.applyStyle(el, comp.style);
        parent.appendChild(el);
    }
};

export const BadgePlugin: ComponentPlugin = {
    type: 'Badge',
    render: (comp, parent, ctx) => {
        const el = document.createElement('span');
        if (comp.id) el.id = comp.id;
        el.className = `formspec-badge formspec-badge--${comp.variant || 'default'}`;
        el.textContent = comp.text || '';
        ctx.applyCssClass(el, comp);
        ctx.applyAccessibility(el, comp);
        ctx.applyStyle(el, comp.style);
        parent.appendChild(el);
    }
};

export const ProgressBarPlugin: ComponentPlugin = {
    type: 'ProgressBar',
    render: (comp, parent, ctx) => {
        const wrapper = document.createElement('div');
        if (comp.id) wrapper.id = comp.id;
        wrapper.className = 'formspec-progress-bar';

        const progressEl = document.createElement('progress');
        const maxVal = comp.max || 100;
        progressEl.max = maxVal;

        if (comp.bind) {
            const fullName = ctx.prefix ? `${ctx.prefix}.${comp.bind}` : comp.bind;
            const percentLabel = document.createElement('span');
            percentLabel.className = 'formspec-progress-percent';

            ctx.cleanupFns.push(effect(() => {
                const sig = ctx.engine.signals[fullName];
                const val = Number(sig?.value ?? comp.value ?? 0);
                progressEl.value = val;
                if (comp.showPercent) {
                    percentLabel.textContent = `${Math.round((val / maxVal) * 100)}%`;
                }
            }));

            wrapper.appendChild(progressEl);
            if (comp.showPercent) wrapper.appendChild(percentLabel);
        } else {
            progressEl.value = comp.value || 0;
            wrapper.appendChild(progressEl);
            if (comp.showPercent) {
                const percentLabel = document.createElement('span');
                percentLabel.className = 'formspec-progress-percent';
                percentLabel.textContent = `${Math.round(((comp.value || 0) / maxVal) * 100)}%`;
                wrapper.appendChild(percentLabel);
            }
        }

        ctx.applyCssClass(wrapper, comp);
        ctx.applyAccessibility(wrapper, comp);
        ctx.applyStyle(wrapper, comp.style);
        parent.appendChild(wrapper);
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

        ctx.applyCssClass(el, comp);
        ctx.applyAccessibility(el, comp);
        ctx.applyStyle(el, comp.style);
        parent.appendChild(el);
    }
};
