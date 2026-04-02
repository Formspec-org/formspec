/** @filedesc Shared types, constants, and small presentational components for ItemRow and its sub-panels. */

export interface SummaryEntry {
  label: string;
  value: string;
}

export interface StatusPill {
  text: string;
  color: 'accent' | 'logic' | 'error' | 'green' | 'amber' | 'muted';
  /** Spec-normative term for tooltip discoverability. */
  specTerm: string;
  /** Matches `buildStatusPills` when expression diagnostics warn. */
  warn?: boolean;
}

export interface MissingAction {
  key: string;
  label: string;
  ariaLabel: string;
}

/** Dashed outline for "add" actions in the expanded editor (field-detail launchers, behavior, options). */
export const EDITOR_DASH_BUTTON =
  'inline-flex items-center rounded-full border border-dashed border-accent/50 px-2.5 py-1 text-[12px] font-medium text-accent transition-colors hover:border-accent/70 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35';

export const summaryInputClassName = 'mt-1 w-full rounded-[6px] border border-border/70 bg-bg-default/80 px-2.5 py-2 text-[14px] leading-5 text-ink outline-none transition-colors focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25';

export const lowerEditorInputClassName = 'mt-1 w-full appearance-none border-0 border-b border-border/75 bg-transparent px-0 pb-2 pt-2 text-[14px] text-ink outline-none transition-colors placeholder:text-muted [color-scheme:light] focus:border-accent focus-visible:ring-0 dark:[color-scheme:dark]';

export function PreFillSourceHint() {
  return (
    <p className="mt-1 text-[11px] leading-snug text-ink/50">
      <span className="font-mono text-ink/65">$</span> = form fields; <span className="font-mono text-ink/65">@</span> = context (e.g.{' '}
      <span className="font-mono text-ink/65">@instance(&apos;name&apos;).field</span>). Shorthand:{' '}
      <span className="font-mono text-ink/65">@name.field</span> — leading <span className="font-mono text-ink/65">$</span> is fine too.
    </p>
  );
}

export function EditMark({ testId }: { testId?: string }) {
  return (
    <span
      aria-hidden="true"
      data-testid={testId}
      className="ml-1 inline-flex shrink-0 items-center justify-center text-ink/30 transition-colors group-hover:text-accent/55"
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      </svg>
    </span>
  );
}

export function summaryInputLabel(label: string): string {
  switch (label) {
    case 'Description': return 'Inline description';
    case 'Hint': return 'Inline hint';
    case 'Initial': return 'Inline initial value';
    case 'Currency': return 'Inline currency';
    case 'Precision': return 'Inline precision';
    case 'Prefix': return 'Inline prefix';
    case 'Suffix': return 'Inline suffix';
    case 'Semantic': return 'Inline semantic';
    case 'Pre-fill': return 'Inline pre-fill';
    case 'Calculate': return 'Inline formula';
    case 'Relevant': return 'Inline visibility condition';
    case 'Readonly': return 'Inline locked rule';
    case 'Required': return 'Inline mandatory rule';
    case 'Constraint': return 'Inline validation rule';
    case 'Message': return 'Inline message';
    default: return `Inline ${label.toLowerCase()}`;
  }
}

export function summaryInputType(label: string): 'text' | 'number' {
  return label === 'Precision' ? 'number' : 'text';
}
