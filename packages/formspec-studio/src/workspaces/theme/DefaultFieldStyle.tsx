/** @filedesc Theme tab section for setting form-wide default field styles such as label position. */
import { useTheme } from '../../state/useTheme';
import { useProject } from '../../state/useProject';

type LabelPosition = 'top' | 'start' | 'hidden';

const POSITIONS: { id: LabelPosition; label: string; description: string }[] = [
  { id: 'top', label: 'Top', description: 'Label above input' },
  { id: 'start', label: 'Start', description: 'Label beside input' },
  { id: 'hidden', label: 'Hidden', description: 'Label visually hidden' },
];

export function DefaultFieldStyle() {
  const theme = useTheme();
  const project = useProject();
  const defaults = theme?.defaults ?? {};
  const currentPosition = (defaults.labelPosition as string) ?? '';

  const setDefault = (property: string, value: unknown) => {
    project.setThemeDefault(property, value || null);
  };

  return (
    <div className="space-y-6">
      {/* Label Position */}
      <div className="space-y-3">
        <h4 className="text-[11px] font-bold text-muted uppercase tracking-normal">Label Position</h4>
        <div className="flex gap-2">
          {POSITIONS.map((pos) => {
            const isActive = currentPosition === pos.id;
            return (
              <button
                key={pos.id}
                type="button"
                onClick={() => setDefault('labelPosition', pos.id)}
                className={`flex-1 p-2 rounded border transition-all cursor-pointer ${
                  isActive
                    ? 'border-accent bg-accent/[0.04]'
                    : 'border-border hover:border-accent/40'
                }`}
              >
                <LabelPositionWireframe position={pos.id} />
                <div className="text-[11px] font-bold text-ink mt-2">{pos.label}</div>
                <div className="text-[10px] text-muted">{pos.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Default Widget */}
      <div className="space-y-1">
        <label
          htmlFor="default-widget"
          className="font-mono text-[9px] text-muted uppercase tracking-normal block"
        >
          Default Widget
        </label>
        <input
          id="default-widget"
          type="text"
          aria-label="Default Widget"
          defaultValue={(defaults.widget as string) ?? ''}
          key={`widget-${defaults.widget}`}
          placeholder="e.g. text-input"
          onBlur={(e) => {
            const v = e.target.value.trim();
            setDefault('widget', v);
          }}
          className="w-full px-2 py-1 text-[12px] font-mono border border-border rounded bg-surface outline-none focus:border-accent transition-colors"
        />
      </div>

      {/* CSS Class */}
      <div className="space-y-1">
        <label
          htmlFor="default-css-class"
          className="font-mono text-[9px] text-muted uppercase tracking-normal block"
        >
          CSS Class
        </label>
        <input
          id="default-css-class"
          type="text"
          aria-label="CSS Class"
          defaultValue={(defaults.cssClass as string) ?? ''}
          key={`css-${defaults.cssClass}`}
          placeholder="e.g. formspec-field"
          onBlur={(e) => {
            const v = e.target.value.trim();
            setDefault('cssClass', v);
          }}
          className="w-full px-2 py-1 text-[12px] font-mono border border-border rounded bg-surface outline-none focus:border-accent transition-colors"
        />
      </div>
    </div>
  );
}

function LabelPositionWireframe({ position }: { position: LabelPosition }) {
  switch (position) {
    case 'top':
      return (
        <div className="space-y-1">
          <div className="h-1 w-8 bg-muted/20 rounded" />
          <div className="h-4 w-full bg-subtle border border-border rounded" />
        </div>
      );
    case 'start':
      return (
        <div className="flex items-center gap-2">
          <div className="h-1 w-6 bg-muted/20 rounded shrink-0" />
          <div className="h-4 flex-1 bg-subtle border border-border rounded" />
        </div>
      );
    case 'hidden':
      return (
        <div>
          <div className="h-4 w-full bg-subtle border border-dashed border-border rounded" />
        </div>
      );
  }
}
