# Studio TODO

## bindKeyMap collision (resolved)

**Status:** Fixed in-repo (2026-04-14). `reconcileComponentTree` (`@formspec-org/core`) stamps each item with **`definitionItemPath`** (absolute definition dotted path). Layout code in `@formspec-org/studio-core` / studio prefers that field when resolving paths; `buildBindKeyMap` remains a fallback for external trees that never ran reconciliation.

**Areas touched:** `packages/formspec-core/src/tree-reconciler.ts`, `packages/formspec-studio-core/src/authoring-helpers.ts`, `packages/formspec-studio/src/workspaces/layout/render-tree.tsx`, `CompNode` in `layout-helpers.ts`.
