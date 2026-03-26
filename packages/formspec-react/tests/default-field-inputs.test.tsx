/** @filedesc Tests for DefaultField input sub-features and new input types. */
import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { initFormspecEngine, createFormEngine } from 'formspec-engine';
import type { LayoutNode } from 'formspec-layout';
import { FormspecNode } from '../src/node-renderer';
import { FormspecProvider } from '../src/context';

beforeAll(async () => {
    await initFormspecEngine();
});

const baseDef = (items: any[]) => ({
    $formspec: '1.0',
    url: 'https://test.example/inputs',
    version: '1.0.0',
    status: 'active',
    title: 'Input Test',
    name: 'input-test',
    items,
});

function renderField(definition: any, node: LayoutNode): HTMLElement {
    const engine = createFormEngine(definition);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    flushSync(() => {
        root.render(
            <FormspecProvider engine={engine}>
                <FormspecNode node={{ id: 'root', component: 'Stack', category: 'layout', props: {}, cssClasses: [], children: [node] }} />
            </FormspecProvider>
        );
    });
    return container;
}

// ── TextInput enhancements ────────────────────────────────────────

describe('TextInput — maxLines', () => {
    it('renders <textarea> with rows when maxLines is set', () => {
        const def = baseDef([{ key: 'bio', type: 'field', dataType: 'text', label: 'Bio' }]);
        const node: LayoutNode = {
            id: 'bio-field', component: 'TextInput', category: 'field',
            props: { maxLines: 4 }, cssClasses: [], children: [], bindPath: 'bio',
        };
        const container = renderField(def, node);
        const textarea = container.querySelector('textarea');
        expect(textarea).toBeTruthy();
        expect(Number(textarea!.getAttribute('rows'))).toBe(4);
    });

    it('renders prefix when node.props.prefix is set', () => {
        const def = baseDef([{ key: 'user', type: 'field', dataType: 'string', label: 'User' }]);
        const node: LayoutNode = {
            id: 'user-field', component: 'TextInput', category: 'field',
            props: { prefix: '@' }, cssClasses: [], children: [], bindPath: 'user',
        };
        const container = renderField(def, node);
        expect(container.textContent).toContain('@');
    });

    it('renders suffix when node.props.suffix is set', () => {
        const def = baseDef([{ key: 'domain', type: 'field', dataType: 'string', label: 'Domain' }]);
        const node: LayoutNode = {
            id: 'domain-field', component: 'TextInput', category: 'field',
            props: { suffix: '.com' }, cssClasses: [], children: [], bindPath: 'domain',
        };
        const container = renderField(def, node);
        expect(container.textContent).toContain('.com');
    });
});

// ── NumberInput enhancements ──────────────────────────────────────

describe('NumberInput — min/max/step', () => {
    it('applies min, max, step attributes to the number input', () => {
        const def = baseDef([{ key: 'qty', type: 'field', dataType: 'integer', label: 'Qty' }]);
        const node: LayoutNode = {
            id: 'qty-field', component: 'NumberInput', category: 'field',
            props: { min: 1, max: 100, step: 5 }, cssClasses: [], children: [], bindPath: 'qty',
        };
        const container = renderField(def, node);
        const input = container.querySelector('input[type="number"]') as HTMLInputElement;
        expect(input).toBeTruthy();
        expect(input.min).toBe('1');
        expect(input.max).toBe('100');
        expect(input.step).toBe('5');
    });
});

// ── DatePicker variants ───────────────────────────────────────────

describe('DatePicker — variants', () => {
    it('renders datetime-local when variant is dateTime', () => {
        const def = baseDef([{ key: 'dt', type: 'field', dataType: 'datetime', label: 'Date Time' }]);
        const node: LayoutNode = {
            id: 'dt-field', component: 'DatePicker', category: 'field',
            props: { variant: 'dateTime' }, cssClasses: [], children: [], bindPath: 'dt',
        };
        const container = renderField(def, node);
        expect(container.querySelector('input[type="datetime-local"]')).toBeTruthy();
    });

    it('renders time when variant is time', () => {
        const def = baseDef([{ key: 'tm', type: 'field', dataType: 'time', label: 'Time' }]);
        const node: LayoutNode = {
            id: 'tm-field', component: 'DatePicker', category: 'field',
            props: { variant: 'time' }, cssClasses: [], children: [], bindPath: 'tm',
        };
        const container = renderField(def, node);
        expect(container.querySelector('input[type="time"]')).toBeTruthy();
    });

    it('renders date by default', () => {
        const def = baseDef([{ key: 'day', type: 'field', dataType: 'date', label: 'Day' }]);
        const node: LayoutNode = {
            id: 'day-field', component: 'DatePicker', category: 'field',
            props: {}, cssClasses: [], children: [], bindPath: 'day',
        };
        const container = renderField(def, node);
        expect(container.querySelector('input[type="date"]')).toBeTruthy();
    });
});

// ── FileUpload enhancements ───────────────────────────────────────

describe('FileUpload — accept and multiple', () => {
    it('applies accept attribute from node.props', () => {
        const def = baseDef([{ key: 'doc', type: 'field', dataType: 'string', label: 'Doc' }]);
        const node: LayoutNode = {
            id: 'doc-field', component: 'FileUpload', category: 'field',
            props: { accept: '.pdf,.docx' }, cssClasses: [], children: [], bindPath: 'doc',
        };
        const container = renderField(def, node);
        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        expect(input).toBeTruthy();
        expect(input.accept).toBe('.pdf,.docx');
    });

    it('applies multiple attribute from node.props', () => {
        const def = baseDef([{ key: 'files', type: 'field', dataType: 'string', label: 'Files' }]);
        const node: LayoutNode = {
            id: 'files-field', component: 'FileUpload', category: 'field',
            props: { multiple: true }, cssClasses: [], children: [], bindPath: 'files',
        };
        const container = renderField(def, node);
        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        expect(input).toBeTruthy();
        expect(input.multiple).toBe(true);
    });
});

// ── MoneyInput (new) ──────────────────────────────────────────────

describe('MoneyInput', () => {
    it('renders a text input with inputMode=decimal', () => {
        const def = baseDef([{ key: 'price', type: 'field', dataType: 'money', label: 'Price' }]);
        const node: LayoutNode = {
            id: 'price-field', component: 'MoneyInput', category: 'field',
            props: { currency: 'USD' }, cssClasses: [], children: [], bindPath: 'price',
        };
        const container = renderField(def, node);
        const input = container.querySelector('input[inputmode="decimal"]') as HTMLInputElement;
        expect(input).toBeTruthy();
    });

    it('displays the currency symbol', () => {
        const def = baseDef([{ key: 'price', type: 'field', dataType: 'money', label: 'Price' }]);
        const node: LayoutNode = {
            id: 'price-field', component: 'MoneyInput', category: 'field',
            props: { currency: 'USD' }, cssClasses: [], children: [], bindPath: 'price',
        };
        const container = renderField(def, node);
        expect(container.querySelector('.formspec-money-currency')).toBeTruthy();
    });
});

// ── Slider (new) ──────────────────────────────────────────────────

describe('Slider', () => {
    it('renders an input[type=range]', () => {
        const def = baseDef([{ key: 'vol', type: 'field', dataType: 'number', label: 'Volume' }]);
        const node: LayoutNode = {
            id: 'vol-field', component: 'Slider', category: 'field',
            props: { min: 0, max: 100, step: 1 }, cssClasses: [], children: [], bindPath: 'vol',
        };
        const container = renderField(def, node);
        const input = container.querySelector('input[type="range"]') as HTMLInputElement;
        expect(input).toBeTruthy();
        expect(input.min).toBe('0');
        expect(input.max).toBe('100');
        expect(input.step).toBe('1');
    });

    it('shows current value display', () => {
        const def = baseDef([{ key: 'vol', type: 'field', dataType: 'number', label: 'Volume' }]);
        const node: LayoutNode = {
            id: 'vol-field', component: 'Slider', category: 'field',
            props: { min: 0, max: 100 }, cssClasses: [], children: [], bindPath: 'vol',
        };
        const container = renderField(def, node);
        expect(container.querySelector('.formspec-slider-value')).toBeTruthy();
    });
});

// ── Rating (new) ──────────────────────────────────────────────────

describe('Rating', () => {
    it('renders maxRating number of stars', () => {
        const def = baseDef([{ key: 'stars', type: 'field', dataType: 'integer', label: 'Stars' }]);
        const node: LayoutNode = {
            id: 'stars-field', component: 'Rating', category: 'field',
            props: { maxRating: 5 }, cssClasses: [], children: [], bindPath: 'stars',
        };
        const container = renderField(def, node);
        const stars = container.querySelectorAll('.formspec-rating-star');
        expect(stars.length).toBe(5);
    });

    it('defaults to 5 stars when maxRating is not set', () => {
        const def = baseDef([{ key: 'stars', type: 'field', dataType: 'integer', label: 'Stars' }]);
        const node: LayoutNode = {
            id: 'stars-field', component: 'Rating', category: 'field',
            props: {}, cssClasses: [], children: [], bindPath: 'stars',
        };
        const container = renderField(def, node);
        const stars = container.querySelectorAll('.formspec-rating-star');
        expect(stars.length).toBe(5);
    });

    it('marks stars as selected based on field value', () => {
        const def = baseDef([{ key: 'stars', type: 'field', dataType: 'integer', label: 'Stars' }]);
        const engine = createFormEngine(def);
        engine.setValue('stars', 3);

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        const node: LayoutNode = {
            id: 'stars-field', component: 'Rating', category: 'field',
            props: { maxRating: 5 }, cssClasses: [], children: [], bindPath: 'stars',
        };
        flushSync(() => {
            root.render(
                <FormspecProvider engine={engine}>
                    <FormspecNode node={{ id: 'root', component: 'Stack', category: 'layout', props: {}, cssClasses: [], children: [node] }} />
                </FormspecProvider>
            );
        });
        const selected = container.querySelectorAll('.formspec-rating-star--selected');
        expect(selected.length).toBe(3);
    });

    it('calls setValue when a star is clicked', () => {
        const def = baseDef([{ key: 'stars', type: 'field', dataType: 'integer', label: 'Stars' }]);
        const engine = createFormEngine(def);

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        const node: LayoutNode = {
            id: 'stars-field', component: 'Rating', category: 'field',
            props: { maxRating: 5 }, cssClasses: [], children: [], bindPath: 'stars',
        };
        flushSync(() => {
            root.render(
                <FormspecProvider engine={engine}>
                    <FormspecNode node={{ id: 'root', component: 'Stack', category: 'layout', props: {}, cssClasses: [], children: [node] }} />
                </FormspecProvider>
            );
        });

        const stars = container.querySelectorAll('.formspec-rating-star');
        // Click the 4th star
        flushSync(() => { (stars[3] as HTMLElement).click(); });

        const selected = container.querySelectorAll('.formspec-rating-star--selected');
        expect(selected.length).toBe(4);
    });
});

// ── Signature (new) ───────────────────────────────────────────────

describe('Signature', () => {
    it('renders a <canvas> element', () => {
        const def = baseDef([{ key: 'sig', type: 'field', dataType: 'string', label: 'Signature' }]);
        const node: LayoutNode = {
            id: 'sig-field', component: 'Signature', category: 'field',
            props: {}, cssClasses: [], children: [], bindPath: 'sig',
        };
        const container = renderField(def, node);
        expect(container.querySelector('canvas')).toBeTruthy();
    });

    it('renders a Clear button', () => {
        const def = baseDef([{ key: 'sig', type: 'field', dataType: 'string', label: 'Signature' }]);
        const node: LayoutNode = {
            id: 'sig-field', component: 'Signature', category: 'field',
            props: {}, cssClasses: [], children: [], bindPath: 'sig',
        };
        const container = renderField(def, node);
        const btn = container.querySelector('.formspec-signature-clear');
        expect(btn).toBeTruthy();
        expect(btn!.textContent).toContain('Clear');
    });

    it('applies node.props.height to the canvas', () => {
        const def = baseDef([{ key: 'sig', type: 'field', dataType: 'string', label: 'Signature' }]);
        const node: LayoutNode = {
            id: 'sig-field', component: 'Signature', category: 'field',
            props: { height: 300 }, cssClasses: [], children: [], bindPath: 'sig',
        };
        const container = renderField(def, node);
        const canvas = container.querySelector('canvas') as HTMLCanvasElement;
        expect(canvas).toBeTruthy();
        expect(canvas.height).toBe(300);
    });

    // Item 1 — WCAG 2.1.1 / 4.1.2: canvas accessibility
    it('canvas has role="img" and aria-label with field label', () => {
        const def = baseDef([{ key: 'sig', type: 'field', dataType: 'string', label: 'Your Signature' }]);
        const node: LayoutNode = {
            id: 'sig-field', component: 'Signature', category: 'field',
            props: {}, cssClasses: [], children: [], bindPath: 'sig',
        };
        const container = renderField(def, node);
        const canvas = container.querySelector('canvas') as HTMLCanvasElement;
        expect(canvas.getAttribute('role')).toBe('img');
        expect(canvas.getAttribute('aria-label')).toBe('Signature pad for Your Signature');
        expect(canvas.getAttribute('tabindex')).toBe('0');
    });

    it('Clear button has aria-label with field label', () => {
        const def = baseDef([{ key: 'sig', type: 'field', dataType: 'string', label: 'Your Signature' }]);
        const node: LayoutNode = {
            id: 'sig-field', component: 'Signature', category: 'field',
            props: {}, cssClasses: [], children: [], bindPath: 'sig',
        };
        const container = renderField(def, node);
        const btn = container.querySelector('.formspec-signature-clear') as HTMLButtonElement;
        expect(btn.getAttribute('aria-label')).toBe('Clear Your Signature');
    });
});

// ── RadioGroup / CheckboxGroup readonly ───────────────────────────

describe('RadioGroup — readonly disables inputs', () => {
    it('disables radio inputs when field is readonly', () => {
        const def = baseDef([{
            key: 'color', type: 'field', dataType: 'choice', label: 'Color',
            options: [{ value: 'red', label: 'Red' }, { value: 'blue', label: 'Blue' }],
        }]);
        def.binds = [{ path: 'color', readonly: 'true' }];
        const node: LayoutNode = {
            id: 'color-field', component: 'RadioGroup', category: 'field',
            props: {}, cssClasses: [], children: [], bindPath: 'color',
        };
        const container = renderField(def, node);
        const radios = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
        expect(radios.length).toBeGreaterThan(0);
        radios.forEach(r => expect(r.disabled).toBe(true));
    });
});

describe('CheckboxGroup — readonly disables inputs', () => {
    it('disables checkbox inputs when field is readonly', () => {
        const def = baseDef([{
            key: 'tags', type: 'field', dataType: 'multi-choice', label: 'Tags',
            options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
        }]);
        def.binds = [{ path: 'tags', readonly: 'true' }];
        const node: LayoutNode = {
            id: 'tags-field', component: 'CheckboxGroup', category: 'field',
            props: {}, cssClasses: [], children: [], bindPath: 'tags',
        };
        const container = renderField(def, node);
        const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
        expect(checkboxes.length).toBeGreaterThan(0);
        checkboxes.forEach(c => expect(c.disabled).toBe(true));
    });
});

// ── Select placeholder hidden ──────────────────────────────────────

describe('Select — placeholder option', () => {
    it('placeholder option has hidden attribute', () => {
        const def = baseDef([{
            key: 'color', type: 'field', dataType: 'choice', label: 'Color',
            options: [{ value: 'red', label: 'Red' }],
        }]);
        const node: LayoutNode = {
            id: 'color-field', component: 'Select', category: 'field',
            props: {}, cssClasses: [], children: [], bindPath: 'color',
        };
        const container = renderField(def, node);
        const placeholder = container.querySelector('option[value=""]') as HTMLOptionElement;
        expect(placeholder).toBeTruthy();
        expect(placeholder.hidden).toBe(true);
    });
});

// ── MoneyInput currency association ───────────────────────────────

describe('MoneyInput — currency aria-describedby', () => {
    it('currency span has id and input aria-describedby includes it', () => {
        const def = baseDef([{ key: 'price', type: 'field', dataType: 'money', label: 'Price' }]);
        const node: LayoutNode = {
            id: 'price-field', component: 'MoneyInput', category: 'field',
            props: { currency: 'EUR' }, cssClasses: [], children: [], bindPath: 'price',
        };
        const container = renderField(def, node);
        const span = container.querySelector('.formspec-money-currency') as HTMLElement;
        // field.id is engine-assigned (e.g. 'field-price') — verify the id ends with -currency
        expect(span.id).toBeTruthy();
        expect(span.id).toMatch(/-currency$/);
        const input = container.querySelector('input') as HTMLInputElement;
        const describedBy = input.getAttribute('aria-describedby') ?? '';
        expect(describedBy).toContain(span.id);
    });
});

// ── Slider aria-valuetext ──────────────────────────────────────────

describe('Slider — aria-valuetext', () => {
    it('range input has aria-valuetext reflecting displayValue', () => {
        const def = baseDef([{ key: 'vol', type: 'field', dataType: 'number', label: 'Volume' }]);
        const engine = createFormEngine(def);
        engine.setValue('vol', 42);

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        const node: LayoutNode = {
            id: 'vol-field', component: 'Slider', category: 'field',
            props: { min: 0, max: 100 }, cssClasses: [], children: [], bindPath: 'vol',
        };
        flushSync(() => {
            root.render(
                <FormspecProvider engine={engine}>
                    <FormspecNode node={{ id: 'root', component: 'Stack', category: 'layout', props: {}, cssClasses: [], children: [node] }} />
                </FormspecProvider>
            );
        });
        const input = container.querySelector('input[type="range"]') as HTMLInputElement;
        expect(input.getAttribute('aria-valuetext')).toBe('42');
    });
});

// ── TextInput prefix/suffix aria-describedby ───────────────────────

describe('TextInput — prefix/suffix aria-describedby', () => {
    it('prefix span has id and input aria-describedby includes it', () => {
        const def = baseDef([{ key: 'user', type: 'field', dataType: 'string', label: 'User' }]);
        const node: LayoutNode = {
            id: 'user-field', component: 'TextInput', category: 'field',
            props: { prefix: '@' }, cssClasses: [], children: [], bindPath: 'user',
        };
        const container = renderField(def, node);
        const span = container.querySelector('.formspec-input-prefix') as HTMLElement;
        // field.id is the engine-assigned id (e.g. 'field-user') — test against the actual rendered id
        expect(span.id).toBeTruthy();
        expect(span.id).toMatch(/-prefix$/);
        const input = container.querySelector('input') as HTMLInputElement;
        const describedBy = input.getAttribute('aria-describedby') ?? '';
        expect(describedBy).toContain(span.id);
    });

    it('suffix span has id and input aria-describedby includes it', () => {
        const def = baseDef([{ key: 'domain', type: 'field', dataType: 'string', label: 'Domain' }]);
        const node: LayoutNode = {
            id: 'domain-field', component: 'TextInput', category: 'field',
            props: { suffix: '.com' }, cssClasses: [], children: [], bindPath: 'domain',
        };
        const container = renderField(def, node);
        const span = container.querySelector('.formspec-input-suffix') as HTMLElement;
        expect(span.id).toBeTruthy();
        expect(span.id).toMatch(/-suffix$/);
        const input = container.querySelector('input') as HTMLInputElement;
        const describedBy = input.getAttribute('aria-describedby') ?? '';
        expect(describedBy).toContain(span.id);
    });
});

// ── Toggle role="switch" ───────────────────────────────────────────

describe('Toggle — role switch', () => {
    it('Toggle checkbox has role="switch"', () => {
        const def = baseDef([{ key: 'enabled', type: 'field', dataType: 'boolean', label: 'Enabled' }]);
        const node: LayoutNode = {
            id: 'enabled-field', component: 'Toggle', category: 'field',
            props: {}, cssClasses: [], children: [], bindPath: 'enabled',
        };
        const container = renderField(def, node);
        const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
        expect(input.getAttribute('role')).toBe('switch');
    });

    it('Checkbox does NOT have role="switch"', () => {
        const def = baseDef([{ key: 'agree', type: 'field', dataType: 'boolean', label: 'Agree' }]);
        const node: LayoutNode = {
            id: 'agree-field', component: 'Checkbox', category: 'field',
            props: {}, cssClasses: [], children: [], bindPath: 'agree',
        };
        const container = renderField(def, node);
        const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
        expect(input.getAttribute('role')).toBeNull();
    });
});

// ── Select searchable ──────────────────────────────────────────────

describe('Select — searchable', () => {
    it('renders a listbox with filter input when searchable=true', () => {
        const def = baseDef([{
            key: 'country', type: 'field', dataType: 'choice', label: 'Country',
            options: [
                { value: 'us', label: 'United States' },
                { value: 'ca', label: 'Canada' },
                { value: 'mx', label: 'Mexico' },
            ],
        }]);
        const node: LayoutNode = {
            id: 'country-field', component: 'Select', category: 'field',
            props: { searchable: true }, cssClasses: [], children: [], bindPath: 'country',
        };
        const container = renderField(def, node);
        expect(container.querySelector('.formspec-select-searchable')).toBeTruthy();
        expect(container.querySelector('[role="listbox"]')).toBeTruthy();
        // filter input present
        const filterInput = container.querySelector('.formspec-select-searchable input[type="text"]') as HTMLInputElement;
        expect(filterInput).toBeTruthy();
    });

    it('native select is used when searchable is not set', () => {
        const def = baseDef([{
            key: 'color', type: 'field', dataType: 'choice', label: 'Color',
            options: [{ value: 'red', label: 'Red' }],
        }]);
        const node: LayoutNode = {
            id: 'color-field', component: 'Select', category: 'field',
            props: {}, cssClasses: [], children: [], bindPath: 'color',
        };
        const container = renderField(def, node);
        expect(container.querySelector('select')).toBeTruthy();
        expect(container.querySelector('[role="listbox"]')).toBeNull();
    });

    it('filters options when filter text is typed', () => {
        const def = baseDef([{
            key: 'country', type: 'field', dataType: 'choice', label: 'Country',
            options: [
                { value: 'us', label: 'United States' },
                { value: 'ca', label: 'Canada' },
                { value: 'mx', label: 'Mexico' },
            ],
        }]);
        const node: LayoutNode = {
            id: 'country-field', component: 'Select', category: 'field',
            props: { searchable: true }, cssClasses: [], children: [], bindPath: 'country',
        };
        const container = renderField(def, node);
        const filterInput = container.querySelector('.formspec-select-searchable input[type="text"]') as HTMLInputElement;

        // Focus, then simulate typing via React's input value setter to trigger onChange
        flushSync(() => { filterInput.focus(); });
        // React intercepts the native setter — use Object.getOwnPropertyDescriptor to trigger it
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        flushSync(() => {
            nativeInputValueSetter?.call(filterInput, 'can');
            filterInput.dispatchEvent(new Event('input', { bubbles: true }));
        });

        const items = container.querySelectorAll('[role="option"]');
        expect(items.length).toBe(1);
        expect(items[0].textContent).toBe('Canada');
    });

    it('filter input does not have a separate onInput attribute (onChange is the sole handler)', () => {
        const def = baseDef([{
            key: 'country', type: 'field', dataType: 'choice', label: 'Country',
            options: [{ value: 'us', label: 'United States' }],
        }]);
        const node: LayoutNode = {
            id: 'country-field', component: 'Select', category: 'field',
            props: { searchable: true }, cssClasses: [], children: [], bindPath: 'country',
        };
        const container = renderField(def, node);
        const filterInput = container.querySelector('.formspec-select-searchable input[type="text"]') as HTMLInputElement;
        // React removes redundant event handlers — no oninput attribute should be set directly
        expect(filterInput.getAttribute('oninput')).toBeNull();
    });
});

// ── SearchableSelect — WAI-ARIA combobox ────────────────────────────

describe('SearchableSelect — WAI-ARIA combobox pattern', () => {
    function makeSearchable(options = [
        { value: 'us', label: 'United States' },
        { value: 'ca', label: 'Canada' },
        { value: 'mx', label: 'Mexico' },
    ]) {
        const def = baseDef([{
            key: 'country', type: 'field', dataType: 'choice', label: 'Country',
            options,
        }]);
        const node: LayoutNode = {
            id: 'country-field', component: 'Select', category: 'field',
            props: { searchable: true }, cssClasses: [], children: [], bindPath: 'country',
        };
        return renderField(def, node);
    }

    it('filter input has role="combobox"', () => {
        const container = makeSearchable();
        const input = container.querySelector('.formspec-select-searchable input[type="text"]') as HTMLInputElement;
        expect(input.getAttribute('role')).toBe('combobox');
    });

    it('filter input has aria-autocomplete="list"', () => {
        const container = makeSearchable();
        const input = container.querySelector('.formspec-select-searchable input[type="text"]') as HTMLInputElement;
        expect(input.getAttribute('aria-autocomplete')).toBe('list');
    });

    it('listbox has a stable id and input aria-controls points to it', () => {
        const container = makeSearchable();
        const listbox = container.querySelector('[role="listbox"]') as HTMLElement;
        const input = container.querySelector('input[role="combobox"]') as HTMLInputElement;
        expect(listbox.id).toBeTruthy();
        expect(input.getAttribute('aria-controls')).toBe(listbox.id);
    });

    it('aria-expanded is false when input is not focused', () => {
        const container = makeSearchable();
        const input = container.querySelector('input[role="combobox"]') as HTMLInputElement;
        expect(input.getAttribute('aria-expanded')).toBe('false');
    });

    it('aria-expanded becomes true when input is focused', () => {
        const container = makeSearchable();
        const input = container.querySelector('input[role="combobox"]') as HTMLInputElement;
        flushSync(() => { input.focus(); });
        expect(input.getAttribute('aria-expanded')).toBe('true');
    });

    it('listbox is hidden when input is not focused', () => {
        const container = makeSearchable();
        const listbox = container.querySelector('[role="listbox"]') as HTMLElement;
        expect(listbox.style.display).toBe('none');
    });

    it('listbox is visible when input is focused', () => {
        const container = makeSearchable();
        const input = container.querySelector('input[role="combobox"]') as HTMLInputElement;
        flushSync(() => { input.focus(); });
        const listbox = container.querySelector('[role="listbox"]') as HTMLElement;
        expect(listbox.style.display).not.toBe('none');
    });

    it('each option has an id and role="option"', () => {
        const container = makeSearchable();
        const input = container.querySelector('input[role="combobox"]') as HTMLInputElement;
        flushSync(() => { input.focus(); });
        const options = container.querySelectorAll('[role="option"]');
        expect(options.length).toBe(3);
        options.forEach(opt => expect(opt.id).toBeTruthy());
    });

    it('ArrowDown highlights the first option and sets aria-activedescendant', () => {
        const container = makeSearchable();
        const input = container.querySelector('input[role="combobox"]') as HTMLInputElement;
        flushSync(() => { input.focus(); });
        flushSync(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
        const options = container.querySelectorAll('[role="option"]');
        expect(options[0].getAttribute('aria-selected')).toBe('true');
        expect(input.getAttribute('aria-activedescendant')).toBe(options[0].id);
    });

    it('ArrowDown twice highlights the second option', () => {
        const container = makeSearchable();
        const input = container.querySelector('input[role="combobox"]') as HTMLInputElement;
        flushSync(() => { input.focus(); });
        flushSync(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
        flushSync(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
        const options = container.querySelectorAll('[role="option"]');
        expect(options[1].getAttribute('aria-selected')).toBe('true');
        expect(input.getAttribute('aria-activedescendant')).toBe(options[1].id);
    });

    it('ArrowUp from first wraps to last option', () => {
        const container = makeSearchable();
        const input = container.querySelector('input[role="combobox"]') as HTMLInputElement;
        flushSync(() => { input.focus(); });
        flushSync(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
        flushSync(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })); });
        const options = container.querySelectorAll('[role="option"]');
        expect(options[options.length - 1].getAttribute('aria-selected')).toBe('true');
    });

    it('Enter selects the highlighted option and sets field value', () => {
        const def = baseDef([{
            key: 'country', type: 'field', dataType: 'choice', label: 'Country',
            options: [
                { value: 'us', label: 'United States' },
                { value: 'ca', label: 'Canada' },
            ],
        }]);
        const engine = createFormEngine(def);
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        const node: LayoutNode = {
            id: 'country-field', component: 'Select', category: 'field',
            props: { searchable: true }, cssClasses: [], children: [], bindPath: 'country',
        };
        flushSync(() => {
            root.render(
                <FormspecProvider engine={engine}>
                    <FormspecNode node={{ id: 'root', component: 'Stack', category: 'layout', props: {}, cssClasses: [], children: [node] }} />
                </FormspecProvider>
            );
        });
        const input = container.querySelector('input[role="combobox"]') as HTMLInputElement;
        flushSync(() => { input.focus(); });
        flushSync(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
        flushSync(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
        expect(engine.getResponse().data['country']).toBe('us');
    });

    it('Escape closes the listbox', () => {
        const container = makeSearchable();
        const input = container.querySelector('input[role="combobox"]') as HTMLInputElement;
        flushSync(() => { input.focus(); });
        expect(input.getAttribute('aria-expanded')).toBe('true');
        flushSync(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
        expect(input.getAttribute('aria-expanded')).toBe('false');
    });
});

// ── FileUpload maxSize ─────────────────────────────────────────────

describe('FileUpload — maxSize', () => {
    it('rejects files exceeding maxSize', () => {
        const def = baseDef([{ key: 'doc', type: 'field', dataType: 'string', label: 'Doc' }]);
        const engine = createFormEngine(def);

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        const node: LayoutNode = {
            id: 'doc-field', component: 'FileUpload', category: 'field',
            // maxSize = 1000 bytes
            props: { maxSize: 1000 }, cssClasses: [], children: [], bindPath: 'doc',
        };
        flushSync(() => {
            root.render(
                <FormspecProvider engine={engine}>
                    <FormspecNode node={{ id: 'root', component: 'Stack', category: 'layout', props: {}, cssClasses: [], children: [node] }} />
                </FormspecProvider>
            );
        });

        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        // Simulate oversized file
        const bigFile = new File(['x'.repeat(2000)], 'big.pdf', { type: 'application/pdf' });
        Object.defineProperty(input, 'files', { value: [bigFile], configurable: true });
        flushSync(() => {
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });

        // Engine value should NOT be set to a FileList — it stays at the initial empty value
        const response = engine.getResponse();
        // The engine initializes string fields to '' by default; FileList would be an object
        expect(typeof response.data['doc']).not.toBe('object');

        // An error message should be visible
        const error = container.querySelector('.formspec-file-size-error, .formspec-error') as HTMLElement;
        expect(error).toBeTruthy();
        expect(error.textContent).toContain('exceeds');
    });

    it('accepts files within maxSize', () => {
        const def = baseDef([{ key: 'doc', type: 'field', dataType: 'string', label: 'Doc' }]);
        const engine = createFormEngine(def);

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        const node: LayoutNode = {
            id: 'doc-field', component: 'FileUpload', category: 'field',
            props: { maxSize: 1000 }, cssClasses: [], children: [], bindPath: 'doc',
        };
        flushSync(() => {
            root.render(
                <FormspecProvider engine={engine}>
                    <FormspecNode node={{ id: 'root', component: 'Stack', category: 'layout', props: {}, cssClasses: [], children: [node] }} />
                </FormspecProvider>
            );
        });

        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        const smallFile = new File(['small'], 'small.pdf', { type: 'application/pdf' });
        Object.defineProperty(input, 'files', { value: [smallFile], configurable: true });
        flushSync(() => {
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });

        // Engine value should be set (FileList object)
        const response = engine.getResponse();
        expect(response.data['doc']).toBeTruthy();
    });
});

// ── DatePicker minDate / maxDate ───────────────────────────────────

describe('DatePicker — minDate/maxDate', () => {
    it('passes minDate and maxDate as min/max attributes', () => {
        const def = baseDef([{ key: 'dob', type: 'field', dataType: 'date', label: 'DOB' }]);
        const node: LayoutNode = {
            id: 'dob-field', component: 'DatePicker', category: 'field',
            props: { minDate: '2000-01-01', maxDate: '2024-12-31' }, cssClasses: [], children: [], bindPath: 'dob',
        };
        const container = renderField(def, node);
        const input = container.querySelector('input[type="date"]') as HTMLInputElement;
        expect(input.min).toBe('2000-01-01');
        expect(input.max).toBe('2024-12-31');
    });
});

// ── FileUpload dragDrop ────────────────────────────────────────────

describe('FileUpload — dragDrop', () => {
    it('renders drop zone by default (dragDrop not set)', () => {
        const def = baseDef([{ key: 'doc', type: 'field', dataType: 'string', label: 'Doc' }]);
        const node: LayoutNode = {
            id: 'doc-field', component: 'FileUpload', category: 'field',
            props: {}, cssClasses: [], children: [], bindPath: 'doc',
        };
        const container = renderField(def, node);
        expect(container.querySelector('.formspec-file-drop-zone')).toBeTruthy();
    });

    it('renders drop zone when dragDrop=true', () => {
        const def = baseDef([{ key: 'doc', type: 'field', dataType: 'string', label: 'Doc' }]);
        const node: LayoutNode = {
            id: 'doc-field', component: 'FileUpload', category: 'field',
            props: { dragDrop: true }, cssClasses: [], children: [], bindPath: 'doc',
        };
        const container = renderField(def, node);
        expect(container.querySelector('.formspec-file-drop-zone')).toBeTruthy();
    });

    it('renders plain file input when dragDrop=false', () => {
        const def = baseDef([{ key: 'doc', type: 'field', dataType: 'string', label: 'Doc' }]);
        const node: LayoutNode = {
            id: 'doc-field', component: 'FileUpload', category: 'field',
            props: { dragDrop: false }, cssClasses: [], children: [], bindPath: 'doc',
        };
        const container = renderField(def, node);
        expect(container.querySelector('.formspec-file-drop-zone')).toBeNull();
        expect(container.querySelector('input[type="file"]')).toBeTruthy();
    });
});

// ── Stepper button aria-labels ─────────────────────────────────────

describe('NumberInput stepper — button aria-labels', () => {
    it('decrement button has aria-label with field label', () => {
        const def = baseDef([{ key: 'qty', type: 'field', dataType: 'integer', label: 'Quantity' }]);
        const node: LayoutNode = {
            id: 'qty-field', component: 'NumberInput', category: 'field',
            props: { showStepper: true }, cssClasses: [], children: [], bindPath: 'qty',
        };
        const container = renderField(def, node);
        const dec = container.querySelector('.formspec-stepper-decrement') as HTMLButtonElement;
        expect(dec.getAttribute('aria-label')).toBe('Decrease Quantity');
    });

    it('increment button has aria-label with field label', () => {
        const def = baseDef([{ key: 'qty', type: 'field', dataType: 'integer', label: 'Quantity' }]);
        const node: LayoutNode = {
            id: 'qty-field', component: 'NumberInput', category: 'field',
            props: { showStepper: true }, cssClasses: [], children: [], bindPath: 'qty',
        };
        const container = renderField(def, node);
        const inc = container.querySelector('.formspec-stepper-increment') as HTMLButtonElement;
        expect(inc.getAttribute('aria-label')).toBe('Increase Quantity');
    });
});

// ── Rating aria-checked (radiogroup pattern) ───────────────────────

describe('Rating — radiogroup keyboard navigation', () => {
    function makeRating(value?: number) {
        const def = baseDef([{ key: 'stars', type: 'field', dataType: 'integer', label: 'Stars' }]);
        const engine = createFormEngine(def);
        if (value != null) engine.setValue('stars', value);
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        const node: LayoutNode = {
            id: 'stars-field', component: 'Rating', category: 'field',
            props: { maxRating: 5 }, cssClasses: [], children: [], bindPath: 'stars',
        };
        flushSync(() => {
            root.render(
                <FormspecProvider engine={engine}>
                    <FormspecNode node={{ id: 'root', component: 'Stack', category: 'layout', props: {}, cssClasses: [], children: [node] }} />
                </FormspecProvider>
            );
        });
        return { container, engine };
    }

    it('wraps stars in role="radiogroup"', () => {
        const { container } = makeRating();
        expect(container.querySelector('[role="radiogroup"]')).toBeTruthy();
    });

    it('each star has role="radio" and aria-checked', () => {
        const { container } = makeRating(3);
        const stars = container.querySelectorAll('[role="radio"]');
        expect(stars.length).toBe(5);
        expect(stars[0].getAttribute('aria-checked')).toBe('true');
        expect(stars[1].getAttribute('aria-checked')).toBe('true');
        expect(stars[2].getAttribute('aria-checked')).toBe('true');
        expect(stars[3].getAttribute('aria-checked')).toBe('false');
        expect(stars[4].getAttribute('aria-checked')).toBe('false');
    });

    it('roving tabindex: selected star is tabIndex=0, others are -1', () => {
        const { container } = makeRating(2);
        const stars = container.querySelectorAll<HTMLElement>('[role="radio"]');
        // star index 1 (value=2) is selected → tabIndex 0
        expect(stars[1].tabIndex).toBe(0);
        expect(stars[0].tabIndex).toBe(-1);
        expect(stars[2].tabIndex).toBe(-1);
    });

    it('roving tabindex: first star is tabIndex=0 when no value', () => {
        const { container } = makeRating();
        const stars = container.querySelectorAll<HTMLElement>('[role="radio"]');
        expect(stars[0].tabIndex).toBe(0);
        stars.forEach((s, i) => { if (i > 0) expect(s.tabIndex).toBe(-1); });
    });

    it('ArrowRight increments the rating', () => {
        const { container, engine } = makeRating(2);
        const radiogroup = container.querySelector('[role="radiogroup"]') as HTMLElement;
        flushSync(() => {
            radiogroup.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        });
        expect(engine.getResponse().data['stars']).toBe(3);
    });

    it('ArrowLeft decrements the rating', () => {
        const { container, engine } = makeRating(3);
        const radiogroup = container.querySelector('[role="radiogroup"]') as HTMLElement;
        flushSync(() => {
            radiogroup.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        });
        expect(engine.getResponse().data['stars']).toBe(2);
    });

    it('ArrowUp increments the rating', () => {
        const { container, engine } = makeRating(1);
        const radiogroup = container.querySelector('[role="radiogroup"]') as HTMLElement;
        flushSync(() => {
            radiogroup.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        });
        expect(engine.getResponse().data['stars']).toBe(2);
    });

    it('ArrowDown decrements the rating', () => {
        const { container, engine } = makeRating(4);
        const radiogroup = container.querySelector('[role="radiogroup"]') as HTMLElement;
        flushSync(() => {
            radiogroup.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        });
        expect(engine.getResponse().data['stars']).toBe(3);
    });

    it('Home sets rating to 1', () => {
        const { container, engine } = makeRating(4);
        const radiogroup = container.querySelector('[role="radiogroup"]') as HTMLElement;
        flushSync(() => {
            radiogroup.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
        });
        expect(engine.getResponse().data['stars']).toBe(1);
    });

    it('End sets rating to maxRating', () => {
        const { container, engine } = makeRating(1);
        const radiogroup = container.querySelector('[role="radiogroup"]') as HTMLElement;
        flushSync(() => {
            radiogroup.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
        });
        expect(engine.getResponse().data['stars']).toBe(5);
    });

    it('ArrowRight clamps at maxRating', () => {
        const { container, engine } = makeRating(5);
        const radiogroup = container.querySelector('[role="radiogroup"]') as HTMLElement;
        flushSync(() => {
            radiogroup.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        });
        expect(engine.getResponse().data['stars']).toBe(5);
    });

    it('ArrowLeft clamps at 1', () => {
        const { container, engine } = makeRating(1);
        const radiogroup = container.querySelector('[role="radiogroup"]') as HTMLElement;
        flushSync(() => {
            radiogroup.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        });
        expect(engine.getResponse().data['stars']).toBe(1);
    });
});

// ── Select clear icon aria-hidden ─────────────────────────────────

describe('Select — clear button icon aria-hidden', () => {
    it('the × character is wrapped in aria-hidden span', () => {
        const def = baseDef([{
            key: 'color', type: 'field', dataType: 'choice', label: 'Color',
            options: [{ value: 'red', label: 'Red' }],
        }]);
        const engine = createFormEngine(def);
        engine.setValue('color', 'red');

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        const node: LayoutNode = {
            id: 'color-field', component: 'Select', category: 'field',
            props: { clearable: true }, cssClasses: [], children: [], bindPath: 'color',
        };
        flushSync(() => {
            root.render(
                <FormspecProvider engine={engine}>
                    <FormspecNode node={{ id: 'root', component: 'Stack', category: 'layout', props: {}, cssClasses: [], children: [node] }} />
                </FormspecProvider>
            );
        });

        const clearBtn = container.querySelector('.formspec-select-clear') as HTMLButtonElement;
        expect(clearBtn).toBeTruthy();
        const hiddenSpan = clearBtn.querySelector('span[aria-hidden="true"]');
        expect(hiddenSpan).toBeTruthy();
        expect(hiddenSpan!.textContent).toBe('×');
    });
});
