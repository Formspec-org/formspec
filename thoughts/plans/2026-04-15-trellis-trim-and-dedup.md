# Trellis Trim + Dedup — Implementation Plan (Plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trim the Trellis spec family down to *ledger-specific content only*. For substrate-neutral concepts (assurance taxonomy, disclosure posture, subject continuity, Invariant 6, legal-sufficiency disclaimer, authored signatures) that now have authoritative homes upstream, delete Trellis's local restatement and replace with a clean cross-reference to the upstream home. What remains in Trellis is the narrow cryptographic-ledger core that justifies Trellis as a separate reference implementation.

**Architecture:** Trellis is a reference implementation for distributed cryptographic ledger workflows. Its specs describe *how a ledger works* — Merkle proofs, canonical append attestations, hash constructions, custody postures unique to multi-party trust, key lifecycle cryptographic semantics, export verification packages, audit witness protocols, purge-cascade. The dependency direction is: **Formspec (bottom) ← WOS (references Formspec) ← Trellis (references both)**. Trellis citing "WOS Assurance §4" or "Formspec Respondent Ledger §6.6" is normal standards practice, not a violation. Where Trellis has a ledger-specific contribution (including WOS-delegated content like the Trust Profile object that WOS Kernel S10.5 explicitly delegates to the distributed-trust binding), Trellis defines it fully.

**Tech Stack:** Markdown (spec prose), JSON Schema (where applicable), git submodule at `trellis/` on `main` branch.

---

## Relationship to Sibling Plans

This is **Plan 3 of 3**. Status:

1. **Plan 1 (WOS additions)** — ✅ Complete. 13 commits in `wos-spec` submodule (HEAD `8c099fd`). Added `custodyHook` seam (Kernel S10.5), new Assurance layer at `wos-spec/specs/assurance/assurance.md` (L1–L4 taxonomy, subject continuity, Invariant 6 as the normative home, provider-neutral attestation, legal-sufficiency disclaimer), governance extensions (§2.9 schema upgrade, §4.9 quorum delegation, §7.15 legal hold).

2. **Plan 2 (Formspec Respondent Ledger harmonization)** — ✅ Complete. 1 commit in parent repo (`15d5413`). Strengthened L1–L4 at §6.6.1, promoted §6.7 disclosure-vs-assurance independence to normative, added §6.8 authored-signature vs. recorded-attestation distinction, added §2.4 legal-sufficiency disclaimer.

3. **Plan 3 (this doc)** — Not started. Trims Trellis specs and routes substrate-neutral concepts via cross-references to Plans 1 and 2 homes.

After Plan 3, the Trellis spec family should be ~25–35% smaller by line count, focused on cryptographic-ledger semantics with clean cross-references for non-ledger concepts.

---

## Cross-Reference Rules (read before every task)

Trellis is an implementation of WOS that hosts Formspec data contracts. Standard cross-reference practice applies:

- **Allowed** — citations to `[WOS §X]` or `[Formspec §Y]` or their companion specs (`[WOS Assurance §4]`, `[Formspec Respondent Ledger §6.6]`, etc.) when referring to concepts owned upstream.
- **Preferred** — when a concept is substrate-generic (has an authoritative upstream home) and Trellis's current text restates it, replace the restatement with a one-line cross-reference.
- **Required (ledger-specific content stays in Trellis)** — concepts that are genuinely Trellis's contribution stay fully defined here. Examples: Merkle proof model (inclusion + consistency), JCS+SHA-256 canonical serialization, construction IDs, canonical append attestation object, append-head references, equivocation evidence format, disclosure manifest wire structure (12-field artifact), export verification package contents (7-item artifact), hash construction registry, cryptographic erasure evidence, purge-cascade, audit witness attestation format, multi-party custody Trust Profile object (WOS Kernel S10.5 delegates this to Trellis by design).
- **Still required (ledger-specific safety invariants stay in Trellis)** — PRD-05 through PRD-08 (authorization evaluator safety under canonical-record authority). These exist *because* canonical records are authoritative, which is Trellis's contribution. No upstream owns these.
- **Avoid** — leaving a dangling in-spec citation after deleting the target. Task 12 verifies.

---

## File Structure

### Files to modify (trim + cross-reference)

| Path | Approximate trim | Focus of what remains |
|---|---|---|
| `trellis/specs/core/trellis-core.md` | ~25% | Canonical append, hash construction, append-only invariants, Merkle-style canonical order, cryptographic conformance roles. Invariant 6 stays as a ledger-operational invariant citing WOS Assurance §4 as the normative source |
| `trellis/specs/core/shared-ledger-binding.md` | ~15% | JCS+SHA-256 envelope, Merkle proof model, construction IDs, rejection codes, registries. Version-pinning delegates to Formspec Core per VP-01 |
| `trellis/specs/trust/trust-profiles.md` | ~35% | Multi-party custody Trust Profile object (WOS-delegated), metadata budget, verification posture classes, profile declaration schema, custody-mode Standard Profiles. Delete only the substrate-generic Invariant 6 restatement, the six-profile standard-profiles taxonomy that's generic (not custody-specific), and disclosure-posture-and-assurance restatement |
| `trellis/specs/trust/key-lifecycle-operating-model.md` | ~30% | Cryptographic erasure evidence, threshold custody crypto mechanics, algorithm agility for historical Merkle verification. Delete generic lifecycle-fact taxonomy (retention/hold/archival/sealing/schema-upgrade) and legal-sufficiency disclaimer (cross-ref to WOS Assurance §6) |
| `trellis/specs/export/export-verification-package.md` | ~25% | Ledger export package contents, verifier obligations. Delete generic claim-class taxonomy, substitute cross-references |
| `trellis/specs/export/disclosure-manifest.md` | ~30% | Ledger disclosure manifest wire structure. Delete Invariant 6 restatement, delete redeclared disclosure-posture enum; reference Formspec Respondent Ledger §6.6 and WOS Assurance §4 |
| `trellis/specs/projection/projection-runtime-discipline.md` | ~40% | Ledger-specific projection concerns: purge-cascade on cryptographic erasure, proof-material recoverability, snapshot discipline, **PRD-05 through PRD-08 authorization evaluator safety (KEPT — ledger-specific)**. Delete only generic canonical-vs-derived discipline and generic rebuild-contract prose |
| `trellis/specs/operations/monitoring-witnessing.md` | ~30% | Append-head consistency protocol, Merkle equivocation evidence, ledger-specific witness sub-roles. Delete generic witness subordination and detection-vs-enforcement (cross-ref WOS companion if one exists, or delete outright) |
| `trellis/specs/assurance/assurance-traceability.md` | ~50% | Ledger-specific invariant traceability matrix (populated with actual Trellis invariant IDs), CI expectations. Delete identity/attestation/continuity material (cross-ref WOS Assurance + Formspec Respondent Ledger as relevant) |
| `trellis/specs/core/unified-ledger-requirements-matrix.md` | rewrite | Remove rows whose normative content moved upstream; for each removed row add "Now owned by" pointer in the plan's cross-reference appendix |
| `trellis/specs/core/unified-ledger-companion-requirements-matrix.md` | rewrite | Same |

### New (added in this plan)

| Path | Purpose |
|---|---|
| `trellis/specs/cross-reference-map.md` | Single document mapping all moved concepts to their upstream homes. Lives alongside Trellis specs. |

### Files NOT touched in this plan

- `trellis/DRAFTS/*` — legacy drafts; unchanged
- `trellis/specs/forms/*` and `trellis/specs/workflow/*` — stub specs; unchanged
- `trellis/schemas/*` — **Task 13** handles schema harmonization

---

## Task 1: Trim `trellis/specs/core/trellis-core.md`

**File:** `trellis/specs/core/trellis-core.md`

**Goal:** Keep ledger-constitutional content. For substrate-generic content, replace with short cross-references to upstream homes.

- [ ] **Step 1: Read current state.** `wc -l` + read full file. List §N and §N.x headers.

- [ ] **Step 2: Apply the KEEP / DELETE / CROSS-REF table.**

| § | Action |
|---|---|
| Abstract | KEEP — rewrite to describe a cryptographic append-only ledger, removing any workflow-orchestration framing |
| Status | KEEP |
| §1 Introduction | KEEP; delete paragraphs that duplicate workflow-substrate framing (the hosting system owns those) |
| §2 Conformance Classes + Profiles | KEEP — ledger conformance roles |
| §3 Core-to-Implementation Contracts | TRIM — KEEP Canonical Append Contract, Derived Artifact Contract, Export Contract. Replace Workflow Contract, Authorization Contract, Trust Contract with one-line cross-references: "See [WOS Kernel §10 Named Extension Seams] for the workflow/authorization/custody contracts WOS defines." |
| §4 Terminology | KEEP ledger-specific terms (author-originated fact, canonical fact, canonical record, canonical append attestation, derived artifact, disclosure-or-export artifact, append-head reference). Remove terms that restate upstream definitions — replace Trust Profile, Disclosure Posture, Subject Continuity entries with one-line pointers to [WOS Assurance §2–§5] and [Formspec Respondent Ledger §6.6–§6.6A] |
| §5 Core Ontology | KEEP — ledger ontology contribution |
| §6 Canonical Truth | KEEP |
| §7 Invariants | TRIM — KEEP the six ledger invariants (append-only, canonical-fact-vs-record, derived-not-canonical, canonical-hash-construction, verification-independence, append idempotency). Keep Invariant 6 as a *ledger-operational* invariant, rewritten to: "Invariant 6 — Disclosure Posture Is Not Assurance Level. The normative statement is at [WOS Assurance §4]. This ledger's canonical append, export, and disclosure machinery MUST preserve the independence of disclosure posture and assurance level across all canonical records and exports." (This is a ~3-line anchor, not a restatement of the upstream MUST.) |
| §8 Fact Admission & Canonicalization | KEEP |
| §9 Canonical Order & Attestation | KEEP |
| §10 Trust Profile Semantics | DELETE entire section. Replace with a single paragraph: "Trust Profile object semantics for distributed-custody deployments are defined in [`trellis/specs/trust/trust-profiles.md`]. For substrate-generic trust concepts (provider-readable vs. reader-held vs. delegated-compute taxonomy, custody postures, honesty obligations), see [WOS Assurance §5] and [WOS Kernel §10.5 custodyHook seam]." |
| §11 Trust Honesty & Transitions | DELETE. Replace with: "See [WOS Assurance §5] for provider-neutral attestation and [WOS Assurance §6] for disclosure obligations." |
| §12 Export & Verification Guarantees | KEEP |
| §13 Profile Discipline | TRIM — keep the ledger-level profile subordination rule; remove Trust Profile inheritance detail, which is WOS-level |
| §14 Standard Profiles | DELETE entire section. None of those six profiles are ledger-specific. Replace with a one-paragraph cross-reference pointing to [WOS Assurance §5] and noting that Trellis-specific deployment profiles (transparency-log vs. permissioned-append-service) may be defined in a future companion |
| §15 Domain Bindings and Sidecars | KEEP the ledger binding discipline; delete generic taxonomy |
| §16 Supplementary Requirements | TRIM — KEEP §16.1 (derived artifact requirements for ledger projections), §16.3 (canonical-append idempotency), §16.4 (storage/snapshot discipline as applied to canonical records), §16.5 (cryptographic erasure), §16.6 (cryptographic algorithm agility). Delete §16.2 metadata minimization or reformulate narrowly as "ledger metadata visible at append time" |
| §17 Security & Privacy | TRIM — KEEP threats relevant to a cryptographic ledger. For §17.3 Trust & Privacy Disclosure Obligations, replace with a cross-reference: "See [WOS Assurance §6 Legal-Sufficiency Disclosure Obligations] for normative obligations that apply to this implementation." |
| §18 Non-Normative Guidance | KEEP the reduction rule and ledger-specific practical guidance |

- [ ] **Step 3: Apply the edits.** Preserve section numbering continuity; if deleting §N leaves a gap, renumber subsequent sections and update inbound references in sibling specs (Task 12 will verify).

- [ ] **Step 4: Verify cross-references resolve.**

```bash
grep -nE "\[WOS " /Users/mikewolfd/Work/formspec/trellis/specs/core/trellis-core.md
grep -nE "\[Formspec " /Users/mikewolfd/Work/formspec/trellis/specs/core/trellis-core.md
```

Each `[WOS §X]` or `[Formspec §Y]` cross-reference must resolve to an actual section in the corresponding spec. Spot-check at least 3 by reading the target.

- [ ] **Step 5: Commit.**

```bash
cd /Users/mikewolfd/Work/formspec/trellis
git add specs/core/trellis-core.md
git commit -m "refactor(trellis-core): trim to ledger-constitutional content, cross-reference upstream

Replace substrate-generic sections with cross-references to WOS Assurance
and WOS Kernel seams. Keep canonical append, hash construction, ledger
ontology, export verification, and cryptographic invariants. Invariant 6
remains as a ledger-operational anchor citing WOS Assurance §4 as
normative source."
```

---

## Task 2: Trim `trellis/specs/core/shared-ledger-binding.md`

**File:** `trellis/specs/core/shared-ledger-binding.md`

**Goal:** Keep the ledger wire-format binding. Replace implicit "delegate to processor" stubs with explicit cross-references to the delegated spec.

- [ ] **Step 1: Read current state.**

- [ ] **Step 2: Apply KEEP / CROSS-REF table.**

| § | Action |
|---|---|
| S1 Introduction | KEEP |
| S2 Conformance | KEEP |
| S3 Terminology | KEEP |
| S4 Substrate Binding and Delegation | TRIM — KEEP the substrate-boundary concept. Replace any prose about "the processor" with an explicit cross-reference when WOS or Formspec is the delegated party: "Workflow-fact validation is delegated to a WOS-conformant processor per [WOS Kernel §2 Conformance Classes]. Response-fact validation is delegated to a Formspec-conformant processor per [Formspec Core §6 Version Pinning VP-01, VP-02]." |
| S5 Family Binding Matrix | KEEP. The `wos.governance` and `formspec.authored` rows stay as-is and cross-reference correctly |
| S6 Canonical Record Envelope and Serialization | KEEP |
| S7 Append-Attestation Proof Model | KEEP |
| S8 Idempotency Identity | KEEP |
| S9 Protected Payload and Access Material | KEEP the ledger wire shape; replace any local custody-mode enumeration with a cross-reference: "Custody mode semantics are defined in [WOS Assurance §5.1] and operationalized for distributed deployments in [`trellis/specs/trust/trust-profiles.md` §2 Object Shape]." |
| S10 Canonization Rules and Rejection Codes | KEEP |
| S11 Schema and Version Compatibility | KEEP; cite [Formspec Changelog §4 Impact Classification] explicitly as the source for breaking-vs-additive classification applied to `schema_ref` |
| S12 Cross-Family Reference Rules | KEEP |
| S13 Family Admission Paths | KEEP; ensure S13.1 Formspec-Authored Fact Admission cites [Formspec Core §6 VP-01] for version-pinned delegation. No neutralization needed — standard cross-reference |
| S14 Canonical Receipt Immutability | KEEP |
| S15 Versioning and Algorithm Agility | KEEP — ledger-specific |
| S16 Registries | KEEP |
| S17 Security and Privacy | TRIM — KEEP ledger-specific threats. Replace any restated WOS-Assurance-level disclosure requirement with a cross-reference to [WOS Assurance §6] |
| S18 Cross-References | KEEP; add missing upstream references (WOS Kernel, WOS Assurance, Formspec Core, Formspec Respondent Ledger) |
| Annex A Non-normative guidance | KEEP |

- [ ] **Step 3: Apply edits.**

- [ ] **Step 4: Verify all new cross-references resolve** (read the target sections to confirm they say what the citing text claims).

- [ ] **Step 5: Commit.**

```bash
cd /Users/mikewolfd/Work/formspec/trellis
git add specs/core/shared-ledger-binding.md
git commit -m "refactor(trellis-binding): explicit cross-references to WOS and Formspec for delegated content"
```

---

## Task 3: Surgical trim of `trellis/specs/trust/trust-profiles.md`

**File:** `trellis/specs/trust/trust-profiles.md`

**Goal:** ~35% trim. The Trust Profile *object* is ledger-delegated by WOS Kernel S10.5 — Trellis owns its full definition. Delete only the substrate-generic material that restates WOS Assurance §5 or duplicates Invariant 6.

*(Revised from original 75% replacement after expert review flagged over-trim.)*

- [ ] **Step 1: Read current state.** Inventory each section.

- [ ] **Step 2: Apply KEEP / DELETE / CROSS-REF table.**

| § (approximate) | Action |
|---|---|
| Abstract, Status, §1 Introduction | KEEP; add a sentence stating WOS Kernel S10.5 delegates Trust Profile object definition to this spec |
| §2 Conformance | KEEP |
| §3 Trust Profile Object Semantics — §3.1 eleven-field minimum object | KEEP — this IS the delegated content |
| §3.2 Disclosure Posture and Assurance | DELETE. Replace with: "Disclosure posture and assurance level semantics are defined in [WOS Assurance §2] (assurance) and [WOS Assurance §4] (independence invariant). This spec does not restate them; the Trust Profile object carries postures as declared values without reinterpretation." |
| §4 Trust Honesty and Transitions | KEEP §4.1 honesty obligations specifically for multi-party custody; for §4.2 transition recording and §4.3 append-attributability, cross-reference [WOS Governance §2.9 Schema Upgrade] for the generic named-lifecycle-operation pattern while keeping the ledger-specific declaration |
| §5 Baseline Posture | KEEP — ledger-level postures are Trellis's contribution |
| §6 Metadata Budget | KEEP — ledger-custody-specific |
| §7 Verification Posture Classes | KEEP — ledger-specific |
| §8 Profile Declaration Schema | KEEP |
| §9 Access Semantics | TRIM — KEEP ledger-specific application. Delete re-declared access taxonomy (provider-readable/reader-held/delegated-compute); replace with cross-reference to [WOS Assurance §5.1] |
| §10 Standard Profiles (6 profiles) | TRIM — KEEP the four profiles whose binding is genuinely custody-specific (Offline Authoring binding, Reader-Held Decryption binding, Delegated Compute binding, Disclosure/Export binding). DELETE User-Held Record Reuse Profile and Respondent History Profile — these are data-contract concerns; cross-reference [Formspec Respondent Ledger §6.6A, §6.7] for respondent-history semantics |
| §11 Relationship to Export Claim Classes | KEEP |
| §12 Audit and Conformance Hooks | KEEP |
| §13 Example Profiles A–E (non-normative) | KEEP — illustrative for ledger deployments |
| §14 Security and Privacy | KEEP |
| §15 Normative References | KEEP; add upstream refs (WOS Kernel, WOS Assurance, Formspec Respondent Ledger) |

- [ ] **Step 3: Apply edits.**

- [ ] **Step 4: Verify cross-references resolve.**

- [ ] **Step 5: Commit.**

```bash
cd /Users/mikewolfd/Work/formspec/trellis
git add specs/trust/trust-profiles.md
git commit -m "refactor(trellis-trust): surgical trim, preserve WOS-delegated object definition

Keep Trust Profile object semantics (WOS Kernel S10.5 delegates this to
the distributed-trust binding), metadata budget, verification posture
classes, declaration schema, four custody-mode Standard Profiles.
Cross-reference WOS Assurance and Formspec Respondent Ledger for
substrate-generic concepts (posture taxonomy, assurance level,
respondent-history profiles)."
```

---

## Task 4: Trim `trellis/specs/trust/key-lifecycle-operating-model.md`

**File:** `trellis/specs/trust/key-lifecycle-operating-model.md`

**Goal:** ~30% trim. Keep cryptographic lifecycle. Cross-reference generic lifecycle-fact taxonomy and legal-sufficiency disclaimer.

- [ ] **Step 1: Read current state.**

- [ ] **Step 2: Apply KEEP / DELETE / CROSS-REF table.**

| § | Action |
|---|---|
| Abstract, Status, §1 Conformance Roles | KEEP |
| §2 Key Classes | KEEP |
| §3 Lifecycle States and Transitions | KEEP — crypto key state machine |
| §4 Rotation, Versioning, Grace | KEEP |
| §5 Lifecycle Operations (7-op enumeration) | TRIM — KEEP §5.4 Key Destruction and §5.6 Export Issuance (ledger-specific). For §5.1 Retention, §5.2 Legal Hold, §5.3 Archival, §5.5 Sealing, §5.7 Schema Upgrade: replace each with a one-line cross-reference to [WOS Governance §7.15 Legal Hold], [WOS Governance §2.9 Schema Upgrade], etc. |
| §6 Erasure and Key Destruction Disclosure | KEEP |
| §7 Sealing and Later Lifecycle Facts | DELETE — cross-reference [WOS Governance §12 Typed Hold Policies] |
| §8 Legal Sufficiency Statement | DELETE — cross-reference [WOS Assurance §6 Legal-Sufficiency Disclosure Obligations] |
| §9 Threshold and Quorum Custody | KEEP — cross-reference [WOS Governance §4.9 Quorum-Based Delegation] for the generic N-of-M authorization pattern while keeping the ledger-specific cryptographic evidence format (quorum proofs, per-custodian participation records) |
| §10 Recovery Authorities | TRIM — KEEP cryptographic recovery evidence format; cross-reference the generic recovery-authority declaration pattern to Trust Profiles §3 |
| §11 Algorithm Agility | KEEP — tied to canonical hash construction (ledger-specific) |
| §12 Required Completeness (purge-cascade) | KEEP |
| §13 Security and Privacy | TRIM — cross-reference [WOS Assurance §6] for generic privacy-disclosure requirements |

- [ ] **Step 3: Apply edits.**

- [ ] **Step 4: Verify cross-references resolve.**

- [ ] **Step 5: Commit.**

```bash
cd /Users/mikewolfd/Work/formspec/trellis
git add specs/trust/key-lifecycle-operating-model.md
git commit -m "refactor(trellis-key-lifecycle): keep crypto-specific lifecycle, cross-reference generic ops

Delete generic lifecycle fact taxonomy (retention/hold/archival/sealing/
schema-upgrade) with cross-references to WOS Governance. Delete
legal-sufficiency disclaimer with cross-reference to WOS Assurance §6.
Keep cryptographic key destruction, erasure evidence, threshold
cryptographic mechanics, and Merkle algorithm agility."
```

---

## Task 5: Trim `trellis/specs/export/export-verification-package.md`

**File:** `trellis/specs/export/export-verification-package.md`

**Goal:** ~25% trim. Keep the ledger export package. Cross-reference generic claim-class taxonomy and posture requirements.

- [ ] **Step 1: Read current state.**

- [ ] **Step 2: Apply KEEP / CROSS-REF table.**

| § | Action |
|---|---|
| §1 Introduction | KEEP |
| §2 Conformance | KEEP |
| §3 Export Requirement | KEEP |
| §4 Export Package Contents (7-item list) | KEEP — ledger-specific |
| §5 Verifier Obligations (5-step verification) | KEEP steps 1–3 (authored signature, canonical inclusion, append-head consistency). For step 4 (schema digest verification), cross-reference [Formspec Changelog §4] and [Formspec Core §6 VP-01]. For step 5 (disclosure artifact verification), cross-reference the Disclosure Manifest spec |
| §6 Export Verification Independence | KEEP — ledger verification independence |
| §7 Provenance Distinction Requirement | KEEP — ledger object-class distinctions |
| §8 Claim Classes | TRIM — KEEP authorship, append/inclusion, payload-integrity claims (ledger-verifiable). For authorization-history, disclosure, lifecycle/compliance claim classes, cross-reference [WOS Governance §provenanceLayer seam] and [Formspec Respondent Ledger §6.6.1 assuranceLevel] as appropriate |
| §9 Selective Disclosure Discipline | KEEP |
| §10 Algorithm Agility | KEEP |
| §11 Profile-Scoped Export Honesty | TRIM — cross-reference [WOS Assurance §6] for the generic no-overclaim discipline |
| §12 Cross-Implementation Verification | KEEP |
| §13 Relationship to Disclosure Manifest | KEEP |
| §14 Security and Privacy | TRIM — cross-reference [WOS Assurance §6] for generic privacy-disclosure |
| §15 Cross-References | KEEP; add upstream refs |

- [ ] **Step 3: Apply edits.**

- [ ] **Step 4: Verify cross-references resolve.**

- [ ] **Step 5: Commit.**

```bash
cd /Users/mikewolfd/Work/formspec/trellis
git add specs/export/export-verification-package.md
git commit -m "refactor(trellis-export): keep ledger package structure, cross-reference generic claims"
```

---

## Task 6: Trim `trellis/specs/export/disclosure-manifest.md`

**File:** `trellis/specs/export/disclosure-manifest.md`

**Goal:** ~30% trim. Keep the wire structure. Cross-reference disclosure posture enum, subject continuity, and Invariant 6 to their upstream homes.

- [ ] **Step 1: Read current state.**

- [ ] **Step 2: Apply KEEP / CROSS-REF table.**

| § | Action |
|---|---|
| §1 Introduction | KEEP |
| §2 Terminology | KEEP ledger-specific terms. Replace Disclosure Posture, Subject Continuity, Coverage Honesty definitions with one-line cross-references to [Formspec Respondent Ledger §6.6 privacyTier] and [Formspec Respondent Ledger §6.6A Subject Continuity] |
| §3 Conformance | KEEP |
| §4.1 Disclosure/Export Artifact definition | KEEP |
| §4.2 Disclosure Manifest definition | KEEP |
| §4.3 Disclosure Posture enumeration | DELETE the locally-declared enum. Replace with: "The `disclosurePosture` field carries one of the values enumerated in [Formspec Respondent Ledger §6.6 privacyTier]. This spec does not redeclare the enumeration." |
| §4.4 Subject Continuity | DELETE the local definition. Replace with: "Subject continuity semantics are defined in [Formspec Respondent Ledger §6.6A]. This manifest carries a continuity reference as an opaque string per that definition." |
| §4.5 Coverage Honesty | KEEP the ledger-specific MUST NOT (manifest MUST NOT claim coverage beyond included canonical records) |
| §4.6 Selective Disclosure | KEEP |
| §4.7 Posture-Assurance Non-Conflation | REPLACE with a cross-reference to [WOS Assurance §4 Invariant 6]. Keep the ledger-level consequence: "This manifest's fields for disclosurePosture and assuranceLevel are independently declared and MUST NOT be coupled." |
| §4.8 Controlled Vocabulary | TRIM — remove local restatements |
| §5 Manifest Structure (12-field minimum) | KEEP — the wire shape is the core contribution |
| §6 Audience Scope | KEEP |
| §7 Disclosure Posture Normative Obligations | TRIM — keep ledger-manifest obligations; for the underlying independence obligation, cross-reference [WOS Assurance §4] and [Formspec Respondent Ledger §6.7] |
| §8 Claim Class Declaration | TRIM — same as Task 5 §8 |
| §9 Selective Disclosure Discipline | KEEP |
| §10 Coverage Honesty Normative | KEEP |
| §11 Posture-Assurance Non-Conflation Normative | REPLACE the local MUST NOT with: "This manifest MUST preserve the independence declared in [WOS Assurance §4 Invariant 6]. Implementations producing this manifest MUST NOT encode disclosurePosture and assuranceLevel as a joint value." |
| §12 Relationship to Export Verification Package | KEEP |
| §13 Security & Privacy | TRIM |
| §14 Interoperability | KEEP |
| §15 Cross-References | KEEP; add upstream refs |

- [ ] **Step 3: Apply edits.**

- [ ] **Step 4: Verify cross-references resolve** (especially the new Invariant 6 cross-reference at §4.7 and §11).

- [ ] **Step 5: Commit.**

```bash
cd /Users/mikewolfd/Work/formspec/trellis
git add specs/export/disclosure-manifest.md
git commit -m "refactor(trellis-manifest): keep wire structure, cross-reference posture/continuity/Invariant 6"
```

---

## Task 7: Trim `trellis/specs/projection/projection-runtime-discipline.md`

**File:** `trellis/specs/projection/projection-runtime-discipline.md`

**Goal:** ~40% trim. **KEEP PRD-05 through PRD-08 (authorization evaluator safety rules) in full** — these are ledger-specific because they exist due to canonical-record authority. Delete generic canonical-vs-derived discipline prose that duplicates WOS Kernel S12 Separation Principles.

*(Revised from original 70% replacement after expert review.)*

- [ ] **Step 1: Read current state.**

- [ ] **Step 2: Apply KEEP / CROSS-REF table.**

| § | Action |
|---|---|
| Abstract, Status, §1 Conformance | KEEP |
| §2 Terminology | KEEP ledger-specific (projection, watermark, purge-cascade). For generic canonical/derived distinction, cross-reference [WOS Kernel §12 Separation Principles] |
| §3–§4 Canonical Truth Boundary (PRD-01) + Enforcement | REPLACE with cross-reference to [WOS Kernel §12] for the separation principle. KEEP a ledger-operational paragraph stating that canonical records are the authoritative source in this implementation |
| §5 Derived Artifact Obligations (PRD-02) | KEEP |
| §6 Projection Categories | TRIM — keep ledger-relevant projection categories; delete generic staff/respondent/system taxonomy prose |
| §7 Watermark Contract (PRD-03) | KEEP — ledger-specific freshness metadata |
| §8 Rebuild Contract (PRD-04) | KEEP — deterministic rebuild tied to canonical append |
| §9 Projection Integrity Policy | KEEP |
| §10 Authorization Evaluator Behavior (PRD-05 through PRD-08) | **KEEP IN FULL** — these rules exist because canonical records are authoritative. No upstream defines them. Silent fail-open on stale evaluator state would be a rights-impacting security defect |
| §11 Workflow State and Canonical Fact Mapping (PRD-09) | TRIM — cross-reference [WOS Kernel §12.1 Lifecycle vs. Case State Separation] for generic framing; keep the ledger-specific canonical-admission rule |
| §12 Provenance Family Semantics (PRD-10) | KEEP |
| §13 Storage, Snapshots, Availability (PRD-11, PRD-12) | KEEP |
| §14 Purge-Cascade (PRD-13) | KEEP — ledger-specific |
| §15 Runtime Boundary (PRD-14) | KEEP |
| §16 Deferral to WOS | REPLACE current WOS-by-name references with explicit section citations: "[WOS Kernel §X]", "[WOS Governance §Y]" — standard cross-reference style |
| §17 Security and Privacy | TRIM |
| §18 Cross-References | KEEP; add upstream refs |

- [ ] **Step 3: Apply edits.**

- [ ] **Step 4: Verify cross-references resolve, especially to WOS Kernel §12.**

- [ ] **Step 5: Commit.**

```bash
cd /Users/mikewolfd/Work/formspec/trellis
git add specs/projection/projection-runtime-discipline.md
git commit -m "refactor(trellis-projection): preserve PRD-05..PRD-08, trim generic canonical/derived prose

Keep authorization evaluator safety rules (PRD-05 through PRD-08) in
full — they exist because canonical records are authoritative, a
contribution unique to this implementation. Cross-reference WOS Kernel
§12 Separation Principles for the generic canonical-vs-derived framing
while retaining ledger-specific rules."
```

---

## Task 8: Trim `trellis/specs/operations/monitoring-witnessing.md`

**File:** `trellis/specs/operations/monitoring-witnessing.md`

**Goal:** ~30% trim. Keep Merkle-specific witness protocol. Delete or cross-reference generic audit-layer principles.

- [ ] **Step 1: Read current state.**

- [ ] **Step 2: Apply KEEP / DELETE / CROSS-REF table.**

| § | Action |
|---|---|
| S1 Introduction | KEEP |
| S2 Terminology | KEEP ledger-specific terms (equivocation, append-head, consistency proof). Trim generic witness/monitor definitions |
| S3 Witness Subordination | KEEP as a ledger-level statement (a witness to Trellis canonical append MUST NOT override canonical correctness) |
| S4 Monitor and Witness Sub-Roles | KEEP |
| S5 Checkpoint Publication Interface | KEEP |
| S6 Append-Head Consistency Checking Protocol | KEEP |
| S7 Witness Attestation Semantics | KEEP |
| S8 External Anchoring Semantics | KEEP |
| S9 Equivocation Definition and Evidence Format | KEEP — ledger-specific |
| S10 Detection vs Enforcement | KEEP as ledger-applied principle |
| S11 Testability Hooks | KEEP |
| S12 Conformance | KEEP |
| S13 Security Considerations | KEEP ledger-specific threats |
| S14 Privacy Considerations | TRIM |
| S15 Cross-References | KEEP; add upstream refs where relevant |

**Outcome:** This spec requires less trimming than originally thought — most of its content is genuinely ledger-specific. The trim is primarily to remove any remaining generic prose and add upstream cross-references where relevant (e.g., witness attestation assurance levels reference [WOS Assurance §2]).

- [ ] **Step 3: Apply edits.**

- [ ] **Step 4: Verify cross-references resolve.**

- [ ] **Step 5: Commit.**

```bash
cd /Users/mikewolfd/Work/formspec/trellis
git add specs/operations/monitoring-witnessing.md
git commit -m "refactor(trellis-monitoring): add upstream cross-references, minor trim"
```

---

## Task 9: Trim `trellis/specs/assurance/assurance-traceability.md`

**File:** `trellis/specs/assurance/assurance-traceability.md`

**Goal:** ~50% trim. Delete identity/attestation/continuity material (cross-reference WOS Assurance + Formspec Respondent Ledger). Populate the invariant traceability matrix with actual Trellis invariant IDs.

- [ ] **Step 1: Read current state.**

- [ ] **Step 2: Apply KEEP / DELETE / CROSS-REF table.**

| § | Action |
|---|---|
| Abstract, Status, §1 | KEEP — retain ledger-scoped framing |
| §2 Terminology | KEEP only ledger-specific terms. For assurance-level, disclosure-posture, subject-continuity, attestation definitions: replace with cross-references to [WOS Assurance §2, §3, §5] and [Formspec Respondent Ledger §6.6, §6.6A] |
| §3 Identity, Attestation, Assurance Methodology (§3.1–§3.6) | DELETE all content. Replace with a single cross-reference paragraph: "Identity, attestation, and assurance methodology are defined in [WOS Assurance §§2–6]. Formspec-Response-layer identity and authored signatures are defined in [Formspec Respondent Ledger §§6.6–6.8]. This spec does not restate those obligations; Trellis deployments MUST comply with them as applicable." |
| §4 Assurance-Upgrade Facts | DELETE — cross-reference [WOS Assurance §2.3] |
| §5 Invariant Scope | TRIM — §5.2 becomes a Trellis-invariants-only list (see Step 3 below) |
| §6 Minimum CI Expectations | KEEP |
| §7 Evidence Retention | KEEP |
| §8 Conformance Roles | TRIM — KEEP Assurance Producer, Assurance Auditor. Replace Identity-Fact Implementer, Invariant 6 Custodian, Assurance-Upgrade Recorder, Legal-Sufficiency Bounded Implementer with a cross-reference: "Role definitions are inherited from [WOS Assurance §8 Conformance Roles]." |
| §9 Security and Privacy | TRIM — cross-reference [WOS Assurance §6] for generic privacy-disclosure obligations |
| §10 Cross-References | KEEP; add upstream refs |
| Appendix A Operational Traceability Matrix | **POPULATE** with Trellis normative invariant IDs — see Step 3 |

- [ ] **Step 3: Populate the traceability matrix (Appendix A) with Trellis normative invariants.** At minimum, enumerate the following invariants from sibling Trellis specs (IDs shown; fixture IDs are implementation-declared):

| Invariant ID | Source § | Summary | Verification Method (implementation-declared) |
|---|---|---|---|
| `TRELLIS-INV-1` | trellis-core.md §7 | Append-only Canonical History | property test / model check |
| `TRELLIS-INV-2` | trellis-core.md §7 | No Second Canonical Truth | property test |
| `TRELLIS-INV-3` | trellis-core.md §7 | One Canonical Order per Governed Scope | property test |
| `TRELLIS-INV-4` | trellis-core.md §7 | One Canonical Event Hash Construction | fixture |
| `TRELLIS-INV-5` | trellis-core.md §7 | Verification Independence | fixture |
| `TRELLIS-INV-6` | trellis-core.md §7 | Append Idempotency | property test |
| `TRELLIS-PRD-01` | projection §5 | Derived Artifact Is Not Authoritative | property test |
| `TRELLIS-PRD-05` | projection §10 | Evaluator Inputs Traceable to Canonical Facts | fixture |
| `TRELLIS-PRD-06` | projection §10 | Evaluator Rebuild Behavior Defined | fixture |
| `TRELLIS-PRD-07` | projection §10 | Stale Evaluator State Fail-Closed | fixture |
| `TRELLIS-PRD-08` | projection §10 | Canonical Semantics Prevail Over Evaluator State | fixture |
| `TRELLIS-PRD-13` | projection §14 | Purge-Cascade Completeness | fixture |
| `TRELLIS-MONITOR-1` | monitoring §S3 | Witness Subordination to Canonical Correctness | fixture |
| `TRELLIS-MONITOR-2` | monitoring §S9 | Equivocation Evidence Format Validity | fixture |

(Implementations extend this matrix with deployment-specific invariants and populate fixture IDs.)

- [ ] **Step 4: Apply edits.**

- [ ] **Step 5: Verify cross-references resolve.**

- [ ] **Step 6: Commit.**

```bash
cd /Users/mikewolfd/Work/formspec/trellis
git add specs/assurance/assurance-traceability.md
git commit -m "refactor(trellis-assurance): cross-reference identity layer, populate invariant matrix

Delete identity/attestation/continuity prose with cross-references to
WOS Assurance and Formspec Respondent Ledger. Populate Appendix A
traceability matrix with 14 Trellis normative invariant IDs. Keep CI
expectations and evidence retention."
```

---

## Task 10: Rewrite `trellis/specs/core/unified-ledger-requirements-matrix.md`

**File:** `trellis/specs/core/unified-ledger-requirements-matrix.md`

**Goal:** Remove rows whose normative content moved upstream. Each removed row is recorded in the cross-reference map (Task 14) with its new upstream home.

- [ ] **Step 1: Read the matrix.** Inventory rows.

- [ ] **Step 2: For each ULCR row, classify.** Three outcomes:
  - **KEEP** — ledger-specific, stays in the matrix with full normative weight.
  - **REMOVE-WITH-POINTER** — substrate-generic, normative home is upstream; remove the row from the matrix but add an entry to the cross-reference map (Task 14) mapping `ULCR-XXX` → upstream section.
  - **RESCOPE** — row describes a concept that's partly ledger-specific and partly upstream; rewrite the row to reflect the ledger-specific portion only, add a cross-reference to upstream for the broader concept.

Tag each row using the sorting inventory from prior work. Rough guidance:
  - Rows about canonical append, Merkle proofs, hash construction, append-head references, canonical append attestations, inclusion/consistency proofs, purge-cascade, cryptographic erasure: KEEP
  - Rows about trust profile object semantics, custody postures: KEEP (WOS-delegated)
  - Rows about disclosure posture taxonomy, assurance level taxonomy, subject continuity primitive, Invariant 6, legal-sufficiency disclaimer, authored signatures: REMOVE-WITH-POINTER (upstream homes: WOS Assurance, Formspec Respondent Ledger)
  - Rows about projection discipline, authorization evaluator safety (PRD-05..PRD-08): KEEP (ledger-specific, defended in Task 7)
  - Rows about generic lifecycle operations (retention, hold, archival, sealing, schema-upgrade): REMOVE-WITH-POINTER (upstream: WOS Governance §2.9, §7.15)
  - Rows about the six generic Standard Profiles: REMOVE-WITH-POINTER for respondent-history / user-held-reuse; KEEP for the four custody-mode bindings

- [ ] **Step 3: Rewrite the matrix.** Remove REMOVE-WITH-POINTER rows. Keep KEEP rows unchanged. Rewrite RESCOPE rows.

- [ ] **Step 4: Update the matrix introduction paragraph** to note Plan 3 (dated 2026-04-15) refactored the matrix to reflect the three-spec dependency direction.

- [ ] **Step 5: Generate input for Task 14 cross-reference map** — record which ULCR IDs were removed and where they moved.

- [ ] **Step 6: Commit.**

```bash
cd /Users/mikewolfd/Work/formspec/trellis
git add specs/core/unified-ledger-requirements-matrix.md
git commit -m "docs(trellis-matrix): refactor after Plan 3 — remove upstream-owned rows"
```

---

## Task 11: Rewrite `trellis/specs/core/unified-ledger-companion-requirements-matrix.md`

**File:** `trellis/specs/core/unified-ledger-companion-requirements-matrix.md`

**Goal:** Same as Task 10 but for the companion matrix (223+ rows).

- [ ] **Step 1: Read the matrix.**

- [ ] **Step 2: Classify every ULCOMP-R row.** Use the same three-way classification as Task 10. Rough guidance for the high-volume categories:
  - Rows under ULCOMP-F-008 through ULCOMP-F-012 (Fact Admission, Order, Attestation, Serialization): mostly KEEP
  - Rows under ULCOMP-F-013 through ULCOMP-F-016 (Trust Profile Semantics, Honesty, Transitions): split — object semantics KEEP (delegated), taxonomies REMOVE-WITH-POINTER
  - Rows under ULCOMP-F-022 through ULCOMP-F-027 (Standard Profiles): mostly REMOVE-WITH-POINTER; the four custody-mode bindings KEEP
  - Rows under ULCOMP-F-029 (Derived Artifacts): RESCOPE — generic discipline REMOVE-WITH-POINTER, ledger-specific PRD-* KEEP
  - Rows under ULCOMP-F-033 (Lifecycle & Cryptographic Inaccessibility): crypto KEEP, generic lifecycle REMOVE-WITH-POINTER
  - Rows under ULCOMP-F-038 (Formspec / WOS Integration Boundaries): these already reference upstream cleanly — KEEP

- [ ] **Step 3: Rewrite the matrix.**

- [ ] **Step 4: Update the intro and count summary.**

- [ ] **Step 5: Generate input for Task 14 cross-reference map.**

- [ ] **Step 6: Commit.**

```bash
cd /Users/mikewolfd/Work/formspec/trellis
git add specs/core/unified-ledger-companion-requirements-matrix.md
git commit -m "docs(trellis-companion-matrix): refactor after Plan 3 — remove upstream-owned rows"
```

---

## Task 12: Verification sweeps

**File:** No single target; multi-file grep sweeps.

**Goal:** Confirm cross-references resolve, no dangling citations to deleted sections, no residual normative restatements of upstream content.

- [ ] **Step 1: Forward-reference sweep — every `[WOS §X]` and `[Formspec §Y]` resolves.**

```bash
cd /Users/mikewolfd/Work/formspec/trellis
grep -rnoE "\[WOS [^\]]+\]|\[Formspec [^\]]+\]" specs/ | sort -u > /tmp/trellis-cross-refs.txt
```

For each unique cross-reference, manually verify the target exists. Read the target section and confirm it says what the citing Trellis text claims.

- [ ] **Step 2: Inbound-reference sweep — no dangling citations to deleted Trellis sections.**

```bash
cd /Users/mikewolfd/Work/formspec/trellis
grep -rnE "trellis-core\.md §|trust-profiles\.md §|projection-runtime-discipline\.md §|disclosure-manifest\.md §|export-verification-package\.md §|assurance-traceability\.md §|key-lifecycle-operating-model\.md §|monitoring-witnessing\.md §|shared-ledger-binding\.md §" specs/
```

For each inbound citation within Trellis, verify the cited § still exists after Task 1–9 edits. Fix any dangling.

Particularly check:
- `disclosure-manifest.md §11` citing Invariant 6 (should now cite [WOS Assurance §4])
- `projection-runtime-discipline.md §10` PRD citations (should all remain intra-file or cross-reference WOS Kernel §12)
- Any cross-references to `trellis-core.md §10`, `§11`, `§14` (deleted in Task 1 — should now point to the appropriate cross-reference paragraph)

- [ ] **Step 3: Normative-restatement sweep — no verbatim upstream MUSTs in Trellis.**

```bash
cd /Users/mikewolfd/Work/formspec/trellis
grep -rnE "MUST NOT conflate|cryptographic controls alone|MUST NOT imply.*legal admissibility|disclosure posture.*assurance level are independent" specs/
```

Each hit should be inside a short ledger-operational anchor that cross-references upstream — not a verbatim restatement of the upstream MUST. Investigate each.

- [ ] **Step 4: Response definition-version pinning check.**

```bash
grep -rnE "definition[_ ]version|definitionUrl|VP-01" specs/
```

Verify that `shared-ledger-binding.md S13.1` still addresses version-pinned validation delegation to Formspec (cross-reference to Formspec Core VP-01 should be present and correct).

- [ ] **Step 5: Commit any fixes found.**

```bash
cd /Users/mikewolfd/Work/formspec/trellis
git add -A
git commit -m "refactor(trellis): fix cross-references and dangling citations after Plan 3 trim"
```

If no fixes needed, don't create an empty commit — just report "no residual issues".

---

## Task 13: Schema harmonization pass

**File:** `trellis/schemas/*` (any schemas present)

**Goal:** Update schemas to match trimmed spec prose. Schemas whose enums / object shapes were removed from prose need to either (a) reference upstream enums via `examples` (Draft 2020-12 style), or (b) be removed entirely if the field itself was deleted.

- [ ] **Step 1: Inventory current schemas.**

```bash
cd /Users/mikewolfd/Work/formspec/trellis
find schemas/ -name "*.json" | sort
```

For each schema, identify fields/enums that correspond to prose removed in Tasks 1–9.

- [ ] **Step 2: Common targets (apply if present):**

- **Disclosure posture enum** — if any Trellis schema has an enum `["anonymous", "pseudonymous", "identified", "public"]` for `disclosurePosture`, replace with:

```json
"disclosurePosture": {
  "type": "string",
  "description": "Values enumerated in Formspec Respondent Ledger §6.6 privacyTier. Implementations extend per Formspec rules.",
  "examples": ["anonymous", "pseudonymous", "identified", "public"]
}
```

- **Assurance level enum** — same pattern, referencing [WOS Assurance §2] and/or [Formspec Respondent Ledger §6.6.1]:

```json
"assuranceLevel": {
  "type": "string",
  "description": "Ordered assurance level per WOS Assurance §2 and Formspec Respondent Ledger §6.6.1.",
  "examples": ["L1", "L2", "L3", "L4"]
}
```

- **Trust Profile object shape** — keep the full shape (Trellis-owned). No changes needed unless a schema restates WOS Assurance fields explicitly.

- **Lifecycle fact type enums** — if a schema has enums like `["retention", "hold", "archival", "sealing", "key-destruction", "schema-upgrade"]`, trim to the ledger-specific subset (key-destruction, export-issuance); add a note that generic types are defined in [WOS Governance §2.9, §7.15].

- [ ] **Step 3: Apply schema edits.**

- [ ] **Step 4: Validate all schemas parse.**

```bash
cd /Users/mikewolfd/Work/formspec/trellis
for f in $(find schemas/ -name "*.json"); do
  python3 -c "import json; json.load(open('$f'))" && echo "OK: $f" || echo "FAIL: $f"
done
```

- [ ] **Step 5: Commit.**

```bash
cd /Users/mikewolfd/Work/formspec/trellis
git add schemas/
git commit -m "refactor(trellis-schemas): align with trimmed spec prose

Convert locally-enumerated disclosure posture and assurance level values
to examples-with-description cross-referencing upstream specs. Trim
lifecycle fact type enums to ledger-specific subset. Keep Trust Profile
object shape intact (WOS-delegated content)."
```

---

## Task 14: Create `trellis/specs/cross-reference-map.md`

**File:** `trellis/specs/cross-reference-map.md` (NEW)

**Goal:** Single document mapping each ULCR/ULCOMP-R ID removed in Tasks 10–11 to its upstream home. Serves as the human-readable historical record.

- [ ] **Step 1: Gather inputs.** From Tasks 10 and 11, collect the list of REMOVE-WITH-POINTER rows and their upstream homes.

- [ ] **Step 2: Author the cross-reference map.**

```markdown
# Trellis Cross-Reference Map

**Status:** Living document. Updated when Trellis specs adopt or release content to/from sibling specs.

## Purpose

This map records the upstream home for every concept removed from Trellis specs when the three-spec dependency direction (Formspec ← WOS ← Trellis) was formalized. It is an implementation aid, not normative content.

## Removed ULCR rows (from `unified-ledger-requirements-matrix.md`)

| ULCR ID | Concept | New home |
|---|---|---|
| *(populated from Task 10 output)* | | |

## Removed ULCOMP-R rows (from `unified-ledger-companion-requirements-matrix.md`)

| ULCOMP-R ID | Concept | New home |
|---|---|---|
| *(populated from Task 11 output)* | | |

## Concept-to-home map (summary)

| Concept | Upstream home |
|---|---|
| L1–L4 assurance-level taxonomy | [WOS Assurance §2] and [Formspec Respondent Ledger §6.6.1] |
| Subject continuity primitive | [WOS Assurance §3] and [Formspec Respondent Ledger §6.6A] |
| Invariant 6 (Disclosure Posture ≠ Assurance Level) | [WOS Assurance §4] |
| Provider-neutral attestation | [WOS Assurance §5] |
| Legal-sufficiency disclaimer | [WOS Assurance §6] and [Formspec Respondent Ledger §2.4] |
| Authored signature semantics | [Formspec Respondent Ledger §6.8] |
| Disclosure posture enumeration (anonymous/pseudonymous/identified/public) | [Formspec Respondent Ledger §6.6 `privacyTier`] |
| Trust Profile seam | [WOS Kernel §10.5 `custodyHook`] — delegates object definition to [`trellis/specs/trust/trust-profiles.md`] |
| Generic lifecycle ops (retention, hold, archival, sealing, schema-upgrade) | [WOS Governance §2.9, §7.15] |
| Schema upgrade as lifecycle operation | [WOS Governance §2.9] |
| Legal hold as distinct hold type | [WOS Governance §7.15] |
| Quorum-based delegation (N-of-M authorization) | [WOS Governance §4.9] |
| Respondent history profile | [Formspec Respondent Ledger §6.6A, §6.7] |
| Version-pinned Response validation | [Formspec Core §6 VP-01, VP-02] |

## Using this map

When implementing against Trellis specs, encounters with concepts in the Concept-to-home table indicate the normative source. Trellis spec prose includes the explicit cross-reference; this map is the alphabetical index.
```

- [ ] **Step 3: Populate the ULCR and ULCOMP-R tables from Task 10 and Task 11 outputs.**

- [ ] **Step 4: Commit.**

```bash
cd /Users/mikewolfd/Work/formspec/trellis
git add specs/cross-reference-map.md
git commit -m "docs(trellis): add cross-reference map for concepts owned upstream

Historical record of ULCR and ULCOMP-R rows removed in Plan 3, with
their upstream homes. Serves as an alphabetical concept-to-home index."
```

---

## Self-Review

**1. Spec coverage:**
- ✅ Task 1 trellis-core.md trim
- ✅ Task 2 shared-ledger-binding.md trim
- ✅ Task 3 trust-profiles.md surgical trim (preserves WOS-delegated object)
- ✅ Task 4 key-lifecycle-operating-model.md trim
- ✅ Task 5 export-verification-package.md trim
- ✅ Task 6 disclosure-manifest.md trim with cross-references
- ✅ Task 7 projection-runtime-discipline.md trim (PRD-05..PRD-08 preserved)
- ✅ Task 8 monitoring-witnessing.md minor trim
- ✅ Task 9 assurance-traceability.md trim with populated invariant matrix
- ✅ Task 10 ULCR matrix refactor
- ✅ Task 11 ULCOMP-R matrix refactor
- ✅ Task 12 verification sweeps (forward-ref + inbound-ref + normative-restatement + VP-01 pinning)
- ✅ Task 13 schema harmonization
- ✅ Task 14 cross-reference map

**2. Placeholder scan:** The ULCR/ULCOMP-R tables in Task 14 are populated from Task 10/11 outputs, not placeholders. The invariant traceability matrix in Task 9 has concrete invariant IDs with "implementation-declared" fixture columns (legitimate — fixtures are per-implementation). No TBD strings.

**3. Type consistency:** Invariant IDs use `TRELLIS-INV-N`, `TRELLIS-PRD-NN`, `TRELLIS-MONITOR-N` consistently. Cross-reference syntax `[WOS §X]` / `[Formspec §Y]` / `[WOS Assurance §X]` / `[Formspec Respondent Ledger §Y]` used consistently. No inconsistencies.

**4. Resolved from expert review:**
- ✅ Task 3 scope reduced from 75% to ~35%
- ✅ Task 7 PRD-05..PRD-08 preserved in full
- ✅ Task 1 Invariant 6 retained as ledger-operational anchor citing WOS Assurance §4
- ✅ Task 6 disclosure posture enum replaced with cross-reference (resolves verifier blind spot)
- ✅ Task 9 invariant matrix populated with actual Trellis invariant IDs
- ✅ Tasks 10–11 physically remove rows (not retag) with upstream pointer in Task 14 map
- ✅ Task 12 adds inbound-reference + VP-01 pinning checks
- ✅ Task 13 schema harmonization added as in-plan task

---

## Plan Complete

Plan saved to `thoughts/plans/2026-04-15-trellis-trim-and-dedup.md` (this doc; revised after expert review).

**Post-Plan-3 state:**
- Trellis specs ~25–35% smaller
- Substrate-neutral concepts cross-reference upstream specs cleanly
- Trust Profile object stays in Trellis (WOS Kernel S10.5 delegates it)
- PRD-05..PRD-08 stay in Trellis (ledger-specific safety invariants)
- Invariant 6 retained as ledger-operational anchor with upstream normative source
- Two requirements matrices carry only Trellis-owned rows; removed rows mapped in cross-reference-map.md
- Schemas aligned with trimmed prose
- Verification sweeps pass: cross-references resolve, no dangling citations, no residual normative restatements

**Follow-up work** (not part of Plan 3):
- Parent repo submodule pointer bumps for `wos-spec` and `trellis`
- Lint rule implementation for new WOS assurance-layer requirements (tracked in WOS-IMPLEMENTATION-STATUS.md)
