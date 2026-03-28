/** @filedesc Definition-tree row summary and status derivation for the Editor workspace. */
import type { FormItem } from '@formspec-org/types';
import { humanizeFEL } from './authoring-helpers.js';

export interface RowSummaryEntry {
  label: string;
  value: string;
}

export interface RowStatusPill {
  text: string;
  color: 'accent' | 'logic' | 'error' | 'green' | 'amber' | 'muted';
}

export interface MissingPropertyAction {
  key: 'description' | 'hint' | 'behavior';
  label: string;
  ariaLabel: string;
}

export function summarizeExpression(expression: string): string {
  const humanized = humanizeFEL(expression).trim();
  return humanized || expression;
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
      const target = [instance, prePath].filter(Boolean).join('.');
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

export function buildStatusPills(binds: Record<string, string>, item: FormItem): RowStatusPill[] {
  const pills: RowStatusPill[] = [];
  if (binds.required) pills.push({ text: 'req', color: 'accent' });
  if (binds.relevant) pills.push({ text: 'rel', color: 'logic' });
  if (binds.calculate) pills.push({ text: 'ƒx', color: 'green' });
  if (item.prePopulate) pills.push({ text: 'pre', color: 'amber' });
  if (binds.constraint) pills.push({ text: 'rule', color: 'error' });
  if (binds.readonly) pills.push({ text: 'ro', color: 'muted' });
  return pills;
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
