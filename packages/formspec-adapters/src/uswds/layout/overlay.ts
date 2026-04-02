/** @filedesc Fixed positioning and focus helpers for USWDS Modal/Popover adapters (no webcomponent runtime import). */

export type PopupPlacement = 'top' | 'right' | 'bottom' | 'left';

const POPUP_EDGE_PADDING = 8;
const POPUP_TRIGGER_GAP = 8;

export const FOCUSABLE_SELECTOR =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function focusFirstIn(container: HTMLElement): HTMLElement {
    const target = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (target || container).focus();
    return target || container;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function positionOverlayNearTrigger(
    triggerEl: HTMLElement,
    overlayEl: HTMLElement,
    placement: PopupPlacement = 'bottom'
): void {
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
        Math.max(POPUP_EDGE_PADDING, window.innerWidth - overlayRect.width - POPUP_EDGE_PADDING)
    );
    top = clamp(
        top,
        POPUP_EDGE_PADDING,
        Math.max(POPUP_EDGE_PADDING, window.innerHeight - overlayRect.height - POPUP_EDGE_PADDING)
    );

    overlayEl.style.position = 'fixed';
    overlayEl.style.inset = 'auto';
    overlayEl.style.left = `${Math.round(left)}px`;
    overlayEl.style.top = `${Math.round(top)}px`;
    overlayEl.style.margin = '0';
    overlayEl.style.maxHeight = `${Math.max(120, window.innerHeight - POPUP_EDGE_PADDING * 2)}px`;
}
