import type { FormspecBind, FormspecItem } from 'formspec-engine';
import { buildExtensionCatalog } from '../../state/extensions';
import type { LoadedExtensionRegistry } from '../../state/project';

export type SlashTemplateCategory = 'Common' | 'Structure' | 'Display' | 'Advanced' | 'Saved';

export interface FieldTemplate {
  id: string;
  name: string;
  category: SlashTemplateCategory;
  type: 'field' | 'group' | 'display';
  componentType: string;
  dataType?: FormspecItem['dataType'];
  keyPrefix: string;
  defaultLabel: string;
  extensionName?: string;
  extensionBaseType?: string;
  /** Pre-configured item properties applied when inserting from this template. */
  itemSeed?: Partial<FormspecItem>;
  /** Pre-configured bind properties applied when inserting from this template. */
  bindSeed?: Partial<Omit<FormspecBind, 'path'>>;
}

const USER_FIELD_TEMPLATES_KEY = 'formspec.studio.fieldTemplates.v1';

interface SavedUserFieldTemplate {
  id: string;
  name: string;
  savedAt: string;
  itemSeed: Partial<FormspecItem>;
  bindSeed?: Partial<Omit<FormspecBind, 'path'>>;
}

function loadUserFieldTemplates(): SavedUserFieldTemplate[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(USER_FIELD_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSavedTemplate) as SavedUserFieldTemplate[];
  } catch {
    return [];
  }
}

export function saveUserFieldTemplate(template: SavedUserFieldTemplate): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  const existing = loadUserFieldTemplates();
  const withoutDupe = existing.filter((t) => t.id !== template.id);
  const next = [template, ...withoutDupe].slice(0, 50);
  window.localStorage.setItem(USER_FIELD_TEMPLATES_KEY, JSON.stringify(next));
}

function deleteUserFieldTemplate(id: string): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  const existing = loadUserFieldTemplates();
  const next = existing.filter((t) => t.id !== id);
  window.localStorage.setItem(USER_FIELD_TEMPLATES_KEY, JSON.stringify(next));
}

function isValidSavedTemplate(value: unknown): value is SavedUserFieldTemplate {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.savedAt === 'string' &&
    typeof candidate.itemSeed === 'object' &&
    candidate.itemSeed !== null
  );
}

const FIELD_TEMPLATES: FieldTemplate[] = [
  {
    id: 'short-answer',
    name: 'Short Answer',
    category: 'Common',
    type: 'field',
    componentType: 'TextInput',
    dataType: 'string',
    keyPrefix: 'shortAnswer',
    defaultLabel: 'Short answer'
  },
  {
    id: 'long-answer',
    name: 'Long Answer',
    category: 'Common',
    type: 'field',
    componentType: 'TextInput',
    dataType: 'text',
    keyPrefix: 'longAnswer',
    defaultLabel: 'Long answer'
  },
  {
    id: 'dropdown',
    name: 'Dropdown',
    category: 'Common',
    type: 'field',
    componentType: 'Select',
    dataType: 'choice',
    keyPrefix: 'dropdown',
    defaultLabel: 'Dropdown'
  },
  {
    id: 'multiple-choice',
    name: 'Multiple Choice',
    category: 'Common',
    type: 'field',
    componentType: 'CheckboxGroup',
    dataType: 'multiChoice',
    keyPrefix: 'multipleChoice',
    defaultLabel: 'Multiple choice'
  },
  {
    id: 'number',
    name: 'Number',
    category: 'Common',
    type: 'field',
    componentType: 'NumberInput',
    dataType: 'number',
    keyPrefix: 'number',
    defaultLabel: 'Number'
  },
  {
    id: 'date',
    name: 'Date',
    category: 'Common',
    type: 'field',
    componentType: 'DatePicker',
    dataType: 'date',
    keyPrefix: 'date',
    defaultLabel: 'Date'
  },
  {
    id: 'email',
    name: 'Email',
    category: 'Common',
    type: 'field',
    componentType: 'TextInput',
    dataType: 'string',
    keyPrefix: 'email',
    defaultLabel: 'Email'
  },
  {
    id: 'yes-no',
    name: 'Yes / No',
    category: 'Common',
    type: 'field',
    componentType: 'Toggle',
    dataType: 'boolean',
    keyPrefix: 'yesNo',
    defaultLabel: 'Yes / No'
  },
  {
    id: 'file-upload',
    name: 'File Upload',
    category: 'Common',
    type: 'field',
    componentType: 'FileUpload',
    dataType: 'attachment',
    keyPrefix: 'fileUpload',
    defaultLabel: 'File upload'
  },
  {
    id: 'group',
    name: 'Section Group',
    category: 'Structure',
    type: 'group',
    componentType: 'Stack',
    keyPrefix: 'group',
    defaultLabel: 'Section'
  },
  {
    id: 'repeating-group',
    name: 'Repeating Group',
    category: 'Structure',
    type: 'group',
    componentType: 'Stack',
    keyPrefix: 'repeatGroup',
    defaultLabel: 'Repeating section'
  },
  {
    id: 'heading',
    name: 'Heading',
    category: 'Display',
    type: 'display',
    componentType: 'Heading',
    keyPrefix: 'heading',
    defaultLabel: 'Heading'
  },
  {
    id: 'instructions',
    name: 'Instructions',
    category: 'Display',
    type: 'display',
    componentType: 'Text',
    keyPrefix: 'instructions',
    defaultLabel: 'Instructions'
  },
  {
    id: 'display',
    name: 'Display Text',
    category: 'Display',
    type: 'display',
    componentType: 'Text',
    keyPrefix: 'display',
    defaultLabel: 'Display text'
  },
  {
    id: 'checkbox',
    name: 'Checkbox',
    category: 'Advanced',
    type: 'field',
    componentType: 'Toggle',
    dataType: 'boolean',
    keyPrefix: 'checkbox',
    defaultLabel: 'Checkbox'
  },
  {
    id: 'money',
    name: 'Money',
    category: 'Advanced',
    type: 'field',
    componentType: 'MoneyInput',
    dataType: 'money',
    keyPrefix: 'money',
    defaultLabel: 'Amount'
  },
  {
    id: 'slider',
    name: 'Slider',
    category: 'Advanced',
    type: 'field',
    componentType: 'Slider',
    dataType: 'number',
    keyPrefix: 'slider',
    defaultLabel: 'Slider'
  },
  {
    id: 'rating',
    name: 'Rating',
    category: 'Advanced',
    type: 'field',
    componentType: 'Rating',
    dataType: 'integer',
    keyPrefix: 'rating',
    defaultLabel: 'Rating'
  },
  {
    id: 'signature',
    name: 'Signature',
    category: 'Advanced',
    type: 'field',
    componentType: 'Signature',
    dataType: 'string',
    keyPrefix: 'signature',
    defaultLabel: 'Signature'
  },
  {
    id: 'page-break',
    name: 'Page Break',
    category: 'Structure',
    type: 'display',
    componentType: 'Page',
    keyPrefix: 'pageBreak',
    defaultLabel: 'Page break'
  },
  {
    id: 'divider',
    name: 'Divider',
    category: 'Display',
    type: 'display',
    componentType: 'Divider',
    keyPrefix: 'divider',
    defaultLabel: 'Divider'
  },
  {
    id: 'alert',
    name: 'Alert',
    category: 'Display',
    type: 'display',
    componentType: 'Alert',
    keyPrefix: 'alert',
    defaultLabel: 'Alert'
  },
  {
    id: 'badge',
    name: 'Badge',
    category: 'Display',
    type: 'display',
    componentType: 'Badge',
    keyPrefix: 'badge',
    defaultLabel: 'Badge'
  },
  {
    id: 'progress-bar',
    name: 'Progress Bar',
    category: 'Display',
    type: 'display',
    componentType: 'ProgressBar',
    keyPrefix: 'progressBar',
    defaultLabel: 'Progress bar'
  },
  {
    id: 'summary',
    name: 'Summary',
    category: 'Display',
    type: 'display',
    componentType: 'Summary',
    keyPrefix: 'summary',
    defaultLabel: 'Summary'
  },
  {
    id: 'validation-summary',
    name: 'Validation Summary',
    category: 'Display',
    type: 'display',
    componentType: 'ValidationSummary',
    keyPrefix: 'validationSummary',
    defaultLabel: 'Validation summary'
  },
  {
    id: 'submit-button',
    name: 'Submit Button',
    category: 'Structure',
    type: 'display',
    componentType: 'SubmitButton',
    keyPrefix: 'submitButton',
    defaultLabel: 'Submit'
  },
  {
    id: 'card',
    name: 'Card',
    category: 'Structure',
    type: 'group',
    componentType: 'Card',
    keyPrefix: 'card',
    defaultLabel: 'Card'
  },
  {
    id: 'collapsible-section',
    name: 'Collapsible',
    category: 'Structure',
    type: 'group',
    componentType: 'Collapsible',
    keyPrefix: 'collapsibleSection',
    defaultLabel: 'Collapsible section'
  },
  {
    id: 'conditional-group',
    name: 'Conditional Group',
    category: 'Structure',
    type: 'group',
    componentType: 'ConditionalGroup',
    keyPrefix: 'conditionalGroup',
    defaultLabel: 'Conditional group'
  },
  {
    id: 'spacer',
    name: 'Spacer',
    category: 'Structure',
    type: 'display',
    componentType: 'Spacer',
    keyPrefix: 'spacer',
    defaultLabel: 'Spacer'
  },
  {
    id: 'panel',
    name: 'Panel',
    category: 'Structure',
    type: 'group',
    componentType: 'Panel',
    keyPrefix: 'panel',
    defaultLabel: 'Panel'
  },
  {
    id: 'modal',
    name: 'Modal',
    category: 'Structure',
    type: 'group',
    componentType: 'Modal',
    keyPrefix: 'modal',
    defaultLabel: 'Modal'
  },
  {
    id: 'popover',
    name: 'Popover',
    category: 'Structure',
    type: 'group',
    componentType: 'Popover',
    keyPrefix: 'popover',
    defaultLabel: 'Popover'
  },
  {
    id: 'page',
    name: 'Page',
    category: 'Layout',
    type: 'group',
    componentType: 'Page',
    keyPrefix: 'page',
    defaultLabel: 'Page'
  },
  {
    id: 'grid',
    name: 'Grid',
    category: 'Layout',
    type: 'group',
    componentType: 'Grid',
    keyPrefix: 'grid',
    defaultLabel: 'Grid'
  },
  {
    id: 'columns',
    name: 'Columns',
    category: 'Layout',
    type: 'group',
    componentType: 'Columns',
    keyPrefix: 'columns',
    defaultLabel: 'Columns'
  },
  {
    id: 'tabs',
    name: 'Tabs',
    category: 'Layout',
    type: 'group',
    componentType: 'Tabs',
    keyPrefix: 'tabs',
    defaultLabel: 'Tabs'
  },
  {
    id: 'accordion',
    name: 'Accordion',
    category: 'Layout',
    type: 'group',
    componentType: 'Accordion',
    keyPrefix: 'accordion',
    defaultLabel: 'Accordion'
  }
];

export function filterTemplates(query: string, templates: FieldTemplate[] = FIELD_TEMPLATES): FieldTemplate[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return templates;
  }

  const results: Array<{ template: FieldTemplate; score: number }> = [];

  for (const template of templates) {
    const searchable =
      `${template.name} ${template.category} ${template.type} ${template.componentType} ${template.dataType ?? ''} ${template.extensionName ?? ''}`.toLowerCase();

    const score = scoreTemplateMatch(searchable, template.name.toLowerCase(), normalized);
    if (score >= 0) {
      results.push({ template, score });
    }
  }

  return results.sort((a, b) => b.score - a.score).map((r) => r.template);
}

function scoreTemplateMatch(searchable: string, name: string, query: string): number {
  if (searchable.includes(query)) {
    const nameIndex = name.indexOf(query);
    return nameIndex === 0 ? 300 : nameIndex >= 0 ? 200 : 100;
  }

  return scoreSubsequence(name, query);
}

function scoreSubsequence(text: string, token: string): number {
  let textIndex = 0;
  let tokenIndex = 0;
  let gaps = 0;
  let contiguousRuns = 0;
  let activeRun = 0;

  while (textIndex < text.length && tokenIndex < token.length) {
    if (text[textIndex] === token[tokenIndex]) {
      tokenIndex += 1;
      activeRun += 1;
    } else if (activeRun > 0) {
      contiguousRuns += activeRun * activeRun;
      activeRun = 0;
      gaps += 1;
    } else {
      gaps += 1;
    }
    textIndex += 1;
  }

  if (tokenIndex < token.length) {
    return -1;
  }

  contiguousRuns += activeRun * activeRun;
  return Math.max(0, contiguousRuns - gaps);
}

export function buildSlashTemplates(registries: LoadedExtensionRegistry[] = []): FieldTemplate[] {
  const catalog = buildExtensionCatalog(registries);
  const extensionTemplates: FieldTemplate[] = catalog.dataTypes.map((dataType) => ({
    id: `extension-${dataType.name}`,
    name: dataType.label,
    category: 'Advanced',
    type: 'field',
    componentType: resolveComponentTypeForBaseType(dataType.baseType),
    dataType: resolveDataTypeForBaseType(dataType.baseType),
    keyPrefix: resolveTemplateKeyPrefix(dataType.name),
    defaultLabel: dataType.label,
    extensionName: dataType.name,
    extensionBaseType: dataType.baseType
  }));

  const userTemplates: FieldTemplate[] = loadUserFieldTemplates().map((saved) => ({
    id: `user-${saved.id}`,
    name: saved.name,
    category: 'Saved',
    type: ((saved.itemSeed as FormspecItem | undefined)?.type ?? 'field') as FieldTemplate['type'],
    componentType:
      (saved.itemSeed as { presentation?: { widgetHint?: string } } | undefined)?.presentation?.widgetHint ?? 'TextInput',
    dataType: (saved.itemSeed as FormspecItem | undefined)?.dataType,
    keyPrefix: resolveTemplateKeyPrefix(saved.name),
    defaultLabel: (saved.itemSeed as FormspecItem | undefined)?.label ?? saved.name,
    itemSeed: saved.itemSeed,
    bindSeed: saved.bindSeed
  }));

  return [...FIELD_TEMPLATES, ...extensionTemplates, ...userTemplates];
}

function resolveComponentTypeForBaseType(baseType: string): string {
  if (baseType === 'integer' || baseType === 'decimal' || baseType === 'number') {
    return 'NumberInput';
  }
  if (baseType === 'boolean') {
    return 'Toggle';
  }
  if (baseType === 'date' || baseType === 'dateTime' || baseType === 'time') {
    return 'DatePicker';
  }
  return 'TextInput';
}

function resolveDataTypeForBaseType(baseType: string): FormspecItem['dataType'] {
  if (baseType === 'integer') {
    return 'integer';
  }
  if (baseType === 'decimal') {
    return 'decimal';
  }
  if (baseType === 'boolean') {
    return 'boolean';
  }
  if (baseType === 'date') {
    return 'date';
  }
  if (baseType === 'dateTime') {
    return 'dateTime';
  }
  if (baseType === 'time') {
    return 'time';
  }
  if (baseType === 'uri') {
    return 'uri';
  }
  return 'string';
}

function resolveTemplateKeyPrefix(extensionName: string): string {
  const segments = extensionName
    .replace(/^x-/, '')
    .split('-')
    .filter(Boolean);
  if (!segments.length) {
    return 'field';
  }

  return segments
    .map((segment, index) => {
      if (index === 0) {
        return segment;
      }
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join('');
}
