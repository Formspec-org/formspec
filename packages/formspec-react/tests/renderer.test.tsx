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
