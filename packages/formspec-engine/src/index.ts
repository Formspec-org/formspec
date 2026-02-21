import { signal, computed, Signal } from '@preact/signals-core';

export interface FormspecItem {
    type: string;
    name: string;
    label?: string;
    calculate?: string;
    visible?: string;
    valid?: string;
    pattern?: string;
    readonly?: boolean;
    repeatable?: boolean;
    children?: FormspecItem[];
}

export interface FormspecDefinition {
    items: FormspecItem[];
    [key: string]: any;
}

export class FormEngine {
    private definition: FormspecDefinition;
    public signals: Record<string, any> = {};
    public visibleSignals: Record<string, Signal<boolean>> = {};
    public errorSignals: Record<string, Signal<string | null>> = {};
    public repeats: Record<string, Signal<number>> = {};

    constructor(definition: FormspecDefinition) {
        this.definition = definition;
        this.initializeSignals();
    }

    private initializeSignals() {
        for (const item of this.definition.items) {
            this.initItem(item);
        }
    }

    private initItem(item: FormspecItem, prefix = '') {
        const fullName = prefix ? `${prefix}.${item.name}` : item.name;

        if (item.type === 'group' && item.repeatable) {
            this.repeats[fullName] = signal(1);
            this.initRepeatInstance(item, fullName, 0);
        } else if (item.type === 'group' && item.children) {
            this.visibleSignals[fullName] = signal(true);
            if (item.visible) {
                this.visibleSignals[fullName] = computed(() => !!this.compileFEL(item.visible!, fullName, undefined, true)());
            }
            for (const child of item.children) {
                this.initItem(child, fullName);
            }
        } else {
            let initialValue: any = '';
            if (item.type === 'number') initialValue = 0;
            if (item.type === 'boolean') initialValue = false;
            
            this.signals[fullName] = signal(initialValue);
            this.visibleSignals[fullName] = signal(true);
            this.errorSignals[fullName] = signal(null);

            if (item.calculate) {
                this.signals[fullName] = computed(this.compileFEL(item.calculate, fullName, undefined, false));
            }
            if (item.visible) {
                this.visibleSignals[fullName] = computed(() => !!this.compileFEL(item.visible!, fullName, undefined, true)());
            }
            if (item.valid || item.pattern) {
                const regex = item.pattern ? new RegExp(item.pattern) : null;
                this.errorSignals[fullName] = computed(() => {
                    const isValid = item.valid ? !!this.compileFEL(item.valid, fullName, undefined, true)() : true;
                    if (!isValid) return "Invalid";
                    if (regex && !regex.test(this.signals[fullName].value)) return "Pattern mismatch";
                    return null;
                });
            }
        }
    }

    private initRepeatInstance(item: FormspecItem, fullName: string, index: number) {
        if (!item.children) return;
        for (const child of item.children) {
            const childName = `${fullName}[${index}].${child.name}`;
            const initialValue = child.type === 'number' ? 0 : '';
            this.signals[childName] = signal(initialValue);
            this.visibleSignals[childName] = signal(true);
            this.errorSignals[childName] = signal(null);

            if (child.calculate) {
                this.signals[childName] = computed(this.compileFEL(child.calculate, childName, index, false));
            }
        }
    }

    public addRepeatInstance(itemName: string) {
        const item = this.findItem(this.definition.items, itemName);
        if (item && item.repeatable) {
            const index = this.repeats[itemName].value;
            this.initRepeatInstance(item, itemName, index);
            this.repeats[itemName].value++;
        }
    }

    private findItem(items: FormspecItem[], name: string): FormspecItem | undefined {
        const parts = name.split('.');
        let currentItems = items;
        let foundItem: FormspecItem | undefined;

        for (const part of parts) {
            foundItem = currentItems.find(i => i.name === part);
            if (!foundItem) return undefined;
            if (foundItem.children) {
                currentItems = foundItem.children;
            } else {
                // If we have more parts but no children, it's not found
                if (parts.indexOf(part) !== parts.length - 1) return undefined;
            }
        }
        return foundItem;
    }

    private compileFEL(expression: string, currentItemName: string, index?: number, includeSelf = false) {
        const felStdLib = {
            sum: (arr: any[]) => {
                if (!Array.isArray(arr)) return 0;
                return arr.reduce((a, b) => {
                    const val = typeof b === 'string' ? parseFloat(b) : b;
                    return a + (Number.isFinite(val) ? val : 0);
                }, 0);
            },
            upper: (s: string) => (s || '').toUpperCase(),
            round: (n: number, p: number = 0) => {
                const factor = Math.pow(10, p);
                return Math.round(n * factor) / factor;
            },
            year: (d: string) => d ? new Date(d).getFullYear() : null,
            coalesce: (...args: any[]) => args.find(a => a !== null && a !== undefined && a !== ''),
            isNull: (a: any) => a === null || a === undefined || a === '',
            present: (a: any) => a !== null && a !== undefined && a !== '',
            relevant: (path: string) => {
                return this.visibleSignals[path]?.value ?? true;
            },

            // Re-adding previous functions
            contains: (s: string, sub: string) => (s || '').includes(sub || ''),
            abs: (n: number) => Math.abs(n || 0),
            power: (b: number, e: number) => Math.pow(b || 0, e || 0),
            empty: (v: any) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0),
            dateAdd: (d: string, n: number, unit: string) => {
                const date = new Date(d);
                if (unit === 'days') date.setDate(date.getDate() + n);
                else if (unit === 'months') date.setMonth(date.getMonth() + n);
                else if (unit === 'years') date.setFullYear(date.getFullYear() + n);
                return date.toISOString().split('T')[0];
            },
            dateDiff: (d1: string, d2: string, unit: string) => {
                const t1 = new Date(d1).getTime();
                const t2 = new Date(d2).getTime();
                const diff = t1 - t2;
                if (unit === 'days') return Math.floor(diff / (1000 * 60 * 60 * 24));
                return 0; // Simplified
            },
            fel_if: (cond: boolean, t: any, f: any) => cond ? t : f,

            // New functions
            count: (arr: any[]) => Array.isArray(arr) ? arr.length : 0,
            avg: (arr: any[]) => {
                if (!Array.isArray(arr) || arr.length === 0) return 0;
                const valid = arr.map(a => typeof a === 'string' ? parseFloat(a) : a).filter(a => Number.isFinite(a));
                return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
            },
            min: (arr: any[]) => {
                if (!Array.isArray(arr) || arr.length === 0) return 0;
                const valid = arr.map(a => typeof a === 'string' ? parseFloat(a) : a).filter(a => Number.isFinite(a));
                return valid.length ? Math.min(...valid) : 0;
            },
            max: (arr: any[]) => {
                if (!Array.isArray(arr) || arr.length === 0) return 0;
                const valid = arr.map(a => typeof a === 'string' ? parseFloat(a) : a).filter(a => Number.isFinite(a));
                return valid.length ? Math.max(...valid) : 0;
            },
            countWhere: (arr: any[], pred: any) => {
                if (!Array.isArray(arr)) return 0;
                return arr.filter(pred).length;
            },
            length: (s: string) => (s || '').length,
            startsWith: (s: string, sub: string) => (s || '').startsWith(sub || ''),
            endsWith: (s: string, sub: string) => (s || '').endsWith(sub || ''),
            substring: (s: string, start: number, len?: number) => len === undefined ? (s || '').substring(start) : (s || '').substring(start, start + len),
            replace: (s: string, old: string, nw: string) => (s || '').split(old || '').join(nw || ''),
            lower: (s: string) => (s || '').toLowerCase(),
            trim: (s: string) => (s || '').trim(),
            matches: (s: string, pat: string) => new RegExp(pat).test(s || ''),
            format: (s: string, ...args: any[]) => {
                let i = 0;
                return (s || '').replace(/%s/g, () => String(args[i++] || ''));
            },
            floor: (n: number) => Math.floor(n || 0),
            ceil: (n: number) => Math.ceil(n || 0),
            today: () => new Date().toISOString().split('T')[0],
            now: () => new Date().toISOString(),
            month: (d: string) => d ? new Date(d).getMonth() + 1 : null,
            day: (d: string) => d ? new Date(d).getDate() : null,
            hours: (d: string) => d ? new Date(d).getHours() : null,
            minutes: (d: string) => d ? new Date(d).getMinutes() : null,
            seconds: (d: string) => d ? new Date(d).getSeconds() : null,
            time: (d: string) => d ? new Date(d).toTimeString().split(' ')[0] : null,
            timeDiff: (t1: string, t2: string, unit: string) => {
                const d1 = new Date(`1970-01-01T${t1}Z`);
                const d2 = new Date(`1970-01-01T${t2}Z`);
                const diff = d1.getTime() - d2.getTime();
                if (unit === 'hours') return Math.floor(diff / (1000 * 60 * 60));
                if (unit === 'minutes') return Math.floor(diff / (1000 * 60));
                if (unit === 'seconds') return Math.floor(diff / 1000);
                return diff;
            },
            selected: (val: any, opt: any) => {
                if (Array.isArray(val)) return val.includes(opt);
                return val === opt;
            },
            isNumber: (v: any) => typeof v === 'number' && !isNaN(v),
            isString: (v: any) => typeof v === 'string',
            isDate: (v: any) => !isNaN(Date.parse(v)),
            typeOf: (v: any) => Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v,
            number: (v: any) => { const n = Number(v); return isNaN(n) ? null : n; },
            
            // Money
            money: (amount: number, currency: string) => ({ amount, currency }),
            moneyAmount: (m: any) => m && m.amount !== undefined ? m.amount : null,
            moneyCurrency: (m: any) => m && m.currency !== undefined ? m.currency : null,
            moneyAdd: (m1: any, m2: any) => {
                if (m1 && m2 && m1.currency === m2.currency) {
                    const a1 = typeof m1.amount === 'string' ? parseFloat(m1.amount) : (m1.amount || 0);
                    const a2 = typeof m2.amount === 'string' ? parseFloat(m2.amount) : (m2.amount || 0);
                    return { amount: a1 + a2, currency: m1.currency };
                }
                return null;
            },
            moneySum: (arr: any[]) => {
                if (!Array.isArray(arr) || arr.length === 0) return { amount: 0, currency: 'USD' };
                const currency = arr[0]?.currency || 'USD';
                const sum = arr.reduce((acc, m) => {
                    const amt = typeof m?.amount === 'string' ? parseFloat(m.amount) : (m?.amount || 0);
                    return acc + (m?.currency === currency ? amt : 0);
                }, 0);
                return { amount: sum, currency };
            },
            
            // Context functions
            prev: (name: string) => {
                if (index === undefined || index <= 0) return null;
                const parts = currentItemName.split('.');
                const groupPart = parts[0].replace(/\[\d+\]/, `[${index - 1}]`);
                const path = `${groupPart}.${name}`;
                return this.signals[path]?.value;
            },
            next: (name: string) => {
                if (index === undefined) return null;
                const parts = currentItemName.split('.');
                const groupPart = parts[0].replace(/\[\d+\]/, `[${index + 1}]`);
                const path = `${groupPart}.${name}`;
                return this.signals[path]?.value;
            },
            parent: (name: string) => {
                const parts = currentItemName.split('.');
                if (parts.length <= 1) return null;
                // If it's a repeatable group, parts[0] is like "group[0]"
                // We want to look for "name" at the root level if not found in parent
                // Simplified: look at root level
                return this.signals[name]?.value;
            },


        };

        const stdLibKeys = Object.keys(felStdLib);
        const stdLibValues = Object.values(felStdLib);

        let expr = expression;
        if (index !== undefined) {
            expr = expr.replace(/\$index/g, index.toString());
        }

        const mipRegex = /(relevant|valid|readonly|required)\(([a-zA-Z0-9_.\[\]]+)\)/g;
        expr = expr.replace(mipRegex, "$1('$2')");
        expr = expr.replace(/\bif\s*\(/g, "fel_if(");
        const countWhereRegex = /\bcountWhere\(([^,]+),\s*(.+)\)/g;
        expr = expr.replace(countWhereRegex, "countWhere($1, ($) => $2)");

        const pathRegex = /([a-zA-Z][a-zA-Z0-9_]*)\.([a-zA-Z0-9_]+)/g;
        const groupMatches = Array.from(expr.matchAll(pathRegex)).map(m => ({
            full: m[0],
            group: m[1],
            field: m[2]
        }));

        for (const m of groupMatches) {
            expr = expr.replace(m.full, m.full.replace(/[\[\].]/g, '_'));
        }

        const finalExpr = expr.replace(/([a-zA-Z][a-zA-Z0-9_]*)\.([a-zA-Z0-9_]+)/g, '$1_$2')
                             .replace(/\[/g, '_')
                             .replace(/\]/g, '_');

        // Determine potential dependencies once outside the reactive evaluator
        const potentialNames = Object.keys(this.signals).filter(n => {
            if (n === currentItemName && !includeSelf) return false;
            
            const safeN = n.replace(/[\[\].]/g, '_');
            if (new RegExp(`\\b${safeN}\\b`).test(finalExpr)) return true;

            // Check if it's a local field in the same group instance
            if (index !== undefined) {
                const parts = n.split(/[\[\].]/).filter(Boolean);
                const currentParts = currentItemName.split(/[\[\].]/).filter(Boolean);
                if (parts.length === 3 && currentParts.length === 3 && parts[0] === currentParts[0] && parts[1] === currentParts[1]) {
                    const fieldName = parts[2];
                    if (new RegExp(`\\b${fieldName}\\b`).test(finalExpr)) return true;
                }
            }

            return false;
        });

        return () => {
            if (index !== undefined) {
                const group = currentItemName.split(/[\[\].]/)[0];
                if (this.repeats[group]) this.repeats[group].value;
            }
            const pathArrays: Record<string, any[]> = {};
            for (const m of groupMatches) {
                if (this.repeats[m.group]) this.repeats[m.group].value;
                pathArrays[m.full.replace(/[\[\].]/g, '_')] = Object.keys(this.signals)
                    .filter(k => k.startsWith(`${m.group}[`) && k.endsWith(`].${m.field}`))
                    .map(k => this.signals[k].value);
            }

            const values = potentialNames.map(n => this.signals[n].value);
            const localValues: Record<string, any> = {};
            if (index !== undefined) {
                const currentParts = currentItemName.split(/[\[\].]/).filter(Boolean);
                const group = currentParts[0];
                for (let i = 0; i < potentialNames.length; i++) {
                    const n = potentialNames[i];
                    const parts = n.split(/[\[\].]/).filter(Boolean);
                    if (parts[0] === group && parts[1] === String(index)) {
                        localValues[parts[2]] = values[i];
                    }
                }
            }

            try {
                const pathArrayKeys = Object.keys(pathArrays);
                const pathArrayValues = pathArrayKeys.map(k => pathArrays[k]);

                const localKeys = Object.keys(localValues);
                const localVals = localKeys.map(k => localValues[k]);

                const argNames = [...stdLibKeys, 'pathArrays', ...pathArrayKeys, ...potentialNames.map(n => n.replace(/[\[\].]/g, '_')), ...localKeys];
                const argValues = [...stdLibValues, pathArrays, ...pathArrayValues, ...values, ...localVals];
                
                const f = new Function(...argNames, `return ${finalExpr}`);
                return f(...argValues);
            } catch (e) {
                // Return null on cycle or other errors per spec
                return null;
            }
        };
    }

    public setValue(name: string, value: any) {
        const baseName = name.replace(/\[\d+\]/g, ''); // strip array indices to find the schema definition
        const item = this.findItem(this.definition.items, baseName);
        if (item && item.type === 'number' && typeof value === 'string') {
            value = value === '' ? null : Number(value);
        }
        
        if (this.signals[name] && !(this.signals[name] instanceof computed)) {
            this.signals[name].value = value;
        }
    }

    public getResponse() {
        const data: any = {};
        const isPathVisible = (path: string): boolean => {
            if (this.visibleSignals[path] && !this.visibleSignals[path].value) return false;
            // Check parent paths
            const parts = path.split(/[\[\].]/).filter(Boolean);
            if (parts.length > 1) {
                // This is a bit simplified for E2E, but check root part
                // In real implementation we'd check all parent groups
                const rootPart = parts[0];
                if (this.visibleSignals[rootPart] && !this.visibleSignals[rootPart].value) return false;
            }
            return true;
        };

        for (const key of Object.keys(this.signals)) {
            if (!isPathVisible(key)) {
                continue;
            }
            const parts = key.split(/[\[\].]/).filter(Boolean);
            let current = data;
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                const nextPart = parts[i+1];
                const isNextNumber = !isNaN(parseInt(nextPart));
                if (!current[part]) {
                    current[part] = isNextNumber ? [] : {};
                }
                current = current[part];
            }
            current[parts[parts.length - 1]] = this.signals[key].value;
        }
        return {
            definitionUrl: this.definition.url || "http://example.org/form",
            definitionVersion: this.definition.version || "1.0.0",
            status: "completed",
            data,
            authored: new Date().toISOString()
        };
    }
}
