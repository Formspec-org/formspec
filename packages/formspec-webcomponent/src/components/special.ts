import { effect } from '@preact/signals-core';
import { ComponentPlugin, RenderContext } from '../types';
import { formatMoney } from '../format';

/** Renders a simple wrapper `<div>` for conditional content whose visibility is controlled by bind relevance. */
export const ConditionalGroupPlugin: ComponentPlugin = {
    type: 'ConditionalGroup',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const el = document.createElement('div');
        if (comp.id) el.id = comp.id;
        el.className = 'formspec-conditional-group';
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

/**
 * Renders an editable `<table>` bound to a repeatable group.
 * Supports add/remove row buttons, optional row numbers, and signal-driven cell updates.
 * Editable cells use `<input>` elements with type coercion; read-only cells display formatted text
 * including currency formatting for money values. Cell effect subscriptions are tracked and
 * disposed on re-render to prevent leaks.
 */
export const DataTablePlugin: ComponentPlugin = {
    type: 'DataTable',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'formspec-data-table-wrapper';
        parent.appendChild(wrapper);

        const table = document.createElement('table');
        if (comp.id) table.id = comp.id;
        table.className = 'formspec-data-table';
        ctx.applyCssClass(table, comp);
        ctx.applyAccessibility(table, comp);
        ctx.applyStyle(table, comp.style);
        wrapper.appendChild(table);

        const columns: { header: string; bind: string }[] = comp.columns || [];
        const bindKey = comp.bind;
        if (!bindKey || columns.length === 0) return;

        const showRowNumbers = comp.showRowNumbers === true;
        const allowAdd = comp.allowAdd === true;
        const allowRemove = comp.allowRemove === true;
        const editableCells = allowAdd || allowRemove;

        const groupItem = ctx.findItemByKey(bindKey);
        const fieldByKey = new Map<string, any>();
        if (groupItem?.type === 'group' && Array.isArray(groupItem.children)) {
            for (const child of groupItem.children) {
                if (child?.type === 'field' && child.key) {
                    fieldByKey.set(child.key, child);
                }
            }
        }

        const defaultCurrency = ctx.engine.definition?.formPresentation?.defaultCurrency || 'USD';

        /** Coerces a raw input string to the appropriate type based on the field's dataType. */
        const coerceInputValue = (raw: string, dataType: string | undefined, fieldDef?: any): any => {
            const trimmed = raw.trim();
            if (trimmed === '') return null;
            if (dataType === 'integer') {
                const parsed = Number.parseInt(trimmed, 10);
                return Number.isFinite(parsed) ? parsed : null;
            }
            if (dataType === 'decimal' || dataType === 'number') {
                const parsed = Number.parseFloat(trimmed);
                return Number.isFinite(parsed) ? parsed : null;
            }
            if (dataType === 'money') {
                const parsed = Number.parseFloat(trimmed);
                if (!Number.isFinite(parsed)) return null;
                const currency = fieldDef?.currency || defaultCurrency;
                return { amount: parsed, currency };
            }
            return raw;
        };

        // Header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        if (showRowNumbers) {
            const th = document.createElement('th');
            th.textContent = '#';
            headerRow.appendChild(th);
        }
        for (const col of columns) {
            const th = document.createElement('th');
            th.textContent = col.header;
            headerRow.appendChild(th);
        }
        if (allowRemove) {
            const th = document.createElement('th');
            th.textContent = '';
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);

        const fullName = ctx.prefix ? `${ctx.prefix}.${bindKey}` : bindKey;
        let cellEffectDisposers: Array<() => void> = [];

        const clearCellEffects = () => {
            for (const dispose of cellEffectDisposers) {
                dispose();
            }
            cellEffectDisposers = [];
        };

        ctx.cleanupFns.push(() => clearCellEffects());

        ctx.cleanupFns.push(effect(() => {
            const count = ctx.engine.repeats[fullName]?.value || 0;
            clearCellEffects();
            tbody.innerHTML = '';
            for (let i = 0; i < count; i++) {
                const tr = document.createElement('tr');
                if (showRowNumbers) {
                    const td = document.createElement('td');
                    td.textContent = String(i + 1);
                    td.className = 'formspec-row-number';
                    tr.appendChild(td);
                }
                for (const col of columns) {
                    const td = document.createElement('td');
                    const sigPath = `${fullName}[${i}].${col.bind}`;
                    const sig = ctx.engine.signals[sigPath];
                    const dataType = fieldByKey.get(col.bind)?.dataType as string | undefined;

                    if (sig && editableCells) {
                        const fieldDef = fieldByKey.get(col.bind);
                        const prefix = fieldDef?.prefix;
                        const suffix = fieldDef?.suffix;
                        const isChoice = fieldDef?.dataType === 'choice' && (fieldDef.optionSet || fieldDef.options);

                        let inputEl: HTMLInputElement | HTMLSelectElement;

                        if (isChoice) {
                            const select = document.createElement('select');
                            select.className = 'formspec-datatable-input';
                            select.name = sigPath;
                            // Empty option
                            const emptyOpt = document.createElement('option');
                            emptyOpt.value = '';
                            emptyOpt.textContent = '';
                            select.appendChild(emptyOpt);
                            // Resolve options from optionSet or inline options
                            let options: Array<{ value: string; label: string }> = [];
                            if (fieldDef.optionSet) {
                                const def = ctx.engine.definition;
                                const entry = def?.optionSets?.[fieldDef.optionSet];
                                options = Array.isArray(entry) ? entry : ((entry as any)?.options ?? []);
                            } else if (Array.isArray(fieldDef.options)) {
                                options = fieldDef.options;
                            }
                            for (const opt of options) {
                                const optEl = document.createElement('option');
                                optEl.value = opt.value;
                                optEl.textContent = opt.label || opt.value;
                                select.appendChild(optEl);
                            }
                            select.addEventListener('change', () => {
                                ctx.engine.setValue(sigPath, select.value || null);
                            });
                            inputEl = select;
                        } else {
                            const input = document.createElement('input');
                            input.className = 'formspec-datatable-input';
                            input.name = sigPath;
                            input.type = (dataType === 'integer' || dataType === 'decimal' || dataType === 'number' || dataType === 'money')
                                ? 'number'
                                : 'text';
                            if (input.type === 'number') {
                                input.step = dataType === 'integer' ? '1' : 'any';
                                input.min = '0';
                            }
                            input.addEventListener('input', () => {
                                ctx.engine.setValue(sigPath, coerceInputValue(input.value, dataType, fieldDef));
                            });
                            inputEl = input;
                        }

                        if (prefix || suffix) {
                            const wrapper = document.createElement('div');
                            wrapper.className = 'formspec-datatable-cell-wrapper';
                            if (prefix) {
                                const pre = document.createElement('span');
                                pre.className = 'formspec-datatable-prefix';
                                pre.textContent = prefix;
                                wrapper.appendChild(pre);
                            }
                            wrapper.appendChild(inputEl);
                            if (suffix) {
                                const suf = document.createElement('span');
                                suf.className = 'formspec-datatable-prefix';
                                suf.textContent = suffix;
                                wrapper.appendChild(suf);
                            }
                            td.appendChild(wrapper);
                        } else {
                            td.appendChild(inputEl);
                        }

                        const readonlySig = ctx.engine.readonlySignals[sigPath];
                        const syncInput = effect(() => {
                            const value = sig.value;
                            const readonly = readonlySig?.value ?? false;
                            if (document.activeElement !== inputEl) {
                                if (value !== null && value !== undefined && typeof value === 'object' && 'amount' in value) {
                                    (inputEl as HTMLInputElement).value = value.amount !== null ? String(value.amount) : '';
                                } else {
                                    inputEl.value = (value === null || value === undefined || (typeof value === 'number' && isNaN(value))) ? '' : String(value);
                                }
                            }
                            inputEl.disabled = readonly;
                        });
                        cellEffectDisposers.push(syncInput);
                    } else if (sig) {
                        const valueEl = document.createElement('span');
                        td.appendChild(valueEl);
                        const syncText = effect(() => {
                            const v = sig.value;
                            if (v !== null && v !== undefined && typeof v === 'object' && 'amount' in v) {
                                valueEl.textContent = formatMoney(v as any);
                            } else {
                                valueEl.textContent = v === null || v === undefined ? '' : String(v);
                            }
                        });
                        cellEffectDisposers.push(syncText);
                    } else {
                        td.textContent = '';
                    }
                    tr.appendChild(td);
                }
                if (allowRemove) {
                    const td = document.createElement('td');
                    const removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'formspec-datatable-remove';
                    removeBtn.textContent = 'Remove';
                    const idx = i;
                    removeBtn.addEventListener('click', () => {
                        ctx.engine.removeRepeatInstance(fullName, idx);
                    });
                    td.appendChild(removeBtn);
                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            }
        }));

        // Add row button
        if (allowAdd) {
            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'formspec-datatable-add';
            addBtn.textContent = `Add Row`;
            addBtn.addEventListener('click', () => {
                ctx.engine.addRepeatInstance(fullName);
            });
            parent.appendChild(addBtn);
        }
    }
};
