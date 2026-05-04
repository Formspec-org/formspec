/** @filedesc Design mode section — input field styling. */
import { useProject } from '../../state/useProject';
import { useProjectState } from '../../state/useProjectState';

export function InputStylesSection() {
  const project = useProject();
  useProjectState();
  const inputHeight = String(project.getToken('size.input.height') ?? '40px');
  const borderColor = String(project.getToken('color.border.input') ?? '#E2E8F0');
  const focusRing = String(project.getToken('shadow.focus.input') ?? 'Accent 20%');
  const labelLayout = String(project.getToken('layout.label.position') ?? 'top');

  const setToken = (key: string, value: string) => {
    project.setToken(key, value);
  };

  return (
    <section className="space-y-6">
      <div>
        <h3 className="text-[19px] font-semibold text-ink tracking-tight">Input Fields</h3>
        <p className="text-[13px] text-muted mt-1">Global styling for text boxes, dropdowns, and other data entry fields.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Field Preview */}
        <div className="space-y-4">
          <div className="text-[11px] font-bold text-muted uppercase tracking-wider">Field Preview</div>
          <div className="p-8 rounded-xl border border-border bg-surface space-y-4">
             <div className="space-y-1.5">
               <label className="text-[13px] font-semibold text-ink">Field Label</label>
               <input 
                 type="text" 
                 placeholder="Placeholder text..." 
                 className="w-full px-3 py-2 rounded-lg border border-border bg-white text-ink text-[14px] focus:ring-2 focus:ring-accent/20 outline-none"
                 readOnly
               />
               <p className="text-[11px] text-muted">This is a help text example.</p>
             </div>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="text-[11px] font-bold text-muted uppercase tracking-wider">Layout & Label</div>
            <div className="grid grid-cols-2 gap-3">
               <button
                 onClick={() => setToken('layout.label.position', 'top')}
                 className={`px-3 py-2 rounded-lg text-[12px] font-bold ${labelLayout === 'top' ? 'border-2 border-accent bg-accent/5 text-accent' : 'border border-border text-muted font-medium'}`}
               >
                 Label Top
               </button>
               <button
                 onClick={() => setToken('layout.label.position', 'side')}
                 className={`px-3 py-2 rounded-lg text-[12px] font-bold ${labelLayout === 'side' ? 'border-2 border-accent bg-accent/5 text-accent' : 'border border-border text-muted font-medium'}`}
               >
                 Label Side
               </button>
            </div>
          </div>

          <div className="space-y-3">
             <StyleControl label="Input Height" value={inputHeight} onChange={(v) => setToken('size.input.height', v)} />
             <StyleControl label="Border Color" value={borderColor} onChange={(v) => setToken('color.border.input', v)} />
             <StyleControl label="Focus Ring" value={focusRing} onChange={(v) => setToken('shadow.focus.input', v)} />
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
