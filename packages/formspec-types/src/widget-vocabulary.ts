/**
 * Canonical widget vocabulary — single source of truth for widget ↔ component mappings.
 *
 * Lives in formspec-types so every package has access without adding dependencies.
 * All packages that need widget resolution import from here (via formspec-types
 * or re-exported through formspec-layout).
 */

export const KNOWN_COMPONENT_TYPES = new Set([
    'TextInput', 'NumberInput', 'Select', 'Toggle', 'Checkbox',
    'DatePicker', 'RadioGroup', 'CheckboxGroup', 'Slider', 'Rating',
    'FileUpload', 'Signature', 'MoneyInput',
    'Stack', 'Card', 'Accordion', 'Collapsible',
    'Heading', 'Text', 'Divider', 'Alert',
    'Tabs', 'Page',
]);

/**
 * Spec-normative Tier 1 widgetHint → Tier 3 component name.
 * Keys are always lowercase (normalized). Values are PascalCase component names.
 */
export const SPEC_WIDGET_TO_COMPONENT: Record<string, string> = {
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

/**
 * Reverse map: PascalCase component → canonical camelCase hint.
 * These are the values stored in definition.presentation.widgetHint.
 * For components with multiple hints (e.g. TextInput → textInput, textarea, password),
 * this picks the primary/default hint.
 *
 * Note: SPEC_WIDGET_TO_COMPONENT keys are all-lowercase (normalized for lookup).
 * These values are camelCase (the authoring/storage form).
 */
export const COMPONENT_TO_HINT: Record<string, string> = {
    TextInput: 'textInput',
    NumberInput: 'numberInput',
    Checkbox: 'checkbox',
    Toggle: 'toggle',
    DatePicker: 'datePicker',
    Select: 'dropdown',
    RadioGroup: 'radio',
    CheckboxGroup: 'checkboxGroup',
    Slider: 'slider',
    Rating: 'rating',
    FileUpload: 'fileUpload',
    Signature: 'signature',
    MoneyInput: 'moneyInput',
    Stack: 'section',
    Card: 'card',
    Accordion: 'accordion',
    Heading: 'heading',
    Text: 'paragraph',
    Divider: 'divider',
    Alert: 'banner',
};

/**
 * Widget compatibility matrix: dataType → ordered list of compatible components.
 * First entry is the default widget for that dataType.
 */
export const COMPATIBILITY_MATRIX: Record<string, string[]> = {
    string: ['TextInput', 'Select', 'RadioGroup'],
    text: ['TextInput'],
    decimal: ['NumberInput', 'Slider', 'Rating', 'TextInput'],
    integer: ['NumberInput', 'Slider', 'Rating', 'TextInput'],
    boolean: ['Toggle', 'Checkbox'],
    date: ['DatePicker', 'TextInput'],
    dateTime: ['DatePicker', 'TextInput'],
    time: ['DatePicker', 'TextInput'],
    uri: ['TextInput'],
    choice: ['Select', 'RadioGroup', 'TextInput'],
    multiChoice: ['CheckboxGroup'],
    attachment: ['FileUpload', 'Signature'],
    money: ['MoneyInput', 'NumberInput', 'TextInput'],
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
