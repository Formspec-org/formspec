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
            const fieldWrapper = document.createElement('div');
            fieldWrapper.className = 'form-field';
            fieldWrapper.dataset.name = item.name;

            const label = document.createElement('label');
            label.textContent = item.label || item.name;
            fieldWrapper.appendChild(label);

            const input = document.createElement('input');
            input.type = item.type === 'number' ? 'number' : 'text';
            input.name = item.name;
            if (item.readonly || item.calculate) {
                input.readOnly = true;
            }

            input.addEventListener('input', (e) => {
                const target = e.target as HTMLInputElement;
                let val: any = target.value;
                if (item.type === 'number') {
                    val = parseFloat(val) || 0;
                }
                this.engine!.setValue(item.name, val);
            });

            fieldWrapper.appendChild(input);
            container.appendChild(fieldWrapper);

            // Reactively bind value
            this.cleanupFns.push(effect(() => {
                const val = this.engine!.signals[item.name].value;
                if (document.activeElement !== input) {
                    input.value = val;
                }
            }));

            // Reactively bind visibility
            this.cleanupFns.push(effect(() => {
                const isVisible = this.engine!.visibleSignals[item.name].value;
                fieldWrapper.style.display = isVisible ? 'block' : 'none';
            }));
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
}
