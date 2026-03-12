import { useDefinition } from '../state/useDefinition';

type AnyItem = { type?: string; children?: AnyItem[]; [key: string]: unknown };

function countFields(items: AnyItem[]): number {
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
  const def = definition as Record<string, any>;

  const formspecVersion = def.$formspec ?? '1.0';
  const status = def.status ?? 'draft';
  const items: AnyItem[] = def.items ?? [];
  const fieldCount = countFields(items);
  const bindCount = Array.isArray(def.binds) ? def.binds.length : Object.keys(def.binds || {}).length;
  const shapeCount = (def.shapes || []).length;
  const varCount = (def.variables || []).length;
  
  const presentation = def.presentation || def.formPresentation || {};
  const pageMode = presentation.pageMode;
  const defaultCurrency = presentation.defaultCurrency;
  const density = presentation.density;

  return (
    <footer
      data-testid="status-bar"
      className="h-[28px] bg-surface border-t border-border px-4 flex items-center justify-between font-mono text-[11px] text-muted shrink-0"
    >
      <div className="flex items-center gap-2.5">
        {/* Version Section */}
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green shadow-[0_0_4px_rgba(5,150,105,0.4)]" />
          <span className="uppercase tracking-wider font-bold text-ink">
            FORMSPEC {formspecVersion}
          </span>
          <span className="opacity-40">·</span>
          <span className="uppercase font-bold text-ink/70">{status}</span>
        </div>

        <div className="w-px h-3 bg-border" />

        {/* Presentation Section */}
        <div className="flex items-center gap-1.5">
          <span>{pageMode || 'standard'}</span>
          <span className="opacity-40">·</span>
          <span>{defaultCurrency || 'USD'}</span>
          <span className="opacity-40">·</span>
          <span>{density || 'comfortable'}</span>
        </div>

        <div className="w-px h-3 bg-border" />

        {/* Counts Section */}
        <div className="flex items-center gap-2">
          <span>{plural(fieldCount, 'field')}</span>
          <span className="opacity-40">·</span>
          <span>{plural(bindCount, 'bind')}</span>
          <span className="opacity-40">·</span>
          <span>{plural(shapeCount, 'shape')}</span>
          <span className="opacity-40">·</span>
          <span>{varCount} vars</span>
        </div>
      </div>

      <div className="truncate ml-4 max-w-[300px]">
        {def.url ? (
          <a href={def.url} className="hover:text-ink underline-offset-2 hover:underline">
            {def.url}
          </a>
        ) : null}
      </div>
    </footer>
  );
}
