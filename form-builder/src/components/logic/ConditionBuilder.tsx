import type { JSX } from 'preact';
import type { LogicFieldDataType, LogicFieldOption } from './catalog';
import { parseFelLiteral, quoteFelString, splitTopLevelLogical, stripOuterParens } from './expression-utils';

const PATH_TOKEN = '[A-Za-z0-9_.\\[\\]*-]+';

const NUMERIC_DATA_TYPES = new Set<LogicFieldDataType>(['integer', 'decimal', 'number', 'money']);
const TEXT_DATA_TYPES = new Set<LogicFieldDataType>(['string', 'text', 'choice', 'multiChoice', 'uri', 'attachment']);

export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'contains'
  | 'startsWith'
  | 'isEmpty'
  | 'notEmpty'
  | 'isTrue'
  | 'isFalse';

export interface ConditionRow {
  fieldPath: string;
  operator: ConditionOperator;
  value: string;
  value2: string;
}

export interface ConditionExpression {
  logic: 'and' | 'or';
  rows: ConditionRow[];
}

export interface ConditionBuilderProps {
  value: ConditionExpression;
  fields: LogicFieldOption[];
  testIdPrefix: string;
  onChange: (next: ConditionExpression) => void;
}

export function ConditionBuilder(props: ConditionBuilderProps) {
  const rows = props.value.rows;
  const fieldByPath = new Map(props.fields.map((field) => [field.path, field]));

  const updateRow = (index: number, patch: Partial<ConditionRow>) => {
    const nextRows = rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row));
    props.onChange({
      logic: props.value.logic,
      rows: nextRows
    });
  };

  const removeRow = (index: number) => {
    props.onChange({
      logic: props.value.logic,
      rows: rows.filter((_, rowIndex) => rowIndex !== index)
    });
  };

  const addRow = () => {
    props.onChange({
      logic: props.value.logic,
      rows: [...rows, createDefaultConditionRow(props.fields)]
    });
  };

  return (
    <div class="logic-builder" data-testid={`${props.testIdPrefix}-builder`}>
      {!rows.length ? (
        <p class="logic-builder__empty">No condition set.</p>
      ) : null}
      {rows.length > 1 ? (
        <label class="inspector-control logic-builder__logic-select">
          <span class="inspector-control__label">Match</span>
          <select
            class="inspector-input"
            data-testid={`${props.testIdPrefix}-logic`}
            value={props.value.logic}
            onChange={(event) => {
              const logic = (event.currentTarget as HTMLSelectElement).value as ConditionExpression['logic'];
              props.onChange({
                ...props.value,
                logic
              });
            }}
          >
            <option value="and">All conditions (AND)</option>
            <option value="or">Any condition (OR)</option>
          </select>
        </label>
      ) : null}

      {rows.map((row, index) => {
        const field = fieldByPath.get(row.fieldPath);
        const operatorOptions = getConditionOperatorOptions(field?.dataType);
        const normalizedOperator = ensureOperatorForType(row.operator, field?.dataType);

        return (
          <div class="logic-builder__row" key={`${row.fieldPath}:${index}`}>
            <label class="inspector-control">
              <span class="inspector-control__label">Field</span>
              <select
                class="inspector-input"
                data-testid={`${props.testIdPrefix}-row-${index}-field`}
                value={row.fieldPath}
                onChange={(event) => {
                  const nextPath = (event.currentTarget as HTMLSelectElement).value;
                  const nextField = fieldByPath.get(nextPath);
                  const nextOperator = ensureOperatorForType(normalizedOperator, nextField?.dataType);
                  updateRow(index, {
                    fieldPath: nextPath,
                    operator: nextOperator,
                    value: preservesFirstValue(nextOperator) ? row.value : '',
                    value2: nextOperator === 'between' ? row.value2 : ''
                  });
                }}
              >
                {renderFieldOptions(props.fields, row.fieldPath)}
              </select>
            </label>

            <label class="inspector-control">
              <span class="inspector-control__label">Operator</span>
              <select
                class="inspector-input"
                data-testid={`${props.testIdPrefix}-row-${index}-operator`}
                value={normalizedOperator}
                onChange={(event) => {
                  const nextOperator = (event.currentTarget as HTMLSelectElement).value as ConditionOperator;
                  updateRow(index, {
                    operator: nextOperator,
                    value: preservesFirstValue(nextOperator) ? row.value : '',
                    value2: nextOperator === 'between' ? row.value2 : ''
                  });
                }}
              >
                {operatorOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {needsFirstValue(normalizedOperator) ? (
              <label class="inspector-control">
                <span class="inspector-control__label">Value</span>
                <input
                  class="inspector-input"
                  data-testid={`${props.testIdPrefix}-row-${index}-value`}
                  type={usesNumericInput(normalizedOperator, field?.dataType) ? 'number' : 'text'}
                  value={row.value}
                  onInput={(event) => {
                    updateRow(index, { value: (event.currentTarget as HTMLInputElement).value });
                  }}
                />
              </label>
            ) : null}

            {normalizedOperator === 'between' ? (
              <label class="inspector-control">
                <span class="inspector-control__label">And</span>
                <input
                  class="inspector-input"
                  data-testid={`${props.testIdPrefix}-row-${index}-value2`}
                  type="number"
                  value={row.value2}
                  onInput={(event) => {
                    updateRow(index, { value2: (event.currentTarget as HTMLInputElement).value });
                  }}
                />
              </label>
            ) : null}

            <button
              class="logic-builder__row-action"
              type="button"
              data-testid={`${props.testIdPrefix}-row-${index}-remove`}
              onClick={() => {
                removeRow(index);
              }}
            >
              Remove
            </button>
          </div>
        );
      })}

      <button
        class="logic-builder__add"
        type="button"
        data-testid={`${props.testIdPrefix}-add-row`}
        onClick={addRow}
      >
        + Add condition
      </button>
    </div>
  );
}

export function createDefaultConditionExpression(fields: LogicFieldOption[]): ConditionExpression {
  return {
    logic: 'and',
    rows: [createDefaultConditionRow(fields)]
  };
}

export function serializeConditionExpression(expression: ConditionExpression, fields: LogicFieldOption[]): string {
  if (!expression.rows.length) {
    return '';
  }

  const fieldByPath = new Map(fields.map((field) => [field.path, field]));
  const clauses = expression.rows
    .map((row) => serializeConditionRow(row, fieldByPath.get(row.fieldPath)))
    .filter((clause): clause is string => Boolean(clause));

  if (!clauses.length) {
    return '';
  }

  return clauses.join(` ${expression.logic} `);
}

export function parseConditionExpression(rawExpression: string, fields: LogicFieldOption[]): ConditionExpression | null {
  const expression = rawExpression.trim();
  if (!expression.length) {
    return { logic: 'and', rows: [] };
  }

  const split = splitTopLevelLogical(expression);
  if (split.mixed) {
    return null;
  }

  const logic = split.operator ?? 'and';
  const rows: ConditionRow[] = [];

  for (const clause of split.clauses) {
    const parsed = parseConditionClause(clause);
    if (!parsed) {
      return null;
    }
    rows.push(parsed);
  }

  if (!rows.length) {
    return null;
  }

  return {
    logic,
    rows
  };
}

function createDefaultConditionRow(fields: LogicFieldOption[]): ConditionRow {
  const firstField = fields[0];
  const operator = ensureOperatorForType('eq', firstField?.dataType);
  return {
    fieldPath: firstField?.path ?? '',
    operator,
    value: '',
    value2: ''
  };
}

function parseConditionClause(rawClause: string): ConditionRow | null {
  const clause = stripOuterParens(rawClause.trim());

  const betweenMatcher = new RegExp(`^\\$(${PATH_TOKEN})\\s*>=\\s*(.+)\\s+and\\s+\\$(${PATH_TOKEN})\\s*<=\\s*(.+)$`, 'i');
  const betweenMatch = clause.match(betweenMatcher);
  if (betweenMatch) {
    const [, leftPath, minLiteral, rightPath, maxLiteral] = betweenMatch;
    if (leftPath !== rightPath) {
      return null;
    }
    return {
      fieldPath: leftPath,
      operator: 'between',
      value: parseFelLiteral(minLiteral).value,
      value2: parseFelLiteral(maxLiteral).value
    };
  }

  const containsMatcher = new RegExp(`^contains\\(\\s*\\$(${PATH_TOKEN})\\s*,\\s*(.+)\\)$`, 'i');
  const containsMatch = clause.match(containsMatcher);
  if (containsMatch) {
    return {
      fieldPath: containsMatch[1],
      operator: 'contains',
      value: parseFelLiteral(containsMatch[2]).value,
      value2: ''
    };
  }

  const startsWithMatcher = new RegExp(`^startsWith\\(\\s*\\$(${PATH_TOKEN})\\s*,\\s*(.+)\\)$`, 'i');
  const startsWithMatch = clause.match(startsWithMatcher);
  if (startsWithMatch) {
    return {
      fieldPath: startsWithMatch[1],
      operator: 'startsWith',
      value: parseFelLiteral(startsWithMatch[2]).value,
      value2: ''
    };
  }

  const isBlankMatcher = new RegExp(`^isBlank\\(\\s*\\$(${PATH_TOKEN})\\s*\\)$`, 'i');
  const isBlankMatch = clause.match(isBlankMatcher);
  if (isBlankMatch) {
    return {
      fieldPath: isBlankMatch[1],
      operator: 'isEmpty',
      value: '',
      value2: ''
    };
  }

  const notBlankMatcher = new RegExp(`^not\\(\\s*isBlank\\(\\s*\\$(${PATH_TOKEN})\\s*\\)\\s*\\)$`, 'i');
  const notBlankMatch = clause.match(notBlankMatcher);
  if (notBlankMatch) {
    return {
      fieldPath: notBlankMatch[1],
      operator: 'notEmpty',
      value: '',
      value2: ''
    };
  }

  const compareMatcher = new RegExp(`^\\$(${PATH_TOKEN})\\s*(=|!=|>=|<=|>|<)\\s*(.+)$`, 'i');
  const compareMatch = clause.match(compareMatcher);
  if (compareMatch) {
    const [, fieldPath, comparator, literalToken] = compareMatch;
    const parsedLiteral = parseFelLiteral(literalToken);

    if ((comparator === '=' || comparator === '!=') && parsedLiteral.kind === 'boolean') {
      const literalIsTrue = parsedLiteral.value === 'true';
      return {
        fieldPath,
        operator: comparator === '=' ? (literalIsTrue ? 'isTrue' : 'isFalse') : literalIsTrue ? 'isFalse' : 'isTrue',
        value: '',
        value2: ''
      };
    }

    const operator = mapComparatorToOperator(comparator);
    if (!operator) {
      return null;
    }

    return {
      fieldPath,
      operator,
      value: parsedLiteral.value,
      value2: ''
    };
  }

  return null;
}

function serializeConditionRow(row: ConditionRow, field: LogicFieldOption | undefined): string | null {
  if (!row.fieldPath.trim().length) {
    return null;
  }

  const fieldRef = `$${row.fieldPath}`;
  const dataType = field?.dataType;

  switch (row.operator) {
    case 'eq': {
      return `${fieldRef} = ${toConditionLiteral(row.value, dataType)}`;
    }
    case 'neq': {
      return `${fieldRef} != ${toConditionLiteral(row.value, dataType)}`;
    }
    case 'gt': {
      return `${fieldRef} > ${toNumericLiteral(row.value)}`;
    }
    case 'gte': {
      return `${fieldRef} >= ${toNumericLiteral(row.value)}`;
    }
    case 'lt': {
      return `${fieldRef} < ${toNumericLiteral(row.value)}`;
    }
    case 'lte': {
      return `${fieldRef} <= ${toNumericLiteral(row.value)}`;
    }
    case 'between': {
      const min = toNumericLiteral(row.value);
      const max = toNumericLiteral(row.value2);
      return `(${fieldRef} >= ${min} and ${fieldRef} <= ${max})`;
    }
    case 'contains': {
      return `contains(${fieldRef}, ${quoteFelString(row.value)})`;
    }
    case 'startsWith': {
      return `startsWith(${fieldRef}, ${quoteFelString(row.value)})`;
    }
    case 'isEmpty': {
      return `isBlank(${fieldRef})`;
    }
    case 'notEmpty': {
      return `not(isBlank(${fieldRef}))`;
    }
    case 'isTrue': {
      return `${fieldRef} = true`;
    }
    case 'isFalse': {
      return `${fieldRef} = false`;
    }
    default: {
      return null;
    }
  }
}

function toConditionLiteral(value: string, dataType: LogicFieldDataType): string {
  if (dataType === 'boolean') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === 'false') {
      return normalized;
    }
    return 'false';
  }

  if (NUMERIC_DATA_TYPES.has(dataType)) {
    return toNumericLiteral(value);
  }

  return quoteFelString(value);
}

function toNumericLiteral(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : '0';
}

function mapComparatorToOperator(comparator: string): ConditionOperator | null {
  switch (comparator) {
    case '=':
      return 'eq';
    case '!=':
      return 'neq';
    case '>':
      return 'gt';
    case '>=':
      return 'gte';
    case '<':
      return 'lt';
    case '<=':
      return 'lte';
    default:
      return null;
  }
}

function ensureOperatorForType(operator: ConditionOperator, dataType: LogicFieldDataType): ConditionOperator {
  const options = getConditionOperatorOptions(dataType);
  if (options.some((option) => option.value === operator)) {
    return operator;
  }
  return options[0].value;
}

function getConditionOperatorOptions(dataType: LogicFieldDataType): Array<{ value: ConditionOperator; label: string }> {
  if (dataType === 'boolean') {
    return [
      { value: 'isTrue', label: 'is true' },
      { value: 'isFalse', label: 'is false' }
    ];
  }

  if (NUMERIC_DATA_TYPES.has(dataType)) {
    return [
      { value: 'eq', label: 'equals' },
      { value: 'neq', label: 'does not equal' },
      { value: 'gt', label: 'greater than' },
      { value: 'gte', label: 'greater than or equal' },
      { value: 'lt', label: 'less than' },
      { value: 'lte', label: 'less than or equal' },
      { value: 'between', label: 'between' },
      { value: 'isEmpty', label: 'is empty' },
      { value: 'notEmpty', label: 'is not empty' }
    ];
  }

  if (TEXT_DATA_TYPES.has(dataType)) {
    return [
      { value: 'eq', label: 'equals' },
      { value: 'neq', label: 'does not equal' },
      { value: 'contains', label: 'contains' },
      { value: 'startsWith', label: 'starts with' },
      { value: 'isEmpty', label: 'is empty' },
      { value: 'notEmpty', label: 'is not empty' }
    ];
  }

  return [
    { value: 'eq', label: 'equals' },
    { value: 'neq', label: 'does not equal' },
    { value: 'isEmpty', label: 'is empty' },
    { value: 'notEmpty', label: 'is not empty' }
  ];
}

function renderFieldOptions(fields: LogicFieldOption[], selectedPath: string): JSX.Element[] {
  if (!fields.length) {
    return [
      <option key="empty" value="">
        No fields available
      </option>
    ];
  }

  const sections = new Map<string, LogicFieldOption[]>();
  for (const field of fields) {
    const bucket = sections.get(field.section) ?? [];
    bucket.push(field);
    sections.set(field.section, bucket);
  }

  const options: JSX.Element[] = [];
  if (selectedPath && !fields.some((field) => field.path === selectedPath)) {
    options.push(
      <option key="current-missing" value={selectedPath}>
        {selectedPath} (missing)
      </option>
    );
  }

  for (const [section, sectionFields] of sections.entries()) {
    options.push(
      <optgroup key={section} label={section}>
        {sectionFields.map((field) => (
          <option key={field.path} value={field.path}>
            {field.label}
          </option>
        ))}
      </optgroup>
    );
  }

  return options;
}

function preservesFirstValue(operator: ConditionOperator): boolean {
  return needsFirstValue(operator);
}

function needsFirstValue(operator: ConditionOperator): boolean {
  return !['isEmpty', 'notEmpty', 'isTrue', 'isFalse'].includes(operator);
}

function usesNumericInput(operator: ConditionOperator, dataType: LogicFieldDataType): boolean {
  if (operator === 'between' || operator === 'gt' || operator === 'gte' || operator === 'lt' || operator === 'lte') {
    return true;
  }
  return NUMERIC_DATA_TYPES.has(dataType);
}
