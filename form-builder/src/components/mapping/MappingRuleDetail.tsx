import { useEffect, useState } from 'preact/hooks';
import type { MappingRule } from '../../state/project';
import { TextInput } from '../controls/TextInput';
import type { MappingRuleProperty } from '../../state/mutations';

interface MappingRuleDetailProps {
  ruleIndex: number;
  rule: MappingRule;
  onChange: (property: MappingRuleProperty, value: unknown) => void;
}

const COERCE_OPTIONS = [
  { value: 'string', label: 'string' },
  { value: 'number', label: 'number' },
  { value: 'boolean', label: 'boolean' }
];

export function MappingRuleDetail(props: MappingRuleDetailProps) {
  const [valueMapText, setValueMapText] = useState(formatJson(props.rule.valueMap));
  const [valueMapError, setValueMapError] = useState<string | null>(null);

  useEffect(() => {
    setValueMapText(formatJson(props.rule.valueMap));
    setValueMapError(null);
  }, [props.rule]);

  const showExpression =
    props.rule.transform === 'expression'
    || props.rule.transform === 'constant'
    || props.rule.transform === 'concat'
    || props.rule.transform === 'split';
  const showCoerce = props.rule.transform === 'coerce';
  const showValueMap = props.rule.transform === 'valueMap';

  return (
    <div class="mapping-rule-detail" data-testid="mapping-rule-detail">
      <p class="mapping-rule-detail__title">Rule #{props.ruleIndex + 1} details</p>

      <TextInput
        label="Condition"
        value={props.rule.condition}
        placeholder="source.mode = 'advanced'"
        testId="mapping-rule-condition-input"
        onInput={(value) => {
          props.onChange('condition', value);
        }}
      />

      {showExpression ? (
        <label class="inspector-control">
          <span class="inspector-control__label">Expression</span>
          <textarea
            class="inspector-input inspector-input--fel"
            data-testid="mapping-rule-expression-input"
            value={props.rule.expression ?? ''}
            onInput={(event) => {
              props.onChange('expression', (event.currentTarget as HTMLTextAreaElement).value);
            }}
          />
        </label>
      ) : null}

      {showCoerce ? (
        <label class="inspector-control">
          <span class="inspector-control__label">Coerce to</span>
          <select
            class="inspector-input"
            data-testid="mapping-rule-coerce-input"
            value={resolveCoerceValue(props.rule.coerce)}
            onChange={(event) => {
              props.onChange('coerce', (event.currentTarget as HTMLSelectElement).value);
            }}
          >
            {COERCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {showValueMap ? (
        <div class="mapping-rule-detail__value-map">
          <label class="inspector-control">
            <span class="inspector-control__label">Value Map (JSON object)</span>
            <textarea
              class={`inspector-input inspector-input--fel ${valueMapError ? 'is-invalid' : ''}`}
              data-testid="mapping-rule-value-map-input"
              value={valueMapText}
              onInput={(event) => {
                const nextText = (event.currentTarget as HTMLTextAreaElement).value;
                setValueMapText(nextText);

                if (!nextText.trim()) {
                  setValueMapError(null);
                  props.onChange('valueMap', undefined);
                  return;
                }

                try {
                  const parsed = JSON.parse(nextText) as unknown;
                  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                    setValueMapError('Value map must be a JSON object.');
                    return;
                  }
                  setValueMapError(null);
                  props.onChange('valueMap', parsed);
                } catch {
                  setValueMapError('Value map must be valid JSON.');
                }
              }}
            />
          </label>
          {valueMapError ? (
            <p class="mapping-rule-detail__error" data-testid="mapping-rule-value-map-error">
              {valueMapError}
            </p>
          ) : null}
        </div>
      ) : null}

      <div class="mapping-rule-detail__row">
        <label class="inspector-control">
          <span class="inspector-control__label">Bidirectional</span>
          <input
            class="mapping-rule-detail__checkbox"
            data-testid="mapping-rule-bidirectional-input"
            type="checkbox"
            checked={props.rule.bidirectional ?? true}
            onChange={(event) => {
              props.onChange('bidirectional', (event.currentTarget as HTMLInputElement).checked);
            }}
          />
        </label>

        <label class="inspector-control">
          <span class="inspector-control__label">Priority</span>
          <input
            class="inspector-input"
            data-testid="mapping-rule-priority-input"
            type="number"
            value={props.rule.priority ?? ''}
            onInput={(event) => {
              const next = (event.currentTarget as HTMLInputElement).value;
              props.onChange('priority', next);
            }}
          />
        </label>

        <label class="inspector-control">
          <span class="inspector-control__label">Reverse Priority</span>
          <input
            class="inspector-input"
            data-testid="mapping-rule-reverse-priority-input"
            type="number"
            min={0}
            value={props.rule.reversePriority ?? ''}
            onInput={(event) => {
              const next = (event.currentTarget as HTMLInputElement).value;
              props.onChange('reversePriority', next);
            }}
          />
        </label>
      </div>
    </div>
  );
}

function resolveCoerceValue(coerce: MappingRule['coerce']): string {
  if (typeof coerce === 'string' && coerce.trim().length > 0) {
    return coerce;
  }
  if (coerce && typeof coerce === 'object') {
    const next = (coerce as Record<string, unknown>).to;
    if (typeof next === 'string' && next.trim().length > 0) {
      return next;
    }
  }
  return 'string';
}

function formatJson(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return '{\n\n}';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '{\n\n}';
  }
}
