/** @filedesc Smoke test: examples/uswds-grant renders a field via formspec-render + USWDS adapter. */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import definition from '../../../../examples/uswds-grant/grant.definition.json';
import theme from '../../../../examples/uswds-grant/grant.theme.json';
import { initFormspecEngine } from '@formspec-org/engine/init-formspec-engine';
import { FormspecRender, globalRegistry } from '@formspec-org/webcomponent';
import { uswdsAdapter } from '../../src/uswds/index';

beforeAll(async () => {
    await initFormspecEngine();
    if (!customElements.get('formspec-render')) {
        customElements.define('formspec-render', FormspecRender);
    }
});

describe('examples/uswds-grant + USWDS adapter', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach((e) => e.remove());
        globalRegistry.setAdapter('default');
    });

    it('renders applicant org name field after async render()', async () => {
        globalRegistry.registerAdapter(uswdsAdapter);
        globalRegistry.setAdapter('uswds');
        const el = document.createElement('formspec-render') as InstanceType<typeof FormspecRender>;
        document.body.appendChild(el);
        el.themeDocument = theme as any;
        el.definition = definition as any;
        // Field controls are finalized inside @preact/signals-core effects; wait for DOM.
        await vi.waitFor(
            () => {
                expect(el.querySelector('#field-applicant_section-org_name')).toBeTruthy();
            },
            { timeout: 5000 },
        );
        // Render target lives in light DOM; shadow root is only a default <slot>.
        const input = el.querySelector('#field-applicant_section-org_name');
        expect(input).toBeTruthy();
        expect((input as HTMLInputElement).getAttribute('name')).toBe('applicant_section.org_name');
    });
});
