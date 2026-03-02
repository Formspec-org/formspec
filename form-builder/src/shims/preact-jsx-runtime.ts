export const Fragment = Symbol('Fragment');

export interface VNode {
  type: any;
  props: Record<string, unknown>;
  key?: string | number | null;
}

export function jsx(type: any, props: Record<string, unknown>, key?: string | number): VNode {
  return { type, props: props || {}, key: key ?? null };
}

export const jsxs = jsx;
export const jsxDEV = jsx;
