/**
 * Resolve a `$token.xxx` reference against component and theme token maps.
 *
 * Component tokens take precedence over theme tokens. Values that are not
 * `$token.` prefixed strings pass through unchanged. Logs a warning when
 * a token reference cannot be resolved in either map.
 *
 * @param val             - The value to resolve. Only strings starting with `$token.` are looked up.
 * @param componentTokens - Token map from the component document (higher priority).
 * @param themeTokens     - Token map from the theme document (lower priority).
 * @returns The resolved token value, or the original value if it is not a token reference.
 */
export function resolveToken(
    val: any,
    componentTokens: Record<string, string | number> | undefined,
    themeTokens: Record<string, string | number> | undefined,
): any {
    if (typeof val === 'string' && val.startsWith('$token.')) {
        const tokenKey = val.substring(7);
        if (componentTokens && componentTokens[tokenKey] !== undefined) {
            return componentTokens[tokenKey];
        }
        if (themeTokens && themeTokens[tokenKey] !== undefined) {
            return themeTokens[tokenKey];
        }
        console.warn(`Unresolved token reference: ${val}`);
    }
    return val;
}

/**
 * Emit merged theme + component tokens as `--formspec-*` CSS custom properties on `target`.
 * Component tokens override theme tokens (same merge order as `emitTokenProperties` in the web component).
 */
export function emitMergedThemeCssVars(
    target: HTMLElement,
    options: {
        themeTokens?: Record<string, string | number> | null;
        componentTokens?: Record<string, string | number> | null;
    },
): void {
    const merged = {
        ...(options.themeTokens || {}),
        ...(options.componentTokens || {}),
    };
    const nextKeys = new Set(
        Object.keys(merged).map((k) => `--formspec-${k.replace(/\./g, '-')}`),
    );
    for (let i = target.style.length - 1; i >= 0; i--) {
        const prop = target.style[i];
        if (prop.startsWith('--formspec-') && !nextKeys.has(prop)) {
            target.style.removeProperty(prop);
        }
    }
    for (const [key, value] of Object.entries(merged)) {
        target.style.setProperty(`--formspec-${key.replace(/\./g, '-')}`, String(value));
    }
}
