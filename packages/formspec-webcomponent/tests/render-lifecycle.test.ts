import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { singleFieldDef, minimalComponentDoc, multiFieldDef } from './helpers/engine-fixtures';

let FormspecRender: any;

beforeAll(async () => {
    const mod = await import('../src/index');
    FormspecRender = mod.FormspecRender;
    if (!customElements.get('formspec-render')) {
        customElements.define('formspec-render', FormspecRender);
    }
});

describe('render lifecycle', () => {
    let el: InstanceType<any>;

    beforeEach(() => {
        el = document.createElement('formspec-render');
        document.body.appendChild(el);
    });

    afterEach(() => {
        el.remove();
    });

    it('setting definition creates engine and renders container + fields', () => {
        el.definition = singleFieldDef();
        expect(el.getEngine()).not.toBeNull();
        expect(el.querySelector('.formspec-container')).not.toBeNull();
        expect(el.querySelector('.formspec-field')).not.toBeNull();
    });

    it('setting definition again re-renders in place (root container preserved)', () => {
        el.definition = singleFieldDef();
        const firstContainer = el.querySelector('.formspec-container');
        expect(firstContainer).not.toBeNull();

        el.definition = multiFieldDef([
            { key: 'a', dataType: 'string' },
            { key: 'b', dataType: 'integer' },
        ]);
        // Root container remains stable; children are refreshed.
        expect(el.querySelector('.formspec-container')).toBe(firstContainer);
        // Two fields now
        expect(el.querySelectorAll('.formspec-field').length).toBe(2);
    });

    it('submit button dispatches formspec-submit event with response payload', async () => {
        el.definition = singleFieldDef();
        el.getEngine().setValue('name', 'Alice');

        const received = new Promise<any>((resolve) => {
            el.addEventListener('formspec-submit', (e: CustomEvent) => resolve(e.detail));
        });

        const submitBtn = el.querySelector('.formspec-submit') as HTMLButtonElement;
        expect(submitBtn).not.toBeNull();
        submitBtn.click();

        const response = await received;
        expect(response).toBeDefined();
        // Response should contain the value we set
        expect(response.data?.name).toBe('Alice');
    });

    it('unknown component type in tree logs warning', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        el.definition = {
            $formspec: '1.0',
            url: 'urn:test:form',
            version: '1.0.0',
            title: 'Test',
            items: [],
        };
        el.componentDocument = minimalComponentDoc({
            component: 'TotallyFakeWidget',
        });
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('TotallyFakeWidget'));
        warn.mockRestore();
    });

    it('custom component recursion detected with console.warn', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        el.definition = {
            $formspec: '1.0',
            url: 'urn:test:form',
            version: '1.0.0',
            title: 'Test',
            items: [],
        };
        el.componentDocument = {
            $formspecComponent: '1.0',
            version: '1.0.0',
            targetDefinition: { url: 'urn:test:form' },
            tree: { component: 'SelfRef' },
            components: {
                SelfRef: { tree: { component: 'SelfRef' } },
            },
        };
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Recursive'));
        warn.mockRestore();
    });

    it('disconnectedCallback drains cleanup functions', () => {
        el.definition = singleFieldDef();
        // After setting a definition, there should be reactive effects in cleanupFns
        // disconnectedCallback should clear them
        el.remove();
        // Re-append to verify it's truly cleaned up (no errors)
        document.body.appendChild(el);
        // Should be empty — no leftover DOM
        expect(el.querySelector('.formspec-container')).toBeNull();
    });

    it('reference-counts external theme stylesheets across multiple instances', () => {
        document.head.querySelectorAll('link[data-formspec-theme]').forEach(link => link.remove());

        const theme = {
            $formspecTheme: '1.0' as const,
            version: '1.0.0',
            targetDefinition: { url: 'urn:test:form' },
            stylesheets: ['data:text/css,.formspec-test%7Bcolor%3Ainherit%7D'],
        };

        el.themeDocument = theme;
        el.definition = singleFieldDef();
        expect(document.head.querySelectorAll('link[data-formspec-theme]').length).toBe(1);

        const el2 = document.createElement('formspec-render') as InstanceType<any>;
        document.body.appendChild(el2);
        el2.themeDocument = theme;
        el2.definition = singleFieldDef();
        expect(document.head.querySelectorAll('link[data-formspec-theme]').length).toBe(1);

        el.remove();
        expect(document.head.querySelectorAll('link[data-formspec-theme]').length).toBe(1);

        el2.remove();
        expect(document.head.querySelectorAll('link[data-formspec-theme]').length).toBe(0);

        // Recreate for suite afterEach cleanup contract.
        el = document.createElement('formspec-render');
        document.body.appendChild(el);
    });
});
