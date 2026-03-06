import type { LogicFieldDataType } from './catalog';
import {
  isLikelyDateLiteral,
  parseFelLiteral,
  quoteFelString,
  splitTopLevelLogical,
  stripOuterParens
} from './expression-utils';

type ConstraintOperator =
  | 'atLeast'
  | 'atMost'
  | 'between'
  | 'oneOf'
  | 'pattern'
  | 'notEmpty'
  | 'beforeDate'
  | 'afterDate';

interface ConstraintExpression {
  operator: ConstraintOperator;
  value: string;
  value2: string;
  values: string;
}

interface ConstraintBuilderProps {
  value: ConstraintExpression;
  dataType: LogicFieldDataType;
  testIdPrefix: string;
  onChange: (next: ConstraintExpression) => void;
}

const NUMERIC_DATA_TYPES = new Set<LogicFieldDataType>(['integer', 'decimal', 'number', 'money']);

export function ConstraintBuilder(props: ConstraintBuilderProps) {
  const operatorOptions = getConstraintOperatorOptions();

  return (
    <div class="logic-builder" data-testid={`${props.testIdPrefix}-builder`}>
      <div class="constraint-builder__sentence">
        <span class="constraint-builder__prefix">This value must be</span>

        <select
          class="inspector-input"
          data-testid={`${props.testIdPrefix}-operator`}
          value={props.value.operator}
          onChange={(event) => {
            const operator = (event.currentTarget as HTMLSelectElement).value as ConstraintOperator;
            props.onChange({
              ...props.value,
              operator,
              value: keepsPrimaryValue(operator) ? props.value.value : '',
              value2: operator === 'between' ? props.value.value2 : '',
              values: operator === 'oneOf' ? props.value.values : ''
            });
          }}
        >
          {operatorOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {props.value.operator === 'between' ? (
          <>
            <input
              class="inspector-input"
              data-testid={`${props.testIdPrefix}-value`}
              type={isNumericConstraint(props.dataType) ? 'number' : 'text'}
              value={props.value.value}
              placeholder="min"
              onInput={(event) => {
                props.onChange({
                  ...props.value,
                  value: (event.currentTarget as HTMLInputElement).value
                });
              }}
            />
            <span class="constraint-builder__joiner">and</span>
            <input
              class="inspector-input"
              data-testid={`${props.testIdPrefix}-value2`}
              type={isNumericConstraint(props.dataType) ? 'number' : 'text'}
              value={props.value.value2}
              placeholder="max"
              onInput={(event) => {
                props.onChange({
                  ...props.value,
                  value2: (event.currentTarget as HTMLInputElement).value
                });
              }}
            />
          </>
        ) : null}

        {props.value.operator === 'oneOf' ? (
          <input
            class="inspector-input"
            data-testid={`${props.testIdPrefix}-values`}
            type="text"
            value={props.value.values}
            placeholder="comma-separated values"
            onInput={(event) => {
              props.onChange({
                ...props.value,
                values: (event.currentTarget as HTMLInputElement).value
              });
            }}
          />
        ) : null}

        {props.value.operator === 'pattern' ? (
          <input
            class="inspector-input"
            data-testid={`${props.testIdPrefix}-value`}
            type="text"
            value={props.value.value}
            placeholder="regex pattern"
            onInput={(event) => {
              props.onChange({
                ...props.value,
                value: (event.currentTarget as HTMLInputElement).value
              });
            }}
          />
        ) : null}

        {props.value.operator === 'atLeast' || props.value.operator === 'atMost' ? (
          <input
            class="inspector-input"
            data-testid={`${props.testIdPrefix}-value`}
            type={isNumericConstraint(props.dataType) ? 'number' : 'text'}
            value={props.value.value}
            onInput={(event) => {
              props.onChange({
                ...props.value,
                value: (event.currentTarget as HTMLInputElement).value
              });
            }}
          />
        ) : null}

        {props.value.operator === 'beforeDate' || props.value.operator === 'afterDate' ? (
          <input
            class="inspector-input"
            data-testid={`${props.testIdPrefix}-value`}
            type="date"
            value={props.value.value}
            onInput={(event) => {
              props.onChange({
                ...props.value,
                value: (event.currentTarget as HTMLInputElement).value
              });
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

export function createDefaultConstraintExpression(dataType: LogicFieldDataType): ConstraintExpression {
  if (isNumericConstraint(dataType)) {
    return {
      operator: 'atLeast',
      value: '0',
      value2: '',
      values: ''
    };
  }

  if (dataType === 'date' || dataType === 'dateTime' || dataType === 'time') {
    return {
      operator: 'afterDate',
      value: '',
      value2: '',
      values: ''
    };
  }

  return {
    operator: 'notEmpty',
    value: '',
    value2: '',
    values: ''
  };
}

export function parseConstraintExpression(
  rawExpression: string,
  dataType: LogicFieldDataType
): ConstraintExpression | null {
  const expression = rawExpression.trim();
  if (!expression.length) {
    return createDefaultConstraintExpression(dataType);
  }

  const stripped = stripOuterParens(expression);

  if (/^not\(\s*isBlank\(\s*\$\s*\)\s*\)$/i.test(stripped)) {
    return {
      operator: 'notEmpty',
      value: '',
      value2: '',
      values: ''
    };
  }

  const patternMatch = stripped.match(/^matches\(\s*\$\s*,\s*(.+)\)$/i);
  if (patternMatch) {
    return {
      operator: 'pattern',
      value: parseFelLiteral(patternMatch[1]).value,
      value2: '',
      values: ''
    };
  }

  const betweenMatch = stripped.match(/^\$\s*>=\s*(.+)\s+and\s+\$\s*<=\s*(.+)$/i);
  if (betweenMatch) {
    return {
      operator: 'between',
      value: parseFelLiteral(betweenMatch[1]).value,
      value2: parseFelLiteral(betweenMatch[2]).value,
      values: ''
    };
  }

  const rangeMatch = stripped.match(/^\$\s*(>=|<=|>|<)\s*(.+)$/i);
  if (rangeMatch) {
    const comparator = rangeMatch[1];
    const literal = parseFelLiteral(rangeMatch[2]).value;
    if (comparator === '>=') {
      return { operator: 'atLeast', value: literal, value2: '', values: '' };
    }
    if (comparator === '<=') {
      return { operator: 'atMost', value: literal, value2: '', values: '' };
    }
    if (comparator === '>' && isLikelyDateLiteral(literal)) {
      return { operator: 'afterDate', value: literal, value2: '', values: '' };
    }
    if (comparator === '<' && isLikelyDateLiteral(literal)) {
      return { operator: 'beforeDate', value: literal, value2: '', values: '' };
    }
  }

  const split = splitTopLevelLogical(stripped);
  if (!split.mixed && split.operator === 'or' && split.clauses.length > 1) {
    const values: string[] = [];
    for (const clause of split.clauses) {
      const equalsMatch = clause.match(/^\$\s*=\s*(.+)$/i);
      if (!equalsMatch) {
        values.length = 0;
        break;
      }
      values.push(parseFelLiteral(equalsMatch[1]).value);
    }

    if (values.length === split.clauses.length) {
      return {
        operator: 'oneOf',
        value: '',
        value2: '',
        values: values.join(', ')
      };
    }
  }

  return null;
}

export function serializeConstraintExpression(expression: ConstraintExpression, dataType: LogicFieldDataType): string {
  switch (expression.operator) {
    case 'atLeast':
      return `$ >= ${toConstraintLiteral(expression.value, dataType)}`;
    case 'atMost':
      return `$ <= ${toConstraintLiteral(expression.value, dataType)}`;
    case 'between':
      return `($ >= ${toConstraintLiteral(expression.value, dataType)} and $ <= ${toConstraintLiteral(expression.value2, dataType)})`;
    case 'oneOf': {
      const values = expression.values
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean)
        .map((token) => `$ = ${quoteFelString(token)}`);
      return values.join(' or ');
    }
    case 'pattern':
      return `matches($, ${quoteFelString(expression.value)})`;
    case 'notEmpty':
      return 'not(isBlank($))';
    case 'beforeDate':
      return `$ < ${quoteFelString(expression.value)}`;
    case 'afterDate':
      return `$ > ${quoteFelString(expression.value)}`;
    default:
      return '';
  }
}

function toConstraintLiteral(value: string, dataType: LogicFieldDataType): string {
  if (isNumericConstraint(dataType)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? String(parsed) : '0';
  }
  return quoteFelString(value);
}

function getConstraintOperatorOptions(): Array<{ value: ConstraintOperator; label: string }> {
  return [
    { value: 'atLeast', label: 'at least' },
    { value: 'atMost', label: 'at most' },
    { value: 'between', label: 'between' },
    { value: 'oneOf', label: 'one of' },
    { value: 'pattern', label: 'matching pattern' },
    { value: 'notEmpty', label: 'not empty' },
    { value: 'beforeDate', label: 'before date' },
    { value: 'afterDate', label: 'after date' }
  ];
}

function keepsPrimaryValue(operator: ConstraintOperator): boolean {
  return operator !== 'notEmpty';
}

function isNumericConstraint(dataType: LogicFieldDataType): boolean {
  return NUMERIC_DATA_TYPES.has(dataType);
}
