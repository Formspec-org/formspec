import { describe, it, expect, beforeAll, afterEach } from 'vitest';

let FormspecRender: any;

beforeAll(async () => {
    const mod = await import('../src/index');
    FormspecRender = mod.FormspecRender;
    if (!customElements.get('formspec-render')) {
        customElements.define('formspec-render', FormspecRender);
    }
});

function renderWith(items: any[], tree: any) {
    const el = document.createElement('formspec-render') as any;
    document.body.appendChild(el);
    el.componentDocument = {
        $formspecComponent: '1.0',
        version: '1.0.0',
        targetDefinition: { url: 'urn:test:form' },
        tree,
    };
    el.definition = {
        $formspec: '1.0',
        url: 'urn:test:form',
        version: '1.0.0',
        title: 'Test',
        items,
    };
    el.render();
    return el;
}

describe('component props — NumberInput', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('applies min max and step attributes from comp props', () => {
        const el = renderWith(
            [{ key: 'qty', type: 'field', dataType: 'integer', label: 'Quantity' }],
            {
                component: 'Page',
                children: [{ component: 'NumberInput', bind: 'qty', min: 1, max: 100, step: 5 }],
            },
        );
        const input = el.querySelector('input[type="number"]') as HTMLInputElement;
        expect(input).not.toBeNull();
        expect(input.getAttribute('min')).toBe('1');
        expect(input.getAttribute('max')).toBe('100');
        expect(input.getAttribute('step')).toBe('5');
    });
});

describe('component props — Select', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('renders placeholder and clear option when clearable is configured', () => {
        const el = renderWith(
            [{
                key: 'size',
                type: 'field',
                dataType: 'choice',
                label: 'Size',
                options: [
                    { value: 's', label: 'Small' },
                    { value: 'm', label: 'Medium' },
                    { value: 'l', label: 'Large' },
                ],
            }],
            {
                component: 'Page',
                children: [{ component: 'Select', bind: 'size', placeholder: 'Choose a size', clearable: true }],
            },
        );
        const options = el.querySelectorAll('select option');
        // Placeholder option + clear option + 3 real options = 5
        expect(options.length).toBe(5);
        expect((options[0] as HTMLOptionElement).textContent).toBe('Choose a size');
        expect((options[0] as HTMLOptionElement).disabled).toBe(true);
        expect((options[1] as HTMLOptionElement).textContent).toBe('— Clear —');
    });
});

describe('component props — DatePicker', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('applies minDate and maxDate as HTML min/max attributes', () => {
        const el = renderWith(
            [{ key: 'dob', type: 'field', dataType: 'date', label: 'DOB' }],
            {
                component: 'Page',
                children: [{ component: 'DatePicker', bind: 'dob', minDate: '1900-01-01', maxDate: '2025-12-31' }],
            },
        );
        const input = el.querySelector('input[type="date"]') as HTMLInputElement;
        expect(input).not.toBeNull();
        expect(input.getAttribute('min')).toBe('1900-01-01');
        expect(input.getAttribute('max')).toBe('2025-12-31');
    });
});

describe('component props — TextInput prefix/suffix', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('renders prefix and suffix wrapper spans when adornments are configured', () => {
        const el = renderWith(
            [{ key: 'amount', type: 'field', dataType: 'string', label: 'Amount' }],
            {
                component: 'Page',
                children: [{ component: 'TextInput', bind: 'amount', prefix: '$', suffix: 'USD' }],
            },
        );
        const prefix = el.querySelector('.formspec-prefix') as HTMLElement;
        const suffix = el.querySelector('.formspec-suffix') as HTMLElement;
        expect(prefix).not.toBeNull();
        expect(suffix).not.toBeNull();
        expect(prefix.textContent).toBe('$');
        expect(suffix.textContent).toBe('USD');
    });
});

describe('component props — Tabs defaultTab', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('activates the configured default tab on render', () => {
        const el = renderWith(
            [
                { key: 'a', type: 'field', dataType: 'string', label: 'A' },
                { key: 'b', type: 'field', dataType: 'string', label: 'B' },
            ],
            {
                component: 'Tabs',
                tabLabels: ['First', 'Second'],
                defaultTab: 1,
                children: [
                    { component: 'Stack', children: [{ component: 'TextInput', bind: 'a' }] },
                    { component: 'Stack', children: [{ component: 'TextInput', bind: 'b' }] },
                ],
            },
        );
        const panels = el.querySelectorAll('.formspec-tab-panel');
        expect(panels[0].classList.contains('formspec-hidden')).toBe(true);
        expect(panels[1].classList.contains('formspec-hidden')).toBe(false);
        const buttons = el.querySelectorAll('.formspec-tab');
        expect(buttons[1].classList.contains('formspec-tab--active')).toBe(true);
    });
});

describe('component props — Page description', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('renders description text when Page description is provided', () => {
        const el = renderWith(
            [],
            {
                component: 'Page',
                title: 'Welcome',
                description: 'Please fill out this form carefully.',
                children: [],
            },
        );
        const desc = el.querySelector('.formspec-page-description') as HTMLElement;
        expect(desc).not.toBeNull();
        expect(desc.textContent).toBe('Please fill out this form carefully.');
    });
});
