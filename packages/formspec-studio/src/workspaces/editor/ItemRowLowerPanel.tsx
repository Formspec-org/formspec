/** @filedesc Expanded lower panel for ItemRow: field config, behavior binds, display content, and options editing. */
import { forwardRef, type FocusEventHandler } from 'react';
import { BindCard } from '../../components/ui/BindCard';
import { InlineExpression } from '../../components/ui/InlineExpression';
import { AddBehaviorMenu } from '../../components/ui/AddBehaviorMenu';
import { PrePopulateCard } from '../../components/ui/PrePopulateCard';
import {
  formatCommaSeparatedKeywords,
  parseCommaSeparatedKeywords,
  humanizeFEL,
} from '@formspec-org/studio-core';
import type { FormItem } from '@formspec-org/types';
import {
  fieldDetailOrphanHeading,
} from './item-row-field-detail';
import {
  EDITOR_DASH_BUTTON,
  summaryInputClassName,
  lowerEditorInputClassName,
  summaryInputLabel,
  summaryInputType,
} from './item-row-shared';

type ChoiceOptionRow = { value: string; label: string; keywords?: string[] };

interface FieldDetailLauncher {
  label: string;
  addLabel: string;
  testId: string;
}

export interface ItemRowLowerPanelProps {
  testId: string;
  itemLabel: string;
  itemPath: string;
  item: FormItem | undefined;
  binds: Record<string, string>;
  isField: boolean;
  isChoiceField: boolean;
  selected: boolean | undefined;
  editingFieldConfig: boolean;
  editingBehavior: boolean;
  editingOptions: boolean;
  editingDisplayContent: boolean;
  preFillLowerSession: boolean;
  orphanUiLabel: string | null;
  orphanFieldDetailLabel: string | null;
  prePopulateValue: Record<string, unknown> | null;
  statusPills: { text: string; color: string }[];
  visibleMissingActions: { key: string; label: string; ariaLabel: string }[];
  fieldDetailLaunchers: FieldDetailLauncher[];
  summaryInputValue: (label: string) => string;
  updateSummaryValue: (label: string, rawValue: string) => void;
  closeInlineSummary: () => void;
  closeOtherEditors: (kind: 'content' | 'config' | 'behavior' | 'options') => void;
  openEditorForSummary: (label: string, opts?: { preFillFromLauncher?: boolean }) => void;
  handleOrphanFieldDetailBlur: FocusEventHandler<HTMLInputElement>;
  preFillSourceInputValue: string;
  onPreFillSourceDraftChange: (value: string) => void;
  onUpdateItem: ((changes: Record<string, unknown>) => void) | undefined;
}

export const ItemRowLowerPanel = forwardRef<HTMLDivElement, ItemRowLowerPanelProps>(function ItemRowLowerPanel({
  testId,
  itemLabel,
  itemPath,
  item,
  binds,
  isField,
  isChoiceField,
  selected,
  editingFieldConfig,
  editingBehavior,
  editingOptions,
  editingDisplayContent,
  preFillLowerSession,
  orphanUiLabel,
  orphanFieldDetailLabel,
  prePopulateValue,
  statusPills,
  visibleMissingActions,
  fieldDetailLaunchers,
  summaryInputValue,
  updateSummaryValue,
  closeInlineSummary,
  closeOtherEditors,
  openEditorForSummary,
  handleOrphanFieldDetailBlur,
  preFillSourceInputValue,
  onPreFillSourceDraftChange,
  onUpdateItem,
}, ref) {
  const choiceOptions = Array.isArray(item?.options ?? item?.choices)
    ? ((item?.options ?? item?.choices) as ChoiceOptionRow[])
    : [];

  return (
    <div
      ref={ref}
      tabIndex={-1}
      data-testid={`${testId}-lower-panel`}
      className="mt-4 space-y-4 border-t border-border/70 pt-4 outline-none"
      onClick={(e) => e.stopPropagation()}
    >
      {editingFieldConfig && item?.type === 'field' && (
        <section data-testid={`${testId}-lower-editor`} aria-label="Field details" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[13px] font-semibold tracking-[0.04em] text-ink/84">
                Field details
              </h3>
              <p className="mt-1 text-[11px] leading-snug text-ink/50">
                Add a setting to open an editor here, or edit existing values in the summary row above.
              </p>
            </div>
            {statusPills.length > 0 && (
              <span className="font-mono text-[11px] tracking-[0.14em] text-ink/60">
                Inline configuration
              </span>
            )}
          </div>

          {/* BindCard: Initial Value */}
          {item?.initialValue != null && (
            <BindCard bindType="Initial Value" expression={String(item.initialValue)}>
              <InlineExpression
                value={String(item.initialValue)}
                onSave={(value) => onUpdateItem?.({ initialValue: value || null })}
                placeholder="Click to add initial value (prefix = for FEL)"
              />
            </BindCard>
          )}

          {/* PrePopulateCard */}
          {prePopulateValue && (
            <PrePopulateCard
              value={prePopulateValue}
              onChange={(val) => onUpdateItem?.({ prePopulate: val })}
              onRemove={() => onUpdateItem?.({ prePopulate: null })}
            />
          )}

          {/* BindCard: Calculate */}
          {binds.calculate != null && (
            <BindCard
              bindType="calculate"
              expression={binds.calculate}
              humanized={humanizeFEL(binds.calculate)}
              onRemove={() => onUpdateItem?.({ calculate: null })}
            >
              <InlineExpression
                value={binds.calculate}
                onSave={(value) => onUpdateItem?.({ calculate: value ?? null })}
                placeholder="Click to add expression"
              />
            </BindCard>
          )}

          {/* AddBehaviorMenu: Calculate / Pre-populate */}
          <AddBehaviorMenu
            label="Add Calculation / Pre-population"
            existingTypes={[
              ...(binds.calculate != null ? ['calculate'] : []),
              ...(prePopulateValue ? ['pre-populate'] : []),
            ]}
            allowedTypes={['calculate', 'pre-populate']}
            onAdd={(type) => {
              if (type === 'pre-populate') {
                onUpdateItem?.({ prePopulate: { instance: '', path: '' } });
              } else if (type === 'calculate') {
                onUpdateItem?.({ calculate: '' });
              }
            }}
            className="mt-1"
          />

          {/* Orphan field-detail for non-FEL fields (Currency, Precision, etc.) */}
          {orphanUiLabel && !['Pre-fill', 'Initial'].includes(orphanUiLabel) ? (
            <div
              data-testid={`${testId}-orphan-field-detail`}
              className="rounded-[10px] border border-border/70 bg-bg-default/55 px-3 py-3"
            >
              <div className="text-[12px] font-semibold tracking-[0.02em] text-ink/88">
                {fieldDetailOrphanHeading(orphanUiLabel)}
              </div>
              <input
                aria-label={summaryInputLabel(orphanUiLabel)}
                type={summaryInputType(orphanUiLabel)}
                autoFocus
                className={summaryInputClassName}
                value={summaryInputValue(orphanUiLabel)}
                maxLength={orphanUiLabel === 'Currency' ? 3 : undefined}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => {
                  const v = event.currentTarget.value;
                  const raw = orphanUiLabel === 'Currency'
                    ? v.toUpperCase().replace(/[^A-Z]/g, '')
                    : v;
                  updateSummaryValue(orphanUiLabel, raw);
                }}
                onBlur={handleOrphanFieldDetailBlur}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') closeInlineSummary();
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    closeInlineSummary();
                  }
                }}
              />
            </div>
          ) : null}

          {/* Non-FEL field-detail launchers (Prefix, Suffix, etc.) */}
          {fieldDetailLaunchers.filter(l => !['Initial', 'Pre-fill'].includes(l.label)).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {fieldDetailLaunchers
                .filter(l => !['Initial', 'Pre-fill'].includes(l.label))
                .map((launch) => (
                <button
                  key={launch.label}
                  type="button"
                  data-testid={launch.testId}
                  aria-label={`Add ${launch.addLabel} to ${itemLabel}`}
                  className={EDITOR_DASH_BUTTON}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    if (orphanFieldDetailLabel || preFillLowerSession) event.preventDefault();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    openEditorForSummary(launch.label);
                  }}
                >
                  + {launch.addLabel}
                </button>
              ))}
            </div>
          ) : null}

          {!editingBehavior && visibleMissingActions.some((action) => action.key === 'behavior') && (
            <AddBehaviorMenu
              label="Add behavior"
              triggerClassName={EDITOR_DASH_BUTTON}
              triggerAriaLabel={
                visibleMissingActions.find((a) => a.key === 'behavior')?.ariaLabel
              }
              existingTypes={Object.keys(binds).filter(
                (k) => binds[k] != null && binds[k] !== undefined,
              )}
              allowedTypes={['relevant', 'required', 'readonly', 'constraint']}
              onAdd={(type) => {
                onUpdateItem?.({ [type]: 'true' });
                closeOtherEditors('behavior');
              }}
              className="mt-1"
            />
          )}
        </section>
      )}

      {editingDisplayContent && (
        <section aria-label="Content" className="space-y-3">
          <h3 className="text-[13px] font-semibold tracking-[0.04em] text-ink/84">Content</h3>
          <p className="mt-1 text-[11px] leading-snug text-ink/50">
            Edit description and hint in the summary row above.
          </p>
        </section>
      )}

      {editingBehavior && (
        <section aria-label="Behavior" className="space-y-2 border-t border-border/65 pt-4 first:border-t-0 first:pt-0">
          <h3 className="text-[13px] font-semibold tracking-[0.04em] text-ink/84">
            Behavior
          </h3>
          <div className="space-y-1">
            {Object.entries(binds)
              .filter(([type, expr]) => type !== 'calculate' && type !== 'constraintMessage' && expr != null && expr !== undefined)
              .map(([bindType, expression]) => (
                <BindCard
                  key={bindType}
                  bindType={bindType}
                  expression={expression}
                  humanized={humanizeFEL(expression)}
                  message={bindType === 'constraint' ? binds.constraintMessage : undefined}
                  onRemove={() => onUpdateItem?.({ [bindType]: null })}
                >
                  <InlineExpression
                    value={expression}
                    onSave={(value) => onUpdateItem?.({ [bindType]: value ?? null })}
                    placeholder="Click to add expression"
                  />
                </BindCard>
              ))}
            <AddBehaviorMenu
              existingTypes={Object.keys(binds).filter(k => binds[k] != null && binds[k] !== undefined)}
              allowedTypes={['relevant', 'required', 'readonly', 'constraint']}
              onAdd={(type) => onUpdateItem?.({ [type]: 'true' })}
              className="mt-2"
            />
          </div>
        </section>
      )}

      {editingOptions && isChoiceField && (
        <section aria-label="Options" className="space-y-3 border-t border-border/65 pt-4 first:border-t-0 first:pt-0">
          <h3 className="text-[13px] font-semibold tracking-[0.04em] text-ink/84">
            Options
          </h3>
          {choiceOptions.map((option, index) => (
            <div key={`inline-opt-${itemPath}-${index}`} className="space-y-2">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr),minmax(0,1fr),auto] sm:items-end">
                <label className="text-[13px] font-semibold tracking-[0.01em] text-ink">
                  Option {index + 1} value
                  <input
                    aria-label={`Inline option ${index + 1} value`}
                    type="text"
                    className={lowerEditorInputClassName}

                    value={option.value}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      const next = choiceOptions.map((entry, optionIndex) =>
                        optionIndex === index ? { ...entry, value: event.currentTarget.value } : entry,
                      );
                      onUpdateItem?.({ options: next });
                    }}
                  />
                </label>
                <label className="text-[13px] font-semibold tracking-[0.01em] text-ink">
                  Option {index + 1} label
                  <input
                    aria-label={`Inline option ${index + 1} label`}
                    type="text"
                    className={lowerEditorInputClassName}

                    value={option.label}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      const next = choiceOptions.map((entry, optionIndex) =>
                        optionIndex === index ? { ...entry, label: event.currentTarget.value } : entry,
                      );
                      onUpdateItem?.({ options: next });
                    }}
                  />
                </label>
                <div className="flex items-center justify-end sm:pb-1">
                  <button
                    type="button"
                    aria-label={`Remove option ${index + 1} from ${itemLabel}`}
                    className="inline-flex items-center rounded-full border border-border/90 px-2.5 py-1 text-[12px] font-medium text-ink/75 transition-colors hover:border-error/40 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                    onClick={(event) => {
                      event.stopPropagation();
                      onUpdateItem?.({
                        options: choiceOptions.filter((_, optionIndex) => optionIndex !== index),
                      });
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <label className="block text-[13px] font-semibold tracking-[0.01em] text-ink">
                Option {index + 1} keywords (optional)
                <input
                  aria-label={`Inline option ${index + 1} search keywords`}
                  type="text"
                  className={lowerEditorInputClassName}
                  placeholder="Comma-separated type-ahead"
                  value={formatCommaSeparatedKeywords(option.keywords)}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    const keywords = parseCommaSeparatedKeywords(event.currentTarget.value);
                    const next = choiceOptions.map((entry, optionIndex) => {
                      if (optionIndex !== index) return entry;
                      const row: ChoiceOptionRow = { ...entry, value: entry.value, label: entry.label };
                      if (keywords) row.keywords = keywords;
                      else delete row.keywords;
                      return row;
                    });
                    onUpdateItem?.({ options: next });
                  }}
                />
              </label>
            </div>
          ))}
          <button
            type="button"
            aria-label={`Add option to ${itemLabel}`}
            className={EDITOR_DASH_BUTTON}
            onClick={(event) => {
              event.stopPropagation();
              onUpdateItem?.({ options: [...choiceOptions, { value: '', label: '' }] });
            }}
          >
            + Add option
          </button>
        </section>
      )}
    </div>
  );
});
