/** @filedesc Shared DOM query and focus utilities for components and adapters. */
import { MODAL_FIRST_FOCUSABLE_SELECTOR } from '@formspec-org/layout';

/** Selector matching keyboard-focusable elements. */
export const FOCUSABLE_SELECTOR = MODAL_FIRST_FOCUSABLE_SELECTOR;

/** Focus the first focusable descendant, or the element itself. Returns the focused element. */
export function focusFirstIn(container: HTMLElement): HTMLElement {
    const target = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (target || container).focus();
    return target || container;
}
