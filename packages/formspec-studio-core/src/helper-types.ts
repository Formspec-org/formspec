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

/** Choice option for inline options or defineChoices */
export interface ChoiceOption {
  value: string;
  label: string;
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

/** Group properties */
export interface GroupProps {
  collapsible?: boolean;
  display?: 'stack' | 'dataTable';
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
  when: string | number | boolean;
  show: string | string[];
  mode?: 'equals' | 'contains';
}

/** Layout arrangement for applyLayout */
export type LayoutArrangement = 'columns-2' | 'columns-3' | 'columns-4' | 'card' | 'sidebar' | 'inline';

/** Placement options for placeOnPage */
export interface PlacementOptions {
  span?: number;
}

/** Flow configuration */
export interface FlowProps {
  showProgress?: boolean;
  allowSkip?: boolean;
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

/** Metadata changes for setMetadata — split between title, presentation, and definition handlers */
export interface MetadataChanges {
  title?: string;
  name?: string;
  description?: string;
  url?: string;
  version?: string;
  status?: string;
  date?: string;
  versionAlgorithm?: string;
  nonRelevantBehavior?: string;
  derivedFrom?: string;
  density?: 'compact' | 'comfortable' | 'spacious';
  labelPosition?: string;
  pageMode?: string;
  defaultCurrency?: string;
}

/** Changes for updateItem — each key routes to a different handler */
export interface ItemChanges {
  label?: string;
  hint?: string;
  description?: string;
  placeholder?: string;
  ariaLabel?: string;
  options?: ChoiceOption[];
  choicesFrom?: string;
  currency?: string;
  precision?: number;
  initialValue?: unknown;
  prePopulate?: unknown;
  dataType?: string;
  required?: boolean | string;
  constraint?: string;
  constraintMessage?: string;
  calculate?: string;
  relevant?: string;
  readonly?: boolean | string;
  default?: string;
  repeatable?: boolean;
  minRepeat?: number;
  maxRepeat?: number;
  widget?: string;
  style?: Record<string, unknown>;
  page?: string;
}
