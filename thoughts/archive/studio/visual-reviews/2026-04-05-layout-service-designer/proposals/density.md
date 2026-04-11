# Proposal: Density-focused — Information and control per pixel

## Design rationale

Layout authoring is **work**: authors need **maximum structure visible** and **minimum decorative chrome**. Demote **decorative** accents, **compress** vertical rhythm in the canvas header, and **prefer recovery patterns** that do not expand layout (tooltips over wrapping) while keeping **touch zones** legally large.

## Visual changes (per handoff problems)

1. **Dual hero** — Remove **fill** from active step entirely: **ink text + dot** or **narrow left tick** in stepper (4px bar, same vocabulary as canvas rail but **inline** in nav height). Canvas remains authoritative selection.  
2. **STACK** — **No badge**; only **left rule** `border-s-2 border-s-border/50` on stack body — same language as rails but **neutral color** so accent rails remain unique to **selection**.  
3. **Truncation** — **No wrap** (preserves scan lines); **`title` mandatory** + **copy path** micro-button on field key row (icon ⎘) for power users.  
4. **Toolbar** — **Single row** icon-first toolbar with **overflow “⋯”** for rare props; increases density without shrinking below **44px** hit area (icon buttons 36px + padding).  
5. **Adds** — Collapse **`+ Page` + split** into **single “Insert”** menu (Item / Page / Container) — **one** control, **three** entries.  
6. **Drag handle** — **Always visible** 4-dot grip at **40% opacity**; **100%** on hover/focus.

## Token/CSS changes

- Reuse `text-muted`, `border-border`; introduce **density** flag only if studio already has comfortable/compact — otherwise hardcode **compact** header `py-1` for `LayoutCanvas` tool row behind `@media (min-width: ...)`.

## Component changes

- `LayoutCanvas.tsx` — **Insert** menu (replaces three buttons); larger refactor.  
- `FieldBlock.tsx` — optional **copy bind path** control in key row.  
- `InlineToolbar.tsx` — icon-first layout (bigger change).

## Implementation sketch

```tsx
// LayoutStepNav — minimal active
isActive
  ? 'relative pl-2 text-ink before:absolute before:left-0 before:top-1 before:h-[calc(100%-8px)] before:w-1 before:rounded-full before:bg-accent'
  : 'text-muted hover:text-ink'
```

```tsx
// LayoutCanvas — insert single entry point
<DropdownMenu trigger="+ Insert…" items={['Item', 'Page', 'Container…']} />
```

## Success criteria check

| Criterion | Pass? |
|-----------|-------|
| Single accent hero | Pass |
| Nesting deliberate | Pass (neutral stack rule) |
| Truncation recoverable | Pass (title + copy) |
| Toolbar legibility | Risk — icons need labels/tooltips |
| No regression | Needs careful QA on toolbar |

## Bonus findings

- **Insert menu** improves **keyboard** flow if built with typeahead; poor menu UX **hurts** density gains — ship with **shortcuts** in menu labels (`I` / `P`).
