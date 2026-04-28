# ADR 0070: Stack Contract — Cross-Layer Failure and Compensation

**Status:** Proposed
**Date:** 2026-04-21
**Last revised:** 2026-04-28 (maximalist position cluster revision)
**Coordinated cluster ratification:** This ADR ratifies as part of the WOS Stack Closure cluster (0066–0071) — all six ratify together once Agent A's `ProvenanceKind` variants and Agent B's schema `$defs` land. See `wos-spec/COMPLETED.md` Session 17 (forthcoming) for implementation tracking.
**Scope:** Cross-layer — Formspec + WOS + Trellis
**Related:** [STACK.md Open Contracts](../../STACK.md#open-contracts); [ADR 0057 (WOS center vs. implementation boundary)](../../wos-spec/thoughts/archive/adr/0057-wos-core-implementation-boundary.md) (serial-per-instance invariant); [ADR 0061 (WOS custodyHook wire format)](../../wos-spec/thoughts/adr/0061-custody-hook-trellis-wire-format.md) (idempotency tuple); [ADR 0066 (amendment and supersession)](./0066-stack-amendment-and-supersession.md) (compensation via governance); [ADR 0067 (statutory clocks)](./0067-stack-statutory-clocks.md); [ADR 0068 (tenant and scope composition)](./0068-stack-tenant-and-scope-composition.md) (tenant scope is the failure-isolation boundary); [ADR 0069 (time semantics)](./0069-stack-time-semantics.md) (D-7 substrate-authoritative chain time); [ADR 0071 (cross-layer migration and versioning)](./0071-stack-cross-layer-migration-and-versioning.md); [ADR 0073 (intake outcome runtime emission)](./0073-intake-outcome-runtime-emission.md) (`IntakeAccepted | IntakeRejected | IntakeDeferred`); [parent TODO](../../TODO.md) stack-wide section

## Context

The three layers are separately durable. A typical case transition involves: Formspec validates response → WOS emits provenance record → Trellis custody-hook anchors it. Each step can fail at different moments. Partial commits are possible. The stack has never declared what invariant holds across a partial failure.

Concrete failure shapes:

- Formspec revalidates a submission; governance rejects; the Trellis chain anchors both the response AND the rejection — but the response was "invalid," so is it in the record? Does the verifier surface it as rejected-data or just data?
- WOS emits `AmendmentAuthorized`; Trellis custody-hook fails because the anchor substrate is down. Retry? How many times? What's the failure state of the WOS instance?
- Trellis anchors successfully; WOS runtime crashes before the receipt propagates. Caller retries. Does a second append succeed, fail idempotently, or produce a duplicate?
- An anchored decision turns out to be wrong a week later. Does the stack have a runtime-level "undo," or is reversal a governance act?

Each layer has ordering invariants on its own ([ADR 0057](../../wos-spec/thoughts/archive/adr/0057-wos-core-implementation-boundary.md) serial-per-instance; Trellis chain-hash-ordering; Formspec deterministic validation). None of them says what's true when two layers disagree about whether something committed.

Listed in [STACK.md Open Contracts](../../STACK.md#open-contracts) as an integration primitive. Blocks any production deployment.

This ADR is part of the **WOS Stack Closure cluster (0066–0071)**. ADR 0066 amendment-and-supersession owns post-commit reversal vocabulary (D-5 below routes there). ADR 0068 tenant scope is the failure-isolation boundary (D-? below). ADR 0069 D-7 substrate-authoritative chain time underpins the local-append commit semantics in D-1. ADR 0073 IntakeOutcome runtime emission carries the `IntakeRejected` provenance kind referenced in D-2.

## Decision

Six pins. The first is the whole architecture — everything else follows.

### D-1. The integrity layer is the commit point

A case transition is *committed* when Trellis's custody-hook append returns `canonical_event_hash`. Before that return, the state is *pending*, not durable from the stack's perspective. After that return, the state is canonical and irreversible at the runtime layer.

**"Commit" means local append, not anchor.** Trellis distinguishes two operations:
- **Local append** — writes the event into the hash-chain and returns `canonical_event_hash`. Latency is milliseconds (hash + signature + storage write). This is the commit point in this ADR.
- **Anchor** — submits the checkpoint seal to an external substrate (transparency log, TSA, bilateral witness). Latency depends on substrate (OpenTimestamps cycles hourly-to-daily). Anchoring is scheduled and cadence-driven; it does not gate per-event commits.

The "record survives the vendor" claim rests on *eventually anchored* local appends. Unanchored local appends still verify against the hash-chain and signatures; they lose only the external-substrate trust anchor. The commit-to-anchor interval is a deployment-tunable property; it does not weaken commit semantics.

Implications:
- No layer treats its own durable write as the commit point. WOS is durable-per-`DurableRuntime`, but that durability is *internal scaffolding* — the commit that makes a decision "part of the record" is the Trellis local append.
- Any failure between WOS emission and Trellis local-append receipt is a *pending* failure, not a *committed* failure. Retries are correct by construction (per D-4).
- Formspec revalidation and WOS governance evaluation happen before Trellis append. They are pre-commit and may abort without leaving a record.

This is the dependency-inversion choice for runtime durability. Trellis is the stable center for *what committed*; WOS durable-runtime is the adapter for *how we got there*; external anchor substrates are adapters for *how strongly we trust the commit post-hoc*.

### D-2. Formspec validation failures are pre-commit; the rejection *fact* is governance

If Formspec server-side revalidation rejects a submission, **the rejected response bytes do not anchor on the chain** — invalid data does not contaminate the record. This is the stack-level invariant.

But the *fact that a rejection occurred* is governance-relevant evidence: it carries the case identifier, the rejection reason, and the timestamp, without containing the rejected response payload itself. Per [ADR 0073](./0073-intake-outcome-runtime-emission.md) IntakeOutcome runtime emission, the runtime emits one of `IntakeAccepted | IntakeRejected | IntakeDeferred` on every intake act. `IntakeRejected` IS anchored on the chain — it is a Facts-tier provenance record about the rejection event, not the rejected data.

The boundary is sharp:
- **Response bytes** — excluded from the chain on rejection. Stays in Formspec's product-level audit trail (adapter concern), not the stack record.
- **Governance fact about rejection** — included on the chain via `IntakeRejected`. Pattern-of-attempted-overreach and pattern-of-validation-failures are both audit-relevant.

This composition was not visible in the prior framing of D-2; it does not change the invariant ("invalid data does not contaminate the record") — it makes the boundary precise.

### D-3. WOS governance rejections anchor as `AuthorizationRejected` (Facts tier)

A governance rejection of a human action (reviewer attempts an unauthorized transition; case-worker attempts amendment outside policy; actor lacks role for an attempted transition) is *itself* a decision. The rejection decision MUST be emitted as a `ProvenanceKind::AuthorizationRejected` provenance record (Facts tier) and MUST be anchored by Trellis. What is *not* recorded is the rejected action's would-have-been effects.

Following Agent A's implementation, two distinct Facts-tier `ProvenanceKind` variants cover the two distinct rejection sources:

- `ProvenanceKind::AuthorizationRejected` — emits on every governance-authorization rejection (unauthorized role for transition; unauthorized actor for amendment; unauthorized scope for policy invocation).
- `ProvenanceKind::TaskResponseRejected` — emits on validation rejections (the existing kind; covers Formspec validation rejections per D-2 and task-output validation rejections per Layer 2 deontic constraints).

Two distinct kinds, two distinct rejection sources, no overlap.

```
AuthorizationRejected {
  caseId: TypeID,
  attemptedActorId: string,                   // who tried
  attemptedAction: string,                    // closed taxonomy: "transition" | "amendment" | "rescission" | "correction" | "supersession" | "x-*"
  targetResourceId: string,                   // case ID, transition ID, policy ID, etc.
  rejectionReason: string,                    // human-readable
  policyDecisionRef: URI | null,              // optional: pointer to the deontic policy that rejected (FEL ref or document URI)
  timestamp: RFC3339                          // millisecond-or-better per ADR 0069 D-2
}
```

The distinction:
- *Rejected data* (Formspec D-2) — invalid input; rejected bytes excluded from chain; `IntakeRejected` Facts-tier governance record anchors the rejection event.
- *Rejected action* (WOS D-3) — valid attempt of a disallowed operation; `AuthorizationRejected` Facts-tier record anchors the denial.
- *Rejected task output* — valid input shape but failing deontic constraint; `TaskResponseRejected` Facts-tier record anchors the constraint failure.

Rationale: in rights-impacting work, pattern-of-attempted-overreach is itself governance-relevant evidence; pattern-of-policy-failures is the auditable trail of where the deontic constraints are catching what they're meant to catch. Three distinct kinds for three distinct evidence types.

### D-4. Trellis append failures trigger bounded retry with idempotency

Failure of a Trellis append (network timeout, anchor substrate downtime, hash-chain conflict) triggers retry. The `(caseId, recordId)` tuple from [ADR-0061](../../wos-spec/thoughts/adr/0061-custody-hook-trellis-wire-format.md) is the idempotency key — retries with identical tuples are safe.

- Retry budget is bounded by a normative MAX of 24 hours (per D-? below). The `DurableRuntime` adapter chooses any retry policy within that ceiling; deployment overrides allowed within MAX.
- A successful retry produces a single canonical event; no duplicate records exist on success.
- A retry-budget-exhausted case enters the `stalled` execution flag — a reserved `InstanceStatus` variant introduced by this ADR (see D-4.1). `stalled` is orthogonal to statechart node taxonomy; it is execution metadata on the case instance, not a kernel statechart node. Operator intervention (a new runtime attempt, an anchor-substrate change, or explicit abandonment via supersession per [ADR 0066](./0066-stack-amendment-and-supersession.md)) clears the flag.

Operator-facing: `stalled` cases surface telemetry and a remediation path. They do not silently fail.

#### D-4.1. `stalled` is a `CaseInstance.status` variant, not a statechart node

The kernel statechart node taxonomy (`atomic | compound | parallel | final`, per the WOS kernel spec) is **untouched**. `stalled` is execution metadata orthogonal to node kind: a case instance whose statechart node is, e.g., `atomic` may also have `status: stalled` because its commit pipeline has exhausted retry budget.

```
CaseInstance {
  ...
  status: InstanceStatus,                // closed enum: see below
  stalled_since: RFC3339 | null,         // millisecond-or-better per ADR 0069 D-2; non-null iff status == stalled
  ...
}

enum InstanceStatus {
  Active,
  Stalled,                               // commit pipeline exhausted retry budget
  Closed,                                // statechart reached a `final` node and is sealed
  Superseded,                            // ADR 0066 supersession completed
  // x-* extension permitted; closed core taxonomy
}
```

`status` and statechart-node-kind compose: an `Active` case advances through atomic/compound/parallel/final nodes via lifecycle transitions; a `Stalled` case is paused on commit-pipeline failure regardless of which node it is in. Recovery from `stalled` does not change the node — it resumes the commit attempt on the same logical step.

The `stalled_since` field is required when `status == Stalled` and MUST be null otherwise. Lint rule `K-F-011` enforces the conjunction.

#### D-4.2. Retry-budget MAX (normative ceiling, not just adapter default)

Retry budget MUST NOT exceed 24 hours wall-clock from first attempt to budget exhaustion. Within that ceiling, adapters choose their own policy (exponential backoff, fixed delay, jitter); deployments override within MAX. Past 24 hours, the case enters `stalled` deterministically.

Rationale: an unbounded retry budget hides substrate failure. A 24-hour ceiling is long enough to ride out planet-scale outage windows and short enough to surface operator-actionable signals before audit becomes impossible.

#### D-4.3. Slow-append surface — typed retryable vs budget-exhausted distinction

The `DurableRuntime` adapter is responsible for converting Trellis-side timeouts to typed errors. This ADR does not prescribe specific timeout values — those are deployment-tuned. Adapters MUST surface the distinction:

```rust
enum AppendFailure {
  RetryableFailure { error: String, attempt: u32, ... },
  BudgetExhaustedFailure { error: String, total_attempts: u32, total_elapsed: Duration, ... },
  // x-* extension permitted; closed core taxonomy
}
```

The runtime applies D-4.2 retry-budget policy to `RetryableFailure`; on `BudgetExhaustedFailure` (or after the runtime's own MAX timer fires), it transitions the instance to `Stalled` and emits `CommitAttemptFailure`.

#### D-4.4. Receipt propagation — Trellis-appended-but-WOS-crashed safe by D-4 idempotency

If Trellis local-append succeeds but the WOS process crashes before stamping the receipt back into its own durable state: on retry, the same `(caseId, recordId)` idempotency tuple replays through Trellis; Trellis returns the same `canonical_event_hash` (per Trellis Core idempotent-append guarantees); WOS's receipt-stamping code path (`provenance.rs:150-153` conflict-detection) recognizes the equivalent prior receipt and no-ops.

This is safe by construction. Future investigations of "did the receipt get lost?" should not re-litigate it — the chain commit is canonical (D-1), the idempotency tuple is the replay key (D-4), and the receipt-stamping conflict detection handles the WOS-side crash window.

### D-5. No runtime saga; compensation is governance

An anchored decision that is later found to be wrong is NOT reversed by a runtime compensation event or saga. Reversal is a *governance act* under [ADR 0066](./0066-stack-amendment-and-supersession.md): amendment, rescission, or supersession.

This pin is structural. Saga-style auto-compensation is a tempting runtime pattern for transactional systems, but in rights-impacting work it misrepresents the record. A decision that happened, happened — the chain preserves it. A new decision may supersede it, and the supersession is itself a recorded governance act. The chain MUST NOT be editable post-commit; compensation flows through append-only amendment records.

Rationale: this keeps the center clean. Runtime sagas are exactly the kind of adapter-leaking-into-center pattern the stack rejects. It also composes cleanly with [ADR 0066](./0066-stack-amendment-and-supersession.md)'s four canonical revisit modes.

#### D-5.1. Tenant scope is the failure-isolation boundary

One tenant's substrate availability does not affect another tenant's chain progression. Failure isolation composes with the tenant scope established in [ADR 0068](./0068-stack-tenant-and-scope-composition.md): tenant is the outer container, and failure containment honors that container.

Concretely:
- Trellis substrate outage scoped to one tenant's chain (storage-shard failure, key-bag access loss) does not stall other tenants' chains running on the same physical substrate but logically separated by tenant.
- `DurableRuntime` adapter implementations carrying tenant context per [ADR 0068](./0068-stack-tenant-and-scope-composition.md) D-? MUST surface tenant-scoped retry budgets — exhaustion in tenant A does not consume budget for tenant B.
- `CommitAttemptFailure` records (D-6) are tenant-scoped; cross-tenant failure aggregation is a deployment-level concern, not a chain-level one.

This is contingent on [ADR 0068](./0068-stack-tenant-and-scope-composition.md) ratifying tenant scope as the failure-isolation boundary. Per the maximalist coordinated cluster ratification (see frontmatter), this is not a sequencing risk — both ADRs ratify together.

### D-6. Observable failure telemetry is Facts-tier

Commit-attempt failures — retries, budget-exhaustions, stalled entries — are themselves audit-relevant. The stack emits a `CommitAttemptFailure` provenance record (Facts-tier) carrying:

```
CommitAttemptFailure {
  caseId: TypeID,
  intended_record_id: TypeID,
  failure_kind: "retry" | "budget-exhausted" | "substrate-unavailable" | "x-*",
  attempt_count: integer,
  first_attempt_at: RFC3339,
  last_attempt_at: RFC3339,
  error: string
}
```

The failure record itself is anchored — either on the next successful append (if retry eventually succeeds), or on recovery from `stalled` state (if operator intervenes). Failures are not invisible; they become part of the audit trail.

## Consequences

**Positive.**
- A single commit point eliminates "which layer committed first?" ambiguity.
- Idempotent retries are safe by construction.
- `Stalled` is a first-class reserved `InstanceStatus` variant on `CaseInstance`, not runtime-defined escape behavior. Statechart node taxonomy is untouched; execution metadata composes with it orthogonally.
- Compensation semantics route through [ADR 0066](./0066-stack-amendment-and-supersession.md) — one vocabulary, not two.
- Commit-attempt failures are anchored and auditable.

**Negative.**
- Adds `Stalled` to the closed `InstanceStatus` core taxonomy (not to statechart node taxonomy — those remain `atomic | compound | parallel | final`).
- Adds three Facts-tier `ProvenanceKind` variants: `CommitAttemptFailure`, `AuthorizationRejected`, and (already-landed) `TaskResponseRejected` continues to apply.
- Forces Formspec revalidation to be atomic with the WOS emission path (no "submit first, validate later" pattern).
- Some deployments may want runtime-level "undo" for operational correction (e.g., a data-entry error caught within seconds). They must use amendment/correction under [ADR 0066](./0066-stack-amendment-and-supersession.md) instead.
- Retry budget MAX (24h) is normative; deployments MUST NOT exceed it.

**Neutral.**
- Does not prescribe retry-budget *policy* (exponential, fixed, jittered) within the 24h MAX. Adapter concern; deployment override allowed.
- Does not prescribe anchor-substrate failover. Trellis anchor targets (transparency logs, TSAs, bilateral witnesses) are adapter concerns.
- Does not prescribe `DurableRuntime` timeout values. Adapters surface `RetryableFailure | BudgetExhaustedFailure` distinction; values are deployment-tuned (D-4.3).

## Implementation plan

Truth-at-HEAD-after-cluster-implementation.

**Formspec.**
- Server-side revalidation path documented as pre-commit; explicit rejection of "submit first, validate later."
- No new event kinds required at the Formspec layer; `IntakeRejected` runtime emission is owned by [ADR 0073](./0073-intake-outcome-runtime-emission.md).

**WOS.**
- Agent A lands `ProvenanceKind::CommitAttemptFailure` and `ProvenanceKind::AuthorizationRejected` (Facts tier) with constructors `ProvenanceRecord::commit_attempt_failure` and `ProvenanceRecord::authorization_rejected`. Six unit tests + four conformance fixtures (retry-success, budget-exhausted, slow-append, authz-rejected-transition, authz-rejected-amendment, intake-rejected-cross-reference).
- Agent B lands schema `$def`s `$defs/CommitAttemptFailureRecord` and `$defs/AuthorizationRejectedRecord` in `wos-workflow.schema.json` carrying the D-3 and D-6 field sets.
- Add `Stalled` to closed `InstanceStatus` enum on `CaseInstance` (D-4.1); statechart node taxonomy unchanged.
- `DurableRuntime` trait method `append_to_custody` returns the typed `AppendFailure` distinguishing `RetryableFailure | BudgetExhaustedFailure` (D-4.3).
- `CaseInstance` gains required `status: InstanceStatus` field and conditional `stalled_since: RFC3339 | null` (non-null iff `status == Stalled`).
- Retry-budget MAX 24h enforced in the runtime layer; deployment override allowed only within MAX.
- Lint rule `K-F-010` — a workflow with no operator-accessible recovery path for `Stalled` instances fails load-time validation.
- Lint rule `K-F-011` — `stalled_since` non-null iff `status == Stalled`.

**Trellis.**
- Verifier surfaces `CommitAttemptFailure` and `AuthorizationRejected` records in verification reports.
- No changes to envelope or chain format — these records ride on ordinary appends.
- Bundle manifest optionally includes a `failures.json` summary for verifier-tool ergonomics.
- `(caseId, recordId)` idempotency tuple replay semantics documented in Trellis Operational Companion per D-4.4.

**Stack-level.**
- Reference deployment topology spec (trigger-gated in [parent TODO](../../TODO.md)) names operational retry-budget tuning guidance within the 24h MAX when it lands.

## Open questions

1. **`Stalled` instance auto-recovery on substrate restoration.** Default: no. Operator must explicitly re-try. Alternative: auto-retry on substrate health-check success. Recommendation: default — rights-impacting work prefers explicit human intervention to silent auto-recovery of anchor failures.

**Resolved (this revision).**
- ~~Retry-budget default value~~ — resolved by D-4.2: 24-hour normative MAX. Adapters choose policy within ceiling; deployments override within MAX.
- ~~Cross-tenant failure contagion~~ — resolved by D-5.1: tenant scope is the failure-isolation boundary; one tenant's substrate failure does not stall another tenant's chains.
- ~~Slow-append timeout values~~ — resolved by D-4.3: deployment-tuned within adapter; `RetryableFailure | BudgetExhaustedFailure` typed distinction is the center contract.
- ~~Receipt propagation safety on WOS-side crash~~ — resolved by D-4.4: idempotency-tuple replay handles the crash window; the `provenance.rs:150-153` conflict-detection no-ops on equivalent receipts. Future investigations should not re-litigate.

## Alternatives considered

**Two-phase commit across all three layers.** Rejected. Trellis's hash-chain append is inherently irreversible; 2PC's abort phase would require chain editing, which violates append-only posture.

**Saga pattern with runtime compensation events.** Rejected. Compensation in rights-impacting work is governance, not runtime. Saga semantics assume transactional correction is possible; the stack's posture is that append-only is the correctness invariant and governance supersession is the correction mechanism.

**WOS durable state as the commit point (Trellis anchor async/eventual).** Rejected. Trellis is the integrity layer; if it anchors eventually, "the record survives the vendor" weakens to "the record survives the vendor with N-minute delay," which procurement conversations cannot round-trip. Trellis-as-commit is the honest pin.

**Per-layer independent failure policy.** Rejected. Composition becomes per-deployment convention; different deployments' "same" failure scenarios produce different observable records.

**Retry the `CommitAttemptFailure` record itself.** Rejected. Infinite recursion. The failure record anchors on next-success-or-recovery; it does not itself retry.
