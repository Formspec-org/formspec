# Proposal: Conservative — Layout polish (token + CSS only)

## Design rationale

The shared **rail + tint** selection system already fixed the worst dialect clash between **field** and **container**. Remaining issues are **mostly hierarchy and truncation**, solvable by **demoting the wizard active pill** to an outline variant, **tightening STACK** chrome when the parent page is selected, and **adding non-visual recovery** for truncated strings — without new components or layout rewrites.

## Visual changes (per handoff problems)

1. **Dual hero accent** — Active step: `bg-accent` → `bg-transparent border border-accent text-accent` (or `bg-accent/10 text-ink`); keep canvas selection as the stronger signal.  
2. **STACK sketch** — When page container is selected, inner stack uses `border-border/50` solid or `border-dashed border-muted` with **same corner radius family** as outer; optional `bg-bg-default/20`.  
3. **Truncation** — Add `title={fullTitle}` on step buttons; key row already has `title={bindPath || itemKey}` — verify step nav passes full `page.title`.  
4. **Toolbar scale** — Bump `InlineToolbar` base from 11px to **12px** for control labels only; leave icons unchanged.  
5. **Add cluster** — Slightly reduce padding on secondary buttons (`+ Page`, split chevron) vs `+ Item` (`px-3` vs `px-2.5`) — visual weight only.  
6. **Drag handle** — `opacity-40` default → `opacity-70` on leaf, full on `group-hover` (still subtle at rest).

## Token/CSS changes

- Step active: replace `bg-accent text-white` with `border border-accent/80 bg-accent/[0.08] text-ink` in `LayoutStepNav.tsx`.  
- STACK selected context: conditional class in `LayoutContainer.tsx` when `selected && pageSelected` (prop drill or context).  
- `text-[11px]` → `text-[12px]` on toolbar label classes in `InlineToolbar.tsx` (scoped).

## Component changes

None structural — class string edits only.

## Implementation sketch

```tsx
// LayoutStepNav.tsx — active tab button class fragment
isActive
  ? 'border border-accent/80 bg-accent/[0.08] text-ink shadow-sm'
  : 'text-muted hover:bg-subtle hover:text-ink'
```

## Success criteria check

| Criterion | Pass? |
|-----------|-------|
| Single accent hero | Pass if stepper demoted |
| Nesting deliberate | Partial — needs container conditional |
| Truncation recoverable | Pass with title + long titles |
| Toolbar legibility | Pass (minor bump) |
| No regression | Pass |

## Bonus findings

- Live preview **yellow** selection highlight may still **differ** from canvas **rail** — consider aligning preview hint to **accent tint** for cross-panel consistency (optional).
