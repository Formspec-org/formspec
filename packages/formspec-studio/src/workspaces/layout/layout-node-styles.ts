/** @filedesc Shared Tailwind class strings for layout canvas selection — left (inline-start) accent rail + subtle fill for containers and field/display leaves. */

/** Selected layout container: structural frame with inline-start rail (RTL-safe). */
export const LAYOUT_CONTAINER_SELECTED =
  'rounded-[8px] border border-border/60 border-s-[3px] border-s-accent bg-accent/[0.04] shadow-[0_1px_3px_rgba(0,0,0,0.02)] ring-1 ring-accent/20';

/** Unselected layout container shell (dashed wireframe). */
export const LAYOUT_CONTAINER_UNSELECTED = 'rounded-[8px] border border-dashed border-border/80 bg-surface transition-colors hover:border-accent/40';

/**
 * Stack (and similar) on the active layout page — solid frame so the interior does not read as
 * discardable sketch UI while the wizard step / page is the editing locus (visual review 2026-04-05).
 */
export const LAYOUT_CONTAINER_UNSELECTED_ON_ACTIVE_PAGE =
  'rounded-[8px] border border-border/50 bg-surface transition-colors hover:border-border/80 shadow-[0_1px_2px_rgba(0,0,0,0.015)]';

/** Selected field/display card: same selection vocabulary as containers, no diffuse glow. */
export const LAYOUT_LEAF_SELECTED =
  'rounded-[8px] border border-border/60 border-s-[3px] border-s-accent bg-accent/[0.04] shadow-[0_1px_3px_rgba(0,0,0,0.02)] ring-1 ring-accent/20';

/** Unselected leaf: transparent border until hover. */
export const LAYOUT_LEAF_UNSELECTED = 'rounded-[8px] border border-transparent hover:border-border/60 hover:bg-subtle/30 transition-all';

/** Premium style for an active drag source: 'picked up' feel with scale, grayscale, and reduced opacity. */
export const LAYOUT_DRAG_SOURCE_STYLE = 'opacity-40 grayscale-[0.2] scale-[0.98] ring-2 ring-accent/45 ring-offset-2 ring-offset-background';
