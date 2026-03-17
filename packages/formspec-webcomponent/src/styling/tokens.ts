/** @filedesc Token resolution and CSS custom property emission for theme/component tokens. */
import {
    resolveToken as resolveTokenBase,
} from 'formspec-layout';
import type { StylingHost } from './index';

export function resolveToken(host: StylingHost, val: any): any {
    return resolveTokenBase(
        val,
        host._componentDocument?.tokens,
        host.getEffectiveTheme().tokens,
    );
}

export function emitTokenProperties(host: StylingHost, container: HTMLElement): void {
    const effectiveTheme = host.getEffectiveTheme();
    const tokens = {
        ...(effectiveTheme.tokens || {}),
        ...(host._componentDocument?.tokens || {}),
    };
    for (const [key, value] of Object.entries(tokens)) {
        container.style.setProperty(
            `--formspec-${key.replace(/\./g, '-')}`,
            String(value)
        );
    }
}
