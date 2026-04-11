# Editor/Layout Split — Remaining Tasks

## Context

The Studio-side implementation of the Editor/Layout split is complete:

- Editor is definition-only.
- Layout is the only Studio page/layout authoring surface.
- `studio-core` owns the meaningful page/layout business logic.
- Studio no longer uses the old `pages.*` editing path.
- `make api-docs` works again.
- runtime precedence is explicit in `formspec-layout`
- precedence tests exist for Definition vs Theme vs Components
- the `definition-pages.ts` boundary is clarified as Tier 1 only
- the layered model is documented in the package READMEs
- the Rust doc warning is fixed

What changed during implementation is not the layered Formspec model itself. The correct model remains:

- `definition.json` is sufficient on its own.
- `theme.json` is optional and remains a valid authoring layer.
- `component.json` is optional and has highest precedence when present.
- Higher layers override lower layers, but do not invalidate them.

That means the remaining work is not “remove lower layers.” The remaining work is to make the layered precedence model explicit and consistent, while keeping Studio from conflating those layers.

## What Does Not Need Undoing

No major rollback is needed.

The recent changes are still directionally correct:

- removing the legacy Studio `pages.*` editing abstraction
- making Layout/component-tree editing the Studio page surface
- keeping Studio off `theme.pages` as an editing model
- cleaning up `effectiveComponent` callers and API docs

The adjustment is in how the remaining work is framed:

- not “delete `theme.pages`”
- instead “preserve lower layers, but keep Studio from treating them as the same authoring surface”

## Remaining Tasks

### 1. Optionally Tighten Canonical Spec Prose

This is optional, not a blocker for Studio.

If the public spec should be clearer about coexistence and precedence between Theme and Components, the canonical prose can be tightened later. That is separate from the Studio split itself.

Recommended action:

- only touch canonical specs if the current wording is materially ambiguous

### 2. Clean Remaining Studio Naming Residue

There is still some “Pages” naming in Studio that now really means page navigation inside the Layout workspace.

Examples:

- [packages/formspec-studio/src/workspaces/layout/PageNav.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/layout/PageNav.tsx)
- [packages/formspec-studio/src/workspaces/layout/PageSection.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/layout/PageSection.tsx)

This is mostly cosmetic now.

Recommended action:

- clean up names and test descriptions only where it improves clarity
- do not spend time on low-value renames unless they reduce confusion

### 3. Leave ADR/Research History Alone Unless Needed

Older research and ADR material still documents paths that were abandoned. That is acceptable as historical record.

Recommended action:

- do not rewrite ADRs just to match the current implementation
- only add new ADR/spec material if a new decision needs to be recorded

### 4. General Repo Cleanup

The repository still has unrelated worktree changes outside this slice. That is not Editor/Layout-split debt, but it is still real repo cleanup work.

Recommended action:

- separate true post-split follow-up from unrelated in-flight work
- avoid mixing architecture cleanup with incidental workspace churn

## Recommended Order

If this is tackled next, the best order is:

1. Decide whether canonical spec prose needs tightening.
2. Do a low-cost naming cleanup inside Studio.
3. Leave ADR/research alone unless a new decision is needed.
4. Keep unrelated repo cleanup separate from the split work.

## Bottom Line

The Editor/Layout split is implemented.

The remaining work is now mostly optional cleanup:

- public spec prose, if needed
- Studio naming polish
- ordinary repo hygiene outside this slice
