# Tailwind Adapter Issues, Context & Proposed Fixes

**Location**: `packages/formspec-adapters/src/tailwind/`

**Status**: Active development (recent changes to `checkbox.ts`, `checkbox-group.ts`, `integration-css.ts`)

---

## Executive Summary

The Tailwind adapter aims to provide **utility-first styling** on top of the `formspec-webcomponent` headless architecture (ADR 0046 + ADR 0049). While it successfully demonstrates the adapter contract, it has drifted into several anti-patterns that contradict the project's philosophy of clean seams, minimal integration CSS, and ephemeral code.

**Core Problem**: Instead of being a thin, neutral styling layer, it has become a **hardcoded dark/teal design system** with significant global CSS and duplication.

---

## Context

### Intended Design (from ADRs)

- Adapters should **own only DOM structure + classes**.
- Behavior hooks (`FieldBehavior`, `bind(refs)`) own all reactivity, validation, ARIA, and state.
- Tailwind adapter should demonstrate **utility-first CSS** with near-zero `integrationCSS`.
- Themes should control appearance via `cssClass` (union-merge), tokens, and `presentation`.
- Serve as the primary reference implementation for custom adapters.

### Current Reality

- Hardcoded opinionated dark theme (`zinc-900`, `teal-500`, `rose-400`).
- Large `integration-css.ts` (195 lines) with `!important` and global selectors.
- Duplicated DOM construction logic across 15+ render functions.
- Weak support for theme cascade conflicts (Tailwind utility precedence).

---

## Major Issues

### 1. Hardcoded Opinionated Design System

- `shared.ts` defines `TW.*` constants with a specific dark/teal aesthetic.
- `TW_CARD_OPTION`, validation styles, card backgrounds, and accent colors are baked in.
- `checkbox.ts`, `toggle.ts`, `checkbox-group.ts` all embed this palette.
- **Impact**: Themes cannot easily rebrand without fighting the adapter.

### 2. Excessive `integration-css.ts` (Anti-Pattern)

- 195 lines of global CSS targeting `formspec-render`.
- Uses `!important`, custom `::after` pseudo-elements, UA overrides, and styles for validation, cards, sliders, ratings, submit buttons.
- Directly contradicts the "near-zero integration CSS" goal from ADR 0049.

### 3. Code Duplication & Poor Helper Usage

- `shared.ts` provides `createTailwindFieldDOM()` and helpers, but many components (especially `checkbox.ts` and `checkbox-group.ts`) duplicate logic.
- Inconsistent patterns between simple fields, card-based controls, and complex widgets.
- 15+ render functions with similar but not shared code.

### 4. Tailwind Cascade & Utility Conflicts

- `cssClass` uses union-merge semantics, but Tailwind utilities are order-dependent.
- No integration with `tailwind-merge` (mentioned in ADR 0049 but not implemented).
- `applyCascadeClasses` simply appends classes with no conflict resolution.

### 5. Other Issues

- Long, opaque class strings scattered across files.
- Hardcoded validation/error styling in `onValidationChange` callbacks.
- Weak test coverage (mostly class presence checks).
- Minor bug: `accent-color: #2dd4bf;f` in `integration-css.ts`.
- Maintenance burden: changes to behavior contracts require updating both USWDS and Tailwind adapters.

---

## Proposed Fixes

### Phase 1: Immediate Cleanup (High Impact)

1. **Neutralize the Design System**
   - Refactor `TW` constants to semantic base classes.
   - Use CSS custom properties for accent/error colors.
   - Make the adapter accept a color palette configuration.

2. **Dramatically Reduce `integration-css.ts`**
   - Move demo-specific styles to `examples/tailwind-demo/`.
   - Keep only essential UA resets.
   - Replace custom pseudo-elements with Tailwind peer modifiers where possible.

3. **Consolidate Shared Logic**
   - Expand helpers in `shared.ts` (e.g. `createCardControl()`, `withValidation()`).
   - Update `checkbox.ts` (currently focused) to use shared helpers as a model.
   - Create a small composition system for common field patterns.

### Phase 2: Architecture Improvements

1. **Better Theme Integration**
   - Add optional `tailwind-merge` post-processing helper.
   - Improve documentation around `cssClassReplace` for Tailwind themes.
   - Respect `behavior.presentation.style` and `widgetConfig` more thoroughly.

2. **Testing & Documentation**
   - Strengthen `structural.test.ts` with theme override, accessibility, and state tests.
   - Update README with clear customization guides.
   - Add a "minimal Tailwind starter" example.

### Phase 3: Long-term (Optional)

1. **Extract Palette Configuration**
   - Allow adapters to be instantiated with a theme config.
   - Generate class constants from a config object.

---

## Recommended Implementation Approach

Given the project's "prefer starting over to refactoring" philosophy:

- **Do not incrementally patch** the existing files.
- Create a cleaner version of the core helpers and 2-3 representative components (`checkbox.ts`, `text-input.ts`, `toggle.ts`).
- Use the red-green-refactor workflow: add tests first, then implement.
- Delete/replace large parts of `integration-css.ts`.

**Next Step**: Start by refactoring the currently focused file (`checkbox.ts`) and `shared.ts` as a demonstration.

---

## Files to Prioritize

- **`shared.ts`** — Foundation for all components
- **`checkbox.ts`** — Currently open/focused
- **`checkbox-group.ts`** — Complex card pattern
- **`integration-css.ts`** — Largest source of technical debt
- **`index.ts`** — Adapter registration
- **`structural.test.ts`** — Test coverage

---

**Created**: March 23, 2026  
**Related**: ADR 0046, ADR 0049, `specs/theme/theme-spec.llm.md`

This document lives at `thoughts/archive/reviews/2026-03-23-tailwind-adapter-review.md`.
