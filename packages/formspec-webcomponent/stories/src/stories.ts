/** @filedesc Story registry: type definitions, default theme, and all named form fixtures. */
export interface Story {
    label: string;
    description: string;
    definition: Record<string, unknown>;
    componentDoc: Record<string, unknown>;
    /** Optional theme doc — populates the theme editor when this story is selected. */
    themeDoc?: Record<string, unknown>;
}

/** Minimal starter theme pre-loaded in the theme editor for stories without their own themeDoc. */
export const defaultThemeDoc: Record<string, unknown> = {
    '$formspecTheme': '1.0',
    version: '1.0.0',
    targetDefinition: { url: 'https://formspec.dev/stories' },
    tokens: {
        'color.primary': '#4f88e8',
        'color.error': '#ea4335',
        'color.success': '#34a853',
        'color.warning': '#fbbc04',
        'spacing.sm': '8px',
        'spacing.md': '16px',
        'spacing.lg': '24px',
        'border.radius': '4px',
        'typography.family': 'system-ui, -apple-system, sans-serif',
    },
};

export interface StoryGroup {
    label: string;
    stories: Story[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function def(title: string, items: unknown[] = []): Record<string, unknown> {
    return { title, items };
}

function cdoc(tree: Record<string, unknown>): Record<string, unknown> {
    return { '$formspecComponent': '1.0', tree };
}

function field(key: string, label: string, dataType: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return { type: 'field', key, label, dataType, ...extra };
}

function heading(text: string, level = 3): Record<string, unknown> {
    return { component: 'Heading', text, level };
}

function text(t: string): Record<string, unknown> {
    return { component: 'Text', text: t };
}

// ── Layout ───────────────────────────────────────────────────────────────────

const pageStory: Story = {
    label: 'Page',
    description: 'Section container with optional title and description',
    definition: def('Page Story'),
    componentDoc: cdoc({
        component: 'Page',
        title: 'Application Details',
        description: 'Please fill in the information below. All fields marked required are mandatory.',
        children: [
            heading('Welcome to the form', 3),
            text('This is a page component — the primary layout container for a form section.'),
        ],
    }),
};

const stackStory: Story = {
    label: 'Stack',
    description: 'Flex column container with configurable gap',
    definition: def('Stack Story'),
    componentDoc: cdoc({
        component: 'Stack',
        gap: '16px',
        children: [
            { component: 'Text', text: 'First item', style: { padding: '12px', background: '#f0f0f0', borderRadius: '4px' } },
            { component: 'Text', text: 'Second item', style: { padding: '12px', background: '#f0f0f0', borderRadius: '4px' } },
            { component: 'Text', text: 'Third item', style: { padding: '12px', background: '#f0f0f0', borderRadius: '4px' } },
        ],
    }),
};

const gridStory: Story = {
    label: 'Grid',
    description: 'CSS grid layout with configurable columns and gap',
    definition: def('Grid Story'),
    componentDoc: cdoc({
        component: 'Grid',
        columns: 3,
        gap: '12px',
        children: [
            { component: 'Text', text: 'Cell 1', style: { padding: '12px', background: '#e8eaf6', borderRadius: '4px' } },
            { component: 'Text', text: 'Cell 2', style: { padding: '12px', background: '#e8eaf6', borderRadius: '4px' } },
            { component: 'Text', text: 'Cell 3', style: { padding: '12px', background: '#e8eaf6', borderRadius: '4px' } },
            { component: 'Text', text: 'Cell 4', style: { padding: '12px', background: '#e8eaf6', borderRadius: '4px' } },
            { component: 'Text', text: 'Cell 5', style: { padding: '12px', background: '#e8eaf6', borderRadius: '4px' } },
            { component: 'Text', text: 'Cell 6', style: { padding: '12px', background: '#e8eaf6', borderRadius: '4px' } },
        ],
    }),
};

const dividerStory: Story = {
    label: 'Divider',
    description: 'Horizontal rule, optionally with a label',
    definition: def('Divider Story'),
    componentDoc: cdoc({
        component: 'Stack',
        gap: '16px',
        children: [
            text('Content above a plain divider'),
            { component: 'Divider' },
            text('Content above a labeled divider'),
            { component: 'Divider', label: 'OR' },
            text('Content below a labeled divider'),
        ],
    }),
};

const collapsibleStory: Story = {
    label: 'Collapsible',
    description: 'Expandable <details>/<summary> section',
    definition: def('Collapsible Story'),
    componentDoc: cdoc({
        component: 'Stack',
        gap: '8px',
        children: [
            {
                component: 'Collapsible',
                title: 'Collapsed by default',
                children: [text('This content is hidden until expanded.')],
            },
            {
                component: 'Collapsible',
                title: 'Open by default',
                defaultOpen: true,
                children: [text('This content is visible on load.')],
            },
        ],
    }),
};

const columnsStory: Story = {
    label: 'Columns',
    description: 'Multi-column grid layout with configurable widths',
    definition: def('Columns Story'),
    componentDoc: cdoc({
        component: 'Columns',
        widths: ['2fr', '1fr'],
        gap: '16px',
        children: [
            { component: 'Stack', gap: '8px', children: [heading('Main content', 4), text('This is the wider left column.')] },
            { component: 'Stack', gap: '8px', children: [heading('Sidebar', 4), text('Narrower right column.')] },
        ],
    }),
};

const panelStory: Story = {
    label: 'Panel',
    description: 'Container panel with optional header and width',
    definition: def('Panel Story'),
    componentDoc: cdoc({
        component: 'Panel',
        title: 'Information Panel',
        style: { border: '1px solid #ddd', borderRadius: '4px' },
        children: [
            text('Panels are containers that can have a header and constrained width.'),
        ],
    }),
};

const accordionStory: Story = {
    label: 'Accordion',
    description: 'Collapsible accordion with single-open mode',
    definition: def('Accordion Story'),
    componentDoc: cdoc({
        component: 'Accordion',
        labels: ['Section A', 'Section B', 'Section C'],
        defaultOpen: 0,
        children: [
            { component: 'Text', text: 'Content for Section A — only one section opens at a time.' },
            { component: 'Text', text: 'Content for Section B.' },
            { component: 'Text', text: 'Content for Section C.' },
        ],
    }),
};

const modalStory: Story = {
    label: 'Modal',
    description: '<dialog> modal triggered by a button',
    definition: def('Modal Story'),
    componentDoc: cdoc({
        component: 'Modal',
        title: 'Modal Dialog',
        triggerLabel: 'Open Modal',
        closable: true,
        children: [
            text('This is modal content. Press × or click outside to close.'),
        ],
    }),
};

const popoverStory: Story = {
    label: 'Popover',
    description: 'Floating popover panel triggered by a button',
    definition: def('Popover Story'),
    componentDoc: cdoc({
        component: 'Popover',
        triggerLabel: 'Show Popover',
        placement: 'bottom',
        children: [
            { component: 'Text', text: 'Popover content appears near the trigger button.' },
        ],
    }),
};

// ── Input ─────────────────────────────────────────────────────────────────────

const textInputStory: Story = {
    label: 'TextInput',
    description: 'Single-line text field',
    definition: {
        title: 'TextInput Story',
        items: [
            field('firstName', 'First Name', 'text', { placeholder: 'Jane' }),
            field('lastName', 'Last Name', 'text', { placeholder: 'Smith' }),
            field('email', 'Email Address', 'text', { placeholder: 'jane@example.com' }),
        ],
    },
    componentDoc: cdoc({
        component: 'Stack',
        gap: '$token.spacing.md',
        children: [
            { component: 'TextInput', bind: 'firstName' },
            { component: 'TextInput', bind: 'lastName' },
            { component: 'TextInput', bind: 'email' },
        ],
    }),
    themeDoc: {
        '$formspecTheme': '1.0',
        version: '1.0.0',
        targetDefinition: { url: 'https://formspec.dev/stories' },
        tokens: {
            'color.primary': '#4f88e8',
            'spacing.sm': '8px',
            'spacing.md': '16px',
            'spacing.lg': '24px',
            'border.radius': '4px',
        },
        defaults: {
            labelPosition: 'top',
        },
        items: {
            email: {
                labelPosition: 'top',
                style: { borderColor: '$token.color.primary', borderWidth: '2px' },
                accessibility: { description: 'Used for account notifications' },
            },
        },
    },
};

const numberInputStory: Story = {
    label: 'NumberInput',
    description: 'Numeric input field',
    definition: {
        title: 'NumberInput Story',
        items: [field('age', 'Age', 'integer')],
    },
    componentDoc: cdoc({
        component: 'NumberInput',
        bind: 'age',
    }),
};

const selectStory: Story = {
    label: 'Select',
    description: 'Dropdown select from a list of options',
    definition: {
        title: 'Select Story',
        items: [
            field('country', 'Country', 'choice', {
                options: [
                    { value: 'us', label: 'United States' },
                    { value: 'ca', label: 'Canada' },
                    { value: 'mx', label: 'Mexico' },
                    { value: 'gb', label: 'United Kingdom' },
                ],
            }),
        ],
    },
    componentDoc: cdoc({
        component: 'Select',
        bind: 'country',
    }),
};

const toggleStory: Story = {
    label: 'Toggle',
    description: 'Boolean toggle switch',
    definition: {
        title: 'Toggle Story',
        items: [field('receiveEmails', 'Receive email notifications', 'boolean')],
    },
    componentDoc: cdoc({
        component: 'Toggle',
        bind: 'receiveEmails',
    }),
};

const checkboxStory: Story = {
    label: 'Checkbox',
    description: 'Single boolean checkbox',
    definition: {
        title: 'Checkbox Story',
        items: [field('agreeToTerms', 'I agree to the terms and conditions', 'boolean')],
    },
    componentDoc: cdoc({
        component: 'Checkbox',
        bind: 'agreeToTerms',
    }),
};

const datePickerStory: Story = {
    label: 'DatePicker',
    description: 'Date input field',
    definition: {
        title: 'DatePicker Story',
        items: [field('startDate', 'Start Date', 'date')],
    },
    componentDoc: cdoc({
        component: 'DatePicker',
        bind: 'startDate',
    }),
};

const radioGroupStory: Story = {
    label: 'RadioGroup',
    description: 'Mutually exclusive radio button group',
    definition: {
        title: 'RadioGroup Story',
        items: [
            field('plan', 'Billing Plan', 'choice', {
                options: [
                    { value: 'monthly', label: 'Monthly — $9.99/mo' },
                    { value: 'annual', label: 'Annual — $99/yr (save 17%)' },
                    { value: 'lifetime', label: 'Lifetime — $299 one-time' },
                ],
            }),
        ],
    },
    componentDoc: cdoc({
        component: 'RadioGroup',
        bind: 'plan',
    }),
    themeDoc: {
        '$formspecTheme': '1.0',
        version: '1.0.0',
        targetDefinition: { url: 'https://formspec.dev/stories' },
        tokens: {
            'color.primary': '#4f88e8',
            'spacing.md': '16px',
        },
        selectors: [
            {
                match: { type: 'field', dataType: 'choice' },
                apply: {
                    labelPosition: 'top',
                    style: { fontWeight: '500' },
                },
            },
        ],
        items: {
            plan: {
                style: { gap: '$token.spacing.md' },
                accessibility: { description: 'Select your billing frequency' },
            },
        },
    },
};

const checkboxGroupStory: Story = {
    label: 'CheckboxGroup',
    description: 'Multi-select checkbox group',
    definition: {
        title: 'CheckboxGroup Story',
        items: [
            field('interests', 'Areas of Interest', 'multiChoice', {
                options: [
                    { value: 'tech', label: 'Technology' },
                    { value: 'design', label: 'Design' },
                    { value: 'business', label: 'Business' },
                    { value: 'science', label: 'Science' },
                ],
            }),
        ],
    },
    componentDoc: cdoc({
        component: 'CheckboxGroup',
        bind: 'interests',
    }),
};

const sliderStory: Story = {
    label: 'Slider',
    description: 'Range slider with configurable min/max/step',
    definition: {
        title: 'Slider Story',
        items: [field('brightness', 'Brightness', 'integer')],
    },
    componentDoc: cdoc({
        component: 'Slider',
        bind: 'brightness',
        min: 0,
        max: 100,
        step: 5,
        showValue: true,
        showTicks: true,
    }),
};

const ratingStory: Story = {
    label: 'Rating',
    description: 'Star (or custom icon) rating control',
    definition: {
        title: 'Rating Story',
        items: [field('rating', 'Overall Rating', 'integer')],
    },
    componentDoc: cdoc({
        component: 'Rating',
        bind: 'rating',
        max: 5,
        icon: 'star',
    }),
};

const fileUploadStory: Story = {
    label: 'FileUpload',
    description: 'File picker with optional drag-and-drop zone',
    definition: {
        title: 'FileUpload Story',
        items: [field('attachment', 'Attachment', 'text')],
    },
    componentDoc: cdoc({
        component: 'FileUpload',
        bind: 'attachment',
        dragDrop: true,
        accept: '.pdf,.doc,.docx',
    }),
};

const signatureStory: Story = {
    label: 'Signature',
    description: 'Canvas-based freehand signature capture',
    definition: {
        title: 'Signature Story',
        items: [field('signature', 'Signature', 'text')],
    },
    componentDoc: cdoc({
        component: 'Signature',
        bind: 'signature',
        height: 160,
        strokeColor: '#1a1a2e',
    }),
};

const moneyInputStory: Story = {
    label: 'MoneyInput',
    description: 'Currency amount input',
    definition: {
        title: 'MoneyInput Story',
        items: [field('budget', 'Budget', 'money', { currency: 'USD' })],
    },
    componentDoc: cdoc({
        component: 'MoneyInput',
        bind: 'budget',
    }),
};

// ── Display ───────────────────────────────────────────────────────────────────

const headingStory: Story = {
    label: 'Heading',
    description: 'h1–h6 heading element',
    definition: def('Heading Story'),
    componentDoc: cdoc({
        component: 'Stack',
        gap: '8px',
        children: [
            { component: 'Heading', text: 'Heading Level 1', level: 1 },
            { component: 'Heading', text: 'Heading Level 2', level: 2 },
            { component: 'Heading', text: 'Heading Level 3', level: 3 },
            { component: 'Heading', text: 'Heading Level 4', level: 4 },
        ],
    }),
};

const textStory: Story = {
    label: 'Text',
    description: 'Paragraph text, optionally bound to a field or in markdown',
    definition: {
        title: 'Text Story',
        items: [field('summary', 'Summary', 'text')],
        binds: [{ path: 'summary', calculate: '"Hello from the engine!"' }],
    },
    componentDoc: cdoc({
        component: 'Stack',
        gap: '16px',
        children: [
            { component: 'Text', text: 'Plain static text paragraph.' },
            { component: 'Text', text: '**Bold** and *italic* and `code` via markdown.', format: 'markdown' },
            { component: 'Text', bind: 'summary' },
        ],
    }),
};

const cardStory: Story = {
    label: 'Card',
    description: 'Card container with optional title and subtitle',
    definition: def('Card Story'),
    componentDoc: cdoc({
        component: 'Stack',
        gap: '12px',
        children: [
            {
                component: 'Card',
                title: 'Card Title',
                subtitle: 'Optional subtitle text',
                elevation: 1,
                style: { border: '1px solid #ddd', borderRadius: '6px', padding: '16px' },
                children: [text('Card body content goes here.')],
            },
        ],
    }),
};

const spacerStory: Story = {
    label: 'Spacer',
    description: 'Invisible vertical spacer with configurable size',
    definition: def('Spacer Story'),
    componentDoc: cdoc({
        component: 'Stack',
        children: [
            text('Content above a 48px spacer.'),
            { component: 'Spacer', size: '48px' },
            text('Content below the spacer.'),
        ],
    }),
};

const alertStory: Story = {
    label: 'Alert',
    description: 'Alert banner with severity variants',
    definition: def('Alert Story'),
    componentDoc: cdoc({
        component: 'Stack',
        gap: '8px',
        children: [
            { component: 'Alert', severity: 'info', text: 'Info: Your application was saved.' },
            { component: 'Alert', severity: 'warning', text: 'Warning: This action cannot be undone.' },
            { component: 'Alert', severity: 'error', text: 'Error: Please fix the highlighted fields.' },
            { component: 'Alert', severity: 'success', text: 'Success: Submission received.', dismissible: true },
        ],
    }),
};

const badgeStory: Story = {
    label: 'Badge',
    description: 'Inline status badge with variant styles',
    definition: def('Badge Story'),
    componentDoc: cdoc({
        component: 'Stack',
        direction: 'horizontal',
        gap: '8px',
        children: [
            { component: 'Badge', text: 'default', variant: 'default' },
            { component: 'Badge', text: 'primary', variant: 'primary' },
            { component: 'Badge', text: 'success', variant: 'success' },
            { component: 'Badge', text: 'warning', variant: 'warning' },
            { component: 'Badge', text: 'error', variant: 'error' },
        ],
    }),
};

const progressBarStory: Story = {
    label: 'ProgressBar',
    description: 'Progress indicator, optionally bound to a field',
    definition: {
        title: 'ProgressBar Story',
        items: [field('progress', 'Progress', 'integer')],
        binds: [{ path: 'progress', calculate: '65' }],
    },
    componentDoc: cdoc({
        component: 'Stack',
        gap: '16px',
        children: [
            { component: 'ProgressBar', value: 40, max: 100, label: 'Static 40%', showPercent: true },
            { component: 'ProgressBar', bind: 'progress', max: 100, label: 'Bound to field', showPercent: true },
        ],
    }),
};

const summaryStory: Story = {
    label: 'Summary',
    description: 'Definition list displaying bound field values',
    definition: {
        title: 'Summary Story',
        items: [
            field('firstName', 'First Name', 'text'),
            field('lastName', 'Last Name', 'text'),
            field('plan', 'Plan', 'choice', {
                options: [
                    { value: 'monthly', label: 'Monthly' },
                    { value: 'annual', label: 'Annual' },
                ],
            }),
        ],
        binds: [
            { path: 'firstName', calculate: '"Jane"' },
            { path: 'lastName', calculate: '"Smith"' },
            { path: 'plan', calculate: '"annual"' },
        ],
    },
    componentDoc: cdoc({
        component: 'Summary',
        items: [
            { label: 'First Name', bind: 'firstName' },
            { label: 'Last Name', bind: 'lastName' },
            { label: 'Billing Plan', bind: 'plan', optionSet: undefined },
        ],
    }),
};

const validationSummaryStory: Story = {
    label: 'ValidationSummary',
    description: 'Live validation error list with optional jump links',
    definition: {
        title: 'ValidationSummary Story',
        items: [field('email', 'Email', 'text')],
        binds: [
            {
                path: 'email',
                required: true,
                constraint: 'email != null',
                constraintMessage: 'Email is required.',
            },
        ],
    },
    componentDoc: cdoc({
        component: 'Stack',
        gap: '16px',
        children: [
            { component: 'ValidationSummary', source: 'live', mode: 'continuous', showFieldErrors: true, jumpLinks: false },
            { component: 'TextInput', bind: 'email' },
        ],
    }),
};

// ── Interactive ───────────────────────────────────────────────────────────────

const wizardStory: Story = {
    label: 'Wizard',
    description: 'Multi-step wizard with progress indicator and navigation',
    definition: {
        title: 'Wizard Story',
        formPresentation: { pageMode: 'wizard', showProgress: true },
        items: [
            field('name', 'Full Name', 'text'),
            field('email', 'Email Address', 'text'),
            field('plan', 'Plan', 'choice', {
                options: [
                    { value: 'free', label: 'Free' },
                    { value: 'pro', label: 'Pro ($9.99/mo)' },
                ],
            }),
        ],
    },
    componentDoc: cdoc({
        component: 'Stack',
        children: [
            {
                component: 'Page',
                title: 'Step 1: Identity',
                children: [{ component: 'TextInput', bind: 'name' }],
            },
            {
                component: 'Page',
                title: 'Step 2: Contact',
                children: [{ component: 'TextInput', bind: 'email' }],
            },
            {
                component: 'Page',
                title: 'Step 3: Plan',
                children: [{ component: 'RadioGroup', bind: 'plan' }],
            },
        ],
    }),
};

const tabsStory: Story = {
    label: 'Tabs',
    description: 'Tabbed interface with configurable tab position',
    definition: {
        title: 'Tabs Story',
        items: [field('notes', 'Notes', 'text')],
    },
    componentDoc: cdoc({
        component: 'Tabs',
        tabLabels: ['Overview', 'Details', 'Settings'],
        children: [
            { component: 'Text', text: 'Overview tab content.' },
            {
                component: 'Stack',
                gap: '8px',
                children: [
                    { component: 'Text', text: 'Details tab content.' },
                    { component: 'TextInput', bind: 'notes' },
                ],
            },
            { component: 'Text', text: 'Settings tab content.' },
        ],
    }),
};

const submitButtonStory: Story = {
    label: 'SubmitButton',
    description: 'Submit button that invokes the renderer submit API',
    definition: {
        title: 'SubmitButton Story',
        items: [field('name', 'Your Name', 'text')],
    },
    componentDoc: cdoc({
        component: 'Stack',
        gap: '16px',
        children: [
            { component: 'TextInput', bind: 'name' },
            { component: 'SubmitButton', label: 'Submit Application', mode: 'submit' },
        ],
    }),
};

// ── Special ───────────────────────────────────────────────────────────────────

const conditionalGroupStory: Story = {
    label: 'ConditionalGroup',
    description: 'Wrapper whose visibility is controlled by bind relevance',
    definition: {
        title: 'ConditionalGroup Story',
        items: [
            field('hasSpouse', 'Do you have a spouse?', 'boolean'),
            field('spouseName', 'Spouse Name', 'text'),
        ],
        binds: [
            { path: 'spouseName', relevant: 'hasSpouse == true' },
        ],
    },
    componentDoc: cdoc({
        component: 'Stack',
        gap: '16px',
        children: [
            { component: 'Toggle', bind: 'hasSpouse' },
            {
                component: 'ConditionalGroup',
                bind: 'spouseName',
                children: [{ component: 'TextInput', bind: 'spouseName' }],
            },
        ],
    }),
};

const dataTableStory: Story = {
    label: 'DataTable',
    description: 'Editable table bound to a repeatable group',
    definition: {
        title: 'DataTable Story',
        items: [
            {
                type: 'group',
                key: 'lineItems',
                label: 'Line Items',
                repeatable: true,
                minRepeat: 1,
                maxRepeat: 10,
                children: [
                    field('description', 'Description', 'text'),
                    field('quantity', 'Qty', 'integer'),
                    field('unitCost', 'Unit Cost', 'decimal'),
                ],
            },
        ],
    },
    componentDoc: cdoc({
        component: 'DataTable',
        bind: 'lineItems',
        allowAdd: true,
        allowRemove: true,
        showRowNumbers: true,
        columns: [
            { header: 'Description', bind: 'description' },
            { header: 'Qty', bind: 'quantity' },
            { header: 'Unit Cost', bind: 'unitCost' },
        ],
    }),
};

// ── Export ────────────────────────────────────────────────────────────────────

export const storyGroups: StoryGroup[] = [
    {
        label: 'Layout',
        stories: [
            pageStory,
            stackStory,
            gridStory,
            dividerStory,
            collapsibleStory,
            columnsStory,
            panelStory,
            accordionStory,
            modalStory,
            popoverStory,
        ],
    },
    {
        label: 'Input',
        stories: [
            textInputStory,
            numberInputStory,
            selectStory,
            toggleStory,
            checkboxStory,
            datePickerStory,
            radioGroupStory,
            checkboxGroupStory,
            sliderStory,
            ratingStory,
            fileUploadStory,
            signatureStory,
            moneyInputStory,
        ],
    },
    {
        label: 'Display',
        stories: [
            headingStory,
            textStory,
            cardStory,
            spacerStory,
            alertStory,
            badgeStory,
            progressBarStory,
            summaryStory,
            validationSummaryStory,
        ],
    },
    {
        label: 'Interactive',
        stories: [wizardStory, tabsStory, submitButtonStory],
    },
    {
        label: 'Special',
        stories: [conditionalGroupStory, dataTableStory],
    },
];
