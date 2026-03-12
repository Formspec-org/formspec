import { useState } from 'react';
import { useProjectState } from '../../state/useProjectState';

const DOC_IDS = ['Definition', 'Component', 'Theme', 'Mapping'] as const;
type DocId = (typeof DOC_IDS)[number];

const docKey: Record<DocId, keyof ReturnType<typeof useProjectState>> = {
  Definition: 'definition',
  Component: 'component',
  Theme: 'theme',
  Mapping: 'mapping',
};

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function JsonDocumentsView() {
  const state = useProjectState();
  const [active, setActive] = useState<DocId>('Definition');

  const doc = state[docKey[active]];
  const isEmpty =
    doc == null ||
    (typeof doc === 'object' && !Array.isArray(doc) && Object.keys(doc).length === 0) ||
    (Array.isArray(doc) && doc.length === 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 p-2 border-b border-border">
        {DOC_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={`px-3 py-1 text-sm rounded ${
              active === id
                ? 'bg-accent text-white'
                : 'text-muted hover:text-ink hover:bg-subtle'
            }`}
            onClick={() => setActive(id)}
          >
            {id}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4 bg-subtle/30">
        <pre
          className="font-mono text-xs text-ink bg-surface border border-border rounded p-4 overflow-x-auto min-h-0"
          data-testid={`json-doc-${active.toLowerCase()}`}
        >
          <code>{isEmpty ? '(empty)' : formatJson(doc)}</code>
        </pre>
      </div>
    </div>
  );
}
