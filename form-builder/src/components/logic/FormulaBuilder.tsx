import type { LogicGroupOption } from './catalog';

type FormulaTemplate = 'sum' | 'count' | 'average' | 'custom';

interface FormulaExpression {
  template: FormulaTemplate;
  groupPath: string;
  fieldPath: string;
  custom: string;
}

interface FormulaBuilderProps {
  value: FormulaExpression;
  groups: LogicGroupOption[];
  testIdPrefix: string;
  onChange: (next: FormulaExpression) => void;
}

const TEMPLATE_BUTTONS: Array<{ value: FormulaTemplate; label: string }> = [
  { value: 'sum', label: 'Sum' },
  { value: 'count', label: 'Count' },
  { value: 'average', label: 'Average' },
  { value: 'custom', label: 'Custom' }
];

export function FormulaBuilder(props: FormulaBuilderProps) {
  const availableGroups = props.groups.filter((group) => group.fields.length > 0 || group.path === props.value.groupPath);
  const hasGroups = availableGroups.length > 0;

  const selectedGroup = availableGroups.find((group) => group.path === props.value.groupPath) ?? availableGroups[0];
  const selectedField = selectedGroup?.fields.find((field) => field.path === props.value.fieldPath) ?? selectedGroup?.fields[0];

  const updateTemplate = (template: FormulaTemplate) => {
    if (template === 'custom') {
      const nextCustom =
        props.value.template === 'custom' && props.value.custom.trim().length
          ? props.value.custom
          : serializeFormulaExpression(props.value);
      props.onChange({
        ...props.value,
        template,
        custom: nextCustom
      });
      return;
    }

    const nextGroupPath = selectedGroup?.path ?? '';
    const nextFieldPath = selectedField?.path ?? '';
    props.onChange({
      ...props.value,
      template,
      groupPath: nextGroupPath,
      fieldPath: nextFieldPath
    });
  };

  return (
    <div class="logic-builder" data-testid={`${props.testIdPrefix}-builder`}>
      <div class="formula-builder__templates" role="group" aria-label="Formula templates">
        {TEMPLATE_BUTTONS.map((template) => (
          <button
            key={template.value}
            type="button"
            data-testid={`${props.testIdPrefix}-template-${template.value}`}
            class={`formula-builder__template-button ${props.value.template === template.value ? 'is-active' : ''}`}
            onClick={() => {
              updateTemplate(template.value);
            }}
          >
            {template.label}
          </button>
        ))}
      </div>

      {props.value.template === 'custom' ? (
        <label class="inspector-control">
          <span class="inspector-control__label">Custom formula</span>
          <textarea
            class="inspector-input inspector-input--fel"
            data-testid={`${props.testIdPrefix}-custom-input`}
            value={props.value.custom}
            onInput={(event) => {
              props.onChange({
                ...props.value,
                custom: (event.currentTarget as HTMLTextAreaElement).value
              });
            }}
          />
        </label>
      ) : hasGroups ? (
        <>
          <label class="inspector-control">
            <span class="inspector-control__label">Group</span>
            <select
              class="inspector-input"
              data-testid={`${props.testIdPrefix}-group`}
              value={selectedGroup?.path ?? ''}
              onChange={(event) => {
                const groupPath = (event.currentTarget as HTMLSelectElement).value;
                const nextGroup = availableGroups.find((group) => group.path === groupPath);
                props.onChange({
                  ...props.value,
                  groupPath,
                  fieldPath: nextGroup?.fields[0]?.path ?? ''
                });
              }}
            >
              {availableGroups.map((group) => (
                <option key={group.path} value={group.path}>
                  {group.label}
                </option>
              ))}
            </select>
          </label>

          {props.value.template === 'sum' || props.value.template === 'average' ? (
            <label class="inspector-control">
              <span class="inspector-control__label">Field</span>
              <select
                class="inspector-input"
                data-testid={`${props.testIdPrefix}-field`}
                value={selectedField?.path ?? ''}
                onChange={(event) => {
                  props.onChange({
                    ...props.value,
                    fieldPath: (event.currentTarget as HTMLSelectElement).value
                  });
                }}
              >
                {(selectedGroup?.fields ?? []).map((field) => (
                  <option key={field.path} value={field.path}>
                    {field.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </>
      ) : (
        <p class="inspector-hint">Add a group with child fields to use formula templates.</p>
      )}
    </div>
  );
}

export function createDefaultFormulaExpression(groups: LogicGroupOption[]): FormulaExpression {
  const firstGroup = groups.find((group) => group.fields.length > 0) ?? groups[0];
  if (!firstGroup) {
    return {
      template: 'custom',
      groupPath: '',
      fieldPath: '',
      custom: ''
    };
  }

  return {
    template: 'sum',
    groupPath: firstGroup.path,
    fieldPath: firstGroup.fields[0]?.path ?? '',
    custom: ''
  };
}

export function parseFormulaExpression(rawExpression: string, groups: LogicGroupOption[]): FormulaExpression | null {
  const expression = rawExpression.trim();
  if (!expression.length) {
    return createDefaultFormulaExpression(groups);
  }

  const countMatch = expression.match(/^count\(\s*\$([^\[\]\s]+)\[\*\]\s*\)$/i);
  if (countMatch) {
    return {
      template: 'count',
      groupPath: countMatch[1],
      fieldPath: '',
      custom: expression
    };
  }

  const aggregateMatch = expression.match(/^(sum|average)\(\s*\$([^\[\]\s]+)\[\*\]\.([^\)]+)\s*\)$/i);
  if (aggregateMatch) {
    const template = aggregateMatch[1].toLowerCase() as FormulaTemplate;
    const groupPath = aggregateMatch[2];
    const childPath = aggregateMatch[3].trim();
    return {
      template,
      groupPath,
      fieldPath: `${groupPath}.${childPath}`,
      custom: expression
    };
  }

  return {
    template: 'custom',
    groupPath: '',
    fieldPath: '',
    custom: expression
  };
}

export function serializeFormulaExpression(expression: FormulaExpression): string {
  if (expression.template === 'custom') {
    return expression.custom.trim();
  }

  if (!expression.groupPath.trim().length) {
    return '';
  }

  if (expression.template === 'count') {
    return `count($${expression.groupPath}[*])`;
  }

  const prefix = `${expression.groupPath}.`;
  const fieldSuffix = expression.fieldPath.startsWith(prefix)
    ? expression.fieldPath.slice(prefix.length)
    : expression.fieldPath;

  if (!fieldSuffix.trim().length) {
    return '';
  }

  return `${expression.template}($${expression.groupPath}[*].${fieldSuffix})`;
}
