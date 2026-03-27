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
