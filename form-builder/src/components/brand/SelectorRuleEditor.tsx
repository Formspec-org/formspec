import type { Signal } from '@preact/signals';
import { Dropdown, type DropdownOption } from '../controls/Dropdown';
import { KeyValueEditor } from '../controls/KeyValueEditor';
import { TextInput } from '../controls/TextInput';
import {
  addThemeSelector,
  deleteThemeSelector,
  setThemeSelectorApplyProperty,
  setThemeSelectorMatchProperty
} from '../../state/mutations';
import type {
  ProjectState,
  ThemeSelectorDataType,
  ThemeSelectorRule,
  ThemeSelectorType
} from '../../state/project';

export interface SelectorRuleEditorProps {
  project: Signal<ProjectState>;
}

const SELECTOR_TYPE_OPTIONS: DropdownOption[] = [
  { value: '', label: 'Any item type' },
  { value: 'field', label: 'Field' },
  { value: 'group', label: 'Group' },
  { value: 'display', label: 'Display' }
];

const DATA_TYPE_OPTIONS: DropdownOption[] = [
  { value: '', label: 'Any field data type' },
  { value: 'string', label: 'String' },
  { value: 'text', label: 'Long text' },
  { value: 'integer', label: 'Integer' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'dateTime', label: 'Date + time' },
  { value: 'time', label: 'Time' },
  { value: 'uri', label: 'URL' },
  { value: 'attachment', label: 'Attachment' },
  { value: 'choice', label: 'Single choice' },
  { value: 'multiChoice', label: 'Multi choice' },
  { value: 'money', label: 'Money' }
];

const WIDGET_OPTIONS: DropdownOption[] = [
  { value: '', label: 'Keep current widget' },
  { value: 'textInput', label: 'Text input' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'numberInput', label: 'Number input' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'toggle', label: 'Toggle' },
  { value: 'datePicker', label: 'Date picker' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'radio', label: 'Radio' },
  { value: 'moneyInput', label: 'Money input' },
  { value: 'section', label: 'Section' },
  { value: 'card', label: 'Card' },
  { value: 'accordion', label: 'Accordion' },
  { value: 'tab', label: 'Tab' },
  { value: 'heading', label: 'Heading' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'divider', label: 'Divider' },
  { value: 'banner', label: 'Banner' }
];

const LABEL_POSITION_OPTIONS: DropdownOption[] = [
  { value: '', label: 'Use default label position' },
  { value: 'top', label: 'Top' },
  { value: 'start', label: 'Start' },
  { value: 'hidden', label: 'Hidden' }
];

const LIVE_REGION_OPTIONS: DropdownOption[] = [
  { value: '', label: 'Default' },
  { value: 'off', label: 'Off' },
  { value: 'polite', label: 'Polite' },
  { value: 'assertive', label: 'Assertive' }
];

export function SelectorRuleEditor(props: SelectorRuleEditorProps) {
  const selectors = props.project.value.theme.selectors ?? [];

  return (
    <div class="selector-rules">
      {selectors.length === 0 ? <p class="inspector-hint">No selector rules yet.</p> : null}

      {selectors.map((selector, index) => {
        const match = isRecord(selector.match) ? selector.match : {};
        const apply = isRecord(selector.apply) ? selector.apply : {};

        const typeValue = toSelectorType(match.type);
        const dataTypeDisabled = typeValue.length > 0 && typeValue !== 'field';
        const dataTypeValue = dataTypeDisabled ? '' : toSelectorDataType(match.dataType);

        return (
          <article class="selector-rules__rule" key={`selector-rule-${index}`}>
            <div class="selector-rules__header">
              <p class="selector-rules__title">Rule {index + 1}</p>
              <button
                type="button"
                class="selector-rules__remove"
                data-testid={`selector-rule-remove-${index}`}
                onClick={() => {
                  deleteThemeSelector(props.project, index);
                }}
              >
                Remove
              </button>
            </div>
            <p class="selector-rules__summary">{summarizeRule(selector)}</p>

            <Dropdown
              label="Match item type"
              value={typeValue}
              options={SELECTOR_TYPE_OPTIONS}
              testId={`selector-rule-type-${index}`}
              onChange={(value) => {
                setThemeSelectorMatchProperty(props.project, index, 'type', value);
              }}
            />
            <Dropdown
              label="Match data type"
              value={dataTypeValue}
              options={DATA_TYPE_OPTIONS}
              disabled={dataTypeDisabled}
              testId={`selector-rule-data-type-${index}`}
              onChange={(value) => {
                setThemeSelectorMatchProperty(props.project, index, 'dataType', value);
              }}
            />
            <Dropdown
              label="Apply widget"
              value={typeof apply.widget === 'string' ? apply.widget : undefined}
              options={WIDGET_OPTIONS}
              testId={`selector-rule-widget-${index}`}
              onChange={(value) => {
                setThemeSelectorApplyProperty(props.project, index, 'widget', value);
              }}
            />
            <Dropdown
              label="Apply label position"
              value={typeof apply.labelPosition === 'string' ? apply.labelPosition : undefined}
              options={LABEL_POSITION_OPTIONS}
              testId={`selector-rule-label-position-${index}`}
              onChange={(value) => {
                setThemeSelectorApplyProperty(props.project, index, 'labelPosition', value);
              }}
            />
            <TextInput
              label="Apply CSS class"
              value={toCssClassInputValue(apply.cssClass)}
              placeholder="compact date-field"
              testId={`selector-rule-css-class-${index}`}
              onInput={(value) => {
                setThemeSelectorApplyProperty(props.project, index, 'cssClass', value);
              }}
            />
            <KeyValueEditor
              label="Apply widget config"
              value={toKvRecord(apply.widgetConfig)}
              valuePlaceholder="value or $token.key"
              testId={`selector-rule-widget-config-${index}`}
              onInput={(value) => {
                setThemeSelectorApplyProperty(props.project, index, 'widgetConfig', value);
              }}
            />
            <KeyValueEditor
              label="Apply style"
              value={toKvRecord(apply.style)}
              valuePlaceholder="$token.key or value"
              testId={`selector-rule-style-${index}`}
              onInput={(value) => {
                setThemeSelectorApplyProperty(props.project, index, 'style', value);
              }}
            />
            <div class="selector-rules__accessibility">
              <span class="inspector-control__label">Apply accessibility</span>
              <div class="selector-rules__accessibility-row">
                <TextInput
                  label="Role"
                  value={toAccessibilityString((apply.accessibility as Record<string, unknown>)?.role)}
                  placeholder="alert, status, …"
                  testId={`selector-rule-accessibility-role-${index}`}
                  onInput={(value) => {
                    patchApplyAccessibility(props.project, index, apply, 'role', value ?? '');
                  }}
                />
                <TextInput
                  label="Description"
                  value={toAccessibilityString((apply.accessibility as Record<string, unknown>)?.description)}
                  placeholder="Screen reader text"
                  testId={`selector-rule-accessibility-desc-${index}`}
                  onInput={(value) => {
                    patchApplyAccessibility(props.project, index, apply, 'description', value ?? '');
                  }}
                />
                <Dropdown
                  label="Live region"
                  value={toAccessibilityString((apply.accessibility as Record<string, unknown>)?.liveRegion)}
                  options={LIVE_REGION_OPTIONS}
                  testId={`selector-rule-accessibility-live-${index}`}
                  onChange={(value) => {
                    patchApplyAccessibility(props.project, index, apply, 'liveRegion', value ?? '');
                  }}
                />
              </div>
            </div>
            <TextInput
              label="Apply fallback widgets"
              value={toFallbackInputValue(apply.fallback)}
              placeholder="dropdown, numberInput"
              testId={`selector-rule-fallback-${index}`}
              onInput={(value) => {
                const arr = value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean);
                setThemeSelectorApplyProperty(props.project, index, 'fallback', arr.length > 0 ? arr : undefined);
              }}
            />
          </article>
        );
      })}

      <button
        type="button"
        class="selector-rules__add"
        data-testid="selector-rule-add-button"
        onClick={() => {
          addThemeSelector(props.project, {
            match: { type: 'field' },
            apply: {}
          });
        }}
      >
        Add style rule
      </button>
    </div>
  );
}

function summarizeRule(selector: ThemeSelectorRule): string {
  const match = isRecord(selector.match) ? selector.match : {};
  const apply = isRecord(selector.apply) ? selector.apply : {};
  const type = toSelectorType(match.type);
  const dataType = toSelectorDataType(match.dataType);
  const cssClass = toCssClassInputValue(apply.cssClass);

  const scope = dataType
    ? `All ${dataType} fields`
    : type
      ? `All ${type} items`
      : 'All items';

  const changes: string[] = [];
  if (typeof apply.widget === 'string' && apply.widget.trim().length > 0) {
    changes.push(`widget ${apply.widget.trim()}`);
  }
  if (typeof apply.labelPosition === 'string' && apply.labelPosition.trim().length > 0) {
    changes.push(`labels ${apply.labelPosition.trim()}`);
  }
  if (cssClass) {
    changes.push(`class ${cssClass}`);
  }

  if (!changes.length) {
    return `${scope} with no apply overrides yet.`;
  }

  return `${scope} -> ${changes.join(', ')}`;
}

function toSelectorType(value: unknown): ThemeSelectorType | '' {
  if (value === 'field' || value === 'group' || value === 'display') {
    return value;
  }
  return '';
}

function toSelectorDataType(value: unknown): ThemeSelectorDataType | '' {
  if (
    value === 'string'
    || value === 'text'
    || value === 'integer'
    || value === 'decimal'
    || value === 'boolean'
    || value === 'date'
    || value === 'dateTime'
    || value === 'time'
    || value === 'uri'
    || value === 'attachment'
    || value === 'choice'
    || value === 'multiChoice'
    || value === 'money'
  ) {
    return value;
  }
  return '';
}

function toCssClassInputValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (Array.isArray(value)) {
    const normalized = value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .join(' ');
    return normalized.length > 0 ? normalized : undefined;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toKvRecord(value: unknown): Record<string, string | number> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string' || typeof v === 'number') {
      out[k] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function toAccessibilityString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function toFallbackInputValue(value: unknown): string {
  if (!Array.isArray(value)) {
    return '';
  }
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ');
}

function patchApplyAccessibility(
  project: SelectorRuleEditorProps['project'],
  index: number,
  apply: Record<string, unknown>,
  key: 'role' | 'description' | 'liveRegion',
  value: string
): void {
  const acc = isRecord(apply.accessibility) ? { ...(apply.accessibility as Record<string, string>) } : {};
  const trimmed = value.trim();
  if (trimmed) {
    acc[key] = trimmed;
  } else {
    delete acc[key];
  }
  setThemeSelectorApplyProperty(
    project,
    index,
    'accessibility',
    Object.keys(acc).length > 0 ? acc : undefined
  );
}
