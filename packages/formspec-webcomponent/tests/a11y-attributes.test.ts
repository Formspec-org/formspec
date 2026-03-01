import { describe, it, expect, beforeAll, afterEach } from 'vitest';

let FormspecRender: any;

beforeAll(async () => {
    const mod = await import('../src/index');
    FormspecRender = mod.FormspecRender;
    if (!customElements.get('formspec-render')) {
        customElements.define('formspec-render', FormspecRender);
    }
});

function renderWith(items: any[], binds: any[], tree: any) {
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
        ...(binds.length > 0 ? { binds } : {}),
    };
    el.render();
    return el;
}

describe('a11y attributes — label/describedby', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('links label and hint/error via aria-describedby', () => {
        const el = renderWith(
            [{ key: 'age', type: 'field', dataType: 'integer', label: 'Age', hint: 'Enter your age' }],
            [],
            {
                component: 'Page',
                children: [{ component: 'NumberInput', bind: 'age' }],
            },
        );
        const label = el.querySelector('label[for="field-age"]') as HTMLLabelElement;
        expect(label).not.toBeNull();

        const input = el.querySelector('#field-age') as HTMLInputElement;
        expect(input).not.toBeNull();
        const describedBy = input.getAttribute('aria-describedby') || '';
        expect(describedBy).toContain('field-age-hint');
        expect(describedBy).toContain('field-age-error');

        const hint = el.querySelector('#field-age-hint') as HTMLElement;
        expect(hint).not.toBeNull();
        expect(hint.textContent).toBe('Enter your age');
    });
});

describe('a11y attributes — role and live-region', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('sets role=alert and aria-live=polite on error element', () => {
        const el = renderWith(
            [{ key: 'x', type: 'field', dataType: 'string', label: 'X' }],
            [{ path: 'x', required: true }],
            {
                component: 'Page',
                children: [{ component: 'TextInput', bind: 'x' }],
            },
        );
        const errorEl = el.querySelector('#field-x-error') as HTMLElement;
        expect(errorEl).not.toBeNull();
        expect(errorEl.getAttribute('role')).toBe('alert');
        expect(errorEl.getAttribute('aria-live')).toBe('polite');
    });
});

describe('a11y attributes — accessibility metadata', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('applies role and aria-description attributes from accessibility metadata', () => {
        const el = renderWith(
            [{ key: 'search', type: 'field', dataType: 'string', label: 'Search' }],
            [],
            {
                component: 'Page',
                children: [
                    {
                        component: 'TextInput',
                        bind: 'search',
                        accessibility: {
                            role: 'search',
                            description: 'Search for items',
                        },
                    },
                ],
            },
        );
        const field = el.querySelector('.formspec-field') as HTMLElement;
        expect(field).not.toBeNull();
        expect(field.getAttribute('role')).toBe('search');
        expect(field.getAttribute('aria-description')).toBe('Search for items');
    });
});
