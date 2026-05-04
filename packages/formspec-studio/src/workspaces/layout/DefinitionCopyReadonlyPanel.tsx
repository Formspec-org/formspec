/** @filedesc Read-only definition description/hint on the Layout canvas; canonical editing stays in Editor. */
import { useEffect, useState } from 'react';
import {
  useOpenDefinitionInEditor,
  type DefinitionEditorItemKind,
} from '../../state/OpenDefinitionInEditorContext';

export interface DefinitionCopyReadonlyPanelProps {
  /** Dot path into `definition.items` (e.g. `demographics.email`). When null, the panel is hidden. */
  definitionPath: string | null;
  kind: DefinitionEditorItemKind;
  description: string | null;
  hint: string | null;
  selected: boolean;
  /** When true, description/hint sit behind the same disclosure pattern as the inline toolbar. */
  showToolbar: boolean;
  testIdPrefix: string;
}

export function DefinitionCopyReadonlyPanel({
  definitionPath,
  kind,
  description,
  hint,
  selected,
  showToolbar,
  testIdPrefix,
}: DefinitionCopyReadonlyPanelProps) {
  const openInEditor = useOpenDefinitionInEditor();
  const summaryHasContent = Boolean(description?.trim()) || Boolean(hint?.trim());
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (!selected || !showToolbar) return;
    setDetailsOpen(summaryHasContent);
  }, [selected, showToolbar, summaryHasContent, definitionPath]);

  useEffect(() => {
    if (!selected) setDetailsOpen(false);
  }, [selected]);

  if (!definitionPath || !selected) return null;

  const body = (
    <div
      className="mt-3 flex flex-col gap-2 border-t border-border/35 pt-3"
      data-testid={`${testIdPrefix}-definition-copy`}
    >
      <div className="space-y-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Description</div>
          <p
            className={`mt-0.5 text-[13px] leading-snug ${
              description?.trim() ? 'text-ink/85' : 'italic text-ink/45'
            }`}
          >
            {description?.trim() ? description.trim() : '—'}
          </p>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Hint</div>
          <p
            className={`mt-0.5 text-[13px] leading-snug ${
              hint?.trim() ? 'text-ink/85' : 'italic text-ink/45'
            }`}
          >
            {hint?.trim() ? hint.trim() : '—'}
          </p>
        </div>
      </div>
      <button
        type="button"
        data-layout-stop-select=""
        data-testid={`${testIdPrefix}-edit-copy-in-editor`}
        className="w-full rounded-[8px] border border-border/60 bg-bg-default/40 px-2 py-1.5 text-left text-[12px] font-medium text-accent transition-colors hover:border-accent/50 hover:bg-accent/5 focus-ring"
        onClick={(e) => {
          e.stopPropagation();
          openInEditor(definitionPath, kind);
        }}
      >
        Edit description &amp; hint in Editor
      </button>
    </div>
  );

  if (showToolbar) {
    return (
      <>
        <button
          type="button"
          data-layout-stop-select=""
          data-testid={`${testIdPrefix}-definition-copy-toggle`}
          className="mt-2 flex w-full items-center gap-2 rounded-[8px] border border-border/45 bg-bg-default/35 px-2 py-1.5 text-left text-[12px] font-medium text-ink transition-colors hover:bg-bg-default/50 focus-ring"
          aria-expanded={detailsOpen}
          onClick={(e) => {
            e.stopPropagation();
            setDetailsOpen((o) => !o);
          }}
        >
          <span>
            Definition copy <span className="font-normal text-muted">(Editor)</span>
          </span>
          {summaryHasContent ? (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
          ) : null}
          <span className="ml-auto text-muted">{detailsOpen ? '▾' : '▸'}</span>
        </button>
        {detailsOpen ? body : null}
      </>
    );
  }

  return body;
}
