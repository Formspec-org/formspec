/** @filedesc Live mapping preview panel for testing forward and reverse mapping transforms. */
import { useEffect, useState } from 'react';
import { generateDefinitionSampleData, serializeMappedData } from '@formspec-org/studio-core';
import { useProject } from '../../state/useProject';
import { useMapping } from '../../state/useMapping';
import { SplitPane } from '../../components/ui/SplitPane';

export function MappingPreview() {
  const mapping = useMapping();
  const project = useProject();

  const [sampleInput, setSampleInput] = useState('{\n  "firstName": "Jane",\n  "lastName": "Doe",\n  "age": 28\n}');
  const [previewDirection, setPreviewDirection] = useState<'forward' | 'reverse'>('forward');
  const [previewOutput, setPreviewOutput] = useState<string>('{}');
  const [showRaw, setShowRaw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSchemaSample = async () => {
    const sample = await generateDefinitionSampleData(project.definition);
    setSampleInput(JSON.stringify(sample, null, 2));
  };

  useEffect(() => {
    try {
      const data = JSON.parse(sampleInput);
      const result = project.previewMapping({
        sampleData: data,
        direction: previewDirection
      });
      
      if (showRaw) {
        setPreviewOutput(JSON.stringify(result.output, null, 2));
      } else {
        const targetSchema = mapping?.targetSchema ?? {};
        const format = targetSchema.format as 'json' | 'xml' | 'csv' | undefined;
        const adapterConfig = format && mapping?.adapters
          ? (mapping.adapters as Record<string, Record<string, unknown>>)[format] ?? {}
          : {};
        const serialized = serializeMappedData(result.output, {
          format,
          pretty: true,
          rootElement: targetSchema.rootElement as string,
          namespaces: targetSchema.namespaces as Record<string, string>,
          ...adapterConfig,
        });
        setPreviewOutput(serialized);
      }
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Mapping error');
      setPreviewOutput('');
    }
  }, [sampleInput, previewDirection, mapping, project, showRaw]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center gap-2 mb-6 p-1 bg-subtle/40 border border-border/40 rounded-lg w-fit">
        <button
          onClick={() => setPreviewDirection('forward')}
          className={`px-3 py-1.5 min-w-[120px] rounded-md text-[11px] font-bold uppercase tracking-wider transition-all ${previewDirection === 'forward' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-ink'
            }`}
        >
          Forward Preview
        </button>
        <button
          onClick={() => setPreviewDirection('reverse')}
          className={`px-3 py-1.5 min-w-[120px] rounded-md text-[11px] font-bold uppercase tracking-wider transition-all ${previewDirection === 'reverse' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-ink'
            }`}
        >
          Reverse Preview
        </button>

        <div className="w-[1px] h-4 bg-border/40 mx-2" />

        <button
          onClick={() => setShowRaw(!showRaw)}
          className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all border border-border/40 ${showRaw ? 'bg-panel text-ink shadow-sm' : 'bg-transparent text-muted hover:text-ink'
            }`}
        >
          {showRaw ? 'Raw Object' : 'Formatted Output'}
        </button>
      </div>

      <div className="h-[500px] flex flex-col">
        <SplitPane
          className="flex-1"
          left={
            <div className="flex flex-col h-full p-4 gap-2 min-h-0">
              <div className="flex items-center justify-between mb-1 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${previewDirection === 'forward' ? 'bg-muted/40' : 'bg-accent/40'}`} />
                  <span
                    data-testid="preview-source-header"
                    className="text-[11px] font-bold text-muted uppercase tracking-[0.1em]"
                  >
                    {previewDirection === 'forward' ? 'Source (Form Response)' : 'Source (External Data)'}
                  </span>
                </div>
                {previewDirection === 'forward' && (
                  <button
                    type="button"
                    onClick={generateSchemaSample}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-border/60 hover:border-accent/40 hover:bg-accent/5 transition-all text-[9px] font-bold uppercase tracking-wider text-muted hover:text-accent group/sync"
                    title="Populate with sample data derived from form fields"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover/sync:rotate-180 transition-transform duration-500">
                      <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
                    </svg>
                    Sync with Form
                  </button>
                )}
              </div>
              <div className="flex-1 relative min-h-0">
                <textarea
                  value={sampleInput}
                  onChange={(e) => setSampleInput(e.target.value)}
                  spellCheck={false}
                  className="absolute inset-0 w-full h-full font-mono text-[12px] leading-relaxed text-ink bg-surface/50 rounded-lg p-3 border border-border/20 transition-all focus:border-accent/40 focus:ring-1 focus:ring-accent/10 resize-none outline-none shadow-inner"
                />
              </div>
            </div>
          }
          right={
            <div className="flex flex-col h-full p-4 gap-2 min-h-0">
              <div className="flex items-center gap-2 mb-1 flex-shrink-0">
                <div className={`w-2 h-2 rounded-full ${previewDirection === 'forward' ? 'bg-accent/40' : 'bg-muted/40'}`} />
                <span
                  data-testid="preview-output-header"
                  className="text-[11px] font-bold text-accent uppercase tracking-[0.1em]"
                >
                  {previewDirection === 'forward' ? 'Output (Mapped Result)' : 'Output (Inflated Response)'}
                </span>
              </div>
              <div className="flex-1 relative min-h-0">
                <div className={`absolute inset-0 overflow-auto font-mono text-[12px] leading-relaxed rounded-lg p-3 border shadow-sm transition-all ${error ? 'bg-red-50/50 border-red-200 text-red-600' : 'bg-surface/50 border-border/20 text-ink'
                  }`}>
                  {error ? (
                    <div className="flex items-start gap-2">
                      <span className="text-red-500 font-bold">Error:</span>
                      <span className="whitespace-pre-wrap">{error}</span>
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap">{previewOutput}</pre>
                  )}
                </div>
              </div>
            </div>
          }
        />
      </div>

      <div className="mt-8 p-4 rounded-xl bg-panel/40 border border-border/30 border-dashed">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-subtle flex items-center justify-center text-[18px]">
            ✨
          </div>
          <div>
            <h4 className="text-[12px] font-bold text-ink mb-0.5">Live Model-Driven Engine</h4>
            <p className="text-[11px] text-muted leading-tight">
              Executing the <code className="text-accent bg-accent/5 px-1 rounded">RuntimeMappingEngine</code> from <code className="text-ink">formspec-engine</code> on every update.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
