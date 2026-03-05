import { effect, Signal } from '@preact/signals-core';
import { FormEngine } from 'formspec-engine';
import { ItemDescriptor, PresentationBlock } from 'formspec-layout';

export interface FieldInputHost {
    engine: FormEngine;
    _definition: any;
    _componentDocument: any;
    _registryEntries: Map<string, any>;
    cleanupFns: Array<() => void>;
    touchedFields: Set<string>;
    touchedVersion: Signal<number>;
    _latestSubmitDetailSignal?: Signal<any>;
    resolveItemPresentation(itemDesc: ItemDescriptor): PresentationBlock;
    resolveWidgetClassSlots(presentation: PresentationBlock): {
        root?: unknown;
        label?: unknown;
        control?: unknown;
        hint?: unknown;
        error?: unknown;
    };
    applyClassValue(el: HTMLElement, classValue: unknown): void;
    applyCssClass(el: HTMLElement, comp: any): void;
    applyStyle(el: HTMLElement, style: any): void;
    applyAccessibility(el: HTMLElement, comp: any): void;
    render(): void;
}

export function renderInputComponent(host: FieldInputHost, comp: any, item: any, fullName: string): HTMLElement {
    const dataType = item.dataType;

    const itemDesc: ItemDescriptor = { key: item.key, type: item.type || 'field', dataType };
    const themePresentation = host.resolveItemPresentation(itemDesc);
    const widgetClassSlots = host.resolveWidgetClassSlots(themePresentation);

    const componentType = comp.component;

    const optionSignal = host.engine.getOptionsSignal?.(fullName);
    const optionStateSignal = host.engine.getOptionsStateSignal?.(fullName);
    if (optionSignal || optionStateSignal) {
        let initialized = false;
        host.cleanupFns.push(effect(() => {
            optionSignal?.value;
            optionStateSignal?.value;
            if (!initialized) {
                initialized = true;
                return;
            }
            host.render();
        }));
    }
    const options = host.engine.getOptions?.(fullName) || item.options || [];
    const remoteOptionsState = host.engine.getOptionsState?.(fullName) || { loading: false, error: null };

    const matrix: Record<string, string[]> = {
        'string': ['TextInput', 'Select', 'RadioGroup'],
        'text': ['TextInput'],
        'decimal': ['NumberInput', 'Slider', 'Rating', 'TextInput'],
        'integer': ['NumberInput', 'Slider', 'Rating', 'TextInput'],
        'boolean': ['Toggle', 'Checkbox'],
        'date': ['DatePicker', 'TextInput'],
        'dateTime': ['DatePicker', 'TextInput'],
        'time': ['DatePicker', 'TextInput'],
        'uri': ['TextInput'],
        'choice': ['Select', 'RadioGroup', 'TextInput'],
        'multiChoice': ['CheckboxGroup'],
        'attachment': ['FileUpload', 'Signature'],
        'money': ['NumberInput', 'TextInput']
    };

    if (matrix[dataType] && !matrix[dataType].includes(componentType)) {
        console.warn(`Incompatible component ${componentType} for dataType ${dataType}.`);
    }

    const fieldWrapper = document.createElement('div');
    fieldWrapper.className = 'formspec-field';
    fieldWrapper.dataset.name = fullName;
    host.applyClassValue(fieldWrapper, widgetClassSlots.root);

    const fieldId = comp.id || `field-${fullName.replace(/[\.\[\]]/g, '-')}`;
    const hintId = `${fieldId}-hint`;
    const errorId = `${fieldId}-error`;
    const describedBy: string[] = [];

    const effectiveLabelPosition = comp.labelPosition || themePresentation.labelPosition || 'top';

    const label = document.createElement('label');
    label.className = 'formspec-label';
    label.textContent = comp.labelOverride || item.label || item.key;
    label.htmlFor = fieldId;
    host.applyClassValue(label, widgetClassSlots.label);

    if (effectiveLabelPosition === 'hidden') {
        label.classList.add('formspec-sr-only');
    } else if (effectiveLabelPosition === 'start') {
        fieldWrapper.classList.add('formspec-field--inline');
    } else if (effectiveLabelPosition === 'top' && (componentType === 'Toggle' || componentType === 'Checkbox')) {
        fieldWrapper.classList.add('formspec-field--inline');
    }

    fieldWrapper.appendChild(label);

    host.cleanupFns.push(effect(() => {
        const isRequired = host.engine.requiredSignals[fullName]?.value;
        if (isRequired) {
            label.innerHTML = `${comp.labelOverride || item.label || item.key} <span class="formspec-required">*</span>`;
        } else {
            label.textContent = comp.labelOverride || item.label || item.key;
        }
    }));

    if (item.hint || comp.hintOverride) {
        const hint = document.createElement('div');
        hint.className = 'formspec-hint';
        hint.id = hintId;
        hint.textContent = comp.hintOverride || item.hint;
        host.applyClassValue(hint, widgetClassSlots.hint);
        fieldWrapper.appendChild(hint);
        describedBy.push(hintId);
    }

    let input: HTMLElement;

    if (componentType === 'RadioGroup') {
        const container = document.createElement('div');
        container.className = 'formspec-radio-group';
        container.setAttribute('role', 'radiogroup');
        if (comp.orientation) container.dataset.orientation = comp.orientation;
        if (options.length > 0) {
            for (const opt of options) {
                const lbl = document.createElement('label');
                const rb = document.createElement('input');
                rb.type = 'radio';
                rb.value = opt.value;
                rb.name = fullName;
                rb.addEventListener('change', () => {
                    host.engine.setValue(fullName, rb.value);
                });
                lbl.appendChild(rb);
                lbl.appendChild(document.createTextNode(` ${opt.label}`));
                container.appendChild(lbl);
            }
        }
        input = container;
    } else if (dataType === 'multiChoice' || componentType === 'CheckboxGroup') {
        const container = document.createElement('div');
        container.className = 'formspec-checkbox-group';
        if (comp.columns && comp.columns > 1) {
            container.dataset.columns = String(comp.columns);
        }
        if (options.length > 0) {
            if (comp.selectAll) {
                const selectAllLbl = document.createElement('label');
                selectAllLbl.className = 'formspec-select-all';
                const selectAllCb = document.createElement('input');
                selectAllCb.type = 'checkbox';
                selectAllCb.addEventListener('change', () => {
                    const allCbs = container.querySelectorAll(`input[type="checkbox"][name="${fullName}"]`) as NodeListOf<HTMLInputElement>;
                    allCbs.forEach(cb => { cb.checked = selectAllCb.checked; });
                    const checked: string[] = [];
                    allCbs.forEach(cb => { if (cb.checked) checked.push(cb.value); });
                    host.engine.setValue(fullName, checked);
                });
                selectAllLbl.appendChild(selectAllCb);
                selectAllLbl.appendChild(document.createTextNode(' Select All'));
                container.appendChild(selectAllLbl);
            }
            for (const opt of options) {
                const lbl = document.createElement('label');
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = opt.value;
                cb.name = fullName;
                cb.addEventListener('change', () => {
                    const checked: string[] = [];
                    container.querySelectorAll(`input[type="checkbox"][name="${fullName}"]`).forEach((el: any) => {
                        if (el.checked) checked.push(el.value);
                    });
                    host.engine.setValue(fullName, checked);
                });
                lbl.appendChild(cb);
                lbl.appendChild(document.createTextNode(` ${opt.label}`));
                container.appendChild(lbl);
            }
        }
        input = container;
    } else if (dataType === 'money') {
        const container = document.createElement('div');
        container.className = 'formspec-money';
        const amountInput = document.createElement('input');
        amountInput.type = 'number';
        amountInput.className = 'formspec-input';
        amountInput.placeholder = comp.placeholder || 'Amount';
        amountInput.name = `${fullName}__amount`;
        // Support the same numeric constraint props as NumberInput.
        if (comp.step != null) amountInput.step = String(comp.step);
        if (comp.min != null) amountInput.min = String(comp.min);
        if (comp.max != null) amountInput.max = String(comp.max);
        const resolvedCurrency = item.currency || host._definition?.formPresentation?.defaultCurrency || null;
        let currencyEl: HTMLElement;
        let getCurrency: () => string;
        if (resolvedCurrency) {
            const badge = document.createElement('span');
            badge.className = 'formspec-money-currency';
            badge.textContent = resolvedCurrency;
            badge.setAttribute('aria-label', `Currency: ${resolvedCurrency}`);
            currencyEl = badge;
            getCurrency = () => resolvedCurrency;
        } else {
            const currencyInput = document.createElement('input');
            currencyInput.type = 'text';
            currencyInput.className = 'formspec-input formspec-money-currency-input';
            currencyInput.placeholder = 'Currency';
            currencyInput.name = `${fullName}__currency`;
            currencyInput.addEventListener('input', () => {
                const amount = amountInput.value === '' ? null : Number(amountInput.value);
                host.engine.setValue(fullName, { amount, currency: currencyInput.value });
            });
            host.cleanupFns.push(effect(() => {
                const sig = host.engine.signals[fullName];
                if (!sig) return;
                const v = sig.value;
                if (document.activeElement !== currencyInput && v != null && typeof v === 'object' && 'currency' in v) {
                    currencyInput.value = (v as any).currency || '';
                }
            }));
            currencyEl = currencyInput;
            getCurrency = () => currencyInput.value;
        }
        const updateMoney = () => {
            const amount = amountInput.value === '' ? null : Number(amountInput.value);
            host.engine.setValue(fullName, { amount, currency: getCurrency() });
        };
        amountInput.addEventListener('input', updateMoney);
        host.cleanupFns.push(effect(() => {
            const sig = host.engine.signals[fullName];
            if (!sig) return;
            const v = sig.value;
            if (document.activeElement !== amountInput) {
                if (v !== null && v !== undefined && typeof v === 'object' && 'amount' in v) {
                    amountInput.value = v.amount !== null && v.amount !== undefined ? String(v.amount) : '';
                } else if (typeof v === 'number') {
                    amountInput.value = String(v);
                }
            }
        }));
        container.appendChild(amountInput);
        container.appendChild(currencyEl);
        input = container;
    } else if (componentType === 'Select' || (dataType === 'choice' && componentType === 'TextInput')) {
        const select = document.createElement('select');
        select.className = 'formspec-input';
        select.name = fullName;
        if (comp.placeholder) {
            const placeholderOpt = document.createElement('option');
            placeholderOpt.value = '';
            placeholderOpt.textContent = comp.placeholder;
            placeholderOpt.disabled = true;
            placeholderOpt.selected = true;
            select.appendChild(placeholderOpt);
        }
        if (comp.clearable) {
            const clearOpt = document.createElement('option');
            clearOpt.value = '';
            clearOpt.textContent = '\u2014 Clear \u2014';
            select.appendChild(clearOpt);
        }
        if (options.length > 0) {
            for (const opt of options) {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                select.appendChild(option);
            }
        }
        input = select;
    } else if (componentType === 'Toggle' || componentType === 'Checkbox' || dataType === 'boolean') {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'formspec-input';
        checkbox.name = fullName;
        if (componentType === 'Toggle') {
            const toggleContainer = document.createElement('div');
            toggleContainer.className = 'formspec-toggle';
            toggleContainer.appendChild(checkbox);
            if (comp.onLabel || comp.offLabel) {
                const toggleLabel = document.createElement('span');
                toggleLabel.className = 'formspec-toggle-label';
                toggleLabel.textContent = comp.offLabel || '';
                toggleContainer.appendChild(toggleLabel);
                host.cleanupFns.push(effect(() => {
                    const sig = host.engine.signals[fullName];
                    toggleLabel.textContent = sig?.value ? (comp.onLabel || '') : (comp.offLabel || '');
                }));
            }
            input = toggleContainer;
        } else {
            input = checkbox;
        }
    } else {
        const htmlInput = document.createElement('input');
        htmlInput.className = 'formspec-input';
        htmlInput.name = fullName;
        if (componentType === 'NumberInput' || ['integer', 'decimal', 'number', 'money'].includes(dataType)) {
            htmlInput.type = 'number';
            if (comp.step != null) htmlInput.step = String(comp.step);
            if (comp.min != null) htmlInput.min = String(comp.min);
            if (comp.max != null) htmlInput.max = String(comp.max);
        } else if (componentType === 'DatePicker' || ['date', 'dateTime', 'time'].includes(dataType)) {
            let dateType = dataType === 'date' ? 'date' : (dataType === 'time' ? 'time' : 'datetime-local');
            if (comp.showTime === true && dateType === 'date') dateType = 'datetime-local';
            if (comp.showTime === false && dateType === 'datetime-local') dateType = 'date';
            htmlInput.type = dateType;
            if (comp.minDate) htmlInput.min = comp.minDate;
            if (comp.maxDate) htmlInput.max = comp.maxDate;
        } else {
            htmlInput.type = 'text';
        }

        // Apply registry-driven extension hints (inputMode, autocomplete, pattern, etc.)
        const exts = item?.extensions;
        if (htmlInput.type === 'text' && exts && typeof exts === 'object') {
            for (const [extName, extEnabled] of Object.entries(exts)) {
                if (!extEnabled) continue;
                const entry = host._registryEntries.get(extName);
                if (!entry) continue;
                const meta = entry.metadata;
                const constraints = entry.constraints;
                // HTML input type: explicit inputType > inputMode-derived
                if (meta?.inputType) {
                    htmlInput.type = meta.inputType;
                } else if (meta?.inputMode === 'email') {
                    htmlInput.type = 'email';
                } else if (meta?.inputMode === 'tel') {
                    htmlInput.type = 'tel';
                }
                if (meta?.inputMode && !comp.inputMode) htmlInput.inputMode = meta.inputMode;
                if (meta?.autocomplete) htmlInput.autocomplete = meta.autocomplete;
                if (meta?.sensitive) htmlInput.autocomplete = 'off';
                if (constraints?.maxLength != null) htmlInput.maxLength = constraints.maxLength;
                if (constraints?.pattern) htmlInput.pattern = constraints.pattern;
                if (meta?.mask && !comp.placeholder) htmlInput.placeholder = meta.mask;
            }
        }

        if (componentType === 'TextInput') {
            if (comp.placeholder) htmlInput.placeholder = comp.placeholder;
            if (comp.inputMode) htmlInput.inputMode = comp.inputMode;
            if (comp.maxLines && comp.maxLines > 1) {
                const textarea = document.createElement('textarea');
                textarea.className = 'formspec-input';
                textarea.name = fullName;
                textarea.rows = comp.maxLines;
                if (comp.placeholder) textarea.placeholder = comp.placeholder;
                input = textarea;
            } else if (comp.prefix || comp.suffix) {
                const wrapper = document.createElement('div');
                wrapper.className = 'formspec-input-wrapper';
                if (comp.prefix) {
                    const prefixEl = document.createElement('span');
                    prefixEl.className = 'formspec-prefix';
                    prefixEl.textContent = comp.prefix;
                    wrapper.appendChild(prefixEl);
                }
                wrapper.appendChild(htmlInput);
                if (comp.suffix) {
                    const suffixEl = document.createElement('span');
                    suffixEl.className = 'formspec-suffix';
                    suffixEl.textContent = comp.suffix;
                    wrapper.appendChild(suffixEl);
                }
                input = wrapper;
            } else {
                input = htmlInput;
            }
        } else {
            input = htmlInput;
        }
    }

    fieldWrapper.appendChild(input);

    if (remoteOptionsState.loading || remoteOptionsState.error) {
        const status = document.createElement('div');
        status.className = 'formspec-hint formspec-remote-options-status';
        if (remoteOptionsState.loading) {
            status.textContent = 'Loading options...';
        } else if (remoteOptionsState.error) {
            status.textContent = options.length > 0
                ? 'Remote options unavailable; using fallback options.'
                : 'Failed to load options.';
        }
        fieldWrapper.appendChild(status);
    }

    const actualInputEl = input.querySelector('input') || input.querySelector('select') || input.querySelector('textarea') || input;
    if (actualInputEl instanceof HTMLElement) {
        actualInputEl.id = fieldId;
        if (componentType === 'RadioGroup' || componentType === 'CheckboxGroup') {
            input.querySelectorAll('input').forEach(el => host.applyClassValue(el, widgetClassSlots.control));
        } else {
            host.applyClassValue(actualInputEl, widgetClassSlots.control);
        }
    }

    const errorDisplay = document.createElement('div');
    errorDisplay.className = 'formspec-error';
    errorDisplay.id = errorId;
    errorDisplay.setAttribute('role', 'alert');
    errorDisplay.setAttribute('aria-live', 'polite');
    host.applyClassValue(errorDisplay, widgetClassSlots.error);
    fieldWrapper.appendChild(errorDisplay);
    describedBy.push(errorId);

    if (actualInputEl instanceof HTMLElement) {
        actualInputEl.setAttribute('aria-describedby', describedBy.join(' '));
    }

    host.applyCssClass(fieldWrapper, themePresentation);
    host.applyStyle(fieldWrapper, themePresentation.style);
    host.applyAccessibility(fieldWrapper, themePresentation);

    host.applyAccessibility(fieldWrapper, comp);
    host.applyCssClass(fieldWrapper, comp);

    const isCustomInput = dataType === 'multiChoice' || componentType === 'CheckboxGroup' || dataType === 'money' || componentType === 'RadioGroup';
    if (!isCustomInput) {
        const actualInput = (comp.onLabel || comp.offLabel) && input.querySelector('input') ? input.querySelector('input')! : input;
        const eventName = actualInput instanceof HTMLSelectElement ? 'change' : 'input';
        actualInput.addEventListener(eventName, (e) => {
            const target = e.target as any;
            let val: any;
            if (dataType === 'boolean') {
                val = target.checked;
            } else if (['integer', 'decimal', 'number'].includes(dataType)) {
                val = target.value === '' ? null : Number(target.value);
            } else {
                val = target.value;
            }
            host.engine.setValue(fullName, val);
        });

        const bindableInput = input.querySelector('input') || input.querySelector('textarea') || input;

        host.cleanupFns.push(effect(() => {
            const sig = host.engine.signals[fullName];
            if (!sig) return;
            const val = sig.value;
            if (dataType === 'boolean') {
                if (document.activeElement !== bindableInput) (bindableInput as HTMLInputElement).checked = !!val;
            } else {
                if (document.activeElement !== bindableInput) (bindableInput as HTMLInputElement).value = val ?? '';
            }
        }));
    } else if (componentType === 'RadioGroup') {
        host.cleanupFns.push(effect(() => {
            const sig = host.engine.signals[fullName];
            if (!sig) return;
            const val = sig.value;
            const radios = input.querySelectorAll('input[type="radio"]') as NodeListOf<HTMLInputElement>;
            radios.forEach(rb => { rb.checked = rb.value === String(val ?? ''); });
        }));
    }

    const markTouched = () => {
        if (!host.touchedFields.has(fullName)) {
            host.touchedFields.add(fullName);
            host.touchedVersion.value += 1;
        }
    };
    fieldWrapper.addEventListener('focusout', markTouched);
    fieldWrapper.addEventListener('change', markTouched);

    host.cleanupFns.push(effect(() => {
        const isRelevant = host.engine.relevantSignals[fullName]?.value ?? true;
        fieldWrapper.classList.toggle('formspec-hidden', !isRelevant);
        if (actualInputEl instanceof HTMLElement) {
            actualInputEl.setAttribute('aria-hidden', String(!isRelevant));
        }
    }));

    host.cleanupFns.push(effect(() => {
        const isRequired = host.engine.requiredSignals[fullName]?.value ?? false;
        if (actualInputEl instanceof HTMLElement) {
            actualInputEl.setAttribute('aria-required', String(isRequired));
        }
    }));

    host.cleanupFns.push(effect(() => {
        const isReadonly = host.engine.readonlySignals[fullName]?.value ?? false;
        const readonlyTarget = input.querySelector('input') || input.querySelector('select') || input.querySelector('textarea') || input;
        if (readonlyTarget instanceof HTMLInputElement || readonlyTarget instanceof HTMLTextAreaElement) {
            readonlyTarget.readOnly = isReadonly;
        } else if (readonlyTarget instanceof HTMLSelectElement) {
            readonlyTarget.disabled = isReadonly;
        }
        if (actualInputEl instanceof HTMLElement) {
            actualInputEl.setAttribute('aria-readonly', String(isReadonly));
        }
        fieldWrapper.classList.toggle('formspec-field--readonly', isReadonly);
    }));

    host.cleanupFns.push(effect(() => {
        host.touchedVersion.value;
        const error = host.engine.errorSignals[fullName]?.value;

        // Check if there are any shape errors from the latest submit that target this path
        // ValidationReport results use 1-indexed paths (external format)
        const submitDetail = host._latestSubmitDetailSignal?.value;
        const externalPath = fullName.replace(/\[(\d+)\]/g, (_, p1) => `[${parseInt(p1) + 1}]`);
        const submitError = submitDetail?.validationReport?.results?.find((r: any) =>
            r.severity === 'error' && (r.path === fullName || r.path === externalPath || r.path === `${fullName}[*]`)
        )?.message;

        const effectiveError = error || submitError;
        const showError = host.touchedFields.has(fullName) ? (effectiveError || '') : '';
        errorDisplay.textContent = showError;
        if (actualInputEl instanceof HTMLElement) {
            actualInputEl.setAttribute('aria-invalid', String(!!showError));
        }
    }));

    host.applyStyle(fieldWrapper, comp.style);
    return fieldWrapper;
}
