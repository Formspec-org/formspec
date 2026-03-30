/** @filedesc Field-detail launcher and orphan-editor helpers for ItemRow (parity with buildRowSummaries). */
import type { FormItem } from '@formspec-org/types';

export const FIELD_DETAIL_SUMMARY_LABELS = new Set([
  'Initial',
  'Prefix',
  'Suffix',
  'Semantic',
  'Precision',
  'Currency',
  'Pre-fill',
]);

export interface SummaryEntryLike {
  label: string;
}

export function fieldDetailRowInSummaryGrid(
  supportingText: SummaryEntryLike[],
  label: string,
): boolean {
  return supportingText.some((e) => e.label === label);
}

/** Whether this optional field detail is unset (must stay aligned with buildRowSummaries / summary strip). */
export function isUnusedFieldDetail(item: FormItem | undefined, label: string): boolean {
  if (item?.type !== 'field') return false;
  switch (label) {
    case 'Initial':
      return !(item.initialValue != null && String(item.initialValue).trim());
    case 'Prefix':
      return !(typeof item.prefix === 'string' && item.prefix.trim());
    case 'Suffix':
      return !(typeof item.suffix === 'string' && item.suffix.trim());
    case 'Semantic':
      return !(typeof item.semanticType === 'string' && item.semanticType.trim());
    case 'Precision':
      return typeof item.precision !== 'number';
    case 'Currency':
      return !(typeof item.currency === 'string' && item.currency.trim());
    case 'Pre-fill':
      return !(item.prePopulate && typeof item.prePopulate === 'object');
    default:
      return false;
  }
}

export interface FieldDetailLauncher {
  label: string;
  addLabel: string;
  testId: string;
}

const LAUNCH_SPECS: ReadonlyArray<{
  label: string;
  addLabel: string;
  testSuffix: string;
  applies: (ctx: { item: FormItem; isDecimalLike: boolean }) => boolean;
}> = [
  { label: 'Initial', addLabel: 'Initial value', testSuffix: 'initial', applies: () => true },
  { label: 'Prefix', addLabel: 'Prefix', testSuffix: 'prefix', applies: () => true },
  { label: 'Suffix', addLabel: 'Suffix', testSuffix: 'suffix', applies: () => true },
  { label: 'Pre-fill', addLabel: 'Pre-fill', testSuffix: 'pre-fill', applies: () => true },
  { label: 'Semantic', addLabel: 'Semantic type', testSuffix: 'semantic', applies: () => true },
  {
    label: 'Precision',
    addLabel: 'Precision',
    testSuffix: 'precision',
    applies: ({ isDecimalLike }) => isDecimalLike,
  },
  {
    label: 'Currency',
    addLabel: 'Currency',
    testSuffix: 'currency',
    applies: ({ item }) => String(item.dataType ?? '') === 'money',
  },
];

export function buildFieldDetailLaunchers(options: {
  item: FormItem | undefined;
  testIdPrefix: string;
  activeInlineSummary: string | null;
  isDecimalLike: boolean;
}): FieldDetailLauncher[] {
  const { item, testIdPrefix, activeInlineSummary, isDecimalLike } = options;
  if (item?.type !== 'field') return [];

  const ctx = { item, isDecimalLike };
  const out: FieldDetailLauncher[] = [];
  for (const spec of LAUNCH_SPECS) {
    if (!spec.applies(ctx)) continue;
    if (activeInlineSummary === spec.label) continue;
    if (!isUnusedFieldDetail(item, spec.label)) continue;
    out.push({
      label: spec.label,
      addLabel: spec.addLabel,
      testId: `${testIdPrefix}-add-${spec.testSuffix}`,
    });
  }
  return out;
}

export function computeOrphanFieldDetailLabel(
  activeInlineSummary: string | null,
  supportingText: SummaryEntryLike[],
): string | null {
  if (!activeInlineSummary || !FIELD_DETAIL_SUMMARY_LABELS.has(activeInlineSummary)) {
    return null;
  }
  if (fieldDetailRowInSummaryGrid(supportingText, activeInlineSummary)) {
    return null;
  }
  return activeInlineSummary;
}

export function fieldDetailOrphanHeading(label: string): string {
  if (label === 'Initial') return 'Initial value';
  if (label === 'Semantic') return 'Semantic type';
  if (label === 'Pre-fill') return 'Pre-fill';
  return label;
}
