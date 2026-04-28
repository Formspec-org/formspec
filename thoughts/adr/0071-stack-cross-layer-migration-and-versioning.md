# ADR 0071: Stack Contract — Cross-Layer Migration and Versioning

**Status:** Proposed
**Date:** 2026-04-21
**Last revised:** 2026-04-28 (maximalist position cluster revision)
**Coordinated cluster ratification:** This ADR ratifies as part of the WOS Stack Closure cluster (0066–0071) — all six ratify together once Agent A's `ProvenanceKind` variants and Agent B's schema `$defs` land. See `wos-spec/COMPLETED.md` Session 17 (forthcoming) for implementation tracking.
**Scope:** Cross-layer — Formspec + WOS + Trellis
**Related:** [STACK.md Open Contracts](../../STACK.md#open-contracts); [ADR 0063 (WOS release trains by tier)](./0063-release-trains-by-tier.md); [ADR 0066 (amendment and supersession)](./0066-stack-amendment-and-supersession.md) (breaking-semantics supersession; pin changes via supersession are governance acts; see ADR 0066 Implementation plan §Q32 binding); [ADR 0067 (statutory clocks)](./0067-stack-statutory-clocks.md); [ADR 0068 (tenant and scope composition)](./0068-stack-tenant-and-scope-composition.md) (four-tuple is identity; this ADR's pin set is orthogonal version metadata); [ADR 0069 (time semantics)](./0069-stack-time-semantics.md); [ADR 0070 (failure and compensation)](./0070-stack-failure-and-compensation.md); [ADR 0076 (WOS schema merge)](./0076-wos-schema-merge.md) (single `$wosWorkflow` marker replaces kernel/governance/ai/runtime version separation); Trellis [ADR 0003 (envelope reservations)](../../trellis/thoughts/specs/2026-04-20-trellis-phase-1-mvp-principles-and-format-adrs.md) (phase cuts); Formspec `specs/registry/changelog-spec`; WOS #3 migration routing (backlog); WOS #28 claim-check artifact references; PLN-0015 (identity-vs-pin-mutability conflict; resolved by §D-6 below); [parent TODO](../../TODO.md) stack-wide section

## Context

Each project has its own changelog and migration mechanism:

- **Formspec** — changelog with migration generation ([`specs/registry/changelog-spec`](../../specs/registry/changelog-spec.llm.md)).
- **WOS** — release trains by tier ([ADR 0063](./0063-release-trains-by-tier.md)); Changesets + Actions for 1.0. Per [ADR 0076](./0076-wos-schema-merge.md), the kernel/governance/ai/runtime schemas merged into a single `$wosWorkflow` marker — this ADR's pin tree consumes the merged shape (see D-1).
- **Trellis** — phased envelope ([ADR 0003](../../trellis/thoughts/specs/2026-04-20-trellis-phase-1-mvp-principles-and-format-adrs.md)); phase cuts at Phase 4 and beyond.

Each mechanism handles single-spec evolution. Cross-spec evolution — chains whose validity depends on *multiple* spec versions — is undefined.

This ADR is part of the **WOS Stack Closure cluster (0066–0071)**. ADR 0068 D-2 establishes the four-tuple `(Tenant, DefinitionId, KernelId, LedgerId)` as case identity (immutable). This ADR's pin set is **orthogonal version metadata** (mutable through governance) — the load-bearing distinction. ADR 0066 D-5 routes breaking-semantics evolution through supersession; pin changes via supersession are governance acts (see ADR 0066 Implementation plan §Q32 binding). PLN-0015's identity-vs-pin-mutability conflict is resolved by D-6 below.

Concrete failure shapes:

- An old Trellis chain was written under WOS governance v1.0. WOS evolves to v1.1 (adds a new provenance record kind, tightens a deontic constraint). Does the old chain still verify? Does re-running the evaluator against the chain's events produce the same decisions?
- A Formspec definition v2 lands a changelog migration from v1. A case mid-flight on v1 — does WOS continue to evaluate under v1 semantics through case-close, or hot-migrate to v2?
- Trellis cuts Phase 4 in 2027. A chain sealed in Phase 1 in 2026 — does the 2027 verifier still understand the Phase 1 envelope format?
- A case decision made in 2026 is audited in 2030. The 2030 verifier runs newer code. What does "the record survives the vendor" mean if the verifier interprets the record differently than the 2026 runtime did?

Each of these is the kind of silent drift that erodes the "offline-verifiable forever" claim. Named in [STACK.md Open Contracts](../../STACK.md#open-contracts) as an integration primitive.

## Decision

Five pins. The posture is **immutable-semantics-per-case** — a case opens under a version set and runs on that set to closure. Evolution happens between cases, not within them.

### D-1. Pin at case open — four-field pin tree (post-ADR-0076 merged shape)

When a case opens, the scope bundle (per [ADR 0068](./0068-stack-tenant-and-scope-composition.md)) captures a *version pin tree* as a Facts-tier field on the first anchored event. **Four fields, three groups** — the merged shape that follows [ADR 0076](./0076-wos-schema-merge.md):

```
CaseOpenPin {
  formspec: {
    definitionVersion: string                  // Formspec definition version
  },
  wos: {
    $wosWorkflowVersion: string                // single WOS marker; ADR 0076 collapses
                                               // kernel/governance/ai/runtime into one document version
  },
  trellis: {
    envelopeVersion: string,                   // Trellis envelope phase ("phase-1", "phase-2", ...)
    conformanceClass: string                   // "core" | "complete" | "x-*"
  }
}
```

All four are captured at case open. All four are immutable for the case's lifetime *as identity*; they MAY change through authorized migration (D-4) or supersession (D-5), each emitting a Facts-tier record.

The prior six-dimension shape (`wos.kernelVersion`, `wos.governanceVersion | null`, `wos.aiVersion | null`, `wos.runtimeCompanionVersion`) is rejected — the nullable governance/ai hints are meaningless under the merged ADR 0076 schema where every conforming WOS document carries a single `$wosWorkflow` marker. The pin tree consumes the post-merge shape.

Rationale: cross-spec consistency is only guaranteed within a joint version set. Pinning the joint set per case makes the guarantee concrete. Collapsing the WOS sub-tree from four dimensions to one (per ADR 0076) eliminates the nullable-version-hint cliff that existed under the prior schema.

### D-2. Verification is version-aware

The Trellis verifier, when replaying a chain, selects WOS and Formspec semantics bound at case open. A chain sealed in 2026 under `{formspec: 1.3, wos.$wosWorkflow: 1.0, trellis.envelope: phase-1, trellis.conformanceClass: complete}` verifies in 2030 against exactly those semantics.

This is a commitment on the verifier side: verifier implementations MUST carry historical semantics libraries. A 2030 verifier that refuses to interpret a 2026 pin is non-conformant.

Historical semantics distribution is normative: verifiers MUST embed historical semantics libraries; registry-backed lookup is forbidden for offline-verifiable claims (see D-3 export-bundle binding).

Rationale: offline verifiability is meaningless if the verifier's own code evolution can invalidate prior records, or if it depends on networked semantics that can drift, go offline, or be tampered with.

### D-3. Verifier supports prior phases for the envelope's lineage; export bundles ship semantics inline

Within an envelope phase lineage (Trellis Phase 1 → Phase 2 → Phase 3 → Phase 4), the verifier MUST understand every prior phase's format. [ADR 0003](../../trellis/thoughts/specs/2026-04-20-trellis-phase-1-mvp-principles-and-format-adrs.md) reserves envelope capacity for phase growth; this ADR binds that reservation to a verifier-compatibility commitment.

Additive evolution within a phase (new optional fields, new event kinds) does NOT break prior chains — they omit the new fields, and verifiers tolerate the omission. Breaking format changes require a new phase cut, and the verifier carries both formats indefinitely.

**Export bundles MUST include the historical semantics library inline as a sibling artifact under the bundle ZIP** (e.g., `semantics/wos@1.0/`, `semantics/formspec@1.3/`, `semantics/trellis@phase-1/`). The bundle is the verifier's complete dependency. No external lookup, no networked semantics, no latent drift. A bundle without its semantics library is non-conformant.

Rationale: phase cuts are the explicit breaking-change instrument; within-phase evolution is backwards-compatible by design; and a bundle that ships its own semantics is the only honest interpretation of "offline-verifiable forever." Implementations that defer semantics distribution to a registry weaken the claim into "verifiable as long as the registry is up and trusted" — exactly the kind of latent dependency the stack rejects.

### D-4. Case mid-flight migration is opt-in, authorized, and emits a record

Default: a case runs on its pinned version set to closure. A deployment MAY opt in to migration policies (see WOS #3 migration-routing backlog) that hot-migrate a case to a newer version set mid-flight. When migration happens, the stack emits a `MigrationPinChanged` provenance record carrying:

```
MigrationPinChanged {
  caseId: TypeID,
  old_pin: CaseOpenPin,
  new_pin: CaseOpenPin,
  migration_policy_ref: URI,
  authorizing_actor_id: string,
  rationale: string,
  timestamp: RFC3339
}
```

The record is Facts-tier and anchored by Trellis. Post-migration, the case runs on the new pin set. The chain carries the pin-change event; verifier splits replay at the boundary.

Rationale: migration is a governance act, not a silent upgrade. Auditors can always see when and why a case's version set changed.

### D-5. Breaking-semantics changes require [ADR 0066](./0066-stack-amendment-and-supersession.md) supersession

A spec change that would retroactively invalidate a prior decision is NOT a migration — it is supersession. The criterion: if re-evaluating prior events under the new semantics would produce a different decision, the evolution is breaking and must flow through [ADR 0066](./0066-stack-amendment-and-supersession.md) D-1 supersession (new chain, linked to prior).

Migration (D-4) assumes the new semantics produce the *same* observable decisions for the case's prior events, just with additional capabilities available going forward. Breaking semantics fail that assumption and need explicit governance intervention.

This closes the loop: versioning (this ADR) handles *compatible* evolution; [ADR 0066](./0066-stack-amendment-and-supersession.md) handles *incompatible* evolution.

### D-6. Pins are not identity — PLN-0015 resolution

The case's identity is the four-tuple scope bundle `(Tenant, DefinitionId, KernelId, LedgerId)` per [ADR 0068](./0068-stack-tenant-and-scope-composition.md) D-2. The four-tuple is immutable for the case's lifetime.

The pin set defined in D-1 is **version metadata**, orthogonal to identity. Pins are mutable through:
- Authorized mid-flight migration (D-4) — emits `MigrationPinChanged` on the same chain.
- Supersession (D-5; per [ADR 0066](./0066-stack-amendment-and-supersession.md) Implementation plan §Q32 binding) — opens a new chain and the `RescissionAuthorized` event on the old chain carries `migrationPinChange` referencing the new chain's pin event by hash.

PLN-0015's identity-vs-pin-mutability conflict is resolved by this distinction:
- **Identity** is immutable per [ADR 0068](./0068-stack-tenant-and-scope-composition.md) D-2. The four-tuple does not change for a case's lifetime.
- **Pins** are version markers, mutable per this ADR's D-4 (intra-chain authorized migration) and D-5 (cross-chain supersession). Pin mutation is always governance-authorized, always recorded.

The two concepts are orthogonal and the conflict was a category error: PLN-0015 conflated "case identity" with "version pins." Fixing the category makes both concepts crisp and the policy unambiguous.

## Consequences

**Positive.**
- A case opened today verifies identically in 2030.
- Each spec can evolve without breaking existing chains.
- Migration is a first-class authorized act; silent upgrades are architecturally impossible.
- Breaking semantics has a clear path (supersession) separate from migration.
- Phase-cut compatibility is a verifier commitment, not a fragile convention.

**Negative.**
- Trellis verifier codebase grows over time (MUST carry historical semantics libraries; D-3).
- Four pins per case is compact but still adds bytes to the first-event payload — acceptable cost for self-contained verification.
- Formspec migration generation (already spec'd) now runs under the opt-in mid-flight migration policy, not automatically.
- Conformance suites must include cross-version replay tests, not just latest-version tests.
- Export bundles MUST include inline semantics libraries (D-3); bundle size grows with semantics history. The growth is bounded (semantics changes ship at release-train cadence, not per-event) and the cost is the price of "offline-verifiable forever."

**Neutral.**
- Does not prescribe the `conformanceClass` string vocabulary — that belongs to the conformance spec.

## Implementation plan

Truth-at-HEAD-after-cluster-implementation.

**Formspec.**
- Canonical response schema gains top-level `pin: CaseOpenPin` field (placed on the first anchored event payload; per D-1 inline-JSON encoding).
- Changelog migration tooling documents: auto-migration is case-close only; mid-flight migration requires D-4 policy.
- Respondent Ledger §6 spec adds `pin` capture at ledger open.

**WOS.**
- Agent A lands `ProvenanceKind::MigrationPinChanged` (Facts tier) with constructor `ProvenanceRecord::migration_pin_changed`. Three unit tests + two conformance fixtures (intra-chain migration, supersession-coupled migration via ADR 0066 §Q32 binding).
- Agent B lands schema `$def` at `$defs/MigrationPinChangedRecord` in `wos-workflow.schema.json` carrying the D-4 field set.
- `CaseOpenPin` schema $def consumes the four-field shape (D-1); the prior six-dimension shape is removed.
- Per [ADR 0076](./0076-wos-schema-merge.md), version strings semver-pinned per [ADR 0063](./0063-release-trains-by-tier.md).
- `DurableRuntime` API accepts a `pin: CaseOpenPin` at `CaseInstance::create`; downstream evaluation carries it in context.
- Conformance suite extended with cross-version replay cases: evaluate an archived chain under archived semantics and assert byte-identical replay.
- WOS #3 migration routing backlog item softens — this ADR provides the contract.

**Trellis.**
- Envelope first-event payload gains REQUIRED `pin` object; MUST NOT change within chain unless `MigrationPinChanged` record anchors the transition.
- Verifier implementation embeds historical semantics libraries; networked-semantics lookup is non-conformant for offline-verifiable claims (D-3).
- Phase-cut compatibility is a MUST in Core §8 verifier obligations.
- Export bundle includes inline semantics-library artifact under `semantics/<spec>@<version>/` per D-3.
- Export bundle manifest includes the pin set alongside existing metadata.

**Stack-level.**
- New `pins.md` reference document naming the four dimensions authoritatively and pointing to each spec's version-string format.
- Reference deployment topology spec (trigger-gated) covers semantics-library embed-and-bundle patterns; networked-semantics lookups remain non-conformant.

## Open questions

1. **Studio authoring with stale pins.** When Studio opens a workflow document whose `$wosWorkflow@1.0` is deprecated by the time of authoring, what does Studio do? Default: warn, allow save with current pin preserved (do not silently upgrade the pin at authoring time). Authoring-time pin freshness is a Studio UX call, not a stack pin — the stack invariant (D-1 immutable pin at case open) governs runtime behavior, not authoring-tool behavior.

**Resolved (this revision).**
- ~~Pin wire encoding~~ — confirmed default: inline JSON object on first anchored event. Self-contained bundles matter more than wire efficiency for small strings.
- ~~Semantics-library distribution~~ — strengthened to MUST in D-3: verifiers MUST embed; export bundles MUST include inline semantics. Registry-backed lookup is forbidden for offline-verifiable claims. The missing-library scenario is foreclosed by structure, not by best-effort recovery.
- ~~Pin-mutation via supersession~~ — resolved by D-6: pins are not identity. The four-tuple identity (per [ADR 0068](./0068-stack-tenant-and-scope-composition.md) D-2) is immutable; pins are version markers, mutable through D-4 (intra-chain migration) or D-5 / [ADR 0066](./0066-stack-amendment-and-supersession.md) §Q32 (cross-chain supersession with explicit `migrationPinChange` field). PLN-0015 closed.
- ~~Conformance-class downgrade~~ — confirmed default: yes, a case pinning a narrower conformance class runs safely on a wider-conformance runtime. Downgrade is safe; upgrade is migration (D-4).

## Alternatives considered

**Rolling-forward semantics (cases always run on latest).** Rejected. Changes observable outcomes retroactively. A case decided in 2026 under v1.0 semantics, re-evaluated in 2030 under v1.5, might produce a different decision. That violates append-only correctness and breaks the "the record survives the vendor" claim — because it only survives *if* vendor evolution is compatible, and rolling-forward assumes compatibility by fiat.

**Per-layer independent version pins.** Rejected. Cross-spec contracts (custodyHook, canonical response, event hash chain) evolve together; pinning only one side creates latent drift at the composition boundary. The failure mode is silent — records look valid but compose incorrectly.

**Auto-migration at case open when old pin is deprecated.** Rejected. Migration is a governance act. Silent auto-migration on pin deprecation would violate D-4's authorized-and-recorded invariant.

**Pin-set as optional.** Rejected. Omitted pin means implicit-current-semantics, which is exactly rolling-forward semantics, already rejected. Pin is REQUIRED or the contract doesn't hold.

**Single monolithic "stack version."** Rejected. The three specs evolve on independent release trains by design. Collapsing them to one version string would force lockstep release coordination — which is the opposite of the independent-release-trains posture.
