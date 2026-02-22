import { effect, signal } from '@preact/signals-core';
import { FormEngine } from 'formspec-engine';
import { globalRegistry } from './registry';
import { registerDefaultComponents } from './components';
import { RenderContext, ComponentPlugin } from './types';

registerDefaultComponents();

export class FormspecRender extends HTMLElement {
    private _definition: any;
    private _componentDocument: any;
    private _themeDocument: any;
    private engine: FormEngine | null = null;
    private cleanupFns: Array<() => void> = [];

    set definition(val: any) {
        console.log("Setting definition", val);
        this._definition = val;
        try {
            this.engine = new FormEngine(val);
            console.log("Engine initialized");
        } catch (e) {
            console.error("Engine initialization failed", e);
        }
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

        // Verify Component Document §2.1 & §2.2
        if (this._componentDocument) {
            if (this._componentDocument.$formspecComponent !== '1.0') {
                console.warn(`Unsupported Component Document version: ${this._componentDocument.$formspecComponent}`);
            }

            if (this._componentDocument.targetDefinition) {
                const target = this._componentDocument.targetDefinition;
                if (target.url !== this._definition.url) {
                    console.warn(`Component Document target URL (${target.url}) does not match Definition URL (${this._definition.url})`);
                }
            }
        }

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

    private findItemByKey = (key: string, items: any[] = this._definition.items): any | null => {
        for (const item of items) {
            if (item.key === key) return item;
            if (item.children) {
                const found = this.findItemByKey(key, item.children);
                if (found) return found;
            }
        }
        return null;
    }

    private resolveToken = (val: any): any => {
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

    private applyStyle = (el: HTMLElement, style: any) => {
        if (!style) return;
        for (const [key, val] of Object.entries(style)) {
            const resolved = this.resolveToken(val);
            (el.style as any)[key] = resolved;
        }
    }

    private renderComponent = (comp: any, parent: HTMLElement, prefix = '') => {
        // Handle 'when' condition (§8)
        if (comp.when) {
            const wrapper = document.createElement('div');
            wrapper.style.display = 'contents';
            parent.appendChild(wrapper);
            const exprFn = this.engine!.compileExpression(comp.when, prefix);
            this.cleanupFns.push(effect(() => {
                const visible = !!exprFn();
                wrapper.style.display = visible ? 'contents' : 'none';
            }));
            parent = wrapper;
        }

        const componentType = comp.component;
        
        // Handle Repeatable Group Binding (§4.4)
        if (comp.bind && comp.component !== 'DataTable') {
            const item = this.findItemByKey(comp.bind);
            if (item && item.type === 'group' && item.repeatable) {
                const fullName = prefix ? `${prefix}.${comp.bind}` : comp.bind;
                const container = document.createElement('div');
                container.className = `repeatable-container-${comp.bind}`;
                parent.appendChild(container);

                this.cleanupFns.push(effect(() => {
                    const count = this.engine!.repeats[fullName]?.value || 0;
                    while (container.children.length > count) {
                        container.removeChild(container.lastChild!);
                    }
                    while (container.children.length < count) {
                        const idx = container.children.length;
                        const instanceWrapper = document.createElement('div');
                        instanceWrapper.style.display = 'contents';
                        container.appendChild(instanceWrapper);
                        
                        const instancePrefix = `${fullName}[${idx}]`;
                        this.renderActualComponent(comp, instanceWrapper, instancePrefix);
                    }
                }));
                return;
            }
        }

        this.renderActualComponent(comp, parent, prefix);
    }

    private renderActualComponent(comp: any, parent: HTMLElement, prefix = '') {
        const componentType = comp.component;
        const plugin = globalRegistry.get(componentType);

        if (plugin) {
            const ctx: RenderContext = {
                engine: this.engine!,
                componentDocument: this._componentDocument,
                themeDocument: this._themeDocument,
                prefix,
                renderComponent: this.renderComponent,
                resolveToken: this.resolveToken,
                applyStyle: this.applyStyle,
                cleanupFns: this.cleanupFns,
                findItemByKey: this.findItemByKey,
                renderInputComponent: this.renderInputComponent
            };
            plugin.render(comp, parent, ctx);
        } else {
            console.warn(`Unknown component type: ${componentType}`);
        }
    }

    private renderInputComponent = (comp: any, item: any, fullName: string): HTMLElement => {
        const dataType = item.dataType;
        const componentType = comp.component;

        // §4.6 Bind/dataType Compatibility Matrix
        const matrix: Record<string, string[]> = {
            'string': ['TextInput', 'Select', 'RadioGroup'],
            'decimal': ['NumberInput', 'Slider', 'Rating', 'TextInput'],
            'integer': ['NumberInput', 'Slider', 'Rating', 'TextInput'],
            'boolean': ['Toggle', 'Checkbox'],
            'date': ['DatePicker', 'TextInput'],
            'dateTime': ['DatePicker', 'TextInput'],
            'time': ['DatePicker', 'TextInput'],
            'choice': ['Select', 'RadioGroup', 'TextInput'],
            'multiChoice': ['CheckboxGroup'],
            'attachment': ['FileUpload', 'Signature'],
            'money': ['NumberInput', 'TextInput']
        };

        if (matrix[dataType] && !matrix[dataType].includes(componentType)) {
            console.warn(`Incompatible component ${componentType} for dataType ${dataType}.`);
        }

        const fieldWrapper = document.createElement('div');
        fieldWrapper.className = 'form-field';
        fieldWrapper.dataset.name = fullName;

        const label = document.createElement('label');
        label.textContent = comp.labelOverride || item.label || item.key;
        fieldWrapper.appendChild(label);
        
        // §4.2.3 Required indicator
        this.cleanupFns.push(effect(() => {
            const isRequired = this.engine!.requiredSignals[fullName]?.value;
            if (isRequired) {
                label.innerHTML = `${comp.labelOverride || item.label || item.key} <span class="required-indicator" style="color: red">*</span>`;
            } else {
                label.textContent = comp.labelOverride || item.label || item.key;
            }
        }));

        if (item.hint || comp.hintOverride) {
            const hint = document.createElement('div');
            hint.className = 'field-hint';
            hint.textContent = comp.hintOverride || item.hint;
            hint.style.fontSize = '0.8rem';
            hint.style.color = '#666';
            fieldWrapper.appendChild(hint);
        }

        let input: HTMLElement;

        if (componentType === 'Select' || (dataType === 'choice' && componentType === 'TextInput')) {
             const select = document.createElement('select');
             select.name = fullName;
             if (item.options) {
                 for (const opt of item.options) {
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
            checkbox.name = fullName;
            input = checkbox;
        } else {
            const htmlInput = document.createElement('input');
            htmlInput.name = fullName;
            if (componentType === 'NumberInput' || ['integer', 'decimal', 'money'].includes(dataType)) {
                htmlInput.type = 'number';
            } else if (componentType === 'DatePicker' || ['date', 'dateTime', 'time'].includes(dataType)) {
                htmlInput.type = dataType === 'date' ? 'date' : (dataType === 'time' ? 'time' : 'datetime-local');
            } else {
                htmlInput.type = 'text';
            }
            
            // Apply TextInput specific props (§5.6)
            if (componentType === 'TextInput') {
                if (comp.placeholder) htmlInput.placeholder = comp.placeholder;
                if (comp.inputMode) htmlInput.inputMode = comp.inputMode;
                if (comp.maxLines && comp.maxLines > 1) {
                    const textarea = document.createElement('textarea');
                    textarea.name = fullName;
                    textarea.rows = comp.maxLines;
                    if (comp.placeholder) textarea.placeholder = comp.placeholder;
                    input = textarea;
                } else {
                    input = htmlInput;
                }
            } else {
                input = htmlInput;
            }
        }

        fieldWrapper.appendChild(input);
        if (comp.id) input.id = comp.id;

        const errorDisplay = document.createElement('div');
        errorDisplay.className = 'error-message';
        errorDisplay.style.color = 'red';
        errorDisplay.style.fontSize = '0.8rem';
        fieldWrapper.appendChild(errorDisplay);

        // Bind events
        input.addEventListener('input', (e) => {
            const target = e.target as any;
            let val: any;
            if (dataType === 'boolean') {
                val = target.checked;
            } else if (['integer', 'decimal', 'money'].includes(dataType)) {
                val = target.value === '' ? null : Number(target.value);
            } else {
                val = target.value;
            }
            this.engine!.setValue(fullName, val);
        });

        // Reactively bind value
        this.cleanupFns.push(effect(() => {
            const sig = this.engine!.signals[fullName];
            if (!sig) return;
            const val = sig.value;
            if (dataType === 'boolean') {
                if (document.activeElement !== input) (input as HTMLInputElement).checked = !!val;
            } else {
                if (document.activeElement !== input) (input as HTMLInputElement).value = val ?? '';
            }
        }));

        // Relevancy, Readonly, Error signals (§4.2)
        this.cleanupFns.push(effect(() => {
            const isRelevant = this.engine!.relevantSignals[fullName]?.value ?? true;
            fieldWrapper.style.display = isRelevant ? 'block' : 'none';
        }));

        this.cleanupFns.push(effect(() => {
            const isReadonly = this.engine!.readonlySignals[fullName]?.value ?? false;
            if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) (input as any).readOnly = isReadonly;
            else (input as any).disabled = isReadonly;
        }));

        this.cleanupFns.push(effect(() => {
            const error = this.engine!.errorSignals[fullName]?.value;
            errorDisplay.textContent = error || '';
        }));

        this.applyStyle(fieldWrapper, comp.style);
        return fieldWrapper;
    }

    private renderItem(item: any, parent: HTMLElement, prefix = '') {
        const key = item.key;
        const fullName = prefix ? `${prefix}.${key}` : key;

        if (item.type === 'group' && item.repeatable) {
            this.renderComponent({
                component: 'Stack',
                bind: key,
                children: item.children?.map((c: any) => ({ component: this.getDefaultComponent(c), bind: c.key }))
            }, parent, prefix);
        } else if (item.type === 'group') {
            const groupWrapper = document.createElement('div');
            groupWrapper.className = 'group';
            const title = document.createElement('h3');
            title.textContent = item.label || key;
            groupWrapper.appendChild(title);
            if (item.children) {
                for (const child of item.children) {
                    this.renderItem(child, groupWrapper, fullName);
                }
            }
            parent.appendChild(groupWrapper);
        } else if (item.type === 'field') {
            const comp = {
                component: this.getDefaultComponent(item),
                bind: key
            };
            const fieldWrapper = this.renderInputComponent(comp, item, fullName);
            parent.appendChild(fieldWrapper);
        } else if (item.type === 'display') {
            const el = document.createElement('p');
            el.textContent = item.label || '';
            parent.appendChild(el);
            if (this.engine!.relevantSignals[fullName]) {
                this.cleanupFns.push(effect(() => {
                    const isRelevant = this.engine!.relevantSignals[fullName].value;
                    el.style.display = isRelevant ? 'block' : 'none';
                }));
            }
        }
    }

    private getDefaultComponent(item: any): string {
        const dataType = item.dataType;
        switch (dataType) {
            case 'string': return 'TextInput';
            case 'integer':
            case 'decimal': return 'NumberInput';
            case 'boolean': return 'Toggle';
            case 'date': return 'DatePicker';
            case 'choice': return 'Select';
            case 'multiChoice': return 'CheckboxGroup';
            default: return 'TextInput';
        }
    }
}
