import { signal, computed, Signal } from '@preact/signals-core';

export interface FormspecDefinition {
    items: Array<{
        type: string;
        key?: string;
        name: string;
        label?: string;
        calculate?: string;
        visible?: string;
        valid?: string;
        readonly?: boolean;
    }>;
    [key: string]: any;
}

export class FormEngine {
    private definition: FormspecDefinition;
    public signals: Record<string, Signal<any>> = {};
    public visibleSignals: Record<string, Signal<boolean>> = {};
    public errorSignals: Record<string, Signal<string | null>> = {};

    constructor(definition: FormspecDefinition) {
        this.definition = definition;
        this.initializeSignals();
    }

    private initializeSignals() {
        // Pass 1: Initialize raw value signals
        for (const item of this.definition.items) {
            const initialValue = item.type === 'number' ? 0 : '';
            this.signals[item.name] = signal(initialValue);
        }

        // Helper to compile a basic FEL string to a JS function for E2E tests
        const compileFEL = (expression: string, currentItemName: string) => {
            return () => {
                const names = Object.keys(this.signals).filter(n => n !== currentItemName);
                const values = names.map(n => this.signals[n].value);
                const funcBody = `
                    ${names.map((n, i) => `const ${n} = arguments[${i}];`).join('\n')}
                    return ${expression};
                `;
                try {
                    const func = new Function(funcBody);
                    return func.apply(null, values);
                } catch (e) {
                    return null;
                }
            };
        };

        // Pass 2: Initialize computed signals (calculate, visible, valid)
        for (const item of this.definition.items) {
            if (item.calculate) {
                const evaluator = compileFEL(item.calculate, item.name);
                this.signals[item.name] = computed(evaluator);
            }

            if (item.visible) {
                const evaluator = compileFEL(item.visible, item.name);
                this.visibleSignals[item.name] = computed(() => !!evaluator());
            } else {
                this.visibleSignals[item.name] = signal(true);
            }

            if (item.valid) {
                const evaluator = compileFEL(item.valid, item.name);
                this.errorSignals[item.name] = computed(() => evaluator() ? null : "Invalid");
            } else {
                this.errorSignals[item.name] = signal(null);
            }
        }
    }

    public setValue(name: string, value: any) {
        if (this.signals[name] && !(this.signals[name] instanceof computed)) {
            this.signals[name].value = value;
        }
    }

    public getResponse() {
        const data: any = {};
        for (const item of this.definition.items) {
            if (this.visibleSignals[item.name].value) {
                data[item.name] = this.signals[item.name].value;
            }
        }
        return { data };
    }
}
