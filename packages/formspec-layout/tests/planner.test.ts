import { describe, it, expect, beforeEach } from 'vitest';
import {
    planComponentTree,
    planDefinitionFallback,
    resetNodeIdCounter,
    type PlanContext,
    type LayoutNode,
} from '../src/index';

function makeCtx(overrides: Partial<PlanContext> = {}): PlanContext {
    return {
        items: [],
        findItem: () => null,
        ...overrides,
    };
}

function findItems(items: any[], key: string): any | null {
    for (const item of items) {
        if (item.key === key) return item;
        if (item.children) {
            const found = findItems(item.children, key);
            if (found) return found;
        }
    }
    return null;
}

beforeEach(() => {
    resetNodeIdCounter();
});

// ── planComponentTree ────────────────────────────────────────────────

describe('planComponentTree', () => {
    it('plans a simple Stack with children', () => {
        const tree = {
            component: 'Stack',
            gap: '16px',
            children: [
                { component: 'Heading', level: 2, text: 'Title' },
                { component: 'TextInput', bind: 'name' },
            ],
        };

        const items = [
            { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
        ];
        const ctx = makeCtx({
            items,
            findItem: (k) => findItems(items, k),
        });

        const node = planComponentTree(tree, ctx);

        expect(node.component).toBe('Stack');
        expect(node.category).toBe('layout');
        expect(node.props.gap).toBe('16px');
        expect(node.children).toHaveLength(2);

        expect(node.children[0].component).toBe('Heading');
        expect(node.children[0].category).toBe('display');
        expect(node.children[0].props.level).toBe(2);

        expect(node.children[1].component).toBe('TextInput');
        expect(node.children[1].category).toBe('field');
        expect(node.children[1].bindPath).toBe('name');
        expect(node.children[1].fieldItem).toEqual({
            key: 'name',
            label: 'Name',
            hint: undefined,
            dataType: 'string',
        });
    });

    it('generates unique IDs for each node', () => {
        const tree = {
            component: 'Stack',
            children: [
                { component: 'TextInput', bind: 'a' },
                { component: 'TextInput', bind: 'b' },
            ],
        };
        const ctx = makeCtx();
        const node = planComponentTree(tree, ctx);

        const ids = [node.id, node.children[0].id, node.children[1].id];
        expect(new Set(ids).size).toBe(3);
    });

    it('resolves token values in gap and style', () => {
        const tree = {
            component: 'Stack',
            gap: '$token.space.lg',
            style: { padding: '$token.space.md' },
        };
        const ctx = makeCtx({
            componentDocument: { tokens: { 'space.lg': '32px' } },
            theme: { tokens: { 'space.md': '16px' } },
        });

        const node = planComponentTree(tree, ctx);
        expect(node.props.gap).toBe('32px');
        expect(node.style).toEqual({ padding: '16px' });
    });

    it('resolves responsive overrides', () => {
        const tree = {
            component: 'Columns',
            widths: ['3fr', '1fr'],
            responsive: { sm: { widths: ['1fr'] } },
        };
        const ctx = makeCtx({ activeBreakpoint: 'sm' });
        const node = planComponentTree(tree, ctx);
        expect(node.props.widths).toEqual(['1fr']);
    });

    it('preserves when condition as marker', () => {
        const tree = {
            component: 'Text',
            text: 'Hello',
            when: "$orgType = 'nonprofit'",
            fallback: 'N/A',
        };
        const ctx = makeCtx();
        const node = planComponentTree(tree, ctx);

        expect(node.when).toBe("$orgType = 'nonprofit'");
        expect(node.whenPrefix).toBe('');
        expect(node.fallback).toBe('N/A');
    });

    it('marks repeat groups as templates', () => {
        const tree = {
            component: 'Stack',
            bind: 'items',
            children: [
                { component: 'TextInput', bind: 'description' },
            ],
        };
        const items = [
            {
                key: 'items',
                type: 'group',
                repeatable: true,
                children: [
                    { key: 'description', type: 'field', dataType: 'string', label: 'Description' },
                ],
            },
        ];
        const ctx = makeCtx({
            items,
            findItem: (k) => findItems(items, k),
        });

        const node = planComponentTree(tree, ctx);
        expect(node.repeatGroup).toBe('items');
        expect(node.repeatPath).toBe('items');
        expect(node.isRepeatTemplate).toBe(true);
        expect(node.children[0].bindPath).toBe('items[0].description');
    });

    it('expands custom components', () => {
        const tree = {
            component: 'ContactField',
            params: { field: 'contactName' },
        };
        const ctx = makeCtx({
            componentDocument: {
                components: {
                    ContactField: {
                        params: ['field'],
                        tree: {
                            component: 'Stack',
                            children: [
                                { component: 'TextInput', bind: '{field}' },
                            ],
                        },
                    },
                },
            },
        });

        const node = planComponentTree(tree, ctx);
        expect(node.component).toBe('Stack');
        expect(node.children[0].component).toBe('TextInput');
        expect(node.children[0].bindPath).toBe('contactName');
    });

    it('detects recursive custom component expansion', () => {
        const tree = { component: 'Loop' };
        const ctx = makeCtx({
            componentDocument: {
                components: {
                    Loop: {
                        tree: { component: 'Loop' },
                    },
                },
            },
        });

        const node = planComponentTree(tree, ctx);
        expect(node.component).toBe('Text');
        expect(node.props.text).toContain('Recursive');
    });

    it('resolves CSS classes from comp and theme cascade', () => {
        const tree = {
            component: 'TextInput',
            bind: 'email',
            cssClass: 'custom-class',
        };
        const items = [
            { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
        ];
        const ctx = makeCtx({
            items,
            findItem: (k) => findItems(items, k),
            theme: {
                selectors: [
                    { match: { type: 'field' }, apply: { cssClass: 'theme-field' } },
                ],
            },
        });

        const node = planComponentTree(tree, ctx);
        expect(node.cssClasses).toContain('custom-class');
        expect(node.cssClasses).toContain('theme-field');
    });

    it('propagates prefix for nested groups', () => {
        const tree = {
            component: 'Stack',
            bind: 'outer',
            children: [
                { component: 'TextInput', bind: 'inner' },
            ],
        };
        const items = [
            {
                key: 'outer',
                type: 'group',
                children: [
                    { key: 'inner', type: 'field', dataType: 'string', label: 'Inner' },
                ],
            },
        ];
        const ctx = makeCtx({
            items,
            findItem: (k) => findItems(items, k),
        });

        const node = planComponentTree(tree, ctx);
        expect(node.bindPath).toBe('outer');
        expect(node.children[0].bindPath).toBe('outer.inner');
    });

    it('resolves accessibility attributes', () => {
        const tree = {
            component: 'Stack',
            accessibility: { role: 'region', description: 'Main form' },
        };
        const ctx = makeCtx();
        const node = planComponentTree(tree, ctx);
        expect(node.accessibility).toEqual({ role: 'region', description: 'Main form' });
    });
});

// ── planDefinitionFallback ───────────────────────────────────────────

describe('planDefinitionFallback', () => {
    it('plans a simple field with default component', () => {
        const items = [
            { key: 'name', type: 'field', dataType: 'string', label: 'Full Name', hint: 'Enter your name' },
        ];
        const ctx = makeCtx({ items, findItem: (k) => findItems(items, k) });

        const nodes = planDefinitionFallback(items, ctx);
        expect(nodes).toHaveLength(1);
        expect(nodes[0].component).toBe('TextInput');
        expect(nodes[0].category).toBe('field');
        expect(nodes[0].bindPath).toBe('name');
        expect(nodes[0].fieldItem).toEqual({
            key: 'name',
            label: 'Full Name',
            hint: 'Enter your name',
            dataType: 'string',
        });
    });

    it('maps dataTypes to correct default components', () => {
        const cases: Array<[string, string]> = [
            ['string', 'TextInput'],
            ['integer', 'NumberInput'],
            ['boolean', 'Toggle'],
            ['date', 'DatePicker'],
            ['choice', 'Select'],
            ['multiChoice', 'CheckboxGroup'],
            ['attachment', 'FileUpload'],
            ['money', 'NumberInput'],
        ];

        for (const [dataType, expected] of cases) {
            const items = [{ key: 'f', type: 'field', dataType, label: 'F' }];
            const ctx = makeCtx({ items, findItem: (k) => findItems(items, k) });
            const nodes = planDefinitionFallback(items, ctx);
            expect(nodes[0].component).toBe(expected);
        }
    });

    it('plans a group with children', () => {
        const items = [
            {
                key: 'contact',
                type: 'group',
                label: 'Contact',
                children: [
                    { key: 'name', type: 'field', dataType: 'string', label: 'Name' },
                    { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
                ],
            },
        ];
        const ctx = makeCtx({ items, findItem: (k) => findItems(items, k) });

        const nodes = planDefinitionFallback(items, ctx);
        expect(nodes).toHaveLength(1);
        expect(nodes[0].component).toBe('Stack');
        expect(nodes[0].bindPath).toBe('contact');
        expect(nodes[0].children).toHaveLength(2);
        expect(nodes[0].children[0].bindPath).toBe('contact.name');
        expect(nodes[0].children[1].bindPath).toBe('contact.email');
    });

    it('marks repeatable groups as templates', () => {
        const items = [
            {
                key: 'lineItems',
                type: 'group',
                repeatable: true,
                children: [
                    { key: 'desc', type: 'field', dataType: 'string', label: 'Desc' },
                ],
            },
        ];
        const ctx = makeCtx({ items, findItem: (k) => findItems(items, k) });

        const nodes = planDefinitionFallback(items, ctx);
        expect(nodes[0].repeatGroup).toBe('lineItems');
        expect(nodes[0].isRepeatTemplate).toBe(true);
        expect(nodes[0].children[0].bindPath).toBe('lineItems[0].desc');
    });

    it('plans display items', () => {
        const items = [
            { key: 'info', type: 'display', label: 'Please read carefully.' },
        ];
        const ctx = makeCtx({ items, findItem: (k) => findItems(items, k) });

        const nodes = planDefinitionFallback(items, ctx);
        expect(nodes).toHaveLength(1);
        expect(nodes[0].component).toBe('Text');
        expect(nodes[0].category).toBe('display');
        expect(nodes[0].props.text).toBe('Please read carefully.');
    });

    it('uses theme widget when available', () => {
        const items = [
            { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
        ];
        const ctx = makeCtx({
            items,
            findItem: (k) => findItems(items, k),
            theme: {
                selectors: [
                    { match: { dataType: 'integer' }, apply: { widget: 'Slider' } },
                ],
            },
            isComponentAvailable: () => true,
        });

        const nodes = planDefinitionFallback(items, ctx);
        expect(nodes[0].component).toBe('Slider');
    });
});

// ── Grant-application integration ────────────────────────────────────

describe('grant-application integration', () => {
    let definition: any;
    let component: any;
    let theme: any;

    beforeEach(async () => {
        // Load real fixtures
        const fs = await import('fs');
        const path = await import('path');
        const base = path.resolve(__dirname, '../../../examples/grant-application');
        definition = JSON.parse(fs.readFileSync(path.join(base, 'definition.json'), 'utf-8'));
        component = JSON.parse(fs.readFileSync(path.join(base, 'component.json'), 'utf-8'));
        theme = JSON.parse(fs.readFileSync(path.join(base, 'theme.json'), 'utf-8'));
    });

    function makeFindItem(items: any[]) {
        return function findItem(key: string): any | null {
            const parts = key.split('.');
            let current = items;
            for (let i = 0; i < parts.length; i++) {
                const found = current.find((it: any) => it.key === parts[i]);
                if (!found) return null;
                if (i === parts.length - 1) return found;
                current = found.children || [];
            }
            return null;
        };
    }

    it('plans the full component tree', () => {
        const ctx: PlanContext = {
            items: definition.items,
            formPresentation: definition.formPresentation,
            componentDocument: component,
            theme,
            activeBreakpoint: null,
            findItem: makeFindItem(definition.items),
            isComponentAvailable: () => true,
        };

        const node = planComponentTree(component.tree, ctx);

        // Root should be Wizard
        expect(node.component).toBe('Wizard');
        expect(node.category).toBe('interactive');

        // Should have children (wizard pages)
        expect(node.children.length).toBeGreaterThan(0);

        // First child should be a theme-defined page
        expect(node.children[0].component).toBe('Page');
        expect(node.children[0].props.title).toBe('Applicant Info');
    });

    it('expands custom components (ContactField)', () => {
        const ctx: PlanContext = {
            items: definition.items,
            formPresentation: definition.formPresentation,
            componentDocument: component,
            theme,
            activeBreakpoint: null,
            findItem: makeFindItem(definition.items),
            isComponentAvailable: () => true,
        };

        const node = planComponentTree(component.tree, ctx);

        // Find a node with bindPath containing 'contactName' — the expanded ContactField
        function findNode(n: LayoutNode, pred: (n: LayoutNode) => boolean): LayoutNode | null {
            if (pred(n)) return n;
            for (const child of n.children) {
                const found = findNode(child, pred);
                if (found) return found;
            }
            return null;
        }

        const contactField = findNode(node, (n) => n.bindPath === 'applicantInfo.contactName');
        expect(contactField).not.toBeNull();
        expect(contactField!.component).toBe('TextInput');
    });

    it('all nodes are JSON-serializable', () => {
        const ctx: PlanContext = {
            items: definition.items,
            formPresentation: definition.formPresentation,
            componentDocument: component,
            theme,
            activeBreakpoint: null,
            findItem: makeFindItem(definition.items),
            isComponentAvailable: () => true,
        };

        const node = planComponentTree(component.tree, ctx);
        const json = JSON.stringify(node);
        const parsed = JSON.parse(json);

        expect(parsed.component).toBe('Wizard');
        expect(parsed.children.length).toBe(node.children.length);
    });

    it('plans the definition fallback path', () => {
        const ctx: PlanContext = {
            items: definition.items,
            formPresentation: definition.formPresentation,
            theme,
            findItem: makeFindItem(definition.items),
            isComponentAvailable: () => true,
        };

        const nodes = planDefinitionFallback(definition.items, ctx);
        expect(nodes.length).toBeGreaterThan(0);

        // When formPresentation.pageMode is 'wizard', groups are wrapped in a Wizard node.
        // Find applicantInfo either at top level or inside the wizard's children.
        function findNode(list: LayoutNode[], bindPath: string): LayoutNode | undefined {
            for (const n of list) {
                if (n.bindPath === bindPath) return n;
                if (n.children.length > 0) {
                    const found = findNode(n.children, bindPath);
                    if (found) return found;
                }
            }
            return undefined;
        }
        const applicantInfo = findNode(nodes, 'applicantInfo');
        expect(applicantInfo).toBeDefined();
        expect(applicantInfo!.children.length).toBeGreaterThan(0);
    });

    it('lays out definition fallback items into theme pages with region spans', () => {
        const items = [
            { key: 'projectName', type: 'field', dataType: 'string', label: 'Project Name' },
            { key: 'projectCode', type: 'field', dataType: 'string', label: 'Project Code' },
            { key: 'certify', type: 'field', dataType: 'boolean', label: 'Certify' },
        ];

        const ctx: PlanContext = {
            items,
            theme: {
                pages: [
                    {
                        id: 'info',
                        title: 'Project Information',
                        regions: [
                            { key: 'projectName', span: 8 },
                            { key: 'projectCode', span: 4 },
                        ],
                    },
                ],
            },
            findItem: makeFindItem(items),
            isComponentAvailable: () => true,
        };

        const nodes = planDefinitionFallback(items, ctx);
        expect(nodes[0].component).toBe('Page');
        expect(nodes[0].props.title).toBe('Project Information');
        expect(nodes[0].children[0].component).toBe('Grid');
        expect(nodes[0].children[0].children[0].style).toEqual({ gridColumn: 'span 8' });
        expect(nodes[0].children[0].children[0].children[0].bindPath).toBe('projectName');
        expect(nodes[0].children[0].children[1].style).toEqual({ gridColumn: 'span 4' });
        expect(nodes[1].bindPath).toBe('certify');
    });

    it('resolves dotted region keys (e.g. "group.field") in definition fallback', () => {
        const items = [
            {
                key: 'applicantInfo',
                type: 'group',
                label: 'Applicant Info',
                children: [
                    { key: 'orgName', type: 'field', dataType: 'string', label: 'Org Name' },
                    { key: 'contactName', type: 'field', dataType: 'string', label: 'Contact' },
                    { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
                ],
            },
        ];

        const ctx: PlanContext = {
            items,
            theme: {
                pages: [
                    {
                        id: 'page1',
                        title: 'Applicant',
                        regions: [
                            { key: 'applicantInfo.orgName', span: 12 },
                        ],
                    },
                ],
            },
            findItem: makeFindItem(items),
            isComponentAvailable: () => true,
        };

        const nodes = planDefinitionFallback(items, ctx);

        // The page should contain the orgName field
        expect(nodes[0].component).toBe('Page');
        expect(nodes[0].props.title).toBe('Applicant');
        const grid = nodes[0].children[0];
        expect(grid.component).toBe('Grid');
        expect(grid.children[0].children[0].bindPath).toBe('applicantInfo.orgName');

        // The parent group should still appear in unassigned (field-level
        // region does NOT exclude entire parent group)
        const unassignedGroup = nodes.find(n => n.bindPath === 'applicantInfo');
        expect(unassignedGroup).toBeDefined();
    });

    it('finds component nodes by bind in nested layouts (Columns→Stack→Input)', () => {
        const items = [
            {
                key: 'applicantInfo',
                type: 'group',
                label: 'Applicant Info',
                children: [
                    { key: 'orgName', type: 'field', dataType: 'string', label: 'Org Name' },
                    { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
                ],
            },
        ];

        // Nested layout: Columns wrapping Stacks wrapping inputs —
        // positional parallel walk would fail here
        const tree = {
            component: 'Stack',
            children: [
                {
                    component: 'Columns',
                    children: [
                        {
                            component: 'Stack',
                            children: [
                                { component: 'TextInput', bind: 'applicantInfo.orgName' },
                            ],
                        },
                        {
                            component: 'Stack',
                            children: [
                                { component: 'TextInput', bind: 'applicantInfo.email' },
                            ],
                        },
                    ],
                },
            ],
        };

        const ctx: PlanContext = {
            items,
            componentDocument: { tree },
            theme: {
                pages: [
                    {
                        id: 'page1',
                        title: 'Applicant',
                        regions: [
                            { key: 'applicantInfo.orgName', span: 6 },
                            { key: 'applicantInfo.email', span: 6 },
                        ],
                    },
                ],
            },
            findItem: makeFindItem(items),
            isComponentAvailable: () => true,
        };

        const node = planComponentTree(tree, ctx);
        expect(node.children[0].component).toBe('Page');
        const grid = node.children[0].children[0];
        expect(grid.component).toBe('Grid');
        // Both fields should be found despite nested layout structure
        expect(grid.children).toHaveLength(2);
        expect(grid.children[0].children[0].bindPath).toBe('applicantInfo.orgName');
        expect(grid.children[1].children[0].bindPath).toBe('applicantInfo.email');
    });

    it('applies theme pages to component trees while preserving planned field nodes', () => {
        const items = [
            { key: 'projectName', type: 'field', dataType: 'string', label: 'Project Name' },
            { key: 'amount', type: 'field', dataType: 'money', label: 'Amount' },
        ];
        const tree = {
            component: 'Stack',
            children: [
                { component: 'TextInput', bind: 'projectName' },
                { component: 'MoneyInput', bind: 'amount' },
            ],
        };

        const ctx: PlanContext = {
            items,
            componentDocument: { tree },
            theme: {
                pages: [
                    {
                        id: 'details',
                        title: 'Details',
                        regions: [
                            { key: 'projectName', span: 7 },
                            { key: 'amount', span: 5 },
                        ],
                    },
                ],
            },
            findItem: makeFindItem(items),
            isComponentAvailable: () => true,
        };

        const node = planComponentTree(tree, ctx);
        expect(node.component).toBe('Stack');
        expect(node.children[0].component).toBe('Page');
        expect(node.children[0].children[0].component).toBe('Grid');
        expect(node.children[0].children[0].children[0].style).toEqual({ gridColumn: 'span 7' });
        expect(node.children[0].children[0].children[0].children[0].component).toBe('TextInput');
        expect(node.children[0].children[0].children[1].children[0].component).toBe('MoneyInput');
    });
});
