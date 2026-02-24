import { effect } from '@preact/signals-core';
import { ComponentPlugin, RenderContext } from '../types';

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

export const DataTablePlugin: ComponentPlugin = {
    type: 'DataTable',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const table = document.createElement('table');
        if (comp.id) table.id = comp.id;
        table.className = 'formspec-data-table';
        ctx.applyCssClass(table, comp);
        ctx.applyAccessibility(table, comp);
        ctx.applyStyle(table, comp.style);
        parent.appendChild(table);

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

        const coerceInputValue = (raw: string, dataType: string | undefined): any => {
            const trimmed = raw.trim();
            if (trimmed === '') return null;
            if (dataType === 'integer') {
                const parsed = Number.parseInt(trimmed, 10);
                return Number.isFinite(parsed) ? parsed : null;
            }
            if (dataType === 'decimal' || dataType === 'number' || dataType === 'money') {
                const parsed = Number.parseFloat(trimmed);
                return Number.isFinite(parsed) ? parsed : null;
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
                        const input = document.createElement('input');
                        input.className = 'formspec-datatable-input';
                        input.name = sigPath;
                        input.type = (dataType === 'integer' || dataType === 'decimal' || dataType === 'number' || dataType === 'money')
                            ? 'number'
                            : 'text';
                        if (input.type === 'number') {
                            input.step = dataType === 'integer' ? '1' : 'any';
                        }
                        input.addEventListener('input', () => {
                            ctx.engine.setValue(sigPath, coerceInputValue(input.value, dataType));
                        });
                        td.appendChild(input);

                        const readonlySig = ctx.engine.readonlySignals[sigPath];
                        const syncInput = effect(() => {
                            const value = sig.value;
                            const readonly = readonlySig?.value ?? false;
                            const next = value === null || value === undefined ? '' : String(value);
                            if (document.activeElement !== input) {
                                input.value = next;
                            }
                            input.disabled = readonly;
                        });
                        cellEffectDisposers.push(syncInput);
                    } else if (sig) {
                        const valueEl = document.createElement('span');
                        td.appendChild(valueEl);
                        const syncText = effect(() => {
                            valueEl.textContent = String(sig.value ?? '');
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
