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
    <div className="flex gap-1 p-2 border-b border-border">
      {viewports.map((vp) => (
        <button
          key={vp.id}
          type="button"
          className={`px-3 py-1 text-sm rounded ${
            active === vp.id
              ? 'bg-accent text-white'
              : 'text-muted hover:text-ink hover:bg-subtle'
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
