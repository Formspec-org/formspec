# Proposal: Conservative

## Design rationale

Keep ItemRow-style field cards and the dashed container metaphor, but **tie them together with shared tokens** so the canvas reads as one system. Avoid collapsible panels or layout restructures — only **token and class tweaks** that reduce the “sketch vs product” gap and soften duplicate accent noise.

## Visual changes (map to brief problems)

1. **Dialect clash**: Change `LayoutContainer` selected state from `bg-accent/5 shadow-sm` to **`bg-bg-default/40` + `border-border/80` solid** (still dashed when unselected). Slightly increase `rounded` to `rounded-lg` to echo card corners without copying `18px`.  
2. **Competing selection**: Field selected shadow reduced to **`shadow-md` + `ring-1 ring-accent/25`** instead of large blue diffuse shadow.  
3. **Vertical rhythm**: Add **`mt-1`** only between summary strip and toolbar; reduce summary **`pt-3`** to **`pt-2`**.  
4. **Toolbar scale**: Add **`text-[10px] font-semibold uppercase tracking-wide text-muted`** as a single “Properties” label above `InlineToolbar` inside `FieldBlock` only (one line).  
5. **Container menu**: Add **`title` tooltip** on “+ Add Container” + **`aria-expanded`** on a click-to-toggle version (minimal JS).  
6. **Resize**: Bump visible handle to **`w-2.5`** and **`bg-accent/15`** default tint.

## Token/CSS (examples)

```css
/* conceptual — map to Tailwind in components */
--layout-container-selected-bg: bg-bg-default/50;
--layout-field-selected-ring: ring-1 ring-accent/30;
```

## Component changes

- `LayoutContainer.tsx`: selected `className` branch.  
- `FieldBlock.tsx` / `DisplayBlock.tsx`: shellClasses shadow + optional label row above toolbar.  
- `LayoutCanvas.tsx`: container button `title` + `aria-haspopup`.

## Implementation sketch

```tsx
// LayoutContainer — selected branch (illustrative)
selected
  ? 'border-border/80 bg-bg-default/50 border-solid shadow-sm'
  : 'border-muted border-dashed'
```

```tsx
// FieldBlock shell — selected (illustrative)
selected
  ? 'border-accent/50 bg-accent/[0.09] shadow-md ring-1 ring-inset ring-accent/20'
  : 'border-transparent hover:border-border/70 hover:bg-bg-default/56'
```

## Success criteria check

| Criterion | Addressed |
|-----------|-----------|
| Single selection dialect | Partially — containers still dashed unselected |
| Grid balance | Partially — minor spacing |
| Primary action | Partially — tooltip only |
| Focus visible | Unchanged (pass) |
| No regression | High confidence |
