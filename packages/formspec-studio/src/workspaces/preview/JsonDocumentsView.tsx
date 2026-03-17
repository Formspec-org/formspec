/** @filedesc Preview tab panel showing the raw JSON of the Definition, Component, Theme, or Mapping docs. */
import { useState } from 'react';
import { useProjectState } from '../../state/useProjectState';
import {
  materializePreviewComponentDoc,
  normalizeDefinitionDoc,
  normalizeThemeDoc,
} from './preview-documents';

const DOC_IDS = ['Definition', 'Component', 'Theme', 'Mapping'] as const;
type DocId = (typeof DOC_IDS)[number];

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

  const doc = {
    Definition: normalizeDefinitionDoc(state.definition),
    Component: materializePreviewComponentDoc(state),
    Theme: normalizeThemeDoc(state.theme, state.definition),
    Mapping: state.mapping,
  }[active];
  const isEmpty =
    doc == null ||
    (typeof doc === 'object' && !Array.isArray(doc) && Object.keys(doc).length === 0) ||
    (Array.isArray(doc) && doc.length === 0);
  const formattedDoc = formatJson(doc);

  const handleCopy = async () => {
    const text = isEmpty ? '(empty)' : formattedDoc;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard is best-effort in tests and unsupported environments.
    }
  };

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
        <button
          type="button"
          className="ml-auto px-3 py-1 text-sm rounded border border-border text-muted hover:text-ink hover:bg-subtle"
          onClick={handleCopy}
        >
          Copy
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 bg-subtle/30">
        <pre
          className="font-mono text-xs text-ink bg-surface border border-border rounded p-4 overflow-x-auto min-h-0"
          data-testid={`json-doc-${active.toLowerCase()}`}
        >
          <code>{isEmpty ? '(empty)' : formattedDoc}</code>
        </pre>
      </div>
    </div>
  );
}
