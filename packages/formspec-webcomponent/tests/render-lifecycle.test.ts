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

    it('setting definition again re-renders (old DOM removed)', () => {
        el.definition = singleFieldDef();
        const firstContainer = el.querySelector('.formspec-container');
        expect(firstContainer).not.toBeNull();

        el.definition = multiFieldDef([
            { key: 'a', dataType: 'string' },
            { key: 'b', dataType: 'integer' },
        ]);
        // Old container replaced
        expect(el.querySelector('.formspec-container')).not.toBe(firstContainer);
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
});
