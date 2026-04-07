// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { initFormspecEngine } from '@formspec-org/engine/init-formspec-engine';
import { RealUSWDSStory } from './RealUSWDSStory';
import { USWDSSideBySideStory } from './USWDSSideBySideStory';
import { contactFormDef } from './definitions';
import {
    accordionMultiComponentDoc,
    contactFormComponentDoc,
    groupedFormComponentDoc,
    groupedFormDef,
    popoverComponentDoc,
    wizardComponentDoc,
} from '../layout/definitions';

beforeAll(async () => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    await initFormspecEngine();
});

async function renderStory(element: React.ReactElement): Promise<HTMLDivElement> {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
        root.render(element);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });
    return container;
}

function findShadowHost(container: HTMLDivElement): HTMLDivElement | null {
    return Array.from(container.querySelectorAll('div')).find((el) => !!(el as HTMLDivElement).shadowRoot) as HTMLDivElement | null;
}

function findShadowHosts(container: HTMLDivElement): HTMLDivElement[] {
    return Array.from(container.querySelectorAll('div')).filter((el) => !!(el as HTMLDivElement).shadowRoot) as HTMLDivElement[];
}

describe('USWDS comparison story layout', () => {
    it('expands the real-USWDS comparison form to the pane width instead of the stock usa-form cap', async () => {
        const container = await renderStory(
            <RealUSWDSStory definition={contactFormDef} showSubmit={false} />,
        );

        const host = findShadowHost(container);
        const shadowRoot = host?.shadowRoot;
        const form = shadowRoot?.querySelector('form.usa-form') as HTMLFormElement | null;

        expect(shadowRoot).toBeTruthy();
        expect(form).not.toBeNull();
        expect(form?.style.maxWidth).toBe('100%');
    });

    it('injects a comparison-only override so the adapter pane does not keep the 30rem field cap', async () => {
        const container = await renderStory(
            <USWDSSideBySideStory definition={contactFormDef} showSubmit={false} />,
        );

        const [adapterHost] = findShadowHosts(container);
        const shadowRoot = adapterHost?.shadowRoot;
        const form = shadowRoot?.querySelector('form.formspec-uswds-comparison-form') as HTMLFormElement | null;
        const styleText = Array.from(shadowRoot?.querySelectorAll('style') ?? [])
            .map((styleEl) => styleEl.textContent ?? '')
            .join('\n');

        expect(shadowRoot).toBeTruthy();
        expect(form).not.toBeNull();
        expect(styleText).toContain('.formspec-uswds-comparison-form .usa-form-group');
        expect(styleText).toContain('max-width: none !important');
        expect(styleText).toContain(".formspec-uswds-comparison-form .formspec-stack.grid-row.grid-gap > [class*='grid-col'] > .usa-form-group");
    });

    it('renders real-USWDS card demos with plain cards instead of usa-card-group sizing wrappers', async () => {
        const container = await renderStory(
            <RealUSWDSStory
                definition={contactFormDef}
                componentDocument={contactFormComponentDoc}
                showSubmit={false}
            />,
        );

        const host = findShadowHost(container);
        const shadowRoot = host?.shadowRoot;

        expect(shadowRoot).toBeTruthy();
        expect(shadowRoot?.querySelector('.usa-card')).not.toBeNull();
        expect(shadowRoot?.querySelector('.usa-card-group')).toBeNull();
    });

    it('renders grouped-card bodies without extra grid-container gutters in the real comparison pane', async () => {
        const container = await renderStory(
            <RealUSWDSStory
                definition={groupedFormDef}
                componentDocument={groupedFormComponentDoc}
                showSubmit={false}
            />,
        );

        const host = findShadowHost(container);
        const shadowRoot = host?.shadowRoot;

        expect(shadowRoot).toBeTruthy();
        expect(shadowRoot?.querySelector('.usa-card__body > .grid-container')).toBeNull();
        expect(shadowRoot?.querySelector('.usa-card__body > .grid-row')).not.toBeNull();
    });

    it('renders the real-USWDS wizard with the same panel shell as the adapter comparison', async () => {
        const container = await renderStory(
            <RealUSWDSStory
                definition={contactFormDef}
                componentDocument={wizardComponentDoc}
                showSubmit={true}
            />,
        );

        const host = findShadowHost(container);
        const shadowRoot = host?.shadowRoot;

        expect(shadowRoot).toBeTruthy();
        expect(shadowRoot?.querySelector('.formspec-wizard .formspec-wizard-panel')).not.toBeNull();
        expect(shadowRoot?.querySelector('.formspec-wizard .formspec-wizard-nav')).not.toBeNull();
        expect(shadowRoot?.querySelector('.formspec-wizard .usa-card-group')).toBeNull();
        expect(shadowRoot?.querySelector('form button[type="submit"]')).toBeNull();
        expect(shadowRoot?.querySelector('.formspec-wizard-panel > .grid-container')).toBeNull();
    });

    it('loads the USWDS integration CSS into the real comparison pane for tabs and wizard spacing', async () => {
        const container = await renderStory(
            <RealUSWDSStory
                definition={contactFormDef}
                componentDocument={wizardComponentDoc}
                showSubmit={false}
            />,
        );

        const host = findShadowHost(container);
        const shadowRoot = host?.shadowRoot;
        const styleText = Array.from(shadowRoot?.querySelectorAll('style') ?? [])
            .map((styleEl) => styleEl.textContent ?? '')
            .join('\n');

        expect(shadowRoot).toBeTruthy();
        expect(styleText).toContain('.formspec-tab-panels{padding-top:1rem}');
        expect(styleText).toContain('.formspec-wizard .usa-step-indicator__heading{font-size:1rem}');
        expect(styleText).toContain('.formspec-uswds-comparison-form .usa-form-group');
        expect(styleText).toContain(".formspec-uswds-comparison-form .formspec-stack.grid-row.grid-gap > [class*='grid-col'] > .usa-form-group");
        expect(styleText).toContain('max-width: none !important');
    });

    it('renders real-USWDS tabs without extra grid-container gutters inside the active panel', async () => {
        const container = await renderStory(
            <RealUSWDSStory
                definition={contactFormDef}
                componentDocument={{ name: 'tabs-demo' }}
                showSubmit={false}
            />,
        );

        const host = findShadowHost(container);
        const shadowRoot = host?.shadowRoot;

        expect(shadowRoot).toBeTruthy();
        expect(shadowRoot?.querySelector('.formspec-tab-panels [role="tabpanel"] > .grid-container')).toBeNull();
    });

    it('does not nest full Page layout sections inside adapter wizard panels', async () => {
        const container = await renderStory(
            <USWDSSideBySideStory
                definition={contactFormDef}
                componentDocument={wizardComponentDoc}
                showSubmit={true}
            />,
        );

        const [adapterHost] = findShadowHosts(container);
        const shadowRoot = adapterHost?.shadowRoot;

        expect(shadowRoot).toBeTruthy();
        expect(shadowRoot?.querySelector('.formspec-wizard .formspec-wizard-panel')).not.toBeNull();
        expect(shadowRoot?.querySelector('.formspec-wizard .formspec-wizard-panel .formspec-page')).toBeNull();
    });

    it('keeps the real-USWDS multi-open accordion on the same default-open section as the adapter story', async () => {
        const container = await renderStory(
            <RealUSWDSStory
                definition={contactFormDef}
                componentDocument={accordionMultiComponentDoc}
                showSubmit={false}
            />,
        );

        const host = findShadowHost(container);
        const shadowRoot = host?.shadowRoot;
        const expandedButtons = Array.from(shadowRoot?.querySelectorAll('.usa-accordion__button[aria-expanded="true"]') ?? []);

        expect(shadowRoot).toBeTruthy();
        expect(expandedButtons).toHaveLength(1);
        expect(expandedButtons[0]?.textContent).toContain('Personal Details');
    });

    it('keeps the real-USWDS popover story closed by default like the adapter pane', async () => {
        const container = await renderStory(
            <RealUSWDSStory
                definition={contactFormDef}
                componentDocument={popoverComponentDoc}
                showSubmit={false}
            />,
        );

        const host = findShadowHost(container);
        const shadowRoot = host?.shadowRoot;

        expect(shadowRoot).toBeTruthy();
        expect(shadowRoot?.querySelector('.usa-tooltip, .usa-button--outline')).not.toBeNull();
        expect(shadowRoot?.querySelector('.usa-alert--info')).toBeNull();
        expect(shadowRoot?.querySelector('.usa-summary-box')).toBeNull();
    });
});
