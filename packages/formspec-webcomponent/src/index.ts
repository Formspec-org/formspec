import { effect } from '@preact/signals-core';
import { FormEngine } from 'formspec-engine';

export class FormspecRender extends HTMLElement {
    private _definition: any;
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

        for (const item of this._definition.items) {
            this.renderItem(item, container);
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

    private renderItem(item: any, parent: HTMLElement, prefix = '') {
        const fullName = prefix ? `${prefix}.${item.name}` : item.name;

        if (item.type === 'group' && item.repeatable) {
            const groupWrapper = document.createElement('div');
            groupWrapper.className = 'repeat-group';
            groupWrapper.dataset.name = fullName;
            const title = document.createElement('h3');
            title.textContent = item.label || item.name;
            groupWrapper.appendChild(title);

            const instancesContainer = document.createElement('div');
            groupWrapper.appendChild(instancesContainer);

            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.textContent = `Add ${item.label || item.name}`;
            addBtn.addEventListener('click', () => {
                this.engine!.addRepeatInstance(fullName);
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
            title.textContent = item.label || item.name;
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
            label.textContent = item.label || item.name;
            fieldWrapper.appendChild(label);

            let input: HTMLInputElement | HTMLSelectElement;

            if (item.type === 'choice') {
                input = document.createElement('select');
                input.name = fullName;
                if (item.options) {
                    for (const opt of item.options) {
                        const option = document.createElement('option');
                        option.value = opt.value;
                        option.textContent = opt.label;
                        input.appendChild(option);
                    }
                }
            } else {
                input = document.createElement('input');
                input.name = fullName;
                if (item.type === 'number') {
                    input.type = 'number';
                } else if (item.type === 'boolean') {
                    input.type = 'checkbox';
                } else if (item.type === 'date') {
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
                if (item.type === 'boolean') {
                    val = target.checked;
                } else if (item.type === 'number') {
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
                if (item.type === 'boolean') {
                    val = target.checked;
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
                if (document.activeElement !== input) {
                    if (item.type === 'boolean') {
                        (input as HTMLInputElement).checked = !!val;
                    } else {
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
