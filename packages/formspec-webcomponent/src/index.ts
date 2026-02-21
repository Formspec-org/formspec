import { effect, signal } from '@preact/signals-core';
import { FormEngine } from 'formspec-engine';

export class FormspecRender extends HTMLElement {
    private _definition: any;
    private _componentDocument: any;
    private _themeDocument: any;
    private engine: FormEngine | null = null;
    private cleanupFns: Array<() => void> = [];

    set definition(val: any) {
        this._definition = val;
        this.engine = new FormEngine(val);
        this.render();
    }

    get definition() {
        return this._definition;
    }

    set componentDocument(val: any) {
        this._componentDocument = val;
        this.render();
    }

    get componentDocument() {
        return this._componentDocument;
    }

    set themeDocument(val: any) {
        this._themeDocument = val;
        this.render();
    }

    get themeDocument() {
        return this._themeDocument;
    }

    getEngine() {
        return this.engine;
    }

    private cleanup() {
        for (const fn of this.cleanupFns) {
            fn();
        }
        this.cleanupFns = [];
        this.innerHTML = '';
    }

    render() {
        this.cleanup();
        if (!this.engine || !this._definition) return;

        const container = document.createElement('div');
        container.className = 'formspec-container';

        if (this._componentDocument && this._componentDocument.tree) {
            this.renderComponent(this._componentDocument.tree, container);
        } else {
            for (const item of this._definition.items) {
                this.renderItem(item, container);
            }
        }

        const submitBtn = document.createElement('button');
        submitBtn.type = 'button';
        submitBtn.textContent = 'Submit';
        submitBtn.addEventListener('click', () => {
            const response = this.engine!.getResponse();
            this.dispatchEvent(new CustomEvent('formspec-submit', {
                detail: response,
                bubbles: true
            }));
        });
        container.appendChild(submitBtn);

        this.appendChild(container);
    }

    private findItemByKey(key: string, items: any[] = this._definition.items): any | null {
        for (const item of items) {
            if (item.key === key || item.name === key) return item;
            if (item.children) {
                const found = this.findItemByKey(key, item.children);
                if (found) return found;
            }
        }
        return null;
    }

    private resolveToken(val: any): any {
        if (typeof val === 'string' && val.startsWith('$token.')) {
            const tokenKey = val.substring(7);
            if (this._componentDocument?.tokens && this._componentDocument.tokens[tokenKey] !== undefined) {
                return this._componentDocument.tokens[tokenKey];
            }
            if (this._themeDocument?.tokens && this._themeDocument.tokens[tokenKey] !== undefined) {
                return this._themeDocument.tokens[tokenKey];
            }
        }
        return val;
    }

    private applyStyle(el: HTMLElement, style: any) {
        if (!style) return;
        for (const [key, val] of Object.entries(style)) {
            const resolved = this.resolveToken(val);
            (el.style as any)[key] = resolved;
        }
    }

    private renderDataTableCell(td: HTMLElement, fieldName: string) {
        const signal = this.engine!.signals[fieldName];
        if (signal) {
            this.cleanupFns.push(effect(() => {
                td.textContent = signal.value;
            }));
        }
    }

    private renderComponent(comp: any, parent: HTMLElement, prefix = '') {
        // Handle 'when' condition
        if (comp.when) {
            const wrapper = document.createElement('div');
            parent.appendChild(wrapper);
            const exprFn = this.engine!.compileExpression(comp.when, prefix);
            this.cleanupFns.push(effect(() => {
                const visible = !!exprFn();
                wrapper.style.display = visible ? 'contents' : 'none';
            }));
            parent = wrapper;
        }

        const componentType = comp.component;
        let el: HTMLElement | null = null;

        if (componentType === 'Stack') {
            el = document.createElement('div');
            el.className = 'formspec-stack';
            el.style.display = 'flex';
            el.style.flexDirection = comp.direction === 'horizontal' ? 'row' : 'column';
            el.style.gap = this.resolveToken(comp.gap) || '1rem';
            if (comp.children) {
                for (const child of comp.children) {
                    this.renderComponent(child, el, prefix);
                }
            }
        } else if (componentType === 'Grid') {
            el = document.createElement('div');
            el.className = 'formspec-grid';
            el.style.display = 'grid';
            const cols = comp.columns || 2;
            if (typeof cols === 'number') {
                el.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
            } else {
                el.style.gridTemplateColumns = this.resolveToken(cols);
            }
            el.style.gap = this.resolveToken(comp.gap) || '1rem';
            if (comp.children) {
                for (const child of comp.children) {
                    this.renderComponent(child, el, prefix);
                }
            }
        } else if (componentType === 'Page') {
            el = document.createElement('section');
            el.className = 'formspec-page';
            if (comp.title) {
                const h2 = document.createElement('h2');
                h2.textContent = comp.title;
                el.appendChild(h2);
            }
            if (comp.description) {
                const p = document.createElement('p');
                p.textContent = comp.description;
                el.appendChild(p);
            }
            if (comp.children) {
                for (const child of comp.children) {
                    this.renderComponent(child, el, prefix);
                }
            }
        } else if (componentType === 'Card') {
            el = document.createElement('div');
            el.className = 'formspec-card';
            el.style.border = '1px solid #ddd';
            el.style.borderRadius = this.resolveToken('$token.border.radius') || '8px';
            el.style.padding = this.resolveToken('$token.spacing.md') || '1rem';
            el.style.margin = '1rem 0';
            if (comp.title) {
                const h3 = document.createElement('h3');
                h3.textContent = comp.title;
                el.appendChild(h3);
            }
            if (comp.children) {
                for (const child of comp.children) {
                    this.renderComponent(child, el, prefix);
                }
            }
        } else if (componentType === 'Heading') {
            el = document.createElement(`h${comp.level || 1}`);
            el.textContent = comp.text || '';
        } else if (componentType === 'Text') {
            el = document.createElement('p');
            if (comp.bind) {
                const fullName = prefix ? `${prefix}.${comp.bind}` : comp.bind;
                const signal = this.engine!.signals[fullName];
                this.cleanupFns.push(effect(() => {
                    el!.textContent = signal ? signal.value : '';
                }));
            } else {
                el.textContent = comp.text || '';
            }
        } else if (componentType === 'Divider') {
            el = document.createElement('hr');
        } else if (componentType === 'Spacer') {
            el = document.createElement('div');
            const size = this.resolveToken(comp.size) || '1rem';
            el.style.height = size;
        } else if (componentType === 'Alert') {
            el = document.createElement('div');
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
        } else if (componentType === 'Badge') {
            el = document.createElement('span');
            el.className = `formspec-badge badge-${comp.variant || 'default'}`;
            el.style.padding = '0.25em 0.4em';
            el.style.fontSize = '75%';
            el.style.fontWeight = '700';
            el.style.borderRadius = '0.25rem';
            el.style.backgroundColor = '#6c757d';
            el.style.color = '#fff';
            el.textContent = comp.text || '';
        } else if (componentType === 'Summary') {
            el = document.createElement('div');
            el.className = 'formspec-summary';
            const dl = document.createElement('dl');
            if (comp.items) {
                for (const summaryItem of comp.items) {
                    const dt = document.createElement('dt');
                    dt.textContent = summaryItem.label;
                    dl.appendChild(dt);
                    const dd = document.createElement('dd');
                    const fullName = prefix ? `${prefix}.${summaryItem.bind}` : summaryItem.bind;
                    const signal = this.engine!.signals[fullName];
                    this.cleanupFns.push(effect(() => {
                        dd.textContent = signal ? signal.value : '';
                    }));
                    dl.appendChild(dd);
                }
            }
            el.appendChild(dl);
        } else if (componentType === 'DataTable') {
            el = document.createElement('div');
            el.className = 'formspec-datatable';
            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const tr = document.createElement('tr');
            if (comp.columns) {
                for (const col of comp.columns) {
                    const th = document.createElement('th');
                    th.textContent = col.header;
                    tr.appendChild(th);
                }
            }
            thead.appendChild(tr);
            table.appendChild(thead);
            const tbody = document.createElement('tbody');
            table.appendChild(tbody);

            const fullName = prefix ? `${prefix}.${comp.bind}` : comp.bind;
            this.cleanupFns.push(effect(() => {
                const count = this.engine!.repeats[fullName]?.value || 0;
                tbody.innerHTML = '';
                for (let i = 0; i < count; i++) {
                    const row = document.createElement('tr');
                    if (comp.columns) {
                        for (const col of comp.columns) {
                            const td = document.createElement('td');
                            const fieldName = `${fullName}[${i}].${col.bind}`;
                            this.renderDataTableCell(td, fieldName);
                            row.appendChild(td);
                        }
                    }
                    tbody.appendChild(row);
                }
            }));
            el.appendChild(table);
        } else if (componentType === 'Tabs') {
            el = document.createElement('div');
            el.className = 'formspec-tabs';
            const tabList = document.createElement('div');
            tabList.style.display = 'flex';
            tabList.style.borderBottom = '1px solid #ccc';
            el.appendChild(tabList);
            const contentArea = document.createElement('div');
            el.appendChild(contentArea);

            const activeTab = signal(comp.defaultTab || 0);
            if (comp.children) {
                comp.children.forEach((child: any, idx: number) => {
                    const btn = document.createElement('button');
                    btn.textContent = comp.tabLabels?.[idx] || child.title || `Tab ${idx + 1}`;
                    btn.style.padding = '0.5rem 1rem';
                    btn.style.border = 'none';
                    btn.style.background = 'none';
                    btn.style.cursor = 'pointer';
                    this.cleanupFns.push(effect(() => {
                        btn.style.borderBottom = activeTab.value === idx ? '2px solid blue' : 'none';
                        btn.style.fontWeight = activeTab.value === idx ? 'bold' : 'normal';
                    }));
                    btn.addEventListener('click', () => activeTab.value = idx);
                    tabList.appendChild(btn);

                    const tabContent = document.createElement('div');
                    this.cleanupFns.push(effect(() => {
                        tabContent.style.display = activeTab.value === idx ? 'block' : 'none';
                    }));
                    this.renderComponent(child, tabContent, prefix);
                    contentArea.appendChild(tabContent);
                });
            }
        } else if (componentType === 'Wizard') {
            el = document.createElement('div');
            el.className = 'formspec-wizard';
            const currentStep = signal(0);
            const contentArea = document.createElement('div');
            el.appendChild(contentArea);

            const nav = document.createElement('div');
            nav.style.marginTop = '1rem';
            const prevBtn = document.createElement('button');
            prevBtn.textContent = 'Previous';
            prevBtn.addEventListener('click', () => { if (currentStep.value > 0) currentStep.value--; });
            const nextBtn = document.createElement('button');
            nextBtn.textContent = 'Next';
            nextBtn.addEventListener('click', () => { if (currentStep.value < (comp.children?.length || 1) - 1) currentStep.value++; });
            nav.appendChild(prevBtn);
            nav.appendChild(nextBtn);
            el.appendChild(nav);

            if (comp.children) {
                comp.children.forEach((child: any, idx: number) => {
                    const stepContent = document.createElement('div');
                    this.cleanupFns.push(effect(() => {
                        stepContent.style.display = currentStep.value === idx ? 'block' : 'none';
                    }));
                    this.renderComponent(child, stepContent, prefix);
                    contentArea.appendChild(stepContent);
                });
            }
            this.cleanupFns.push(effect(() => {
                prevBtn.disabled = currentStep.value === 0;
                nextBtn.disabled = currentStep.value === (comp.children?.length || 1) - 1;
            }));
        } else if (['TextInput', 'NumberInput', 'DatePicker', 'Select', 'Toggle'].includes(componentType)) {
            const item = this.findItemByKey(comp.bind);
            if (item) {
                const originalLabel = item.label;
                if (comp.labelOverride) item.label = comp.labelOverride;
                this.renderItem(item, parent, prefix);
                if (comp.labelOverride) item.label = originalLabel;
            }
        } else if (componentType === 'ConditionalGroup') {
            if (comp.children) {
                for (const child of comp.children) {
                    this.renderComponent(child, parent, prefix);
                }
            }
        }

        if (el) {
            this.applyStyle(el, comp.style);
            parent.appendChild(el);
        }
    }

    private renderItem(item: any, parent: HTMLElement, prefix = '') {
        const key = item.key || item.name;
        const fullName = prefix ? `${prefix}.${key}` : key;
        const dataType = item.dataType || item.type;

        if (item.type === 'group' && item.repeatable) {
            const groupWrapper = document.createElement('div');
            groupWrapper.className = 'repeat-group';
            groupWrapper.dataset.name = fullName;
            const title = document.createElement('h3');
            title.textContent = item.label || key;
            groupWrapper.appendChild(title);

            const instancesContainer = document.createElement('div');
            groupWrapper.appendChild(instancesContainer);

            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.textContent = `Add ${item.label || key}`;
            addBtn.addEventListener('click', () => {
                const index = this.engine!.addRepeatInstance(fullName);
                // The effect will handle rendering the new instance
            });
            groupWrapper.appendChild(addBtn);

            this.cleanupFns.push(effect(() => {
                const count = this.engine!.repeats[fullName].value;
                // Render instances that aren't there yet
                const currentCount = instancesContainer.children.length;
                for (let i = currentCount; i < count; i++) {
                    const instanceWrapper = document.createElement('div');
                    instanceWrapper.className = 'repeat-instance';
                    instanceWrapper.style.border = '1px solid #ccc';
                    instanceWrapper.style.margin = '10px';
                    instanceWrapper.style.padding = '10px';
                    instanceWrapper.dataset.index = String(i);
                    
                    if (item.children) {
                        for (const child of item.children) {
                            this.renderItem(child, instanceWrapper, `${fullName}[${i}]`);
                        }
                    }
                    instancesContainer.appendChild(instanceWrapper);
                }
            }));

            parent.appendChild(groupWrapper);
        } else if (item.type === 'group' && item.children) {
            const groupWrapper = document.createElement('div');
            groupWrapper.className = 'group';
            const title = document.createElement('h3');
            title.textContent = item.label || key;
            groupWrapper.appendChild(title);
            for (const child of item.children) {
                this.renderItem(child, groupWrapper, fullName);
            }
            parent.appendChild(groupWrapper);
        } else {
            const fieldWrapper = document.createElement('div');
            fieldWrapper.className = 'form-field';
            fieldWrapper.dataset.name = fullName;

            const label = document.createElement('label');
            label.textContent = item.label || key;
            fieldWrapper.appendChild(label);

            let input: HTMLInputElement | HTMLSelectElement;

            if (dataType === 'choice') {
                input = document.createElement('select');
                input.name = fullName;
                if (item.options) {
                    for (const opt of item.options) {
                        const option = document.createElement('option');
                        option.value = opt.value;
                        option.textContent = opt.label;
                        input.appendChild(option);
                    }
                } else if (item.optionsUrl) {
                    // Phase 6 REST API Binding
                    fetch(item.optionsUrl)
                        .then(res => res.json())
                        .then(data => {
                            for (const opt of data) {
                                const option = document.createElement('option');
                                option.value = opt.value || opt.id;
                                option.textContent = opt.label || opt.name;
                                input.appendChild(option);
                            }
                        })
                        .catch(err => console.error('Failed to load options', err));
                }
            } else if (dataType === 'multiChoice') {
                const container = document.createElement('div');
                container.className = 'checkbox-group';
                if (item.options) {
                    for (const opt of item.options) {
                        const wrapper = document.createElement('label');
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.value = opt.value;
                        const fullNameRef = fullName;
                        const containerRef = container;
                        checkbox.addEventListener('change', (e: any) => {
                            const selected = Array.from(containerRef.querySelectorAll('input:checked')).map((i: any) => i.value);
                            this.engine!.setValue(fullNameRef, selected);
                        });
                        wrapper.appendChild(checkbox);
                        wrapper.appendChild(document.createTextNode(opt.label));
                        container.appendChild(wrapper);
                    }
                }
                fieldWrapper.appendChild(container);
                input = container as any;
            } else if (dataType === 'money') {
                const amountInput = document.createElement('input');
                amountInput.type = 'number';
                amountInput.placeholder = 'Amount';
                const currencyInput = document.createElement('input');
                currencyInput.type = 'text';
                currencyInput.placeholder = 'Currency';
                currencyInput.value = item.currency || 'USD';

                const updateMoney = () => {
                    this.engine!.setValue(fullName, {
                        amount: amountInput.value === '' ? null : Number(amountInput.value),
                        currency: currencyInput.value
                    });
                };
                amountInput.addEventListener('input', updateMoney);
                currencyInput.addEventListener('input', updateMoney);

                const container = document.createElement('div');
                container.appendChild(amountInput);
                container.appendChild(currencyInput);
                fieldWrapper.appendChild(container);
                input = amountInput as any; // simplified for binding effect below
            } else {
                input = document.createElement('input');
                input.name = fullName;
                if (dataType === 'number' || dataType === 'integer' || dataType === 'decimal') {
                    input.type = 'number';
                } else if (dataType === 'boolean') {
                    input.type = 'checkbox';
                } else if (dataType === 'date') {
                    input.type = 'date';
                } else {
                    input.type = 'text';
                }
            }

            if (item.readonly || item.calculate) {
                if (input instanceof HTMLInputElement) {
                    input.readOnly = true;
                } else {
                    input.disabled = true;
                }
            }

            input.addEventListener('input', (e) => {
                const target = e.target as any;
                let val: any;
                if (dataType === 'boolean') {
                    val = target.checked;
                } else if (dataType === 'multiChoice') {
                    // Handled by specific listeners
                    return;
                } else if (dataType === 'money') {
                    // Handled by specific listeners
                    return;
                } else if (dataType === 'number' || dataType === 'integer' || dataType === 'decimal') {
                    val = target.value === '' ? null : Number(target.value);
                } else {
                    val = target.value;
                }
                this.engine!.setValue(fullName, val);
            });

            // For select and checkbox, 'change' is often better, but 'input' works on many browsers too.
            // Let's add 'change' just in case.
            input.addEventListener('change', (e) => {
                const target = e.target as any;
                let val: any;
                if (dataType === 'boolean') {
                    val = target.checked;
                } else if (dataType === 'multiChoice') {
                    return;
                } else if (dataType === 'money') {
                    return;
                } else {
                    val = target.value;
                }
                this.engine!.setValue(fullName, val);
            });

            fieldWrapper.appendChild(input);

            const errorDisplay = document.createElement('div');
            errorDisplay.className = 'error-message';
            errorDisplay.style.color = 'red';
            fieldWrapper.appendChild(errorDisplay);

            parent.appendChild(fieldWrapper);

            // Reactively bind value
            this.cleanupFns.push(effect(() => {
                const signal = this.engine!.signals[fullName];
                if (!signal) return;
                const val = signal.value;
                if (dataType === 'boolean') {
                    if (document.activeElement !== input) {
                        (input as HTMLInputElement).checked = !!val;
                    }
                } else if (dataType === 'multiChoice') {
                    const checks = (input as any as HTMLElement).querySelectorAll('input');
                    checks.forEach((c: any) => {
                        if (document.activeElement !== c) {
                            c.checked = Array.isArray(val) && val.includes(c.value);
                        }
                    });
                } else if (dataType === 'money') {
                    const [amtInput, curInput] = Array.from((input as any as HTMLElement).parentElement!.querySelectorAll('input'));
                    if (document.activeElement !== amtInput) amtInput.value = val?.amount ?? '';
                    if (document.activeElement !== curInput) curInput.value = val?.currency ?? 'USD';
                } else {
                    if (document.activeElement !== input) {
                        input.value = val;
                    }
                }
            }));

            // Reactively bind visibility
            if (this.engine!.visibleSignals[fullName]) {
                this.cleanupFns.push(effect(() => {
                    const isVisible = this.engine!.visibleSignals[fullName].value;
                    fieldWrapper.style.display = isVisible ? 'block' : 'none';
                }));
            }

            // Reactively bind validation errors
            if (this.engine!.errorSignals[fullName]) {
                this.cleanupFns.push(effect(() => {
                    const error = this.engine!.errorSignals[fullName].value;
                    errorDisplay.textContent = error || '';
                }));
            }
        }
    }
}
