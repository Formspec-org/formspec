# ADR 0069: Stack Contract — Time Semantics

**Status:** Proposed
**Date:** 2026-04-21
**Last revised:** 2026-04-28 (maximalist position cluster revision)
**Coordinated cluster ratification:** This ADR ratifies as part of the WOS Stack Closure cluster (0066–0071) — all six ratify together once Agent A's `ProvenanceKind` variants and Agent B's schema `$defs` land. See `wos-spec/COMPLETED.md` Session 17 (forthcoming) for implementation tracking.
**Scope:** Cross-layer — Formspec + WOS + Trellis
**Related:** [STACK.md Open Contracts](../../STACK.md#open-contracts); [ADR 0066 (amendment and supersession)](./0066-stack-amendment-and-supersession.md); [ADR 0067 (statutory clocks)](./0067-stack-statutory-clocks.md) (clock emission inherits these pins); [ADR 0068 (tenant and scope composition)](./0068-stack-tenant-and-scope-composition.md); [ADR 0070 (failure and compensation)](./0070-stack-failure-and-compensation.md); [ADR 0071 (cross-layer migration and versioning)](./0071-stack-cross-layer-migration-and-versioning.md); Trellis Core §9 (timestamp fields in envelope); `wos-spec/specs/sidecars/business-calendar.md` §7.1 (calendar selection algorithm, jurisdiction-aware timezone resolution); Formspec FEL `today()` / `now()`; [parent TODO](../../TODO.md) stack-wide section

## Context

All three layers produce timestamps. None agrees with the others on precision, timezone, leap-second handling, monotonicity, or clock-source attestation. RFC3339 UTC is assumed in prose across the specs but never normatively pinned as a cross-layer invariant.

This ADR is part of the **WOS Stack Closure cluster (0066–0071)**. ADR 0067 statutory clocks inherits D-2 millisecond floor and D-2.1 nanosecond CBOR floor on every clock event. ADR 0070 failure-and-compensation references D-7 substrate-authoritative chain time when distinguishing local-append commit semantics from anchor cadence. ADR 0066 amendment-and-supersession inherits D-1 RFC3339 UTC on every authorization-attestation timestamp. Time pins compose with the cluster; they do not float independently.

The pattern that breaks in its absence is not catastrophic in development — it is catastrophic intermittently in production:

- A case created in Tokyo, reviewed in San Francisco, audited in New York: whose clock renders `today()` in a FEL expression?
- A chain sealed during a leap second: does Trellis emit `23:59:60`, reject it, or smear?
- SLAs with sub-second semantics (ProcessingSLA per [ADR 0067](./0067-stack-statutory-clocks.md)) require precision; dates and appeal windows do not.
- A chain whose timestamps move backwards between events — is it integrity-valid?

Listed in [STACK.md Open Contracts](../../STACK.md#open-contracts) as an integration primitive. Cheap to close now; each deferred day hardens wrong defaults in submodule code.

## Decision

Six pins across the three layers. Every implementation MUST honor them at the wire; presentation is a renderer concern.

### D-1. RFC3339 UTC is the wire format

Every timestamp emitted by any layer, on any wire — event envelope, provenance record, export bundle manifest, FEL builtin return — MUST serialize as RFC3339 with the `Z` zone designator. Offsets (`+09:00`, `-05:00`) MUST NOT appear on the wire. Local-time rendering is a renderer concern and happens after the record leaves the chain.

### D-2. Millisecond precision is the minimum on every wire

`2026-04-21T12:34:56.789Z` is the minimum-precision canonical form on every RFC3339 string layer (Formspec response, Respondent Ledger event, WOS provenance record, Trellis export-bundle manifest, FEL builtin return value). Higher-precision RFC3339 timestamps (`2026-04-21T12:34:56.789012345Z`) are valid and preserve additional digits. Second-precision timestamps (`2026-04-21T12:34:56Z`) MUST be rejected by verifiers — precision is load-bearing for SLA clocks under [ADR 0067](./0067-stack-statutory-clocks.md).

Rationale: rejecting second-only precision at the wire forces an SLA clock that fires within the same second to be unambiguously ordered.

#### D-2.1. Wire-floor stratification: ns on Trellis CBOR, ms on JSON-string layers

Two distinct wire surfaces, two distinct precision floors:

- **Trellis CBOR envelope wire.** Timestamps encode as `uint64` nanoseconds-since-Unix-epoch. The nanosecond floor is the byte-protocol invariant; nanoseconds is the sole encoding the verifier accepts on the CBOR wire.
- **All RFC3339 string layers.** Millisecond minimum precision (this D-2). Sub-millisecond digits are preserved when present; second-precision strings are rejected.

The two floors compose: a Trellis envelope's `uint64` nanoseconds, when surfaced as RFC3339 in a derived artifact (export-bundle manifest, verifier diagnostic, projection), MUST render with millisecond-or-better precision. No silent precision loss in either direction.

Rationale: nanosecond precision on the CBOR wire enables sub-millisecond clock ordering for high-rate SLA observation; the millisecond floor on string layers prevents human-readable second-precision drift from contaminating downstream processing. The cost of storing the extra digits is negligible; the cost of having to re-encode timestamps after a precision-loss incident is not.

### D-3. Chain order MUST agree with timestamp order

Within a single Trellis ledger chain, timestamps MUST be non-decreasing across `priorEventHash` sequence. A chain with backwards timestamps between consecutive events is an integrity failure — the verifier MUST reject it.

This pin composes [ADR 0057](../../wos-spec/thoughts/archive/adr/0057-wos-core-implementation-boundary.md) serial-per-instance ordering with Trellis's hash-chain ordering. Per-instance serialization at the WOS layer produces events in a total order; that total order MUST match anchor-time timestamp order.

Non-decreasing — equal timestamps are permitted. Two events at the same millisecond are ordered by chain position, not by timestamp.

### D-4. Leap seconds absorb via UTC-SLS

Clients MUST NOT emit `23:59:60`. On leap-second days, the preceding 1000 seconds smear via UTC-SLS (the Google/AWS NTP convention): each second spans 1000.001 ms, such that the final second of the day at the wire is `23:59:59.999Z` and the first second of the next day is `00:00:00.000Z` without a gap.

Rationale: strict `23:59:60` breaks most RFC3339 parsers and would produce spurious chain-failure incidents every leap second. The smearing is operationally proven at planetary scale.

### D-5. Clock-source attestation is mandatory for rights-impacting clock starts

Runtimes emitting rights-impacting `ClockStarted` events (per [ADR 0067](./0067-stack-statutory-clocks.md) §D-1) MUST attest the clock source via RFC 3161 TSA (or equivalent registered attestation substrate). The attestation rides on the record:

```
clock_source {
  kind: "tsa" | "x-*",                       // closed taxonomy: rights-impacting MUST attest
  source_identifier: string,                 // TSA URL, attestation-substrate identifier
  tsa_token: bytes,                          // RFC 3161 TimeStampToken (or registered equivalent)
  attested_at: RFC3339                       // millisecond-or-better
}
```

Self-hosted RFC 3161 substrate is acceptable — the requirement is registered attestation, not vendor-hosted attestation. Operators choosing self-hosted TSA assume the operational burden of maintaining it.

Non-rights-impacting `ClockStarted` events (operational SLAs, internal targets per [ADR 0067](./0067-stack-statutory-clocks.md) §D-? `ProcessingSLA.kind`) MAY omit `clock_source`; absence implies `wall-clock` best-effort. The deontic line is impact, not record kind.

**Deployment consequence.** Deployments unable to provide an attestation substrate cannot host rights-impacting workflows. This is a deliberate deployment-readiness gate, not a deferral hatch. Greenfield posture: register the substrate before opening rights-impacting cases; closed deployments using `wall-clock` for rights-impacting determinations are non-conformant.

### D-6. FEL `today()` and `now()` MUST hard-refuse without a timezone context

FEL's temporal builtins MUST return an error when no timezone context is configured — NOT `null`, NOT a default, NOT a server-timezone fallback, NOT a UTC fallback. The evaluator surfaces a typed `MissingTimezoneContextError` and the calling pipeline aborts.

The Rust trait return type evolves accordingly:

```rust
// Before: implicit-fallback hatch
trait FelEnvironment {
    fn current_date(&self) -> Option<FelDate>;
    fn current_datetime(&self) -> Option<FelDateTime>;
}

// After (this ADR): hard refusal
trait FelEnvironment {
    fn current_date(&self) -> Result<FelDate, MissingTimezoneContextError>;
    fn current_datetime(&self) -> Result<FelDateTime, MissingTimezoneContextError>;
}
```

Test-harness migration consequence. Existing test fixtures that constructed `FelEnvironment` without a `timezone` will fail to compile under the new return type. This is a deliberate quality improvement, not collateral damage — every fixture currently passing without a timezone is silently exercising the implicit-server-timezone path that this ADR forbids. Migration is mechanical: declare a timezone at fixture construction or assert the error case.

Timezone selection composes with `wos-spec/specs/sidecars/business-calendar.md` §7.1 (Calendar Selection Algorithm) jurisdiction-aware business-calendar selection. Where a case's jurisdiction pins a timezone, `today()` and `now()` resolve against that timezone. Where multiple applicable calendars disagree on timezone, the §7.1 configuration-error rule applies — the evaluator refuses with `MissingTimezoneContextError` carrying a multi-calendar-conflict variant.

### D-7. Substrate-authoritative chain time; processor `authored_at` is advisory

Two distinct timestamps coexist on every committed event:

- **Substrate `created_at`** — assigned by the Trellis local-append code path at the moment of hash-chain commit (per [ADR 0070](./0070-stack-failure-and-compensation.md) §D-1). This is authoritative chain time.
- **Processor `authored_at`** — supplied by the WOS or Formspec processor when emitting the record. This is the time the processor *thought* it was authoring the event. Advisory only.

When `|processor.authored_at − substrate.created_at| > threshold` (deployment-configured; default `1000ms`), the runtime MUST emit a `ClockSkewObserved` provenance record (Facts tier) before or concurrent with the next anchored event:

```
ClockSkewObserved {
  caseId: TypeID,
  substrate_created_at: RFC3339,        // millisecond-or-better
  processor_authored_at: RFC3339,       // millisecond-or-better
  skew_ms: integer,                     // signed; positive = processor ahead
  threshold_ms: integer,                // deployment-configured
  affected_event_hash: Hash,            // event whose skew triggered emission
  observed_at: RFC3339                  // emission timestamp
}
```

The record itself anchors on the next successful append (per [ADR 0070](./0070-stack-failure-and-compensation.md) §D-6 idempotent retry semantics). It is observable evidence that processor and substrate disagreed on time at the named moment; downstream auditors can reason about the magnitude and direction of disagreement.

Rationale: distributed processors carry independent wall clocks; demanding bit-equality is operationally infeasible. The maximalist position is to make disagreement *observable*, not to pretend it doesn't happen. The substrate clock anchors the chain; the processor clock declares its own intent; the gap between them is recorded fact.

## Consequences

**Positive.**
- Chain ordering is deterministic and auditable across time zones and daylight-saving transitions.
- Leap seconds do not produce intermittent integrity failures.
- FEL temporal expressions produce identical outcomes across deployments for the same input — or hard-refuse, never silently differ.
- SLA clocks (ADR 0067) have enough precision to be sub-second-deterministic on every wire; the Trellis CBOR floor of nanoseconds preserves headroom for high-rate observation.
- Clock-source attestation is mandatory for rights-impacting clock starts; the deployment-readiness gate is explicit, not buried in convention.
- Processor-substrate clock skew is observable as `ClockSkewObserved` records — disagreement becomes audit-relevant evidence rather than silent drift.

**Negative.**
- D-6 forces FEL authors to declare timezone. Mitigated by jurisdiction-aware inheritance from `wos-spec/specs/sidecars/business-calendar.md` §7.1; not mitigated for ad-hoc evaluations, which is intentional.
- D-2 rejecting second-precision breaks any existing fixture using second-precision timestamps. Greenfield — no production data, fixtures regenerate cheaply.
- D-3 requires runtime clock-monotonicity discipline at anchor time.
- D-5 mandatory attestation gates rights-impacting deployments on substrate availability.
- D-6 trait return-type change cascades through every existing FEL test harness. Mechanical fix; one-time cost.

**Neutral.**
- Does not pick an NTP/PTP provider. NTP and PTP are operator concerns; the substrate-authoritative chain time (D-7) makes processor wall-clock posture an audit-observable property, not a center pin.

## Implementation plan

Truth-at-HEAD-after-cluster-implementation.

**Formspec.**
- Canonical response schema pins all RFC3339 string timestamp fields to the millisecond-or-better regex per D-2.
- FEL `FelEnvironment` trait return type evolves: `current_date()` and `current_datetime()` return `Result<_, MissingTimezoneContextError>`. `Option<_>` return is removed.
- `today()` and `now()` resolve against the declared timezone or hard-refuse.

**WOS.**
- Agent A lands `ProvenanceKind::ClockSkewObserved` (Facts tier) with constructor `ProvenanceRecord::clock_skew_observed`. Two unit tests + one conformance fixture.
- Agent B lands schema `$def` at `$defs/ClockSkewObservedRecord` in `wos-workflow.schema.json` carrying the D-7 field set.
- `ProvenanceRecord.timestamp` schema pins to D-2 millisecond-or-better regex.
- `DurableRuntime` trait method signatures carry timezone context where temporal evaluation is required.
- `Clock` $def (per [ADR 0067](./0067-stack-statutory-clocks.md)) `clock_source` field matching D-5 shape; required for rights-impacting clock kinds, optional otherwise.
- Lint rule `K-T-010` for FEL expressions using `today()` / `now()` without a `timezoneRef` declaration.
- Lint rule `K-T-011` for `ClockStarted` records of rights-impacting kind missing `clock_source.tsa_token`.

**Trellis.**
- Envelope CBOR timestamp field pinned to `uint64` nanoseconds per D-2.1 (already the byte-protocol shape; this ADR makes it normative).
- Export-bundle manifest RFC3339 fields pin to D-2 millisecond floor.
- Verifier rejects chains with timestamp-order violations per D-3.
- Verifier rejects envelopes containing `23:59:60` timestamps per D-4.
- Verifier requires `clock_source` with valid TSA token on rights-impacting `ClockStarted` per D-5.
- Verifier surfaces `ClockSkewObserved` records in verification reports.
- "Time" section added to Trellis Operational Companion citing this ADR; covers D-2.1, D-5, D-7.

## Open questions

1. **Backwards-in-time evidence import.** If a deployment imports evidence with pre-deployment timestamps (e.g., historical records), D-3 still holds within a single chain. Cross-chain? Out of scope — imports are bundle-level, not chain-level.
2. **Sub-millisecond precision canonicalization on RFC3339 wires.** Two runtimes writing `2026-04-21T12:34:56.789000Z` vs `2026-04-21T12:34:56.789Z` — equal? Default: equal (trailing zeros insignificant on RFC3339 string layers). Trellis CBOR byte-equality is on envelope bytes (uint64 ns), not on rendered RFC3339 strings — the two surfaces don't conflict.
3. **Clock-skew threshold composition across distributed processors.** D-7's default 1000ms threshold applies per processor-substrate pair. When multiple processors emit into the same chain (e.g., regional WOS instances feeding one ledger scope), is the threshold per-processor or aggregate? Default: per-processor; each emitter independently decides whether to log skew. Aggregate skew is derivable from the chain by replay. Alternative: aggregate threshold computed as max-pairwise. Recommendation: default — per-processor keeps `ClockSkewObserved` emission deterministic at the source; aggregate analysis is a verifier concern.

**Resolved (this revision).**
- ~~Attestation substrate for D-5~~ — resolved: D-5 mandates RFC 3161 TSA (or registered equivalent) for rights-impacting clock starts. Self-hosted RFC 3161 acceptable.

## Alternatives considered

**Strict UTC with leap-second rejection.** Rejected — would cause intermittent integrity incidents at each leap second, and RFC3339 parsers disagree on whether `23:59:60` is valid.

**Server-local timezone default in FEL.** Rejected — the same FEL expression evaluating differently on different deployments breaks portability. D-6 forces explicit intent.

**Per-layer independent time policy.** Rejected — composition across layers requires a shared pin or chain-ordering invariants cannot hold.

**Second-precision minimum for wire timestamps.** Rejected — SLA clocks under [ADR 0067](./0067-stack-statutory-clocks.md) need sub-second determinism; rejecting second-precision at the wire forces correctness.

**Monotonic-only (reject backwards OR equal timestamps).** Rejected — equal timestamps are legitimate (two events processed within the same millisecond). Chain position disambiguates.
