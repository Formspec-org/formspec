# ADR 0039: Visual Fidelity Fixes for formspec-studio

## Objective
Address the visual UX and design gaps identified during the audit to bring the current `formspec-studio` implementation into full alignment with the "Swiss Brutalist" aesthetic defined in the mockups
      and prototype.

## Key Files & Context
- `packages/formspec-studio/src/index.css`: Tailwind variables need updating.
- `packages/formspec-studio/src/components/Header.tsx`: Needs global search bar and Preview/Publish buttons.
- `packages/formspec-studio/src/workspaces/editor/FieldBlock.tsx`: Needs layout update, inline hint, and summary strip.
- `packages/formspec-studio/src/workspaces/editor/GroupBlock.tsx`: Needs heavy bottom border and layout adjustment.
- `packages/formspec-studio/src/workspaces/editor/PageTabs.tsx`: Needs "bubble" breadcrumb styling.
- `packages/formspec-studio/src/workspaces/editor/ItemProperties.tsx`: Needs `Sec`, `Row`, `BindCard`, `ShapeCard` high-density structure.
- `packages/formspec-studio/src/components/Shell.tsx` & `Blueprint.tsx`: Needs persistent structure tree layout adjustment.

## Implementation Steps

1. **Update Design Tokens**
- Edit `src/index.css` to update Tailwind variables (e.g., `--color-ink: #0F172A`, `--color-accent: #2563EB`, `--color-logic: #7C3AED`) to match the exact hex codes from the prototype
      `00-preamble.tsx`.

2. **Revamp Header Component**
- Update `src/components/Header.tsx`.
- Add a centralized search input (read-only trigger) that opens the `CommandPalette`.
- Add `Preview` and `Publish` action buttons.
- Re-align tabs to the left next to the logo.

3. **Enhance Editor Blocks**
- Update `FieldBlock.tsx` to use a multi-line layout with a dedicated hint line and a bottom "Summary Strip" for active binds (`calculate`, `relevant`, `constraint`, etc.).
- Update `GroupBlock.tsx` to include a heavy `2px border-ink` bottom border and `min/max` repeat indicators.
- Update `PageTabs.tsx` to render page navigation as numbered bubble breadcrumbs.

4. **Upgrade Properties Panel**
- Refactor `ItemProperties.tsx`.
- Integrate `Sec` (Section headers) and `Row` components to mimic the high-contrast uppercase headers (e.g., `IDENTITY`, `FIELD CONFIG`).
- Use `BindCard` and `ShapeCard` from the UI components to render bind and shape details directly in the properties panel instead of simple text.
- Restyle action buttons (Duplicate, Delete) to be full-width and letter-spaced at the bottom.

5. **Adjust Blueprint Sidebar Layout**
- Update `Shell.tsx` and/or `Blueprint.tsx` so that the `StructureTree` (or at least the `Wizard Pages` and `Items` tree) is persistently visible when the Structure section is active, mirroring
      the dual-pane sidebar seen in the mockup.

## Verification & Testing
- Run `npm run dev` and visually verify the changes against the mockup screenshots.
- Ensure all existing Playwright E2E tests (`npm run test:e2e`) still pass, as the structural `data-testid` attributes should remain intact.
- Verify that clicking the new Header search bar opens the Command Palette correctly.
