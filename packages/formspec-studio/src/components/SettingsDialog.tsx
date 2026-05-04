/** @filedesc Modal dialog for editing top-level form settings (title, version, status, page mode, density). */
import { useEffect } from 'react';
import { useDefinition } from '../state/useDefinition';
import { useProject } from '../state/useProject';
import { useEscapeKey } from '../hooks/useEscapeKey';
import type { MetadataChanges } from '@formspec-org/studio-core';
import { HelpTip } from './ui/HelpTip';
import { BLANK_URL_PLACEHOLDER, mintUrlFromName } from '../fixtures/blank-definition';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const STATUS_OPTIONS = ['draft', 'active', 'retired'] as const;
const PAGE_MODE_OPTIONS = ['single', 'wizard', 'tabs'] as const;
const LABEL_POSITION_OPTIONS = ['top', 'start', 'hidden'] as const;
const DENSITY_OPTIONS = ['compact', 'comfortable', 'spacious'] as const;
const NON_RELEVANT_OPTIONS = ['remove', 'empty', 'keep'] as const;

function FieldLabel({ htmlFor, children, help }: { htmlFor: string; children: React.ReactNode; help?: string }) {
  const label = (
    <label htmlFor={htmlFor} className="font-mono text-[11px] text-muted uppercase tracking-tight shrink-0 w-[120px]">
      {help ? <HelpTip text={help}>{children}</HelpTip> : children}
    </label>
  );
  return label;
}

function ReadOnlyRow({ label, value, help }: { label: string; value: string; help?: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="font-mono text-[11px] text-muted uppercase tracking-tight shrink-0 w-[120px]">
        {help ? <HelpTip text={help}>{label}</HelpTip> : label}
      </span>
      <span className="font-mono text-[12px] text-muted">{value}</span>
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  help,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  help?: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <FieldLabel htmlFor={id} help={help}>{label}</FieldLabel>
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-[4px] border border-border bg-bg-default px-2 py-1.5 text-[12.5px] font-mono outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-shadow"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function TextInputField({
  id,
  label,
  value,
  type = 'text',
  onCommit,
  help,
}: {
  id: string;
  label: string;
  value: string;
  type?: 'text' | 'date';
  onCommit: (value: string) => void;
  help?: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <FieldLabel htmlFor={id} help={help}>{label}</FieldLabel>
      <input
        id={id}
        aria-label={label}
        type={type}
        defaultValue={value}
        onBlur={(e) => {
          const trimmed = e.target.value.trim();
          if (trimmed !== value) onCommit(trimmed);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="flex-1 rounded-[4px] border border-border bg-bg-default px-2 py-1.5 text-[12.5px] font-mono outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-shadow"
      />
    </div>
  );
}

function TextAreaField({
  id,
  label,
  value,
  onCommit,
  help,
}: {
  id: string;
  label: string;
  value: string;
  onCommit: (value: string) => void;
  help?: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <FieldLabel htmlFor={id} help={help}>{label}</FieldLabel>
      <textarea
        id={id}
        aria-label={label}
        defaultValue={value}
        rows={2}
        onBlur={(e) => {
          const trimmed = e.target.value.trim();
          if (trimmed !== value) onCommit(trimmed);
        }}
        className="flex-1 rounded-[4px] border border-border bg-bg-default px-2 py-1.5 text-[12.5px] font-mono outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-shadow resize-none"
      />
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-[11px] font-bold tracking-[0.12em] uppercase text-muted mb-3 mt-1">
      {children}
    </h3>
  );
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const definition = useDefinition();
  const project = useProject();
  const presentation = definition.formPresentation ?? {};

  useEscapeKey(onClose, open);

  if (!open) return null;

  const setProperty = (property: string, value: string) => {
    project.setMetadata({ [property]: value || undefined } as MetadataChanges);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        data-testid="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Form Settings"
        className="w-full max-w-lg bg-surface border border-border rounded-lg shadow-xl"
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Form Settings</h2>
          <button
            type="button"
            aria-label="Close"
            className="p-1 rounded-[4px] hover:bg-subtle text-muted hover:text-ink transition-colors focus-ring"
            onClick={onClose}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Read-only identity */}
          <div className="space-y-2.5">
            <ReadOnlyRow label="$formspec" value={definition.$formspec} help="Specification version. Always 1.0." />
          </div>

          <div className="border-t border-border" />

          {/* Editable identity */}
          <div className="space-y-4">
            <SectionHeading>Identity</SectionHeading>
            <TextInputField id="settings-title" label="Title" value={definition.title ?? ''} onCommit={(v) => setProperty('title', v)} help="Human-readable display name shown by authoring tools and form renderers." />
            <TextInputField id="settings-name" label="Name" value={definition.name ?? ''} onCommit={(v) => {
              const changes: MetadataChanges = { name: v || undefined } as MetadataChanges;
              if (definition.url === BLANK_URL_PLACEHOLDER && v) {
                (changes as Record<string, unknown>).url = mintUrlFromName(v);
              }
              project.setMetadata(changes);
            }} help="Machine-readable short name. Letters, digits, and hyphens only." />
            <TextInputField id="settings-url" label="URL" value={definition.url ?? ''} onCommit={(v) => setProperty('url', v)} help="Canonical URI identifier. Stable across versions — all versions of the same form share this URL. Auto-derived from Name on first edit." />
            <TextAreaField id="settings-description" label="Description" value={definition.description ?? ''} onCommit={(v) => setProperty('description', v)} help="Human-readable description of the form's purpose and scope." />
            <TextInputField id="settings-version" label="Version" value={definition.version ?? ''} onCommit={(v) => setProperty('version', v)} help="Version identifier. Format governed by versionAlgorithm (default: semver)." />
            <SelectField id="settings-status" label="Status" value={definition.status ?? 'draft'} options={STATUS_OPTIONS} onChange={(v) => setProperty('status', v)} help="Lifecycle state. draft → active → retired. Active definitions are immutable." />
            <TextInputField id="settings-date" label="Date" type="date" value={definition.date ?? ''} onCommit={(v) => setProperty('date', v)} help="Publication or last-modified date (ISO 8601)." />
          </div>

          <div className="border-t border-border" />

          {/* Presentation */}
          <div className="space-y-4">
            <SectionHeading>Presentation</SectionHeading>
            <SelectField id="settings-pageMode" label="Page Mode" value={presentation.pageMode ?? 'single'} options={PAGE_MODE_OPTIONS} onChange={(v) => setProperty('pageMode', v)} help="How top-level groups are paginated. single: one page. wizard: sequential steps. tabs: tabbed sections." />
            <SelectField id="settings-labelPosition" label="Label Position" value={presentation.labelPosition ?? 'top'} options={LABEL_POSITION_OPTIONS} onChange={(v) => setProperty('labelPosition', v)} help="Default label placement. top: above input. start: beside input. hidden: visually hidden but accessible." />
            <SelectField id="settings-density" label="Density" value={presentation.density ?? 'comfortable'} options={DENSITY_OPTIONS} onChange={(v) => setProperty('density', v)} help="Spacing density for form layout. Affects padding and margins between fields." />
            <TextInputField id="settings-currency" label="Default Currency" value={presentation.defaultCurrency ?? ''} onCommit={(v) => setProperty('defaultCurrency', v)} help="Default ISO 4217 currency code for money fields (e.g. USD, EUR)." />
          </div>

          <div className="border-t border-border" />

          {/* Behavior */}
          <div className="space-y-4">
            <SectionHeading>Behavior</SectionHeading>
            <SelectField id="settings-nonRelevant" label="Non-Relevant Behavior" value={definition.nonRelevantBehavior ?? 'remove'} options={NON_RELEVANT_OPTIONS} onChange={(v) => setProperty('nonRelevantBehavior', v)} help="How non-relevant fields appear in submitted data. remove: excluded. empty: null. keep: retain values." />
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end">
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded-[4px] border border-border text-muted hover:bg-surface-hover hover:text-ink transition-colors focus-ring"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
