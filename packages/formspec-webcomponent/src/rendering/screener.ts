import { FormEngine } from 'formspec-engine';
import { ScreenerRoute } from '../types.js';

export interface ScreenerHost {
    _definition: any;
    engine: FormEngine;
    _screenerCompleted: boolean;
    _screenerRoute: ScreenerRoute | null;
    classifyScreenerRoute(route: ScreenerRoute | null | undefined): 'none' | 'internal' | 'external';
    emitScreenerStateChange(reason: string, answers?: Record<string, any>): void;
    dispatchEvent(event: Event): boolean;
    render(): void;
}

export function renderScreener(host: ScreenerHost, container: HTMLElement): void {
    const screener = host._definition.screener;
    const panel = document.createElement('div');
    panel.className = 'formspec-screener';

    const heading = document.createElement('h2');
    heading.className = 'formspec-screener-heading';
    heading.textContent = host._definition.title || 'Screening Questions';
    panel.appendChild(heading);

    if (host._definition.description) {
        const intro = document.createElement('p');
        intro.className = 'formspec-screener-intro';
        intro.textContent = host._definition.description;
        panel.appendChild(intro);
    }

    const fieldsContainer = document.createElement('div');
    fieldsContainer.className = 'formspec-screener-fields';
    panel.appendChild(fieldsContainer);

    const answers: Record<string, any> = {};

    for (const item of screener.items) {
        const fieldWrapper = document.createElement('div');
        fieldWrapper.className = 'formspec-field formspec-screener-field';
        fieldWrapper.dataset.name = item.key;

        const fieldId = `screener-${item.key}`;
        const label = document.createElement('label');
        label.textContent = host.engine.getLabel(item);
        label.htmlFor = fieldId;
        fieldWrapper.appendChild(label);

        if (item.hint) {
            const hint = document.createElement('span');
            hint.className = 'formspec-hint';
            hint.textContent = item.hint;
            fieldWrapper.appendChild(hint);
        }

        const clearFieldError = () => {
            fieldWrapper.querySelector('.formspec-error')?.remove();
        };

        if (item.dataType === 'choice' && item.options) {
            const select = document.createElement('select');
            select.className = 'formspec-input';
            select.id = fieldId;
            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = '-- Select --';
            select.appendChild(emptyOpt);
            for (const opt of item.options) {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label || opt.value;
                select.appendChild(option);
            }
            select.addEventListener('change', () => {
                answers[item.key] = select.value || null;
                clearFieldError();
            });
            fieldWrapper.appendChild(select);
        } else if (item.dataType === 'boolean') {
            // Boolean checkboxes default to false (unchecked = "no", a valid answer).
            answers[item.key] = false;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'formspec-input';
            checkbox.id = fieldId;
            checkbox.addEventListener('change', () => {
                answers[item.key] = checkbox.checked;
                clearFieldError();
            });
            fieldWrapper.appendChild(checkbox);
        } else if (item.dataType === 'money') {
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'formspec-input';
            input.id = fieldId;
            input.placeholder = 'Amount';
            input.addEventListener('input', () => {
                const val = parseFloat(input.value);
                answers[item.key] = isNaN(val) ? null : { amount: val, currency: host._definition.formPresentation?.defaultCurrency || 'USD' };
                clearFieldError();
            });
            fieldWrapper.appendChild(input);
        } else {
            const input = document.createElement('input');
            input.type = item.dataType === 'integer' || item.dataType === 'decimal' || item.dataType === 'number' ? 'number' : 'text';
            input.className = 'formspec-input';
            input.id = fieldId;
            input.addEventListener('input', () => {
                const val = input.value;
                if (item.dataType === 'integer') {
                    answers[item.key] = val ? parseInt(val, 10) : null;
                } else if (item.dataType === 'decimal' || item.dataType === 'number') {
                    answers[item.key] = val ? parseFloat(val) : null;
                } else {
                    answers[item.key] = val || null;
                }
                clearFieldError();
            });
            fieldWrapper.appendChild(input);
        }

        fieldsContainer.appendChild(fieldWrapper);
    }

    const continueBtn = document.createElement('button');
    continueBtn.type = 'button';
    continueBtn.className = 'formspec-screener-continue';
    continueBtn.textContent = 'Continue';
    continueBtn.addEventListener('click', () => {
        // Clear prior errors
        for (const err of fieldsContainer.querySelectorAll('.formspec-error')) {
            err.remove();
        }

        // Validate: check screener.binds for required fields; if no binds exist,
        // require at least one answer to prevent empty routing.
        const binds: any[] = screener.binds || [];
        const requiredPaths = new Set(
            binds
                .filter((b: any) => b.required === 'true' || b.required === true)
                .map((b: any) => b.path)
        );
        let valid = true;

        if (requiredPaths.size > 0) {
            for (const item of screener.items) {
                if (!requiredPaths.has(item.key)) continue;
                const val = answers[item.key];
                if (val == null || val === '') {
                    valid = false;
                    const wrapper = fieldsContainer.querySelector(`[data-name="${item.key}"]`);
                    if (wrapper) {
                        const err = document.createElement('div');
                        err.className = 'formspec-error';
                        err.textContent = 'Required';
                        wrapper.appendChild(err);
                    }
                }
            }
        } else {
            // No explicit required binds — require at least one non-null answer
            const hasAny = screener.items.some((it: any) => {
                const val = answers[it.key];
                return val != null && val !== '';
            });
            if (!hasAny) {
                valid = false;
                // Show error on every unfilled field
                for (const item of screener.items) {
                    const val = answers[item.key];
                    if (val == null || val === '') {
                        const wrapper = fieldsContainer.querySelector(`[data-name="${item.key}"]`);
                        if (wrapper) {
                            const err = document.createElement('div');
                            err.className = 'formspec-error';
                            err.textContent = 'Required';
                            wrapper.appendChild(err);
                        }
                    }
                }
            }
        }
        if (!valid) return;

        const route = host.engine.evaluateScreener(answers);
        host._screenerRoute = route;
        const routeType = host.classifyScreenerRoute(route);
        const isInternal = routeType === 'internal';

        host.dispatchEvent(new CustomEvent('formspec-screener-route', {
            detail: { route, answers, routeType, isInternal },
            bubbles: true,
            composed: true,
        }));

        if (isInternal) {
            host._screenerCompleted = true;
            host.emitScreenerStateChange('route-internal', answers);
            host.render();
            return;
        }

        host.emitScreenerStateChange(route ? 'route-external' : 'route-none', answers);

        // For external routes, replace the screener with a route result panel
        // so the user sees feedback instead of a dead-end.
        if (route) {
            showExternalRouteResult(host, container, route);
        }
    });
    panel.appendChild(continueBtn);

    container.appendChild(panel);
}

function showExternalRouteResult(
    host: ScreenerHost,
    container: HTMLElement,
    route: { target: string; label?: string },
): void {
    container.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'formspec-screener-routed';

    const heading = document.createElement('h2');
    heading.className = 'formspec-screener-heading';
    heading.textContent = route.label || 'Routed to another form';
    panel.appendChild(heading);

    const target = document.createElement('p');
    target.className = 'formspec-screener-routed-target';
    target.textContent = route.target;
    panel.appendChild(target);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'formspec-screener-continue';
    backBtn.textContent = 'Back to screening';
    backBtn.addEventListener('click', () => {
        host._screenerRoute = null;
        host.emitScreenerStateChange('restart', undefined);
        host.render();
    });
    panel.appendChild(backBtn);

    container.appendChild(panel);
}
