/**
 * Inline hint — one-line contextual help shown below or near a control.
 * Visible by default in Simple mode, hidden in Advanced mode.
 */
import type { InspectorTier } from './Inspector';

interface InlineHintProps {
  text: string;
  tier: InspectorTier;
}

export function InlineHint(props: InlineHintProps) {
  if (props.tier === 'advanced') return null;
  return <p class="inspector-inline-hint">{props.text}</p>;
}
