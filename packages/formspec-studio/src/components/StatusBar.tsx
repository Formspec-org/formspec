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

export function StatusBar() {
  const definition = useDefinition();
  const def = definition as Record<string, any>;

  const formspecVersion = def.$formspec ?? '1.0';
  const status = def.status ?? 'new';
  const items: AnyItem[] = def.items ?? [];
  const fieldCount = countFields(items);
  const bindCount = Object.keys(def.binds || {}).length;
  const shapeCount = (def.shapes || []).length;
  const presentation = def.presentation as Record<string, any> | undefined;
  const pageMode = presentation?.pageMode;
  const defaultCurrency = presentation?.defaultCurrency;
  const density = presentation?.density;

  return (
    <div className="bg-surface border-t border-border text-xs text-muted px-4 py-1 flex items-center gap-4">
      <span>Formspec {formspecVersion}</span>
      <span>{status}</span>
      {pageMode && <span>{pageMode}</span>}
      {defaultCurrency && <span>{defaultCurrency}</span>}
      {density && <span>{density}</span>}
      <span>{plural(fieldCount, 'field')}</span>
      <span>{plural(bindCount, 'bind')}</span>
      <span>{plural(shapeCount, 'shape')}</span>
    </div>
  );
}
