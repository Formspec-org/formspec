# ADR 0080: Governed Output-Commit Pipeline

**Status:** Proposed
**Date:** 2026-04-25
**Scope:** WOS — workflow schema, processing model, provenance
**Related:** [ADR 0073 (case initiation and intake handoff)](./0073-stack-case-initiation-and-intake-handoff.md); [ADR 0075 (rejection register)](./0075-rejection-register.md); [ADR 0076 (product-tier consolidation)](./0076-product-tier-consolidation.md); [ADR 0077 (canonical kernel extension seams)](./0077-canonical-kernel-extension-seams.md); [ADR 0078 (foreach topology)](./0078-foreach-topology.md); [`wos-spec/schemas/wos-workflow.schema.json`](../../wos-spec/schemas/wos-workflow.schema.json) `$defs/OutputBinding`; [`wos-spec/counter-proposal-disposition.md`](../../wos-spec/counter-proposal-disposition.md) §Wave 0 / §Sequenced absorption; [`wos-spec/thoughts/2026-04-24-standards-absorption-gap-analysis.md`](../../wos-spec/thoughts/2026-04-24-standards-absorption-gap-analysis.md) §Refactor Target item 2

## Context

Five external-work surfaces in WOS write into the case file:

- **Capability invocation** — agent output projected into case fields (AI Integration `CapabilityDeclaration`).
- **Service invocation** — external service response projected into case fields (`invokeService` action).
- **Signal/message wait** — event payload projected into case fields (signal/message wait substates with correlation key + signal timeout).
- **Task action** — human respondent input projected into case fields (Formspec-bound task surface).
- **Parallel join** — region results aggregated into case fields (parallel-state merge).

ADR 0078 adds a sixth: **foreach iteration aggregation**, with the same shape.

Each surface today reasons about the same questions independently:

1. What contract validates the output?
2. How does the output map into case fields (projection map)?
3. Which case-field paths is this surface permitted to write?
4. What is the provenance source label for the resulting mutations?
5. What is the verification level of the resulting mutations?
6. How does failure manifest (rejection, retry, fallback, quarantine)?

Without a unified abstraction, each surface grows its own per-question vocabulary. Lint and conformance grow per-surface rules. Schema duplication compounds with every new surface.

The pre-consolidation framing of this ADR landed work across four documents (kernel + governance + AI + advanced) in five waves. ADR 0076 collapses those into one merged schema; this ADR retargets accordingly. The pipeline is now realized as **one shape** in `wos-workflow.schema.json` `$defs/OutputBinding`, declared via the top-level `bindings[]` array and via per-block surface declarations (capability outputBindings, service outputBindings, event outputBindings, task actions, parallel mergeStrategy, foreach outputPath).

## Decision

### D-1. Single declarative pipeline shape

The governed output-commit pipeline takes one input shape across all six surfaces:

| Field | Required | Description |
|---|---|---|
| `on` | REQUIRED | Source surface identifier: state id, transition id, capability id, signal name, parallel region id, foreach state id |
| `contractRef` | OPTIONAL | URI to the output contract schema. Default: surface's declared output contract (capability `outputContractRef`, service `responseContractRef`, signal `eventContract`, task `formspecRef`) |
| `projection` | OPTIONAL | Projection map from output to case-field paths. Default: identity for matching field names |
| `writeScope` | REQUIRED | Array of case-field path patterns this surface is permitted to write. Out-of-scope writes fail at lint and at runtime |
| `mutationSource` | REQUIRED | Open enum `oneOf [reserved literals \| x- pattern]`. Reserved literals: `agent-extracted`, `system-fetched`, `human-entered`, `human-corrected`, `computed`, `self-attested`. Vendor labels via `x-` prefix |
| `verificationLevel` | OPTIONAL | Open enum `oneOf [reserved literals \| x- pattern]`. Reserved literals: `independent`, `attested`, `corroborated`, `authoritative` |

Pipeline output: validated case mutations + one Facts-tier provenance record per mutation. On contract validation failure: surface-specific rejection (capability quarantine, service retry, task validation failure). On write-scope violation: hard rejection at runtime, lint failure at authoring.

### D-2. Per-surface defaults

Every surface declares its `mutationSource` default, so trivial `OutputBinding` declarations don't repeat the obvious:

| Surface | Default `mutationSource` |
|---|---|
| Capability invocation (agent) | `agent-extracted` |
| Service invocation | `system-fetched` |
| Signal/message wait | `system-fetched` |
| Task action | `human-entered` (or `human-corrected` on overrides) |
| Parallel join | `computed` |
| Foreach iteration aggregation | `computed` |

Authors override defaults explicitly. A capability emitting `human-corrected` (e.g. an agent-suggested override of a prior human entry) requires an explicit `mutationSource` setting; lint warns on default deviation without a `rationaleRef`.

### D-3. Surface attachment

The pipeline is realized at six attachment points in `wos-workflow.schema.json`:

| Surface | Where it lives in the merged schema |
|---|---|
| Top-level cross-cutting | `bindings[]` — `OutputBinding[]` whose `on` references any state, transition, capability, or signal id |
| Capability invocation | `agents[*].capabilities[*]` carries `outputContractRef` + `outputBindings` (projection) + `writeScope` (capability-declared scope) |
| Service invocation | `lifecycle.states[*].transitions[*].actions[invokeService]` carries `serviceRef` + `outputBindings` + `retryPolicy` |
| Signal/message wait | `lifecycle.states[*]` (signal/message wait substates) carries `eventContract` + `eventOutputBindings` (routed by `correlationKey`, bounded by `signalTimeout`) |
| Task action | `lifecycle.states[*]` (task substates) carries `taskActions` (Formspec-binding shape: `fieldBinding` + `fieldValue` + reveal-on-action surfaces) |
| Parallel join | `lifecycle.states[*]` (parallel) carries `mergeStrategy` (`shallow` / `deep` / `collect`) + `collectPath` |
| Foreach aggregation | `lifecycle.states[*]` (foreach) carries `outputPath` + `mergeStrategy` (per ADR 0078) |

Each attachment site references the same underlying `OutputBinding` `$defs` shape. Surface-specific extensions (e.g. capability `inputBindings` for self-documenting inputs; service `retryPolicy`; signal `correlationKey`; task `additionalEditableFields`) ride alongside the common pipeline shape, not as a parallel pipeline.

### D-4. Provenance integration

Every projected mutation emits one Facts-tier provenance record per the kernel rule (ADR 0075 invariant I-12). The `MutationRecord` `$defs` (consolidated into `wos-workflow.schema.json` per ADR 0076 D-4) carries:

- `mutationSource` (open enum, REQUIRED on declaration)
- `verificationLevel` (open enum, OPTIONAL)
- `path` (case-file path written)
- `value` and `previousValue` (mutation content)
- `actor` reference
- `surface` reference (capability id / transition id / signal name — links the mutation to the binding that produced it)

Higher-tier records (Reasoning, Counterfactual, Narrative) attach via the `provenanceLayer` seam (ADR 0077 §10.3) when the corresponding embedded blocks are present (`governance` for Reasoning/Counterfactual, `aiOversight.narrativeTier` for Narrative). The Facts-tier record is always emitted.

### D-5. Reserved record kinds for capability disposition

Two `recordKind` literals on `wos-provenance-log.schema.json` capture capability-output disposition outside the happy path:

- `capabilityQuarantined` — capability invocation held for authorized-actor reset after non-retryable validation failure. Processor MUST NOT auto-retry; resume requires authorized-actor reset (provenance-recorded as a fresh mutation).
- `capabilityOutputInvalidated` — previously-committed capability output superseded by later evidence. Emitted when a fallback chain or human correction overrides an earlier mutation.

Both reserved by **normative prose** in the merged spec. The `recordKind` discriminator stays open (`type: string`) — no enum constraint. Vendors register their own record kinds via `x-` prefix.

**Reset-authority precedence (Q7 owner decision):** when `governance.delegation.quarantineReset` is declared, it overrides any `agents[*].resetAuthority` setting. When governance is absent (operational-tier workflows), `agents[*].resetAuthority` is the binding rule. Authors writing both in the same workflow get a lint warning (`WOS-QUARANTINE-PRECEDENCE-001`) so the precedence is explicit, not silent.

### D-6. Write-scope rule (surface-specific)

Every surface declares its write scope at authoring time; runtime rejects out-of-scope writes:

- Capability `writeScope` MUST contain every path in `outputBindings[*].targetPath`. Capability scope is declared at `agents[*].capabilities[*].writeScope`.
- Task `writeScope` is the union of `editableFields` plus any reveal-on-action `additionalEditableFields`. `taskActions[*].fieldBinding` MUST fall within scope.
- Service `writeScope` is declared at the action; `outputBindings[*].targetPath` MUST fall within scope.
- Signal `writeScope` is declared on the wait substate; `eventOutputBindings[*].targetPath` MUST fall within scope.
- Parallel `collectPath` MUST fall within the parallel region's declared merge scope.
- Foreach iteration body writes MUST fall within `outputPath` plus governance-permitted paths (ADR 0078 lint rule L-foreach-003).

Lint rules per surface (`WOS-BIND-SCOPE-001` through `WOS-BIND-SCOPE-006`) check at authoring; processor enforces at runtime.

### D-7. Mandatory wait-state timeout

Signal/message wait substates MUST declare `signalTimeout`. Indefinite waits are forbidden — closes FlowSpec §3.10's prohibition without schema change (the `signalTimeout` surface already exists; this ADR makes it a MUST in the merged spec). Aligned with ADR 0075 invariants I-1 (statechart determinism) and I-11 (deterministic evaluation).

## Consequences

**Positive.**

- **One pipeline, six surfaces.** Processor logic for "validate output, project to fields, check write scope, emit provenance" lives in one `commit_external_output(...)` function in `wos-runtime`. Replaces five (now six with foreach) per-surface implementations.
- **Cross-surface conformance is uniform.** One fixture pattern (positive + negative per surface) covers the whole pipeline; new surfaces inherit it.
- **Provenance shape is uniform.** Every mutation carries the same source/verification metadata. Audit export, drift analysis, and equity monitoring read one shape across all surfaces.
- **Write-scope violations fail closed at two layers.** Lint catches at authoring; processor catches at runtime. Out-of-scope writes never silently project.

**Negative.**

- **Six attachment sites have independent backwards-incompatible work.** Each attachment site needs schema definition, processor implementation, and conformance fixture. Bounded but non-trivial.
- **`mutationSource` and `verificationLevel` are open enums.** Vendor extensions via `x-` interoperate at the schema layer; semantic interoperability is the vendor's responsibility. Mitigation: lint warns on non-reserved-literal usage without `rationaleRef`.

**Neutral.**

- **Per-surface ergonomics survive.** Capability `inputBindings`, service `retryPolicy`, signal `correlationKey`, task reveal-on-action surfaces — each rides alongside the common pipeline. The pipeline does not flatten the surfaces; it gives them a shared output shape.

## Implementation plan

Numbered for tracking. Lands on the `workflow-consolidation` branch alongside ADR 0076.

1. **`OutputBinding` `$defs` in merged schema.** Land the shape in `wos-workflow.schema.json` (sketch already published). Promote to full normative `$defs` with `x-lm.critical` annotations on `mutationSource` / `verificationLevel`.
2. **Reserved record kinds.** Reserve `capabilityQuarantined`, `capabilityOutputInvalidated`, and ADR-0078 iteration kinds (`iterationStarted`, `iterationCompleted`, `iterationFailed`, `iterationSkipped`) in normative spec prose. No enum extension on the open `recordKind` discriminator.
3. **Surface attachments.** Wire `OutputBinding` references at the seven attachment sites listed in D-3.
4. **Per-surface defaults table.** Land the D-2 default-`mutationSource` table in normative spec prose. Lint warns on default deviation without rationale.
5. **`signalTimeout` MUST.** One-sentence prose addition making `signalTimeout` MUST on signal/message wait substates.
6. **Processor implementation.** Single `commit_external_output(...)` function in `wos-runtime` + `wos-formspec-binding` taking the six pipeline inputs and returning validated mutations + Facts-tier provenance records. Replaces five per-surface commit implementations. **Coercion via shared `fel-core::coerce` library (Q5 owner decision)** — every surface uses the same string→datetime / string→number / string→bool functions. Per-surface defaults (Q5 retains capability of stricter parsing where the *contract* declares it; the coercion library is the canonical primitive).
7. **Disposition record-kind processor semantics.** `capabilityQuarantined` MUST NOT auto-retry; resume requires authorized-actor reset (provenance-recorded). `capabilityOutputInvalidated` emitted on fallback / correction.
8. **Write-scope lint rules.** `WOS-BIND-SCOPE-001` through `WOS-BIND-SCOPE-006` registered with positive + negative fixtures per surface.
9. **`mutationSource` rationale lint.** `WOS-MUT-SOURCE-001` warns when a surface emits a non-default `mutationSource` without `rationaleRef`.
10. **`verificationLevel` lints.** `WOS-VER-LEVEL-001` (governance-profile-gated): on `determination`-tagged transitions in `rightsImpacting` workflows, mutations MAY require minimum `verificationLevel`. Profile-configurable. `WOS-VER-LEVEL-002` (Q6 owner decision): warns when a capability declares `fallbackChain` but omits `verificationLevel`. Author must explicitly set the level (`corroborated` if the chain corroborates, `attested` if it merely escalates) — no silent default.
11a. **Quarantine-reset precedence lint.** `WOS-QUARANTINE-PRECEDENCE-001` (Q7 owner decision): warns when both `governance.delegation.quarantineReset` and any `agents[*].resetAuthority` declare reset authorities; governance overrides, but the lint surfaces the conflict to the author rather than letting it pass silently.
11. **Conformance fixtures.** Positive + negative per surface. `mutationSource` round-trip (one per reserved literal + one per `x-vendor-*`). `verificationLevel` round-trip. Three-way agreement: spec + in-memory adapter + Restate.

## Decisions made (closing prior open questions)

- **Q5 — Shared `fel-core::coerce` library across all six surfaces.** Owner decision 2026-04-25. Single coercion source of truth; one canonical primitive shared by `commit_external_output`. Per-surface coercion strictness is expressed via the *contract* (output schema), not the coercion function itself. Hardening: parity fixtures across reserved type set; vendor `x-` types out of fixture scope.
- **Q6 — No default `verificationLevel`; lint warns on `fallbackChain` without explicit setting.** Owner decision 2026-04-25. Lint rule `WOS-VER-LEVEL-002` registered. See implementation plan step 10.
- **Q7 — Governance overrides; agent-level fallback.** Owner decision 2026-04-25. `governance.delegation.quarantineReset` (when present) overrides `agents[*].resetAuthority`. Lint rule `WOS-QUARANTINE-PRECEDENCE-001` warns when both declared. See D-5 + implementation plan step 11a.

## Open questions

None outstanding for this ADR.
