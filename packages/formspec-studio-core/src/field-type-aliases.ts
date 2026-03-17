/** @filedesc Resolves field type aliases and widget hints to canonical dataTypes. */
import { HelperError } from './helper-types.js';
import {
  KNOWN_COMPONENT_TYPES,
  SPEC_WIDGET_TO_COMPONENT,
  COMPONENT_TO_HINT,
} from 'formspec-types';

export interface ResolvedFieldType {
  dataType: string;
  defaultWidget: string;
  /** Spec-normative default widgetHint for this dataType (e.g. "textarea" for text). */
  defaultWidgetHint?: string;
  constraintExpr?: string;
}

const FIELD_TYPE_MAP: Record<string, { dataType: string; defaultWidget: string; defaultWidgetHint?: string; constraintExpr?: string }> = {
  text:        { dataType: 'text',        defaultWidget: 'TextInput',     defaultWidgetHint: 'textarea' },
  string:      { dataType: 'string',      defaultWidget: 'TextInput' },
  integer:     { dataType: 'integer',     defaultWidget: 'NumberInput' },
  decimal:     { dataType: 'decimal',     defaultWidget: 'NumberInput' },
  number:      { dataType: 'decimal',     defaultWidget: 'NumberInput' },
  boolean:     { dataType: 'boolean',     defaultWidget: 'Toggle' },
  date:        { dataType: 'date',        defaultWidget: 'DatePicker' },
  datetime:    { dataType: 'dateTime',    defaultWidget: 'DatePicker' },
  dateTime:    { dataType: 'dateTime',    defaultWidget: 'DatePicker' },
  time:        { dataType: 'time',        defaultWidget: 'DatePicker' },
  url:         { dataType: 'uri',         defaultWidget: 'TextInput' },
  uri:         { dataType: 'uri',         defaultWidget: 'TextInput' },
  file:        { dataType: 'attachment',  defaultWidget: 'FileUpload' },
  attachment:  { dataType: 'attachment',  defaultWidget: 'FileUpload' },
  signature:   { dataType: 'attachment',  defaultWidget: 'Signature' },
  choice:      { dataType: 'choice',      defaultWidget: 'Select' },
  multichoice: { dataType: 'multiChoice', defaultWidget: 'CheckboxGroup' },
  multiChoice: { dataType: 'multiChoice', defaultWidget: 'CheckboxGroup' },
  currency:    { dataType: 'money',       defaultWidget: 'MoneyInput' },
  money:       { dataType: 'money',       defaultWidget: 'MoneyInput' },
  rating:      { dataType: 'integer',     defaultWidget: 'Rating' },
  slider:      { dataType: 'decimal',     defaultWidget: 'Slider' },
  email:       { dataType: 'string',      defaultWidget: 'TextInput', constraintExpr: "matches($, '^[^\\\\s@]+@[^\\\\s@]+\\\\.[^\\\\s@]+$')" },
  phone:       { dataType: 'string',      defaultWidget: 'TextInput', constraintExpr: "matches($, '^[+]?[0-9\\s\\-().]+$')" },
};

/**
 * Authoring-only short aliases that extend the canonical spec vocabulary.
 * These are convenience aliases for the MCP/studio authoring layer only.
 * All keys are lowercase — never PascalCase.
 */
const AUTHORING_ALIASES: Record<string, string> = {
  select:  'Select',
  file:    'FileUpload',
  date:    'DatePicker',
  money:   'MoneyInput',
  number:  'NumberInput',
  text:    'TextInput',
};

/**
 * Build the full alias map by converting the canonical spec map to camelCase keys
 * and merging with authoring-only aliases. This is derived from the canonical
 * SPEC_WIDGET_TO_COMPONENT in formspec-layout — never hand-maintained.
 */
function buildWidgetAliasMap(): Record<string, string> {
  const map: Record<string, string> = {};
  // Canonical spec hints (lowercase → PascalCase from layout)
  // Convert to camelCase for authoring layer (spec keys are all-lowercase)
  for (const [key, component] of Object.entries(SPEC_WIDGET_TO_COMPONENT)) {
    // Find the camelCase form: 'textinput' → 'textInput', 'checkbox' → 'checkbox'
    // We keep a curated camelCase list for the ones that differ
    map[key] = component;
  }
  // Overlay camelCase forms for multi-word hints
  map['textInput'] = 'TextInput';
  map['richText'] = 'TextInput';
  map['numberInput'] = 'NumberInput';
  map['yesNo'] = 'Toggle';
  map['datePicker'] = 'DatePicker';
  map['dateTimePicker'] = 'DatePicker';
  map['timePicker'] = 'DatePicker';
  map['dateInput'] = 'TextInput';
  map['dateTimeInput'] = 'TextInput';
  map['timeInput'] = 'TextInput';
  map['checkboxGroup'] = 'CheckboxGroup';
  map['multiSelect'] = 'CheckboxGroup';
  map['fileUpload'] = 'FileUpload';
  map['moneyInput'] = 'MoneyInput';
  map['urlInput'] = 'TextInput';
  // Authoring aliases
  Object.assign(map, AUTHORING_ALIASES);
  return map;
}

const WIDGET_ALIAS_MAP = buildWidgetAliasMap();

export function resolveFieldType(type: string): ResolvedFieldType {
  const entry = FIELD_TYPE_MAP[type];
  if (!entry) {
    throw new HelperError('INVALID_TYPE', `Unknown field type "${type}"`, {
      validTypes: Object.keys(FIELD_TYPE_MAP),
    });
  }
  return { ...entry };
}

export function resolveWidget(widget: string): string {
  if (WIDGET_ALIAS_MAP[widget]) return WIDGET_ALIAS_MAP[widget];
  if (KNOWN_COMPONENT_TYPES.has(widget)) return widget;
  throw new HelperError('INVALID_WIDGET', `Unknown widget "${widget}"`, {
    validWidgets: Object.keys(WIDGET_ALIAS_MAP),
  });
}

export function widgetHintFor(aliasOrComponent: string): string | undefined {
  // "text" as a short alias doesn't carry a widgetHint (it's the TextInput default)
  if (aliasOrComponent === 'text') return undefined;
  if (WIDGET_ALIAS_MAP[aliasOrComponent]) return aliasOrComponent;
  if (KNOWN_COMPONENT_TYPES.has(aliasOrComponent)) {
    if (aliasOrComponent === 'TextInput') return undefined;
    // Use the canonical reverse map from layout
    return COMPONENT_TO_HINT[aliasOrComponent] ?? aliasOrComponent.toLowerCase();
  }
  return undefined;
}

export function isTextareaWidget(widget: string): boolean {
  return widget === 'textarea';
}

export { FIELD_TYPE_MAP, WIDGET_ALIAS_MAP };
