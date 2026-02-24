import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { singleFieldDef, minimalComponentDoc, minimalTheme } from './helpers/engine-fixtures';

let FormspecRender: any;

beforeAll(async () => {
    const mod = await import('../src/index');
    FormspecRender = mod.FormspecRender;
    if (!customElements.get('formspec-render')) {
        customElements.define('formspec-render', FormspecRender);
    }
});

/** Helper: create element, set definition, and return the rendered field wrapper. */
function renderField(
    itemOverrides: Record<string, any> = {},
    compDocTree?: any,
    themeDoc?: any,
) {
    const el = document.createElement('formspec-render') as any;
    document.body.appendChild(el);

    if (themeDoc) el.themeDocument = themeDoc;

    const def = singleFieldDef(itemOverrides);

    if (compDocTree) {
        el.componentDocument = {
            $formspecComponent: '1.0',
            version: '1.0.0',
            targetDefinition: { url: 'urn:test:form' },
            tree: compDocTree,
        };
    }

    el.definition = def;
    return el;
}

describe('input rendering — label position cascade', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('defaults to top label position (no inline class)', () => {
        const el = renderField();
        const fieldWrapper = el.querySelector('.formspec-field') as HTMLElement;
        expect(fieldWrapper).not.toBeNull();
        expect(fieldWrapper.classList.contains('formspec-field--inline')).toBe(false);
        const label = el.querySelector('.formspec-label') as HTMLElement;
        expect(label.classList.contains('formspec-sr-only')).toBe(false);
    });

    it('theme start labelPosition adds inline class', () => {
        const theme = minimalTheme({
            defaults: { labelPosition: 'start' },
        });
        const el = renderField({}, undefined, theme);
        const fieldWrapper = el.querySelector('.formspec-field') as HTMLElement;
        expect(fieldWrapper.classList.contains('formspec-field--inline')).toBe(true);
    });

    it('comp hidden labelPosition adds sr-only class to label', () => {
        const tree = {
            component: 'TextInput',
            bind: 'name',
            labelPosition: 'hidden',
        };
        const el = renderField({}, tree);
        const label = el.querySelector('.formspec-label') as HTMLElement;
        expect(label.classList.contains('formspec-sr-only')).toBe(true);
    });
});

describe('input rendering — ARIA attributes', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('links hint and error via aria-describedby', () => {
        const el = renderField({ hint: 'Enter your name' });
        const input = el.querySelector('input') as HTMLInputElement;
        const describedBy = input.getAttribute('aria-describedby') || '';
        // Should reference both hint and error element IDs
        const ids = describedBy.split(/\s+/);
        const hintId = ids.find(id => id.endsWith('-hint'));
        const errorId = ids.find(id => id.endsWith('-error'));
        expect(hintId).toBeDefined();
        expect(errorId).toBeDefined();
        // Verify the referenced elements actually exist in the DOM
        expect(el.querySelector(`#${hintId}`)).not.toBeNull();
        expect(el.querySelector(`#${errorId}`)).not.toBeNull();
    });

    it('error display has role=alert and aria-live=polite', () => {
        const el = renderField();
        const errorEl = el.querySelector('.formspec-error') as HTMLElement;
        expect(errorEl.getAttribute('role')).toBe('alert');
        expect(errorEl.getAttribute('aria-live')).toBe('polite');
    });
});

describe('input rendering — reactive signals', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('required signal adds * indicator to label', () => {
        const el = renderField({ required: true });
        const label = el.querySelector('.formspec-label') as HTMLElement;
        expect(label.querySelector('.formspec-required')).not.toBeNull();
        expect(label.textContent).toContain('*');
    });

    it('relevance false adds formspec-hidden class', () => {
        const el = renderField({ relevant: 'false' });
        const fieldWrapper = el.querySelector('.formspec-field') as HTMLElement;
        expect(fieldWrapper.classList.contains('formspec-hidden')).toBe(true);
    });

    it('readonly signal sets readOnly on input and aria-readonly', () => {
        const el = renderField({ readonly: true });
        const input = el.querySelector('input') as HTMLInputElement;
        expect(input.readOnly).toBe(true);
        expect(input.getAttribute('aria-readonly')).toBe('true');
    });

    it('error signal shows error text and sets aria-invalid', () => {
        const el = renderField({ constraint: 'false', message: 'Bad value' });
        const engine = el.getEngine();
        // Trigger validation by setting a value
        engine.setValue('name', 'test');
        const errorEl = el.querySelector('.formspec-error') as HTMLElement;
        const input = el.querySelector('input') as HTMLInputElement;
        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(errorEl.textContent).toBe('Bad value');
    });
});

describe('input rendering — dataType→input type mapping', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('string→text input', () => {
        const el = renderField({ dataType: 'string' });
        const input = el.querySelector('input') as HTMLInputElement;
        expect(input.type).toBe('text');
    });

    it('integer→number input', () => {
        const el = renderField({ dataType: 'integer' });
        const input = el.querySelector('input') as HTMLInputElement;
        expect(input.type).toBe('number');
    });

    it('date→date input', () => {
        const el = renderField({ dataType: 'date' });
        const input = el.querySelector('input') as HTMLInputElement;
        expect(input.type).toBe('date');
    });

    it('boolean→checkbox input', () => {
        const el = renderField({ dataType: 'boolean' });
        const input = el.querySelector('input[type="checkbox"]') as HTMLInputElement;
        expect(input).not.toBeNull();
    });

    it('choice→select element', () => {
        const el = renderField({
            dataType: 'choice',
            options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
        });
        const select = el.querySelector('select') as HTMLSelectElement;
        expect(select).not.toBeNull();
        expect(select.querySelectorAll('option').length).toBeGreaterThanOrEqual(2);
    });

    it('select change propagates value to engine', () => {
        const tree = { component: 'Select', bind: 'name' };
        const el = renderField({
            dataType: 'choice',
            options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
        }, tree);
        const engine = el.getEngine();
        const select = el.querySelector('select') as HTMLSelectElement;
        expect(select).not.toBeNull();

        // Simulate user selecting an option — selects fire 'change', not 'input'
        select.value = 'b';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        expect(engine.signals['name'].value).toBe('b');
    });
});

describe('input rendering — TextInput variants', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('maxLines > 1 renders textarea', () => {
        const tree = { component: 'TextInput', bind: 'name', maxLines: 5 };
        const el = renderField({ dataType: 'string' }, tree);
        const textarea = el.querySelector('textarea') as HTMLTextAreaElement;
        expect(textarea).not.toBeNull();
        expect(Number(textarea.rows)).toBe(5);
    });

    it('prefix/suffix renders wrapper spans', () => {
        const tree = { component: 'TextInput', bind: 'name', prefix: '$', suffix: '.00' };
        const el = renderField({ dataType: 'string' }, tree);
        const prefix = el.querySelector('.formspec-prefix') as HTMLElement;
        const suffix = el.querySelector('.formspec-suffix') as HTMLElement;
        expect(prefix.textContent).toBe('$');
        expect(suffix.textContent).toBe('.00');
    });
});

describe('input rendering — NumberInput attributes', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('sets min/max/step from comp props', () => {
        const tree = { component: 'NumberInput', bind: 'name', min: 0, max: 100, step: 5 };
        const el = renderField({ dataType: 'integer' }, tree);
        const input = el.querySelector('input[type="number"]') as HTMLInputElement;
        expect(input.min).toBe('0');
        expect(input.max).toBe('100');
        expect(input.step).toBe('5');
    });
});

describe('input rendering — compatibility warning', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('warns on bind/dataType incompatibility', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        // Toggle is not compatible with 'string' dataType
        const tree = { component: 'Toggle', bind: 'name' };
        renderField({ dataType: 'string' }, tree);
        const calls = warn.mock.calls.map(c => c[0]);
        expect(calls.some((c: string) => c.includes('Incompatible'))).toBe(true);
        warn.mockRestore();
    });

    it('does not warn for MoneyInput with money dataType', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const tree = { component: 'MoneyInput', bind: 'name' };
        renderField({ dataType: 'money' }, tree);
        const calls = warn.mock.calls.map(c => c[0]);
        expect(calls.some((c: string) => typeof c === 'string' && c.includes('Incompatible'))).toBe(false);
        warn.mockRestore();
    });
});
