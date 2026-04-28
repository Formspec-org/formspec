# ADR-0059: Unified Ledger as Canonical Event Store for the WOS + Formspec Case Lifecycle

**Narrative status:** **Locked** 2026-04-22 — this ADR is the **authoritative Phase 3+ architecture description** (single append-only spine per case, encrypt-then-hash, disposable projections, WOS governance as ledger-shaped evidence). **Delivery** is **phased** per [`trellis/thoughts/product-vision.md`](../trellis/thoughts/product-vision.md); **superseded sequencing** was “unified immutable store for all case data *before* Phase 1 byte-exact exports and G-5,” not this architecture.

**Refined by:** [ADR 0073](./0073-stack-case-initiation-and-intake-handoff.md) for case-boundary ownership. WOS owns governed case identity and `case.created`; Formspec emits intake handoff evidence; Trellis anchors and exports the evidence path.

**Status:** Proposed (technical annexes and open questions until promoted normatively)

**Date:** 10 April 2026  
**Author:** Mike (TealWolf Consulting LLC)  
**Applies to:** Formspec Respondent Ledger Spec, WOS Runtime Companion, Formspec/WOS intake handoff (ADR 0073), Enterprise Implementation Roadmap
**Depends on:** ADR-0003 (Audit Ledger), ADR-0007 (Key Management), ADR-0054 (Client/Server Ledger Chain), ADR-0012 (Data Lifecycle)  
**Supersedes:** None (extends ADR-0054 into the WOS governance domain)

> **Where to read first.** Stack **program summary** (sequencing, WOS/Trellis/Formspec handoffs): [`wos-spec/thoughts/plans/0059-unified-ledger-as-canonical-event-store.md`](../wos-spec/thoughts/plans/0059-unified-ledger-as-canonical-event-store.md). **Full technical ADR** is this file. **Phase 1 wire discipline** (maximalist envelope, restrictive runtime): [`trellis/thoughts/specs/2026-04-20-trellis-phase-1-mvp-principles-and-format-adrs.md`](../trellis/thoughts/specs/2026-04-20-trellis-phase-1-mvp-principles-and-format-adrs.md).

---

## Context

The Formspec + WOS architecture currently assumes two separate event logs:

1. **Respondent Ledger** (Formspec) -- records what happened to the respondent's data during intake: form session events, draft saves, field mutations, attachment uploads, identity attestations, validation snapshots, submission completion. Specified in the Respondent Ledger spec (969 lines). Append-only, hash-chained, cryptographically signed, privacy-tiered, externally anchorable. ADR-0054 defines the client/server chain.

2. **WOS provenance** (WOS) -- records what happened in the workflow after submission: state transitions, governance decisions, deontic constraint evaluation, agent invocations, review protocol enforcement, reasoning traces, counterfactual explanations, delegation verification, hold entries/exits. Specified across the WOS kernel (S8), governance (S6), AI integration (S13), runtime companion (S5-S9). Four tiers: Facts, Reasoning, Counterfactual, Narrative.

The enterprise implementation roadmap (Phase 1.3) proposes a Postgres-backed case management layer with a separate provenance store. The Temporal reference implementation proposes `append_provenance` as an activity writing to Postgres.

This creates three problems:

**Problem 1: Two sources of truth.** A federal auditor reviewing case MED-2026-0847 needs evidence from both the intake phase (form events) and the governance phase (workflow decisions). These live in separate stores with separate integrity chains. Reconstructing a complete case history requires joining across systems with no shared integrity proof.

**Problem 2: The SaaS platform owns the data.** If the provenance lives in the platform's Postgres, the platform is the custodian of the evidentiary record. Data portability means exporting from the platform's database. Data sovereignty means trusting the platform's access controls. This is the same model as every competitor (ServiceNow, Salesforce, Pega, Adobe) -- and the opposite of the Formspec trust narrative ("the spec is the product, not a service").

**Problem 3: Audit integrity is procedural, not structural.** The Respondent Ledger has cryptographic integrity (hash chains, signed checkpoints, external anchoring). WOS provenance as currently specified has per-record digests (kernel S8.3) but no chain integrity. Merkle tree tamper evidence is listed as "Deferred / Not started" in TODO.md. Two integrity models for one case.

---

## Decision

**The Respondent Ledger serves as the canonical event store for the entire case lifecycle.** WOS provenance records are ledger events. The ledger is the single source of truth from first form interaction through final case resolution. Sensitive content is encrypted so that only the respondent and the system owner can read it, while anyone can verify the chain's integrity.

### Core principles

1. **One ledger per case.** A case's ledger begins when the respondent starts filling out a form and ends when the case reaches a terminal state. Intake events and governance events are different event types in the same append-only log.

2. **The SaaS platform processes the ledger but does not own it.** The ledger is the respondent's (or tenant's) record. The platform appends events, maintains materialized views, and serves queries. If the platform shuts down, the ledger is a self-contained, cryptographically verifiable, complete record of everything that happened.

3. **Hash the ciphertext, not the plaintext.** Verification and decryption are orthogonal operations. Anyone can prove the chain is intact by hashing encrypted envelopes. Only key holders can read the content.

4. **Materialized views are derived and disposable.** Postgres tables serving the reviewer dashboard, task queues, case index, and analytics are projections of the ledger. They can be rebuilt by replaying ledger events. The ledger is the backup.

5. **Temporal provides execution durability. The ledger provides evidentiary integrity.** These are complementary, not competing. Temporal's event history tracks execution state (which timer is active, which workflow step is current). The ledger tracks the evidence record (who did what, why, under what authority, with what data). They cross-reference via checkpoint hashes.

---

## Part 1: Comprehensive Requirements

### 1.1 Who writes to the ledger

Every actor that touches the ledger introduces different trust and identity requirements.

| Actor | What they write | Trust level | Identity requirement |
|-------|----------------|-------------|---------------------|
| **Respondent** | Form events: drafts, field changes, uploads, submission | Untrusted input, trusted identity | Government: NIST IAL2 (ID.me, Login.gov). Nonprofit: email verification may suffice. |
| **Respondent's delegate** | Same as respondent, on their behalf | Untrusted input, delegated identity | Must prove delegation authority (power of attorney, authorized representative). |
| **Caseworker** | Task claims, determinations, rationale, overrides, case notes | Trusted actor, org-authenticated | Org SSO/SAML. The ledger records which human, not just which role. |
| **Supervisor** | Quality reviews, escalation decisions, override approvals | Trusted actor, elevated authority | Same as caseworker plus delegation of authority chain verification. |
| **AI agent** | Extractions, recommendations, confidence reports | Untrusted output, system-authenticated | Model ID, model version, invocation ID. No human identity. |
| **System** | Timer firings, SLA breaches, governance evaluations, transitions | Trusted, deterministic | Component ID plus version. Deterministic actions should be reproducible. |
| **Support agent** | Accessed case data for troubleshooting | Trusted actor, JIT-approved | Must record: who, when, why, what they accessed, approval chain. |
| **External service** | Verification responses, policy engine decisions | Untrusted response | Service identifier plus idempotency key. |

### 1.2 Integrity requirements

| Requirement | Description | Existing technology |
|-------------|-------------|---------------------|
| Append-only storage | Events never modified or deleted at the storage layer. | immudb (purpose-built immutable DB), EventStoreDB, Postgres with append-only constraints |
| Hash chain | Each event's hash includes the previous event's hash. Breaks on insert, delete, or reorder. | immudb (native), or trivial custom implementation |
| Merkle tree proofs | Prove a specific event exists without revealing the full ledger (inclusion proof). Prove two snapshots are consistent (consistency proof). | Google Trillian (powers Certificate Transparency), immudb (built-in) |
| Client-side verification | Client can verify the server is not lying about ledger state. Server provides proof; client checks locally. | immudb (client SDK verifies against Merkle root), Trillian |
| Point-in-time queries | Reconstruct case state at any historical moment. | immudb (built-in time travel), EventStoreDB (temporal projections) |
| Cross-ledger verification | When case A references case B, verify the junction point is consistent across both ledgers. | Merkle root cross-references at junction points |
| Self-verifiable export | Anyone with the ledger can verify its integrity without platform access. | Pure computation on the exported artifact. Standard Merkle verification libraries. |

### 1.3 Identity requirements

| Requirement | Description | Existing technology |
|-------------|-------------|---------------------|
| Actor identification | Every event attributed to a specific actor. | WOS Kernel S3.3, Respondent Ledger S6.4 (specified) |
| Actor type distinction | Human vs. system vs. agent. Immutable per action. | WOS Kernel S3.1 (specified) |
| Decentralized identifiers | Respondent identity is a DID, not a platform-issued user ID. Controlled by the respondent. | W3C DID Core (Recommendation). Methods: `did:web`, `did:key`, `did:ion`. |
| Verifiable Credentials | Identity attestations (government proofing, delegation) issued as signed credentials. Respondent holds credentials in a wallet. Platform verifies them. | W3C Verifiable Credentials Data Model 2.0 (Recommendation) |
| Identity assurance levels | The ledger records the assurance level achieved. IAL1 (self-asserted) through IAL3 (in-person proofing). | NIST SP 800-63 defines levels. VCs carry assurance metadata. |
| Government identity proofing | ID.me, Login.gov integration for NIST IAL2. Required for rights-impacting workflows. | Respondent Ledger S6.6 (specified, adapter boundary defined) |
| Delegated access | Power of attorney, authorized representative, legal guardian. 5 actor kinds: respondent, delegate, system, support-agent, unknown. | Respondent Ledger S6.4 (specified). VCs with delegation assertions. |
| Support agent JIT access | Support staff access requires just-in-time approval, logged with approval chain. | ADR-0004 (designed) |

**On Proof of Personhood:** PoP is an identity attestation type within the Verifiable Credentials framework, not a separate system. For government workflows, NIST IAL2 identity proofing is strictly stronger than PoP -- proving you are a specific government-identified person subsumes proving you are a unique human. PoP matters for anonymous scenarios (surveys, public comment periods) where "one person, one response" matters without identity disclosure. The ledger records the attestation type and assurance level; the PoP protocol is external. No separate PoP framework is needed.

### 1.4 Privacy requirements

| Requirement | Description | Existing technology |
|-------------|-------------|---------------------|
| Four privacy tiers | Anonymous, pseudonymous, identified, fully attributable. Different tiers for different contexts. | Respondent Ledger S6.7 (specified) |
| Selective disclosure | Prove specific claims without revealing the full record. "Prove income was verified without revealing the income amount." | BBS+ signatures (W3C draft). Sign the full record, derive a proof revealing only selected fields. |
| Redaction | Replace content with a tombstone while preserving chain integrity. For FOIA, court-ordered redaction. | Crypto-shredding (destroy per-respondent key). The ciphertext remains; the content is irrecoverable. Tombstone event records the redaction. |
| Field-level access control | Caseworker A sees income data; caseworker B (different program) does not. | WOS Runtime S12.5 (AccessControl.canRead -- specified) |
| PII classification | Which fields contain personal information? Required for data minimization and automated PII scanning. | Formspec Ontology spec (concept URIs enable automated PII classification -- specified) |
| Consent tracking | What did the respondent agree to? What data processing was authorized? | Respondent Ledger S6 (partially specified) |
| Data minimization | Collect only what is needed. Non-relevant field handling per Core S5.6. | Formspec Core S5.6 (specified: 3 modes) |
| Sensitive value minimization | Ledger events should not contain raw PII unnecessarily. Hashed priors, display summaries. | Respondent Ledger (partially specified). Encryption model handles this structurally. |
| Zero-knowledge aggregate proofs | Prove "denial rate is below 15% for all groups" without revealing individual outcomes. | ZK-SNARKs or homomorphic aggregation. High-assurance option per ADR-0054. |

### 1.5 Regulatory requirements

| Requirement | Regulation | How the ledger enforces it |
|-------------|-----------|---------------------------|
| Due process records | APA, 5th/14th Amendment | Governance events (`wos.provenance.reasoning`, `wos.provenance.counterfactual`, `wos.explanation.assembled`) must exist for adverse decisions. A case in `adverse-decision` state without these events is a verifiable compliance gap. |
| AI disclosure | OMB M-24-10, EU AI Act Art. 13 | `wos.agent.invoked` events exist when an agent participated. An adverse decision notice without AI disclosure (when agent events exist) is a verifiable gap. |
| Review protocol proof | WOS Governance S4 | `wos.review.protocol` events record protocol type and timing. For `independentFirst`: independent assessment event precedes recommendation reveal event in the chain. Temporal ordering is structural. |
| Separation of duties | WOS Governance S7.2 | Task completion and determination events record different actors. An auditor verifies they differ by comparing events. |
| GDPR portability | GDPR Art. 20 | The ledger IS the export. Self-contained, machine-readable, verifiable. |
| GDPR erasure | GDPR Art. 17 | Crypto-shredding: destroy the per-respondent key. Ciphertext remains (chain intact). Content irrecoverable. Key destruction event recorded. |
| Retention schedules | Federal Records Act | Retention metadata on the ledger. Automated enforcement: past-retention ledgers without legal hold can be archived. Both states recorded as events. |
| Legal hold | FRCP | Hold event overrides retention schedule. Release event restores normal lifecycle. |
| FOIA disclosure | 5 USC 552 | BBS+ selective disclosure proofs reveal requested fields. Encrypted fields whose keys are destroyed appear as redacted. Hash chain proves the redacted record is authentic. |
| Court admissibility | FRE 803(6) | Business records exception requires: regular practice, made at or near the time, by person with knowledge or automated process, trustworthy. The ledger satisfies all five by construction: systematic (automated append), contemporaneous (timestamps), attributed (signed events), routine (every case), tamper-evident (hash chain + signatures + external anchoring). |
| HIPAA | 45 CFR 164 | Per-respondent encryption isolates PHI. Access logging via support agent events. BAA is a deployment concern, not a ledger design concern. |
| Expungement | Court orders | Crypto-shredding plus respondent key destruction (respondent cooperates with court order). Content irrecoverable by anyone. Expungement order recorded as ledger event. |

### 1.6 Lifecycle requirements

| Requirement | Description |
|-------------|-------------|
| Retention policies as metadata | The ledger carries its retention schedule. Machine-enforceable. |
| Legal hold as ledger state | Freeze archival and deletion during litigation. Hold event overrides retention. |
| Archival with verification | Move to cold storage. Must remain verifiable in cold storage. Content-addressed: if the hash matches, the content is intact. |
| Schema evolution | New event types added over time. Old events remain readable. Each event carries its schema version. |
| Ledger format migration | Hash algorithm or signing algorithm changes. Algorithm agility: each checkpoint records which algorithms were used. Verification follows the declared algorithm. |
| Case closure | Terminal cases: ledger sealed for normal operations, open for post-resolution events (audit queries, FOIA, legal hold). Sealed status recorded as an event. |

### 1.7 WOS governance requirements

| Requirement | Source |
|-------------|--------|
| Four provenance tiers (Facts, Reasoning, Counterfactual, Narrative) | WOS Kernel S8, Governance S6, AI S13 |
| Epistemic status (authoritative vs. non-authoritative) | WOS AI S13.2 |
| Authority ranking (statute > regulation > policy > guideline) | WOS Governance S6.2 |
| Deontic constraint results with enforcement ordering | WOS AI S4 |
| Confidence tracking (overall, per-field, method, calibration) | WOS AI S7 |
| Confidence decay (trigger, factor, effective confidence) | WOS AI S7.5 |
| Cumulative confidence (session, step products, floor comparison) | WOS AI S7.7 |
| Review protocol proof (type, timing, independent assessment ordering) | WOS Governance S4, AI S10.2 |
| Separation of duties proof (actor differs from determiner) | WOS Governance S7.2 |
| Delegation chain proof (ID, delegator, delegate, scope, expiration, depth) | WOS Governance S11.4 |
| Explanation assembly record | WOS Runtime S9 |
| Equity monitoring data (metric, dimension, rates, disparity, threshold) | WOS Advanced S3 |
| Drift detection data (agent, metric, method, observed, threshold) | WOS AI S9, Drift Monitor sidecar |
| Volume counter state (agent, window, count, limit) | WOS AI S11.1 |

All specified in WOS normative prose. Ledger event type definitions are new work per this ADR.

---

## Part 2: Encryption Architecture

### 2.1 Encrypt-then-hash

The ledger's integrity chain operates on ciphertext. Verification never requires decryption.

```
Event Structure:
+--------------------------------------------------------------+
|  Plaintext Envelope (verifiable by anyone)                    |
|                                                              |
|  event_type, timestamp, actor_type, schema_version, prev_hash|
|  governance_result (pass/fail), tags                          |
|                                                              |
|  +----------------------------------------------------------+|
|  |  Encrypted Payload (readable only by key holders)         ||
|  |                                                          ||
|  |  AES-256-GCM ciphertext of:                              ||
|  |    actor_id, field values, rationale, evidence,           ||
|  |    confidence details, document content                   ||
|  +----------------------------------------------------------+|
|                                                              |
|  +----------------------------------------------------------+|
|  |  Key Bag                                                  ||
|  |                                                          ||
|  |  tenant_wrapped_dek:      encrypted DEK using PRK         ||
|  |  respondent_wrapped_dek:  encrypted DEK using DID pubkey  ||
|  |  key_id:                  reference to key in KMS          ||
|  +----------------------------------------------------------+|
|                                                              |
|  event_hash = SHA-256(envelope + ciphertext + key_bag)        |
+--------------------------------------------------------------+
```

### 2.2 Key hierarchy

Three levels. Each enables a different access pattern and a different deletion scope.

```
Tenant Master Key (TMK)                    Respondent DID Key Pair
  held in KMS (Vault, AWS KMS, etc.)         held by respondent (wallet, device)
  never exported                             private key never leaves respondent
        |                                          |
        v                                          v
Per-Respondent Key (PRK)                   respondent's public key
  derived from TMK per respondent                  |
  stored in KMS                                    |
  destroying this = GDPR erasure                   |
        |                                          |
        v                                          v
Per-Event Data Encryption Key (DEK)
  random AES-256 key, generated per event
  encrypts the event payload
  wrapped (encrypted) by BOTH:
    PRK  -->  tenant_wrapped_dek  (stored in ledger)
    Respondent public key  -->  respondent_wrapped_dek  (stored in ledger)
  plaintext DEK discarded immediately after wrapping
```

### 2.3 Access paths

**Tenant staff (caseworker Angela):**

```
KMS.decrypt(tenant_wrapped_dek, using: PRK derived from TMK)
  -> DEK
  -> AES-256-GCM.decrypt(ciphertext, using: DEK)
  -> plaintext event content
```

Access goes through the KMS. The KMS logs every decryption. The platform decrypts in memory during processing and never stores plaintext at rest.

**Respondent (James):**

```
DID_private_key.decrypt(respondent_wrapped_dek)
  -> DEK
  -> AES-256-GCM.decrypt(ciphertext, using: DEK)
  -> plaintext event content
```

Access uses the respondent's own key. It does not go through the tenant or the platform. When the respondent exports their ledger, they can read it on their own machine with their own key.

**Verifier (federal auditor, integrity checker):**

```
For each event in chain:
  computed_hash = SHA-256(envelope + ciphertext + key_bag)
  assert computed_hash == event.event_hash
  assert event.prev_hash == previous_event.event_hash
Chain verified. Content not decrypted.
```

The auditor proves the chain is unbroken without reading a single event's content. If the auditor needs content access for a case review, the tenant provides the PRK or the respondent cooperates.

**External transparency log:**

```
At each checkpoint:
  merkle_root = MerkleTree.root(all event hashes since last checkpoint)
  anchor = submit(merkle_root) to Rekor / OpenTimestamps
```

The transparency log sees one hash. It learns nothing about the content, the respondent, or the case.

### 2.4 What stays plaintext vs. what gets encrypted

| Data | Encrypted? | Reason |
|------|-----------|--------|
| Event type (`wos.task.completed`) | No | Verifiers need structural knowledge. "A task was completed" is not sensitive. |
| Timestamp | No | Temporal ordering must be verifiable. |
| Actor type (`human`, `agent`, `system`) | No | Governance verification needs to know an agent participated. AI disclosure is structural. |
| Schema version | No | Forward compatibility. Readers must parse the envelope. |
| Hash chain references | No | Verification requires these. |
| Governance check result (pass/fail) | No | Structural. "Deontic check passed" is verifiable without knowing what was checked. |
| Tags (`determination`, `adverse-decision`) | No | Governance attachment and compliance verification. |
| Actor identity (`angela.martinez`) | **Yes** | PII. |
| Case file field values | **Yes** | PII/PHI. |
| Determination rationale | **Yes** | Contains case-specific reasoning. |
| Document content and attachments | **Yes** | Uploaded pay stubs, medical records. |
| Confidence details (per-field scores) | **Yes** | Per-respondent confidence may reveal sensitive information about case complexity. |
| Equity monitoring dimensions | **Yes** | Demographic grouping data is sensitive. Aggregate disparity metrics derived in memory. |
| Delegation chain details | **Yes** | Who delegated to whom may be sensitive. |

Structural verification (was due process followed? was AI disclosed? were reviews independent?) works on plaintext envelopes. Content verification (what was the income? what was the rationale?) requires decryption.

### 2.5 Crypto-shredding

**Delete one respondent (GDPR Art. 17):**

1. Destroy the Per-Respondent Key (PRK) in KMS.
2. All `tenant_wrapped_dek` entries for that respondent become irrecoverable.
3. Ciphertext remains in the ledger. Chain is unbroken. Hashes still verify.
4. The respondent's `respondent_wrapped_dek` entries still work if the respondent has their DID key -- the respondent retains access to their own data (GDPR Art. 20 portability).
5. Append a `ledger.key.destroyed` event recording: key ID, timestamp, reason (`gdpr_erasure_request`), request reference.

**Delete an entire tenant:**

1. Destroy the Tenant Master Key (TMK) in KMS.
2. All PRKs derived from TMK become irrecoverable.
3. All tenant case data becomes irrecoverable.
4. All respondents retain access via their own DID keys.
5. Ledger chains remain verifiable.

**Court-ordered expungement:**

1. Destroy the PRK (tenant cannot read).
2. Respondent destroys their DID private key (cooperating with court order).
3. No key exists that can decrypt the content.
4. Ciphertext remains. Chain integrity preserved. Content irrecoverable by anyone.
5. Expungement order recorded as ledger event.

### 2.6 BBS+ selective disclosure

BBS+ is separate from encryption. It solves a different problem: "prove a claim about the content without revealing the content."

At event creation time:

1. BBS+ sign all plaintext fields individually (BBS+ signs a vector of messages, one per field).
2. Encrypt the sensitive fields (per the encryption model above).
3. Hash the encrypted event into the chain.

At disclosure time (FOIA, cross-agency sharing, audit):

1. Create a BBS+ derived proof revealing only selected fields.
2. The proof is verifiable against the BBS+ public key.
3. The verifier confirms the fields were part of a signed event without seeing other fields or needing the decryption key.

Three layers, three independent purposes:

- **Hash chain** proves "these events are unmodified and in order."
- **Encryption** ensures "only authorized parties can read the content."
- **BBS+ proofs** prove "these specific claims about the content are true."

---

## Part 3: Technology Composition

### 3.1 What we adopt vs. what we build

| Layer | Build or adopt | Technology | Rationale |
|-------|---------------|------------|-----------|
| Immutable storage with Merkle proofs | **Adopt** | immudb or Google Trillian | Solved problem. immudb provides immutability, Merkle proofs, client-side verification, time travel, SQL interface. Open source (Apache 2.0). |
| Event signing | **Adopt standard** | COSE (RFC 9052) or JWS (RFC 7515) | Standards-based. Libraries in every language. |
| External anchoring | **Adopt** | Sigstore Rekor (transparency log) + OpenTimestamps (Bitcoin anchor) | Rekor for continuous transparency. OpenTimestamps for offline-verifiable timestamps. Both open source. |
| Selective disclosure | **Adopt standard** | BBS+ signatures (W3C draft) | The correct technology for field-level selective disclosure. Libraries exist (MATTR, Hyperledger Aries). |
| Encryption and key management | **Adopt pattern** | Envelope encryption + HashiCorp Vault or cloud KMS | Standard crypto-shredding pattern. Novel part: hash over ciphertext integration with chain. |
| Decentralized identity | **Adopt standards** | W3C DIDs + Verifiable Credentials 2.0 | The identity layer. ID.me/Login.gov as VC issuers. |
| Portable export | **Adopt format** | RO-Crate or signed JSON archive | Packaging: ledger + public keys + Merkle proofs + schema + anchor proofs. |
| Unified event taxonomy | **Build** | -- | Formspec intake events + WOS governance events + lifecycle events in one schema. No existing standard covers this. |
| Privacy tier model | **Build** | -- | Who sees what when. Audience-scoped views backed by BBS+ selective disclosure. |
| Regulatory compliance semantics | **Build** | -- | Retention, legal hold, redaction as ledger operations. Crypto-shredding lifecycle. |
| WOS governance event definitions | **Build** | -- | ~25 governance event types with field schemas, privacy classifications, provenance tier mappings. |
| Coprocessor protocol | **Build** | -- | How intake handoffs become governance events. WOS-owned `case.created` transition per ADR 0073. |
| Materialized view projections | **Build** | -- | How ledger events project to Postgres read models. Domain-specific CQRS. |

### 3.2 Architecture diagram

```
+-------------------------------------------------------------+
|                  Unified Ledger Spec                         |
|  Event taxonomy . Privacy tiers . Regulatory semantics       |
|  (THIS IS WHAT WE BUILD)                                     |
+---------------------------+---------------------------------+
                            |
+---------------------------v---------------------------------+
|                  Cryptographic Layer                          |
|  COSE/JWS signing . BBS+ selective disclosure                |
|  Envelope encryption . Crypto-shredding                      |
|  (ADOPT STANDARDS, IMPLEMENT INTEGRATION)                    |
+---------------------------+---------------------------------+
                            |
+---------------------------v---------------------------------+
|                  Storage + Verification                       |
|  immudb: immutability, Merkle proofs, time travel, SQL       |
|  Rekor/OpenTimestamps: external anchoring                    |
|  Vault/KMS: key management                                   |
|  (ADOPT, DEPLOY, CONFIGURE)                                  |
+---------------------------+---------------------------------+
                            |
+---------------------------v---------------------------------+
|                  Identity Layer                               |
|  W3C DIDs + Verifiable Credentials 2.0                       |
|  ID.me / Login.gov as VC issuers                             |
|  BBS+ for selective disclosure of identity attributes         |
|  (ADOPT STANDARDS, INTEGRATE PROVIDERS)                      |
+-------------------------------------------------------------+
```

### 3.3 Research questions

These must be answered before implementation:

1. Does immudb's Merkle tree support the proof types we need (inclusion, consistency, cross-database)?
2. Is BBS+ mature enough for production use in government contexts?
3. Can COSE/JWS signing integrate cleanly with immudb's native verification?
4. Has anyone implemented crypto-shredding on a Merkle-tree-based store (hash computed over ciphertext)?
5. Can Sigstore Rekor serve as external anchor for a non-software-signing use case?
6. What is the state of W3C VC adoption by government identity providers (ID.me, Login.gov)?

---

## Part 4: Unified Event Taxonomy

### 4.1 Intake phase (Respondent Ledger -- already specified)

| Event | Description |
|-------|-------------|
| `session.started` | Respondent began filling out the form |
| `draft.saved` | Form progress saved |
| `draft.resumed` | Respondent returned to a saved draft |
| `attachment.added` | Document uploaded |
| `attachment.replaced` | Document replaced |
| `attachment.removed` | Document removed |
| `prepopulation.applied` | Data pre-filled from external source |
| `validation.snapshot-recorded` | Validation state captured |
| `response.completed` | Form submitted |
| `response.amendment-opened` | Amendment initiated |
| `response.amended` | Amendment completed |
| `response.stopped` | Submission abandoned |
| `system.merge-resolved` | Concurrent edit conflict resolved |

### 4.2 Coprocessor transition (refined by ADR 0073)

| Event | Description |
|-------|-------------|
| `case.created` | WOS-created case boundary after accepting an intake handoff. Links intake events to governance events. Records case file mapping and contract validation result. |
| `case.field.mapped` | Records how response fields mapped to case file fields. |
| `case.contract.validated` | Records contract validation result before workflow fires. |

### 4.3 Governance phase (WOS provenance -- new)

| Event | Description |
|-------|-------------|
| `wos.transition.fired` | Lifecycle state transition. Facts tier. |
| `wos.action.executed` | Action completed. Facts tier. |
| `wos.task.created` | Human task created with assignment roles and SLA. |
| `wos.task.claimed` | Reviewer claimed a task. |
| `wos.task.completed` | Reviewer completed a task with result. |
| `wos.task.escalated` | Task escalated due to SLA breach or condition. |
| `wos.governance.evaluated` | Governance rule evaluated. |
| `wos.deontic.evaluated` | Deontic constraint checked. |
| `wos.confidence.checked` | Confidence floor or decay evaluated. |
| `wos.delegation.verified` | Delegation authority verified for a determination. |
| `wos.separation.verified` | Separation of duties verified. |
| `wos.review.protocol` | Review protocol enforced. |
| `wos.hold.entered` | Case entered a hold state. |
| `wos.hold.resumed` | Case resumed from hold. |
| `wos.provenance.reasoning` | Reasoning tier record. |
| `wos.provenance.counterfactual` | Counterfactual tier record. |
| `wos.provenance.narrative` | Narrative tier record (`authoritative: false`). |
| `wos.explanation.assembled` | Explanation assembly completed. |
| `wos.appeal.filed` | Appeal filed with linked parent case. |
| `wos.agent.invoked` | AI agent invoked with confidence report. |
| `wos.agent.fallback` | Fallback chain level executed. |
| `wos.drift.detected` | Drift alert triggered. |
| `wos.autonomy.changed` | Agent autonomy escalated or demoted. |
| `wos.equity.alert` | Equity guardrail threshold breached. |
| `wos.timer.created` | Timer started. |
| `wos.timer.fired` | Timer expired and event emitted. |
| `wos.timer.cancelled` | Timer cancelled. |

### 4.4 Lifecycle phase (new)

| Event | Description |
|-------|-------------|
| `ledger.checkpoint` | Signed checkpoint with Merkle root. |
| `ledger.anchored` | External anchor confirmation. |
| `ledger.hold.entered` | Legal hold applied. |
| `ledger.hold.released` | Legal hold removed. |
| `ledger.retention.set` | Retention schedule applied. |
| `ledger.archived` | Moved to cold storage. |
| `ledger.key.destroyed` | Crypto-shredding for erasure. Records: key ID, reason, request reference. |
| `ledger.redacted` | Content replaced with tombstone (FOIA, court order). |
| `ledger.exported` | Complete export produced for portability. |
| `ledger.schema.upgraded` | Event schema version changed. |
| `ledger.sealed` | Case reached terminal state. Normal appends cease; lifecycle events still permitted. |

### 4.5 Cross-case (partially specified in WOS Kernel S5.5)

| Event | Description |
|-------|-------------|
| `case.related` | Cross-ledger reference with Merkle root of referenced case at time of reference. |
| `case.related.state-changed` | Referenced case changed state. |
| `case.related.resolved` | Referenced case reached terminal state. |

---

## Part 5: Temporal Integration

### 5.1 Separation of concerns

```
Temporal Event History            Unified Case Ledger
(execution durability)            (evidentiary integrity)

WorkflowStarted  ----- links to --- session.started
ActivityScheduled                      ...
ActivityCompleted --- links to --- wos.transition.fired
TimerStarted                       wos.timer.created
SignalReceived  ----- links to --- response.completed
ActivityCompleted --- links to --- wos.task.completed

Temporal replays from its          Ledger replays to rebuild
event history to recover           materialized views and
workflow execution state.          prove what happened.
```

**Cross-reference mechanism:** Every Temporal activity that appends to the ledger returns the resulting checkpoint hash. Temporal records this hash in its activity result. To verify alignment: replay the ledger, recompute checkpoint hashes, confirm they match what Temporal recorded.

Temporal owns: "is timer T37 still active?" "which workflow step are we on?" "what signals are queued?"

The ledger owns: "who made this determination?" "what rules applied?" "was the AI agent's confidence above the floor?" "did the reviewer form an independent assessment before seeing the recommendation?"

### 5.2 Materialized views

| View | Source events | Purpose | Rebuild method |
|------|-------------|---------|----------------|
| Case index | `case.created`, `wos.transition.fired` | Dashboard: "show Angela's 47 pending cases" | Replay `case.created` plus latest `transition.fired` per case |
| Task queue | `wos.task.*` events | Reviewer work queue | Replay task events, filter non-terminal |
| Current case file | `setData` mutations within `wos.action.executed` | "What is the current income value?" | Replay all `action.executed` for one case |
| SLA status | `wos.task.created`, `wos.timer.*`, `wos.task.completed` | SLA breach warnings | Replay task and timer events |
| Equity metrics | `wos.transition.fired` on `determination`-tagged transitions | Disparity monitoring | Replay determination events, aggregate |
| Analytics | All events | Completion rates, drop-off, time-to-determination | Full replay (batch) |

Views are eventually consistent with the ledger. A view that falls behind can be rebuilt by replaying from the last known checkpoint.

---

## Part 6: Data Hosting Model

| Tier | Ledger storage | Encryption | Anchoring | Export |
|------|---------------|------------|-----------|--------|
| **Shared Cloud** | Platform-hosted. Tenant-keyed encryption envelope. Platform operates on the ledger but cannot read raw data without tenant's key. | Tenant-managed keys (BYOK or platform-generated via KMS). | Optional. | Tenant exports complete ledger at any time. Self-verifying. |
| **Regulated Cloud** | Platform-hosted with external integrity anchoring. Checkpoint hashes written to Rekor/OpenTimestamps. | Tenant-managed keys. External anchor provides third-party integrity proof. | Required. Rekor and/or OpenTimestamps. | Same as Shared, plus external verification via public log. |
| **Dedicated** | Tenant-hosted. Platform reads/writes via API. | Tenant controls all keys and infrastructure. | Tenant-controlled. | Ledger never leaves tenant infrastructure unless tenant exports. |

---

## Alternatives Considered

### Alternative 1: Separate stores (current assumption)

Respondent Ledger for intake. Postgres provenance table for WOS. Temporal event history for execution.

**Rejected because:** Three sources of truth. No unified integrity chain. The audit package requires joining across systems. The platform owns governance data. Two integrity models for one case.

### Alternative 2: Temporal event history as canonical store

Use Temporal's event history for everything.

**Rejected because:** Temporal's event history is optimized for workflow replay, not evidentiary audit. It records ActivityScheduled/ActivityCompleted pairs, not structured governance decisions. It lacks hash chaining, cryptographic signing, privacy-tiered disclosure, external anchoring, selective disclosure, and encryption-based deletion.

### Alternative 3: Separate WOS provenance ledger

Build a second append-only, hash-chained store specifically for WOS provenance.

**Rejected because:** Duplicates the Respondent Ledger's integrity infrastructure for no benefit. Two ledgers for one case still require joining. Two integrity chains to maintain.

### Alternative 4: Ledger as source of truth, no Temporal

Use the ledger for both evidentiary integrity and execution durability.

**Rejected because:** The ledger cannot answer "is timer T37 active?" without replaying the full history. It has no mechanism for signal queuing, exactly-once activity execution, or deterministic replay of non-deterministic service calls. Building these into the ledger recreates Temporal with worse performance.

### Alternative 5: Blockchain / distributed ledger

Use Hyperledger Fabric, Ethereum L2, or similar for immutability and distributed consensus.

**Rejected because:** The ledger has a single writer per case (the platform). Distributed consensus solves a problem that does not exist here. Blockchain adds latency, complexity, and operational burden without benefit. Hash chains with external anchoring provide equivalent integrity guarantees for a single-writer scenario. External anchoring to a transparency log (Rekor) or a blockchain (OpenTimestamps uses Bitcoin) provides third-party verifiability without running a consensus protocol.

---

## Consequences

### Positive

1. **Data sovereignty is architectural.** The tenant's data lives in their ledger, encrypted with their keys. The platform processes it. Export means "take your ledger." The ledger is the export.

2. **Audit compliance is a storage property.** Every event is append-only, hash-chained, signed, encrypted, and (optionally) externally anchored. A federal auditor receives one artifact with unbroken integrity from form fill to case resolution.

3. **GDPR erasure is provable.** Destroy the per-respondent key. The ciphertext remains (chain intact). The content is irrecoverable. The key destruction event records when and why. An auditor can verify: encrypted content plus destroyed key equals effective erasure.

4. **Selective disclosure replaces redaction.** A FOIA officer produces a BBS+ proof revealing requested fields. The proof is verifiable. The unrevealed fields remain encrypted. No manual redaction. No risk of incomplete redaction.

5. **The coprocessor simplifies.** It does not copy data between systems. Formspec hands off pinned intake evidence; WOS accepts the handoff and emits `case.created` into the ledger that already contains intake events. The case file is a materialized view.

6. **Disaster recovery is replay.** The ledger is the backup. Any materialized view can be rebuilt by replaying ledger events.

7. **Merkle tree tamper evidence is delivered.** By using immudb or Trillian, the provenance integrity that WOS TODO.md lists as "Deferred / Not started" is inherited from the storage layer.

8. **Court admissibility by construction.** The ledger satisfies FRE 803(6) business records exception requirements structurally: systematic, contemporaneous, attributed, routine, tamper-evident.

9. **Competitive differentiation deepens.** No competitor stores case data in a cryptographically verifiable, portable, respondent-owned, selectively-disclosable ledger with encryption-based deletion. This is structural differentiation.

### Negative

1. **CQRS complexity.** Every read query hits a materialized view, not the source of truth. Views must be kept in sync. Standard eventual consistency applies.

2. **Cross-ledger indexing.** "Show me all cases across all respondents" requires a projection spanning ledgers. The platform maintains global indexes not in any single ledger.

3. **Write path latency.** Every governance check appends an encrypted event with key wrapping. Batch writes with periodic checkpoints mitigate this.

4. **BBS+ maturity.** BBS+ signatures are a W3C draft, not a Recommendation. Government procurement may require a finalized standard. Selective disclosure is a progressive enhancement -- the ledger functions without it; BBS+ adds disclosure capabilities when ready.

5. **Key management complexity.** Per-respondent keys, tenant master keys, DID key pairs, BBS+ signing keys, checkpoint signing keys. Key rotation, escrow, and destruction must be correct. Using managed KMS (Vault, cloud KMS) is essential.

6. **Encryption overhead.** Every event requires a DEK generation, two key wrappings, and AES-256-GCM encryption. Envelope encryption is efficient but adds latency compared to plaintext appends.

7. **Respondent key management burden.** The respondent must manage a DID key pair to exercise independent access. If they lose their key, they lose independent access (the tenant can still access via the PRK). Key recovery mechanisms (social recovery, custodial backup) add complexity.

8. **Two replay mechanisms coexist.** Temporal replays for execution recovery. The ledger replays for view rebuilding and audit verification. The cross-reference mechanism (checkpoint hashes in Temporal activity results) aligns them, but requires testing.

---

## Implementation Notes

### Respondent Ledger spec changes

1. Add a governance event namespace (`wos.*`) with extension mechanism for governance-phase events.
2. Define the WOS-owned `case.created` transition event linking intake and governance phases after intake-handoff acceptance.
3. Add encryption envelope specification: plaintext envelope schema, ciphertext format, key bag structure.
4. Add `ledger.*` lifecycle event types for retention, hold, key destruction, schema evolution.
5. Specify that checkpoint and signing mechanisms apply identically to all event phases.
6. Define the BBS+ signing integration: which fields are signed, how derived proofs are structured.

### Formspec Coprocessor spec

1. The `IntakeHandoff` structure (formerly `CaseInitiationRequest`; renamed via ADR 0073): submission reference, response hash, validation report, case file mapping, contract validation result, and kernel document reference.
2. How `response.completed` produces an intake handoff, and how WOS acceptance produces `case.created` -- the phase transition.
3. How subsequent Formspec events (RFI responses) append to the same ledger.
4. The checkpoint hash at case creation, linking the intake chain to the governance chain.

### Temporal reference implementation changes

1. Replace `append_provenance` activity with `append_to_ledger` activity targeting immudb.
2. Activity returns checkpoint hash for Temporal cross-reference.
3. Add ledger projection worker updating Postgres materialized views.
4. Temporal queries for real-time execution state remain unchanged.
5. Add encryption/decryption in the append and query paths.

### Migration path

Phase 1 can launch with Postgres-backed provenance. Migration to the unified ledger in Phase 2:

1. Backfill the ledger from Postgres records (each record becomes an encrypted ledger event).
2. Materialized views unchanged -- they still read from Postgres.
3. Write path changes from Postgres INSERT to ledger append with Postgres projection.
4. No data loss. No schema change. The migration adds integrity and encryption to existing records.

---

## What we do NOT need

| Capability | Why not |
|-----------|---------|
| **Separate Proof of Personhood framework** | Already an identity attestation type within W3C Verifiable Credentials. Government identity proofing (IAL2) is strictly stronger. |
| **Blockchain / distributed consensus** | Single writer per case. Hash chains plus external anchoring provide equivalent integrity. |
| **Zero-knowledge proofs for routine operations** | ZKPs are a high-assurance enhancement for specific regulatory scenarios, not a baseline requirement. BBS+ selective disclosure covers most needs. |
| **Real-time query on the ledger** | Materialized views handle all read queries. The ledger is the write and verification path. |
| **Custom storage engine** | immudb or Trillian provides immutability, Merkle proofs, and verification out of the box. |
| **Custom signing scheme** | COSE and JWS are standards with mature libraries. |
| **Custom identity protocol** | W3C DIDs plus Verifiable Credentials are the standard. |

---

## References

- Respondent Ledger Spec (Formspec) -- 969 lines, 4 canonical objects, 13 required event types, 3 deployment profiles
- ADR-0003 (Audit Ledger) -- foundational audit architecture
- ADR-0007 (Key Management) -- signing keys for ledger integrity
- ADR-0012 (Data Lifecycle) -- retention, deletion, legal hold
- ADR-0054 (Client/Server Ledger Chain) -- client-to-server event flow, privacy-preserving proofs
- WOS Kernel S8 -- Facts tier provenance structure
- WOS Governance S6 -- Reasoning and Counterfactual tiers
- WOS AI Integration S13 -- Narrative tier
- WOS Runtime Companion S5-S9, S12 -- action execution, provenance, host interfaces
- Enterprise Implementation Roadmap -- Phase 1.3 (case management), Phase 2.1 (audit ledger)
- Temporal Reference Implementation (`thoughts/examples/temporal-reference-implementation.md`)
- Medicaid Redetermination User Stories (`thoughts/examples/medicaid-redetermination-user-stories.md`)
- W3C DID Core -- Decentralized Identifiers
- W3C Verifiable Credentials Data Model 2.0
- BBS+ Signatures (W3C draft, MATTR implementation)
- COSE (RFC 9052) -- CBOR Object Signing and Encryption
- JWS (RFC 7515) -- JSON Web Signature
- immudb -- open source immutable database (Codenotary, Apache 2.0)
- Google Trillian -- Merkle tree transparency log
- Sigstore Rekor -- transparency log for signed metadata
- OpenTimestamps -- Bitcoin-anchored timestamps
- NIST SP 800-63 -- Digital Identity Guidelines
- RO-Crate -- Research Object packaging (W3C)
- FRE 803(6) -- Federal Rules of Evidence, business records exception
