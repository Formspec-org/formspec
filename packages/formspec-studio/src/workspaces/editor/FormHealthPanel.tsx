/** @filedesc Form Health panel — Issues and Output Blueprint in the Editor right rail. */
import { OutputBlueprint } from '../../components/blueprint/OutputBlueprint';

export function FormHealthPanel() {
  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <div className="border-b border-border/80 bg-surface px-5 py-4 shrink-0">
        <h2 className="text-[15px] font-semibold text-ink tracking-tight font-ui">
          Form Health
        </h2>
        <p className="mt-1 text-[12px] text-muted">
          Is your form ready to publish?
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Issues — always visible */}
        <div className="px-5 py-4 border-b border-border/60" data-testid="issues-list" aria-live="polite">
          <h3 className="text-[12px] font-bold text-muted uppercase tracking-wider mb-3">
            Issues
          </h3>
          <div className="flex items-center gap-2 text-[13px]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-green-600 dark:text-green-400 shrink-0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11.5 3.5 L5.5 10 L2.5 7" />
            </svg>
            <span className="text-ink font-medium">No issues found</span>
          </div>
        </div>

        {/* Output Blueprint — always expanded */}
        <div className="px-5 py-4">
          <OutputBlueprint />
        </div>
      </div>
    </div>
  );
}
