/** @filedesc Shared @dnd-kit pointer, feedback, and sortable defaults for Studio DnD. */
import { FeedbackType } from '@dnd-kit/dom';
import { PointerActivationConstraints } from '@dnd-kit/dom';

/** Standard visual feedback mode for Studio drag and drop. */
export const STUDIO_DND_FEEDBACK: FeedbackType = 'default';

/** Snappy sortable transition used project-wide (100ms duration). */
export const STUDIO_SORTABLE_TRANSITION = {
  duration: 100,
};

/** 
 * Activation constraints to prevent accidental micro-drags during selection.
 * Standardized to 10px across all workspaces.
 */
export const STUDIO_POINTER_ACTIVATION = [
  new PointerActivationConstraints.Distance({ value: 10 }),
];
