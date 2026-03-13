import { useState } from 'react';
import { FormEngine, type FormspecItem } from 'formspec-engine';
import { useDefinition } from '../../state/useDefinition';

function seedInitialValues(engine: FormEngine, items: FormspecItem[], prefix = ''): void {
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
    const engine = new FormEngine(definition as any);
    seedInitialValues(engine, (definition?.items ?? []) as FormspecItem[]);
    setOutput(JSON.stringify({
      response: engine.getResponse(),
      validationReport: engine.getValidationReport(),
    }, null, 2));
  };

  return (
    <div className="p-4">
      <div className="max-w-xl rounded border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">Test Response</h2>
        <p className="mt-2 text-sm text-muted">
          Generate a response document and validation report from the current definition.
        </p>
        <button
          type="button"
          className="mt-4 px-3 py-1.5 text-[12.5px] font-medium rounded-[4px] border border-border text-ink hover:bg-subtle transition-colors"
          onClick={handleRun}
        >
          Run Test Response
        </button>
        {output ? (
          <pre className="mt-4 overflow-auto rounded border border-border bg-subtle/40 p-3 text-xs text-ink">{output}</pre>
        ) : null}
      </div>
    </div>
  );
}
