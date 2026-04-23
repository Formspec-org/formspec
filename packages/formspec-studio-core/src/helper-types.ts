/** Structured warning — prefer over prose strings for programmatic consumers */
export interface HelperWarning {
  code: string;
  message: string;
  detail?: object;
}

/** Return type for all helper methods */
export interface HelperResult {
  summary: string;
  action: {
    helper: string;
    params: Record<string, unknown>;
  };
  affectedPaths: string[];
  createdId?: string;
  warnings?: HelperWarning[];
}

/** Thrown by helpers when pre-validation fails */
export class HelperError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly detail?: object,
  ) {
    super(message);
    this.name = 'HelperError';
  }
}

/** Choice option for inline options or defineChoices (matches definition OptionEntry). */
export interface ChoiceOption {
  value: string;
  label: string;
  /** Optional combobox type-ahead strings (abbreviations, codes). */
  keywords?: string[];
}

/** Field properties for addField / addScreenField */
export interface FieldProps {
  placeholder?: string;
  hint?: string;
  description?: string;
  ariaLabel?: string;
  choices?: ChoiceOption[];
  choicesFrom?: string;
  widget?: string;
  page?: string;
  required?: boolean;
  readonly?: boolean;
  initialValue?: unknown;
  insertIndex?: number;
  parentPath?: string;
}

/** Content properties for addContent */
export interface ContentProps {
  page?: string;
  parentPath?: string;
  insertIndex?: number;
}

/** Group properties */
export interface GroupProps {
  display?: 'stack' | 'dataTable';
  page?: string;
  parentPath?: string;
  insertIndex?: number;
}

/** Repeat group configuration */
export interface RepeatProps {
  min?: number;
  max?: number;
  addLabel?: string;
  removeLabel?: string;
}

/** Branch path — one arm of a conditional branch */
export interface BranchPath {
  /** Value to match against. Required for 'equals'/'contains' modes, optional for 'condition' mode. */
  when?: string | number | boolean;
  show: string | string[];
  mode?: 'equals' | 'contains' | 'condition';
  /** Raw FEL expression — used when mode is 'condition' (escape hatch for advanced users). */
  condition?: string;
}

/** Layout arrangement for applyLayout */
export type LayoutArrangement = 'columns-2' | 'columns-3' | 'columns-4' | 'card' | 'sidebar' | 'inline';
/** @internal */
export const LAYOUT_ARRANGEMENTS = ['columns-2', 'columns-3', 'columns-4', 'card', 'sidebar', 'inline'] as const;

/** Placement options for placeOnPage */
export interface PlacementOptions {
  span?: number;
  insertIndex?: number;
}

/** Layout-side add-item request */
export interface LayoutAddItemSpec {
  itemType: 'field' | 'group' | 'display' | 'layout';
  label: string;
  key?: string;
  /** Core data type when not using a registry extension. */
  dataType?: string;
  /** Registry `dataType` extension name (e.g. `x-formspec-email`). */
  registryDataType?: string;
  component?: string;
  repeatable?: boolean;
  presentation?: Record<string, unknown>;
  parentPath?: string;
  props?: Record<string, unknown>;
}

/** Flow configuration */
export interface FlowProps {
  showProgress?: boolean;
  allowSkip?: boolean;
  pageTitles?: Record<string, string>;
}

/** Validation options for addValidation */
export interface ValidationOptions {
  timing?: 'continuous' | 'submit' | 'demand';
  severity?: 'error' | 'warning' | 'info';
  code?: string;
  activeWhen?: string;
}

/** Named external data source (secondary instance) */
export interface InstanceProps {
  source?: string;
  data?: unknown;
  schema?: object;
  static?: boolean;
  readonly?: boolean;
  description?: string;
}

/** FEL expression validation result — returned by validateFELExpression() */
export interface FELValidationResult {
  valid: boolean;
  errors: Array<{ message: string; line?: number; column?: number }>;
  references: string[];
  functions: string[];
}

/** FEL autocomplete suggestion — returned by felAutocompleteSuggestions() */
export interface FELSuggestion {
  label: string;
  kind: 'field' | 'function' | 'variable' | 'instance' | 'keyword';
  detail?: string;
  insertText: string;
}

/** Widget info — returned by listWidgets() */
export interface WidgetInfo {
  name: string;
  component: string;
  compatibleDataTypes: string[];
}

/** Field type catalog entry — returned by fieldTypeCatalog() */
export interface FieldTypeCatalogEntry {
  alias: string;
  dataType: string;
  defaultWidget: string;
}

/** Metadata changes for setMetadata — split between title, presentation, and definition handlers */
export interface MetadataChanges {
  title?: string | null;
  name?: string | null;
  description?: string | null;
  url?: string | null;
  version?: string | null;
  status?: 'draft' | 'active' | 'retired' | 'unknown' | null;
  date?: string | null;
  versionAlgorithm?: string | null;
  nonRelevantBehavior?: 'empty' | 'suppress' | null;
  derivedFrom?: string | null;
  density?: 'compact' | 'comfortable' | 'spacious' | null;
  labelPosition?: 'top' | 'start' | 'hidden' | null;
  pageMode?: 'single' | 'wizard' | 'tabs' | null;
  defaultCurrency?: string | null;
  showProgress?: boolean | null;
  allowSkip?: boolean | null;
  defaultTab?: number | null;
  tabPosition?: 'top' | 'bottom' | 'left' | 'right' | null;
  direction?: 'ltr' | 'rtl' | 'auto' | null;
}

/** Changes for updateItem — each key routes to a different handler */
export interface ItemChanges {
  label?: string | null;
  hint?: string | null;
  description?: string | null;
  placeholder?: string;
  ariaLabel?: string;
  options?: ChoiceOption[] | null;
  choicesFrom?: string;
  currency?: string | null;
  precision?: number | null;
  initialValue?: unknown;
  prePopulate?: unknown;
  dataType?: string;
  required?: boolean | string | null;
  constraint?: string | null;
  constraintMessage?: string | null;
  calculate?: string | null;
  relevant?: string | null;
  readonly?: boolean | string | null;
  default?: string | null;
  repeatable?: boolean;
  minRepeat?: number | null;
  maxRepeat?: number | null;
  widget?: string | null;
  style?: Record<string, unknown>;
  page?: string;
  prefix?: string | null;
  suffix?: string | null;
  semanticType?: string | null;
  /** Allow dynamic bind-type keys (e.g. from behavior rules editor) */
  [key: string]: unknown;
}
