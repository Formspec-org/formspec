/** @filedesc Properties panel shown when multiple items are selected; provides batch delete and duplicate. */
import { pruneDescendants, sortForBatchDelete, type Project } from '@formspec-org/studio-core';

export function MultiSelectSummary({
  selectionCount,
  selectedKeys,
  project,
  deselect,
}: {
  selectionCount: number;
  selectedKeys: Set<string>;
  project: Project;
  deselect: () => void;
}) {
  const handleBatchDelete = () => {
    const pruned = pruneDescendants(selectedKeys);
    const sorted = sortForBatchDelete(pruned);
    project.batchDeleteItems(sorted);
    deselect();
  };

  const handleBatchDuplicate = () => {
    const pruned = pruneDescendants(selectedKeys);
    const sorted = sortForBatchDelete(pruned);
    project.batchDuplicateItems(sorted);
  };

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-border bg-surface shrink-0">
        <h2 className="text-[15px] font-bold text-ink tracking-tight font-ui">
          {selectionCount} items selected
        </h2>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-3.5">
        <button
          aria-label="Duplicate All"
          className="w-full py-2 border border-border rounded-[4px] font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-subtle transition-colors cursor-pointer"
          onClick={handleBatchDuplicate}
        >
          Duplicate All
        </button>
        <button
          aria-label="Delete All"
          className="w-full py-2 border border-error/20 rounded-[4px] font-mono text-[11px] font-bold uppercase tracking-widest text-error hover:bg-error/5 transition-colors cursor-pointer"
          onClick={handleBatchDelete}
        >
          Delete All
        </button>
      </div>
    </div>
  );
}
