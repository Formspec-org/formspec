# ADR 0078: WOS Kernel `foreach` Topology

**Status:** Proposed
**Date:** 2026-04-24
**Scope:** WOS Kernel
**Related:** [ADR 0073 (case initiation and intake handoff)](./0073-stack-case-initiation-and-intake-handoff.md); [ADR 0080 (governed output-commit pipeline)](./0080-governed-output-commit-pipeline.md); [ADR 0076 (product-tier consolidation)](./0076-product-tier-consolidation.md); [ADR 0077 (canonical kernel extension seams)](./0077-canonical-kernel-extension-seams.md); [`wos-spec/specs/kernel/spec.md`](../../wos-spec/specs/kernel/spec.md) §4.3, §4.4, §4.8; [`wos-spec/counter-proposal-disposition.md`](../../wos-spec/counter-proposal-disposition.md) Wave 5 / FlowSpec §3.9 absorption; [`wos-spec/schemas/kernel/wos-kernel.schema.json`](../../wos-spec/schemas/kernel/wos-kernel.schema.json) `$defs/State`

## Context

Kernel §4.3 enumerates four state topology kinds: `atomic`, `compound`, `parallel`, and `final`. Final is terminal, not composite — it indicates completion of the enclosing scope and forbids substates and outgoing transitions. The three composite kinds (atomic with no substructure, compound with sequenced substates, parallel with named concurrent regions) all require static topology: their substate set is fixed at authoring time.

Sensitive workflows routinely require lifecycle per item over a runtime-determined collection. Each line item in a benefits claim is reviewed; each license in a permit application is verified; each respondent in an investigation is interviewed. The collection size is unknown until intake completes. Today WOS authors have two workarounds and both are heavy:

- **Fan-out via signal/correlation.** Emit one signal per item, route by `correlationKey` (Kernel §9.4), bound by `signalTimeout` (Kernel §9.7). Each item escapes the natural statechart governance (the iteration is a pile of correlation events, not a structured state) and the provenance stream conflates iteration with cross-case communication.
- **External orchestration.** Run iteration outside WOS in a worker, call WOS once per item. Iteration happens outside WOS governance: provenance, deterministic replay (Kernel §4.2), and the named-seams invariant (ADR 0077) do not apply across the iteration boundary. Violates the "Rust is the spec authority" rule (WOS `CLAUDE.md`).

FlowSpec §3.9 names this primitive directly. BPMN multi-instance activities and CMMN repetition rules cover the same shape. The counter-proposal disposition (Wave 5) flagged this absorption gap. WOS lacks the structural primitive; iteration is the right shape and the kernel does not currently express it.

## Decision

Add `foreach` as a fifth state topology kind. Final remains terminal, not composite — the enumeration becomes `atomic`, `compound`, `parallel`, `foreach`, `final`. `foreach` iterates over a bounded collection, applies a sub-state's lifecycle per item, and aggregates results to the case file through the governed output-commit pipeline (ADR 0080).

### D-1. Schema additions

`$defs/State` in `wos-spec/schemas/kernel/wos-kernel.schema.json` extends `type`'s enum and gains a sixth conditional `allOf` block requiring foreach-specific fields:

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | enum | REQUIRED | `"foreach"` (joins existing four). |
| `collection` | string (FEL) | REQUIRED | Expression evaluating to an array. Bounded by static analysis; unbounded collections are a lint failure. |
| `itemVariable` | string | OPTIONAL | Identifier for the per-iteration item. Defaults to `$item`. |
| `indexVariable` | string | OPTIONAL | Identifier for the iteration index. Defaults to `$index`. |
| `concurrency` | integer or null | OPTIONAL | `null` = sequential. Positive integer N = up to N parallel iterations. Default: `null`. |
| `breakCondition` | string (FEL) | OPTIONAL | Guard evaluated before each iteration; iteration terminates when the guard returns true. |
| `outputPath` | string | CONDITIONAL | Aggregation target path in the case file. REQUIRED when `mergeStrategy` is set; both fields land together. |
| `mergeStrategy` | enum | OPTIONAL | `shallow`, `deep`, or `collect`. Reuses parallel-state semantics (Kernel §4.4 / Wave 4 `mergeStrategy` shape). |
| `body` | State | REQUIRED | Nested state applied per iteration. Any kind: `atomic`, `compound`, `parallel`, `foreach`. |

`foreach` MUST NOT declare `initialState`, `states`, `regions`, `cancellationPolicy`, or `historyState`. Conditional `allOf` rules prevent the cross-kind structural fields from appearing on a foreach state, mirroring the existing four-kind constraints.

### D-2. Iteration is a governed substate

Full statechart semantics apply inside `body`. `body` may be any state kind, including nested `foreach`. Per-iteration transitions emit standard kernel provenance (§4.7 step 4). Per-iteration guards, actions, milestones, timers, and case-state mutations behave identically to a standalone state of the same kind.

The outer `foreach` state coordinates iteration and aggregation only. It does not run guards or actions of its own beyond `onEntry` / `onExit` (the standard State surface). The iteration loop is the topology's behavior.

`collection` is evaluated **once at state entry**. Mid-iteration mutations to the underlying case-state path do not re-evaluate the iteration set. Mutations to `collection`'s source path during iteration emit standard mutation records but do not affect the running iteration.

### D-3. Provenance

One provenance record per iteration boundary, emitted on the kernel's existing `provenanceLayer` seam (ADR 0077 §10.3). Reserved record kinds:

| Record kind | When |
|---|---|
| `iterationStarted` | Before the iteration body's `onEntry` runs. Carries iteration index, resolved item path, and the foreach state id. |
| `iterationCompleted` | After the iteration body reaches a final state. |
| `iterationFailed` | When the iteration body terminates via an `error` final state or unhandled action error. |
| `iterationSkipped` | When `breakCondition` fires before the iteration body's `onEntry` runs. |

`iterationStarted` / `iterationCompleted` are paired per iteration — emitting the start record without the completion record is a processor invariant violation. Inner-state transitions emit standard kernel provenance under their own state ids; iteration boundary records do not duplicate inner-state transition records.

### D-4. Pipeline reuse (ADR 0080)

Per-iteration writes to `outputPath` route through the governed output-commit pipeline. Bindings: `mutationSource = computed` (the parallel-merge-derived value default reused for foreach aggregation). `verificationLevel` per surface policy attached at the existing `lifecycleHook` seam (ADR 0077 §10.4) — governance profiles MAY require a minimum level on `determination`-tagged transitions inside iteration bodies.

Aggregation across iterations reuses the parallel-state `mergeStrategy` shape:
- `shallow` — each iteration's output overwrites the previous at `outputPath` (last-write-wins under non-deterministic concurrency, see D-5).
- `deep` — iteration outputs deep-merge into `outputPath`.
- `collect` — iteration outputs append to an array at `outputPath`. Order under `collect` is the iteration order at sequential `concurrency: null`; under positive `concurrency`, order is non-deterministic and readers MUST NOT depend on it.

The pipeline's write-scope rule (ADR 0080 §D-1.4) applies per iteration: an iteration body's writes MUST fall within the foreach state's declared `outputPath` scope plus paths the body's nested governance permits. Out-of-scope writes are a lint failure at authoring time and a processor rejection at runtime.

### D-5. Concurrency

`concurrency: null` runs iterations sequentially in `collection` order. `concurrency: N` (positive integer) permits up to N concurrent iterations.

Under `concurrency: N`, iteration order is **non-deterministic** beyond `mergeStrategy: collect` semantics. A processor MAY interleave iteration body transitions in any order consistent with the per-iteration deterministic evaluation algorithm (Kernel §4.2 holds within each iteration; the outer iteration scheduler is not bound by it). This is the same posture parallel states take across regions.

A foreach state with `concurrency: N` and inner-body events that arrive concurrently across iterations serializes per inner-body instance, not globally. Two iterations may process events in any interleaving; events within one iteration are serialized.

### D-6. Non-goals

- **No nested foreach without explicit declaration.** A nested foreach is its own foreach state with its own `body`. The kernel does not auto-flatten nested iteration; authors who want a flat product over two collections write two foreach states.
- **No infinite iteration.** `collection` MUST be bounded. Static analysis enforces this in lint (D-7); a runtime processor that encounters an unbounded collection MUST reject the document, not enter the iteration.
- **No mutation of `collection` during iteration.** `collection` is evaluated once at state entry. Mid-iteration changes to the underlying source path do not affect the iteration set. The iteration set is fixed at entry; the underlying case-state path remains writable.
- **No cross-iteration mutation order beyond `mergeStrategy`.** Iterations under `concurrency: N` may execute in any order; readers depending on order under `shallow` or `deep` are reading non-deterministic state.
- **No new seam.** `foreach` attaches at the existing `provenanceLayer` (per-iteration records) and `lifecycleHook` (governance attachment via inner-body transition tags) seams. The named-seams invariant (ADR 0077) holds.

### D-7. Lint

- **L-foreach-001 — bounded collection.** `foreach.collection` MUST evaluate to a statically-analyzable bounded array. Unbounded or unanalyzable expressions (e.g., FEL referencing a recursive case-state path with no terminating clause) fail. Conformance class: **Kernel Complete** (FEL semantic interpretation required).
- **L-foreach-002 — outputPath requires mergeStrategy.** When `outputPath` is set, `mergeStrategy` MUST also be set. Conformance class: **Kernel Structural** (schema-checkable conditional).
- **L-foreach-003 — iteration write scope.** Iteration body writes MUST fall within `outputPath` scope plus governance-permitted paths. Out-of-scope writes fail. Conformance class: **Kernel Complete** (binding-target analysis required). Consistent with the governed output-commit pipeline's write-scope rule (ADR 0080 §D-1.4).
- **L-foreach-004 — concurrency value.** `concurrency` MUST be `null` or a positive integer. Conformance class: **Kernel Structural**.

### D-8. Conformance fixtures

- Sequential foreach over a static array (`concurrency: null`).
- Parallel foreach with `concurrency: 3` cap.
- `breakCondition` early termination — verifies `iterationSkipped` provenance for the unrun iterations.
- Empty collection — verifies zero iterations and aggregation produces an empty result under each `mergeStrategy`.
- Per-iteration provenance emission — verifies `iterationStarted` / `iterationCompleted` pairing and `iterationFailed` on inner-body error final state.
- foreach inside a compound state — verifies nested topology composes.
- Aggregation under each `mergeStrategy` (`shallow`, `deep`, `collect`) — verifies the reused pipeline shape.

## Consequences

**Positive.**

- Closes the FlowSpec §3.9 / BPMN multi-instance / CMMN repetition rule absorption gap named in counter-proposal disposition Wave 5.
- Reduces fan-out-via-correlation pattern complexity for collection-driven workflows. Each line item, license, or respondent runs as a governed substate inside one foreach state, not as a pile of correlation events.
- Each iteration is a governed substate. Full kernel statechart semantics inside `body`. The deterministic replay invariant (Kernel §4.2) holds within each iteration; the iteration scheduler under `concurrency: N` is non-deterministic across iterations, which matches the parallel-state posture and is a kernel-known shape.
- The pipeline reuse (ADR 0080) means foreach aggregation does not introduce a separate write surface. Governance profiles attaching write policy at `lifecycleHook` apply inside iteration bodies without modification.

**Negative.**

- Adds a fifth topology kind. Authors must learn one more state shape, and the kernel-spec §4.3 table grows. Mitigation: foreach is opt-in; existing kernel documents without foreach states are unchanged. Schema's existing four-kind conditional `allOf` blocks pattern-match cleanly to a fifth.
- Static analysis for `collection` boundedness adds lint complexity. L-foreach-001 requires interpreting FEL expression shape to determine boundedness — a Kernel Complete capability, not a Structural one. Authors writing collections that draw from external sources or that depend on runtime state require explicit boundedness declarations or fail lint.
- Provenance volume scales with iteration count. A foreach over 1000 items emits at least 2000 iteration boundary records plus inner-body transition records. Trellis custody anchoring posture (ADR 0080 §D-2.5) handles this — records flow through the standard exporter — but storage and review cost grow linearly.

**Neutral.**

- Existing `parallel` topology is unchanged. foreach is additive. Authors with statically-declared concurrent regions continue to use `parallel`; authors with dynamic per-item iteration use `foreach`.
- The `mergeStrategy` shape is shared with parallel-state Wave 4 (`mergeStrategy` + `collectPath` on parallel join). Both surfaces use the same enum and the same aggregation semantics; one shape, two surfaces.

## Implementation plan

**Lands on the `workflow-consolidation` branch governed by ADR 0076.** ADR 0076 sequences the schema merge (kernel + governance + AI integration + advanced → `wos-workflow.schema.json`; Companions and Profiles deletion; sidecar narrowing). The foreach topology lands in the same branch because §4.3's enumeration and the `$defs/State` schema shape both change in that pass; sequencing foreach against an unrelated branch would force a merge against the in-flight consolidation.

1. **Kernel §4.3 prose.** Extend the topology kinds enumeration to five. Add a foreach subsection describing the iteration loop, `collection` evaluation timing, `itemVariable` / `indexVariable` defaults, `concurrency` semantics, and `breakCondition` evaluation order. Add a paragraph clarifying that final remains terminal; the count goes from "four kinds" to "five kinds" with foreach joining the composite set.
2. **Kernel §4.7 transition execution sequence.** No change. Iteration body transitions follow the existing four-step sequence per iteration.
3. **Kernel §4.8 fork and join.** No change. foreach aggregation is not a parallel join; it does not use the synthetic `$join` event. Add a cross-reference noting that foreach uses `mergeStrategy` for output aggregation, distinct from parallel-state region join.
4. **Kernel §5.4 mutation history.** No change. Per-iteration writes emit standard mutation records under `mutationSource: computed` (the existing reserved literal).
5. **Schema additions.** Extend `$defs/State.type` enum to include `foreach`. Add a sixth conditional `allOf` block requiring `collection` and `body` when `type === "foreach"` and forbidding `initialState`, `states`, `regions`, `cancellationPolicy`, `historyState`. Add `collection`, `itemVariable`, `indexVariable`, `concurrency`, `breakCondition`, `outputPath`, `mergeStrategy`, `body` to the State property set with appropriate types and `x-lm.critical` annotations on `collection` and `body`.
6. **Provenance schema additions.** Reserve `iterationStarted`, `iterationCompleted`, `iterationFailed`, `iterationSkipped` literals on the `recordKind` discriminator in `wos-spec/schemas/kernel/wos-provenance-record.schema.json` (consistent with ADR 0080's literal-reservation pattern: normative prose reservation, no enum extension on the discriminator). Define the shape constraint per literal in Kernel §8 prose alongside the existing kernel record kinds.
7. **Lint rule landing.** Add L-foreach-001 through L-foreach-004 to `wos-lint`. Update `wos-spec/LINT-MATRIX.md` accordingly. L-foreach-001 requires Kernel Complete capability; L-foreach-002 / L-foreach-004 are Kernel Structural; L-foreach-003 is Kernel Complete (binding-target write-scope analysis).
8. **Conformance fixtures.** Author the seven fixtures in D-8 under `wos-conformance` (positive cases) and at least one negative fixture per lint rule.
9. **Three-way agreement.** Per WOS `CLAUDE.md` posture, the in-memory adapter and the production adapter (Restate) MUST both pass the foreach fixture set. The reference deserializer extends to the new topology kind without breaking existing four-kind documents.

## Alternatives considered

**Use `parallel` state with N statically-declared regions.** Rejected. Parallel requires the region count at authoring time. A benefits claim with an unknown number of line items has no way to encode "N regions where N is determined at intake" without generating the kernel document at runtime — which violates the spec-authoritative posture (WOS `CLAUDE.md`: "Rust is the spec authority").

**Use signal/correlation per-item fan-out.** Rejected. Heavy provenance: every iteration emits its own correlation event, conflating iteration with cross-case communication in the audit stream. Breaks deterministic replay because correlation timing is non-deterministic across deliveries. Escapes natural statechart governance — iteration becomes a flat pile of `correlationKey`-routed events rather than a structured substate.

**External orchestration.** Rejected. Iteration outside WOS escapes provenance, deterministic replay, and the named-seams invariant. Violates the WOS `CLAUDE.md` rule that spec behavior lives in the Rust center; iteration is spec behavior (it determines the per-iteration governance attachment, the per-iteration deterministic state machine, and the per-iteration audit emission), and routing it to an external worker forfeits all three.

**Add foreach as a `parallel`-state mode rather than a fifth kind.** Rejected. Parallel state has fixed regions declared in `regions: { ... }`; foreach has dynamic iteration count derived from `collection`. Conflating them would lose the static-vs-dynamic distinction in topology validation: the schema would no longer be able to enforce that parallel states declare their regions at authoring time. The two shapes solve different problems and the kernel benefits from naming them distinctly.

**Land foreach in a Layer 1 governance sidecar instead of the kernel.** Rejected. Iteration is a topology primitive, not a governance attachment. A kernel-only deployment with no governance layer should be able to express "for each item in the collection, run this state's lifecycle." Pushing foreach to a sidecar would force every kernel-only deployment with collection-driven work to re-export to a governance layer it does not otherwise need, breaking the "kernel-only is a valid deployment" design goal (Kernel §1.2 #5).
