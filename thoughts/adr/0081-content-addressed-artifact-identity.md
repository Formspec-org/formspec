# ADR 0081: Content-Addressed Artifact Identity

**Status:** Proposed
**Date:** 2026-04-27
**Scope:** Stack-wide — WOS workflow definitions, contracts, sidecars, capability declarations, service interfaces; Formspec definitions; cross-spec `*Ref` semantics
**Related:** [ADR 0061 (custody-hook Trellis wire format)](./0061-current-state-authoring-runtime.md); [ADR 0072 (stack evidence integrity and attachment binding)](./0072-stack-evidence-integrity-and-attachment-binding.md); [ADR 0076 (product-tier consolidation)](./0076-product-tier-consolidation.md); [ADR 0080 (governed output-commit pipeline)](./0080-governed-output-commit-pipeline.md); [ADR-0074 (formspec-native field-level transparency)](./0074-formspec-native-field-level-transparency.md); [`wos-spec/specs/kernel/spec.md`](../../wos-spec/specs/kernel/spec.md) §5.4 `caseFileSnapshot` (existing JCS+SHA-256 precedent at L444); [`wos-spec/counter-proposal-disposition.md`](../../wos-spec/counter-proposal-disposition.md) §H4 (workflow definition immutability)

## Context

Definition-class artifacts in the stack are referenced by label tuples — `(id, version)` for workflow definitions, `{url}|{version}` for cross-document refs, plain URIs for capability declarations, contracts, and sidecars. These tuples are **advisory labels**, not verifiable identities. Anyone with write access to the source-of-record can mutate the body of `pfml-review@2026.1.0` without bumping the label, and audit trails that record "ran on `pfml-review@2026.1.0`" can no longer be reproduced from the label alone.

The FlowSpec counter-proposal (`wos-spec/counter-proposal.md` §2.1) raised this gap and proposed a normative immutability rule: once `status: "active"`, content MUST NOT change. The disposition flagged it as H4 PARTIAL — Kernel §9.6 covers *instance-level* version pinning (running instances stay on creation-time content), but no rule covers *document-level* content binding.

Two posture choices for closing the gap:

1. **Normative immutability MUST.** Forbid in-place edits via spec text. Unenforceable — relies on registry/process discipline downstream of the spec.
2. **Content-addressing.** Bind identity to a hash of the canonicalized body. The label is advisory; the hash is the verifiable identity. Mutating in-place either flips the hash (caught) or is content-equivalent (no problem).

The stack already content-addresses in fragments:

- **Trellis** is content-addressed by design (hash-chained events, anchored custody, ADR 0072 evidence integrity).
- **WOS Kernel §5.4 `caseFileSnapshot`** already uses JCS (RFC 8785) canonicalization + SHA-256 for determination evidence (`spec.md:444`).
- **ADR 0080 D-2** argues `outputContractRef` should be content-addressable so `verificationLevel` + Trellis custody compare cleanly across calls — same rationale, narrower artifact.
- **ADR-0074** per-class encryption uses content-addressed buckets in key bag patterns.

Content-addressing is the settled stack posture for evidence and AI output contracts. This ADR extends it to **all definition-class artifacts** — which closes H4 with a verifiable mechanism instead of an unenforceable rule.

## Decision

### D-1. JCS-then-SHA-256 as the canonical hash form

Hash form for all definition-class artifacts: **JCS-canonicalize per RFC 8785, then SHA-256.** Identical content with different formatting (whitespace, key ordering, redundant escape sequences) MUST produce byte-identical canonical forms and identical hashes. Functional changes always flip the hash.

This matches the existing `caseFileSnapshot` precedent (`wos-spec/specs/kernel/spec.md:444` — `jcsCanonical` + `sha256` fields). One canonicalization algorithm across the stack; no per-artifact ceremony to choose.

### D-2. Three-segment `*Ref` form

Reference syntax extends from `{url}|{version}` to `{url}|{version}|sha256:{hex}`:

```
formRef:    "https://state.gov/pfml/application-workflow|2026.1.0|sha256:a3f5..."
contractRef: "https://wos.gov/contracts/medical-cert|1.2|sha256:b8c2..."
```

The third segment is OPTIONAL at L0. Backward-compatible: omitting the hash falls back to label-based reference (advisory, non-verifiable). Lint warns at non-rights-impacting tier; lint MUSTs at rights-impacting tier (D-5).

### D-3. Provenance binding

`FactsTierRecord` (Kernel §5.4) extends with `definitionContentHash` — recorded when a record names a definition artifact:

- `caseCreated` records the workflow definition hash.
- `determination`-tagged transitions record the workflow definition hash alongside `caseFileSnapshot.sha256`.
- `capabilityInvocation` records the capability declaration hash.
- `signatureAffirmation` records the signature-block hash.
- Service invocation records the service interface contract hash.

Audit trails become structurally verifiable: given a provenance log + the claimed definitions, recompute the canonical hash and compare. No registry policy required.

### D-4. Subsumes FlowSpec §2.1 immutability rule (H4)

This ADR replaces the proposed normative "once active, content MUST NOT change" rule with content-addressing. Mutating a definition's body in-place under the same label is no longer prohibited — it's verifiable. A case that recorded the old hash compared against the new content body returns a hash mismatch, which is the evidence of tampering. Defense in depth, not gatekeeper.

PLN-0358 (the proposed document-level immutability row) is closed as subsumed.

### D-5. Scope and tiering

Definition-class artifacts in scope:

| Artifact | Today's ref shape | Hash binding |
|---|---|---|
| Workflow definition | `(id, version)` / `{url}\|{version}` | OPTIONAL at L0, MUST at `rightsImpacting` / `safetyImpacting` |
| Contract / Formspec definition (`contractRef`, `formRef`) | URI \| version | Same |
| Capability declaration (AI Integration §3.3) | URI reference | OPTIONAL at L0, MUST when `agents[]` present |
| Service interface contract (`serviceRef`, Kernel §9.2) | URI | OPTIONAL at L0, MUST at `rightsImpacting` |
| Sidecars (governance, agents, aiOversight, signature, custody, advanced, assurance) | URI | OPTIONAL at L0, MUST when `impactLevel` triggers the block |
| Tooling registries, extension manifests | URI | OPTIONAL at L0 |

Out of scope for v1.0: notification templates, locale bundles, business calendar sidecars. Hash-binding adds complexity disproportionate to integrity risk for these. Can extend later under this same ADR.

### D-6. Trellis custody integration

Workflow definition content hashes flow through `custodyHook` for anchoring per ADR 0072's evidence integrity pattern. Trellis anchors the hash; WOS emits it. The `custodyHook` four-field append shape (per ADR 0061) carries the definition hash as one of the anchored facts, so the audit-trail integrity of "this case ran on this definition body" composes with Trellis's existing chain-integrity guarantees.

No new Trellis primitive — the existing evidence-anchoring pattern handles it.

## Implementation plan

1. **Schema changes.** Extend `*Ref` pattern in `wos-workflow.schema.json` and sidecar schemas to accept the three-segment form. Hash field is OPTIONAL initially; lint enforces at rights-impacting tier (Step 5). Cross-spec: `formRef` parser in `crates/wos-formspec-binding` updates to parse the third segment.
2. **Canonicalization library.** Reuse existing JCS implementation from `wos-spec/crates/wos-core/src/snapshot.rs` (already used for `caseFileSnapshot.jcsCanonical`). Lift into a shared `wos-canonical` crate or expose as `wos-core::canonicalize`. Same algorithm across `caseFileSnapshot`, definition hashing, and any future content-addressed surface.
3. **Provenance schema.** Add `definitionContentHash` field to `FactsTierRecord` $defs. OPTIONAL initially; required when the record names an artifact whose ref carries a hash segment.
4. **Reference parser.** Update cross-document ref parser (likely in `wos-core` and Formspec adapters) to extract the hash segment, expose `(url, version, hash?)` triple, and provide hash-verification helpers.
5. **Lint `WOS-CONTENT-HASH-001`.** Rights-impacting workflows MUST hash-pin all `*Ref` fields per D-5 tiering table. Warning at non-rights-impacting tier. Conformance class: Kernel Structural (schema-checkable when paired with `impactLevel`).
6. **Conformance fixtures.** Positive: hash matches, mutation produces identical hash. Negative: hash mismatch caught at load time. Three-way agreement: spec + in-memory adapter + Restate adapter.
7. **Trellis custody integration.** Workflow content hash flows through `custodyHook` per ADR 0072 evidence pattern. Coordinate with Trellis side to add definition-hash event type.
8. **Migration.** Existing references without hash segments remain valid (D-2 backward compatibility). New rights-impacting workflows authored after this ADR ratifies MUST include hashes per Step 5 lint.

## Consequences

- **Audit trails become verifiable, not assertion-based.** "This case ran on `pfml-review@2026.1.0` content `sha256:a3f5...`" is reproducible from the provenance log alone.
- **Registry/publishing systems stop being load-bearing for definition integrity.** They become defense-in-depth (a registry that rejects label-collision is helpful) rather than the primary integrity mechanism.
- **Reformatting becomes safe.** JCS canonicalization means whitespace + key-order changes produce identical hashes; functional changes always flip them.
- **ADR 0080 D-2 reframes.** `outputContractRef` becomes a special case of this ADR's content-addressing pattern rather than carrying its own rationale. ADR 0080 D-2 prose updates to point at this ADR.
- **Subsumes PLN-0358.** Document-level immutability rule is closed in favor of content-addressing.
- **Cross-spec coordination.** Formspec definitions are JSON; canonical-form is trivial. Trellis already content-addresses; this ADR adds one more anchored event type.

## Alternatives considered

- **Bytes-as-published hashing.** Hash whatever bytes were authored. Simpler verification (no canonicalization step), but trivial reformat changes flip the hash, breaking audit-trail comparability under valid maintenance. Rejected for incoherence under maintenance churn.
- **Normative document-immutability MUST (FlowSpec §2.1).** Forbid in-place edits via spec text. Unenforceable; relies on registry discipline downstream of spec; creates false confidence. Rejected — closes a real gap with an unverifiable mechanism.
- **Per-class signature-only.** Sign every published artifact with the Trellis signing pipeline; identity is the signed envelope. Heavier than needed for definition-identity; signatures are for evidence and signed envelopes (per Trellis posture). Hash-only is the right primitive for definition identity. Rejected as scope mismatch.
- **CID / IPFS-style multihash.** Multi-algorithm hash form. Adds flexibility without a current concrete need; SHA-256 is the existing precedent. Rejected for v1.0; extension via the open `oneOf` pattern (per ADR 0080 D-1 example) remains available later.

## Open questions

1. **L0 strictness.** Should hash-pinning be MUST at L0 across all artifacts, or only at rights-impacting/safety-impacting tiers? D-5 leans tiered: OPTIONAL at L0, MUST at rights-impacting. Confirms with conformance gating: rights-impacting workflows can't claim conformance without hash-pinning. Counterargument: optional hashing means non-rights-impacting workflows can still drift silently. Resolution: tiered now, evaluate after one production cycle.
2. **Hash truncation in display.** Full SHA-256 (64 hex chars) is unwieldy in human-readable contexts. Lean: full hex in stored references and provenance; short form (first 7 like git, or first 12) acceptable in display contexts. Lint MAY warn against short-hash references in stored data.
3. **Multi-hash extension.** Reserve the `*Ref` syntax to permit `sha256:`, `sha3-256:`, etc., or pin to SHA-256 only at v1.0? Lean: pin to SHA-256 at v1.0 (matches `caseFileSnapshot` precedent). Future ADR adds multi-hash if needed.
