/** @filedesc Panel that runs FormEngine against the current definition and displays the response and validation report. */
import { useState } from 'react';
import { createFormEngine, type FormspecItem } from '@formspec-org/engine';
import type { IFormEngine } from '@formspec-org/engine';
import { useDefinition } from '../../state/useDefinition';

function seedInitialValues(engine: IFormEngine, items: FormspecItem[], prefix = ''): void {
  for (const item of items) {
    const path = prefix ? `${prefix}.${item.key}` : item.key;
    if (item.type === 'field' && item.initialValue !== undefined && !(typeof item.initialValue === 'string' && item.initialValue.startsWith('='))) {
      engine.setValue(path, item.initialValue);
    }
    if (item.children?.length) {
      seedInitialValues(engine, item.children, path);
    }
  }
}

export function TestResponse() {
  const definition = useDefinition();
  const [output, setOutput] = useState<string>('');

  const handleRun = () => {
    const engine = createFormEngine({...definition});
    seedInitialValues(engine, (definition?.items ?? []) as FormspecItem[]);
    setOutput(JSON.stringify({
      response: engine.getResponse(),
      validationReport: engine.getValidationReport(),
    }, null, 2));
  };

  return (
    <div className="space-y-6">
      <div className="max-w-2xl rounded-xl border border-border bg-surface shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="px-5 py-4 bg-subtle/30 border-b border-border flex items-center justify-between">
           <div>
            <h3 className="text-[14px] font-bold text-ink">Engine Simulation</h3>
            <p className="text-[11px] text-muted">Generate a live response document and validation report.</p>
           </div>
           <button
            type="button"
            className="px-4 py-2 bg-accent text-white text-[12px] font-bold uppercase tracking-wider rounded-md hover:bg-accent-hover shadow-sm transition-all active:scale-95 disabled:opacity-50"
            onClick={handleRun}
          >
            Run Simulation
          </button>
        </div>
        
        <div className="p-5">
          {output ? (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
                <span className="text-[11px] font-bold text-muted uppercase tracking-widest">Live Output</span>
              </div>
              <pre className="overflow-auto max-h-[500px] rounded-lg border border-border bg-ink/[0.02] p-4 text-[13px] font-mono text-ink leading-relaxed selection:bg-accent/20">
                {output}
              </pre>
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 opacity-60">
              <div className="w-12 h-12 rounded-full bg-subtle flex items-center justify-center text-muted">
                <span className="text-xl">⚡︎</span>
              </div>
              <p className="text-sm text-muted italic">Click "Run Simulation" to generate the current form state.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
