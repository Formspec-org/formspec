import { describe, it, expect, beforeAll, afterEach } from 'vitest';

let FormspecRender: any;

beforeAll(async () => {
    const mod = await import('../../src/index');
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

// ── progressive-component-rendering tests ─────────────────────────────────────

describe('layout components — Divider', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('renders unlabeled and labeled dividers', () => {
        const el = renderWith(
            [],
            {
                component: 'Stack',
                children: [
                    { component: 'Divider' },
                    { component: 'Divider', label: 'Section Break' },
                ],
            },
        );
        const dividers = el.querySelectorAll('.formspec-divider');
        expect(dividers.length).toBe(2);
        const labelEl = dividers[1].querySelector('.formspec-divider-label') as HTMLElement;
        expect(labelEl).not.toBeNull();
        expect(labelEl.textContent).toBe('Section Break');
    });
});

describe('layout components — Collapsible', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('renders collapsible content as open when defaultOpen is true', () => {
        const el = renderWith(
            [{ key: 'x', type: 'field', dataType: 'string', label: 'X' }],
            {
                component: 'Stack',
                children: [
                    {
                        component: 'Collapsible',
                        title: 'More Details',
                        defaultOpen: true,
                        children: [{ component: 'TextInput', bind: 'x' }],
                    },
                ],
            },
        );
        const details = el.querySelector('.formspec-collapsible') as HTMLDetailsElement;
        expect(details).not.toBeNull();
        expect(details.open).toBe(true);
        const summary = details.querySelector('summary') as HTMLElement;
        expect(summary.textContent).toBe('More Details');
        const content = details.querySelector('.formspec-collapsible-content') as HTMLElement;
        expect(content.querySelector('input')).not.toBeNull();
    });
});

describe('layout components — Panel', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('renders panel chrome and title when Panel content is mounted', () => {
        const el = renderWith(
            [],
            {
                component: 'Panel',
                title: 'Important Info',
                children: [{ component: 'Text', text: 'Panel content' }],
            },
        );
        const panel = el.querySelector('.formspec-panel') as HTMLElement;
        expect(panel).not.toBeNull();
        const header = panel.querySelector('.formspec-panel-header') as HTMLElement;
        expect(header.textContent).toBe('Important Info');
        const body = panel.querySelector('.formspec-panel-body') as HTMLElement;
        expect(body.textContent).toContain('Panel content');
    });
});

describe('layout components — Accordion defaultOpen', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('opens only the default section when Accordion is initialized', () => {
        const el = renderWith(
            [],
            {
                component: 'Accordion',
                labels: ['Section 1', 'Section 2', 'Section 3'],
                defaultOpen: 0,
                children: [
                    { component: 'Text', text: 'Content 1' },
                    { component: 'Text', text: 'Content 2' },
                    { component: 'Text', text: 'Content 3' },
                ],
            },
        );
        const items = el.querySelectorAll('.formspec-accordion-item') as NodeListOf<HTMLDetailsElement>;
        expect(items.length).toBe(3);
        expect(items[0].open).toBe(true);
        const summary = items[0].querySelector('summary') as HTMLElement;
        expect(summary.textContent).toBe('Section 1');
        expect(items[1].open).toBe(false);
        expect(items[2].open).toBe(false);
    });
});

describe('layout components — Accordion repeats', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('opens the newest repeat instance so its remove control is immediately available', () => {
        const el = renderWith(
            [
                {
                    key: 'members',
                    type: 'group',
                    label: 'Members',
                    repeatable: true,
                    children: [
                        { key: 'memberName', type: 'field', dataType: 'string', label: 'Member Name' },
                    ],
                },
            ],
            {
                component: 'Stack',
                children: [
                    {
                        component: 'Accordion',
                        bind: 'members',
                        children: [{ component: 'TextInput', bind: 'memberName' }],
                    },
                ],
            },
        );

        const addButton = Array.from(el.querySelectorAll('button')).find(button => button.textContent === 'Add Members');
        expect(addButton).not.toBeUndefined();
        addButton!.click();

        const items = el.querySelectorAll('.formspec-accordion-item') as NodeListOf<HTMLDetailsElement>;
        expect(items.length).toBeGreaterThan(0);
        expect(items[items.length - 1].open).toBe(true);
        expect(items[items.length - 1].textContent).toContain('Remove Members');
    });
});

describe('layout components — FileUpload', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('renders drop zone and accept attribute when dragDrop and accept are configured', () => {
        const el = renderWith(
            [{ key: 'doc', type: 'field', dataType: 'attachment', label: 'Document' }],
            {
                component: 'Page',
                children: [{ component: 'FileUpload', bind: 'doc', accept: '.pdf,.doc', dragDrop: true }],
            },
        );
        const dropZone = el.querySelector('.formspec-drop-zone') as HTMLElement;
        expect(dropZone).not.toBeNull();
        expect(dropZone.textContent).toContain('Drop files here');
        const fileInput = el.querySelector('.formspec-file-upload input[type="file"]') as HTMLInputElement;
        expect(fileInput.getAttribute('accept')).toBe('.pdf,.doc');
    });
});

describe('layout components — Signature', () => {
    beforeAll(() => {
        // Mock getContext for happy-dom
        HTMLCanvasElement.prototype.getContext = function(type: string) {
            if (type === '2d') {
                return {
                    scale: () => {},
                    beginPath: () => {},
                    moveTo: () => {},
                    lineTo: () => {},
                    stroke: () => {},
                    clearRect: () => {},
                    canvas: this,
                } as any;
            }
            return null;
        };
    });

    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('renders signature canvas and clear control when Signature is mounted', () => {
        const el = renderWith(
            [{ key: 'sig', type: 'field', dataType: 'attachment', label: 'Signature' }],
            {
                component: 'Page',
                children: [{ component: 'Signature', bind: 'sig', height: 150, strokeColor: '#0000ff' }],
            },
        );
        const canvas = el.querySelector('.formspec-signature-canvas') as HTMLCanvasElement;
        expect(canvas).not.toBeNull();
        
        // Mock bounding rect because happy-dom returns zeros
        canvas.getBoundingClientRect = () => ({
            width: 300,
            height: 150,
            top: 0,
            left: 0,
            right: 300,
            bottom: 150,
            x: 0,
            y: 0,
            toJSON: () => {},
        });
        
        // Trigger resize logic manually since it happened on mount with 0/0
        // Or just check that it was rendered. The component calls resizeCanvas in mount.
        // Actually, let's re-render or just check the DOM presence.
        // The component's resizeCanvas uses the rect from the canvas element.
        // Since we want to test that the component *respects* the height prop:
        expect(canvas).not.toBeNull();
        const clearBtn = el.querySelector('.formspec-signature-clear') as HTMLButtonElement;
        expect(clearBtn).not.toBeNull();
        expect(clearBtn.textContent).toBe('Clear');
    });
});

describe('layout components — ProgressBar (static)', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('renders progress value and percentage text when showPercent is enabled', () => {
        const el = renderWith(
            [],
            {
                component: 'Stack',
                children: [{ component: 'ProgressBar', value: 65, max: 100, showPercent: true }],
            },
        );
        const progress = el.querySelector('.formspec-progress-bar progress') as HTMLProgressElement;
        expect(progress).not.toBeNull();
        expect(progress.max).toBe(100);
        expect(progress.value).toBe(65);
        const percent = el.querySelector('.formspec-progress-percent') as HTMLElement;
        expect(percent.textContent).toBe('65%');
    });
});

// ── renderer-parity-gaps tests (task 4.5) ────────────────────────────────────

describe('layout components — Popover triggerBind', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('falls back to triggerLabel when field is empty', () => {
        const el = renderWith(
            [{ key: 'itemDesc', type: 'field', dataType: 'string', label: 'Item Desc' }],
            {
                component: 'Stack',
                children: [
                    {
                        component: 'Popover',
                        triggerBind: 'itemDesc',
                        triggerLabel: 'Line Item Details',
                        placement: 'left',
                        children: [{ component: 'Text', text: 'Details content' }],
                    },
                ],
            },
        );
        const trigger = el.querySelector('.formspec-popover-trigger') as HTMLButtonElement;
        expect(trigger).not.toBeNull();
        // Field is empty/null → should show fallback triggerLabel
        expect(trigger.textContent).toBe('Line Item Details');
    });

    it('shows field value as trigger text when triggerBind has a value', () => {
        const el = renderWith(
            [{ key: 'itemDesc', type: 'field', dataType: 'string', label: 'Item Desc' }],
            {
                component: 'Stack',
                children: [
                    {
                        component: 'Popover',
                        triggerBind: 'itemDesc',
                        triggerLabel: 'Line Item Details',
                        placement: 'left',
                        children: [{ component: 'Text', text: 'Details content' }],
                    },
                ],
            },
        );
        const engine = el.getEngine();
        engine.setValue('itemDesc', 'Office supplies');
        const trigger = el.querySelector('.formspec-popover-trigger') as HTMLButtonElement;
        expect(trigger.textContent).toBe('Office supplies');
    });
});

describe('layout components — Grid columns', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('sets inline gridTemplateColumns style when columns is a string', () => {
        const el = renderWith(
            [],
            {
                component: 'Grid',
                columns: '1fr 2fr 1fr',
                children: [
                    { component: 'Text', text: 'A' },
                    { component: 'Text', text: 'B' },
                    { component: 'Text', text: 'C' },
                ],
            },
        );
        const grid = el.querySelector('.formspec-grid') as HTMLElement;
        expect(grid).not.toBeNull();
        expect(grid.style.gridTemplateColumns).toBe('1fr 2fr 1fr');
    });

    it('uses data-columns attribute when columns is a number', () => {
        const el = renderWith(
            [],
            {
                component: 'Grid',
                columns: 3,
                children: [
                    { component: 'Text', text: 'A' },
                    { component: 'Text', text: 'B' },
                    { component: 'Text', text: 'C' },
                ],
            },
        );
        const grid = el.querySelector('.formspec-grid') as HTMLElement;
        expect(grid).not.toBeNull();
        expect(grid.dataset.columns).toBe('3');
    });
});

describe('layout components — Stack horizontal', () => {
    afterEach(() => {
        document.body.querySelectorAll('formspec-render').forEach(el => el.remove());
    });

    it('applies horizontal class when direction is horizontal', () => {
        const el = renderWith(
            [],
            {
                component: 'Stack',
                direction: 'horizontal',
                children: [
                    { component: 'Text', text: 'A' },
                    { component: 'Text', text: 'B' },
                ],
            },
        );
        expect(el.querySelector('.formspec-stack--horizontal')).not.toBeNull();
    });
});
