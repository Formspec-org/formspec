/** @filedesc Tests for FormspecForm auto-renderer and default components. */
import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { initFormspecEngine, createFormEngine } from 'formspec-engine';
import type { LayoutNode } from 'formspec-layout';
import { FormspecForm } from '../src/renderer';
import { FormspecNode } from '../src/node-renderer';
import { FormspecProvider } from '../src/context';
import type { FieldComponentProps } from '../src/component-map';

beforeAll(async () => {
    await initFormspecEngine();
});

const testDefinition = {
    $formspec: '1.0',
    url: 'https://test.example/form',
    version: '1.0.0',
    status: 'active',
    title: 'Test Form',
    description: 'A test form.',
    name: 'test',
    items: [
        {
            key: 'name',
            type: 'field',
            dataType: 'string',
            label: 'Full Name',
            hint: 'Enter your name.',
        },
        {
            key: 'color',
            type: 'field',
            dataType: 'choice',
            label: 'Favorite Color',
            options: [
                { value: 'red', label: 'Red' },
                { value: 'blue', label: 'Blue' },
            ],
        },
        {
            key: 'agree',
            type: 'field',
            dataType: 'boolean',
            label: 'I agree',
        },
    ],
    binds: [
        { path: 'name', required: 'true' },
    ],
};

function renderInto(element: React.ReactElement): HTMLElement {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    flushSync(() => { root.render(element); });
    return container;
}

// ── FormspecForm auto-renderer ─────────────────────────────────────

describe('FormspecForm', () => {
    it('renders all fields from definition', () => {
        const container = renderInto(
            <FormspecForm definition={testDefinition} />
        );

        // Should find labels for all 3 fields
        const labels = Array.from(container.querySelectorAll('label'));
        const labelTexts = labels.map(l => l.textContent?.replace(/\s*\*$/, '').trim());
        expect(labelTexts).toContain('Full Name');
        expect(labelTexts).toContain('Favorite Color');
        expect(labelTexts).toContain('I agree');
    });

    it('renders text input for string field', () => {
        const container = renderInto(
            <FormspecForm definition={testDefinition} />
        );
        const input = container.querySelector('input[type="text"]');
        expect(input).toBeTruthy();
    });

    it('renders select for choice field', () => {
        const container = renderInto(
            <FormspecForm definition={testDefinition} />
        );
        const select = container.querySelector('select');
        expect(select).toBeTruthy();
        const options = select!.querySelectorAll('option');
        // placeholder + 2 options = 3
        expect(options.length).toBe(3);
    });

    it('renders checkbox for boolean field', () => {
        const container = renderInto(
            <FormspecForm definition={testDefinition} />
        );
        const checkbox = container.querySelector('input[type="checkbox"]');
        expect(checkbox).toBeTruthy();
    });

    it('renders hint text', () => {
        const container = renderInto(
            <FormspecForm definition={testDefinition} />
        );
        expect(container.textContent).toContain('Enter your name.');
    });

    it('shows required indicator', () => {
        const container = renderInto(
            <FormspecForm definition={testDefinition} />
        );
        // Required fields get a * indicator
        const reqSpans = container.querySelectorAll('[aria-hidden="true"]');
        const starTexts = Array.from(reqSpans).map(s => s.textContent?.trim());
        expect(starTexts).toContain('*');
    });

    it('accepts a className prop on root', () => {
        const container = renderInto(
            <FormspecForm definition={testDefinition} className="my-form" />
        );
        expect(container.querySelector('.my-form')).toBeTruthy();
    });
});

// ── Display node rendering ────────────────────────────────────────

describe('display node rendering', () => {
    it('renders Heading node as an h-element with text', () => {
        const engine = createFormEngine(testDefinition);
        const plan: LayoutNode = {
            id: 'root', component: 'Stack', category: 'layout',
            props: {}, cssClasses: [], children: [
                {
                    id: 'heading-1', component: 'Heading', category: 'display',
                    props: { text: 'Section Title' }, cssClasses: [], children: [],
                },
            ],
        };

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        flushSync(() => {
            root.render(
                <FormspecProvider engine={engine}>
                    <FormspecNode node={plan} />
                </FormspecProvider>
            );
        });

        // Should render a heading element with the text
        const heading = container.querySelector('h3');
        expect(heading).toBeTruthy();
        expect(heading!.textContent).toBe('Section Title');
    });

    it('renders Text/Paragraph node as a p element', () => {
        const engine = createFormEngine(testDefinition);
        const plan: LayoutNode = {
            id: 'root', component: 'Stack', category: 'layout',
            props: {}, cssClasses: [], children: [
                {
                    id: 'para-1', component: 'Text', category: 'display',
                    props: { text: 'Some helpful instructions.' }, cssClasses: [], children: [],
                },
            ],
        };

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        flushSync(() => {
            root.render(
                <FormspecProvider engine={engine}>
                    <FormspecNode node={plan} />
                </FormspecProvider>
            );
        });

        const para = container.querySelector('p');
        expect(para).toBeTruthy();
        expect(para!.textContent).toBe('Some helpful instructions.');
    });

    it('renders Divider node as an hr element', () => {
        const engine = createFormEngine(testDefinition);
        const plan: LayoutNode = {
            id: 'root', component: 'Stack', category: 'layout',
            props: {}, cssClasses: [], children: [
                {
                    id: 'divider-1', component: 'Divider', category: 'display',
                    props: {}, cssClasses: [], children: [],
                },
            ],
        };

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        flushSync(() => {
            root.render(
                <FormspecProvider engine={engine}>
                    <FormspecNode node={plan} />
                </FormspecProvider>
            );
        });

        expect(container.querySelector('hr')).toBeTruthy();
    });

    it('renders Alert/Banner node with role="status"', () => {
        const engine = createFormEngine(testDefinition);
        const plan: LayoutNode = {
            id: 'root', component: 'Stack', category: 'layout',
            props: {}, cssClasses: [], children: [
                {
                    id: 'alert-1', component: 'Alert', category: 'display',
                    props: { text: 'Important notice!' }, cssClasses: [], children: [],
                },
            ],
        };

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        flushSync(() => {
            root.render(
                <FormspecProvider engine={engine}>
                    <FormspecNode node={plan} />
                </FormspecProvider>
            );
        });

        const alert = container.querySelector('[role="status"]');
        expect(alert).toBeTruthy();
        expect(alert!.textContent).toBe('Important notice!');
    });

    it('falls back to fieldItem.label when props.text is absent', () => {
        const engine = createFormEngine(testDefinition);
        const plan: LayoutNode = {
            id: 'root', component: 'Stack', category: 'layout',
            props: {}, cssClasses: [], children: [
                {
                    id: 'heading-2', component: 'Heading', category: 'display',
                    props: {}, cssClasses: [], children: [],
                    fieldItem: { key: 'section', label: 'From Field Item' },
                },
            ],
        };

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        flushSync(() => {
            root.render(
                <FormspecProvider engine={engine}>
                    <FormspecNode node={plan} />
                </FormspecProvider>
            );
        });

        const heading = container.querySelector('h3');
        expect(heading).toBeTruthy();
        expect(heading!.textContent).toBe('From Field Item');
    });
});

// ── disabledDisplay: 'protected' ──────────────────────────────────

describe('disabledDisplay protected mode', () => {
    it('renders an irrelevant field as disabled when disabledDisplay is protected', () => {
        const protectedDef = {
            $formspec: '1.0',
            url: 'https://test.example/protected',
            version: '1.0.0',
            status: 'active',
            title: 'Protected Test',
            name: 'protected-test',
            items: [
                { key: 'toggle', type: 'field', dataType: 'boolean', label: 'Toggle' },
                { key: 'secret', type: 'field', dataType: 'string', label: 'Secret Field' },
            ],
            binds: [
                { path: 'secret', relevant: '$toggle', disabledDisplay: 'protected' },
            ],
        };

        const engine = createFormEngine(protectedDef);
        // toggle=false → secret is irrelevant but should still render disabled

        const plan: LayoutNode = {
            id: 'root', component: 'Stack', category: 'layout',
            props: {}, cssClasses: [], children: [
                {
                    id: 'secret-field', component: 'TextInput', category: 'field',
                    props: {}, cssClasses: [], children: [],
                    bindPath: 'secret',
                },
            ],
        };

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        flushSync(() => {
            root.render(
                <FormspecProvider engine={engine}>
                    <FormspecNode node={plan} />
                </FormspecProvider>
            );
        });

        // Field should still be in the DOM (not hidden)
        const field = container.querySelector('[data-name="secret"]');
        expect(field).toBeTruthy();

        // The input should be disabled
        const input = container.querySelector('input[type="text"]');
        expect(input).toBeTruthy();
        expect((input as HTMLInputElement).readOnly).toBe(true);

        // Container should have a disabled indicator class
        expect(field!.classList.contains('formspec-protected')).toBe(true);
    });
});

// ── Group-level relevance ─────────────────────────────────────────

describe('group-level relevance', () => {
    it('hides a group layout node when its relevant bind is false', () => {
        const groupRelDef = {
            $formspec: '1.0',
            url: 'https://test.example/group-rel',
            version: '1.0.0',
            status: 'active',
            title: 'Group Relevance Test',
            name: 'group-rel',
            items: [
                { key: 'showGroup', type: 'field', dataType: 'boolean', label: 'Show group' },
                {
                    key: 'details',
                    type: 'group',
                    label: 'Details',
                    children: [
                        { key: 'info', type: 'field', dataType: 'string', label: 'Info' },
                    ],
                },
            ],
            binds: [
                { path: 'details', relevant: '$showGroup' },
            ],
        };

        const engine = createFormEngine(groupRelDef);
        // showGroup defaults to false → group should be hidden

        const plan: LayoutNode = {
            id: 'root', component: 'Stack', category: 'layout',
            props: {}, cssClasses: [], children: [
                {
                    id: 'toggle-field', component: 'Toggle', category: 'field',
                    props: {}, cssClasses: [], children: [],
                    bindPath: 'showGroup',
                },
                {
                    id: 'details-group', component: 'Card', category: 'layout',
                    props: {}, cssClasses: [], children: [
                        {
                            id: 'info-field', component: 'TextInput', category: 'field',
                            props: {}, cssClasses: [], children: [],
                            bindPath: 'details.info',
                        },
                    ],
                    bindPath: 'details',
                },
            ],
        };

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        flushSync(() => {
            root.render(
                <FormspecProvider engine={engine}>
                    <FormspecNode node={plan} />
                </FormspecProvider>
            );
        });

        // The group container itself should not render when irrelevant
        const groupSection = container.querySelector('section');
        expect(groupSection).toBeNull();
    });

    it('shows a group layout node when its relevant bind is true', () => {
        const groupRelDef = {
            $formspec: '1.0',
            url: 'https://test.example/group-rel2',
            version: '1.0.0',
            status: 'active',
            title: 'Group Relevance Test 2',
            name: 'group-rel2',
            items: [
                { key: 'showGroup', type: 'field', dataType: 'boolean', label: 'Show group' },
                {
                    key: 'details',
                    type: 'group',
                    label: 'Details',
                    children: [
                        { key: 'info', type: 'field', dataType: 'string', label: 'Info' },
                    ],
                },
            ],
            binds: [
                { path: 'details', relevant: '$showGroup' },
            ],
        };

        const engine = createFormEngine(groupRelDef);
        engine.setValue('showGroup', true);

        const plan: LayoutNode = {
            id: 'root', component: 'Stack', category: 'layout',
            props: {}, cssClasses: [], children: [
                {
                    id: 'details-group', component: 'Card', category: 'layout',
                    props: {}, cssClasses: [], children: [
                        {
                            id: 'info-field', component: 'TextInput', category: 'field',
                            props: {}, cssClasses: [], children: [],
                            bindPath: 'details.info',
                        },
                    ],
                    bindPath: 'details',
                },
            ],
        };

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        flushSync(() => {
            root.render(
                <FormspecProvider engine={engine}>
                    <FormspecNode node={plan} />
                </FormspecProvider>
            );
        });

        // details group should be visible (showGroup = true)
        const infoField = container.querySelector('[data-name="details.info"]');
        expect(infoField).toBeTruthy();
    });
});

// ── Accessibility ─────────────────────────────────────────────────

describe('DefaultField accessibility', () => {
    it('does not render role="alert" when there is no error', () => {
        // Use a definition without required fields so no errors on initial render
        const noRequiredDef = {
            $formspec: '1.0',
            url: 'https://test.example/a11y',
            version: '1.0.0',
            status: 'active',
            title: 'A11y Test',
            name: 'a11y-test',
            items: [
                { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
                { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
            ],
        };

        const container = renderInto(
            <FormspecForm definition={noRequiredDef} />
        );

        // No errors initially — role="alert" should not be in the DOM
        const alerts = container.querySelectorAll('[role="alert"]');
        expect(alerts.length).toBe(0);
    });
});

// ── Component map overrides ────────────────────────────────────────

describe('component map overrides', () => {
    it('uses custom field component when provided', () => {
        const CustomTextInput = ({ field, node }: FieldComponentProps) => (
            <div data-testid="custom-text">{field.label}</div>
        );

        const container = renderInto(
            <FormspecForm
                definition={testDefinition}
                components={{ fields: { TextInput: CustomTextInput } }}
            />
        );

        expect(container.querySelector('[data-testid="custom-text"]')).toBeTruthy();
        expect(container.querySelector('[data-testid="custom-text"]')!.textContent).toBe('Full Name');
    });

    it('falls back to default for non-overridden components', () => {
        const CustomTextInput = ({ field }: FieldComponentProps) => (
            <div data-testid="custom">{field.label}</div>
        );

        const container = renderInto(
            <FormspecForm
                definition={testDefinition}
                components={{ fields: { TextInput: CustomTextInput } }}
            />
        );

        // Select should still render with default (has <select> element)
        expect(container.querySelector('select')).toBeTruthy();
    });
});

// ── SubmitButton ──────────────────────────────────────────────────

describe('SubmitButton', () => {
    it('renders a submit button when onSubmit is provided', () => {
        const onSubmit = () => {};
        const container = renderInto(
            <FormspecForm definition={testDefinition} onSubmit={onSubmit} />
        );

        const button = container.querySelector('button[type="submit"]');
        expect(button).toBeTruthy();
        expect(button!.textContent).toBe('Submit');
    });

    it('does not render a submit button when onSubmit is absent', () => {
        const container = renderInto(
            <FormspecForm definition={testDefinition} />
        );

        const button = container.querySelector('button[type="submit"]');
        expect(button).toBeNull();
    });

    it('calls onSubmit with response and validationReport on click', () => {
        let submitted: any = null;
        const onSubmit = (result: any) => { submitted = result; };

        const container = renderInto(
            <FormspecForm definition={testDefinition} onSubmit={onSubmit} />
        );

        const button = container.querySelector('button[type="submit"]') as HTMLButtonElement;
        expect(button).toBeTruthy();

        flushSync(() => { button.click(); });

        expect(submitted).not.toBeNull();
        expect(submitted).toHaveProperty('response');
        expect(submitted).toHaveProperty('validationReport');
        expect(submitted.validationReport).toHaveProperty('valid');
    });
});

// ── Conditional rendering (when) ─────────────────────────────────

const conditionalDefinition = {
    $formspec: '1.0',
    url: 'https://test.example/conditional',
    version: '1.0.0',
    status: 'active',
    title: 'Conditional Form',
    name: 'conditional',
    items: [
        {
            key: 'showDetails',
            type: 'field',
            dataType: 'boolean',
            label: 'Show details?',
        },
        {
            key: 'details',
            type: 'field',
            dataType: 'string',
            label: 'Details',
        },
    ],
};

describe('conditional rendering (when)', () => {
    it('hides a layout node when its "when" expression is falsy', () => {
        const engine = createFormEngine(conditionalDefinition);

        // Craft a layout plan with a "when" on the details field wrapper
        const layoutPlan: LayoutNode = {
            id: 'root',
            component: 'Stack',
            category: 'layout',
            props: {},
            cssClasses: [],
            children: [
                {
                    id: 'show-field',
                    component: 'Toggle',
                    category: 'field',
                    props: {},
                    cssClasses: [],
                    children: [],
                    bindPath: 'showDetails',
                },
                {
                    id: 'conditional-wrapper',
                    component: 'Stack',
                    category: 'layout',
                    props: {},
                    cssClasses: [],
                    children: [
                        {
                            id: 'details-field',
                            component: 'TextInput',
                            category: 'field',
                            props: {},
                            cssClasses: [],
                            children: [],
                            bindPath: 'details',
                        },
                    ],
                    when: '$showDetails',
                },
            ],
        };

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        flushSync(() => {
            root.render(
                <FormspecProvider engine={engine}>
                    <FormspecNode node={layoutPlan} />
                </FormspecProvider>
            );
        });

        // showDetails defaults to false, so the details field should be hidden
        const detailsInput = container.querySelector('[data-name="details"]');
        expect(detailsInput).toBeNull();
    });

    it('shows a layout node when its "when" expression is truthy', () => {
        const engine = createFormEngine(conditionalDefinition);
        engine.setValue('showDetails', true);

        const layoutPlan: LayoutNode = {
            id: 'root',
            component: 'Stack',
            category: 'layout',
            props: {},
            cssClasses: [],
            children: [
                {
                    id: 'conditional-wrapper',
                    component: 'Stack',
                    category: 'layout',
                    props: {},
                    cssClasses: [],
                    children: [
                        {
                            id: 'details-field',
                            component: 'TextInput',
                            category: 'field',
                            props: {},
                            cssClasses: [],
                            children: [],
                            bindPath: 'details',
                        },
                    ],
                    when: '$showDetails',
                },
            ],
        };

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        flushSync(() => {
            root.render(
                <FormspecProvider engine={engine}>
                    <FormspecNode node={layoutPlan} />
                </FormspecProvider>
            );
        });

        // showDetails is true, so the details field should be visible
        const detailsInput = container.querySelector('[data-name="details"]');
        expect(detailsInput).toBeTruthy();
    });
});

// ── Repeat group rendering ───────────────────────────────────────

const repeatDefinition = {
    $formspec: '1.0',
    url: 'https://test.example/repeat',
    version: '1.0.0',
    status: 'active',
    title: 'Repeat Form',
    name: 'repeat',
    items: [
        {
            key: 'members',
            type: 'group',
            label: 'Team Members',
            repeatable: true,
            children: [
                {
                    key: 'memberName',
                    type: 'field',
                    dataType: 'string',
                    label: 'Member Name',
                },
            ],
        },
    ],
};

describe('repeat group rendering', () => {
    it('renders an add button for repeat groups', () => {
        const container = renderInto(
            <FormspecForm definition={repeatDefinition} />
        );

        const addBtn = container.querySelector('.formspec-repeat-add');
        expect(addBtn).toBeTruthy();
        expect(addBtn!.textContent).toContain('Add');
    });

    it('renders instances when repeat count > 0', () => {
        // Engine initializes repeatable groups with minRepeat ?? 1, so count starts at 1
        const engine = createFormEngine(repeatDefinition);

        const layoutPlan: LayoutNode = {
            id: 'root',
            component: 'Stack',
            category: 'layout',
            props: {},
            cssClasses: [],
            children: [
                {
                    id: 'members-group',
                    component: 'Stack',
                    category: 'layout',
                    props: { title: 'Team Members', bind: 'members' },
                    cssClasses: [],
                    children: [
                        {
                            id: 'memberName-field',
                            component: 'TextInput',
                            category: 'field',
                            props: {},
                            cssClasses: [],
                            children: [],
                            bindPath: 'members[0].memberName',
                        },
                    ],
                    bindPath: 'members',
                    repeatGroup: 'members',
                    repeatPath: 'members',
                    isRepeatTemplate: true,
                    scopeChange: true,
                },
            ],
        };

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        flushSync(() => {
            root.render(
                <FormspecProvider engine={engine}>
                    <FormspecNode node={layoutPlan} />
                </FormspecProvider>
            );
        });

        // Should have one instance with a member name field
        const instances = container.querySelectorAll('.formspec-repeat-instance');
        expect(instances.length).toBe(1);

        // Should have a remove button per instance
        const removeBtn = container.querySelector('.formspec-repeat-remove');
        expect(removeBtn).toBeTruthy();
    });

    it('renders multiple instances after adding', () => {
        const engine = createFormEngine(repeatDefinition);
        // Engine starts with 1 instance; add a second
        engine.addRepeatInstance('members');

        const layoutPlan: LayoutNode = {
            id: 'root',
            component: 'Stack',
            category: 'layout',
            props: {},
            cssClasses: [],
            children: [
                {
                    id: 'members-group',
                    component: 'Stack',
                    category: 'layout',
                    props: { title: 'Team Members', bind: 'members' },
                    cssClasses: [],
                    children: [
                        {
                            id: 'memberName-field',
                            component: 'TextInput',
                            category: 'field',
                            props: {},
                            cssClasses: [],
                            children: [],
                            bindPath: 'members[0].memberName',
                        },
                    ],
                    bindPath: 'members',
                    repeatGroup: 'members',
                    repeatPath: 'members',
                    isRepeatTemplate: true,
                    scopeChange: true,
                },
            ],
        };

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        flushSync(() => {
            root.render(
                <FormspecProvider engine={engine}>
                    <FormspecNode node={layoutPlan} />
                </FormspecProvider>
            );
        });

        const instances = container.querySelectorAll('.formspec-repeat-instance');
        expect(instances.length).toBe(2);

        // Each instance should have a remove button
        const removeBtns = container.querySelectorAll('.formspec-repeat-remove');
        expect(removeBtns.length).toBe(2);

        // Should have fields bound to correct indexed paths
        const fields = container.querySelectorAll('[data-name]');
        const paths = Array.from(fields).map((el) => el.getAttribute('data-name'));
        expect(paths).toContain('members[0].memberName');
        expect(paths).toContain('members[1].memberName');
    });

    it('renders add button with group label', () => {
        const engine = createFormEngine(repeatDefinition);

        const layoutPlan: LayoutNode = {
            id: 'root',
            component: 'Stack',
            category: 'layout',
            props: {},
            cssClasses: [],
            children: [
                {
                    id: 'members-group',
                    component: 'Stack',
                    category: 'layout',
                    props: { title: 'Team Members', bind: 'members' },
                    cssClasses: [],
                    children: [],
                    bindPath: 'members',
                    repeatGroup: 'members',
                    repeatPath: 'members',
                    isRepeatTemplate: true,
                    scopeChange: true,
                },
            ],
        };

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        flushSync(() => {
            root.render(
                <FormspecProvider engine={engine}>
                    <FormspecNode node={layoutPlan} />
                </FormspecProvider>
            );
        });

        const addBtn = container.querySelector('.formspec-repeat-add');
        expect(addBtn).toBeTruthy();
        expect(addBtn!.textContent).toContain('Team Members');
    });
});
