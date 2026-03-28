/** @filedesc Tests for widget vocabulary — ensures spec-compliance of component↔hint mappings. */
import { describe, it, expect } from 'vitest';
import { COMPONENT_TO_HINT, SPEC_WIDGET_TO_COMPONENT } from '../src/widget-vocabulary.js';

describe('widget-vocabulary', () => {
  it('COMPONENT_TO_HINT does not map Collapsible (no Tier 1 widgetHint for Collapsible)', () => {
    // Collapsible → 'accordion' is wrong: accordion hint maps to the Accordion component.
    // Collapsible is handled via layout.collapsible boolean (CoreSpec S4.2.5.2), not widgetHint.
    expect(COMPONENT_TO_HINT).not.toHaveProperty('Collapsible');
  });

  it('COMPONENT_TO_HINT Accordion maps to accordion hint (not Collapsible)', () => {
    expect(COMPONENT_TO_HINT['Accordion']).toBe('accordion');
  });

  it('accordion hint in SPEC_WIDGET_TO_COMPONENT maps to Accordion (not Collapsible)', () => {
    expect(SPEC_WIDGET_TO_COMPONENT['accordion']).toBe('Accordion');
  });

  it('round-trips Accordion without lossy collision with Collapsible', () => {
    // Before fix: Collapsible → 'accordion' → Accordion (lossy)
    // After fix: Accordion → 'accordion' → Accordion (correct)
    const hint = COMPONENT_TO_HINT['Accordion'];
    const component = SPEC_WIDGET_TO_COMPONENT[hint];
    expect(component).toBe('Accordion');
  });
});
