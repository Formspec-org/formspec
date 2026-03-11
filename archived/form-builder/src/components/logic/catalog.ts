import type { FormspecItem } from 'formspec-engine';

export type LogicFieldDataType = FormspecItem['dataType'];

export interface LogicFieldOption {
  path: string;
  label: string;
  dataType: LogicFieldDataType;
  section: string;
}

export interface LogicGroupOption {
  path: string;
  label: string;
  section: string;
  fields: LogicFieldOption[];
}

interface LogicCatalog {
  fields: LogicFieldOption[];
  groups: LogicGroupOption[];
}

export function collectLogicCatalog(items: FormspecItem[]): LogicCatalog {
  const fields: LogicFieldOption[] = [];
  const groups: LogicGroupOption[] = [];

  collect(items, null, null, fields, groups);

  return {
    fields,
    groups
  };
}

function collect(
  items: FormspecItem[],
  parentPath: string | null,
  section: string | null,
  fields: LogicFieldOption[],
  groups: LogicGroupOption[]
): void {
  for (const item of items) {
    const path = parentPath ? `${parentPath}.${item.key}` : item.key;
    const nextSection = section ?? item.label ?? item.key;

    if (item.type === 'field') {
      fields.push({
        path,
        label: item.label || item.key,
        dataType: item.dataType,
        section: nextSection
      });
      continue;
    }

    if (item.type === 'group') {
      const groupFields = collectDescendantFields(item.children ?? [], path, nextSection);
      groups.push({
        path,
        label: item.label || item.key,
        section: nextSection,
        fields: groupFields
      });

      if (item.children?.length) {
        collect(item.children, path, nextSection, fields, groups);
      }
    }
  }
}

function collectDescendantFields(items: FormspecItem[], parentPath: string, section: string): LogicFieldOption[] {
  const collected: LogicFieldOption[] = [];

  for (const item of items) {
    const path = `${parentPath}.${item.key}`;
    if (item.type === 'field') {
      collected.push({
        path,
        label: item.label || item.key,
        dataType: item.dataType,
        section
      });
      continue;
    }

    if (item.type === 'group' && item.children?.length) {
      collected.push(...collectDescendantFields(item.children, path, section));
    }
  }

  return collected;
}
