/** @filedesc Expanded lower panel for ItemRow: accordion sections for visibility, validation, value, and format. */
import { forwardRef, type FocusEventHandler } from 'react';
import { BindCard } from '../../components/ui/BindCard';
import { InlineExpression } from '../../components/ui/InlineExpression';
import { AddBehaviorMenu } from '../../components/ui/AddBehaviorMenu';
import { PrePopulateCard } from '../../components/ui/PrePopulateCard';
import {
  humanizeFEL,
} from '@formspec-org/studio-core';
import type { FormItem } from '@formspec-org/types';
import {
  fieldDetailOrphanHeading,
} from './item-row-field-detail';
import {
  EDITOR_DASH_BUTTON,
  summaryInputClassName,
  summaryInputLabel,
  summaryInputType,
} from './item-row-shared';
import type { OpenSection } from './ItemRow';

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
  isDisplayItem: boolean;
  selected: boolean | undefined;
  openSection: OpenSection;
  onSectionChange: (section: OpenSection) => void;
  preFillLowerSession: boolean;
  orphanUiLabel: string | null;
  orphanFieldDetailLabel: string | null;
  prePopulateValue: { instance: string; path: string; editable?: boolean } | null;
  statusPills: { text: string; color: string; specTerm: string }[];
  visibleMissingActions: { key: string; label: string; ariaLabel: string }[];
  fieldDetailLaunchers: FieldDetailLauncher[];
  summaryInputValue: (label: string) => string;
  updateSummaryValue: (label: string, rawValue: string) => void;
  closeInlineSummary: () => void;
  openEditorForSummary: (label: string, opts?: { preFillFromLauncher?: boolean }) => void;
  handleOrphanFieldDetailBlur: FocusEventHandler<HTMLInputElement>;
  preFillSourceInputValue: string;
  onPreFillSourceDraftChange: (value: string) => void;
  onUpdateItem: ((changes: Record<string, unknown>) => void) | undefined;
}

/** A controlled accordion section header+body for the lower panel. */
function AccordionSection({
  title,
  subtitle,
  sectionKey,
  openSection,
  onSectionChange,
  children,
  colorBar = 'border-l-accent',
}: {
  title: string;
  subtitle: string;
  sectionKey: string;
  openSection: OpenSection;
  onSectionChange: (section: OpenSection) => void;
  children: React.ReactNode;
  colorBar?: string;
}) {
  const isOpen = openSection === sectionKey;
  return (
    <div className={`border-l-2 ${colorBar} pl-3`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSectionChange(isOpen ? null : sectionKey as OpenSection);
        }}
        className="flex w-full items-center justify-between py-2 text-left"
        aria-expanded={isOpen}
        aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${title}`}
      >
        <div>
          <span className="text-[13px] font-semibold tracking-[0.04em] text-ink/84">{title}</span>
          {!isOpen && (
            <span className="ml-2 text-[11px] text-ink/50">{subtitle}</span>
          )}
        </div>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          className={`text-muted transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 3.5 L5 6.5 L8 3.5" />
        </svg>
      </button>
      {isOpen && (
        <div className="space-y-3 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}

export const ItemRowLowerPanel = forwardRef<HTMLDivElement, ItemRowLowerPanelProps>(function ItemRowLowerPanel({
  testId,
  itemLabel,
  itemPath,
  item,
  binds,
  isField,
  isChoiceField,
  isDisplayItem,
  selected,
  openSection,
  onSectionChange,
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
  openEditorForSummary,
  handleOrphanFieldDetailBlur,
  preFillSourceInputValue,
  onPreFillSourceDraftChange,
  onUpdateItem,
}, ref) {
  const editingDisplayContent =
    isDisplayItem && openSection === 'visibility';

  // Visibility-related binds
  const hasRelevant = binds.relevant != null && binds.relevant !== undefined;

  // Validation-related binds
  const hasRequired = binds.required != null && binds.required !== undefined;
  const hasConstraint = binds.constraint != null && binds.constraint !== undefined;

  // Value-related binds
  const hasCalculate = binds.calculate != null && binds.calculate !== undefined;
  const hasReadonly = binds.readonly != null && binds.readonly !== undefined;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      data-testid={`${testId}-lower-panel`}
      className="mt-4 space-y-4 border-t border-border/70 pt-4 outline-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* For fields: render accordion sections */}
      {isField && item?.type === 'field' && (
        <section data-testid={`${testId}-lower-editor`} aria-label="Field details" className="space-y-3">
          {/* Field details header - shows when any section is open */}
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

          {/* Visibility section (all items) */}
          <AccordionSection
            title="Visibility"
            subtitle="When does this show?"
            sectionKey="visibility"
            openSection={openSection}
            onSectionChange={onSectionChange}
            colorBar="border-l-logic"
          >
            {hasRelevant && (
              <BindCard
                bindType="relevant"
                expression={binds.relevant}
                humanized={humanizeFEL(binds.relevant)}
                onRemove={() => onUpdateItem?.({ relevant: null })}
              >
                <InlineExpression
                  value={binds.relevant}
                  onSave={(value) => onUpdateItem?.({ relevant: value ?? null })}
                  placeholder="Click to add expression"
                />
              </BindCard>
            )}
            {!hasRelevant && (
              <AddBehaviorMenu
                label="Add visibility condition"
                existingTypes={Object.keys(binds).filter(k => binds[k] != null && binds[k] !== undefined)}
                allowedTypes={['relevant']}
                onAdd={(type) => onUpdateItem?.({ [type]: 'true' })}
                className="mt-1"
              />
            )}
          </AccordionSection>

          {/* Validation section (fields only) */}
          <AccordionSection
            title="Validation"
            subtitle="What rules apply?"
            sectionKey="validation"
            openSection={openSection}
            onSectionChange={onSectionChange}
            colorBar="border-l-accent"
          >
            {hasRequired && (
              <BindCard
                bindType="required"
                expression={binds.required}
                humanized={humanizeFEL(binds.required)}
                onRemove={() => onUpdateItem?.({ required: null })}
              >
                <InlineExpression
                  value={binds.required}
                  onSave={(value) => onUpdateItem?.({ required: value ?? null })}
                  placeholder="Click to add expression"
                />
              </BindCard>
            )}
            {hasConstraint && (
              <BindCard
                bindType="constraint"
                expression={binds.constraint}
                humanized={humanizeFEL(binds.constraint)}
                message={binds.constraintMessage}
                onRemove={() => onUpdateItem?.({ constraint: null })}
              >
                <InlineExpression
                  value={binds.constraint}
                  onSave={(value) => onUpdateItem?.({ constraint: value ?? null })}
                  placeholder="Click to add expression"
                />
              </BindCard>
            )}
            <AddBehaviorMenu
              label="Add validation rule"
              existingTypes={Object.keys(binds).filter(k => binds[k] != null && binds[k] !== undefined)}
              allowedTypes={['required', 'constraint']}
              onAdd={(type) => onUpdateItem?.({ [type]: 'true' })}
              className="mt-1"
            />
          </AccordionSection>

          {/* Value section (fields only) */}
          <AccordionSection
            title="Value"
            subtitle="Where does the value come from?"
            sectionKey="value"
            openSection={openSection}
            onSectionChange={onSectionChange}
            colorBar="border-l-green"
          >
            {hasCalculate && (
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

            {hasReadonly && (
              <BindCard
                bindType="readonly"
                expression={binds.readonly}
                humanized={humanizeFEL(binds.readonly)}
                onRemove={() => onUpdateItem?.({ readonly: null })}
              >
                <InlineExpression
                  value={binds.readonly}
                  onSave={(value) => onUpdateItem?.({ readonly: value ?? null })}
                  placeholder="Click to add expression"
                />
              </BindCard>
            )}

            {/* AddBehaviorMenu: Calculate / Pre-populate / Readonly */}
            <AddBehaviorMenu
              label="Add Calculation / Pre-population"
              existingTypes={[
                ...(binds.calculate != null ? ['calculate'] : []),
                ...(prePopulateValue ? ['pre-populate'] : []),
                ...(binds.readonly != null ? ['readonly'] : []),
              ]}
              allowedTypes={['calculate', 'pre-populate', 'readonly']}
              onAdd={(type) => {
                if (type === 'pre-populate') {
                  onUpdateItem?.({ prePopulate: { instance: '', path: '' } });
                } else if (type === 'calculate') {
                  onUpdateItem?.({ calculate: '' });
                } else if (type === 'readonly') {
                  onUpdateItem?.({ readonly: 'true' });
                }
              }}
              className="mt-1"
            />
          </AccordionSection>

          {/* Data format section (fields only) */}
          <AccordionSection
            title="Data format"
            subtitle="How is the value displayed?"
            sectionKey="format"
            openSection={openSection}
            onSectionChange={onSectionChange}
            colorBar="border-l-muted"
          >
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
          </AccordionSection>

          {/* Behavior add button: always show when behavior action is available */}
          {visibleMissingActions.some((action) => action.key === 'behavior') && (
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
                // Route to appropriate section
                if (type === 'relevant') {
                  onSectionChange('visibility');
                } else if (type === 'required' || type === 'constraint') {
                  onSectionChange('validation');
                } else {
                  onSectionChange('value');
                }
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
    </div>
  );
});
