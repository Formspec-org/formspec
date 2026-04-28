# FlowSpec Absorption Landing Plan

**Date:** 2026-04-27
**Status:** Ready to execute
**Scope:** PLANNING.md hygiene + FlowSpec disposition absorption row landings + row-quality cleanup
**Predecessor work:** ADR 0081 + PLN-0358..0364 (content-addressing) + PLN-0347/0348/0349 (FlowSpec disposition initial sweep) all already landed.

## Goal

Close the FlowSpec counter-proposal absorption with cross-stack-coherent tracking. Three audit passes (formspec-scout, wos-scout, cross-stack-scout) plus a hygiene audit identified blockers, ID collisions, and row-quality issues. This plan executes all of them in one atomic pass.

## Source-of-truth references

- `wos-spec/counter-proposal.md`, `counter-proposal-extra.md`, `counter-proposal-disposition.md` — original absorption work.
- `thoughts/adr/0074-formspec-native-field-level-transparency.md` — access-class + Privacy Profile primitive (load-bearing for PLN-0371).
- `thoughts/adr/0080-governed-output-commit-pipeline.md` — D-3 names `taskActions` / `editableFields` / reveal-on-action without schematizing them (PLN-0373's job).
- `thoughts/adr/0081-content-addressed-artifact-identity.md` — JCS-then-SHA-256, three-segment `*Ref` syntax (PLN-0375 + PLN-0376 close cross-stack gaps).
- `wos-spec/specs/kernel/spec.md` §5.4 L444 — existing `caseFileSnapshot.jcsCanonical` + `sha256` precedent.
- `wos-spec/specs/governance/workflow-governance.md` §10.4 L514 — `EscalationStep.id` precedent template.
- `wos-spec/specs/ai/ai-integration.md` L342, L536 — `assistive` autonomy + `independentFirst` interaction constraints.
- `thoughts/adr/0075-rejection-register.md:31` — SCXML/Harel-derived JSON statechart lineage citation; load-bearing for PLN-0377 (the lineage stays; the framing reopens around property-graph dual projection).
- `wos-spec/wos-ontology-alignment.schema.json` — existing sidecar carrying JSON-LD `@context` + SHACL shapes + PROV-O / XES / OCEL export; PLN-0377 absorbs the `@context` upward into kernel core, leaves SHACL / export logic in the sidecar.

## Architectural principle (load-bearing)

Every absorbed FlowSpec idea lands as a coherence rule / lowering layer / `$defs` pin over an existing primitive — **never as a parallel mechanism.** The pattern that fixed H1 fixes everything:

- PLN-0371 = coherence lint over ADR-0074 audiences (not new role-auth)
- PLN-0372 = `id?` for tooling/anchoring (not new audit; `caseFileSnapshot` covers)
- PLN-0373 = canonical task-shape lowering to Formspec binds (not parallel visibility)
- PLN-0374 = token-space cleanup so each token has one meaning (not new tokens)
- PLN-0375 = three-segment `definitionRef` extension (same ADR 0081 pattern)
- PLN-0376 = Trellis event-type registration (existing custodyHook pattern)
- PLN-0377 = property-graph dual projection + node-vs-edge reification rule (substrate-and-rule reframe over the existing kernel statechart; subsumes the disposition's flat-graph reject and X33 reject by accepting the underlying instinct and adding the rule FlowSpec lacked)

Greenfield permission ("don't worry about legacy whatever, just deliver best value") makes the cleanup maximally clean instead of compromise-stacked.

---

## Phase A — Critical hygiene (must precede Phase B)

### A1. Renumber 6 PLN ID collisions

**Why:** ID collisions in PLANNING.md from rows added across two sessions on 2026-04-27. Cross-references break if not done atomically with new row landings.

**Mapping** (gov/stack rows shift; FlowSpec absorption rows keep their original IDs):

| Old ID | Old content | New ID |
|---|---|---|
| PLN-0347 | cross-submodule Cargo path-dep | **PLN-0368** |
| PLN-0348 | per-tenant Postgres decision | **PLN-0369** |
| PLN-0349 | marketing-claim reframe | **PLN-0370** |
| PLN-0358 | single-tenant policy | **PLN-0365** |
| PLN-0359 | multi-tenant authz policy | **PLN-0366** |
| PLN-0360 | Cargo feature bundles | **PLN-0367** |

**FlowSpec disposition rows that keep IDs:** PLN-0347 (escalationLevels ADR), PLN-0348 (escalationLevels conformance), PLN-0349 (JSON Schema 2020-12). Content-addressing rows that keep IDs: PLN-0358..0364.

**Action:** for each shifted ID, update the row's leading cell. No content changes.

**Acceptance:** `grep -c "^| PLN-034[789]\|^| PLN-035[89]\|^| PLN-0360" PLANNING.md` returns one row per ID.

### A2. Fix PLN-0049 duplicate

**Why:** Two PLN-0049 rows exist — Done stub at line 388 (accidentally added) and original Open row at line 389 (the canonical row, now needs to be Done/Merged).

**Action:** Delete the duplicate Done stub at line 388. Edit the original PLN-0049 in the Semantic table at line 389 to be the canonical Done/Merged row.

**Acceptance:** `grep -c "^| PLN-0049" PLANNING.md` returns 1.

### A3. Update cross-references to renumbered rows

**Why:** A1 renumbering breaks any row whose dep / source / done-evidence cell cited the old IDs.

**Action:** For each renumbered ID (PLN-0347 → 0368, PLN-0348 → 0369, PLN-0349 → 0370, PLN-0358 → 0365, PLN-0359 → 0366, PLN-0360 → 0367), grep PLANNING.md and update every reference. Specific rows + sites known to cite renumbered rows:

- **Cluster headers:** narrative paragraphs at lines 11-15 + MVP foundation cluster paragraph + standalone cluster bullet at L76 (`**PLN-0347..0349** — Architectural-decision rows…`).
- **Deps cells:** PLN-0334 deps, PLN-0339 deps, PLN-0332 deps (cites `PLN-0347 (path-dep resolution)`).
- **Body refs:** PLN-0332 body sentence "**Cross-submodule path-dep blocker:** see PLN-0347."; PLN-0334 body cites policy-artifact `(PLN-0358, PLN-0359)`.
- **Trigger-table sweep — HIGH-RISK SEMANTIC COLLISION:** PLN-0355 (L439) + PLN-0356 (L440) deps cite "PLN-0349 (marketing reframe)". Post-renumbering PLN-0349 becomes the **JSON Schema 2020-12 discriminator** row — these triggers will silently rebind to the wrong row. Update to `PLN-0370 (marketing reframe)`. **Sweep every row in the Trigger table (L430-446) for old-ID citations**, not just these two.

**Acceptance:** `grep -nE "PLN-(0347|0348|0349)" PLANNING.md` shows only the FlowSpec disposition rows; no stale cross-references to the gov/stack rows under the old IDs. Trigger-table sweep verified row-by-row.

### A4. Update cluster headers

**Why:** Workflow-consolidation cluster header at lines 11-15 enumerates PLN ranges but doesn't reference PLN-0358..0364 (content-addressing) or the renumbered PLN-0365..0370 (post-A1).

**Action:** Edit the cluster headers to enumerate:
- Workflow-consolidation cluster: include PLN-0358..0364 as the content-addressing sub-cluster.
- MVP foundation cluster: enumerate PLN-0365..0370 (post-renumbering) as the gov/stack rows.

**Acceptance:** Reading the cluster headers reveals every active row's home; no orphan PLN range.

---

## Phase B — Land FlowSpec absorption rows

Each row below lands at the indicated PLN ID, after Phase A completes. Insertion point: after PLN-0364 (last content-addressing row), before PLN-0268 (existing seam-naming lint candidate).

### B1. PLN-0371 (P1) — H1 coherence lint

**Row text:**

> `WOS, CI, Conformance` | H1 coherence lint between human-task `formSections` (PLN-0373) and ADR-0074 access-class audiences. Every field referenced in a task's `formSections` MUST have at least one access class whose audience (per the deployment's Privacy Profile) includes the assignee role. Lint at authoring (catches task definitions whose visibility promises exceed access-class audiences); runtime gate (catches deployment-time Privacy Profile changes that broke a previously-valid task). **Profile-less posture (per ADR-0074 §2 L87 "Conformance without Privacy Profile" precedent):** when no Privacy Profile is loaded, the lint is vacuously satisfied; emits an `info` diagnostic noting "no Profile loaded; H1 coherence not enforced." NOT a new role-authorization primitive — derives entirely from ADR-0074's class+audience mapping. | Deps: PLN-0373 (task-shape `$defs` for `formSections`), ADR-0074 ratified `accessControl` + Privacy Profile. | Source: ADR-0074, FlowSpec disposition H1. | Source pointer: `wos-spec/counter-proposal-disposition.md` §3.4 / §7.2 H1; `thoughts/adr/0074-formspec-native-field-level-transparency.md` §1, §2 (L87 "Conformance without Privacy Profile"), §3. | Done evidence: Lint registered; positive fixture (audience reaches assignee role); negative fixture (task references field whose classes' audiences exclude assignee role — fails); Profile-less fixture (info diagnostic emitted, lint passes).

### B2. PLN-0372 (P1) — Transition `id?` REQUIRED on `determination` transitions

**Row text:**

> `WOS, Schema Additions` | Add `id?` (OPTIONAL string, pattern `^[a-zA-Z][a-zA-Z0-9_-]*$`) to `Transition` $def in `wos-kernel.schema.json`. Make `id` REQUIRED on transitions carrying `tags: ["determination"]`. Mirrors `EscalationStep.id` precedent (`workflow-governance.md:514`). NOT for audit — `caseFileSnapshot` (Kernel §5.4 L444) binds determinations by transition-firing-timestamp + canonical state hash. NOT for routine governance binding — tags are the default attachment surface (`workflow-governance.md:51,186`); transition `id` is the fallback override per Kernel §10.4 L600 ("when tag-based governance is not specific enough"). FOR: tooling stable references (visualizers, lint diagnostics, debugger anchors), author ergonomics, L3 cross-document anchors that exceed tag-set granularity, ADR 0081 hash-pinned (id, version, hash) tuple resolvability down to specific transitions. Greenfield enforcement at `determination` tier converts author goodwill into schema invariant. | Deps: None. | Source: FlowSpec disposition S2 + wos-scout reframing 2026-04-27. | Source pointer: `wos-spec/counter-proposal-disposition.md` §3.6 S2 row; conversation 2026-04-27 wos-scout findings. | Done evidence: Schema/prose updated; pattern matches `EscalationStep.id`; `additionalProperties: false` discipline preserved; positive fixture (determination with `id`) + negative fixture (determination without `id` rejected) + neutral fixture (non-determination without `id` accepted) all pass.

### B3. PLN-0373 (P0) — Task-shape canonical authoring path

**Row text:**

> `WOS, Schema Additions` | Pin task-shape `$defs` for surfaces ADR-0080 D-3 names but doesn't schematize: `formSections`, `readOnlyFields` / `editableFields`, structured `actions[]` with `fieldBinding`/`fieldValue`/`confirm`, reveal-on-action `additionalFormSections` + `requiredFields`. **Tier:** kernel `lifecycle.states[*]` task substates (Kernel §5), NOT `TaskPattern` in Governance §9 — task surfaces live in kernel state shape per ADR 0080 D-3:75. **Scope:** human task substates only — agent capability surface (`agents[*].capabilities[*]`) is parallel and bound separately under deontic constraints (`ai-integration.md:154-159, 199-269`). **Authoring model:** these `$defs` are the canonical authoring path; the processor expands them to underlying Formspec binds at runtime. Authors do not see two paths. **Lowering rules:** (a) `readOnlyFields` is a task-scoped overlay over Formspec `readonly` bind (Core §369); (b) reveal-on-action `additionalFormSections` is lowered to a `relevant` bind on a task-scoped state variable (Core §367); (c) `editableFields` is the author-side input deriving ADR-0080 `writeScope` (D-6 L110 — `writeScope` is the surface-specific write-scope rule, not the D-3 attachment-points table); (d) `formSections` is a slice/projection over Formspec items by item path, not a parallel grouping primitive; (e) `confirm` is workflow-scoped (no Formspec analog). **Interactions:** must compose with `assistive` autonomy (which MUST create a confirm-task per `ai-integration.md:342` — declare what populates that confirm-task's surface); compose with `independentFirst` review protocol (`ai-integration.md:536` — agent output MUST be hidden until reviewer assessment recorded; new lint candidate); declare actions ≠ deontic gates (deontic prohibitions fire post-output, not at action invocation, per `ai-integration.md:199-269`). **Runtime carriage:** extend `wos-core/traits/mod.rs` `TaskPresenter` trait + `FormspecTaskContext` with a `formSections` field so wos-server can emit it via Socket.IO `task:assigned` payload (`wos-server/runtime/presenter.rs:46-53`). | Deps: None — defines the substrate that PLN-0371 layers on. | Source: FlowSpec disposition G1 (synthesized from §3.4 ADOPT cluster); ADR 0080 D-3; cross-stack-scout findings 2026-04-27. | Source pointer: `wos-spec/counter-proposal-disposition.md` §3.4 ADOPT cluster; `thoughts/adr/0080-governed-output-commit-pipeline.md` D-3 (schema-attachment-points table, L67-83) + D-6 (`writeScope` write-scope rule, L107-115). | Done evidence: Schema/prose updated on kernel state task substate $defs; five lowering-rule clauses present in normative prose; `TaskPresenter` trait + `FormspecTaskContext` carry `formSections`; positive fixtures for each surface; negative fixture for human-only scope (agent capability rejected if it tries the human surface); negative fixture for `independentFirst` ordering violation; negative fixture for action-as-deontic-gate misuse.

### B4. PLN-0374 (P0) — Token-space refactor + PLN-0347 fold-ins

**Row text:**

> `WOS, ADR/spec, Schema` | **Token-space refactor (greenfield):** rename across the spec so each token has exactly one meaning. (1) `BreachPolicy.action: "escalate"` → `"advanceChain"` (`workflow-governance.md:500`); (2) `EscalationStep.onExhaustion: "escalate"` → `"advanceChain"` (`workflow-governance.md:514`); (3) AI fallback + (4) deontic-violation enforcement `escalateToHuman` → `createHumanTask` across `ai-integration.md` (known sites L211, L223, L259, L313, L314, L443, L493, L500 — but rename **every** literal occurrence; discovery rule is authoritative, not the line list); (5) hold `timeoutAction: "escalate"` → `"advanceChain"` (`workflow-governance.md:623`); (6) reserve task-action `id: "escalate"` for user-initiated chain advance — single canonical home (bare-name namespace per `workflow-governance.md:452`, NOT `$`-prefixed kernel-event namespace). After refactor: `escalate` = exactly one meaning (user-initiated chain advance via task action); `advanceChain` = chain-advance triggered by SLA breach / exhaustion / hold timeout (three triggers, one action); `createHumanTask` = fallback / deontic outcome that creates a new task (two triggers, one action). **PLN-0347 fold-in H6 — when NOT to use escalation:** authoring guidance prose. Substantively different form sections / actions / routing across reviewer levels → use separate human nodes, not a collapsed `escalationLevels` chain. **PLN-0347 fold-in S5 — conditional `transitionTags` (option C):** routine SLA-driven escalation carries `transitionTags: ["escalation"]` only — NOT a determination, no delegation enforcement on the new `assignTo`. Cross-assurance-level escalation (assignee crosses an `assurance` boundary, e.g., caseworker → supervisor with stronger attestation per `assurance.md:107`) carries `transitionTags: ["determination", "escalation"]` — delegation enforcement applies (`workflow-governance.md:575,577`), assurance attestation chain step required. Boundary check is lint-decidable from document-level `assurance` block config — no runtime actor lookup needed. **Tier scope statement:** `escalationLevels` (task-routing presentation-shape) is distinct from Governance §11 delegation (legal-authority statutory transfer); the two compose but are not the same primitive. **Provenance shape:** S5 reuses existing `stateTransition` recordKind with the conditional tags above + `data: { fromLevel, toLevel, reason }`. NOT a new `recordKind` reservation. **Rust internal rename (discovery-rule, not line-list — line numbers drift):** rename every `requires_escalation` identifier → `requires_human_task` and every `EscalateToHuman` enum variant → `CreateHumanTask` across `wos-spec/crates/wos-core/src/` (known surfaces span at least `confidence.rs`, `event_handler.rs`, `proxy.rs`, `model/ai.rs`, `deontic.rs` — but treat the grep below as authoritative). Done-evidence check: `grep -rn 'requires_escalation\|EscalateToHuman' wos-spec/crates/wos-core/src/` MUST return zero post-migration. | Deps: PLN-0347 (parent escalationLevels ADR); ADR 0080 D-5 reservation pattern; `assurance.md:107` attestation contract. | Source: FlowSpec disposition X34, H6, H7, S5 + wos-scout findings 2026-04-27 + greenfield refactor permission. | Source pointer: `wos-spec/counter-proposal-disposition.md` §3.4 ADAPT rows; `wos-spec/counter-proposal.md` §3.4.2; `wos-spec/counter-proposal-extra.md` X34. | Done evidence: All five enum literals renamed in `wos-workflow-governance.schema.json`, `wos-ai-integration.schema.json`, `wos-kernel.schema.json` (hold timeoutAction); spec-prose rename verified by `grep -rn 'escalateToHuman' wos-spec/specs/` returning zero post-migration; Rust `FallbackAction::EscalateToHuman` → `CreateHumanTask` migration verified by `grep -rn 'requires_escalation\|EscalateToHuman' wos-spec/crates/wos-core/src/` returning zero; lint matrix migrated; `requestEscalation` / `escalate` reserved id documented; conditional-tag rule encoded in conformance fixture (one routine-escalation case + one cross-assurance-level case, asserting delegation enforcement fires only on the latter); cross-assurance-level rung pinned in normative prose.

### B5. PLN-0375 (P0) — IntakeHandoff `definitionRef` three-segment extension

**Row text:**

> `Formspec, WOS, Schema Additions` | Extend `schemas/intake-handoff.schema.json` `definitionRef` shape from `{url, version}` to optionally carry `sha256` (per ADR-0081 D-2 three-segment alignment). Without this, PLN-0371's H1 coherence lint resolves `formSections` against unpinned definitions — defeating ADR 0081's verifiability claim. ADR 0073 D-5 already references `responseHash` but no definition hash; this row closes the parallel gap. Optional at L0; MUST when the source workflow's `impactLevel` is `rightsImpacting`. Cross-stack: Formspec emits the hash when the IntakeHandoff is generated; WOS validates on receipt. | Deps: PLN-0359 (three-segment `*Ref` syntax in `wos-workflow.schema.json`); ADR 0073 IntakeHandoff path. | Source: cross-stack-scout findings 2026-04-27; ADR 0081 D-2. | Source pointer: `schemas/intake-handoff.schema.json:105`; `thoughts/adr/0073-stack-case-initiation-and-intake-handoff.md:84-97`; `thoughts/adr/0081-content-addressed-artifact-identity.md:80-84`. | Done evidence: Schema updated; positive fixture (rights-impacting workflow with hash-pinned `definitionRef` round-trips); negative fixture (rights-impacting workflow without hash rejected); backward-compatibility fixture (non-rights-impacting two-segment ref still valid).

### B6. PLN-0376 (P0) — Trellis definition-hash event-type registration

**Row text:**

> `Stack, WOS, Trellis, ADR/spec` | Register definition-hash carriage event type in Trellis. ADR 0081 D-6 says definition hashes flow through `custodyHook` "per ADR 0072's evidence integrity pattern" — but ADR 0072's `EvidenceAttachmentBinding` is per-attachment with `attachment_sha256` + `payload_content_hash` dual; definition-hash anchoring is a different shape. **Decision:** either reuse `EvidenceAttachmentBinding` semantics with a definition-class binding (single shape, broader scope) OR register `trellis.definition-hash-binding.v1` as a separate Trellis event type (cleaner type discrimination, more code). Lean: separate event type — definitions and evidence are semantically distinct artifact classes. Coordinate with Trellis-side team to add the registration; without this, ADR 0081 D-6 anchoring is paper-only and the audit-trail integrity claim is unimplementable at the Trellis boundary. | Deps: PLN-0358 (ADR 0081 ratified); PLN-0360 (Trellis custody integration coordination row); Trellis-side coordination on event-type registration. | Source: cross-stack-scout findings 2026-04-27; ADR 0081 D-6; ADR 0072 evidence pattern. | Source pointer: `thoughts/adr/0081-content-addressed-artifact-identity.md:80-84`; `thoughts/adr/0072-stack-evidence-integrity-and-attachment-binding.md:188-202`; `trellis/specs/` (event-type registration site). | Done evidence: Trellis event type registered (whichever choice); WOS emits definition-hash binding event on `caseCreated` and `determination` records; round-trip anchoring fixture passes; cross-stack three-way agreement (WOS spec + Trellis verifier + reference adapter) holds.

### B7. PLN-0377 (P0) — Kernel-as-property-graph + node-vs-edge reification rule

**Row text:**

> `WOS, ADR/spec, Schema` | **Kernel as property graph + node-vs-edge reification rule.** Two FlowSpec rejects (flat node-graph topology; X33 conditional-routing heuristic) currently sit in `wos-spec/counter-proposal-disposition.md`. Both collapse into one ADR that accepts the underlying instinct — *the kernel IS a property graph; hierarchy is one presentation of an underlying triple set* — and adds what FlowSpec lacked: a rule for when a relationship promotes to a node. **§1 Substrate.** Kernel statechart is a property graph. Hierarchical JSON is a JSON-LD frame projection. JSON-LD `@graph` is the canonical wire form. Existing `wos-ontology-alignment` sidecar's `@context` collapses upward into kernel core; SHACL / PROV-O / XES / OCEL export logic stays in the sidecar. **§2 Round-trip canonicalization.** Byte-stable hierarchical JSON ↔ JSON-LD `@graph` ↔ hierarchical JSON. URDNA2015 for blank-node naming. `@list` containers preserve ordered action sequences (entry / exit / transition). Deterministic IRI minting from authored state names. Canonical frame document published in `wos-spec/specs/kernel/` for unambiguous reverse projection. **§3 Reification rule.** *Promote a relationship to a node when it carries typed properties beyond the relationship itself.* Three applied examples: (a) **routing branches (X33 collapses here):** branch with multiple typed properties differing from siblings — per-branch governance tags, assurance level, deontic constraints, escalation policy, lifecycle hooks — reify as compound substate; branch differing only by guard predicate plus single tag — keep as guarded transition. (b) **actors:** multi-attribute actor (role + deontic constraints + autonomy cap + identity verification) — typed node; edge participant only — edge property. (c) **evidence attachments:** attachment with verification metadata — typed node; opaque payload — edge property. **§4 Ambiguous-frame negative cases.** Frames that cannot deterministically resolve hierarchy from triples produce lint errors with stable diagnostics, not silent re-pickings. **NOT a rewrite of kernel §4 prose** — additive ADR. Existing §-numbered citations stay valid. Hierarchical view remains the human-reading default; the property-graph form is the machine-reasoning surface (free SHACL validation, SPARQL queryability, OWL entailment over governance-tag inheritance). **Replaces:** flat-graph reject + X33 reject in `wos-spec/counter-proposal-disposition.md` (rows annotated *superseded by ADR-NNNN*); SCXML/Harel-derived JSON statechart lineage in `thoughts/adr/0075-rejection-register.md:31` reframes around dual projection (lineage retained, framing reopened). | Deps: ADR 0078 (foreach state — must round-trip cleanly in property-graph form); existing `wos-ontology-alignment` sidecar (`@context` absorbs upward); PLN-0373 (task-shape `$defs` must reify cleanly under §3 rule). | Source: conversation 2026-04-27 cross-stack design pass on flat-graph + X33 reframing. | Source pointer: `wos-spec/counter-proposal-disposition.md` flat-graph rows (architectural-posture section) + §3.6 X33 row; `wos-spec/wos-ontology-alignment.schema.json`; `thoughts/adr/0075-rejection-register.md:31`. | Done evidence: ADR ratified covering §1 substrate + §2 canonicalization + §3 reification rule with three applied examples + §4 ambiguous-frame discipline; canonical `@context` and frame documents published under `wos-spec/specs/kernel/`; three-way conformance fixture proves byte-stable round-trip on at least three workflow shapes (atomic-only, compound + guards, parallel + foreach + history); negative fixtures for ambiguous frames produce stable lint diagnostics; ADR 0075 reject register entry rewritten to point at the new ADR for flat-graph and X33 disposition; disposition §3.x flat-graph rows + §3.6 X33 row annotated *superseded by ADR-NNNN* with backreference; SHACL shape exists for at least one governance invariant currently expressed only as English-prose-plus-lint, demonstrating the machine-verification win.

### B-acceptance (whole phase)

After Phase B completes:
- All 7 rows present at PLN-0371..0377.
- Cross-references between rows resolve: PLN-0371 cites PLN-0373 (task shape) and ADR-0074; PLN-0375 cites PLN-0359 (renumbered three-segment ref); PLN-0376 cites PLN-0358 + PLN-0360 (renumbered Trellis coordination).
- **Disposition coverage report (externalized — not inline accounting):** every ADOPT/ADAPT row in `wos-spec/counter-proposal-disposition.md` (claim count: 25 + 8) maps to either a PLANNING.md tracking row OR a landed spec citation (e.g., `outcomeCode` at `kernel/spec.md:156`, ADR 0075 reject-prose register). Coverage mapping is appended to the Phase B commit message as a `disposition-id → PLN-id | landed at file:line` table; not inlined here to avoid doubling plan size for an audit re-runnable against the source disposition document.

---

## Phase C — Row-quality cleanup (audit findings)

Mechanical, no architectural decisions needed. Same-pass execution recommended (cheaper than separate audit-fix cycle).

### C1. Split PLN-0036 along normative-doc-edits / counter-proposal-artifact-edits axis

**Why:** 10-bullet umbrella exceeds the 7–8 sustainability threshold in row maintenance.

**Action:** Split PLN-0036 into PLN-0036a (or rename to PLN-0036, keeping bullets a–e: normative-doc edits) and a new sibling row (next available ID, post-Phase B = PLN-0378) for bullets f–j (counter-proposal-artifact edits). Cross-link the two rows via deps.

**Acceptance:** Each row carries ≤8 sub-bullets; both rows trace back to the same source pointer.

### C2. Tighten PLN-0140 lead

**Why:** Generic "compounds debt" framing applies to any missing CI gate; not load-bearing on the row's specific content.

**Action:** Replace the generic lead with the specific compounding mechanism for PLN-0140's actual concern (whatever it is — read the row, identify the specific compounding mechanism, replace the generic phrase).

**Acceptance:** Reading PLN-0140's lead reveals what specifically compounds, not a generic claim.

### C3. Tighten PLN-0047 causal chain

**Why:** Value-lead causal chain is loose ("lawyer doesn't get fired" is downstream of silent provenance drift; the actual concern is the upstream drift).

**Action:** Reframe the lead from the downstream consequence to the upstream causal mechanism (silent provenance drift causing audit-trail incoherence).

**Acceptance:** Lead names the mechanism, not the consequence.

### C4. Dedupe PLN-0339 dep range

**Why:** Range "PLN-0331 through PLN-0338, PLN-0345, PLN-0358, PLN-0359" — PLN-0334 transitively depends on PLN-0358/0359, so listing both 0334 and 0358/0359 is redundant.

**Action:** Drop PLN-0358/0359 from PLN-0339's dep cell; keep PLN-0334 (transitive coverage).

**Acceptance:** PLN-0339's deps cell carries no transitively-redundant references.

---

## Verification checklist

After all three phases complete:

- [ ] `grep -oE "^\| PLN-[0-9]{4}" PLANNING.md | sort | uniq -d` returns empty (no duplicate IDs).
- [ ] Phase A renumbering: `grep -nE "PLN-(0347|0348|0349|0358|0359|0360)" PLANNING.md` shows each ID exactly once.
- [ ] Phase B rows: `grep -nE "^\| PLN-037[1-7]" PLANNING.md` shows 7 rows.
- [ ] PLN-0049: `grep -c "^\| PLN-0049" PLANNING.md` returns 1.
- [ ] Cluster headers reference PLN-0358..0364 (content-addressing) and PLN-0365..0370 (renumbered gov/stack).
- [ ] No row's deps cell cites a renumbered old ID.
- [ ] PLN-0036 is split (≤8 bullets per row).
- [ ] PLN-0140 / PLN-0047 leads are tightened.
- [ ] PLN-0339 dep range deduped.

## Out of scope (deferred / not in this plan)

- **Spec-side implementation of Phase B rows.** This plan opens the tracking rows; actual schema edits, lint registration, conformance fixtures land in subsequent commits per each row's done-evidence criteria.
- **Studio assistant workspace `formSections`-shaped task UI.** cross-stack-scout flagged it as MAJOR but it belongs in `packages/formspec-studio/` TODOs, not PLANNING.
- **G2/G3 reuse-detection lints, S3 transform-vs-calculate heuristic.** Deferred per critical re-pass — no authoring-pain signal.
- **PLN-0036 sub-row's actual implementation** — Phase C1 splits the row; landing the implementation is separate.

## Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Phase A renumbering misses a cross-reference | Medium | Verification checklist's first three items catch it. |
| PLN-0376 Trellis coordination stalls (cross-repo) | Medium | Lean toward separate event-type registration so WOS-side schema is unblocked even if Trellis registration lags. |
| Phase C tightenings introduce unintended semantic changes | Low | Each tightening is mechanical (one phrase swap); diff review catches drift. |
| Greenfield refactor (PLN-0374) breaks downstream code I haven't found | Low–Medium | Greenfield project (no users); rebuild costs are dev/code/time, which are cheap per economic model. |
| PLN-0377 property-graph reframe is larger architectural shift than other rows (substrate-level, not coherence-rule-level) | Medium | Additive ADR (existing §-numbered prose stays valid); hierarchical view remains human-reading default; round-trip conformance fixture is the gate — if byte-stable round-trip fails on a real workflow shape, the reframe doesn't ship. Greenfield economics absorb the rebuild cost if a downstream consumer of the existing hierarchical-only form needs migration. |

## Rollout

Single atomic pass. Phases A → B → C in order. Total touch surface: PLANNING.md (renumbering + 7 row additions + 4 cleanups) + verification grep. Estimated diff: ~32 line changes, ~7 new rows.

**Commit message convention:** Per repo `feat:` / `fix:` / `docs:` prefixes. This pass is `docs(planning): land FlowSpec absorption + ID hygiene`.
