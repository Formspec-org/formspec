/** @filedesc Single expanded category editor under the ItemRow summary grid (summary-first editing). */
import {
  forwardRef,
  useCallback,
  useMemo,
  type FocusEventHandler,
} from 'react';
import { AdvisoryCallout } from '../../components/ui/AdvisoryCallout';
import { BindCard } from '../../components/ui/BindCard';
import { InlineExpression } from '../../components/ui/InlineExpression';
import { GuidedBindEditor } from '../../components/ui/GuidedBindEditor';
import { AddBehaviorMenu } from '../../components/ui/AddBehaviorMenu';
import { PrePopulateCard } from '../../components/ui/PrePopulateCard';
import {
  buildAdvisories,
  humanizeFEL,
  type Advisory,
  type AdvisoryAction,
  type AdvisoryActionKey,
} from '@formspec-org/studio-core';
import type { FormItem } from '@formspec-org/types';
import { useDefinition } from '../../state/useDefinition';
import { fieldDetailOrphanHeading } from './item-row-field-detail';
import {
  EDITOR_DASH_BUTTON,
  summaryInputClassName,
  summaryInputLabel,
  summaryInputType,
} from '../shared/item-row-shared';

/** Category keys from buildCategorySummaries (field rows). */
export type ExpandedSummaryCategory =
  | 'Visibility'
  | 'Validation'
  | 'Value'
  | 'Format';

interface FieldDetailLauncher {
  label: string;
  addLabel: string;
  testId: string;
}

export interface ItemRowCategoryPanelProps {
  testId: string;
  itemKey?: string;
  itemLabel: string;
  item: FormItem | undefined;
  binds: Record<string, string>;
  expandedCategory: ExpandedSummaryCategory;
  isField: boolean;
  isDisplayItem: boolean;
  prePopulateValue: {
    instance: string;
    path: string;
    editable?: boolean;
  } | null;
  statusPills: { text: string; color: string; specTerm: string }[];
  fieldDetailLaunchers: FieldDetailLauncher[];
  summaryInputValue: (label: string) => string;
  updateSummaryValue: (label: string, rawValue: string) => void;
  closeInlineSummary: () => void;
  openEditorForSummary: (label: string) => void;
  onExpandCategory: (category: ExpandedSummaryCategory) => void;
  orphanFieldDetailLabel: string | null;
  handleOrphanFieldDetailBlur: FocusEventHandler<HTMLInputElement>;
  onUpdateItem?: (changes: Record<string, unknown>) => void;
  /** Bind type that was just auto-created — InlineExpression starts in edit mode. */
  justCreatedBind?: string | null;
  onClearJustCreatedBind?: () => void;
  /** Signal that a bind was just created (for auto-edit). */
  onBindCreated?: (bindType: string) => void;
}

const CATEGORY_INTRO: Record<
  ExpandedSummaryCategory,
  { title: string; hint: string }
> = {
  Visibility: { title: 'Visibility', hint: 'When does this field show?' },
  Validation: { title: 'Validation', hint: 'Required rules and constraints.' },
  Value: {
    title: 'Value',
    hint: 'Calculations, initial data, pre-fill, read-only.',
  },
  Format: {
    title: 'Data format',
    hint: 'Display format, currency, and field metadata.',
  },
};

export const ItemRowCategoryPanel = forwardRef<
  HTMLDivElement,
  ItemRowCategoryPanelProps
>(function ItemRowCategoryPanel(
  {
    testId,
    itemKey,
    itemLabel,
    item,
    binds,
    expandedCategory,
    isField,
    isDisplayItem,
    prePopulateValue,
    statusPills,
    fieldDetailLaunchers,
    summaryInputValue,
    updateSummaryValue,
    closeInlineSummary,
    openEditorForSummary,
    onExpandCategory,
    orphanFieldDetailLabel,
    handleOrphanFieldDetailBlur,
    onUpdateItem,
    justCreatedBind,
    onClearJustCreatedBind,
    onBindCreated,
  },
  ref,
) {
  const definition = useDefinition();
  const hasRelevant = binds.relevant != null;
  const hasRequired = binds.required != null;
  const hasConstraint = binds.constraint != null;
  const hasCalculate = binds.calculate != null;
  const hasReadonly = binds.readonly != null;

  const intro = CATEGORY_INTRO[expandedCategory];

  const advisories = useMemo(
    () =>
      isField && item?.type === 'field'
        ? buildAdvisories(binds, item)
        : [],
    [binds, isField, item],
  );

  const runAdvisory = useCallback(
    (key: AdvisoryActionKey) => {
      switch (key) {
        case 'remove_required':
          onUpdateItem?.({ required: null });
          onExpandCategory('Validation');
          break;
        case 'remove_readonly':
          onUpdateItem?.({ readonly: null });
          onExpandCategory('Value');
          break;
        case 'add_formula':
          onUpdateItem?.({ calculate: '' });
          onExpandCategory('Value');
          break;
        case 'add_initial_value':
          openEditorForSummary('Initial');
          break;
        case 'add_pre_fill':
          onUpdateItem?.({ prePopulate: { instance: '', path: '' } });
          onExpandCategory('Value');
          break;
        case 'remove_pre_populate':
          onUpdateItem?.({ prePopulate: null });
          break;
        case 'remove_formula':
          onUpdateItem?.({ calculate: null });
          break;
        case 'review_formula':
          onExpandCategory('Value');
          break;
      }
    },
    [onExpandCategory, onUpdateItem, openEditorForSummary],
  );

  if (isDisplayItem && expandedCategory === 'Visibility') {
    return (
      <div
        ref={ref}
        // CP-3: tabIndex=-1 allows programmatic focus but not Tab-reach — by design.
        tabIndex={-1}
        data-testid={`${testId}-lower-panel`}
        className='mt-1 rounded-[12px] bg-bg-default/55 p-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] outline-none dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
        onClick={(e) => e.stopPropagation()}
      >
        <section
          data-testid={`${testId}-lower-editor`}
          aria-label='Content visibility'
          className='space-y-3'
        >
          <div className='min-w-0'>
            <h3 className='text-[13px] font-semibold tracking-[0.06em] text-ink/80'>
              {intro.title}
            </h3>
            <p className='mt-0.5 text-[10px] leading-snug text-ink/50'>
              {intro.hint}
            </p>
          </div>
          {hasRelevant && (
            <BindCard
              bindType='relevant'
              expression={binds.relevant}
              humanized={humanizeFEL(binds.relevant).text}
              onRemove={() => onUpdateItem?.({ relevant: null })}
            >
              <GuidedBindEditor
                bindType='relevant'
                value={binds.relevant}
                autoEdit={justCreatedBind === 'relevant'}
                onSave={(value) => {
                  onClearJustCreatedBind?.();
                  onUpdateItem?.({ relevant: value || null });
                }}
                definition={definition}
              />
            </BindCard>
          )}
          {!hasRelevant && (
            <AddBehaviorMenu
              label='Add visibility condition'
              existingTypes={Object.keys(binds).filter(
                (k) => binds[k] != null,
              )}
              allowedTypes={['relevant']}
              onAdd={(type) => {
                onUpdateItem?.({ [type]: '' });
                onBindCreated?.(type);
              }}
              className='mt-1'
            />
          )}
        </section>
      </div>
    );
  }

  if (!(isField && item?.type === 'field')) {
    return null;
  }

  return (
    <div
      ref={ref}
      tabIndex={-1}
      data-testid={`${testId}-lower-panel`}
      className='mt-1 rounded-[12px] bg-bg-default/55 p-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] outline-none dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
      onClick={(e) => e.stopPropagation()}
    >
      <section
        data-testid={`${testId}-lower-editor`}
        aria-label='Field details'
        className='space-y-3'
      >
        <div className='flex items-baseline justify-between gap-3'>
          <div className='min-w-0'>
            <h3 className='text-[13px] font-semibold tracking-[0.06em] text-ink/80'>
              {intro.title}
            </h3>
            <p className='mt-0.5 text-[10px] leading-snug text-ink/50'>
              {intro.hint}
            </p>
          </div>
          {statusPills.length > 0 && (
            <span className='font-mono text-[10px] tracking-[0.12em] text-ink/55 shrink-0'>
              Config
            </span>
          )}
        </div>

        {advisories.length > 0 && (
          <div className='space-y-2' data-testid={`${testId}-advisories`}>
            {advisories.map((a: Advisory, idx: number) => (
              <AdvisoryCallout
                key={`${idx}-${a.message.slice(0, 32)}`}
                message={a.message}
                severity={a.severity}
                actions={a.actions.map((act: AdvisoryAction) => ({
                  label: act.label,
                  onClick: () => runAdvisory(act.key),
                }))}
              />
            ))}
          </div>
        )}

        {expandedCategory === 'Visibility' && (
          <div className='space-y-3'>
            {hasRelevant && (
              <BindCard
                bindType='relevant'
                expression={binds.relevant}
                humanized={humanizeFEL(binds.relevant).text}
                onRemove={() => onUpdateItem?.({ relevant: null })}
              >
                <GuidedBindEditor
                  bindType='relevant'
                  value={binds.relevant}
                  autoEdit={justCreatedBind === 'relevant'}
                  onSave={(value) => {
                    onClearJustCreatedBind?.();
                    onUpdateItem?.({ relevant: value || null });
                  }}
                  definition={definition}
                />
              </BindCard>
            )}
            {!hasRelevant && (
              <AddBehaviorMenu
                label='Add visibility condition'
                existingTypes={Object.keys(binds).filter(
                  (k) => binds[k] != null,
                )}
                allowedTypes={['relevant']}
                onAdd={(type) => {
                  onUpdateItem?.({ [type]: '' });
                  onBindCreated?.(type);
                  onExpandCategory('Visibility');
                }}
                className='mt-1'
              />
            )}
          </div>
        )}

        {expandedCategory === 'Validation' && (
          <div className='space-y-3'>
            {hasRequired && (
              <BindCard
                bindType='required'
                expression={binds.required}
                humanized={humanizeFEL(binds.required).text}
                onRemove={() => onUpdateItem?.({ required: null })}
              >
                <GuidedBindEditor
                  bindType='required'
                  value={binds.required}
                  autoEdit={justCreatedBind === 'required'}
                  onSave={(value) => {
                    onClearJustCreatedBind?.();
                    onUpdateItem?.({ required: value || null });
                  }}
                  definition={definition}
                />
              </BindCard>
            )}
            {hasConstraint && (
              <BindCard
                bindType='constraint'
                expression={binds.constraint}
                humanized={humanizeFEL(binds.constraint).text}
                message={binds.constraintMessage}
                onRemove={() => onUpdateItem?.({ constraint: null })}
              >
                <GuidedBindEditor
                  bindType='constraint'
                  value={binds.constraint}
                  autoEdit={justCreatedBind === 'constraint'}
                  onSave={(value) => {
                    onClearJustCreatedBind?.();
                    onUpdateItem?.({ constraint: value || null });
                  }}
                  definition={definition}
                />
              </BindCard>
            )}
            <AddBehaviorMenu
              label='Add validation rule'
              existingTypes={Object.keys(binds).filter(
                (k) => binds[k] != null,
              )}
              allowedTypes={['required', 'constraint']}
              onAdd={(type) => {
                // Literal mandatory uses FEL "true" so the bind is active without opening the editor.
                const initial = type === 'required' ? 'true' : '';
                onUpdateItem?.({ [type]: initial });
                if (initial === '') onBindCreated?.(type);
                onExpandCategory('Validation');
              }}
              className='mt-1'
            />
          </div>
        )}

        {expandedCategory === 'Value' && (
          <div className='space-y-3'>
            {hasCalculate && (
              <BindCard
                bindType='calculate'
                expression={binds.calculate}
                humanized={humanizeFEL(binds.calculate).text}
                onRemove={() => onUpdateItem?.({ calculate: null })}
              >
                <InlineExpression
                  value={binds.calculate}
                  autoEdit={justCreatedBind === 'calculate'}
                  onSave={(value) => {
                    onClearJustCreatedBind?.();
                    onUpdateItem?.({ calculate: value || null });
                  }}
                  placeholder='Click to add expression'
                />
              </BindCard>
            )}

            {item?.initialValue != null && (
              <BindCard
                bindType='Initial Value'
                expression={String(item.initialValue)}
              >
                <InlineExpression
                  value={String(item.initialValue)}
                  onSave={(value) =>
                    onUpdateItem?.({ initialValue: value || null })
                  }
                  placeholder='Click to add initial value (prefix = for FEL)'
                />
              </BindCard>
            )}

            {prePopulateValue && (
              <PrePopulateCard
                value={prePopulateValue}
                onChange={(val) => onUpdateItem?.({ prePopulate: val })}
                onRemove={() => onUpdateItem?.({ prePopulate: null })}
                itemKey={itemKey}
              />
            )}

            {hasReadonly && (
              <BindCard
                bindType='readonly'
                expression={binds.readonly}
                humanized={humanizeFEL(binds.readonly).text}
                onRemove={() => onUpdateItem?.({ readonly: null })}
              >
                <GuidedBindEditor
                  bindType='readonly'
                  value={binds.readonly}
                  autoEdit={justCreatedBind === 'readonly'}
                  onSave={(value) => {
                    onClearJustCreatedBind?.();
                    onUpdateItem?.({ readonly: value || null });
                  }}
                  definition={definition}
                />
              </BindCard>
            )}

            <AddBehaviorMenu
              label='Add calculation / pre-population / read-only'
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
                  onBindCreated?.('calculate');
                } else if (type === 'readonly') {
                  onUpdateItem?.({ readonly: '' });
                  onBindCreated?.('readonly');
                }
                onExpandCategory('Value');
              }}
              className='mt-1'
            />
          </div>
        )}

        {expandedCategory === 'Format' && (
          <div className='space-y-3'>
            {orphanFieldDetailLabel &&
            !['Pre-fill', 'Initial'].includes(orphanFieldDetailLabel) ? (
              <div
                data-testid={`${testId}-orphan-field-detail`}
                className='rounded-[10px] border border-border/70 bg-bg-default/55 px-3 py-3'
              >
                <div className='text-[12px] font-semibold tracking-[0.02em] text-ink/88'>
                  {fieldDetailOrphanHeading(orphanFieldDetailLabel)}
                </div>
                <input
                  aria-label={summaryInputLabel(orphanFieldDetailLabel)}
                  type={summaryInputType(orphanFieldDetailLabel)}
                  autoFocus
                  className={summaryInputClassName}
                  value={summaryInputValue(orphanFieldDetailLabel)}
                  maxLength={
                    orphanFieldDetailLabel === 'Currency' ? 3 : undefined
                  }
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    const v = event.currentTarget.value;
                    const raw =
                      orphanFieldDetailLabel === 'Currency'
                        ? v.toUpperCase().replace(/[^A-Z]/g, '')
                        : v;
                    updateSummaryValue(orphanFieldDetailLabel, raw);
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

            {fieldDetailLaunchers.filter(
              (l) => !['Initial', 'Pre-fill'].includes(l.label),
            ).length > 0 ? (
              <div className='flex flex-wrap gap-2'>
                {fieldDetailLaunchers
                  .filter((l) => !['Initial', 'Pre-fill'].includes(l.label))
                  .map((launch) => (
                    <button
                      key={launch.label}
                      type='button'
                      data-testid={launch.testId}
                      aria-label={`Add ${launch.addLabel} to ${itemLabel}`}
                      className={EDITOR_DASH_BUTTON}
                      onMouseDown={(event) => {
                        event.stopPropagation();
                        if (orphanFieldDetailLabel) event.preventDefault();
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
          </div>
        )}
      </section>
    </div>
  );
});
