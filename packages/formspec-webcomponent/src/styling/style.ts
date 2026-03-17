/** @filedesc Applies inline style objects to elements with token resolution. */
import type { StylingHost } from './index';
import { resolveToken } from './tokens';

export function applyStyle(host: StylingHost, el: HTMLElement, style: any): void {
    if (!style) return;
    for (const [key, val] of Object.entries(style)) {
        const resolved = resolveToken(host, val);
        (el.style as any)[key] = resolved;
    }
}
