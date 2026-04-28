# ADR 0068: Stack Contract — Tenant and Scope Composition

**Status:** Proposed
**Date:** 2026-04-21
**Last revised:** 2026-04-28 (maximalist position cluster revision)
**Coordinated cluster ratification:** This ADR ratifies as part of the WOS Stack Closure cluster (0066–0071) — all six ratify together once Agent A's `ProvenanceKind` variants and Agent B's schema `$defs` land. See `wos-spec/COMPLETED.md` Session 17 (forthcoming) for implementation tracking.
**Scope:** Cross-layer — Formspec + WOS + Trellis
**Related:** [STACK.md Open Contracts](../../STACK.md#open-contracts); [ADR 0061 (WOS custodyHook wire format)](../../wos-spec/thoughts/adr/0061-custody-hook-trellis-wire-format.md) (TypeID tenant prefix; this ADR pins the tenant grammar — see §D-1.1); [ADR 0066 (amendment and supersession)](./0066-stack-amendment-and-supersession.md) (cross-bundle boundaries; cross-tenant supersession composes per §D-5); [ADR 0067 (statutory clocks)](./0067-stack-statutory-clocks.md); [ADR 0069 (time semantics)](./0069-stack-time-semantics.md); [ADR 0070 (failure and compensation)](./0070-stack-failure-and-compensation.md) (tenant scope is the failure-isolation boundary); [ADR 0071 (cross-layer migration and versioning)](./0071-stack-cross-layer-migration-and-versioning.md) (scope-bundle four-tuple is identity; pin set is orthogonal version metadata); WOS #3 migration routing; WOS `DurableRuntime` tenant-scope contract (session 9); Trellis Core §17 ledger scope; Trellis Core §22.4 (case-ledger composition); [parent TODO](../../TODO.md) stack-wide section

## Context

Three layers, three scoping concepts — all authored independently, none declared to compose.

- **Formspec** scopes by *definition* — one definition version governs one response.
- **WOS** scopes by *tenant* via the `DurableRuntime` contract (session 9), separately by *workflow* via kernel instance id.
- **Trellis** scopes by *ledger* — the hash-chain boundary.

No stack-level statement says how these three compose. The public-SaaS wedge requires hard tenant isolation — one customer's case must never leak into another customer's chain. Multi-program government agencies need program-level isolation inside a tenant. Cross-tenant actor identity (a caseworker serving multiple tenants) is a common pattern. Today each concern is solved per-deployment, which is exactly how multi-valent centers become narrow ones.

Listed in [STACK.md Open Contracts](../../STACK.md#open-contracts) as an integration primitive — composition protocol, not event shape. Touches all three layers; no adapter fills the gap.

This ADR is part of the **WOS Stack Closure cluster (0066–0071)**. The four-tuple scope bundle is the case's identity. ADR 0066 supersession opens a new chain within the bundle (or, by §D-5, into a new bundle via supersession across tenants). ADR 0070 D-? failure-isolation rests on tenant scope. ADR 0071 separates identity (this ADR; immutable) from version pins (ADR 0071; mutable through governance).

## Decision

**Hierarchical composition.** Tenant is the outermost container; the three per-layer scopes nest inside it. A case belongs to exactly one four-tuple — the *scope bundle* — for its entire lifetime.

### D-1. Tenant is the outermost container

Every record produced by any layer for any case carries the tenant identifier. Cross-tenant reads are impossible by construction — the runtime, the ledger, and every storage tier MUST refuse reads that cross the tenant boundary. Tenant is not an application-level filter; it is a substrate boundary honored by all three layers.

#### D-1.1. Tenant identifier grammar — RFC 1035 DNS-label compatible

Tenant identifiers MUST match `^[a-z][a-z0-9-]{0,62}$` (1–63 characters, lowercase ASCII letter prefix, lowercase alphanumeric + hyphen body). The 63-character limit is RFC 1035 DNS-label maximum, not arbitrary.

Rationale: tenant→subdomain mapping is the SaaS pattern. Aligning the tenant ID grammar with DNS-label limits means each tenant maps 1:1 to a subdomain (`{tenant}.example.com`) without re-encoding, truncation, or collision risk. The 63-char limit is the standards-anchored reality of the deployment surface — not a synthetic constraint.

Implementation consequence: [ADR 0061](../../wos-spec/thoughts/adr/0061-custody-hook-trellis-wire-format.md) TypeID grammar (`{tenant}_{type}_{uuidv7_base32}`) MUST adopt this regex on the tenant prefix; the existing `is_valid_tenant` Rust validator MUST update accordingly. The Trellis envelope `tenant` field and the WOS `CaseInstance.tenant` field share the grammar — one rule, three consumers.

### D-2. A case's scope bundle is the four-tuple `(Tenant, DefinitionId, KernelId, LedgerId)`

| Identifier | Owned by | Meaning |
|---|---|---|
| `Tenant` | stack | outer isolation boundary |
| `DefinitionId` | Formspec | the definition version the case's responses validate against |
| `KernelId` | WOS | the workflow kernel the case evaluates under |
| `LedgerId` | Trellis | the hash-chain the case's events belong to |

Authoring-time constraint: the four components MUST be declared jointly at case open and MUST NOT change for the case's lifetime. A mismatched tuple — a response against `DefinitionId` submitted into a chain opened under a different `DefinitionId` — is a configuration error rejected at runtime.

`LedgerId` here is the `ledger_scope` of the WOS case-governance chain. Multi-response composition (a case accumulating multiple respondent responses, each into the case ledger) follows Trellis Core §22.4 (case-ledger composition) and does not change this identifier. The four-tuple is a single chain identity, not a multi-chain set.

The four-tuple is **identity**, not **version pins**. Version pins live on first-event payloads per [ADR 0071](./0071-stack-cross-layer-migration-and-versioning.md) §D-1; pins evolve through authorized migration. The four-tuple itself is immutable for the case's lifetime — this is the load-bearing distinction between this ADR and ADR 0071.

### D-3. Actors span tenants; authorization is per-tenant

A reviewer's identity is first-class across tenants. The same human holds one global identity. But *authority* — which cases this human may read, review, or decide — is per-tenant. Authorization grants in one tenant do not transfer to another.

Rationale: identity-as-global matches how people actually work (one reviewer serves many counties). Authority-as-per-tenant preserves isolation at the capability layer.

#### D-3.1. `IdentityAttestation` — cross-tenant identity proof shape

Every cross-tenant actor reference MUST carry an `IdentityAttestation` provenance record (Facts tier). The attestation binds a global identity to a verifying authority and the assurance characteristics that authority asserts:

```
IdentityAttestation {
  caseId: TypeID,                                // case context for the attestation
  subjectGlobalId: string,                       // tenant-independent identifier (URI; e.g., did:web, urn:idp:subject)
  assuranceLevel: "low" | "medium" | "high" | "very-high" | "x-*",
                                                 // closed taxonomy + x-* extension
  attestationProvider: URI,                      // identity-proofing adapter (issuer)
  providerAttestationId: string,                 // provider's own attestation reference
  attestedAt: RFC3339,                           // millisecond-or-better per ADR 0069 D-2
  validUntil: RFC3339 | null,                    // null = indefinite
  attestedPredicates: [string],                  // capabilities/claims the provider attests
                                                 // (e.g., ["jurisdiction:CA", "role:reviewer", "license:bar-CA-12345"])
  timestamp: RFC3339                             // record emission time
}
```

The `subjectGlobalId` is tenant-independent. Per-tenant authorization grants reference it; cross-tenant trust depends on `attestationProvider` and `assuranceLevel`. The `attestedPredicates` field carries the structured claims the provider stands behind — predicates, not free text.

`IdentityAttestation` is a Facts-tier `ProvenanceKind`. Agent A lands the variant, constructor `ProvenanceRecord::identity_attestation`, four unit tests, and two conformance fixtures (one same-tenant, one cross-tenant). Agent B lands schema `$def` at `$defs/IdentityAttestationRecord`. The shape is normative as of this ADR; PLN-0381 is closed.

### D-4. Case ID scope is tenant × ledger

TypeID format (per [ADR-0061](../../wos-spec/thoughts/adr/0061-custody-hook-trellis-wire-format.md)) already encodes tenant as a prefix: `{tenant}_{type}_{uuidv7_base32}`. This ADR makes the prefix *load-bearing across all three layers*: a case ID is unique within a `(Tenant, LedgerId)` pair, not globally. Verifiers and storage layers MUST treat the tenant prefix as scope, not as opaque string.

### D-5. Migration within a scope bundle is permitted; across bundles is prohibited

A case may move through workflow states, definition migrations (opt-in per [ADR 0071](./0071-stack-cross-layer-migration-and-versioning.md)), and governance amendments (per [ADR 0066](./0066-stack-amendment-and-supersession.md)) — all within its scope bundle. A case MUST NOT migrate across tenants. Cross-tenant case movement is a rights-impacting correctness risk — evidence, authorization, and audit trails anchor to the source tenant's substrate. Pattern is available via [ADR 0066](./0066-stack-amendment-and-supersession.md) supersession: the destination tenant opens a new case that supersedes; the source chain remains intact.

## Consequences

**Positive.**
- Multi-tenant SaaS has structural isolation, not convention.
- Program-level isolation inside a tenant via distinct scope bundles.
- Auditors always answer "which tenant does this case belong to?" by reading the case ID.
- TypeID tenant prefix carries the invariant mechanically.

**Negative.**
- Every runtime carries tenant context in every call. Non-trivial API-surface impact on adapters.
- Some patterns (cross-tenant case reassignment, multi-tenant shared evidence pools) become unavailable. Supersession is the substitute.
- D-1.1 grammar is stricter than the prior opaque-string assumption; existing TypeID grammar and `is_valid_tenant` MUST update. One-time mechanical fix; greenfield posture absorbs the change.
- D-3.1 `IdentityAttestation` shape adds a Facts-tier provenance kind; identity-proofing adapters MUST emit conforming attestations.

**Neutral.**
- Does not prescribe tenant encoding. A DurableRuntime adapter may implement tenant as Temporal namespace, Restate partition, or Postgres schema — the choice is adapter-concern.

## Implementation plan

Truth-at-HEAD-after-cluster-implementation.

**Formspec.**
- Respondent Ledger §6 event envelope gains a REQUIRED `tenant` field at the top level matching D-1.1 grammar.
- Canonical response schema gains a top-level `tenant` field with the same regex.
- Runtime re-validation paths refuse responses whose `tenant` does not match the runtime's current scope.

**WOS.**
- Agent A lands `ProvenanceKind::IdentityAttestation` (Facts tier) with constructor `ProvenanceRecord::identity_attestation`. Four unit tests + two conformance fixtures.
- Agent B lands schema `$def` at `$defs/IdentityAttestationRecord` in `wos-workflow.schema.json` carrying the D-3.1 field set.
- `DurableRuntime` trait API carries tenant context on every method; existing impls updated.
- `CaseInstance` struct gains a required `tenant: String` field with D-1.1 grammar validation.
- Kernel `caseRelationship` enforces same-tenant at lint time; cross-tenant relationships are rejected with rule `K-C-010` (cross-tenant relationships flow through ADR 0066 supersession, not direct relationship).
- Governance policies may scope by tenant via FEL on existing `scope` field (no new mechanism).
- `is_valid_tenant` validator updates to D-1.1 regex.

**Trellis.**
- Envelope header gains REQUIRED `tenant` field paired with `ledger_id`, validated against D-1.1 grammar.
- Verifier MUST refuse a chain whose tenant mismatches the expected scope context.
- Export bundles carry tenant at the bundle level.

**Stack-level.**
- TypeID registration ([ADR-0061](../../wos-spec/thoughts/adr/0061-custody-hook-trellis-wire-format.md) T1.1) carries this ADR as a normative reference and adopts D-1.1 grammar.

## Open questions

1. **Scope-bundle re-declaration on supersession (confirmed default).** Same-tenant supersession reuses `(Tenant, DefinitionId, KernelId)` and mints a new `LedgerId` only. Cross-tenant supersession (per [ADR 0066](./0066-stack-amendment-and-supersession.md) §D-5) mints fresh across the entire bundle — the destination tenant opens a new case. Confirmed-default; the supersession-graph.json linkage from [ADR 0066](./0066-stack-amendment-and-supersession.md) D-4 disambiguates either way.

**Resolved (this revision).**
- ~~Tenant identifier format~~ — resolved by D-1.1: `^[a-z][a-z0-9-]{0,62}$` with RFC 1035 DNS-label rationale; binding on TypeID grammar and `is_valid_tenant`.
- ~~Actor-across-tenants identity format~~ — resolved by D-3.1: `IdentityAttestation` shape pulled inline; PLN-0381 closed.

## Alternatives considered

**Flat scoping — three independent axes.** Rejected. Cross-tenant leakage becomes possible by omission; any layer that forgets to check tenant opens a hole.

**Tenant as adapter-only concern.** Rejected. Tenant is observable in every cross-layer operation (a case ID carries it; a chain's scope is defined by it). Adapter-only means different adapters could produce different observable outcomes for the same authored documents — violates the center-vs-adapter test.

**Per-layer independent scoping with no cross-layer pin.** Rejected. Composition becomes per-deployment convention; multi-valent center narrows to the first deployment shape.

**Program as a first-class kernel concept.** Rejected. "Program" is a human-organizational construct that varies across adopters (government agencies have programs; SaaS tenants may or may not). The four-tuple is the formal primitive; "program" is prose at the application layer.
