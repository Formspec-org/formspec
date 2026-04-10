/** @filedesc Definition-tree row summary and status derivation for the Editor workspace. */
import type { FormBind, FormItem } from '@formspec-org/types';
import { humanizeFEL, bindsFor, buildDefLookup } from './authoring-helpers.js';

export interface RowSummaryEntry {
  label: string;
  value: string;
}

export interface RowStatusPill {
  text: string;
  color: 'accent' | 'logic' | 'error' | 'green' | 'amber' | 'muted';
  /** Spec-normative term for tooltip discoverability. */
  specTerm: string;
  /** When true, the pill should render a warning indicator. */
  warn?: boolean;
}

export interface ExpressionDiagnostic {
  message: string;
  suggestions?: string[];
}

export interface MissingPropertyAction {
  key: 'description' | 'hint' | 'behavior';
  label: string;
  ariaLabel: string;
}

export function summarizeExpression(expression: string): string {
  const { text } = humanizeFEL(expression);
  return text.trim() || expression;
}

/** Display prePopulate source in tree summaries (leading @; matches inline editor). */
function formatPrePopulateRowDisplay(instance: string, path: string): string {
  const i = instance.trim();
  const p = path.trim();
  if (!i && !p) return '';
  return `@${i}${p ? `.${p}` : ''}`;
}

export function buildRowSummaries(item: FormItem, binds: Record<string, string>): RowSummaryEntry[] {
  const contentFacts: RowSummaryEntry[] = [];
  const configFacts: RowSummaryEntry[] = [];
  const optionsFacts: RowSummaryEntry[] = [];
  const behaviorFacts: RowSummaryEntry[] = [];

  if (typeof item.description === 'string' && item.description.trim()) {
    contentFacts.push({ label: 'Description', value: item.description });
  }
  if (typeof item.hint === 'string' && item.hint.trim()) {
    contentFacts.push({ label: 'Hint', value: item.hint });
  }

  if (item.type === 'field') {
    if (item.initialValue != null && String(item.initialValue).trim()) {
      configFacts.push({ label: 'Initial', value: String(item.initialValue) });
    }
    if (typeof item.precision === 'number') {
      configFacts.push({ label: 'Precision', value: String(item.precision) });
    }
    if (typeof item.currency === 'string' && item.currency.trim()) {
      configFacts.push({ label: 'Currency', value: item.currency });
    }
    if (typeof item.prefix === 'string' && item.prefix.trim()) {
      configFacts.push({ label: 'Prefix', value: item.prefix });
    }
    if (typeof item.suffix === 'string' && item.suffix.trim()) {
      configFacts.push({ label: 'Suffix', value: item.suffix });
    }
    if (typeof item.semanticType === 'string' && item.semanticType.trim()) {
      configFacts.push({ label: 'Semantic', value: item.semanticType });
    }

    const rawChoiceOptions = item.options;
    if (Array.isArray(rawChoiceOptions) && rawChoiceOptions.length > 0) {
      optionsFacts.push({
        label: 'Options',
        value: `${rawChoiceOptions.length} ${rawChoiceOptions.length === 1 ? 'choice' : 'choices'}`,
      });
    }

    if (item.prePopulate && typeof item.prePopulate === 'object') {
      const instance = typeof item.prePopulate.instance === 'string' ? item.prePopulate.instance.trim() : '';
      const prePath = typeof item.prePopulate.path === 'string' ? item.prePopulate.path.trim() : '';
      const target = formatPrePopulateRowDisplay(instance, prePath);
      optionsFacts.push({ label: 'Pre-fill', value: target || 'Configured' });
    }
  }

  if (binds.calculate?.trim()) {
    behaviorFacts.push({ label: 'Calculate', value: summarizeExpression(binds.calculate) });
  }
  if (binds.relevant?.trim()) {
    behaviorFacts.push({ label: 'Relevant', value: summarizeExpression(binds.relevant) });
  }
  if (binds.readonly?.trim() && binds.readonly.trim() !== 'true') {
    behaviorFacts.push({ label: 'Readonly', value: summarizeExpression(binds.readonly) });
  }
  if (binds.required?.trim() && binds.required.trim() !== 'true') {
    behaviorFacts.push({ label: 'Required', value: summarizeExpression(binds.required) });
  }
  if (binds.default?.trim()) {
    behaviorFacts.push({ label: 'Default', value: summarizeExpression(binds.default) });
  }
  if (binds.constraint?.trim()) {
    behaviorFacts.push({ label: 'Constraint', value: summarizeExpression(binds.constraint) });
  }
  if (binds.constraintMessage?.trim()) {
    behaviorFacts.push({ label: 'Message', value: binds.constraintMessage });
  }

  return [
    ...contentFacts.slice(0, 2),
    ...optionsFacts.slice(0, 1),
    ...behaviorFacts.slice(0, 1),
    ...configFacts.slice(
      0,
      Math.max(0, 4 - contentFacts.slice(0, 2).length - optionsFacts.slice(0, 1).length - behaviorFacts.slice(0, 1).length),
    ),
  ].slice(0, 4);
}

/** Category-keyed summaries: one representative entry per task category. */
export type CategorySummaries = Record<string, string>;

export function buildCategorySummaries(item: FormItem, binds: Record<string, string>): CategorySummaries {
  if (item.type === 'display') {
    return {
      Visibility: binds.relevant?.trim() ? summarizeExpression(binds.relevant) : '',
      Description: typeof item.description === 'string' && item.description.trim() ? item.description : '',
    };
  }

  // Visibility — "Always" when no condition (definition tree shows fixed four slots).
  const visibility = binds.relevant?.trim() ? summarizeExpression(binds.relevant) : 'Always';

  // Validation — compact rule count for the category strip (details live in the lower panel).
  const validationRuleCount =
    (binds.required?.trim() ? 1 : 0) + (binds.constraint?.trim() ? 1 : 0);
  const validation =
    validationRuleCount === 0
      ? ''
      : `${validationRuleCount} ${validationRuleCount === 1 ? 'rule' : 'rules'}`;

  // Value: primary source, plus explicit readonly when it stacks (e.g. formula · locked).
  let value = '';
  if (binds.calculate?.trim()) {
    value = 'formula';
  } else if (item.initialValue != null && String(item.initialValue).trim()) {
    value = String(item.initialValue);
  } else if (item.prePopulate && typeof item.prePopulate === 'object') {
    value = 'pre-fill';
  } else if (binds.readonly?.trim()) {
    value = 'locked';
  } else if (binds.default?.trim()) {
    value = summarizeExpression(binds.default);
  }

  const hasExplicitReadonly = Boolean(binds.readonly?.trim());
  if (
    hasExplicitReadonly &&
    value !== '' &&
    value !== 'locked'
  ) {
    value = `${value} \u00b7 locked`;
  }

  // Format: currency + precision
  const formatParts: string[] = [];
  if (typeof item.currency === 'string' && item.currency.trim()) {
    formatParts.push(item.currency.trim());
  }
  if (typeof item.precision === 'number') {
    formatParts.push(`${item.precision}dp`);
  }
  const format = formatParts.join(' ');

  const result: CategorySummaries = { Visibility: visibility, Validation: validation, Value: value, Format: format };

  // Options slot for choice fields
  const rawChoiceOptions = item.options;
  if (Array.isArray(rawChoiceOptions) && rawChoiceOptions.length > 0) {
    result.Options = `${rawChoiceOptions.length} ${rawChoiceOptions.length === 1 ? 'choice' : 'choices'}`;
  } else if (['choice', 'multiChoice', 'select', 'select1'].includes(String(item.dataType ?? ''))) {
    result.Options = '';
  }

  return result;
}

export function buildExpressionDiagnostics(
  binds: Record<string, string>,
  definitionKeys: string[],
): Record<string, ExpressionDiagnostic | null> {
  const result: Record<string, ExpressionDiagnostic | null> = {};
  const keySet = new Set(definitionKeys);

  for (const [bindName, expression] of Object.entries(binds)) {
    if (!expression || !expression.trim()) {
      result[bindName] = null;
      continue;
    }

    // Extract $-prefixed tokens, strip leading $ and trailing dot-paths
    const tokens = expression.split(/\s+/).filter((t) => t.startsWith('$'));
    const refs = tokens.map((t) => {
      const withoutDollar = t.slice(1);
      // Take only the root key (before first dot)
      const dotIdx = withoutDollar.indexOf('.');
      return dotIdx >= 0 ? withoutDollar.slice(0, dotIdx) : withoutDollar;
    }).filter((r) => r.length > 0);

    const undefined_refs = refs.filter((r) => !keySet.has(r));
    const unique_undefined = [...new Set(undefined_refs)];

    if (unique_undefined.length === 0) {
      result[bindName] = null;
    } else {
      const suggestions: string[] = [];
      for (const ref of unique_undefined) {
        for (const key of definitionKeys) {
          if (key.includes(ref) || ref.includes(key)) {
            if (!suggestions.includes(key)) suggestions.push(key);
          }
        }
      }
      result[bindName] = {
        message: `Undefined reference${unique_undefined.length > 1 ? 's' : ''}: ${unique_undefined.join(', ')}`,
        suggestions,
      };
    }
  }

  return result;
}

export interface BuildStatusPillsOptions {
  diagnostics?: Record<string, ExpressionDiagnostic | null>;
  /**
   * When provided, `calculate` / `readonly` pills are omitted if the Value category
   * cell already conveys them (`formula`, `locked`, or stacked text like `25 · locked`).
   */
  categorySummaries?: CategorySummaries;
}

export function buildStatusPills(
  binds: Record<string, string>,
  item: FormItem,
  options?: BuildStatusPillsOptions,
): RowStatusPill[] {
  const diagnostics = options?.diagnostics;
  const valueSummary = options?.categorySummaries?.Value ?? '';
  const showFormulaPill = Boolean(binds.calculate) && !valueSummary.includes('formula');
  const showLockedPill = Boolean(binds.readonly) && !valueSummary.includes('locked');

  const pills: RowStatusPill[] = [];
  const w = (specTerm: string): boolean | undefined =>
    diagnostics?.[specTerm] ? true : undefined;

  if (binds.required) pills.push({ text: 'must fill', color: 'accent', specTerm: 'required', ...(w('required') && { warn: true }) });
  if (binds.relevant) pills.push({ text: 'shows if', color: 'logic', specTerm: 'relevant', ...(w('relevant') && { warn: true }) });
  if (showFormulaPill) pills.push({ text: 'formula', color: 'green', specTerm: 'calculate', ...(w('calculate') && { warn: true }) });
  if (binds.default) pills.push({ text: 'resets to', color: 'green', specTerm: 'default', ...(w('default') && { warn: true }) });
  if (item.prePopulate) pills.push({ text: 'linked', color: 'amber', specTerm: 'prePopulate' });
  if (binds.constraint) pills.push({ text: 'validates', color: 'error', specTerm: 'constraint', ...(w('constraint') && { warn: true }) });
  if (showLockedPill) pills.push({ text: 'locked', color: 'muted', specTerm: 'readonly', ...(w('readonly') && { warn: true }) });
  // nonRelevantBehavior: only show when set to a non-default value (default is 'remove')
  if (binds.nonRelevantBehavior === 'keep') {
    pills.push({ text: 'keeps value', color: 'muted', specTerm: 'nonRelevantBehavior' });
  } else if (binds.nonRelevantBehavior === 'empty') {
    pills.push({ text: 'clears value', color: 'muted', specTerm: 'nonRelevantBehavior' });
  }
  return pills;
}

/** Stable keys for advisory action buttons (studio UI maps these to handlers). */
export type AdvisoryActionKey =
  | 'remove_required'
  | 'remove_readonly'
  | 'add_formula'
  | 'add_initial_value'
  | 'add_pre_fill'
  | 'remove_pre_populate'
  | 'remove_formula'
  | 'review_formula';

export interface AdvisoryAction {
  key: AdvisoryActionKey;
  label: string;
}

export type AdvisorySeverity = 'warning' | 'info';

export interface Advisory {
  code: string;
  severity: AdvisorySeverity;
  message: string;
  actions: AdvisoryAction[];
}

export function buildAdvisories(binds: Record<string, string>, item: FormItem): Advisory[] {
  const advisories: Advisory[] = [];

  const hasRequired = binds.required === 'true';
  const hasReadonly = binds.readonly === 'true';
  const hasCalculate = Boolean(binds.calculate);
  const hasInitialValue = item.initialValue != null && String(item.initialValue).trim() !== '';
  const hasPrePopulate = Boolean(item.prePopulate);

  // Pattern 3: required + readonly + calculate — usually redundant mandatory rule
  if (hasRequired && hasReadonly && hasCalculate) {
    advisories.push({
      code: 'W902',
      severity: 'info',
      message:
        'This field is required and locked with a formula. The mandatory rule is usually redundant unless the formula sometimes produces no value.',
      actions: [
        { key: 'remove_required', label: 'Remove mandatory rule' },
        { key: 'review_formula', label: 'Review formula' },
      ],
    });
  }

  // Pattern 1: required + readonly WITHOUT any value source (calculate, initialValue, prePopulate)
  if (hasRequired && hasReadonly && !hasCalculate && !hasInitialValue && !hasPrePopulate) {
    advisories.push({
      code: 'W900',
      severity: 'warning',
      message: 'This field is required but locked, so respondents can\'t fill it in. Add a formula or pre-fill to supply the value automatically, or remove the lock.',
      actions: [
        { key: 'add_formula', label: 'Add formula' },
        { key: 'add_initial_value', label: 'Add initial value' },
        { key: 'add_pre_fill', label: 'Add pre-fill' },
        { key: 'remove_readonly', label: 'Remove lock' },
      ],
    });
  }

  // Pattern 2: prePopulate + calculate — formula replaces pre-fill
  if (hasPrePopulate && hasCalculate) {
    advisories.push({
      code: 'W901',
      severity: 'warning',
      message: 'The formula overwrites the pre-fill value immediately \u2014 the pre-fill setting has no effect. Remove one or the other.',
      actions: [
        { key: 'remove_pre_populate', label: 'Remove pre-fill' },
        { key: 'remove_formula', label: 'Remove formula' },
      ],
    });
  }

  return advisories;
}

/** Flat list of advisory messages for Form Health and similar surfaces. */
export interface DefinitionAdvisoryIssue {
  path: string;
  label: string;
  code: string;
  severity: AdvisorySeverity;
  message: string;
}

/**
 * Collects `buildAdvisories` results for every field in the definition (for sidebar / health UI).
 */
export function buildDefinitionAdvisoryIssues(
  items: FormItem[],
  allBinds: FormBind[] | undefined | null,
): DefinitionAdvisoryIssue[] {
  const lookup = buildDefLookup(items);
  const out: DefinitionAdvisoryIssue[] = [];
  for (const [path, entry] of lookup.entries()) {
    const item = entry.item;
    if (item.type !== 'field') continue;
    const binds = bindsFor(allBinds, path);
    const label =
      typeof item.label === 'string' && item.label.trim() ? item.label : item.key;
    for (const advisory of buildAdvisories(binds, item)) {
      out.push({ path, label, code: advisory.code, severity: advisory.severity, message: advisory.message });
    }
  }
  return out;
}

export function buildMissingPropertyActions(
  item: FormItem,
  binds: Record<string, string>,
  itemLabel: string,
): MissingPropertyAction[] {
  const actions: MissingPropertyAction[] = [];

  const hasBehavior = Boolean(
    binds.required?.trim()
      || binds.relevant?.trim()
      || binds.calculate?.trim()
      || binds.default?.trim()
      || binds.readonly?.trim()
      || binds.constraint?.trim()
      || binds.constraintMessage?.trim(),
  );

  if (!hasBehavior && item.type !== 'display') {
    actions.push({
      key: 'behavior',
      label: '+ Add behavior',
      ariaLabel: `Add behavior to ${itemLabel}`,
    });
  }

  if (item.type === 'group') {
    if (!item.description?.trim()) {
      actions.unshift({
        key: 'description',
        label: '+ Add description',
        ariaLabel: `Add description to ${itemLabel}`,
      });
    }

    if (!item.hint?.trim()) {
      actions.splice(item.description?.trim() ? 1 : 0, 0, {
        key: 'hint',
        label: '+ Add hint',
        ariaLabel: `Add hint to ${itemLabel}`,
      });
    }
  }

  return actions;
}
