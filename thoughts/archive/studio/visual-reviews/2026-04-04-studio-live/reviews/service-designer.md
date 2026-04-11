# Service designer review — winning proposal (evolutionary)

**Context:** Live Layout workspace at `http://localhost:5173/studio/` — see `../screenshots/pass1-*.png` for wizard chrome, dashed STACK, field card, and truncation under narrow layout.

## Endorsement

**Endorse with modifications.** The shared **left-rail selection** improves scannability and matches how operators think (“which node is active in the tree”). Collapsing Description/Hint behind disclosure **reduces grid chaos** but must remain **discoverable** for users who rely on canvas-only editing.

## User journey impact

- **Positive**: Clearer parent/child selection; less “glow everywhere.”  
- **Risk**: Disclosure adds a click; mitigate with **remember open state per session** or **auto-open when description/hint non-empty**.

## State communication

- Field **readonly/error** states are **not** in scope of this proposal (studio chrome). Ensure selected state does not **override** validation styling if preview embeds later.

## Cognitive load

- **Split button** for containers is learnable if labels are explicit (“Add layout” + menu). Avoid icon-only primary.

## Edge cases

- **Long labels**: Left rail must not steal width — keep rail **fixed 4px**; truncate inside card.  
- **Nested grids**: Selection rail on **innermost** only; ancestors use muted border (per proposal intent).  
- **RTL**: `border-l` must become **logical** `border-s` / `border-inline-start` in implementation.  
- **Live capture**: Truncated **wizard step** labels (“Househ…”) and **mono key** ellipsis need **tooltips** or scroll so users do not lose context.

## Progressive disclosure

- Aligns with proposal; ensure **toolbar** remains visible when summary collapsed (authoring priority).

## Suggested modifications

1. Use **`border-inline-start-4`** for RTL.  
2. **Badge** on “Details” when description/hint has content.  
3. Keyboard: **`d`** shortcut to toggle details when field focused (optional).  
4. Add **`title`** (or visible overflow affordance) for stepper pills and field keys when `text-overflow: ellipsis` applies.
