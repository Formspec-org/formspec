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
    <div className="flex items-center gap-1 p-1 rounded-full border border-border/40 bg-subtle/50">
      {viewports.map((vp) => (
        <button
          key={vp.id}
          type="button"
          className={`px-4 py-1.5 text-[13.5px] font-semibold rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 ${
            active === vp.id
              ? 'bg-surface text-ink shadow-sm border border-border/20'
              : 'text-muted/80 hover:bg-subtle/80 hover:text-ink'
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
