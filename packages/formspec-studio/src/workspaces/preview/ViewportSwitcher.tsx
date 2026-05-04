/** @filedesc Button group for switching the preview viewport between desktop, tablet, and mobile widths. */
type Viewport = 'desktop' | 'tablet' | 'mobile';

interface ViewportSwitcherProps {
  active: Viewport;
  onChange: (viewport: Viewport) => void;
}

const viewports: { id: Viewport; label: string }[] = [
  { id: 'desktop', label: 'Desktop' },
  { id: 'tablet', label: 'Tablet' },
  { id: 'mobile', label: 'Mobile' },
];

export function ViewportSwitcher({ active, onChange }: ViewportSwitcherProps) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded border border-border bg-subtle">
      {viewports.map((vp) => (
        <button
          key={vp.id}
          type="button"
          className={`px-3 py-1 text-[12px] font-bold rounded transition-all duration-200 focus-ring ${
            active === vp.id
              ? 'bg-accent text-surface shadow-sm'
              : 'text-muted hover:text-ink hover:bg-surface'
          }`}
          onClick={() => onChange(vp.id)}
        >
          {vp.label}
        </button>
      ))}
    </div>
  );
}

export type { Viewport };
