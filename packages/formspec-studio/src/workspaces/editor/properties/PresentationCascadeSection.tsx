/** @filedesc Properties panel section showing the 5-level presentation cascade provenance for the selected item. */
import { Section } from '../../../components/ui/Section';
import type { ResolvedProperty } from '@formspec-org/studio-core';

const SOURCE_LABELS: Record<ResolvedProperty['source'], string> = {
  'form-default': 'Form Default',
  'item-hint': 'Definition',
  'default': 'Theme Default',
  'selector': 'Selector',
  'item-override': 'Override',
};

const SOURCE_COLORS: Record<ResolvedProperty['source'], string> = {
  'form-default': 'bg-slate-100 text-slate-600 border-slate-200',
  'item-hint': 'bg-blue-50 text-blue-600 border-blue-200',
  'default': 'bg-amber-50 text-amber-700 border-amber-200',
  'selector': 'bg-purple-50 text-purple-600 border-purple-200',
  'item-override': 'bg-accent/10 text-accent border-accent/25',
};

const DISPLAY_ORDER: string[] = [
  'widgetHint', 'widget', 'labelPosition', 'density',
  'widgetConfig', 'style', 'cssClass', 'accessibility', 'fallback',
];

function CascadeSourceBadge({ source }: { source: ResolvedProperty['source'] }) {
  return (
    <span
      data-testid={'cascade-badge-' + source}
      className={'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono leading-none ' + (SOURCE_COLORS[source] ?? '')}
    >
      {SOURCE_LABELS[source]}
    </span>
  );
}

function CascadeRow({ prop, resolved }: { prop: string; resolved: ResolvedProperty }) {
  const displayValue = resolved.value == null
    ? '\u2014'
    : typeof resolved.value === 'object'
      ? JSON.stringify(resolved.value)
      : String(resolved.value);
  return (
    <div data-testid={'cascade-row-' + prop} className="flex items-center justify-between gap-2 py-1">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[11px] font-mono text-muted shrink-0">{prop}</span>
        <span className="text-[11px] text-ink/70 truncate">{displayValue}</span>
      </div>
      <CascadeSourceBadge source={resolved.source} />
    </div>
  );
}

export function PresentationCascadeSection({
  cascade,
}: {
  cascade: Record<string, ResolvedProperty>;
}) {
  const entries = Object.entries(cascade);
  if (entries.length === 0) return null;

  const sorted = [...entries].sort((a, b) => {
    const ai = DISPLAY_ORDER.indexOf(a[0]);
    const bi = DISPLAY_ORDER.indexOf(b[0]);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  return (
    <Section title="Presentation Cascade">
      <div className="space-y-0">
        {sorted.map(([prop, resolved]) => (
          <CascadeRow key={prop} prop={prop} resolved={resolved} />
        ))}
      </div>
      <div className="mt-2 text-[10px] text-muted/60 font-mono">
        Shows which tier sets each presentation property.
      </div>
    </Section>
  );
}
