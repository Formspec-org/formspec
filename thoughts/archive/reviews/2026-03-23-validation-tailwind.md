# Tailwind Adapter PR Review Validation — 2026-03-23

Validating findings M7, M8, and L8 against current `new` branch state.

---

### M7: CSS Variable System Inconsistent — Raw Tailwind Color Tokens in Widgets

**Status:** Confirmed

**Current state:**

`shared.ts` defines a complete `--formspec-tw-*` CSS variable system (20+ variables in `tailwind-formspec-core.css`). The `TW` and `TW_CARD_OPTION` constants in `shared.ts` use these variables throughout. Six widgets violate this consistently:

**slider.ts** — 3 raw tokens:
- `bg-zinc-700` on the range track
- `accent-teal-500` on the range input
- `bg-teal-900/40`, `text-teal-200`, `ring-teal-500/20` on the value display badge
- `accent-rose-500` toggled on validation error (bypasses `--formspec-tw-danger`)

**rating.ts** — 2 raw tokens:
- `text-zinc-600` for unselected stars
- `hover:text-teal-400` for star hover state
- `ring-red-500` in `onValidationChange` (bypasses `--formspec-tw-danger`)

**money-input.ts** — 4 raw tokens on the currency prefix/secondary input:
- `border-zinc-700 bg-zinc-800 text-zinc-400` on the currency prefix span
- `border-zinc-700 bg-zinc-900/80 text-zinc-100 focus:border-teal-500 focus:ring-teal-500/15` on the free-text currency input

**file-upload.ts** — 8 raw tokens throughout:
- `border-gray-300` on the drop zone (also toggled in drag handlers)
- `text-gray-400` on icon wrapper
- `text-gray-600` on text row
- `text-blue-600 hover:text-blue-500` on browse label
- `text-gray-500` on size hint
- `border-blue-400 bg-blue-50` toggled on dragover
- `border-red-500` toggled in `onValidationChange`

**wizard.ts** — 6 raw tokens in step indicator:
- `bg-blue-600` for active step circle (also re-set in `updateIndicator` MutationObserver callback)
- `bg-green-500` for completed step circle
- `border-gray-300 text-gray-500` for future step circle
- `text-gray-700` for step label
- `bg-gray-200` for connector line

**tabs.ts** — 4 raw tokens:
- `border-gray-200` on the tab bar
- `border-blue-500 text-blue-600` for active tab button (also re-applied in `updateButtonStyles` MutationObserver callback)
- `border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700` for inactive tab button

Total raw color token usages: approximately 27 distinct class strings across 6 files. The dynamic update handlers in `wizard.ts` (line 132–136) and `tabs.ts` (lines 81–83) re-apply raw tokens on every state change, compounding the exposure.

**Severity assessment:** Agree — medium severity. The CSS variable system exists precisely to enable host theming. Any host that sets `--formspec-tw-accent` to their brand color gets consistent text inputs, buttons, and cards, but broken slider, rating, wizard, and tabs. The teal/zinc color scheme is visually jarring against the neutral defaults. This is a real user-facing theming bug, not a style preference.

**Fix ranking:** 2

**Fix effort:** Small — each file needs approximately 5–10 targeted substitutions. The CSS variables needed are already defined: `--formspec-tw-accent`, `--formspec-tw-border`, `--formspec-tw-border-strong`, `--formspec-tw-surface`, `--formspec-tw-muted`, `--formspec-tw-danger`, `--formspec-tw-track`. The slider track color needs `--formspec-tw-track` which exists in the CSS. The value badge in slider and the currency prefix in money-input need new variables (`--formspec-tw-surface-emphasis` or reuse of `--formspec-tw-surface-muted`). The teal accent throughout slider and rating should become `var(--formspec-tw-accent)`.

**Recommended action:** Fix all six files. Replace every hardcoded color class with the appropriate `[color:var(--formspec-tw-*)]` or `var(--formspec-tw-*)` form (matching the pattern already used in `TW` constants). For `accent-teal-500` on the range input, use `accent-[var(--formspec-tw-accent)]`. The `bg-zinc-700` slider track becomes `bg-[var(--formspec-tw-track)]`. All `ring-red-*` / `ring-rose-*` error indicators become `ring-[var(--formspec-tw-danger)]`. Wizard and Tabs step indicator hardcodes should use a local state-driven inline style or CSS variable class, since Tailwind's JIT can't dynamically derive state classes from variables — the cleanest fix is to replace class assignments with `style.backgroundColor` / `style.borderColor` using the variable references.

---

### M8: `tailwindAdapter` Imported but Never Registered in References App

**Status:** Not found — finding is incorrect

**Current state:**

`examples/refrences/main.js` imports only `uswdsAdapter` from `formspec-adapters` (line 5). `tailwindAdapter` is not imported anywhere in the file. The `EXAMPLES` list contains no entry with `adapter: 'tailwind'`. The only adapter explicitly registered is `uswdsAdapter` (line 12), used by the `uswds-grant` example. All other examples use the default adapter (set via `globalRegistry.setAdapter('default')` at line 513).

The original finding appears to have misread the import — the package `formspec-adapters` is imported, but only to pull `uswdsAdapter` from it. There is no dead `tailwindAdapter` import.

**Severity assessment:** N/A — finding does not exist in the current codebase.

**Fix ranking:** 5 (no action needed)

**Fix effort:** N/A

**Recommended action:** Leave as-is. If a Tailwind-themed example is desired in the references app, that is a feature addition, not a bug.

---

### L8: `applyErrorStyling` Dead Parameter Logic + `radio-group.ts` Bypass

**Status:** Confirmed (dead logic) / Partially confirmed (bypass characterization)

**Current state:**

`shared.ts` lines 143–148:
```ts
export function applyErrorStyling(el: HTMLElement, hasError: boolean, errorColor = 'rose'): void {
    const prefix = errorColor === 'rose' ? 'rose' : errorColor;
    el.classList.toggle('ring-2', hasError);
    el.classList.toggle(`ring-${prefix}-400/60`, hasError);
    el.classList.toggle('rounded-xl', hasError);
}
```

The `prefix` assignment is a pure identity: `errorColor === 'rose' ? 'rose' : errorColor` always equals `errorColor` regardless of the branch taken. There is no code path in the codebase that calls `applyErrorStyling` with a non-`'rose'` argument — grep confirms only `radio-group.ts` uses similar patterns, and it bypasses `applyErrorStyling` entirely.

**radio-group.ts** lines 80–84:
```ts
onValidationChange: (hasError) => {
    fieldset.classList.toggle('ring-2', hasError);
    fieldset.classList.toggle('ring-rose-400/60', hasError);
    fieldset.classList.toggle('rounded-xl', hasError);
},
```

This is not a bypass of `applyErrorStyling` in the safety-critical sense — it produces identical output to what `applyErrorStyling('rose')` would produce. The duplication is mild. However, calling `applyErrorStyling` directly would be cleaner and eliminate the copy.

The `errorColor` parameter was probably intended to allow callers to pass `'red'` or `'amber'` for different severity levels, but that intent was never realized. The parameter adds noise without adding capability.

**Is the dead logic actually dead?** Yes. The ternary `errorColor === 'rose' ? 'rose' : errorColor` collapses to `errorColor` unconditionally. If the intent was `errorColor === 'rose' ? 'rose-400/60' : errorColor + '-400/60'` or similar, it was never written. No call site passes a non-default value.

**Severity assessment:** Agree — low severity. This is a minor code smell: a parameter that doesn't do what it appears to do, plus mild duplication in one file. No runtime bug. No theming impact beyond the M7 issues already noted.

**Fix ranking:** 4

**Fix effort:** Trivial

**Recommended action:** Two steps:
1. Remove the `prefix` indirection — replace with direct `errorColor`:
   ```ts
   el.classList.toggle(`ring-${errorColor}-400/60`, hasError);
   ```
   Or, if the parameter has no real callers and will never vary, remove it entirely and hardcode `rose`, which makes intent clear.
2. Replace the inline `onValidationChange` in `radio-group.ts` with a call to `applyErrorStyling(fieldset, hasError)`.

Note: if `applyErrorStyling` is kept but the color parameter is dropped, it also becomes consistent with the M7 fix direction (which should be using `--formspec-tw-danger` not `rose-400/60` anyway). The right end state is `applyErrorStyling` using `var(--formspec-tw-danger)` in a ring class, eliminating the color parameter entirely.

---

## Summary Table

| Finding | Status | Severity | Fix Rank | Effort |
|---------|--------|----------|----------|--------|
| M7 — Raw color tokens in 6 widgets | Confirmed | Medium | 2 | Small |
| M8 — tailwindAdapter not registered | Not found | N/A | 5 | N/A |
| L8 — Dead parameter + radio-group bypass | Confirmed | Low | 4 | Trivial |
