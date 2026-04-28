# PRD: Unified Authoring (AI + Manual Parity)

| Field | Value |
| --- | --- |
| **Status** | Draft |
| **Product** | Formspec Studio (`packages/formspec-studio`) |
| **Related** | [Studio first-run onboarding PRD](./2026-04-25-prd-studio-first-run-onboarding.md), [Studio unified feature matrix](./2026-04-26-studio-unified-feature-matrix.md), [Formspec Studio PRD (archived)](../archive/studio/2026-03-05-product-requirements-v2.md) |

---

## 1. Summary

Studio should no longer be modeled as "assistant onboarding" followed by "manual workspace."  
The primary split is **method of modification**:

- **AI-mediated** authoring (intent → proposal/patch → apply)
- **Manual/direct** authoring (click/drag/type direct edits)

This PRD defines a single workspace where both methods are first-class and equivalent.  
Authors may remain AI-first indefinitely without losing access to capabilities currently exposed only through manual UI.

---

## 2. Problem and opportunity

### 2.1 Problem

- Current experience still implies phase transition ("assistant" then "workspace"), which suggests assistant is a pre-step rather than a complete authoring mode.
- High-value authoring controls remain easier or only possible through direct manipulation in tabs/panels.
- Users who prefer conversational authoring can feel forced into manual interaction even when their intent is clear.

### 2.2 Opportunity

- Unify all write paths under one model where **AI and manual are peers**.
- Increase throughput for expert users who want full capability from language commands.
- Improve trust by making both methods produce the same reviewable patch/provenance objects.

---

## 3. Goals and non-goals

### 3.1 Goals

1. **G1 — Method parity:** Every core manual capability has an AI path with equivalent outcome semantics.
2. **G2 — Single object model:** AI and manual mutations produce the same patch/provenance/event structures.
3. **G3 — No forced transition:** Users can complete end-to-end authoring without entering a distinct manual phase.
4. **G4 — Progressive disclosure:** Manual controls remain available, but are optional and can stay collapsed.
5. **G5 — Auditability:** AI suggestions expose scope/rationale/diff, with apply/edit/reject/rollback controls.
6. **G6 — Safety symmetry:** Validation, policy checks, and guardrails are identical regardless of edit method.

### 3.2 Non-goals

- **NG1 — Remove manual UI:** Manual controls remain supported and first-class.
- **NG2 — Fully autonomous editing:** This PRD is not an "auto-run agent" initiative; user confirmation and review remain required where policy demands.
- **NG3 — Rewrite of core data model:** Reuse existing project/patch/provenance primitives and evolve them incrementally.
- **NG4 — New respondent runtime:** Respondent-facing behavior changes only indirectly through authored artifacts.

---

## 4. Product model

### 4.1 Authoring modes

- Studio has one project canvas and one artifact graph.
- "AI mode" and "Manual mode" are interaction methods, not separate products.
- UI uses explicit language: **AI edits** and **Manual edits**, not "onboarding vs workspace."

### 4.2 Source-of-truth

- All edits resolve to canonical project mutations.
- All accepted edits emit normalized patch records and provenance metadata.
- Undo/redo/history/review are shared across methods.

---

## 5. Capability parity matrix requirement

Create and maintain a **Manual → AI capability matrix** as the delivery backbone.

Each capability row must include:

1. Capability name
2. Manual interaction path
3. AI command/tool path
4. Output object(s) touched
5. Validation/policy gates
6. Confidence level (`high`, `medium`, `low`)
7. Current gap / missing primitives
8. Owner and milestone

Initial scope (minimum):

- Definition metadata
- Field/group CRUD and ordering
- Bind/rule edits
- Layout placement and overrides
- Mapping transforms
- Evidence links/citations
- Patch review lifecycle (open/accept/reject/revert)
- Export/publish-adjacent actions

---

## 6. UX requirements

### 6.1 Unified shell behavior

- Remove language implying a hard phase boundary ("enter workspace" as a required milestone).
- Replace with neutral affordances such as:
  - "Open advanced controls"
  - "Show structure panel"
  - "Show layout tools"

### 6.2 AI-first continuous workflow

- Persistent assistant surface remains available in all contexts.
- AI can target selected object, current tab context, or global project scope.
- AI suggestions must always show impacted scope before apply.

### 6.3 Manual controls as optional

- Manual panes can remain hidden without blocking workflow completion.
- Discoverability remains strong but non-intrusive (no forced context switch).

---

## 7. Functional requirements

1. **F1 — AI command routing:** AI can invoke all write-capable operations currently reachable from manual controls (subject to policy).
2. **F2 — Patch normalization:** AI/manual both produce normalized patch envelopes with source attribution.
3. **F3 — Provenance parity:** `source: ai|manual` plus actor/context attached consistently.
4. **F4 — Diff-first apply:** Any non-trivial AI change shows diff summary before apply.
5. **F5 — Reversible actions:** Accepted changes are reversible through shared undo/patch history.
6. **F6 — Validation symmetry:** Same validation engine and severity model for both methods.
7. **F7 — Telemetry:** Track method usage by capability (`ai_only`, `manual_only`, `mixed`) and success/fallback paths.
8. **F8 — Accessibility:** Keyboard and screen-reader parity across AI and manual entry points.

---

## 8. User flows

### 8.1 AI-only author

1. User describes form intent and constraints.
2. Assistant proposes structured changes as patches.
3. User accepts/rejects/edits proposals.
4. User iterates on layout/mapping/evidence via AI commands only.
5. User exports/publishes without opening manual panes.

### 8.2 Mixed-mode author

1. User starts with AI scaffolding.
2. Opens a specific manual pane for precise edits.
3. Returns to AI for bulk restructuring.
4. Unified patch/provenance history remains coherent across both.

### 8.3 Manual-first author

1. User edits directly.
2. Uses AI for acceleration tasks (rewrite labels, normalize bindings, suggest mapping).
3. Same review pipeline applies.

---

## 9. Success metrics

### Primary

- % of projects completed with **AI-only** flow
- Capability parity coverage (% of matrix rows with production AI path)
- Median time to complete common authoring tasks (AI-only vs manual-only vs mixed)

### Secondary

- Fallback rate from AI to manual for same capability
- Patch rejection rate by source (`ai`, `manual`)
- Undo/revert frequency after AI apply (quality proxy)

---

## 10. Risks and mitigations

- **Risk:** AI path is broad but shallow, causing hidden dead-ends.  
  **Mitigation:** Matrix gating; no capability marked "done" without e2e parity test.

- **Risk:** Over-automation reduces trust.  
  **Mitigation:** Diff-first, rationale, explicit apply/rollback controls.

- **Risk:** Dual-path code drift.  
  **Mitigation:** Route both methods through shared mutation services and patch normalization layer.

---

## 11. Milestones

1. **M1 — Parity inventory (1 sprint):** Publish capability matrix + confidence scores + owners.
2. **M2 — Core parity baseline (2–3 sprints):** Metadata, field/group CRUD, bind/rules, patch lifecycle parity.
3. **M3 — Layout + mapping parity (2–3 sprints):** High-value layout/mapping actions fully AI-addressable.
4. **M4 — Evidence + advanced parity:** Citation linking, conflict handling, provenance-facing tooling.
5. **M5 — Language and UX cleanup:** Remove residual "assistant vs workspace" framing from product copy and flows.

---

## 12. Acceptance criteria

- No required user journey depends on a mandatory transition from "AI phase" to "manual phase."
- At least 80% of matrix capabilities have production AI paths with parity e2e tests.
- AI/manual changes land in the same patch/provenance/history structures.
- Usability tests confirm users can complete full authoring in AI-only mode without dead-ends.

---

## 13. Open questions

1. Which capabilities require mandatory human confirmation regardless of source?
2. Should AI be allowed to batch-cross domains (e.g., definition + layout + mapping) in one proposal by default?
3. What is the right default visibility for manual panes in an AI-first but unified shell?
