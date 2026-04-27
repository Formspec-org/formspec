# Studio Unified Feature Matrix

Source prototype: [`formspec-studio/project/directions/07-unified.html`](../../formspec-studio/project/directions/07-unified.html)

This matrix extracts the durable product model implied by the `07-unified.html` design-tool prototype. The prototype is not only a visual direction. It names the objects Studio needs to stop being "a form builder with chat attached": `Brief`, `Spec`, `LayoutDocument`, `PlaythroughSession`, `EvidenceDocument`, `FieldProvenance`, and `Patch`.

Ranking formula: `(importance + value) x debt if avoided`, each scored 1-5. Importance means architectural necessity for Studio's reference workflow. Value means user-visible leverage. Debt means retrofit cost if current Studio continues without the feature.

Related execution PRD: [`2026-04-25-prd-studio-first-run-onboarding.md`](./2026-04-25-prd-studio-first-run-onboarding.md)

## Ranked Matrix

| Rank | Feature | Score | Current Studio status | Why it matters | Done means |
|---:|---|---:|---|---|---|
| 1 | Field provenance spine | 50 | Mostly missing | AI-generated fields, uploaded-source fields, manual edits, and playthrough-driven edits all need durable origin, rationale, confidence, and source references. Without this spine, later evidence, review, and publish workflows have no trustworthy object to point at. | Every field and rule can expose origin, rationale, confidence, source refs, author, patch id, and last-confirmed status through project state and UI. |
| 2 | Layout documents as first-class artifacts | 50 | Partial | The prototype has named channel layouts (`Web full`, `Mobile stepper`, `Reviewer print summary`) with their own versions, placements, overrides, drift, and publish state. Current Studio has a Layout workspace, but not a durable multi-layout document model. | A project can own multiple layout documents, each with channel metadata, pages/screens, field placements, hidden fields, version history, and publish status. |
| 3 | Layout drift detection | 50 | Missing | When the spec changes, every layout becomes potentially stale. Avoiding drift tracking lets channel layouts silently omit new required fields or preserve obsolete copy. | Studio detects spec fields and rules changed since each layout base version, shows drift per layout, and requires place/hide/skip decisions before publish. |
| 4 | Evidence citation graph | 50 | Partial source upload only | Uploading PDFs/text is not enough. The prototype's Evidence surface ties extracted values to document spans, conflicts, missing fields, and redaction policy. Without citations, source-assisted generation is not review-grade. | Uploaded sources produce evidence records with document id, page/span selectors when available, extracted claim/value, confidence, redaction flags, and field/rule links. |
| 5 | Patch lifecycle as a durable object | 50 | Partial changesets | The prototype shows patches everywhere: banner, inspector mini-diff, playthrough suggestions, status bar. Current changesets are useful but do not yet serve as the shared lifecycle for AI, evidence, playthrough, layout, and publish changes. | Every AI/evidence/playthrough edit becomes a patch with id, scope, diff, rationale, affected objects, accept/reject/revert/discuss state, and history. |
| 6 | Layout override contract | 45 | Partial/missing | The prototype's layout inspector states the rule: spec is source of truth; layout overrides can soften, rephrase, hide, defer, redact, or swap widget, but cannot change validation or introduce data. This is the central seam between core data and respondent presentation. | Studio enforces a typed override model with allowed override keys, locked spec fields, UI diff table, validation that overrides cannot mutate spec semantics, and tests for forbidden overrides. |
| 7 | Evidence workbench | 45 | Missing | Evidence needs its own workflow: coverage, conflicts, missing fields, accept actions, document preview, and redaction rules. Treating evidence as only an onboarding input throws away the most valuable review surface. | Evidence tab lists documents, coverage/conflict/missing stats, field extraction rows, accept/reject actions, and a linked preview that highlights supporting snippets. |
| 8 | Spec surface as semantic data model | 45 | Partial | The prototype separates Spec from Layouts: semantic groups, field table, rule band, layout usage counts, and dense attribution mode. This keeps authors from confusing "what data exists" with "where it appears." | Editor has semantic groups independent of pages, field/rule rows with layout usage, confidence/origin columns, and copy/actions that consistently route layout decisions to Layouts. |
| 9 | Brief as a durable project object | 40 | Missing | The prototype's Brief surface is the intent anchor. If the brief disappears after first generation, later rationale and regeneration have no stable source. | Project stores brief text, examples/chips used, generation history, fields/rules traced to the brief, and an amend flow that proposes patches instead of overwriting silently. |
| 10 | Playthrough sessions | 40 | Missing | The prototype treats respondent testing as a first-class loop: persona, layout under test, device stage, answer log, reaction, AI suggestion, and patch. This is how Studio finds UX bugs that static validation cannot. | Studio can run or record a persona session against a layout, capture answers/reactions/friction, and emit scoped spec or layout patches. |
| 11 | Field/rule inspector rationale | 40 | Partial properties only | A field inspector that only edits properties does not answer the authoring question: why is this here and what depends on it? The prototype keeps rationale, context, call graph, patch history, and AI ask in one rail. | Selecting a field/rule shows rationale, id, kind, requiredness, origin, source refs, dependent rules, layout usage, patch history, and contextual AI ask. |
| 12 | Source/document preview with highlights | 40 | Missing | PDF upload without highlighted evidence keeps the user guessing. Highlighted snippets are the bridge from "AI says" to "source says." | Evidence preview renders source text/page thumbnails where available, highlights linked spans, supports redaction display, and jumps from field evidence rows to source location. |
| 13 | Multi-channel publish/version strip | 36 | Partial export only | The prototype distinguishes draft/live layout versions and publish actions. Studio needs this before layouts become artifacts consumed by portals, print exports, or reviewers. | Spec and layouts have draft/live version state, publish actions, changelog preview, status bar sync, and history entries. |
| 14 | Unplaced field bench | 36 | Partial | The prototype keeps unplaced fields visible per layout. This is the practical UI for drift resolution and multi-channel design. | Layout workspace has an always-visible per-layout unplaced bench with required/optional/drift markers and place/hide/skip actions. |
| 15 | Layout compare mode | 36 | Missing | Multi-channel layouts need a way to see what moved, what is hidden, and what differs. Compare prevents accidental divergence between desktop, mobile, and reviewer views. | Users can compare two layouts side-by-side with only-in-one, moved, hidden, and override differences highlighted. |
| 16 | Persona-driven AI fix suggestions | 36 | Missing | Playthrough value compounds when observed friction turns into reviewable patches. Otherwise playthrough becomes manual notes. | Playthrough session log can propose spec/layout patches with scope, rationale, and accept/reject/revert controls. |
| 17 | Dense attribution mode | 32 | Missing | Dense mode is the expert view for auditing AI, evidence, and manual edits quickly. It belongs behind a toggle, not in default chrome. | Spec table can toggle compact attribution/confidence/source columns without changing the underlying authoring model. |
| 18 | Global AI command palette | 32 | Partial | The prototype's command palette routes AI work across surfaces: add evidence requirement, simplify mobile, run playthrough. Current chat is useful but surface-local. | Command palette can target selected object/surface, list contextual AI commands, and create patches rather than direct mutations. |
| 19 | Logic surface | 28 | Partial | Rules/formulas need a focused view distinct from field properties. Current Studio has logic-related affordances, but not the prototype's rule-first surface. | Logic view lists form rules, field rules, formulas, dependencies, severity, origin, and affected fields/layouts. |
| 20 | Source view | 24 | Partial/missing | YAML/source view is useful for expert inspection and debugging, but lower priority than provenance and layout semantics. | Source view renders canonical project/spec/layout/evidence source with copy/export and source-to-object navigation. |
| 21 | Status telemetry bar | 24 | Partial | The prototype status bar reports spec validity, field/rule counts, persona pass rate, evidence autofill count, and latest patch. This is valuable once those objects exist. | Status bar summarizes validity, counts, layout drift, persona pass/fail, evidence coverage, and current patch state from real project state. |

## Execution Slices (current branch)

These slices map the matrix to concrete sequencing after first-run onboarding work began.

1. **Slice A — Onboarding foundation (active)**  
   Deliver gate, starter catalog, onboarding assistant shell, and Studio continuity. This creates the entry lane for later evidence/provenance/patch workflows.
2. **Slice B — Patch + provenance spine (next)**  
   Promote current changesets into durable `Patch` objects and attach `FieldProvenance` metadata to field/rule edits from AI/manual/evidence paths.
3. **Slice C — Layout documents + drift (next)**  
   Move from single-layout assumptions to `LayoutDocument` and drift resolution UX (`unplaced bench`, required decisions, publish guardrails).
4. **Slice D — Evidence graph + workbench**  
   Turn upload flow into `EvidenceDocument` and `EvidenceClaim` model with citations, conflicts, and redaction-aware preview.
5. **Slice E — Playthrough + brief loops**  
   Add durable `Brief` revisions and `PlaythroughSession` outputs as patch producers, never direct mutators. **Playthrough UI and `x-studio` session persistence are deferred** until after layout (Slice C) and evidence (Slice D) baselines; see [2026-04-26-prd-playthrough-deferred.md](./2026-04-26-prd-playthrough-deferred.md). Studio ships **no** playthrough shell tab until that work is scheduled.

## Near-Term Milestones (next 3)

### M1 — Finish onboarding foundation (Slice A)

- Complete replacement-confirmation safety and handoff bypass behavior.
- Land orientation accessibility parity (desktop + mobile + keyboard/screen-reader path).
- Add telemetry for first meaningful edit, completion, and starter selection.

Current status:

- M1 implementation scope is complete in-app: handoff bypass, replacement-confirmation safeguards, accessibility focus/label pass, and onboarding telemetry baseline.
- Telemetry includes `onboarding_viewed`, `onboarding_completed`, `onboarding_first_meaningful_edit`, `onboarding_starter_selected`, `onboarding_diagnostics_snapshot`, and `onboarding_enter_workspace_intent` (with `enterWorkspaceSource`).
- Assistant and `Shell` share header chrome, modal layer (`StudioWorkspaceModals`), and keyboard policy (Escape stack + `ASSISTANT_KEYBOARD_WORKSPACE` for safe Delete routing); assistant status bar uses a reduced footer until entering the tabbed workspace.
- Remaining work is post-M1 QA/analytics hardening (expanded deployment-mode e2e and telemetry sink/dashboard integration).

Exit criteria:

- Onboarding PRD checklist section 16 is complete for gate, UX, provider-mode correctness, and telemetry baseline.

### M2 — Patch + provenance spine (Slice B)

- Introduce durable `Patch` identity and lifecycle beyond transient changesets.
- Attach `FieldProvenance` metadata for AI/manual edits at field/rule granularity.
- Expose provenance in inspector/status primitives and keep patch review as the shared boundary.

Current status:

- Completed by extending existing `x-studio` intelligence primitives instead of replacing them.
- `Patch` lifecycle now persists beyond transient changesets (open → accepted/rejected) via durable extension records.
- AI accept/reject paths persist patch records and attach AI provenance; manual inspector edits persist manual patch/provenance records.
- Inspector and status surfaces now expose provenance and open patch state directly.
- Test coverage includes writer upsert semantics, AI open/accept/reject lifecycle persistence, and manual provenance recording through inspector edits.

Exit criteria:

- Ranked items 1 and 5 are at functional baseline in Studio (`FieldProvenance` and `Patch` persisted, surfaced, and lifecycle-tested).

### M3 — Layout documents + drift baseline (Slice C)

- Promote layouts to first-class `LayoutDocument` objects (multi-layout aware project state).
- Implement drift detection against `baseSpecVersion` with explicit decision states.
- Add unplaced-field bench and publish guardrails tied to unresolved drift.

Exit criteria:

- Ranked items 2, 3, and 14 have working baseline behavior and test coverage.

## Pull-Forward Order

1. Build the shared spine first: `FieldProvenance`, `Patch`, and source refs. This makes every later surface review-grade instead of decorative.
2. Promote layouts into durable `LayoutDocument` artifacts with override contracts and drift tracking. This prevents current layout work from hardening around a single-layout assumption.
3. Promote uploads into an `EvidenceDocument` graph with citations, conflicts, missing coverage, and redaction metadata. This turns the new onboarding upload path into a real evidence workflow.
4. Add the author-facing surfaces that consume those objects: semantic Spec table, Evidence workbench, Layout drift/compare, and Inspector rationale.
5. Add Brief and Playthrough as product loops once patches and provenance can absorb their output.

## Product Model Implied By The Prototype

| Object | Purpose | Minimum fields |
|---|---|---|
| `Brief` | Durable intent source for generation and later amendments. | `id`, `text`, `createdBy`, `createdAt`, `revision`, `derivedObjectRefs`, `patchRefs` |
| `FieldProvenance` | Explains why a field/rule exists and what supports it. | `objectRef`, `origin`, `rationale`, `confidence`, `sourceRefs`, `author`, `patchRefs`, `reviewStatus` |
| `EvidenceDocument` | Uploaded source with extractable claims and review policy. | `id`, `name`, `mimeType`, `hash`, `text`, `pageRefs`, `redactionPolicy`, `extractions`, `conflicts` |
| `EvidenceClaim` | A document-backed value or requirement candidate. | `id`, `documentRef`, `spanRef`, `fieldRef`, `value`, `confidence`, `status`, `patchRef` |
| `LayoutDocument` | Channel-specific arrangement of one spec. | `id`, `name`, `channel`, `baseSpecVersion`, `pages`, `placements`, `overrides`, `hiddenFields`, `version`, `publishStatus` |
| `LayoutOverride` | Presentation-only field/layout difference. | `fieldRef`, `layoutRef`, `label`, `help`, `widget`, `hidden`, `defer`, `redact`, `requiredDisplay`, `reason` |
| `LayoutDrift` | Required decision when spec changes after layout edit. | `layoutRef`, `baseSpecVersion`, `changedObjectRef`, `changeKind`, `requiredDecision`, `decisionStatus` |
| `PlaythroughSession` | Persona run against a layout that can generate patches. | `id`, `persona`, `layoutRef`, `answers`, `reactions`, `events`, `suggestedPatchRefs`, `passStatus` |
| `Patch` | Reviewable unit of AI/manual/evidence/playthrough change. | `id`, `source`, `scope`, `summary`, `diff`, `rationale`, `affectedRefs`, `status`, `createdAt`, `appliedAt`, `revertOf` |

## Explicit Non-Goals

- Do not implement evidence upload as "file attached to chat" only. That path is useful for first-run onboarding, but it does not preserve review-grade citations.
- Do not add more layout UI on top of an implicit single layout. The first architectural move is the `LayoutDocument` model.
- Do not let layout overrides mutate validation, calculation, or data shape. Layouts present and route spec data; they do not redefine it.
- Do not make Brief or Playthrough produce direct mutations. They produce patches because patches are the review boundary.
