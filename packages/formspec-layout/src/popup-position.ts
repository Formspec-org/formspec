/**
 * Position anchored overlays (modal, popover) near a trigger.
 * Shared by React and web component renderers; optional for native centered dialogs.
 */

export type PopupPlacement = 'top' | 'right' | 'bottom' | 'left';

export const POPUP_EDGE_PADDING = 8;
export const POPUP_TRIGGER_GAP = 8;

/** First focusable in modal/dialog content (disabled controls skipped). */
export const MODAL_FIRST_FOCUSABLE_SELECTOR =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Pin `overlayEl` with fixed coordinates near `triggerEl`. Call only when a placement is chosen;
 * omit to keep native dialog centered presentation.
 */
export function positionPopupNearTrigger(
    triggerEl: HTMLElement,
    overlayEl: HTMLElement,
    placement: PopupPlacement = 'bottom',
): void {
    if (typeof window === 'undefined') return;
    const triggerRect = triggerEl.getBoundingClientRect();
    const overlayRect = overlayEl.getBoundingClientRect();
    if (overlayRect.width <= 0 || overlayRect.height <= 0) return;

    let left = triggerRect.left + (triggerRect.width - overlayRect.width) / 2;
    let top = triggerRect.bottom + POPUP_TRIGGER_GAP;

    if (placement === 'top') {
        top = triggerRect.top - overlayRect.height - POPUP_TRIGGER_GAP;
    } else if (placement === 'right') {
        left = triggerRect.right + POPUP_TRIGGER_GAP;
        top = triggerRect.top + (triggerRect.height - overlayRect.height) / 2;
    } else if (placement === 'left') {
        left = triggerRect.left - overlayRect.width - POPUP_TRIGGER_GAP;
        top = triggerRect.top + (triggerRect.height - overlayRect.height) / 2;
    }

    left = clamp(
        left,
        POPUP_EDGE_PADDING,
        Math.max(POPUP_EDGE_PADDING, window.innerWidth - overlayRect.width - POPUP_EDGE_PADDING),
    );
    top = clamp(
        top,
        POPUP_EDGE_PADDING,
        Math.max(POPUP_EDGE_PADDING, window.innerHeight - overlayRect.height - POPUP_EDGE_PADDING),
    );

    overlayEl.style.position = 'fixed';
    overlayEl.style.inset = 'auto';
    overlayEl.style.left = `${Math.round(left)}px`;
    overlayEl.style.top = `${Math.round(top)}px`;
    overlayEl.style.margin = '0';
    overlayEl.style.maxHeight = `${Math.max(120, window.innerHeight - POPUP_EDGE_PADDING * 2)}px`;
}

/** Clear inline positioning from a previous anchored open so the dialog can use default centering. */
export function clearPopupFixedPosition(overlayEl: HTMLElement): void {
    overlayEl.style.removeProperty('position');
    overlayEl.style.removeProperty('inset');
    overlayEl.style.removeProperty('left');
    overlayEl.style.removeProperty('top');
    overlayEl.style.removeProperty('margin');
    overlayEl.style.removeProperty('max-height');
}
