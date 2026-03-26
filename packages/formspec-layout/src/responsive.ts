/**
 * Merge responsive breakpoint overrides onto a component descriptor.
 *
 * Without a breakpoints map, applies only the single active breakpoint's
 * overrides (backwards-compatible behaviour).
 *
 * With a breakpoints map, performs a mobile-first cumulative cascade per
 * Component Spec §9.3: all breakpoints whose minWidth ≤ the active
 * breakpoint's minWidth are applied in ascending minWidth order, so later
 * breakpoints win over earlier ones for conflicting keys.
 *
 * @param comp             - Component descriptor that may contain a `responsive` map.
 * @param activeBreakpoint - Currently active breakpoint name, or `null` if none match.
 * @param breakpoints      - Optional name→minWidth map used to determine cascade order.
 * @returns A (possibly new) component descriptor with breakpoint overrides applied.
 */
export function resolveResponsiveProps(
    comp: any,
    activeBreakpoint: string | null,
    breakpoints?: Record<string, number> | null,
): any {
    if (!comp.responsive || !activeBreakpoint) return comp;

    if (!breakpoints) {
        // Fallback: single-breakpoint merge (backwards compatible)
        const overrides = comp.responsive[activeBreakpoint];
        if (!overrides) return comp;
        return { ...comp, ...overrides };
    }

    // Mobile-first cascade: merge all breakpoints up to and including active
    const activeWidth = breakpoints[activeBreakpoint];
    if (activeWidth == null) return comp;

    const sortedNames = Object.entries(breakpoints)
        .filter(([name]) => comp.responsive[name])
        .sort(([, a], [, b]) => a - b)
        .filter(([, width]) => width <= activeWidth)
        .map(([name]) => name);

    if (sortedNames.length === 0) return comp;

    let result = { ...comp };
    for (const name of sortedNames) {
        result = { ...result, ...comp.responsive[name] };
    }
    return result;
}
