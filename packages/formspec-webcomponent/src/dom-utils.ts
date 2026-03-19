/** @filedesc Shared DOM query and focus utilities for components and adapters. */

/** Selector matching keyboard-focusable elements. */
export const FOCUSABLE_SELECTOR =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Focus the first focusable descendant, or the element itself. Returns the focused element. */
export function focusFirstIn(container: HTMLElement): HTMLElement {
    const target = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (target || container).focus();
    return target || container;
}
