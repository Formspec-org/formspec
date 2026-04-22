/** @filedesc Data-driven mapping for summary label → property name for inline editing. */
import type { FormItem } from '@formspec-org/types';

export interface SummaryReadEntry {
  source: 'item' | 'bind';
  key: string;
}

const ITEM_KEYS = new Set([
  'description', 'hint', 'initialValue', 'currency', 'precision',
  'prefix', 'suffix', 'semanticType',
]);
const BIND_KEYS = new Set([
  'calculate', 'relevant', 'readonly', 'required', 'constraint', 'constraintMessage',
]);

function resolveKey(label: string): string {
  if (label === 'Initial') return 'initialValue';
  if (label === 'Precision') return 'precision';
  if (label === 'Semantic') return 'semanticType';
  if (label === 'Currency') return 'currency';
  if (label === 'Prefix') return 'prefix';
  if (label === 'Suffix') return 'suffix';
  if (label === 'Description') return 'description';
  if (label === 'Hint') return 'hint';
  if (label === 'Calculate') return 'calculate';
  if (label === 'Relevant') return 'relevant';
  if (label === 'Readonly') return 'readonly';
  if (label === 'Required') return 'required';
  if (label === 'Constraint') return 'constraint';
  if (label === 'Message') return 'constraintMessage';
  return '';
}

export function summaryInputValue(
  label: string,
  item: FormItem | undefined,
  binds: Record<string, string>,
): string {
  const key = resolveKey(label);
  if (!key) return '';
  if (BIND_KEYS.has(key)) return binds[key] ?? '';
  if (key === 'initialValue') return item?.initialValue != null ? String(item.initialValue) : '';
  if (key === 'precision') return typeof item?.precision === 'number' ? String(item.precision) : '';
  const val = (item as Record<string, unknown>)?.[key];
  return typeof val === 'string' ? val : '';
}

export function summaryUpdatePayload(
  label: string,
  rawValue: string,
): Record<string, unknown> | null {
  const key = resolveKey(label);
  if (!key) return null;
  if (key === 'precision') return { precision: rawValue === '' ? null : Number(rawValue) };
  return { [key]: rawValue || null };
}

export function isDebouncedSummaryLabel(label: string): boolean {
  return label === 'Description' || label === 'Hint';
}
