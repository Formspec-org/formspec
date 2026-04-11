# Tailwind Adapter Cleanup Plan

**Date**: 2026-03-23  
**Status**: Draft  
**Files**: `packages/formspec-adapters/src/tailwind/*`  
**Related**: ADR 0046 (Headless Adapters), ADR 0049 (Tailwind Adapter), `examples/tailwind-demo/`

---

## Goal

Make the Tailwind adapter a **clean, neutral, reusable reference implementation** of the adapter contract, while moving all opinionated visual design and demo polish into `examples/tailwind-demo/`.

The adapter should provide correct DOM structure and Tailwind utility classes — **not** a hardcoded dark/teal design system.

---

## What Belongs Where

### Should Stay in the Adapter (`packages/formspec-adapters/src/tailwind/`)

- Core DOM structure for all components
- Correct use of `FieldRefs` and `behavior.bind()`
- `applyCascadeClasses()` and `applyCascadeAccessibility()`
- Shared helpers (`el`, `createTailwindFieldDOM`, `createTailwindError`)
- Basic, neutral Tailwind utility patterns (layout, focus states, spacing, form structure)
- Support for `labelPosition`, `hint`, validation, `optionControls`, `rebuildOptions`
- Minimal UA resets (e.g. `color-scheme: dark`)

### Should Be Moved or Removed (to `examples/tailwind-demo/`)

#### 1. `integration-css.ts` — Major Offender

**Most of this file should be moved/deleted:**

- All color-specific rules (`text-white`, `teal-500`, `rose-400`, `zinc-900`)
- Custom checkbox card `::after` checkmark
- Rating star styles, slider thumb styles
- `.formspec-card`, `.formspec-submit`, validation summary styling
- Glassmorphic and backdrop effects
- Most `formspec-render` global selectors with `!important`

**Keep only**:

- Essential form control resets (`color-scheme: dark`, basic input background fixes)

#### 2. Hardcoded Colors in `shared.ts`

Current `TW` object contains strong visual opinions:

- `TW.label`, `TW.input`, `TW.error`, `TW_CARD_OPTION`, `TW.controlSm`, button styles
- `TW_CARD_OPTION` with `teal-500`, `zinc-900/50`, `hover:bg-zinc-800/60`, etc.

**Action**: Make these neutral or use CSS variables:

- Use `var(--accent-color, #2dd4bf)` or similar
- Provide semantic base classes instead of fully styled ones

#### 3. Visual Styling in Component Files

**Affected files**:

- `checkbox.ts` (currently open)
- `checkbox-group.ts`
- `toggle.ts`
- `text-input.ts` (prefix/suffix styling)
- `rating.ts`, `slider.ts`, etc.

**Specific issues**:

- Card backgrounds and hover states
- Hardcoded error ring colors in `onValidationChange`
- Select-all styling in checkbox group
- Toggle switch colors

**Fix**: Keep the structural patterns (e.g. card layout, peer modifiers) but strip or parameterize the colors.

---

## Recommended Changes

### Immediate Priorities

1. **Refactor `shared.ts`** — Make `TW` constants neutral/base
2. **Slim down `integration-css.ts`** — Reduce to < 40 lines
3. **Update `checkbox.ts`** (focused file) — Use shared helpers consistently and remove hardcoded colors
4. **Clean `checkbox-group.ts`** and `toggle.ts`
5. **Move demo styling** to `examples/tailwind-demo/styles.css` or equivalent

### Later Improvements

- Add optional `tailwind-merge` support
- Better documentation on how to customize colors via theme
- Strengthen tests to cover theme overrides
- Consider making the adapter accept a color palette config

---

## File-by-File Recommendations

| File                        | Action                          | Details |
|----------------------------|----------------------------------|-------|
| `integration-css.ts`       | **Heavy reduction**             | Move 80%+ to demo |
| `shared.ts`                | **Refactor**                    | Neutralize `TW` constants |
| `checkbox.ts`              | **Update** (currently open)     | Use shared helpers, remove colors |
| `checkbox-group.ts`        | **Update**                      | Reduce inline styles |
| `toggle.ts`                | **Update**                      | Simplify switch styling |
| `text-input.ts`            | **Review**                      | Check prefix/suffix colors |
| `index.ts`                 | **No change**                   | Keep as-is |
| `structural.test.ts`       | **Enhance**                     | Add tests for neutral styling |

---

## Next Steps

1. Create cleaned versions of `shared.ts` and `checkbox.ts`
2. Strip `integration-css.ts` down to essentials
3. Move the visual polish into the Tailwind demo
4. Update the demo to import its own styles
5. Regenerate `filemap.json` and run tests

This cleanup will make the Tailwind adapter a much better reference implementation and reduce long-term maintenance burden.

**Related Documents**:

- `thoughts/archive/adr/0049-tailwind-css-adapter.md`
- `packages/formspec-adapters/README.md`
- `examples/tailwind-demo/index.html`
