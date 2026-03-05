# Formspec Studio v2 Documentation Plan

Date: 2026-03-05  
Status: Drafted for Ralph Step 31

## 1) Objective

Define a practical documentation strategy for `form-builder/` that combines:

- Inline JSDoc on the Studio public API and critical state logic.
- Generated API documentation (HTML + LLM markdown) from those comments.
- Lightweight command integration so docs stay easy to regenerate.

This plan is intentionally scoped so Step 32 can implement it directly.

## 2) Scope

In scope for Step 32:

- `form-builder/src/state/*` public exports.
- `form-builder/src/components/commands.ts` public command/search API.
- A Studio API entrypoint for doc generation.
- TypeDoc generation for Studio HTML API docs.
- Inclusion of Studio in generated TypeScript LLM API markdown.

Out of scope for Step 32:

- End-user guides and onboarding narrative docs (reserved for Step 33 README).
- Exhaustive comments on purely local/private component internals.
- Visual design documentation.

## 3) Documentation Targets

Priority 0 (must document):

- `form-builder/src/state/project.ts`
- `form-builder/src/state/mutations.ts`
- `form-builder/src/state/wiring.ts`
- `form-builder/src/state/derived.ts`
- `form-builder/src/state/versioning.ts`
- `form-builder/src/state/import-export.ts`
- `form-builder/src/state/extensions.ts`
- `form-builder/src/components/commands.ts`

Priority 1 (document only where externally reused):

- Shared control/component props interfaces that are imported across modules.

Priority 2 (defer):

- Local UI-only components with no cross-module API surface.

## 4) Step 32 Deliverables

### 4.1 Inline JSDoc Baseline

Add concise JSDoc for exported symbols in Priority 0 files:

- Module-level summary at file top.
- Public interfaces/types: purpose + key semantics/constraints.
- Public functions: behavior, side effects, and key invariants.
- Complex params/returns: `@param` and `@returns` tags where clarity is needed.

Documentation style:

- Describe behavior, not implementation trivia.
- Call out mutation side effects explicitly for state mutators.
- Keep comments short and factual.

### 4.2 Stable Studio API Entrypoint

Create `form-builder/src/index.ts` that re-exports the Studio API intended for docs:

- State model/types and mutations.
- Derived diagnostics helpers.
- Import/export, versioning, and extension helpers.
- Command registry/search helpers.

Do not re-export every UI component by default.

### 4.3 Generated Docs Integration

Add Studio docs generation to existing tooling:

1. TypeDoc HTML output:
   - Generate `docs/api/form-builder/` from `form-builder/src/index.ts`.
2. LLM markdown output:
   - Generate `form-builder/API.llm.md` via `scripts/generate-ts-api-markdown.mjs`.
3. Build plumbing:
   - Ensure declaration output exists for Studio doc extraction (e.g., `tsconfig.docs.json` + declaration emit target).

## 5) Proposed Command Surface

Step 32 should add/update commands so docs are repeatable:

- `npm run docs:api:studio` (Studio TypeDoc target)
- Existing `make api-docs` includes Studio HTML + `API.llm.md`

Optional (if low effort):

- `npm run docs:api` aggregator for all TypeScript packages including Studio.

## 6) Acceptance Criteria (Step 32 Done)

Step 32 is complete when all are true:

1. Priority 0 files contain meaningful JSDoc on exported APIs.
2. `form-builder/src/index.ts` exists and is used as Studio docs entrypoint.
3. `make api-docs` produces `docs/api/form-builder/index.html`.
4. Studio LLM API doc exists at `form-builder/API.llm.md` and is generated, not hand-edited.
5. Doc generation commands run successfully in the local environment (or blockers are explicitly documented).

## 7) Risks and Mitigations

Risk: Studio API surface is broad, causing noisy docs.

- Mitigation: Curate exports in `form-builder/src/index.ts` and avoid exporting UI internals.

Risk: TypeDoc/LLM generation expects package `dist` declarations.

- Mitigation: Add a dedicated Studio docs tsconfig for declaration emit and wire scripts to use it.

Risk: Over-documenting volatile code.

- Mitigation: Document public behavior and invariants, not internal render details.

## 8) Step 32 Execution Order

1. Create `form-builder/src/index.ts` docs entrypoint.
2. Add inline JSDoc across Priority 0 files.
3. Add Studio declaration-emit config for docs.
4. Wire TypeDoc and markdown generation scripts/Makefile.
5. Run docs generation, verify outputs, and adjust wording for clarity.

## 9) Step 33 Boundary

Step 33 should build on this plan by writing the Studio README:

- quick start
- architecture summary
- common workflows
- doc/test commands
- known limitations
