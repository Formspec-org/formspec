# ADR 0066: Stack Contract — Amendment and Supersession of Decisions

**Status:** Proposed
**Date:** 2026-04-21
**Last revised:** 2026-04-28 (maximalist position cluster revision)
**Coordinated cluster ratification:** This ADR ratifies as part of the WOS Stack Closure cluster (0066–0071) — all six ratify together once Agent A's `ProvenanceKind` variants and Agent B's schema `$defs` land. See `wos-spec/COMPLETED.md` Session 17 (forthcoming) for implementation tracking.
**Scope:** Cross-layer — Formspec + WOS + Trellis
**Related:** [STACK.md Open Contracts](../../STACK.md#open-contracts); [ADR 0067 (statutory clocks)](./0067-stack-statutory-clocks.md) (open-clock cancellation on supersession composes per ADR 0067 D-6); [ADR 0068 (tenant and scope composition)](./0068-stack-tenant-and-scope-composition.md) (cross-tenant supersession composition; ADR 0068 §D-5 references this ADR for cross-tenant case movement); [ADR 0069 (time semantics)](./0069-stack-time-semantics.md) (authorization-attestation timestamps inherit D-1 RFC3339 UTC and D-2 millisecond floor); [ADR 0070 (failure and compensation)](./0070-stack-failure-and-compensation.md); [ADR 0071 (cross-layer migration and versioning)](./0071-stack-cross-layer-migration-and-versioning.md) (`MigrationPinChanged` + supersession sequencing per §Q32 Implementation plan; pin changes via supersession are governance acts); WOS kernel `caseRelationship`; WOS Workflow Governance §3; Trellis Core §6.7 (extension-key registry; `supersedes_chain_id` is a registered extension key, not a named-field reservation); Trellis Core §22 (case ledger); [WOS TODO](../../wos-spec/TODO.md); [Trellis TODO](../../trellis/TODO.md)

## Context

Append-only is correct until a decision is wrong. Rights-impacting workflows require bounded mechanisms for revisiting closed determinations: factual corrections, post-hoc amendments, supersession by appeal or new evidence, outright rescission, and post-rescission re-activation. None of these are currently defined across the three-spec stack. Each layer would, asked independently, invent its own concept of "undo," and the five concepts would not compose — Formspec intake would treat a re-submission as a fresh response, WOS governance would have no record-kind for "superseded," and Trellis would have no chain-to-chain linkage.

Listed in [STACK.md Open Contracts](../../STACK.md#open-contracts) as expensive — touches all three layers and every existing cross-layer seam.

Semantics differ sharply from "edit a field." The primitive is not mutation — it is *linkage*. Amendment is a governed act under due-process constraints. Integrity must preserve the prior record exactly. Intake must not silently mutate prior responses.

This ADR is part of the **WOS Stack Closure cluster (0066–0071)**. ADR 0067 D-6 cancels open clocks on supersession. ADR 0068 §D-5 references this ADR for cross-tenant case movement (cross-tenant supersession opens a new bundle in the destination tenant). ADR 0070 D-5 routes runtime "undo" through this ADR's vocabulary (no saga; compensation is governance). ADR 0071 D-5 routes breaking-semantics evolution through supersession; pin changes via supersession are governance acts (see §Implementation plan Q32 binding).

## Decision

**Five canonical modes** distinguish the kinds of revisit a decision can undergo. Each mode has a distinct shape across the three layers. They are mutually exclusive per event; a single revisit act emits exactly one mode.

| Mode | Same chain? | Prior record preserved? | Outcome |
|---|---|---|---|
| **Correction** | yes | yes (corrected-alongside) | factual record fixed; determination unchanged |
| **Amendment** | yes | yes | determination changed within the same case |
| **Supersession** | new chain, linked | yes | full replacement by a new case (typically appeal) |
| **Rescission** | yes | yes | determination withdrawn; no replacement |
| **Reinstatement** | yes | yes | re-activates a determination from non-operative state (post-rescission) |

### D-1. Per-mode event shape (center declaration)

**Five canonical modes; mutually exclusive per event.** Each mode emits a distinct canonical event. All five reference the prior event or chain by hash, never by human identifier. All five carry a `reason` field whose structure is mode-specific and an `authorization` field pointing at a WOS authorization record.

**Correction.**
- Formspec Respondent Ledger: `ResponseCorrection` event referencing prior `ResponseSubmitted.canonical_event_hash`. Narrows to a declared subset — does not rewrite the prior response.
- WOS: `CorrectionAuthorized` provenance record. Deontic constraint gate: who may correct, under what scope.
- Trellis: ordinary append to the existing ledger chain. No chain-linkage.

**Amendment.**
- Respondent Ledger: no respondent action (amendment is a governance act; respondent may have triggered it via appeal but does not sign the amendment).
- WOS: `AmendmentAuthorized` + `DeterminationAmended` records. Requires `AuthorizationAttestation.predicate: "amendment-authority"`.
- Trellis: append to existing chain. `DeterminationAmended.supersedes_event_hash` references the prior determination event by canonical hash.

**Supersession.**
- Respondent Ledger: a new ledger begins for the superseding case; its first event carries `supersedes_chain: { chain_id, checkpoint_hash }`.
- WOS: the superseding case's workflow instance carries `caseRelationship.type: "supersedes"` (extends existing kernel enum).
- Trellis: new envelope. The chain-linkage cite is encoded as a **registered extension key** under the Trellis Core §6.7 generic-extensions-container registry, key `supersedes_chain_id` carrying `{ chain_id, checkpoint_hash }`. Phase-1 deployments populate the extension key; Trellis ADR 0003's named-field-reservation mechanism does not gate this — the §6.7 registry is the canonical extension surface, and `supersedes_chain_id` is a registered key, not a reserved named field. Cross-chain linkage at the wire is hash-anchored; the verifier resolves the linkage at bundle composition time per D-3.

**Rescission.**
- Respondent Ledger: no respondent action.
- WOS: `RescissionAuthorized` + `DeterminationRescinded` records. Determination state transitions to non-operative (re-activatable via Reinstatement; see below).
- Trellis: append to existing chain. The chain is **not** sealed by rescission — Reinstatement is permitted on the same chain. A `DeterminationRescinded` event is followed by either Reinstatement (D-1.5) or chain closure via supersession; new determination events without intervening Reinstatement are integrity violations (see D-3).

**Reinstatement (post-rescission re-activation).**
- Respondent Ledger: no respondent action.
- WOS: `Reinstated` record (Facts tier) referencing the prior `DeterminationRescinded.canonical_event_hash`. Determination state transitions back to operative; evaluation context resumes from the pre-rescission state.
- Trellis: append to existing chain. The chain remains the same chain; no new chain opens.

Reinstatement is **not** an amendment. Amendment changes a determination's content; Reinstatement re-activates a previously-rescinded determination as-was. The deontic burden differs: Reinstatement requires its own `AuthorizationAttestation` with `mode: "reinstatement"` and is bounded by deontic policy (`reinstatementPolicy`) parallel to the other four modes.

### D-2. Authorization shape (center declaration; WOS-owned)

All five modes require a WOS `AuthorizationAttestation` provenance record:

```
AuthorizationAttestation {
  mode: "correction" | "amendment" | "supersession" | "rescission" | "reinstatement",
  authorizingActorId: string,
  authorityBasis: AuthorityBasis,                    // discriminated union; see below
  evidenceReferences: [EvidenceReference],           // §4.4 #38 shape
  statuteReference: URI | null,
  timestamp: RFC3339                                 // millisecond-or-better per ADR 0069 D-2
}

// Discriminated union — both cases are real and the union types both.
AuthorityBasis =
  | { kind: "uri", value: URI }                      // statute or external policy URI
  | { kind: "actorPolicyRef", value: string }        // intra-document ActorPolicy.id reference
```

`AuthorityBasis` is a discriminated union: `{kind: "uri", value: <URI>}` for statute or external policy URIs, OR `{kind: "actorPolicyRef", value: <ActorPolicy.id>}` for intra-document policy references. Both cases are real authorship surfaces; the union types both. Free-string `authority_basis` is rejected — the discriminator is load-bearing because verifier diagnostics differ between "this references an external statute" and "this references an in-document deontic policy."

The deontic constraint lives in Workflow Governance under named policies — `amendmentPolicy`, `rescissionPolicy`, `reinstatementPolicy`, etc. — each binding an `AppealMechanism`-shaped gate to the mode. Impact-level floor follows the vision-model default: rights-impacting cases require `Assurance ≥ high` on the authorizing actor.

### D-3. Verifier obligations (Trellis-owned)

Trellis verifier gains three checks:

- **Chain-linkage resolution.** Given a bundle containing a superseded chain's checkpoint, the verifier MUST confirm the superseding chain's header cites the exact checkpoint hash by byte equality. Mismatch is an integrity failure.
- **Correction-preservation.** When a `ResponseCorrection` event appears, the verifier MUST surface both original and corrected field values in its report output. Original fields are never redacted from the chain; corrections are additive.
- **Rescission non-finality with Reinstatement carve-out.** When a `DeterminationRescinded` event appears, the chain remains open for exactly one continuation: a `Reinstated` event re-activating the prior determination. Any subsequent **determination-content-changing** event on the same chain without an intervening `Reinstated` is an integrity violation — signed but semantically invalid. Amendment-after-rescission is not permitted; the lawful continuations are: (a) Reinstatement, restoring the prior determination as-was; (b) supersession, opening a new chain. After a `Reinstated` event, ordinary post-determination events (further amendment, further rescission) become valid again on the same chain.

### D-4. Bundle format (Trellis-owned)

Export bundles for superseded cases MAY include predecessor chain(s) as additional top-level members. A new `supersession-graph.json` manifest at the bundle root enumerates the linkage:

```
{
  "head_chain_id": ChainId,
  "predecessors": [
    { "chain_id": ChainId, "checkpoint_hash": Hash }
  ]
}
```

The verifier walks this graph breadth-first to compose a complete case history. Cycles are integrity violations.

### D-5. Relationship to ADR 0067 (statutory clocks)

A statute-of-limitations question — "may this decision still be amended?" — is a governance-policy question, answered by a statute clock (ADR 0067) and the amendment deontic constraint (D-2 above). Integrity is unaffected by statute expiry: the chain records whatever the governance layer permits to happen. A rejected amendment is not recorded; a permitted amendment is recorded and its legality is an audit question, not an integrity one.

## Consequences

**Positive.**
- Append-only integrity preserved across all four modes. Nothing mutates.
- Every revisit carries an authorization attestation scoped by deontic constraint — governance auditability is structural, not convention.
- Respondent-facing acts (correction, supersession via appeal) are visible in the Respondent Ledger; governance-only acts (amendment, rescission) are not conflated with respondent acts.
- Composes with existing seams: `caseRelationship`, `EvidenceReference`, `ProvenanceKind`, Trellis envelope reservations.

**Negative.**
- Adds **seven** WOS Facts-tier provenance record kinds (`CorrectionAuthorized`, `AmendmentAuthorized`, `DeterminationAmended`, `RescissionAuthorized`, `DeterminationRescinded`, `Reinstated`, `AuthorizationAttestation`) and one Formspec Respondent Ledger event (`ResponseCorrection`).
- Trellis Phase-1 deployments populate `supersedes_chain_id` as a registered §6.7 extension key on supersession; all five modes are active in Phase 1 (including supersession). The prior framing that gated supersession to Phase 4 is rejected — the Q41 reframing of `supersedes_chain_id` as registered extension key (not named-field reservation) makes Phase-1 activation correct.
- New conformance fixture set required in each layer.

**Neutral.**
- Does not resolve statute-of-limitations semantics — that is ADR 0067's scope.
- Does not define what evidence MUST accompany each mode — that is governance-policy, authored per deployment.

## Implementation plan

Truth-at-HEAD-after-cluster-implementation.

**Formspec.**
- Add `ResponseCorrection` event shape to Respondent Ledger §6; reference prior event by `canonical_event_hash`.
- Corrected field set is a strict subset of the prior response; schema enforces via `required` constraint pointing at a declared subset.

**WOS.**
- Agent A lands **seven** new `ProvenanceKind` variants, all Facts tier with constructors:
  - `ProvenanceKind::CorrectionAuthorized` → `ProvenanceRecord::correction_authorized`
  - `ProvenanceKind::AmendmentAuthorized` → `ProvenanceRecord::amendment_authorized`
  - `ProvenanceKind::DeterminationAmended` → `ProvenanceRecord::determination_amended`
  - `ProvenanceKind::RescissionAuthorized` → `ProvenanceRecord::rescission_authorized`
  - `ProvenanceKind::DeterminationRescinded` → `ProvenanceRecord::determination_rescinded`
  - `ProvenanceKind::Reinstated` → `ProvenanceRecord::reinstated` (the fifth-mode variant; new in this revision)
  - `ProvenanceKind::AuthorizationAttestation` → `ProvenanceRecord::authorization_attestation`
- All seven tier as Facts. The Narrative tier is reserved for actual narrative annotations (`NarrativeTierRecorded`), not structured-fact records about determination state changes. The prior framing ("five mode-specific records tier as Narrative") is rejected — these are state-changing structured facts, not annotations.
- Agent B lands seven schema `$def`s in `wos-workflow.schema.json` matching the variant names.
- Add `amendmentPolicy`, `rescissionPolicy`, `reinstatementPolicy` sidecar sections to Workflow Governance. `correctionPolicy` and `supersessionPolicy` follow the same shape.
- Extend `caseRelationship.type` open enum with `supersedes`.
- Provenance exporters emit the seven kinds as distinct event types in PROV-O / OCEL / XES.
- 5-mode amendment-taxonomy lint candidate: `K-A-010` rejects any record claiming `mode: "<other>"` outside the closed five-mode set (with `x-*` extension carve-out for vendor amendment kinds).

**Trellis.**
- `supersedes_chain_id` is a registered extension key under Trellis Core §6.7 generic-extensions-container registry. Phase-1 deployments populate the key; runtime activation is not deferred. (Q41 reframing — this corrects prior prose that miscast the slot as a named-field reservation.)
- Land `append/011-correction`, `append/012-amendment`, `append/013-rescission`, `append/014-reinstatement`, `append/015-supersession` vectors (Phase 1; all five active).
- Draft `supersession-graph.json` spec; activate per D-4.
- Extend verifier with D-3 obligations including Reinstatement-after-Rescission validity.

### Q32 binding: MigrationPinChanged + supersession sequencing

When supersession also changes a version pin (per [ADR 0071](./0071-stack-cross-layer-migration-and-versioning.md) D-5 breaking-semantics path), the `RescissionAuthorized` event on the old chain MUST include a `migrationPinChange` field referencing the new chain's pin event by hash:

```
RescissionAuthorized {
  ...
  migrationPinChange: {
    newChainId: ChainId,
    pinEventHash: Hash,                              // first-event hash on the new chain carrying the new pin
    rationale: string                                 // governance rationale for the pin change
  } | null,                                          // null when supersession does not change pins
  ...
}
```

Cross-chain linkage at the wire is **hash-anchored**. The supersession-graph is not "linked by name" — it is linked by hash, like every other Trellis composition. Schema requires `migrationPinChange` non-null when the new chain's first-event pin differs from the old chain's pin set; verifier rejects supersessions that fail to declare the pin change explicitly.

## Open questions

1. **Multi-chain supersession webs.** Default: verifier walks `supersession-graph.json` breadth-first; cycles are integrity violations. Alternative: Phase-1 restricts to linear webs. Recommendation: default — cycles are signal of authoring error, not legitimate workflow shape.
2. **Correction field-set scope.** Default: corrections narrow to a declared subset of fields. Alternative: unrestricted within the same case. Recommendation: default — prevents correction from being a backdoor amendment.

**Resolved (this revision).**
- ~~Rescission of a rescission~~ — resolved by adding the fifth mode: post-rescission re-activation is `Reinstatement` (D-1.5; new `ProvenanceKind::Reinstated`), not amendment. The taxonomy is closed and lint-enforced (5-mode amendment-taxonomy lint `K-A-010`). Treating post-rescission reactivation as amendment was incorrect: amendment changes determination content; reinstatement re-activates the prior determination as-was. Different deontic burdens, different policy gates, different audit signals.

## Alternatives considered

**Pure append-only with no revisit concept.** Rejected — real workflows need the capability; deferring it produces three divergent per-layer implementations.

**Mutation-based amendment (overwrite in place).** Rejected — breaks Trellis integrity posture; violates vision-model Q3 (opinionated, closed taxonomies).

**Single `Revision` event covering all four modes.** Rejected — collapses deontically distinct acts. Correction does not deserve the same authorization burden as supersession; rescission does not share terminal semantics with amendment.

**Defer supersession to a post-1.0 phase.** Rejected — cross-chain linkage is the shape that most constrains the envelope. Reserving the header slot now and gating runtime to Phase 4 follows Trellis ADR 0003's maximalist-envelope / restrictive-runtime discipline, not the speed-gate discipline it superficially resembles.
