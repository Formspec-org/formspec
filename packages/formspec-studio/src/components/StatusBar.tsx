/** @filedesc Bottom status bar showing formspec version, form status, field count, and bind/shape counts. */
import type { FormItem } from 'formspec-types';
import { useDefinition } from '../state/useDefinition';

function countFields(items: FormItem[]): number {
  let count = 0;
  for (const item of items) {
    if (item.type === 'field') count++;
    if (item.children) count += countFields(item.children);
  }
  return count;
}

function plural(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? '' : 's'}`;
}

/**
 * Technical status bar shown at the bottom of the shell.
 * Displays version, status, and entity counts.
 */
export function StatusBar() {
  const definition = useDefinition();

  const formspecVersion = definition.$formspec ?? '1.0';
  const status = definition.status ?? 'draft';
  const items = definition.items ?? [];
  const fieldCount = countFields(items);
  const bindCount = definition.binds?.length ?? 0;
  const shapeCount = definition.shapes?.length ?? 0;
  const varCount = definition.variables?.length ?? 0;

  const presentation = definition.formPresentation ?? {};
  const pageMode = presentation.pageMode;
  const defaultCurrency = presentation.defaultCurrency;
  const density = presentation.density;

  return (
    <footer
      data-testid="status-bar"
      className="h-[28px] bg-surface border-t border-border px-3 sm:px-4 flex items-center justify-between font-mono text-[11px] text-muted shrink-0 cursor-default overflow-hidden"
    >
      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
        {/* Version Section */}
        <div className="flex items-center gap-1.5 shrink-0" title="Specification version and lifecycle status">
          <div className="w-1.5 h-1.5 rounded-full bg-green shadow-[0_0_4px_rgba(5,150,105,0.4)]" />
          <span className="uppercase tracking-wider font-bold text-ink whitespace-nowrap">
            FORMSPEC {formspecVersion}
          </span>
          <span className="opacity-40">·</span>
          <span className="uppercase font-bold text-ink/70">{status}</span>
        </div>

        <div className="hidden sm:block w-px h-3 bg-border shrink-0" />

        {/* Presentation Section */}
        <div className="hidden md:flex items-center gap-1.5 shrink-0" title="Page mode, default currency, and density">
          <span>{pageMode || 'standard'}</span>
          <span className="opacity-40">·</span>
          <span>{(defaultCurrency as string) || 'USD'}</span>
          <span className="opacity-40">·</span>
          <span>{(density as string) || 'comfortable'}</span>
        </div>

        <div className="hidden sm:block w-px h-3 bg-border shrink-0" />

        {/* Counts Section */}
        <div className="flex items-center gap-2 min-w-0" title="Entity counts across the definition">
          <span className="whitespace-nowrap truncate">{plural(fieldCount, 'field')}</span>
          <span className="hidden sm:inline opacity-40">·</span>
          <span className="hidden sm:inline whitespace-nowrap">{plural(bindCount, 'bind')}</span>
          <span className="hidden md:inline opacity-40">·</span>
          <span className="hidden md:inline whitespace-nowrap">{plural(shapeCount, 'shape')}</span>
        </div>
      </div>

      <div className="truncate ml-4 max-w-[150px] sm:max-w-[300px] shrink-0 text-right">
        {definition.url ? (
          <a href={definition.url} className="hover:text-ink underline-offset-2 hover:underline">
            {definition.url}
          </a>
        ) : null}
      </div>
    </footer>
  );
}
