const KNOWN_COMPONENT_TYPES = new Set([
    'TextInput', 'NumberInput', 'Select', 'Toggle', 'Checkbox',
    'DatePicker', 'RadioGroup', 'CheckboxGroup', 'Slider', 'Rating',
    'FileUpload', 'Signature', 'MoneyInput',
    'Stack', 'Card', 'Accordion', 'Collapsible',
    'Heading', 'Text', 'Divider', 'Alert',
    'Wizard', 'Tabs', 'Page',
]);

const SPEC_WIDGET_TO_COMPONENT: Record<string, string> = {
    textinput: 'TextInput',
    textarea: 'TextInput',
    richtext: 'TextInput',
    password: 'TextInput',
    color: 'TextInput',
    numberinput: 'NumberInput',
    stepper: 'NumberInput',
    slider: 'Slider',
    rating: 'Rating',
    checkbox: 'Checkbox',
    toggle: 'Toggle',
    yesno: 'Toggle',
    datepicker: 'DatePicker',
    datetimepicker: 'DatePicker',
    timepicker: 'DatePicker',
    dateinput: 'TextInput',
    datetimeinput: 'TextInput',
    timeinput: 'TextInput',
    dropdown: 'Select',
    radio: 'RadioGroup',
    autocomplete: 'Select',
    segmented: 'RadioGroup',
    likert: 'RadioGroup',
    checkboxgroup: 'CheckboxGroup',
    multiselect: 'CheckboxGroup',
    fileupload: 'FileUpload',
    camera: 'FileUpload',
    signature: 'Signature',
    moneyinput: 'MoneyInput',
    urlinput: 'TextInput',
    section: 'Stack',
    card: 'Card',
    accordion: 'Accordion',
    tab: 'Stack',
    heading: 'Heading',
    paragraph: 'Text',
    divider: 'Divider',
    banner: 'Alert',
};

function normalizeWidgetToken(widget: string): string {
    return widget.replace(/[\s_-]+/g, '').toLowerCase();
}

/**
 * Convert a Tier 1 / theme widget token into a concrete component type.
 *
 * Accepts both spec vocabulary (`radio`, `dropdown`) and legacy component ids
 * (`RadioGroup`, `Select`) so authored documents remain readable while the
 * renderer stays backwards-tolerant.
 */
export function widgetTokenToComponent(widget: string | null | undefined): string | null {
    if (!widget) return null;
    if (widget.startsWith('x-')) return widget;
    if (KNOWN_COMPONENT_TYPES.has(widget)) return widget;
    return SPEC_WIDGET_TO_COMPONENT[normalizeWidgetToken(widget)] ?? null;
}
