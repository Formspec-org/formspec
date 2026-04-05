# Scout review — winning proposal (evolutionary)

## Implementation viability

**Feasible.** Changes are mostly **class composition** and one **local state** (`detailsOpen`) in `FieldBlock`/`DisplayBlock`. Shared constant can live in `layout-node-styles.ts` (new small module) to avoid circular imports between `FieldBlock` and `LayoutContainer`.

## Code impact

- **Touched**: `LayoutContainer.tsx`, `FieldBlock.tsx`, `DisplayBlock.tsx`, `LayoutCanvas.tsx`, possibly `InlineToolbar.tsx` (footer wrapper only).  
- **Tests**: Vitest layout tests assert `aria-pressed`, testids — update if wrappers change. Playwright if any selector depended on shadow class.

## Design system coherence

- Prefer **one exported constant** `LAYOUT_NODE_SELECTED` rather than copying Tailwind strings.  
- Do not introduce **hex** blues; keep **`accent`** tokens.

## Component architecture

- `LayoutContainer` and `FieldBlock` do not share a parent today — **shared module** is the right seam.  
- Disclosure state should be **local** (not global context) unless cross-node sync is required.

## Domino check

- Fixes **first domino** for problem 1–2 (independent styling).  
- Problem 3 addressed only if disclosure ships; else combine with conservative padding tweak.

## Spec compliance

- Studio-only; **no** Theme spec change required for MVP.

## Blast radius

- **Medium**: Any visual test snapshots (if present) for layout. E2E theme/layout specs should be re-run.

## Suggested modifications

1. Add **`@filedesc`** on new `layout-node-styles.ts`.  
2. Feature-flag **disclosure** behind `layoutContext.parentContainerType === 'grid'` first, then expand.

## Estimated blast radius

| Area | Risk |
|------|------|
| Layout Vitest | Low–medium |
| Studio E2E layout | Medium |
| Storybook / none | N/A |
