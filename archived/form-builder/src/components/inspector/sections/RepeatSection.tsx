import { Collapsible } from '../../controls/Collapsible';
import { Dropdown } from '../../controls/Dropdown';
import { NumberInput } from '../../controls/NumberInput';
import { Toggle } from '../../controls/Toggle';
import type { GroupDataTableColumn, GroupDisplayMode } from '../../../state/mutations';

interface RepeatSectionProps {
  testIdPrefix: string;
  open: boolean;
  repeatable: boolean;
  minRepeat?: number;
  maxRepeat?: number;
  onToggle: (open: boolean) => void;
  onRepeatableToggle: (value: boolean) => void;
  onMinRepeatInput: (value: number | undefined) => void;
  onMaxRepeatInput: (value: number | undefined) => void;
  displayMode: GroupDisplayMode;
  childFields: Array<{ key: string; label: string }>;
  tableColumns: GroupDataTableColumn[];
  showRowNumbers: boolean;
  allowAddRows: boolean;
  allowRemoveRows: boolean;
  sortable: boolean;
  filterable: boolean;
  sortBy?: string;
  sortDirection: 'asc' | 'desc';
  onDisplayModeChange: (value: GroupDisplayMode) => void;
  onTableColumnsChange: (columns: GroupDataTableColumn[]) => void;
  onShowRowNumbersToggle: (value: boolean) => void;
  onAllowAddRowsToggle: (value: boolean) => void;
  onAllowRemoveRowsToggle: (value: boolean) => void;
  onSortableToggle: (value: boolean) => void;
  onFilterableToggle: (value: boolean) => void;
  onSortByChange: (value: string | null) => void;
  onSortDirectionChange: (value: 'asc' | 'desc') => void;
}

export function RepeatSection(props: RepeatSectionProps) {
  const selectedColumnKeys = new Set(props.tableColumns.map((column) => column.bind));
  const sortColumnOptions = props.tableColumns.map((column) => ({
    value: column.bind,
    label: column.header
  }));
  const summary = props.repeatable
    ? `Repeatable · ${props.displayMode === 'table' ? 'Data table' : 'Stack'}${
        props.minRepeat !== undefined || props.maxRepeat !== undefined ? ' · Limits set' : ''
      }`
    : null;

  return (
    <Collapsible id="repeat" title="Repeat" open={props.open} summary={summary} onToggle={props.onToggle}>
      <Toggle
        label="Repeatable group"
        checked={props.repeatable}
        testId={`${props.testIdPrefix}-repeatable-toggle`}
        onToggle={props.onRepeatableToggle}
      />
      <NumberInput
        label="Minimum instances"
        value={props.minRepeat}
        min={0}
        step={1}
        testId={`${props.testIdPrefix}-min-repeat-input`}
        onInput={props.onMinRepeatInput}
      />
      <NumberInput
        label="Maximum instances"
        value={props.maxRepeat}
        min={0}
        step={1}
        testId={`${props.testIdPrefix}-max-repeat-input`}
        onInput={props.onMaxRepeatInput}
      />
      <Dropdown
        label="Display mode"
        value={props.displayMode}
        disabled={!props.repeatable}
        testId={`${props.testIdPrefix}-display-mode-input`}
        options={[
          { value: 'stack', label: 'Stack' },
          { value: 'table', label: 'Data table' }
        ]}
        onChange={(value) => {
          props.onDisplayModeChange(value === 'table' ? 'table' : 'stack');
        }}
      />

      {props.repeatable && props.displayMode === 'table' ? (
        <div class="repeat-table-config">
          <p class="repeat-table-config__title">Columns</p>
          {props.childFields.length === 0 ? (
            <p class="inspector-hint">Add child fields to configure table columns.</p>
          ) : (
            <div class="repeat-table-config__columns">
              {props.childFields.map((field) => (
                <label class="repeat-table-config__column-option" key={field.key}>
                  <input
                    data-testid={`${props.testIdPrefix}-table-column-toggle-${field.key}`}
                    type="checkbox"
                    checked={selectedColumnKeys.has(field.key)}
                    onChange={(event) => {
                      const enabled = (event.currentTarget as HTMLInputElement).checked;
                      const nextSelected = new Set(selectedColumnKeys);
                      if (enabled) {
                        nextSelected.add(field.key);
                      } else {
                        nextSelected.delete(field.key);
                      }

                      const existingByBind = new Map(props.tableColumns.map((column) => [column.bind, column]));
                      const nextColumns: GroupDataTableColumn[] = props.childFields
                        .filter((candidate) => nextSelected.has(candidate.key))
                        .map((candidate) => ({
                          bind: candidate.key,
                          header: existingByBind.get(candidate.key)?.header ?? candidate.label
                        }));

                      props.onTableColumnsChange(nextColumns);
                    }}
                  />
                  <span>{field.label}</span>
                </label>
              ))}
            </div>
          )}

          <div class="repeat-table-config__toggles">
            <Toggle
              label="Show row numbers"
              checked={props.showRowNumbers}
              testId={`${props.testIdPrefix}-table-row-numbers-toggle`}
              onToggle={props.onShowRowNumbersToggle}
            />
            <Toggle
              label="Allow adding rows"
              checked={props.allowAddRows}
              testId={`${props.testIdPrefix}-table-allow-add-toggle`}
              onToggle={props.onAllowAddRowsToggle}
            />
            <Toggle
              label="Allow removing rows"
              checked={props.allowRemoveRows}
              testId={`${props.testIdPrefix}-table-allow-remove-toggle`}
              onToggle={props.onAllowRemoveRowsToggle}
            />
            <Toggle
              label="Enable sorting"
              checked={props.sortable}
              testId={`${props.testIdPrefix}-table-sortable-toggle`}
              onToggle={(value) => {
                props.onSortableToggle(value);
                if (!value) {
                  props.onSortByChange(null);
                  return;
                }
                if (props.sortBy) {
                  return;
                }
                props.onSortByChange(sortColumnOptions[0]?.value ?? null);
              }}
            />
            <Toggle
              label="Enable row filtering"
              checked={props.filterable}
              testId={`${props.testIdPrefix}-table-filterable-toggle`}
              onToggle={props.onFilterableToggle}
            />
          </div>

          {props.sortable ? (
            <div class="repeat-table-config__sorting">
              <Dropdown
                label="Default sort column"
                value={props.sortBy ?? ''}
                testId={`${props.testIdPrefix}-table-sort-by-input`}
                options={[
                  { value: '', label: 'No default sort' },
                  ...sortColumnOptions
                ]}
                onChange={(value) => {
                  props.onSortByChange(value || null);
                }}
              />
              <Dropdown
                label="Sort direction"
                value={props.sortDirection}
                testId={`${props.testIdPrefix}-table-sort-direction-input`}
                options={[
                  { value: 'asc', label: 'Ascending' },
                  { value: 'desc', label: 'Descending' }
                ]}
                onChange={(value) => {
                  props.onSortDirectionChange(value === 'desc' ? 'desc' : 'asc');
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </Collapsible>
  );
}
