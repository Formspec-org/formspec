import type { FormspecItem } from 'formspec-engine';
import { buildExtensionCatalog } from '../../state/extensions';
import type { LoadedExtensionRegistry } from '../../state/project';

export type SlashTemplateCategory = 'Common' | 'Structure' | 'Display' | 'Advanced';

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
}

export const FIELD_TEMPLATES: FieldTemplate[] = [
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
    componentType: 'Textarea',
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
    componentType: 'ChoiceGroup',
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
    componentType: 'DateInput',
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
    componentType: 'Checkbox',
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
    componentType: 'Section',
    keyPrefix: 'group',
    defaultLabel: 'Section'
  },
  {
    id: 'repeating-group',
    name: 'Repeating Group',
    category: 'Structure',
    type: 'group',
    componentType: 'Section',
    keyPrefix: 'repeatGroup',
    defaultLabel: 'Repeating section'
  },
  {
    id: 'heading',
    name: 'Heading',
    category: 'Display',
    type: 'display',
    componentType: 'DisplayText',
    keyPrefix: 'heading',
    defaultLabel: 'Heading'
  },
  {
    id: 'instructions',
    name: 'Instructions',
    category: 'Display',
    type: 'display',
    componentType: 'DisplayText',
    keyPrefix: 'instructions',
    defaultLabel: 'Instructions'
  },
  {
    id: 'display',
    name: 'Display Text',
    category: 'Display',
    type: 'display',
    componentType: 'DisplayText',
    keyPrefix: 'display',
    defaultLabel: 'Display text'
  },
  {
    id: 'checkbox',
    name: 'Checkbox',
    category: 'Advanced',
    type: 'field',
    componentType: 'Checkbox',
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
  }
];

export function filterTemplates(query: string, templates: FieldTemplate[] = FIELD_TEMPLATES): FieldTemplate[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return templates;
  }

  return templates.filter((template) => {
    const searchable =
      `${template.name} ${template.category} ${template.type} ${template.componentType} ${template.dataType ?? ''} ${template.extensionName ?? ''}`.toLowerCase();
    return searchable.includes(normalized);
  });
}

export function buildSlashTemplates(registries: LoadedExtensionRegistry[] = []): FieldTemplate[] {
  const catalog = buildExtensionCatalog(registries);
  if (!catalog.dataTypes.length) {
    return FIELD_TEMPLATES;
  }

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

  return [...FIELD_TEMPLATES, ...extensionTemplates];
}

function resolveComponentTypeForBaseType(baseType: string): string {
  if (baseType === 'integer' || baseType === 'decimal' || baseType === 'number') {
    return 'NumberInput';
  }
  if (baseType === 'boolean') {
    return 'Checkbox';
  }
  if (baseType === 'date' || baseType === 'dateTime' || baseType === 'time') {
    return 'DateInput';
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
