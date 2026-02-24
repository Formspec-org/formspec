import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { minimalComponentDoc } from './helpers/engine-fixtures';

let FormspecRender: any;

beforeAll(async () => {
    const mod = await import('../src/index');
    FormspecRender = mod.FormspecRender;
    if (!customElements.get('formspec-render')) {
        customElements.define('formspec-render', FormspecRender);
    }
});

function renderWithTree(tree: any) {
    const el = document.createElement('formspec-render') as any;
    document.body.appendChild(el);
    el.componentDocument = minimalComponentDoc(tree);
    el.definition = {
        $formspec: '1.0',
        url: 'urn:test:form',
        version: '1.0.0',
        title: 'Test',
        items: [],
    };
    return el;
}

describe('Wizard plugin', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('first panel visible, others hidden', () => {
        const el = renderWithTree({
            component: 'Wizard',
            children: [
                { component: 'Text', text: 'Step 1' },
                { component: 'Text', text: 'Step 2' },
                { component: 'Text', text: 'Step 3' },
            ],
        });
        const panels = el.querySelectorAll('.formspec-wizard-panel');
        expect(panels.length).toBe(3);
        expect(panels[0].classList.contains('formspec-hidden')).toBe(false);
        expect(panels[1].classList.contains('formspec-hidden')).toBe(true);
        expect(panels[2].classList.contains('formspec-hidden')).toBe(true);
    });

    it('Next advances to next panel', () => {
        const el = renderWithTree({
            component: 'Wizard',
            children: [
                { component: 'Text', text: 'Step 1' },
                { component: 'Text', text: 'Step 2' },
            ],
        });
        const nextBtn = el.querySelector('.formspec-wizard-next') as HTMLButtonElement;
        nextBtn.click();
        const panels = el.querySelectorAll('.formspec-wizard-panel');
        expect(panels[0].classList.contains('formspec-hidden')).toBe(true);
        expect(panels[1].classList.contains('formspec-hidden')).toBe(false);
    });

    it('Previous goes back', () => {
        const el = renderWithTree({
            component: 'Wizard',
            children: [
                { component: 'Text', text: 'Step 1' },
                { component: 'Text', text: 'Step 2' },
            ],
        });
        const nextBtn = el.querySelector('.formspec-wizard-next') as HTMLButtonElement;
        const prevBtn = el.querySelector('.formspec-wizard-prev') as HTMLButtonElement;
        nextBtn.click();
        prevBtn.click();
        const panels = el.querySelectorAll('.formspec-wizard-panel');
        expect(panels[0].classList.contains('formspec-hidden')).toBe(false);
        expect(panels[1].classList.contains('formspec-hidden')).toBe(true);
    });

    it('Previous hidden at step 0', () => {
        const el = renderWithTree({
            component: 'Wizard',
            children: [
                { component: 'Text', text: 'Step 1' },
                { component: 'Text', text: 'Step 2' },
            ],
        });
        const prevBtn = el.querySelector('.formspec-wizard-prev') as HTMLButtonElement;
        expect(prevBtn.classList.contains('formspec-hidden')).toBe(true);
    });

    it('Next disabled and shows "Finish" at last step', () => {
        const el = renderWithTree({
            component: 'Wizard',
            children: [
                { component: 'Text', text: 'Step 1' },
                { component: 'Text', text: 'Step 2' },
            ],
        });
        const nextBtn = el.querySelector('.formspec-wizard-next') as HTMLButtonElement;
        nextBtn.click(); // go to last step
        expect(nextBtn.disabled).toBe(true);
        expect(nextBtn.textContent).toBe('Finish');
    });

    it('progress indicator marks active/completed steps', () => {
        const el = renderWithTree({
            component: 'Wizard',
            children: [
                { component: 'Text', text: 'Step 1' },
                { component: 'Text', text: 'Step 2' },
                { component: 'Text', text: 'Step 3' },
            ],
        });
        const nextBtn = el.querySelector('.formspec-wizard-next') as HTMLButtonElement;
        nextBtn.click(); // go to step 2

        const steps = el.querySelectorAll('.formspec-wizard-step');
        expect(steps[0].classList.contains('formspec-wizard-step--completed')).toBe(true);
        expect(steps[1].classList.contains('formspec-wizard-step--active')).toBe(true);
        expect(steps[2].classList.contains('formspec-wizard-step--completed')).toBe(false);
        expect(steps[2].classList.contains('formspec-wizard-step--active')).toBe(false);
    });

    it('skip button present when allowSkip = true', () => {
        const el = renderWithTree({
            component: 'Wizard',
            allowSkip: true,
            children: [
                { component: 'Text', text: 'Step 1' },
                { component: 'Text', text: 'Step 2' },
            ],
        });
        expect(el.querySelector('.formspec-wizard-skip')).not.toBeNull();
    });

    it('skip button absent when allowSkip not set', () => {
        const el = renderWithTree({
            component: 'Wizard',
            children: [
                { component: 'Text', text: 'Step 1' },
                { component: 'Text', text: 'Step 2' },
            ],
        });
        expect(el.querySelector('.formspec-wizard-skip')).toBeNull();
    });
});

describe('Tabs plugin', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('first tab active and first panel visible by default', () => {
        const el = renderWithTree({
            component: 'Tabs',
            tabLabels: ['Tab A', 'Tab B'],
            children: [
                { component: 'Text', text: 'Panel A' },
                { component: 'Text', text: 'Panel B' },
            ],
        });
        const buttons = el.querySelectorAll('.formspec-tab');
        expect(buttons[0].classList.contains('formspec-tab--active')).toBe(true);
        expect(buttons[1].classList.contains('formspec-tab--active')).toBe(false);

        const panels = el.querySelectorAll('.formspec-tab-panel');
        expect(panels[0].classList.contains('formspec-hidden')).toBe(false);
        expect(panels[1].classList.contains('formspec-hidden')).toBe(true);
    });

    it('clicking tab shows its panel and hides others', () => {
        const el = renderWithTree({
            component: 'Tabs',
            tabLabels: ['Tab A', 'Tab B'],
            children: [
                { component: 'Text', text: 'Panel A' },
                { component: 'Text', text: 'Panel B' },
            ],
        });
        const buttons = el.querySelectorAll('.formspec-tab');
        (buttons[1] as HTMLButtonElement).click();

        const panels = el.querySelectorAll('.formspec-tab-panel');
        expect(panels[0].classList.contains('formspec-hidden')).toBe(true);
        expect(panels[1].classList.contains('formspec-hidden')).toBe(false);
        expect(buttons[0].classList.contains('formspec-tab--active')).toBe(false);
        expect(buttons[1].classList.contains('formspec-tab--active')).toBe(true);
    });

    it('defaultTab honors specified index', () => {
        const el = renderWithTree({
            component: 'Tabs',
            defaultTab: 1,
            tabLabels: ['Tab A', 'Tab B'],
            children: [
                { component: 'Text', text: 'Panel A' },
                { component: 'Text', text: 'Panel B' },
            ],
        });
        const panels = el.querySelectorAll('.formspec-tab-panel');
        expect(panels[0].classList.contains('formspec-hidden')).toBe(true);
        expect(panels[1].classList.contains('formspec-hidden')).toBe(false);

        const buttons = el.querySelectorAll('.formspec-tab');
        expect(buttons[1].classList.contains('formspec-tab--active')).toBe(true);
    });

    it('position bottom renders panels before tab bar', () => {
        const el = renderWithTree({
            component: 'Tabs',
            position: 'bottom',
            tabLabels: ['Tab A'],
            children: [{ component: 'Text', text: 'Panel A' }],
        });
        const tabs = el.querySelector('.formspec-tabs') as HTMLElement;
        const children = Array.from(tabs.children);
        const panelIndex = children.findIndex(c => c.classList.contains('formspec-tab-panels'));
        const barIndex = children.findIndex(c => c.classList.contains('formspec-tab-bar'));
        expect(panelIndex).toBeLessThan(barIndex);
    });
});

describe('Accordion plugin', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('defaultOpen opens specified section', () => {
        const el = renderWithTree({
            component: 'Accordion',
            defaultOpen: 1,
            labels: ['Section A', 'Section B', 'Section C'],
            children: [
                { component: 'Text', text: 'A' },
                { component: 'Text', text: 'B' },
                { component: 'Text', text: 'C' },
            ],
        });
        const details = el.querySelectorAll('.formspec-accordion-item') as NodeListOf<HTMLDetailsElement>;
        expect(details[0].open).toBe(false);
        expect(details[1].open).toBe(true);
        expect(details[2].open).toBe(false);
    });

    it('exclusive mode: opening one closes others', () => {
        const el = renderWithTree({
            component: 'Accordion',
            defaultOpen: 0,
            labels: ['A', 'B'],
            children: [
                { component: 'Text', text: 'A' },
                { component: 'Text', text: 'B' },
            ],
        });
        const details = el.querySelectorAll('.formspec-accordion-item') as NodeListOf<HTMLDetailsElement>;
        expect(details[0].open).toBe(true);

        // Simulate opening second — happy-dom dispatches toggle event on attribute set
        details[1].open = true;
        details[1].dispatchEvent(new Event('toggle'));

        expect(details[0].open).toBe(false);
        expect(details[1].open).toBe(true);
    });

    it('allowMultiple keeps all open', () => {
        const el = renderWithTree({
            component: 'Accordion',
            allowMultiple: true,
            defaultOpen: 0,
            labels: ['A', 'B'],
            children: [
                { component: 'Text', text: 'A' },
                { component: 'Text', text: 'B' },
            ],
        });
        const details = el.querySelectorAll('.formspec-accordion-item') as NodeListOf<HTMLDetailsElement>;
        details[1].open = true;
        details[1].dispatchEvent(new Event('toggle'));

        expect(details[0].open).toBe(true);
        expect(details[1].open).toBe(true);
    });
});
