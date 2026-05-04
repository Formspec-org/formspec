/** @filedesc Design mode section — button styling (Figma-like controls). */
import { useProject } from '../../state/useProject';
import { useProjectState } from '../../state/useProjectState';

export function ButtonStylesSection() {
  const project = useProject();
  useProjectState();

  const cornerRadius = String(project.getToken('radius.button') ?? '8px');
  const vPadding = String(project.getToken('spacing.button.v') ?? '10px');
  const fontWeight = String(project.getToken('font.weight.button') ?? '600');
  const borderWidth = String(project.getToken('border.width.button') ?? '1px');

  const setToken = (key: string, value: string) => {
    project.setToken(key, value);
  };
  
  return (
    <section className="space-y-6">
      <div>
        <h3 className="text-[19px] font-semibold text-ink tracking-tight">Buttons</h3>
        <p className="text-[13px] text-muted mt-1">Configure the appearance of primary and secondary actions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Primary Button Preview */}
        <div className="space-y-4">
          <div className="text-[11px] font-bold text-muted uppercase tracking-wider">Primary Action</div>
          <div className="p-8 rounded-xl border border-border bg-surface flex flex-col items-center justify-center gap-4">
             <button className="px-6 py-2.5 rounded-lg bg-accent text-white font-semibold shadow-sm">
               Submit Application
             </button>
             <div className="text-[11px] text-muted italic text-center">Preview of the default action button</div>
          </div>
          
          <div className="space-y-3">
             <StyleControl label="Corner Radius" value={cornerRadius} onChange={(v) => setToken('radius.button', v)} />
             <StyleControl label="Vertical Padding" value={vPadding} onChange={(v) => setToken('spacing.button.v', v)} />
             <StyleControl label="Font Weight" value={fontWeight} onChange={(v) => setToken('font.weight.button', v)} />
          </div>
        </div>

        {/* Secondary Button Preview */}
        <div className="space-y-4">
          <div className="text-[11px] font-bold text-muted uppercase tracking-wider">Secondary Action</div>
          <div className="p-8 rounded-xl border border-border bg-surface flex flex-col items-center justify-center gap-4">
             <button className="px-6 py-2.5 rounded-lg border border-border bg-surface text-ink font-medium">
               Save Draft
             </button>
             <div className="text-[11px] text-muted italic text-center">Preview of the secondary action button</div>
          </div>
          
          <div className="space-y-3">
             <StyleControl label="Border Width" value={borderWidth} onChange={(v) => setToken('border.width.button', v)} />
          </div>
        </div>
      </div>
    </section>
  );
}

function StyleControl({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40">
      <span className="text-[13px] text-ink">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-[12px] font-mono text-muted bg-subtle px-2 py-0.5 rounded border border-transparent hover:border-border focus-visible:border-accent focus-ring w-24 text-right transition-colors"
      />
    </div>
  );
}
