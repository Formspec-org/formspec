# ADR 0067: Stack Contract — Statutory Clocks and Deadline Semantics

**Status:** Proposed
**Date:** 2026-04-21
**Last revised:** 2026-04-28 (maximalist position cluster revision)
**Coordinated cluster ratification:** This ADR ratifies as part of the WOS Stack Closure cluster (0066–0071) — all six ratify together once Agent A's `ProvenanceKind` variants and Agent B's schema `$defs` land. See `wos-spec/COMPLETED.md` Session 17 (forthcoming) for implementation tracking.
**Scope:** Cross-layer — Formspec + WOS + Trellis
**Related:** [STACK.md Open Contracts](../../STACK.md#open-contracts); [ADR 0066 (amendment and supersession)](./0066-stack-amendment-and-supersession.md); [ADR 0068 (tenant and scope composition)](./0068-stack-tenant-and-scope-composition.md); [ADR 0069 (time semantics)](./0069-stack-time-semantics.md) (clock events inherit D-2 millisecond floor and D-5 attestation requirements); [ADR 0070 (failure and compensation)](./0070-stack-failure-and-compensation.md); [ADR 0071 (cross-layer migration and versioning)](./0071-stack-cross-layer-migration-and-versioning.md); `wos-spec/specs/sidecars/business-calendar.md` §7.1 (Calendar Selection Algorithm); WOS #20 typed events (landed); WOS #51 statutory deadline chains (trigger-gated); WOS #40 Task SLA authoring surface (landed; this ADR deprecates it — see §D-2.1); Trellis Core §6.7 (extension-key registry); [WOS TODO](../../wos-spec/TODO.md); [Trellis TODO](../../trellis/TODO.md)

## Context

Rights-impacting workflows run on legal deadlines. Appeal windows, processing SLAs, statutes of limitation, benefit expiry — each is a clock that starts on a triggering event and fires or lapses at a computed moment. None are currently defined as a cross-layer contract. WOS has jurisdiction-aware business calendar selection (`wos-spec/specs/sidecars/business-calendar.md` §7.1) and typed timer events (#20), but the semantics of "a clock attached to the record" are not pinned across the three layers. What starts the clock, who owns it, how it seals into the ledger, and what the verifier reports on an expired-but-unresolved clock are all undefined.

Listed in [STACK.md Open Contracts](../../STACK.md#open-contracts) as expensive — touches all three layers.

The primitive is not a timer. Timers are runtime concerns. The primitive is an *event pair* — `ClockStarted` at one point in the chain, `ClockResolved` at another — with declarative policy about when each may fire and what their occurrence means.

This ADR is part of the **WOS Stack Closure cluster (0066–0071)**. Clock events inherit ADR 0069 D-2 millisecond floor on RFC3339 wires (D-2.1 ns floor on Trellis CBOR), D-5 mandatory TSA attestation for rights-impacting clock starts, and D-7 substrate-authoritative chain time. Open-clock cancellation on supersession composes with ADR 0066 D-1 (see §D-? cross-reference below).

## Decision

**Four clock kinds** cover the canonical deadline patterns. Each is expressed as an event-pair contract declared by the layer that originates the clock, with Trellis anchoring both endpoints into the chain.

| Kind | Origin trigger | Terminal | Typical duration |
|---|---|---|---|
| **AppealClock** | adverse decision notice emitted | appeal filed \| deadline elapsed | 30 – 90 days |
| **ProcessingSLA** | intake submission accepted | decision issued \| deadline elapsed | 1 – 30 business days |
| **GrantExpiry** | benefit award issued | grant consumed \| expiry elapsed | months – years |
| **StatuteClock** | statutorily-defined triggering event | legal action initiated \| statute elapsed | years |

### D-1. Clock event shape (center declaration)

Every clock emits two canonical events separated by a computed duration.

**`ClockStarted`** — emitted by the originating layer when the triggering event occurs:

```
ClockStarted {
  clock_id: string,              // unique within the chain
  clock_kind: enum,              // AppealClock | ProcessingSLA | GrantExpiry | StatuteClock | x-*
  origin_event_hash: Hash,       // which event triggered the clock
  duration: ISO8601Duration,
  calendar_ref: string | null,   // resolves via WOS §7.1 jurisdiction-aware selection
  statute_reference: URI | null, // statutory authority when applicable
  computed_deadline: RFC3339,    // materialized once at start; does not float
}
```

**`ClockResolved`** — emitted on satisfaction, elapse, pause, or cancellation:

```
ClockResolved {
  clock_id: string,
  origin_clock_hash: Hash,        // ClockStarted event hash
  resolution: "satisfied" | "elapsed" | "paused" | "cancelled",
  resolving_event_hash: Hash | null,  // the act that resolved it
  resolved_at: RFC3339,
}
```

`clock_kind` is an open enum with `x-*` vendor extension per the stack-wide opinionated-taxonomy discipline.

The `computed_deadline` is materialized once at clock start and does not float as calendars evolve — this is a policy choice, not a runtime optimization. A calendar amendment after a clock starts does not retroactively shift its deadline; if the authoring deployment needs that semantics, it emits `ClockResolved(resolution: "cancelled")` + a new `ClockStarted`.

### D-2. Layer ownership

| Clock | Originating layer | Anchoring layer |
|---|---|---|
| AppealClock | WOS (emits on adverse-decision transition) | Trellis |
| ProcessingSLA | WOS (emits on intake-complete workflow event) | Trellis |
| GrantExpiry | WOS (emits on award-issued transition) | Trellis |
| StatuteClock | WOS (or Formspec, if triggered by a respondent act) | Trellis |

Formspec may originate a StatuteClock when a respondent act is itself the triggering event (e.g., filing an application starts a jurisdictional statute). Formspec never originates the other three kinds — those are governance concerns. The Respondent Ledger observes all clock events through the ledger as ordinary entries; originating them requires the authority the Respondent Ledger does not claim.

#### D-2.1. ProcessingSLA absorbs Task SLA — single SLA primitive with `kind` discriminator

`SlaDefinition` (the WOS Task SLA authoring surface, #40 landed) is **deprecated** by this ADR. All SLAs become `ProcessingSLA` with a closed taxonomy `kind` discriminator:

```
ProcessingSLA.kind: "legal-deadline" | "operational" | "internal-target" | "x-*"
```

| Kind | Audit weight | Chain anchor | Typical origin |
|---|---|---|---|
| `legal-deadline` | rights-impacting; mandatory `clock_source` (per [ADR 0069](./0069-stack-time-semantics.md) D-5) | always | statute, regulation, or deontic constraint with rights impact |
| `operational` | governance-relevant; chain-anchored by default | always | service-level commitment, processing-time policy |
| `internal-target` | informational; chain-anchored by default | always | team OKR, performance dashboard |
| `x-*` | vendor extension; deployment defines audit weight | always | adapter-specific |

All three closed-taxonomy kinds anchor on the chain. Operators filter by `kind` if they don't want operational SLAs in rights-impacting reports. Closed taxonomy with `x-*` extension is the discipline; opening the core enum is rejected.

Migration consequence. Existing `SlaDefinition` documents migrate to `ProcessingSLA` with `kind: "operational"` as the default-conservative mapping. Authors re-classify to `legal-deadline` where rights-impact applies.

### D-3. Clock state in export bundles (Trellis-owned)

Export bundles include a new `open-clocks.json` manifest enumerating every `ClockStarted` whose `ClockResolved` has not been emitted at export time:

```
{
  "open": [{
    "clock_id": string,
    "clock_kind": enum,
    "computed_deadline": RFC3339,
    "origin_event_hash": Hash
  }]
}
```

The verifier emits an advisory diagnostic for each expired-but-unresolved clock (`computed_deadline < bundle.sealed_at` and no matching `ClockResolved`). Advisory, not an integrity failure — a deadline may pass without a system response, and *that is the audit-relevant fact*. Integrity is about the chain; the diagnostic is about the case.

### D-4. Pause and resume (WOS-owned; no new record kinds; calendar invariant across segments)

Statutory clocks pause and resume on administrative events (applicant response pending, hearing scheduled, etc.). WOS emits the pause as a two-event pair using the existing vocabulary:

1. `ClockResolved(resolution: "paused", resolving_event_hash: pause-cause)` — terminates the prior segment.
2. `ClockStarted(clock_kind: same, origin_event_hash: resume-cause, duration: residual, calendar_ref: same)` — begins a new segment carrying the remaining duration.

**Calendar invariant.** When a clock pauses and resumes, the resumed `ClockStarted` MUST carry the same `calendar_ref` as the paused segment. Calendar changes mid-clock are governance acts under [ADR 0066](./0066-stack-amendment-and-supersession.md) amendment, not silent pause/resume. A pause-resume pair that changes `calendar_ref` is an integrity violation; the verifier MUST refuse.

Rationale: if the calendar can change silently across pause/resume, the cumulative-duration computation becomes non-deterministic against the chain — exactly the kind of latent drift the stack rejects. Calendar mutation requires explicit governance authorization.

The verifier composes pause segments into a cumulative duration by walking the chain. No `ClockPaused` record is needed — the two-event vocabulary composes.

### D-5. Relationship to ADR 0066 (amendment and supersession)

An amendment attempted after a statute clock has elapsed is a *governance-policy violation*, not an integrity violation. Trellis records whatever the governance layer permits to happen. WOS's amendment policy (ADR 0066 D-2) references the statute clock and rejects or permits the amendment under its deontic constraint. A rescission does not restart a statute clock — the original determination's elapsed time is preserved. A supersession via appeal may start a fresh StatuteClock if the appeal's statutory basis is independent.

### D-6. Open-clock cancellation on supersession (WOS-owned; mandatory)

When [ADR 0066](./0066-stack-amendment-and-supersession.md) supersession opens a new chain, the WOS runtime MUST emit `ClockResolved(resolution: "cancelled", resolving_event_hash: <supersession-event-hash>)` for **every** open clock on the prior chain — before or concurrent with the prior chain's terminal checkpoint. After the supersession, the prior chain's `open-clocks.json` index (per D-3) MUST NOT list cancelled clocks as unresolved.

Rationale: supersession opens a new chain that subsumes the prior case. Open clocks on the prior chain are no longer governance-relevant — the new chain may carry forward whichever clocks remain in scope (a fresh appeal window starts on the superseding determination, etc.). Leaving the prior chain's clocks unresolved corrupts the verifier's open-clock advisory and produces ambiguous audit signals.

The cancellation events themselves anchor on the prior chain (per [ADR 0070](./0070-stack-failure-and-compensation.md) D-1 local-append commit semantics). They are the last governance acts on that chain; the terminal checkpoint follows.

### D-7. Post-hoc elapsed emission (deterministic self-closing)

If a system goes dark and a deadline passes, the next authoritative touch (audit, re-access, review) emits a synthetic `ClockResolved` with explicit references back to the originating chain:

```
ClockResolved {
  clock_id: same,
  origin_clock_hash: <ClockStarted hash>,
  resolution: "elapsed",
  resolving_event_hash: <last-touch event hash on the originating chain>,    // MUST reference the originating chain
  resolved_at: <computed_deadline>                                            // not "now"; the deadline itself
}
```

`resolving_event_hash` references the last-touch event on the originating chain — never null, never a free-floating timestamp. Self-closing chains are deterministic; the verifier can replay and compute the same closure.

Rationale: a `ClockResolved.elapsed` with a null `resolving_event_hash` is a free-floating fact, which is exactly the kind of latent drift the stack rejects. Anchoring the closure to a specific event hash makes post-hoc elapsed emission as auditable as live emission.

## Consequences

**Positive.**
- Deadlines are first-class in the record — expiry is auditable, not implicit in missing events.
- Pause and resume compose from the base two-event vocabulary; no additional record kinds.
- Jurisdiction-aware via existing WOS §7.1 business-calendar selection; no duplicate plumbing.
- Verifier exposes open-clock state without opinionating about runtime behavior — a deployment with no live timers still produces valid chains.

**Negative.**
- Adds two WOS provenance record kinds (`ClockStarted`, `ClockResolved`) plus the clock-kind open enum.
- Trellis export bundle gains the `open-clocks.json` manifest and a verifier advisory path.
- Forces jurisdictional semantics to be decided per clock at authoring time — implicit defaults are not allowed. This is a design feature, not a deficiency.

**Neutral.**
- Does not mandate runtime timer implementation. A deployment without live timers still records `ClockStarted` at origin; `ClockResolved(resolution: "elapsed")` is emitted either at the next authoritative touch (audit, re-access, review) or left open, with the verifier advisory carrying the signal.

## Implementation plan

Truth-at-HEAD-after-cluster-implementation.

**WOS.**
- Agent A lands `ProvenanceKind::ClockStarted` and `ProvenanceKind::ClockResolved` (Facts tier) with constructors `ProvenanceRecord::clock_started` and `ProvenanceRecord::clock_resolved`. Five unit tests + three conformance fixtures (start, satisfied, elapsed, paused-resumed, cancelled-on-supersession).
- Agent B lands schema `$def`s `$defs/ClockStartedRecord` and `$defs/ClockResolvedRecord` in `wos-workflow.schema.json`; `Clock` `$def` carries `clock_kind`, `duration`, `calendar_ref`, `statute_reference`, `clock_source` (per [ADR 0069](./0069-stack-time-semantics.md) D-5; required when `kind: "legal-deadline"`).
- `ProcessingSLA.kind` discriminator schema lands per D-2.1; `SlaDefinition` deprecated with migration note.
- Wire AppealClock emission to adverse-decision transition path — composes with §4.1 #2 deterministic notice (already landed).
- Wire ProcessingSLA emission to intake-complete event.
- Wire D-6 cascade: supersession path (per [ADR 0066](./0066-stack-amendment-and-supersession.md)) enumerates open clocks on the prior chain and emits `ClockResolved(cancelled)` for each before sealing the prior chain.
- Reopens #51 statutory deadline chains — trigger-gate softens now that a contract exists.

**Formspec.**
- No authoring surface change. Respondent Ledger observes clock events as ordinary entries.
- StatuteClock origination on respondent acts (application filing) emits via the Respondent Ledger's existing event-emit path, referencing the applicable statute URI.

**Trellis.**
- Add `open-clocks.json` manifest to export bundle spec.
- Extend verifier with D-3 advisory diagnostic.
- Verifier rejects pause-resume pairs whose `calendar_ref` differs (per D-4).
- Verifier requires `resolving_event_hash` non-null on `ClockResolved.elapsed` synthetic emissions (per D-7).
- Land `append/014-clock-started`, `append/015-clock-satisfied`, `append/016-clock-elapsed`, `append/017-clock-paused-resumed`, `append/018-clock-cancelled-on-supersession` vectors.

## Open questions

1. **Multi-jurisdictional clocks.** A case operating under federal + state law may face two statute clocks on the same act. Default: emit both, independently; no special composition. Alternative: require selection of a single governing jurisdiction at case open. Recommendation: default — `wos-spec/specs/sidecars/business-calendar.md` §7.1 jurisdiction selection is clock-scoped, so composition is straightforward.

**Resolved (this revision).**
- ~~Clock granularity~~ — resolved: clock event timestamps inherit [ADR 0069](./0069-stack-time-semantics.md) D-2 millisecond floor (RFC3339 string layers) and D-2.1 nanosecond floor (Trellis CBOR wire). Jurisdictional deadlines are day-granular by `duration`, not by timestamp precision.
- ~~Post-hoc elapsed emission~~ — resolved: D-7 mandates synthetic `ClockResolved(elapsed)` with non-null `resolving_event_hash` referencing the last-touch event on the originating chain.
- ~~Pause/resume calendar invariance~~ — resolved by D-4 calendar invariant.
- ~~Open-clock cancellation on supersession~~ — resolved by D-6.

## Alternatives considered

**Deadline as a field on the event that triggers it.** Rejected — events are immutable; pause and resume would require amendments to prior events, violating append-only. A deadline is a relationship between two events, not a property of one.

**Deadline as an external policy document consulted at audit.** Rejected — separates the clock from the chain it governs; makes offline verification impossible without the policy docs. The whole point of the chain is self-contained auditability.

**Single `Timer` record kind.** Rejected — conflates governance-meaningful clocks (appeal windows, statutes) with runtime timers (poll intervals, retry backoffs). The former require audit; the latter do not. Collapsing them forces Trellis to anchor retry-loop telemetry into the chain.

**Compute deadlines at verification time rather than at clock start.** Rejected — floats the deadline against the current calendar, making historical audits non-deterministic. A case audited in 2027 should see the same deadline a case audited in 2025 would.
