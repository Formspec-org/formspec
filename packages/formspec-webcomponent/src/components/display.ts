import { effect } from '@preact/signals-core';
import { ComponentPlugin, RenderContext } from '../types';
import { formatMoney } from '../format';

/**
 * Minimal markdown-to-HTML converter for Text component `format: 'markdown'`.
 * Handles: **bold**, *italic*, `code`, ordered/unordered lists, line breaks.
 * Output is pre-sanitized (no raw HTML passthrough).
 */
function renderMarkdown(src: string): string {
    // Escape HTML entities first to prevent injection
    let html = src
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Split into lines for block-level processing
    const lines = html.split('\n');
    const out: string[] = [];
    let inUl = false;
    let inOl = false;

    for (const line of lines) {
        const trimmed = line.trim();

        // Unordered list item
        if (/^[-*]\s+/.test(trimmed)) {
            if (!inUl) { out.push('<ul>'); inUl = true; }
            if (inOl) { out.push('</ol>'); inOl = false; }
            out.push(`<li>${trimmed.replace(/^[-*]\s+/, '')}</li>`);
            continue;
        }

        // Ordered list item
        if (/^\d+\.\s+/.test(trimmed)) {
            if (!inOl) { out.push('<ol>'); inOl = true; }
            if (inUl) { out.push('</ul>'); inUl = false; }
            out.push(`<li>${trimmed.replace(/^\d+\.\s+/, '')}</li>`);
            continue;
        }

        // Close open lists on non-list line
        if (inUl) { out.push('</ul>'); inUl = false; }
        if (inOl) { out.push('</ol>'); inOl = false; }

        if (trimmed === '') {
            out.push('<br>');
        } else {
            out.push(`<p>${trimmed}</p>`);
        }
    }
    if (inUl) out.push('</ul>');
    if (inOl) out.push('</ol>');

    // Inline formatting
    let result = out.join('\n');
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
    result = result.replace(/`(.+?)`/g, '<code>$1</code>');

    return result;
}

/** Renders an `<h1>`-`<h6>` heading element based on the `level` prop (defaults to h1). */
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

/**
 * Renders a `<p>` text element. When `bind` is set, subscribes to the field or variable signal
 * and reactively updates the text content, including currency formatting for money values.
 */
export const TextPlugin: ComponentPlugin = {
    type: 'Text',
    render: (comp, parent, ctx) => {
        const el = document.createElement('p');
        if (comp.id) el.id = comp.id;
        el.className = 'formspec-text';
        if (comp.format === 'markdown') el.classList.add('formspec-text--markdown');
        const isMarkdown = comp.format === 'markdown';
        if (comp.bind) {
            const itemFullName = ctx.prefix ? `${ctx.prefix}.${comp.bind}` : comp.bind;
            const varKey = `#:${comp.bind}`;
            ctx.cleanupFns.push(effect(() => {
                const sig = ctx.engine.signals[itemFullName] ?? ctx.engine.variableSignals?.[varKey];
                const v = sig?.value;
                if (v != null && typeof v === 'object' && 'amount' in v) {
                    el.textContent = formatMoney(v as any);
                } else if (isMarkdown && v != null) {
                    el.innerHTML = renderMarkdown(String(v));
                } else {
                    el.textContent = v != null ? String(v) : '';
                }
            }));
        } else if (isMarkdown && comp.text) {
            el.innerHTML = renderMarkdown(comp.text);
        } else {
            el.textContent = comp.text || '';
        }
        ctx.applyCssClass(el, comp);
        ctx.applyAccessibility(el, comp);
        ctx.applyStyle(el, comp.style);
        parent.appendChild(el);
    }
};

/** Renders a `<div>` card container with optional `<h3>` title, `<p>` subtitle, and elevation data attribute. */
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

/** Renders an empty `<div>` spacer with token-resolved height from the `size` prop. */
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

/** Renders a `<div>` alert with severity variant CSS class and optional dismiss button that removes the element. */
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

/** Renders an inline `<span>` badge with a variant CSS class. */
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

/**
 * Renders a `<progress>` element with optional percentage label.
 * When `bind` is set, subscribes to the field signal to reactively update the progress value.
 */
export const ProgressBarPlugin: ComponentPlugin = {
    type: 'ProgressBar',
    render: (comp, parent, ctx) => {
        const wrapper = document.createElement('div');
        if (comp.id) wrapper.id = comp.id;
        wrapper.className = 'formspec-progress-bar';

        const progressEl = document.createElement('progress');
        const maxVal = comp.max || 100;
        progressEl.max = maxVal;
        if (comp.label) progressEl.setAttribute('aria-label', comp.label);

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

/**
 * Renders a `<dl>` definition list with reactive `<dd>` values bound to field or variable signals.
 * Supports currency formatting for money values and optionSet label lookup.
 */
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
                    const varKey = `#:${item.bind}`;
                    ctx.cleanupFns.push(effect(() => {
                        const sig = ctx.engine.signals[fullName] ?? ctx.engine.variableSignals?.[varKey];
                        const v = sig?.value;
                        if (v != null && typeof v === 'object' && 'amount' in v) {
                            dd.textContent = formatMoney(v as any);
                        } else if (v != null && item.optionSet) {
                            const def = (ctx.engine as any).getDefinition?.();
                            const entry = def?.optionSets?.[item.optionSet];
                            const opts: Array<{ value: string; label: string }> = Array.isArray(entry) ? entry : (entry?.options ?? []);
                            const match = opts.find((o: any) => o.value === String(v));
                            dd.textContent = match ? match.label : String(v);
                        } else {
                            dd.textContent = v != null ? String(v) : '\u2014';
                        }
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

/**
 * Renders validation summary messages from either live validation state or
 * the latest submit event detail, with optional jump links to target fields.
 *
 * Props:
 * - `source`: 'live' | 'submit' (default 'live')
 * - `mode`: validation mode for live source (default 'continuous')
 * - `showFieldErrors`: include bind-level field errors (default false)
 * - `jumpLinks`: render clickable jump buttons to focus related fields
 * - `dedupe`: deduplicate repeated messages (default true)
 */
export const ValidationSummaryPlugin: ComponentPlugin = {
    type: 'ValidationSummary',
    render: (comp, parent, ctx) => {
        const el = document.createElement('div');
        if (comp.id) el.id = comp.id;
        el.className = 'formspec-validation-summary';
        el.setAttribute('aria-live', 'polite');
        ctx.applyCssClass(el, comp);
        ctx.applyAccessibility(el, comp);
        ctx.applyStyle(el, comp.style);
        parent.appendChild(el);

        const source = comp.source || 'live';
        const mode = comp.mode || 'continuous';
        const showFieldErrors = comp.showFieldErrors === true;
        const jumpLinks = comp.jumpLinks === true;
        const dedupe = comp.dedupe !== false;

        ctx.cleanupFns.push(effect(() => {
            let rawResults: any[] = [];
            if (source === 'submit') {
                const detail = ctx.latestSubmitDetailSignal.value;
                const fromReport = detail?.validationReport?.results;
                const fromResponse = detail?.response?.validationResults;
                rawResults = Array.isArray(fromReport)
                    ? fromReport
                    : (Array.isArray(fromResponse) ? fromResponse : []);
            } else {
                // Gate live validation display so the banner does not appear
                // eagerly on initial page load. Show after either:
                // - a submit attempt, or
                // - wizard navigation (touchedVersion > 0, meaning Next was clicked)
                if (ctx.latestSubmitDetailSignal.value === null && ctx.touchedVersion.value === 0) {
                    el.replaceChildren();
                    el.classList.remove('formspec-validation-summary--visible');
                    return;
                }
                ctx.engine.structureVersion.value;
                rawResults = ctx.engine.getValidationReport({ mode }).results;
            }

            const filteredResults = rawResults.filter((r: any) => {
                if (showFieldErrors) return true;
                return r.source === 'shape' || r.constraintKind === 'shape';
            });

            const resolved = filteredResults.map((result: any) => ({
                result,
                target: ctx.resolveValidationTarget(result),
            }));

            const rows = dedupe
                ? (() => {
                    const seen = new Set<string>();
                    return resolved.filter(({ result, target }) => {
                        const key = `${result?.severity || 'error'}|${target.path || result?.path || ''}|${result?.message || ''}`;
                        if (seen.has(key)) return false;
                        seen.add(key);
                        return true;
                    });
                })()
                : resolved;

            el.replaceChildren();
            if (rows.length === 0) {
                el.classList.remove('formspec-validation-summary--visible');
                return;
            }
            el.classList.add('formspec-validation-summary--visible');

            const errorCount = rows.filter(({ result }) => (result.severity || 'error') === 'error').length;
            const header = document.createElement('p');
            header.className = 'formspec-validation-summary-header';
            header.textContent = errorCount > 0
                ? `Please fix ${errorCount === 1 ? 'this error' : `these ${errorCount} errors`} before continuing:`
                : 'Please review the following before continuing:';
            el.appendChild(header);

            const severityIcon: Record<string, string> = { error: '✕', warning: '!', info: 'i' };

            for (const { result, target } of rows) {
                const div = document.createElement('div');
                const severity = result.severity || 'error';
                div.className = `formspec-shape-${severity}`;
                const icon = document.createElement('span');
                icon.className = 'formspec-shape-icon';
                icon.setAttribute('aria-hidden', 'true');
                icon.textContent = severityIcon[severity] ?? '!';
                const message = result?.message || 'Validation error';
                const withLabel = target.formLevel ? message : `${target.label}: ${message}`;
                if (jumpLinks && target.jumpable) {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'formspec-validation-summary-link';
                    button.textContent = withLabel;
                    button.addEventListener('click', () => {
                        ctx.focusField(target.path);
                    });
                    div.appendChild(icon);
                    div.appendChild(button);
                } else {
                    div.appendChild(icon);
                    div.appendChild(document.createTextNode(withLabel));
                }
                el.appendChild(div);
            }
        }));
    }
};
