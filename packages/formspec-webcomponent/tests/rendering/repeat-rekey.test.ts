import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { repeatGroupDef } from '../helpers/engine-fixtures';

let FormspecRender: any;

beforeAll(async () => {
    const mod = await import('../../src/index');
    FormspecRender = mod.FormspecRender;
    if (!customElements.get('formspec-render')) {
        customElements.define('formspec-render', FormspecRender);
    }
});

function renderFormspec() {
    const el = document.createElement('formspec-render') as any;
    document.body.appendChild(el);
    el.definition = repeatGroupDef();
    el.render();
    return { element: el, engine: el.getEngine() };
}

describe('repeat DOM re-keying after non-tail deletion', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('rebuilds surviving instances so shifted values stay aligned', () => {
        const { element, engine } = renderFormspec();

        engine.addRepeatInstance('items');
        engine.addRepeatInstance('items');

        engine.setValue('items[0].name', 'Alice');
        engine.setValue('items[1].name', 'Bob');
        engine.setValue('items[2].name', 'Charlie');

        const inputsBefore = element.querySelectorAll('input[name]') as NodeListOf<HTMLInputElement>;
        expect(inputsBefore).toHaveLength(3);
        expect(inputsBefore[1].value).toBe('Bob');
        expect(inputsBefore[2].value).toBe('Charlie');

        engine.removeRepeatInstance('items', 1);

        const inputsAfter = element.querySelectorAll('input[name]') as NodeListOf<HTMLInputElement>;
        expect(inputsAfter).toHaveLength(2);
        expect(inputsAfter[0].getAttribute('name')).toContain('items[0].name');
        expect(inputsAfter[1].getAttribute('name')).toContain('items[1].name');
        expect(inputsAfter[0].value).toBe('Alice');
        expect(inputsAfter[1].value).toBe('Charlie');
    });
});
