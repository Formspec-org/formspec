/** Shared definition fixtures for Storybook stories. */

/** Minimal text input field. */
export const textInputDef = {
    "$formspec": "1.0",
    title: "Text Input",
    items: [
        { key: "name", type: "field", dataType: "string", label: "Full Name", required: true },
    ],
};

/** Text input with hint, placeholder, and constraint. */
export const textInputDetailedDef = {
    "$formspec": "1.0",
    title: "Text Input Detailed",
    items: [
        {
            key: "email",
            type: "field",
            dataType: "string",
            label: "Email Address",
            hint: "We'll never share your email.",
            presentation: { widgetHint: "TextInput", placeholder: "you@example.com" },
            required: true,
            constraint: "matches($email, '^[^@]+@[^@]+[.][^@]+$')",
            constraintMessage: "Must be a valid email",
        },
    ],
};

/** Textarea / multi-line text. */
export const textareaDef = {
    "$formspec": "1.0",
    title: "Textarea",
    items: [
        {
            key: "bio",
            type: "field",
            dataType: "text",
            label: "Biography",
            hint: "Tell us about yourself",
            presentation: { widgetHint: "TextInput", maxLines: 5 },
        },
    ],
};

/** Select dropdown. */
export const selectDef = {
    "$formspec": "1.0",
    title: "Select",
    items: [
        {
            key: "color",
            type: "field",
            dataType: "choice",
            label: "Favorite Color",
            options: [
                { value: "red", label: "Red" },
                { value: "green", label: "Green" },
                { value: "blue", label: "Blue" },
                { value: "yellow", label: "Yellow" },
            ],
            presentation: { widgetHint: "Select" },
            required: true,
        },
    ],
};

/** Checkbox. */
export const checkboxDef = {
    "$formspec": "1.0",
    title: "Checkbox",
    items: [
        {
            key: "agree",
            type: "field",
            dataType: "boolean",
            label: "I agree to the terms and conditions",
            presentation: { widgetHint: "Checkbox" },
            required: true,
        },
    ],
};

/** Radio group. */
export const radioGroupDef = {
    "$formspec": "1.0",
    title: "Radio Group",
    items: [
        {
            key: "priority",
            type: "field",
            dataType: "choice",
            label: "Priority Level",
            options: [
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
                { value: "critical", label: "Critical" },
            ],
            presentation: { widgetHint: "RadioGroup" },
        },
    ],
};

/** Checkbox group with multi-select. */
export const checkboxGroupDef = {
    "$formspec": "1.0",
    title: "Checkbox Group",
    items: [
        {
            key: "interests",
            type: "field",
            dataType: "multiChoice",
            label: "Areas of Interest",
            options: [
                { value: "tech", label: "Technology" },
                { value: "science", label: "Science" },
                { value: "arts", label: "Arts" },
                { value: "sports", label: "Sports" },
            ],
            presentation: { widgetHint: "CheckboxGroup" },
        },
    ],
};

/** Number input. */
export const numberInputDef = {
    "$formspec": "1.0",
    title: "Number Input",
    items: [
        {
            key: "age",
            type: "field",
            dataType: "integer",
            label: "Age",
            presentation: { widgetHint: "NumberInput", min: 0, max: 150 },
        },
    ],
};

/** Number input with stepper. */
export const numberStepperDef = {
    "$formspec": "1.0",
    title: "Number Stepper",
    items: [
        {
            key: "quantity",
            type: "field",
            dataType: "integer",
            label: "Quantity",
            presentation: { widgetHint: "NumberInput", min: 1, max: 99, step: 1, showStepper: true },
        },
    ],
};

/** Date picker. */
export const datePickerDef = {
    "$formspec": "1.0",
    title: "Date Picker",
    items: [
        {
            key: "dob",
            type: "field",
            dataType: "date",
            label: "Date of Birth",
            presentation: { widgetHint: "DatePicker" },
        },
    ],
};

/** DateTime picker. */
export const dateTimePickerDef = {
    "$formspec": "1.0",
    title: "DateTime Picker",
    items: [
        {
            key: "appointment",
            type: "field",
            dataType: "dateTime",
            label: "Appointment Date & Time",
            presentation: { widgetHint: "dateTimePicker" },
        },
    ],
};

/** Time picker. */
export const timePickerDef = {
    "$formspec": "1.0",
    title: "Time Picker",
    items: [
        {
            key: "startTime",
            type: "field",
            dataType: "time",
            label: "Start Time",
            presentation: { widgetHint: "timePicker" },
        },
    ],
};

/** Money input. */
export const moneyInputDef = {
    "$formspec": "1.0",
    title: "Money Input",
    items: [
        {
            key: "amount",
            type: "field",
            dataType: "decimal",
            label: "Grant Amount",
            presentation: { widgetHint: "MoneyInput", currency: "USD" },
            required: true,
        },
    ],
};

/** Slider. */
export const sliderDef = {
    "$formspec": "1.0",
    title: "Slider",
    items: [
        {
            key: "satisfaction",
            type: "field",
            dataType: "integer",
            label: "Satisfaction",
            presentation: { widgetHint: "Slider", min: 0, max: 10, step: 1 },
        },
    ],
};

/** Rating. */
export const ratingDef = {
    "$formspec": "1.0",
    title: "Rating",
    items: [
        {
            key: "stars",
            type: "field",
            dataType: "integer",
            label: "Rate your experience",
            presentation: { widgetHint: "Rating", maxRating: 5 },
        },
    ],
};

/** File upload. */
export const fileUploadDef = {
    "$formspec": "1.0",
    title: "File Upload",
    items: [
        {
            key: "resume",
            type: "field",
            dataType: "attachment",
            label: "Upload Resume",
            presentation: { widgetHint: "FileUpload", accept: ".pdf,.doc,.docx", maxSize: 5242880 },
        },
    ],
};

/** Toggle / switch. */
export const toggleDef = {
    "$formspec": "1.0",
    title: "Toggle",
    items: [
        {
            key: "notifications",
            type: "field",
            dataType: "boolean",
            label: "Enable notifications",
            presentation: { widgetHint: "Toggle", onLabel: "On", offLabel: "Off" },
        },
    ],
};

/** Signature pad. */
export const signatureDef = {
    "$formspec": "1.0",
    title: "Signature",
    items: [
        {
            key: "sig",
            type: "field",
            dataType: "attachment",
            label: "Signature",
            presentation: { widgetHint: "Signature" },
        },
    ],
};

/** Contact form — use with a componentDocument to demonstrate grid layout. */
export const contactFormDef = {
    "$formspec": "1.0",
    title: "Contact Form",
    items: [
        { key: "firstName", type: "field", dataType: "string", label: "First Name", required: true },
        { key: "lastName", type: "field", dataType: "string", label: "Last Name", required: true },
        { key: "email", type: "field", dataType: "string", label: "Email" },
        { key: "phone", type: "field", dataType: "string", label: "Phone" },
        { key: "newsletter", type: "field", dataType: "boolean", label: "Subscribe to newsletter", presentation: { widgetHint: "Checkbox" } },
    ],
};

/** Grouped form with nested fields. */
export const groupedFormDef = {
    "$formspec": "1.0",
    title: "Grouped Form",
    items: [
        {
            key: "personal",
            type: "group",
            label: "Personal Information",
            children: [
                { key: "name", type: "field", dataType: "string", label: "Name", required: true },
                { key: "email", type: "field", dataType: "string", label: "Email" },
            ],
        },
        {
            key: "preferences",
            type: "group",
            label: "Preferences",
            children: [
                { key: "newsletter", type: "field", dataType: "boolean", label: "Subscribe to newsletter", presentation: { widgetHint: "Checkbox" } },
                { key: "debug", type: "field", dataType: "boolean", label: "Enable debug mode", presentation: { widgetHint: "Checkbox" } },
                { key: "timeout", type: "field", dataType: "integer", label: "Timeout (seconds)", presentation: { widgetHint: "NumberInput", min: 1, max: 300 } },
            ],
        },
    ],
};

/** Display components: heading, text, alert, divider. */
export const displayDef = {
    "$formspec": "1.0",
    title: "Display Components",
    items: [
        { key: "heading", type: "display", label: "Section Heading", presentation: { widgetHint: "heading" } },
        { key: "intro", type: "display", label: "This is a paragraph of informational text explaining the form section.", presentation: { widgetHint: "paragraph" } },
        { key: "info", type: "display", label: "Please complete all required fields before submitting.", presentation: { widgetHint: "banner" } },
        { key: "sep", type: "display", label: "", presentation: { widgetHint: "divider" } },
    ],
};

/** Repeatable group. */
export const repeatGroupDef = {
    "$formspec": "1.0",
    title: "Repeat Group",
    items: [
        {
            key: "members",
            type: "group",
            label: "Team Members",
            repeatable: true,
            minRepeat: 1,
            maxRepeat: 5,
            children: [
                { key: "memberName", type: "field", dataType: "string", label: "Name", required: true },
                { key: "memberRole", type: "field", dataType: "string", label: "Role" },
            ],
        },
    ],
};

/** Conditional visibility with when expression. */
export const conditionalDef = {
    "$formspec": "1.0",
    title: "Conditional Fields",
    items: [
        {
            key: "hasOther",
            type: "field",
            dataType: "boolean",
            label: "Other (specify)",
            presentation: { widgetHint: "Checkbox" },
        },
        {
            key: "otherDetail",
            type: "field",
            dataType: "string",
            label: "Please specify",
            relevant: "$hasOther = true",
        },
    ],
};

// ── Component documents ─────────────────────────────────────────────

/** Grid layout for the contact form — 2-column responsive grid. */
export const contactFormComponentDoc = {
    "$formspecComponent": "1.0",
    name: "contact-grid",
    title: "Contact Form Grid",
    tree: {
        component: "Card",
        title: "Contact Information",
        children: [
            {
                component: "Grid",
                columns: 2,
                gap: "16px",
                children: [
                    { component: "TextInput", bind: "firstName" },
                    { component: "TextInput", bind: "lastName" },
                    { component: "TextInput", bind: "email" },
                    { component: "TextInput", bind: "phone" },
                ],
            },
        ],
    },
};

/** Card layout for grouped form — wraps each group in a Card with a Grid inside. */
export const groupedFormComponentDoc = {
    "$formspecComponent": "1.0",
    name: "grouped-cards",
    title: "Grouped Form Cards",
    tree: {
        component: "Stack",
        gap: "24px",
        children: [
            {
                component: "Card",
                title: "Personal Information",
                children: [
                    {
                        component: "Grid",
                        columns: 2,
                        gap: "16px",
                        children: [
                            { component: "TextInput", bind: "personal.name" },
                            { component: "TextInput", bind: "personal.email" },
                        ],
                    },
                ],
            },
            {
                component: "Card",
                title: "Preferences",
                children: [
                    { component: "Checkbox", bind: "preferences.newsletter" },
                    { component: "Checkbox", bind: "preferences.debug" },
                    { component: "NumberInput", bind: "preferences.timeout", min: 1, max: 300, step: 1 },
                ],
            },
        ],
    },
};

// ── Searchable select ───────────────────────────────────────────────

/** Searchable select with autocomplete filtering. */
export const searchableSelectDef = {
    "$formspec": "1.0",
    title: "Searchable Select",
    items: [
        {
            key: "country",
            type: "field",
            dataType: "choice",
            label: "Country",
            hint: "Type to filter the list",
            options: [
                { value: "us", label: "United States" },
                { value: "ca", label: "Canada" },
                { value: "mx", label: "Mexico" },
                { value: "gb", label: "United Kingdom" },
                { value: "de", label: "Germany" },
                { value: "fr", label: "France" },
                { value: "jp", label: "Japan" },
                { value: "au", label: "Australia" },
                { value: "br", label: "Brazil" },
                { value: "in", label: "India" },
            ],
            presentation: { widgetHint: "autocomplete" },
        },
    ],
};

// ── Display component definitions ───────────────────────────────────

/** All display component types in one form. */
export const allDisplayDef = {
    "$formspec": "1.0",
    title: "All Display Components",
    items: [
        { key: "h1", type: "display", label: "Primary Heading", presentation: { widgetHint: "heading" } },
        { key: "text1", type: "display", label: "This is a **paragraph** with *markdown* support and a [link](https://example.com).", presentation: { widgetHint: "paragraph" } },
        { key: "divider1", type: "display", label: "", presentation: { widgetHint: "divider" } },
        { key: "infoAlert", type: "display", label: "This is an informational message.", presentation: { widgetHint: "banner" } },
        { key: "name", type: "field", dataType: "string", label: "Your Name" },
    ],
};

/** Alert severity variants — placed via component document. */
export const alertVariantsComponentDoc = {
    "$formspecComponent": "1.0",
    name: "alert-variants",
    title: "Alert Variants",
    tree: {
        component: "Stack",
        gap: "12px",
        children: [
            { component: "Alert", text: "This is an informational message.", severity: "info" },
            { component: "Alert", text: "Operation completed successfully.", severity: "success" },
            { component: "Alert", text: "Please review before submitting.", severity: "warning" },
            { component: "Alert", text: "An error occurred. Please try again.", severity: "error" },
            { component: "Alert", text: "This alert can be dismissed.", severity: "info", dismissible: true },
        ],
    },
};

/** Heading hierarchy h1–h6 — placed via component document. */
export const headingHierarchyComponentDoc = {
    "$formspecComponent": "1.0",
    name: "heading-hierarchy",
    title: "Heading Hierarchy",
    tree: {
        component: "Stack",
        gap: "8px",
        children: [
            { component: "Heading", text: "Heading Level 1", level: 1 },
            { component: "Heading", text: "Heading Level 2", level: 2 },
            { component: "Heading", text: "Heading Level 3", level: 3 },
            { component: "Heading", text: "Heading Level 4", level: 4 },
            { component: "Heading", text: "Heading Level 5", level: 5 },
            { component: "Heading", text: "Heading Level 6", level: 6 },
        ],
    },
};

// ── Layout component documents ──────────────────────────────────────

/** Collapsible component document. */
export const collapsibleComponentDoc = {
    "$formspecComponent": "1.0",
    name: "collapsible-demo",
    title: "Collapsible Demo",
    tree: {
        component: "Stack",
        gap: "16px",
        children: [
            {
                component: "Collapsible",
                title: "Personal Details",
                defaultOpen: true,
                children: [
                    { component: "TextInput", bind: "firstName" },
                    { component: "TextInput", bind: "lastName" },
                ],
            },
            {
                component: "Collapsible",
                title: "Contact Information",
                children: [
                    { component: "TextInput", bind: "email" },
                    { component: "TextInput", bind: "phone" },
                ],
            },
        ],
    },
};

/** Accordion component document. */
export const accordionComponentDoc = {
    "$formspecComponent": "1.0",
    name: "accordion-demo",
    title: "Accordion Demo",
    tree: {
        component: "Accordion",
        labels: ["Personal Details", "Contact Information"],
        defaultOpen: 0,
        children: [
            {
                component: "Stack",
                gap: "12px",
                children: [
                    { component: "TextInput", bind: "firstName" },
                    { component: "TextInput", bind: "lastName" },
                ],
            },
            {
                component: "Stack",
                gap: "12px",
                children: [
                    { component: "TextInput", bind: "email" },
                    { component: "TextInput", bind: "phone" },
                ],
            },
        ],
    },
};

/** Accordion with allowMultiple — multiple sections open at once. */
export const accordionMultiComponentDoc = {
    "$formspecComponent": "1.0",
    name: "accordion-multi-demo",
    title: "Accordion Multi Demo",
    tree: {
        component: "Accordion",
        labels: ["Personal Details", "Contact Information", "Preferences"],
        defaultOpen: 0,
        allowMultiple: true,
        children: [
            {
                component: "Stack",
                gap: "12px",
                children: [
                    { component: "TextInput", bind: "firstName" },
                    { component: "TextInput", bind: "lastName" },
                ],
            },
            {
                component: "Stack",
                gap: "12px",
                children: [
                    { component: "TextInput", bind: "email" },
                    { component: "TextInput", bind: "phone" },
                ],
            },
            {
                component: "Stack",
                gap: "12px",
                children: [
                    { component: "Checkbox", bind: "newsletter" },
                ],
            },
        ],
    },
};

/** Panel component document — sidebar + main content. */
export const panelComponentDoc = {
    "$formspecComponent": "1.0",
    name: "panel-demo",
    title: "Panel Demo",
    tree: {
        component: "Stack",
        direction: "horizontal",
        gap: "24px",
        children: [
            {
                component: "Panel",
                title: "Help",
                position: "left",
                width: "200px",
                children: [
                    { component: "Text", text: "Fill in your contact details. All fields are optional unless marked required." },
                ],
            },
            {
                component: "Stack",
                gap: "12px",
                children: [
                    { component: "TextInput", bind: "firstName" },
                    { component: "TextInput", bind: "lastName" },
                    { component: "TextInput", bind: "email" },
                    { component: "TextInput", bind: "phone" },
                ],
            },
        ],
    },
};

/** Modal component document. */
export const modalComponentDoc = {
    "$formspecComponent": "1.0",
    name: "modal-demo",
    title: "Modal Demo",
    tree: {
        component: "Stack",
        gap: "16px",
        children: [
            { component: "TextInput", bind: "firstName" },
            { component: "TextInput", bind: "lastName" },
            {
                component: "Modal",
                title: "Additional Details",
                triggerLabel: "Add More Details",
                children: [
                    { component: "TextInput", bind: "email" },
                    { component: "TextInput", bind: "phone" },
                ],
            },
        ],
    },
};

/** Popover component document. */
export const popoverComponentDoc = {
    "$formspecComponent": "1.0",
    name: "popover-demo",
    title: "Popover Demo",
    tree: {
        component: "Stack",
        gap: "16px",
        children: [
            { component: "TextInput", bind: "firstName" },
            { component: "TextInput", bind: "lastName" },
            {
                component: "Popover",
                triggerLabel: "Need help?",
                title: "Field guidance",
                children: [
                    { component: "Text", text: "Enter your legal first and last name as they appear on official documents." },
                ],
            },
        ],
    },
};

/** Wizard component document — multi-step form with navigation. */
export const wizardComponentDoc = {
    "$formspecComponent": "1.0",
    name: "wizard-demo",
    title: "Wizard Demo",
    tree: {
        component: "Wizard",
        showProgress: true,
        children: [
            {
                component: "Page",
                title: "Personal Info",
                children: [
                    { component: "TextInput", bind: "firstName" },
                    { component: "TextInput", bind: "lastName" },
                ],
            },
            {
                component: "Page",
                title: "Contact",
                children: [
                    { component: "TextInput", bind: "email" },
                    { component: "TextInput", bind: "phone" },
                ],
            },
        ],
    },
};

/** Tabs component document. */
export const tabsComponentDoc = {
    "$formspecComponent": "1.0",
    name: "tabs-demo",
    title: "Tabs Demo",
    tree: {
        component: "Tabs",
        labels: ["Personal", "Contact"],
        children: [
            {
                component: "Stack",
                gap: "12px",
                children: [
                    { component: "TextInput", bind: "firstName" },
                    { component: "TextInput", bind: "lastName" },
                ],
            },
            {
                component: "Stack",
                gap: "12px",
                children: [
                    { component: "TextInput", bind: "email" },
                    { component: "TextInput", bind: "phone" },
                ],
            },
        ],
    },
};

// ── Display-only component documents ────────────────────────────────
// Badge, Spacer, ProgressBar, Summary, ValidationSummary, DataTable
// are placed via component trees, not definition widgetHint.

/** Badge + Spacer showcase with fields. */
export const badgeSpacerComponentDoc = {
    "$formspecComponent": "1.0",
    name: "badge-spacer-demo",
    title: "Badge & Spacer Demo",
    tree: {
        component: "Stack",
        gap: "8px",
        children: [
            { component: "Heading", text: "Application Status" },
            { component: "Badge", text: "In Progress", variant: "info" },
            { component: "Spacer", size: "1.5rem" },
            { component: "TextInput", bind: "firstName" },
            { component: "TextInput", bind: "lastName" },
            { component: "Spacer", size: "2rem" },
            { component: "Badge", text: "Required", variant: "error" },
            { component: "TextInput", bind: "email" },
        ],
    },
};

/** ProgressBar showcase — static value (no bind). */
export const progressBarComponentDoc = {
    "$formspecComponent": "1.0",
    name: "progress-bar-demo",
    title: "ProgressBar Demo",
    tree: {
        component: "Stack",
        gap: "16px",
        children: [
            { component: "Heading", text: "Form Completion" },
            { component: "ProgressBar", value: 65, max: 100, showPercent: true, label: "Completion" },
            { component: "TextInput", bind: "firstName" },
            { component: "TextInput", bind: "lastName" },
        ],
    },
};

/** Summary display — shows field values reactively. */
export const summaryComponentDoc = {
    "$formspecComponent": "1.0",
    name: "summary-demo",
    title: "Summary Demo",
    tree: {
        component: "Stack",
        gap: "16px",
        children: [
            { component: "TextInput", bind: "firstName" },
            { component: "TextInput", bind: "lastName" },
            { component: "TextInput", bind: "email" },
            { component: "Divider" },
            {
                component: "Summary",
                items: [
                    { label: "First Name", bind: "firstName" },
                    { label: "Last Name", bind: "lastName" },
                    { label: "Email", bind: "email" },
                ],
            },
        ],
    },
};

/** ValidationSummary — live validation error list. */
export const validationSummaryComponentDoc = {
    "$formspecComponent": "1.0",
    name: "validation-summary-demo",
    title: "ValidationSummary Demo",
    tree: {
        component: "Stack",
        gap: "16px",
        children: [
            { component: "ValidationSummary" },
            { component: "TextInput", bind: "username" },
            { component: "TextInput", bind: "password" },
        ],
    },
};

/** Definition for the validation summary demo (needs required + constraints). */
export const validationSummaryDef = {
    "$formspec": "1.0",
    title: "Validation Summary Demo",
    items: [
        { key: "username", type: "field", dataType: "string", label: "Username", required: true },
        {
            key: "password",
            type: "field",
            dataType: "string",
            label: "Password",
            required: true,
            constraint: "length($password) >= 8",
            constraintMessage: "Password must be at least 8 characters",
        },
    ],
};

/** DataTable definition — needs a repeatable group. */
export const dataTableDef = {
    "$formspec": "1.0",
    title: "DataTable Demo",
    items: [
        {
            key: "expenses",
            type: "group",
            label: "Expenses",
            repeatable: true,
            minRepeat: 1,
            maxRepeat: 20,
            children: [
                { key: "description", type: "field", dataType: "string", label: "Description" },
                { key: "amount", type: "field", dataType: "decimal", label: "Amount" },
                {
                    key: "category",
                    type: "field",
                    dataType: "choice",
                    label: "Category",
                    options: [
                        { value: "travel", label: "Travel" },
                        { value: "supplies", label: "Supplies" },
                        { value: "equipment", label: "Equipment" },
                        { value: "other", label: "Other" },
                    ],
                },
            ],
        },
    ],
};

/** DataTable component document — tabular editing of the repeatable group. */
export const dataTableComponentDoc = {
    "$formspecComponent": "1.0",
    name: "datatable-demo",
    title: "DataTable Demo",
    tree: {
        component: "Stack",
        gap: "16px",
        children: [
            { component: "Heading", text: "Expense Report" },
            {
                component: "DataTable",
                bind: "expenses",
                title: "Line Items",
                allowAdd: true,
                allowRemove: true,
                columns: [
                    { header: "Description", bind: "description", type: "text" },
                    { header: "Amount ($)", bind: "amount", type: "number" },
                    {
                        header: "Category",
                        bind: "category",
                        type: "select",
                        choices: [
                            { value: "travel", label: "Travel" },
                            { value: "supplies", label: "Supplies" },
                            { value: "equipment", label: "Equipment" },
                            { value: "other", label: "Other" },
                        ],
                    },
                ],
            },
        ],
    },
};

/** Validation showcase. */
export const validationDef = {
    "$formspec": "1.0",
    title: "Validation Demo",
    items: [
        {
            key: "username",
            type: "field",
            dataType: "string",
            label: "Username",
            hint: "3-20 characters, letters and numbers only",
            required: true,
            constraint: "length($username) >= 3 and length($username) <= 20",
            constraintMessage: "Username must be 3-20 characters",
        },
        {
            key: "password",
            type: "field",
            dataType: "string",
            label: "Password",
            required: true,
            constraint: "length($password) >= 8",
            constraintMessage: "Password must be at least 8 characters",
        },
    ],
};
