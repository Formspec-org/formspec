---
title: Architecture synthesis — corrected (ARCHIVED)
date: 2026-04-27
status: ARCHIVED 2026-04-27 — merged into VISION.md and STACK.md after r5. Superseded by those docs as canonical sources. Kept as historical record of multi-agent brainstorm + critique sequence + ADR absorption audit trail.
do-not-cite-as-authoritative: cite /VISION.md and /STACK.md instead
canonical-replacements:
  - /Users/mikewolfd/Work/formspec/VISION.md (architectural commitments, reference architecture, open contracts closure plan)
  - /Users/mikewolfd/Work/formspec/STACK.md (public-facing positioning, open contracts, signature attestation status)
audience: historians; future agents wanting provenance of how the 2026-04-27 architectural state was arrived at
authors:
  - Michael Deeb (owner)
  - brainstorm session synthesis (Claude, multiple agents)
supersedes: prior in-session synthesis from 2026-04-27 (not committed)
superseded-by: VISION.md + STACK.md (post-r5 merge)
revisions:
  - 2026-04-27 r1 — initial save after multi-agent critique round
  - 2026-04-27 r2 — feedback fixes (six items):
      (1) signing config imports wos-core Signature Profile schemas; preserves one meaning of signing;
      (2) lead wedge does not imply Federal posture; TEE adapter posture-gated, not center;
      (3) Trellis owns Attestation bytes; signing_intent is URI; meaning lives in WOS Signature Profile;
      (4) formspec-server reframed as reference backend (not Formspec center semantics);
      (5) agent-sdk consumes class-aware policy but does not hold DEKs or perform decryption;
      (6) "ship floor / defer ceiling" renamed to "center commitments close now / profile-specific extensions are trigger-gated"
  - 2026-04-27 r3 — spec-expert / wos-expert / trellis-expert review fixes:
      (a) drop invented Trellis 4-tier signing hierarchy; cite ADR 0006 5-class KeyEntry taxonomy;
      (b) drop invented lifecycle states; cite Core §8.4 Active/Rotating/Retired/Revoked;
      (c) Certificate-of-completion is NOT new — cite Trellis ADR 0007 (Accepted 2026-04-24);
      (d) "workflow-lite profile" → "signature-profile-only deployment"; align with existing Signature Shortcut Rule;
      (e) Respondent Ledger is Formspec center, not server port — rewrite ownership;
      (f) cite Formspec Core S2.1.6 authoredSignatures[]; signing-intent URI populates within, not replaces;
      (g) cite Respondent Ledger §6.7/§6.8/§2.2 for three-plane decoupling (already normative);
      (h) cite ADR-0074 §4 bucketed Response wire shape at IntakeHandoff / three-planes / agent-sdk seams;
      (i) IntakeHandoff = typed artifact (schema-backed); transport (gRPC vs in-process) orthogonal;
      (j) custody-hook-encoding.md added as center commitment;
      (k) wos-server-eventstore-embedded clarified to live in work-spec/crates/, not Trellis;
      (l) cite WOS signature.md §2.3/§2.10 for multi-party signing-order;
      (m) §S4/§S5 → §4/§5 for AI Integration citations (cosmetic);
      (n) "fel-core byte authority" → "grammar + evaluator authority";
      (o) wos.signing.* / wos.governance.legal-hold / formspec.* / respondent.* namespaces marked as proposed (not normative);
      (p) ESIGN/UETA/eIDAS posture mapping flagged as scope reopen of signature.md §1.3;
      (q) Trellis ADR namespace clarified as distinct from parent-repo (next Trellis ADR is trellis/thoughts/adr/0009-*);
      (r) AEAD nonce determinism on retry added as soft spot (real Trellis spec gap);
      (s) tenant-scope export sharpened — Core §18 ZIP is per-ledger_scope; tenant-scope is genuine new shape;
      (t) "Independent-first review protocol" marked as stack-coined name, not WOS-spec normative
  - 2026-04-27 r4 — sonnet-swarm cross-reference fixes (11 items):
      (i)   citation: §S7.15 → Governance §12 (Typed Hold Policies) for legal-hold
      (ii)  citation: §S6 → Governance §4 (Review Protocols) for independentFirst surface
      (iii) citation: cascade scopes CS-01..CS-06 at Companion Appendix A.7, not §20.3-§20.5
      (iv)  ADR-0012: KmsAdapter binding flagged as synthesis-layer architectural decision (not ADR-0012's claim)
      (v)   ADR-0013: absorption row aligned with soft-spot #12 (drop "one byte format covers both" misleading framing)
      (vi)  ADR-0015: drop false "subprocessor list mandatory" attribution (not in source ADR); keep principle as procurement commitment
      (vii) ADR-0009: "folds into ADR 0072 closure" flagged as synthesis linkage (not ADR-0009's claim)
      (viii) ADR-0010: "ProcessingService boundary" flagged as synthesis re-framing (ADR-0010 predates concept)
      (ix)  ADR-0004: surface workload identity as fourth principal class (was dropped in r2/r3)
      (x)   ADR-0006: surface Invariant 5 (deletion follows org boundary, not billing state)
      (xi)  ADR-0002: surface control-plane / data-plane separation invariant (was dropped in r2/r3)
  - 2026-04-27 r5 — semi-formal review fixes + full merge into VISION/STACK; synthesis archived after this revision
---

# Architecture synthesis — corrected

Working picture, not locked. Folds in cross-stack-scout architectural corrections, platform-strategist strategic redirect, and the Trellis-owns-attestation move. ADR absorption table at the end. Nothing in this document is ratified; everything is rewriteable when reality discovers better.

This document captures where the 2026-04-27 brainstorm landed after two rounds of multi-agent critique. It is internal companion to [`VISION.md`](../../VISION.md); proposed VISION edits are not yet drafted.

---

## What changed since the prior synthesis

1. **Cohorts are not architectural primitives.** They're deployment configurations applied to one underlying composition — same pattern wos-server VISION already uses for trust postures.
2. **Lead wedge realigned.** Per [`STACK.md`](../../STACK.md) §Positioning: mid-market regulated CTO with active AI audit finding. Not Jotform-tier consumer. SBA is *one customer in the wedge*, not the wedge itself.
3. **Trellis owns all byte primitives** — envelope COSE (existing), checkpoint signing (existing), Certificate-of-completion (Trellis ADR 0007 already Accepted), AND user-content Attestation bytes/manifests (PROPOSED `trellis/thoughts/adr/0009`). WOS owns the *semantic meaning* of attestation (Signature Profile signing-intent URI registry, signer-authority claim shape, ESIGN/UETA legal posture — last item is a SCOPE REOPEN of signature.md §1.3). `wos-signature-emit` (a synthesis-internal proposal) is dropped; the signing configuration is a **signature-profile-only deployment** that imports `wos-core` Signature Profile schemas without standing up wos-runtime, aligning with the existing Signature Shortcut Rule.
4. **agent-sdk is no longer "neutral."** It *consumes* class-aware policy (Privacy Profile + recipient-class allowlists per [ADR-0074](../adr/0074-formspec-native-field-level-transparency.md)) but does not hold DEKs or perform decryption — decryption authority stays in client or declared ProcessingService boundary. Class-aware agent autonomy is not negotiable; key custody is structurally separate.
5. **Procurement-blocking items added to center commitments.** Accessibility, counsel-pinned legal claim, SOC 2 controls inventory, pricing model, subprocessor list. Confidential-compute adapter selection (TEE/FHE/MPC) is posture-gated, not center; required before first Federal-posture customer, not before SBA PoC. Profile-specific extensions (migration policy, federation) trigger-gated by deployment need.

---

## Lead wedge

> Mid-market regulated CTO with active AI audit finding. Has budget, short cycle, compliance-driven. Sits between SBA-class adjudication (full WOS governance kernel) and DocuSign-replacement signing (no governance kernel needed).

This is the buyer with budget *now*. SBA is one customer that exercises the C-class deployment configuration; the wedge is the segment.

Two supporting deployment paths: signing (no WOS governance) and full adjudication (full WOS). One leads (mid-market regulated). Consumer SaaS is demoted to "future commercialization path appendix" — no architectural commitments in 1.0.

---

## Architecture — one composition

```
TRELLIS (integrity substrate; byte authority via Rust)
├── Envelope COSE_Sign1 (existing — Core §6.6, §7; trellis-cose crate)
├── Signing key registry (Core §8 + Trellis ADR 0006 5-class KeyEntry taxonomy)
│   Classes: signing / tenant-root / scope / subject / recovery
│   Phase-1 envelope reserves all five; runtime emits only `signing` today
│   Lifecycle states (Core §8.4): Active → Rotating → Retired; Revoked reachable from any
│   "Retired is terminal for issuance, not for verification of historical records" (§8.4)
│   Compromise causes transition to Revoked (§25.6); historical signatures remain
│   verifiable; verifier cannot judge compromise from envelope alone
├── User-content Attestation primitive (PROPOSED — needs new Trellis ADR + CDDL §28)
│   Distinct from existing Companion App A.5 Attestation (custody/disclosure/erasure)
│   Phase-1 reservation, Phase-2 activation pattern (per Trellis ADR 0001-0004)
│   byte format of "X attested to Y at time T with key K and intent URI I"
│   binding proof to host event (chain position)
│   reference to IdentityAttestation
│   signing_intent: URI (Trellis owns the field bytes, not the meaning)
│   intent URI registry + normative semantics live in WOS Signature Profile
│   Trellis-internal numbering: next free is trellis/thoughts/adr/0009
├── Certificate-of-completion (Trellis ADR 0007 — Accepted 2026-04-24)
│   `trellis.certificate-of-completion.v1` — already specified, not greenfield
│   CDDL + verifier obligations + fixture plan + C2PA interop sidecar in ADR 0007
│   Composed from SignatureAffirmations + IdentityAttestations + final determination
│   Catalog at `065-certificates-of-completion.cbor` in export bundle
│   PDF rendering is product concern; manifest is byte-pinned
└── Export bundle (Core §18 — scoped to one ledger_scope), chain semantics,
    idempotency wire contract (Core §17 — `(ledger_scope, idempotency_key)`)

WOS (governance semantics — owns meaning, not bytes)
├── wos-core: kernel evaluator, FEL, deontic (§4), autonomy (§5), provenance construction
│   Signature Profile (signature.md):
│     - Multi-party signing-order semantics already specified (§2.3 sequential/parallel/
│       routed/free-for-all; §2.10 witness/counter-signature/notary/in-person dependencies)
│     - SignatureAffirmation provenance record (§2.8) with required fields
│     - Identity binding (§2.6) with closed authentication-method enum
│     - Consent capture via consentReference (§2.5)
│     PROPOSED extensions:
│     - Signing-intent URI registry (NEW — extension of §2.5; populates Formspec
│       authoredSignatures field, NOT replaces it)
│     - Signer-authority claim shape (NEW — capacity-to-bind; logically separate from
│       authentication method; addition to §2.6)
│     - ESIGN/UETA/eIDAS posture mapping (SCOPE REOPEN — currently §1.3 carves these
│       out as out-of-scope; lead-wedge customer requires reopening)
│   Importable as signature-profile-only deployment when wos-runtime is absent
│   (aligns with existing Signature Shortcut Rule in work-spec/CLAUDE.md)
├── wos-runtime: in-memory + conformance oracle + browser WASM
│   Governance overlay on agent-sdk (deontic + autonomy)
│   Stack-coined "independent-first review protocol" (UX-enforcement of Governance §4 Review Protocols;
│     specifically the `independentFirst` value in §4.1 Protocol Definitions)
│   Agent-action provenance via custodyHook (Kernel §10.5)
├── wos-server: production runtime + DurableRuntime adapter (Restate default)
│   EventStore composes trellis-store-postgres (existing crate; rustdoc names this composer)
│   wos-server-eventstore-embedded (NEW; lives in work-spec/crates/, not Trellis)
│     sibling to trellis-store-postgres + trellis-store-memory
│     embedded posture is wos-server deployment concern, not Trellis envelope
├── custody-hook-encoding.md (Kernel §10.5 companion — center commitment)
│   Four-field append wire surface; TypeID rules; JSON→dCBOR
│   THIS is the WOS↔Trellis byte-edge contract; without it
│   "Trellis owns bytes / WOS owns meaning" doesn't compose
└── wos-event-types.md (planned): wos.* namespace event taxonomy
    Existing planned namespaces (custody-hook-encoding.md:315):
      wos.kernel.* / wos.governance.* / wos.ai.* / wos.assurance.*
    PROPOSED additions (this synthesis): wos.signing.* / wos.identity.*
      — must be ratified as taxonomy extensions, not assumed
    Existing legal-hold mechanism: holdType enum value (§S7.15), not event-type;
    if ledger event needed, propose explicit wos.governance.legal-hold-applied addition

FORMSPEC center (spec + crates) — normative bytes and semantics
├── Formspec spec documents (data, behavior, FEL, validation semantics)
│   Core S2.1.6 normatively defines Response envelope including:
│     - authoredSignatures[] with required fields per record:
│       documentHash, documentHashAlgorithm, consentAccepted,
│       consentTextRef, consentVersion, affirmationText
│     - "drawn signature image, typed name, or provider callback alone is not
│       sufficient signing intent" (§S2.1.6 prose)
│   Core S2.1.6.1 normatively defines IntakeHandoff (typed artifact, schema-backed):
│     - intake-handoff.schema.json — required fields including handoffId,
│       initiationMode, definitionRef, responseRef, responseHash, ledgerHeadRef
│     - "Formspec owns intake session, canonical Response, ValidationReport snapshot,
│       respondent-ledger evidence; workflow host owns governed case identity"
│   Core §3 + fel-grammar.md: FEL grammar + evaluator + dependency extraction +
│     null propagation + coercion + aggregate semantics
│   Bucketed Response wire shape (ADR-0074 §4): $formspecResponse 2.0; buckets;
│     keyBag; profileUrl; profileVersion; AAD over six-tuple
│
├── Respondent Ledger spec (specs/audit/respondent-ledger-spec.md, v0.2.0-draft)
│   ALSO Formspec center — fully normative for event taxonomy, materiality rules,
│   EvidenceAttachmentBinding (per ADR 0072), assurance levels L1-L4,
│   identity attestation shape, checkpoint format. Trellis composes INTO it
│   via §6.2 envelope wrapping and §13 LedgerCheckpoint, not other way.
│
├── fel-core (existing — grammar + evaluator authority; not "byte" authority)
│   Per Core §3.7 informative grammar superseded by fel-grammar.md normative PEG
│
├── formspec-eval (existing)
│
└── fel-functions.schema.json (existing — function catalog contract surface)
    1157 lines; extension authors must respect this taxonomy

FORMSPEC-SERVER (NEW — reference backend; composition root, not Formspec semantics)
└── parallel to wos-server's relationship to WOS spec
    Listed ports are product/operational concerns of this reference backend,
    not Formspec center semantics. Same Formspec center can be hosted by other
    backends (Django reference, embedded engines).
    
    ├── authoring port: definition CRUD, versioning, AI-assist, lint, publish
    ├── runtime port: definition resolution, asset serving
    ├── intake port: receive, re-verify against same Definition version (S2.1.6.1
    │                forbids replacing definitionRef during accept), ack, sinks,
    │                response browser; emits IntakeHandoff artifact
    ├── ledger emission port: composes Trellis envelope wrapping for Respondent
    │                Ledger events per RL §6.2; does NOT define ledger semantics
    │                (those live in Formspec center)
    ├── signature-capture port: UI, click capture, populates Formspec authoredSignatures
    │                record (S2.1.6); WOS Signature Profile signing-intent URI populates
    │                a field within or alongside the record (NOT replaces it);
    │                Trellis Attestation primitive (PROPOSED) wraps the bytes
    ├── send-for-signature port: light sequence logic (NOT deontic governance)
    └── auth port: principal model (4 classes incl. workload identity for service-to-service),
                   membership, OpenFGA bindings, session lifecycle

PEER LIBRARY
└── agent-sdk (NEW)
    ├── provider routing (Claude, Bedrock, OpenAI, local)
    ├── conversation state, tool use protocol
    ├── consumes class-aware policy (Privacy Profile + recipient-class allowlists
    │   per ADR-0074 §4 bucketed Response + §6 MIP-context table for opaque references)
    │   does NOT hold DEKs or perform decryption
    │   takes plaintext that calling code already decrypted in client or
    │   declared ProcessingService boundary; routes; returns response
    ├── default no-training, no-retention provider configuration
    └── every AI feature MUST declare a degradation mode
```

`wos-signature-emit` (a synthesis-internal proposal) is dropped. Attestation *bytes/manifests* live in Trellis (byte authority). Attestation *meaning* (signing-intent URI registry, signer-authority claim shape, legal posture mapping) lives in `wos-core` Signature Profile. The signing configuration is a **signature-profile-only deployment** that imports wos-core schemas without standing up wos-runtime governance kernel — this aligns with the existing Signature Shortcut Rule in work-spec/CLAUDE.md ("workflow-lite paths over the same SignatureAffirmation semantics"). Preserves "one meaning of signing" per VISION §X. Three concerns, three homes; no overlapping authority and no parallel meanings.

Composition flow: Formspec authoredSignatures (S2.1.6 — consent + document-hash + intent URI populated) → WOS SignatureAffirmation provenance record (signature.md §2.8 — references attesting IdentityAttestation) → Trellis custodyHook append (Kernel §10.5 + custody-hook-encoding.md) → Trellis envelope (Core §6.6, §7) → optional Trellis Attestation extension wrap (proposed) → optional Certificate-of-completion (Trellis ADR 0007) at workflow close. Three artifacts, four edges, one byte story.

---

## Deployment configurations (replaces "cohorts" as architectural primitive)

```
forms-only                       formspec-server + Trellis
                                 (no signing capture activated; no WOS)

signature-profile-only           formspec-server + Trellis + wos-core
                                 (signing capture + send-for-signature sequence;
                                  wos-core Signature Profile schemas imported;
                                  authored signatures populated in Formspec
                                  Response per S2.1.6;
                                  no wos-runtime governance kernel)

adjudication                     formspec-server + wos-server + Trellis
                                 (full wos-runtime governance kernel; durable
                                  runtime; agent governance overlay)
```

Upgrade between configurations = composition-root feature swap, not migration. Same chain story; same attestation byte format; same identity attestation; same export bundle; same Signature Profile schemas across signature-profile-only → adjudication. Mirrors the trust-posture treatment in wos-server VISION §III (cargo features select trust posture; honesty-floor invariant requires declared posture to match observable behavior).

GTM cohort labels (Jotform-tier / DocuSign-tier / SBA-class) are *segmentation*, not *architecture*. The lead wedge typically exercises the `adjudication` configuration. Trust posture is selected separately per deployment custody claim — adjudication can run SBA-, Federal-, or Sovereign-posture independently from the configuration choice. Both configuration choice and trust posture are composition-root AND ledger-recorded so the runtime can prove its declared posture.

---

## Three orthogonal axes per deployment

| Axis | Values | What it controls |
|---|---|---|
| **Configuration** | forms-only / signature-profile-only / adjudication | Which feature ports activate at composition root |
| **Trust posture** (custody property) | SBA / Federal / Sovereign | What platform commits not to do with plaintext |
| **Isolation topology** (deployment knob) | shared+RLS / DB-per-tenant / cluster-per-tenant | Postgres + cell topology |

Conflating these axes is the substantive error in old ADR-0001/0005/0015. Lead wedge realignment makes it visible.

---

## Multi-tenancy + principal model

```
Scope hierarchy:    Tenant → Organization → Workspace → Environment → Resource

Principal types:    human / service-account / workload / support  (per ADR-0004; four classes)
                    workload identity = service-to-service auth (formspec-server ↔ wos-server
                       ↔ trellis-store; cannot be treated as API-key afterthought)
                    support = reason-coded, time-boxed, audit-by-default

RBAC ladder:        Owner / Admin / Author / Reviewer / Analyst / Submitter
                    (canonical role vocabulary; OpenFGA tuples express specifics)

Memberships:        Principal ↔ Organization, with role
Authorization:      OpenFGA tuples scoped to Org / Workspace / Env
Key-bag membership: Per-class DEK access list per ADR-0074
Sessions:           Issued post-IdP-attestation; we own timeout/refresh/revoke
                    Distinct from IdP session

Control-plane / data-plane separation (per ADR-0002 §15):
                    Customer-operational data MUST NOT be silently co-mingled with
                    commercial control-plane data. Provisioning, billing, entitlements,
                    fleet ops are control-plane concerns. Customer forms, cases, audit
                    records are data-plane concerns. Load-bearing for Federal/Sovereign
                    postures.
```

**Object-ownership invariant** (per ADR-0004 line 185 + ADR-0006 Invariant 3): Core business objects belong to **organizations**, not subscriptions. Subscription/billing objects must not be foreign-key parents of forms, cases, definitions, or any product-domain object. SaaS commercial objects sit *beside* product objects, not above them.

**Deletion-follows-org invariant** (per ADR-0006 Invariant 5): Deletion and retention key off organization ownership, not billing state. A billing-suspended organization's data is governed by retention policy on the org, not by lapse of the SaaS subscription. This is what makes crypto-shredding work cleanly: class-DEK destruction is organization-scoped, not subscription-scoped.

**Derived artifact lineage** (per ADR-0006 absorption): every derived artifact (AI extraction, redacted version, generated summary, export package) carries:

```
source_object_type, source_object_id,
producer_type, producer_version,
organization_id, derived_at, derivation_chain
```

Composes with ADR-0074 access-class inheritance for lifecycle and access scoping.

---

## Three planes (orthogonal)

```
Response  — canonical response (Formspec Core S2.1.6); bucketed wire shape per
            ADR-0074 §4 ($formspecResponse 2.0; buckets; keyBag; profileUrl;
            profileVersion); encryption at Phase 5 emission per ADR-0074 §8
Audit     — hash-chained events (Respondent Ledger spec); pseudonymous via subjectRef;
            §2.2 invariant: ledger replay MUST NOT be required to interpret a Response
Identity  — assuranceLevel × privacyTier, provider-neutral attestation
            Respondent Ledger §6.7 normatively declares privacyTier ⊥ assuranceLevel
            (MUST NOT conflate, derive, or couple transitions)
            §6.8: authored signature ≠ recorded attestation (verifiers MUST validate
            authored signature on Response, not just ledger entry)
```

These three planes share references (`subjectRef`, `eventHash`, `attestation_id`, `ledgerHeadRef`, `responseId`); never collapse storage or disclosure. Sovereign-posture deployments need this orthogonality. Respondent Ledger §6.6A explicitly preserves three-concern decoupling.

`assuranceLevel × privacyTier`:

- assuranceLevel ∈ {ial1, ial2, ial3} × {aal1, aal2, aal3} (NIST 800-63)
- privacyTier ∈ {anonymous, pseudonymous, identified, public}

Identity attestation as a stack-level contract closes the cross-stack surface (PROPOSED parent-repo ADR — *next free number, not 0079; that's already taken by IntakeHandoff emission*). Respondent Ledger §6.6 already specifies the per-event identity-attestation shape.

---

## AI placement

```
agent-sdk (peer crate)
├── provider routing (Claude, Bedrock, OpenAI, local)
├── conversation state, tool use protocol
├── consumes class-aware policy (Privacy Profile + recipient-class allowlists per ADR-0074)
│   policy says what's allowed; agent-sdk does NOT hold DEKs and does NOT decrypt
│   decryption authority stays in client or declared ProcessingService adapter
│   agent-sdk receives plaintext only after calling code has decrypted in its boundary
├── default no-training, no-retention configuration on every provider
└── every AI feature declares degradation mode before launch (per ADR-0008 absorption)

wos-runtime governance overlay (when wos-server present)
├── deontic constraints (permission/prohibition/obligation/right; AI Integration §4)
├── autonomy caps by impact tier (AI Integration §5)
├── stack-coined "independent-first review protocol" (UX-enforcement of Governance §4 Review Protocols
│   `independentFirst` value per §4.1 Protocol Definitions; not a formally named protocol in WOS spec)
└── agent-action provenance via custodyHook (Kernel §10.5 + custody-hook-encoding.md)
    → Trellis envelope (Core §6.6, §7)

Privacy Profile recipient policy
└── per-class regulatory tags (HIPAA, PCI, FERPA, CJIS, ITAR) annotating ADR-0074 access classes
    AI provider-allowlist matrix is GENERATED from these tags + tier policy
    Not a parallel D0-D4 taxonomy
```

Operational principle (per ADR-0011 absorption): **core workflow integrity outranks AI convenience.** AI feature failures degrade gracefully; never block core workflow.

---

## Frontend surfaces (1.0)

```
Studio          — staff (form authors, basic workspace settings, AI-assist, response browser)
Caseworker      — review queue, independent-first protocol UI, decision surfaces
                  (only deployed where wos-server is)
Admin           — tenant ops, key/KMS config, posture, audit log
                  (enterprise deployments)
Hosted form pg  — respondent on hosted deployments
formspec-       — embedded respondent on customer sites
  webcomponent

Phase-2:
Native SDKs (iOS/Android) — fel-core + formspec-eval compiled to mobile targets
```

Three apps because the stack-coined independent-first review protocol (UX enforcement of WOS Governance §4 Review Protocols `independentFirst` value) structurally requires UX separation — interface mustn't reveal AI output until human commits independent judgment. Trade: more deployment surface; less per-app feature-flag burden.

---

## Adapters (DI everywhere)

| Concern | Default | Adapter examples |
|---|---|---|
| Identity (staff) | WorkOS or Zitadel | login.gov, ID.me, Okta, Azure AD, agency SAML |
| Identity (respondent) | Custom WebAuthn-PRF (binds to per-class DEKs) | OIDC ("Sign in with X"); magic-link |
| Email | Resend | SES, Postmark, raw SMTP |
| SMS / push | None at 1.0 | Twilio, Vonage, FCM, APNs |
| Anchor target | OpenTimestamps | Trillian, Sigstore Rekor, agency-operated |
| Object storage | S3 | Azure Blob, GCS, FS for self-host |
| KMS | AWS KMS | GCP KMS, Azure KeyVault, HSM |
| Postgres | (bring your own) | Aurora, RDS, GCP CloudSQL, self-hosted |
| Confidential compute | `processing-audited` (SBA reference) | `processing-tee`, `processing-fhe`, `processing-mpc` |
| Durable runtime | Restate | Temporal, Camunda, Step Functions (commercial gate) |

Center keeps the *port*; adapter is the implementation. Customer can replace any adapter without touching center code.

---

## API surface

```
Public          REST + JSON + OpenAPI; generates client SDKs
Inter-server    Transport choice (gRPC over wire / in-process Rust trait when collocated)
                is ORTHOGONAL to seam shape. The seam itself is a typed artifact:
                  - IntakeHandoff (Formspec Core S2.1.6.1, intake-handoff.schema.json):
                    one-shot Formspec → WOS at intake completion; carries
                    initiationMode invariant (workflowInitiated vs publicIntake);
                    caseRef required for workflowInitiated, forbidden for publicIntake;
                    "Trellis MAY anchor this evidence, but they MUST treat the handoff as
                    evidence about intake completion, not as case creation authority"
                  - contractHook (WOS Kernel §10.2): bidirectional prefill/validate/map;
                    a DIFFERENT seam than IntakeHandoff
                  - custodyHook (WOS Kernel §10.5): four-field append wire surface
                    pinned in custody-hook-encoding.md
Outbound        HMAC-signed webhooks; idempotency-key; replay-safe
                Runs inside ProcessingService boundary (per ADR-0010 absorption)
                Inbound vs outbound trust boundary explicit; inbound carries different posture
                Dead-letter queue mandatory on every connector
```

---

## Lifecycle

Different state types; different mechanisms (avoiding the conflation in old ADR-0012):

```
Chain content (Trellis events):
  Append-only; only crypto-shredding via class-DEK destruction works
    (Trellis Core §6.4, §9.3, §25.8 + Companion Appendix A.7 cascade scopes CS-01..CS-06;
     Companion §25.8 covers cryptographic-erasure interaction with grants/evaluators)
  Legal hold semantics: existing WOS holdType enum value (Governance §12 Typed Hold Policies);
    legal hold suspends DEK destruction is a synthesis-layer architectural decision (not in ADR-0012;
    not pinned in Companion §20.2 — Companion §20.2 is "Sealing and Precedence" with OC-74
    referencing legal-hold as secondary content; mechanism-agnostic at spec level)
  PROPOSED wos.governance.legal-hold-applied event (must be ratified as taxonomy addition)

Projections (rebuildable from chain):
  State machine {Active, Archived, Pending Deletion, Deleted, Redacted, On Hold, Expired}
  Per-object-class retention policy

Attachments (blob store):
  Originals immutable; redactions are derivative artifacts
  Artifact taxonomy (per ADR-0009 absorption):
    original / generated / redacted / immutable-snapshot / temporary-processing /
    export-package / preview
  Quarantine state for malware-scan posture
  Each carries derived_from lineage metadata

Application state (definitions, configs, profiles):
  State machine + explicit promotion path
  Versioned; profile changes ledger-emit governance.profile-evolved event

Derived AI artifacts (embeddings, summaries, extractions):
  First-class lifecycle objects (per ADR-0012 absorption)
  Inherit lifecycle from parent source object
  Crypto-shredded with parent's class DEK

Backups:
  Encrypted via class DEKs; crypto-shredding handles transitively
  No separate backup-lifecycle mechanism needed
```

GDPR Art. 17 erasure = class-DEK destruction. Chain integrity preserved; bound content irrecoverable. Legal hold is the only mechanism that suspends destruction.

---

## Connectors and external recipients

```
Privacy Profile registers external systems as per-class recipients
Key-bag wraps DEK to receiving system identity
Ledgered access.granted / access.revoked events
  Per Trellis Core §23.4 disjoint-namespace rule; PROPOSED placement under wos.* namespace
  Existing taxonomy: wos.kernel.* / wos.governance.* / wos.ai.* / wos.assurance.*
  Likely fold under wos.governance.access-granted / access-revoked
  Companion §25.1 OC-115: "Grants and Revocations Are Canonical"
Recipient-rotation rule (per-event scope):
  Past events keep existing key_bag (immutable under LAK re-wrap; new wraps via
  LedgerServiceWrapEntry per §8.6); future events scoped to current recipients only.
  Crypto-shredding the recipient's DEK destroys decryption capability for past events.
  Rule is implicit in Core §6.4 + §9.4 + §25.6 — would benefit from explicit
  Companion clarification + matrix entry.
Connector workers run inside ProcessingService boundary
  Decrypt only what their key-bag admits
  Emit integration.delivered provenance via custodyHook
Idempotency tuple per Core §17.2 — `(caseId, recordId)` is a valid §17.2
  deterministic-hash construction (e.g., SHA-256(session_id || field_path || value))
Dead-letter queue mandatory; quarantine on repeated failure
Tenant-scoped secrets in KmsAdapter or sibling SecretsAdapter
  Never plaintext config tables
Inbound vs outbound trust boundary explicit
```

Tenant package secret-exclusion list (per ADR-0013 absorption) — these never serialize:

```
passwords, API keys, OAuth refresh tokens, session tokens,
signing private keys, infra credentials
```

---

## Operational architecture

SLO categories (per ADR-0011 absorption):

```
intake             — submission acceptance latency, success rate
case durability    — chain append durability; checkpoint cadence
workflow           — case lifecycle progression; reviewer queue health
audit-continuity   — chain integrity invariants; checkpoint anchoring
documents          — attachment delivery; redaction performance
integration        — outbound connector delivery; webhook latency
AI                 — inference latency; degradation mode activation rate
```

Each adapter declares a degraded mode at port boundary. Operational principles:

- "Core workflow integrity outranks AI convenience"
- "An outage is not permission to create undocumented history" — chain semantics survive incidents
- Audit ⊥ observability (Trellis events answer who/what/why; OTel answers what failed)

Cell architecture (per ADR-0002 absorption — deferred to when rollout rings exist): cells = blast-radius unit (per-region / per-rollout-ring / per-tenant-shard). Named for future use; not implemented at 1.0.

---

## Configuration discipline

Configuration is releasable state with promotion discipline (per ADR-0014 absorption):

Migration class declared per release:

```
backward-compatible    — older clients work unchanged
forward-compatible     — newer clients tolerate older state
expand-contract        — schema/field expansion in stages
breaking               — explicit version pin required
```

Note: "no backwards compatibility" applies to *unshipped* product. Once a tag goes out, it's a coherent-state label; the migration class describes what evolution from that tag promises.

Feature flags are governed: owner, purpose, expiry, audit. Long-lived undocumented flags rejected. Drift detection mandatory in CI.

Privacy Profile changes ledger-emit `governance.profile-evolved`. Access-class registry, wos.* event-type registry are versioned artifacts with explicit promotion paths.

---

## Compliance taxonomy

Five control categories (per ADR-0015 absorption):

```
product             — controls baked into spec/code (encryption, chain integrity)
deployment          — controls applied at deploy (posture, isolation, region)
operational         — controls in ops practice (SLO commitments, incident response)
customer-           — controls customer configures (key rotation cadence,
  configurable        retention policy, recipient registration)
inherited           — controls from underlying infrastructure (cloud SOC 2, KMS attestation)
```

Architectural rules:

1. **Tier-qualified claims only.** No compliance claim is made without naming the trust posture and configuration.
2. **Deployment differences must be real, not cosmetic.** SBA-posture vs Federal-posture must produce observably different behavior.
3. **Customer-configurable controls explicitly distinguished from defaults.** SaaS sign-up shows defaults; controls customer changes are recorded.
4. **No bundled certifications-first-architecture-later.** Architecture earns the certification, not the other way around.
5. **Subprocessor list maintained** (synthesis-added procurement commitment, not in ADR-0015). Every adapter that processes customer data named in subprocessor list.

---

## Meta-rules

1. **No parallel access-class taxonomies.** ADR-0074's `accessControl.class` is canonical; subsequent ADRs annotate via Privacy Profile (regulatory tags), do not mint parallel D0-D4 / artifact-type / retention-class systems.
2. **Audit chain is namespace-disjoint per Core §23.4.** Existing namespaces: WOS owns `wos.kernel.*` / `wos.governance.*` / `wos.ai.*` / `wos.assurance.*` (per custody-hook-encoding.md:315). Formspec Respondent Ledger event types are bare (e.g., `session.started`, `draft.saved`) per RL §8.1. Trellis-Rust = byte authority for envelopes. PROPOSED additions (this synthesis): `wos.signing.*`, `wos.identity.*`, namespacing of Formspec ledger event types — must be ratified as taxonomy extensions, not assumed.
3. **Trust posture independent of isolation topology.** Custody-property axis vs infrastructure-isolation axis — orthogonal.
4. **Internal relationship model is center; IdP is adapter.** Principal records, memberships, OpenFGA tuples, key-bag membership, sessions stay in platform. We never store passwords.
5. **Trellis owns byte primitives, not legal/governance intent.** Envelope COSE, checkpoint signing, user-content Attestation bytes (proposed extension), certificate-of-completion manifest format (Trellis ADR 0007). The *meaning* of attestation intents (consent-to-content, witness, delegate) lives in WOS Signature Profile as a URI registry; Trellis encodes the URI without claiming the meaning. Pattern matches `claim_type` in IdentityAttestation. WOS adds workflow context; Formspec center adds intake + Response + ledger semantics; neither redefines bytes. **Authority order:** Rust crates > CDDL §28 > Core/Companion prose > matrix > Python > archives.
6. **Center commitments close now; profile-specific extensions are trigger-gated.** Every open contract decomposes into center commitments (semantic byte/wire shapes that must settle now to prevent drift across implementations) and profile-specific extensions (jurisdiction-specific calendars, cross-jurisdiction reversal, mid-flight migration policies — depend on a specific profile/customer/use case). Architectural-vs-profile distinction, not phased delivery.
7. **Configuration before composition.** Configuration choice (forms-only / signature-profile-only / adjudication) and posture (SBA / Federal / Sovereign) and topology declared at composition root; not as code paths inside components. Both configuration and posture are ledger-recorded so the runtime can prove its declared posture (Trellis Phase-1 invariant #15 honesty floor). One architecture; many deployments.
8. **ADR namespace discipline.** Trellis-internal ADRs (`trellis/thoughts/adr/`) are numbered separately from parent-repo stack ADRs (`thoughts/adr/`). New Trellis envelope/CDDL/byte work uses Trellis-internal numbering (next free is `0009`, since 0001-0008 are taken). Stack-level cross-layer ADRs use parent-repo numbering.

---

## Open contracts — center commitments and profile-specific extensions

Center commitments close now to prevent drift. Profile-specific extensions are trigger-gated by deployment need. Not phased delivery — architectural-vs-profile distinction.

**Architectural center commitments (close now):**

- Statutory clocks ([0067](../adr/0067-stack-statutory-clocks.md)): `ClockStarted/Resolved` events; materialized-once deadline; `open-clocks.json` manifest
- Amendment ([0066](../adr/0066-stack-amendment-and-supersession.md)): four modes; `supersedes_chain_id` envelope reservation; linear supersession only
- Failure ([0070](../adr/0070-stack-failure-and-compensation.md)): commit-point semantic pinned (Trellis local-append IS commit); idempotency tuple; `stalled` state
- Migration pin (0071a — split from [0071](../adr/0071-stack-cross-layer-migration-and-versioning.md)): pin set on first anchored event via Core §6.7 extension surface; verifier-version-set declaration; no envelope reservation needed (existing extension slot)
- **`custody-hook-encoding.md` (Kernel §10.5 companion)** — load-bearing center artifact; the four-field append wire surface that pins WOS↔Trellis byte edge. Without it, "Trellis owns bytes / WOS owns meaning" doesn't compose.
- Identity attestation (PROPOSED parent-repo ADR — pick free number; 0079 already taken): IdentityAttestation shape; PROPOSED `wos.identity.*` taxonomy; claim graph; composes with existing Respondent Ledger §6.6 per-event identity attestation
- Trellis user-content Attestation primitive (PROPOSED `trellis/thoughts/adr/0009`): payload-level Attestation distinct from existing Companion App A.5 (custody/disclosure/erasure); Phase-1 envelope reservation, Phase-2 activation; CDDL in §28; new domain-separation tag in §9.8; fixture vectors; G-5 stranger gate extension
- WOS Signature Profile extension (extension to existing signature.md): signing-intent URI registry (URI populates Formspec authoredSignatures field, NOT replaces it); signer-authority claim shape (capacity-to-bind, separate from authentication-method); ESIGN/UETA/eIDAS posture mapping (SCOPE REOPEN of §1.3 — currently out-of-scope)
- Certificate-of-completion (Trellis ADR 0007 — already Accepted 2026-04-24; remaining work: shared cross-repo fixture; claim-graph tightening; WOS-T4 signature-affirmations catalog integration)
- AEAD nonce determinism on retry (PROPOSED Trellis Core §9.4 prose addition + §17 fixture): pin nonce derivation rule (e.g., `nonce = HKDF(authored_event_bytes || idempotency_key)`) so same-key + same-authored-bytes retry produces byte-identical canonical event
- External recipient lifecycle (PROPOSED parent-repo stack ADR): Privacy Profile registration + ledgered access.granted/access.revoked events under `wos.governance.*` namespace + recipient-rotation rule explicit in Companion clarification

**Procurement-blocking center commitments (close now):**

- Accessibility: WCAG 2.2 AA conformance; VPAT for each frontend app
- Counsel-pinned legal claim: ESIGN/UETA/eIDAS compatibility statement reviewed by counsel
- SOC 2 controls inventory (pre-cert)
- Pricing model (one model, all configurations)
- Subprocessor list maintained (procurement commitment; not in ADR-0015 — synthesis-added)
- Incident response and breach-notification commitments

**Profile-specific extensions (trigger-gated):**

- Confidential-compute reference adapter (TEE minimum) — posture-gated; required before first Federal-posture customer, NOT before SBA PoC. SBA PoC uses `processing-audited` reference.
- Data residency story — required before first Sovereign-posture or EU-touching customer
- Statutory clocks: jurisdiction-aware business calendars → trigger-gated by first jurisdiction beyond initial profile
- Amendment: cross-jurisdiction reversal, diamond/cycle handling → first cross-agency case
- Failure: full reconciliation event taxonomy → first significant production incident
- Migration (0071b): mid-flight migration policy → first multi-year case lands
- Identity: IdP-quirk profiles → per real adapter need
- Signature: bulk-send / template UX → product scope, not stack
- External recipient: federation-tier multi-jurisdiction → first multi-jurisdiction federation deployment
- **Tenant-scope Trellis export shape** — Core §18 ZIP layout is per-`ledger_scope`; tenant-scope spans many. Genuine new shape needed: either new export-layer extension (e.g., `070-tenant-package-manifest.cbor` cataloging constituent per-scope ZIPs with cross-binding digests) OR a new top-level package format that nests per-scope exports. Decision is gating; trigger = first tenant-scope export use case.

---

## ADR absorption table

Source: 17 brainstorming ADRs in [`formspec-internal/thoughts/adr/`](../../formspec-internal/thoughts/adr/) (AI-authored, NOT authoritative). Reviewed via three lenses — alignment, divergence, cross-stack-seam — during 2026-04-27 brainstorm.

| ADR | Title | Status | What was absorbed |
|---|---|---|---|
| 0001 | Tenancy and Deployment Model | Refined | Engine/Instance/SaaS three-domain split; tenancy-agnostic core; multi-tenant always with isolation tiers (replaces tier-as-isolation framing) |
| 0002 | Control-Plane / Data-Plane / Cell | Adopted (separation) + Deferred (cells) | Control-plane / data-plane separation invariant (§15: customer-operational data MUST NOT co-mingle with commercial control-plane data) absorbed into multi-tenancy section. Cell as blast-radius unit named for future use; not implemented at 1.0. |
| 0003 | Tamper-Evident Audit Ledger | Superseded | Fully replaced by Trellis Phase-1 envelope invariants |
| 0004 | Identity / Org / Workspace / Authz | Adopted | Tenant→Org→Workspace→Environment hierarchy; **four** principal classes (human / service-account / workload / support); RBAC ladder (Owner/Admin/Author/Reviewer/Analyst/Submitter); sandbox/prod environment scoping; object-ownership invariant (line 185: every operational resource belongs to an organization). Workload identity is required for service-to-service calls across formspec-server / wos-server / trellis-store. |
| 0005 | Postgres Isolation by Tier | Adopted-as-knob | Three topology options (shared+RLS / DB-per-tenant / cluster) as deployment knob; schema-per-tenant rejected |
| 0006 | Core Data Model and Ownership | Adopted | Invariant 3: "Core business objects belong to organizations, not subscriptions"; Invariant 5: deletion/retention follows org boundary, not billing state (load-bearing for crypto-shredding); derived artifact lineage metadata (source_object_type/id, producer_type/version, organization_id). Three-domain split (Engine/Instance/SaaS) used as scaffolding throughout. |
| 0007 | Key Management and Signature Lifecycle | Partially-superseded-by-Trellis | Old ADR's PKI hierarchy framing did NOT survive review. Trellis has its own structures: ADR 0006 5-class `KeyEntry` taxonomy (signing/tenant-root/scope/subject/recovery) and Core §8.4 lifecycle states (Active/Rotating/Retired/Revoked). The "compromise doesn't rewrite history" principle survives (Trellis Core §25.6). User-content attestation is greenfield Trellis work (proposed `trellis/thoughts/adr/0009`), not ADR-0007 absorption. |
| 0008 | AI Provider, Routing, Data Handling | Re-shaped | Routing primitives in agent-sdk; recipient policy in Privacy Profile; deontic gates in WOS; provider-class matrix GENERATED. Default no-training/no-retention. Graceful degradation mandatory per AI feature. |
| 0009 | Document Storage / Evidence Model | Adopted | Originals immutable; redaction-as-derivative; artifact taxonomy (original/generated/redacted/snapshot/temporary/export/preview); quarantine state for malware-scan. (Cross-link to ADR 0072 closure work is synthesis linkage, not ADR-0009's claim.) |
| 0010 | Integration / Connector Isolation | Re-drawn | Queue-backed workers; idempotency tuple; tenant-scoped secrets; inbound/outbound trust boundary; dead-letter mandatory. (Synthesis re-frames connector workers as running inside `ProcessingService` boundary — ADR-0010 predates this concept; re-framing is synthesis-layer architectural decision.) |
| 0011 | Observability / SLOs / Incident | Adopted | SLO categories (intake/durability/workflow/audit-continuity/docs/integration/AI); degraded-mode discipline; "core workflow integrity outranks AI convenience"; "outage is not permission to create undocumented history"; audit ⊥ observability |
| 0012 | Lifecycle / Retention / Legal Hold | Split-and-adopted | State machine for non-chain layers (ADR-0012); legal hold as policy overlay suspending purge (ADR-0012, mechanism-agnostic). (Crypto-shredding for chain content + KmsAdapter-as-mechanism-for-legal-hold are synthesis-layer architectural decisions composing ADR-0012 policy with Trellis Core §25.8 and the per-class DEK model — not ADR-0012's own claims.) Derived AI artifacts as first-class lifecycle objects (ADR-0012). |
| 0013 | Tenant Portability / Tier Migration | Partial — secret-exclusion adopted; package-format claim deferred | Secret-exclusion list (passwords, API keys, OAuth refresh, session tokens, signing private keys, infra creds) — faithful absorption. (ADR-0013 is technology-neutral on package format — JSON/YAML/NDJSON; makes no Trellis/COSE byte claim. Synthesis-layer proposal that one Trellis byte format covers both case-level and tenant-level export is genuinely new shape work — see profile-specific extensions list and soft-spot #12.) |
| 0014 | Release Management / Tier-Aware Rollout | Adopted | Migration class taxonomy (backward-compatible / forward-compatible / expand-contract / breaking); feature flags governed (owner/purpose/expiry/audit); drift detection mandatory; long-lived undocumented flags rejected; "hotfixes don't bypass audit" principle |
| 0015 | Compliance / Assurance Boundary | Adopted | 5-category control taxonomy (product/deployment/operational/customer-configurable/inherited); tier-qualified claims only; customer-configurable controls explicitly distinguished. (Subprocessor list as procurement commitment is synthesis-added — not in ADR-0015's five architectural rules.) |
| 0016 | Privacy-Preserving Ledger Chain | Adopted (selectively) | Three-plane decoupling (Response ⊥ Audit ⊥ Identity); assuranceLevel × privacyTier; provider-neutral identity adapter. Rejected: zk/MPC/HE phasing as universal capability tiers (only ADR-0081 BBS+ for selective disclosure as concrete planned work) |

---

## Soft spots

1. **Lead wedge realignment unvalidated.** The mid-market regulated CTO with audit finding is named in STACK.md positioning but no signed LOI exists for that segment. We're correctly aimed at a hypothesis; need to test it.

2. **Procurement center commitments are large.** Accessibility (WCAG 2.2 AA + VPAT for three apps), counsel-pinned legal claim, SOC 2 controls inventory — each is a real undertaking. The architectural commitments are smaller; the procurement commitments are bigger. Engineering time vs counsel time vs auditor time is a different cost mix than the prior plan implied. Confidential-compute adapter (TEE) is now correctly posture-gated, not center, but it remains real work for the first Federal-posture customer.

3. **Trellis user-content Attestation primitive is new spec work.** Adding payload-level user-content attestation to Trellis Phase-1 envelope is greenfield byte design — distinct from existing Companion App A.5 Attestation (custody/disclosure/erasure). Mirror ADR 0007 precedent: ~300 lines + 11 vectors + verifier obligation update. Phase-1 envelope reservation + Phase-2 activation per ADR 0001-0004 maximalist-envelope discipline. Real work; not free.

4. **Migration class taxonomy under "no backwards compatibility" creates a paradox.** "Nothing is released" + "tags are coherent-state labels" + "migration class declared per release" need careful reconciliation. The resolution: migration class describes evolution *from a tag*, even when the tag isn't released-as-in-customer-data. Useful as a discipline; needs explicit framing or it reads as contradiction.

5. **Identity attestation claim-graph complexity.** Adapters could disagree on which claims to populate, producing silent attestation drift. Lint discipline + cross-adapter conformance fixtures are the mitigation; real test coverage required.

6. **Three-planes referential integrity.** Response ⊥ Audit ⊥ Identity is the right frame; Respondent Ledger §6.6A keeps the three concerns decoupled. But referential integrity across the shared keys (`subjectRef` / `eventHash` / `attestation_id` / `ledgerHeadRef` / `responseId`) has no declared owner — no spec section normatively defines the integrity contract. Deserves a Respondent Ledger §10 edit or a new "cross-plane references" section.

7. **agent-sdk class-context vs key-custody discipline.** agent-sdk consumes class-aware policy (allowlists, regulatory tags) but does not hold DEKs or perform decryption. The seam between "policy-aware routing" (agent-sdk) and "decryption authority" (client / declared ProcessingService) needs explicit contract. Risk: an adapter quietly reaches into key custody to "make it work," collapsing the structural boundary.

8. **wos-server-eventstore-embedded as single-process EventStore.** Cross-stack-scout's recommendation to replace wos-signature-emit with this. Cleaner but adds a new EventStore variant. Needs design work.

9. **Pricing matrix.** Three deployment configurations × three trust postures × three isolation topologies = 27-cell pricing matrix. Likely collapses to fewer real SKUs in practice but the dimensional analysis hasn't been done.

10. **wos-server-vs-formspec-server when collocated for adjudication configuration.** IntakeHandoff is a typed artifact (Formspec Core S2.1.6.1 + intake-handoff.schema.json); transport (gRPC over wire / in-process Rust trait) is orthogonal. Single-process collocation is simpler; multi-process gives independent scaling. Default at 1.0 is unspecified; depends on first-real-deployment shape.

11. **AEAD nonce determinism on retry — real Trellis spec gap.** Trellis Core §17 pins `(ledger_scope, idempotency_key)` permanence; same key + different payload yields `IdempotencyKeyPayloadMismatch`. But Core §9.4 (HPKE Base mode wrap) does NOT pin the AEAD encryption nonce as deterministic from authored content. Naive retry that re-encrypts with fresh random nonce produces different ciphertext, different content_hash, different canonical_event_hash — same authored fact triggers a mismatch error. Synthesis claim "encrypt-then-hash determinism on retry" requires either deterministic nonce derivation rule or explicit operator obligation to memoize ciphertext. Center commitment under r3.

12. **Tenant-scope export shape is a gating decision, not free.** Core §18 ZIP is per-`ledger_scope`. Tenant-scope spans many. The synthesis "one byte format covers both" was misleading. Choice between bundle-of-bundles vs new top-level format must be made; CDDL + secret-exclusion as Companion obligation + fixture vector follow.

13. **Bucketed Response wire shape (ADR-0074 §4) was previously invisible at seams.** r3 surfaces it at IntakeHandoff `responseHash` semantics, three-planes Response paragraph, and agent-sdk class-aware policy. Without these citations, the synthesis's strongest cryptographic claim is invisible to downstream readers.

14. **Several PROPOSED items previously read as if absorbed/settled.** r3 corrects: `wos.signing.*` namespace, `wos.governance.legal-hold` event, `formspec.*`/`respondent.*` namespacing, signing-intent URI registry, signer-authority claim shape, ESIGN/UETA/eIDAS posture mapping. None of these are in current specs as named — all require ratification as proposals.

---

## What's NOT in this synthesis

Tracked open work explicitly out-of-scope for this brainstorm:

- **Conformance suite cross-stack coverage.** STACK.md §Conformance ownership notes shared stack-level suite is required-but-open. Surface area expansion (six ports + agent-sdk + Trellis Attestation + identity attestation) outpaces verification posture. Real engineering work.
- **OpenFGA tuple schema migration** across configuration upgrades or multi-tenant rollouts. Architectural gap; needs separate ADR.
- **AAD pinning evolution** for Privacy Profile changes mid-case (per ADR-0074 + connector lifecycle).
- **Processing-adapter evolution discipline** (SBA→Federal upgrade as runtime concern).
- **Founder-press positioning** ("record survives the vendor") as strategic asset — flagged by strategist; out of architectural scope.
- **Partner channel architecture** (SBIR primes, agency SI partners, regional GovTech) — GTM, not architecture.
- **Open-core licensing tension at SaaS scale** (BSL-vs-Apache + hosted SaaS competitor of own product). Strategic, not architectural.

---

## Provenance

Brainstorm conducted 2026-04-27. Settled positions emerged through multi-agent critique:

- Two parallel Opus subagents reviewed 17 brainstorming ADRs in `formspec-internal/thoughts/adr/` through alignment and divergence lenses.
- A `formspec-specs:cross-stack-scout` agent reviewed the same ADRs through the cross-stack-seam lens, sharpening the alignment/divergence reports and identifying that ~60% of the older ADR set was superseded, ~25% surfaced real seams at the wrong altitude, ~10% genuine contribution.
- Two more parallel agents — `cross-stack-scout` and `platform-strategist` — produced architectural and strategic closure proposals for six open contracts.
- Two final review agents — `cross-stack-scout` and `platform-strategist` — critiqued the prior synthesis. They independently identified that cohort-as-architectural-primitive was wrong and lead-wedge had been mis-identified.
- The Trellis-owns-attestation correction came from owner intuition mid-conversation; eliminated `wos-signature-emit` as a separate concern and consolidated byte authority cleanly.

The architecture that resulted is smaller in surface, sharper in seams, and more honest about what's procurement-blocking vs architecturally-complete than the prior synthesis. All positions are working; the architecture moves when the next brainstorm or the next customer reveals better.

---

## Next steps

1. **Owner review** of this synthesis. Push back where critique is wrong, accept where it is right, redirect where neither captures the intent.
2. **Propose VISION.md edits** absorbing settled positions. Not yet drafted.
3. **Propose new ADR numbers** for: identity attestation (need free number, not 0079), Trellis Attestation primitive, external recipient lifecycle, ADR-0071 split into 0071a/0071b.
4. **Validate lead wedge** with concrete customer conversations beyond SBA. Mid-market regulated CTO with AI audit finding is a hypothesis; treat as such.
5. **Triage procurement-blocking center commitments** — accessibility, counsel-pinned legal claim, SOC 2 inventory are large items with different cost profiles than engineering work. Plan separately.
