/** @filedesc Shared types and helpers (indent calculation, ref factory) used by canvas block components. */
export interface BlockBaseProps {
  itemKey: string;
  itemPath: string;
  registerTarget: (path: string, element: HTMLElement | null) => void;
  depth: number;
  selected: boolean;
  isInSelection?: boolean;
  onSelect: (event: React.MouseEvent) => void;
}

export function blockIndent(depth: number): number {
  return depth > 0 ? depth * 20 : 0;
}

export function blockRef(
  path: string,
  registerTarget: (path: string, element: HTMLElement | null) => void,
) {
  return (element: HTMLElement | null) => registerTarget(path, element);
}
