# WOS Custody Seam + Assurance Layer — Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Workflow Orchestration Standard (WOS) with a `custodyHook` seam, a new Assurance layer, and eight feature-level capabilities that emerged from a Trellis-vs-WOS sorting pass. This keeps WOS substrate-neutral (any conformant processor, from trust-the-host monolith to distributed ledger, can adopt it) while giving Trellis a clean upstream to reference.

**Architecture:** WOS Kernel §10 gains a sixth named extension seam (`custodyHook`). A new top-level layer `wos-spec/specs/assurance/` holds identity/attestation/continuity semantics, the named constitutional invariant "Disclosure Posture ≠ Assurance Level" (Invariant 6), and the legal-sufficiency disclaimer. WOS Governance gains three inline extensions: schema upgrade as a named lifecycle operation, quorum-based delegation, and legal hold as a distinct hold type. The `WOS-FEATURE-MATRIX.md` gains new rows reflecting the capability additions. No new WOS section §13 or §15 is introduced — the advisor review flagged those as overreach; a seam replaces §13 and `§15 Deployment Profiles` is dropped entirely.

**Tech Stack:** Markdown (WOS spec prose, BCP 14 normative keywords), JSON Schema (Draft 2020-12, WOS schema files), existing `wos-lint` and `wos-conformance` test harnesses.

---

## Relationship to Sibling Plans

This is **Plan 1 of 3**. Sequential dependency order:

1. **Plan 1 (this doc):** WOS additions — custodyHook seam, new assurance layer, governance extensions, feature matrix updates.
2. **Plan 2 (follows):** Extract user-originated signing into Formspec (moving from Trellis assurance-traceability into Formspec Response semantics).
3. **Plan 3 (follows):** Trellis spec trim + Invariant 6 deduplication — rewrite Trellis specs to reference WOS for substrate-neutral material, remove duplicated normative text.

Plans 2 and 3 can only be authored after Plan 1's upstream homes exist.

---

## File Structure

### Files to create

| Path | Responsibility |
|---|---|
| `wos-spec/specs/assurance/assurance.md` | New WOS layer spec. Defines assurance-level taxonomy, subject continuity, provider-neutral attestation, Invariant 6 as named constitutional invariant. |
| `wos-spec/schemas/assurance/wos-assurance.schema.json` | JSON Schema for assurance-level declarations and subject-continuity references. |

### Files to modify

| Path | Change |
|---|---|
| `wos-spec/specs/kernel/spec.md` | Add §10.6 `custodyHook` seam definition; add §7.3 Context Enrichment row for custody; renumber `extensions` seam to §10.7. |
| `wos-spec/schemas/kernel/wos-kernel.schema.json` | Add optional `custodyHook` property definition. |
| `wos-spec/specs/governance/workflow-governance.md` | Add §2.9 Schema Upgrade as Named Lifecycle Operation; §4.9 Quorum-Based Delegation; §7.15 Legal Hold (distinct from workflow hold); preamble legal-sufficiency MUST NOT disclaimer. |
| `wos-spec/schemas/governance/wos-workflow-governance.schema.json` | Add `schemaUpgrade`, `quorumCount` properties; extend `holdPolicies[].holdType` enum to include `legal-hold`. |
| `wos-spec/WOS-FEATURE-MATRIX.md` | Add capability rows: 2.9 Schema upgrade, 4.9 Quorum delegation, 7.15 Legal hold, 8.11 Custody seam, 8.12 Invariant 6, 14.1 Assurance-level taxonomy, 14.2 Subject continuity, 14.3 Provider-neutral attestation, 14.4 Legal-sufficiency disclaimer. |
| `wos-spec/WOS-IMPLEMENTATION-STATUS.md` | Update LINT-MATRIX row counts (projected +9 rules); add assurance crate to maturity matrix as 🟡 pending implementation. |

### Files NOT touched in this plan

- `wos-spec/specs/ai/*` — AI layer uses `actorExtension` + `contractHook`; no changes needed for custody.
- `wos-spec/specs/advanced/*` — advanced capabilities unchanged.
- `trellis/**/*` — Plan 3 handles Trellis rewrites after WOS lands.
- `packages/formspec-*` — Plan 2 handles Formspec extraction.

---

## Task 1: Add `custodyHook` seam to WOS Kernel §10

**Files:**
- Modify: `wos-spec/specs/kernel/spec.md` (§10 Named Extension Seams)
- Modify: `wos-spec/schemas/kernel/wos-kernel.schema.json`

- [ ] **Step 1: Read existing §10 seam pattern**

Open `wos-spec/specs/kernel/spec.md` and read §10.1 through §10.5. Confirm the pattern: each seam has `**Purpose:**` line + 3-6 lines of prose describing what higher layers attach.

- [ ] **Step 2: Insert §10.6 `custodyHook` before §10.5 `extensions`**

Update the §10 preamble count from "five extension seams" to "six extension seams". Renumber the current §10.5 `extensions` to §10.7 (leaving §10.6 as the new seam). Insert the following between §10.4 `lifecycleHook` and the (renumbered) `extensions` seam:

```markdown
### 10.6 `custodyHook`

**Purpose:** Custody posture declaration.

Every WOS deployment handles protected content under a declared custody posture. The kernel itself makes no assumption about custody — a trust-the-host monolith and a multi-party distributed binding both conform to the kernel unchanged. Higher layers and bindings attach custody semantics here.

Custody postures are declared, not inferred. Bindings that populate this seam MUST declare, at minimum: who may read content during ordinary operation, whether recovery can occur without the user, and whether delegated compute exposes content to ordinary service components. Custody transitions (changes to any of those answers) are recorded as canonical lifecycle facts (Governance S2.9).

The kernel does NOT define the concrete Trust Profile object. Trellis (the distributed-trust binding) defines that object and binds it to this seam. A monolithic binding may populate this seam with a single declared posture (e.g., "provider-readable, no recovery without user, no delegated compute") and satisfy conformance.
```

- [ ] **Step 3: Update §10 preamble sentence**

Find: `The kernel defines five extension seams.`
Replace with: `The kernel defines six extension seams.`

- [ ] **Step 4: Update §7.3 Context Enrichment table to add custody row**

In §7.3 Context Enrichment, append a row to the seam-to-variable table:

```markdown
| `custody` | Binding | `custodyHook` — current custody posture declaration, if any. |
```

- [ ] **Step 5: Add custodyHook schema property**

Edit `wos-spec/schemas/kernel/wos-kernel.schema.json`. In the top-level `properties` object (alongside existing `extensions`), add:

```json
"custodyHook": {
  "type": "object",
  "description": "Custody posture declaration seam (S10.6). Opaque to the kernel; bindings populate this with declared posture semantics. A monolithic binding may declare a single posture; a distributed binding may declare a full Trust Profile object.",
  "additionalProperties": true
}
```

- [ ] **Step 6: Validate schema parses**

Run: `python -c "import json; json.load(open('wos-spec/schemas/kernel/wos-kernel.schema.json'))"`
Expected: no output (JSON parses successfully).

- [ ] **Step 7: Commit**

```bash
git add wos-spec/specs/kernel/spec.md wos-spec/schemas/kernel/wos-kernel.schema.json
git commit -m "feat(wos-kernel): add custodyHook seam (S10.6)

Adds sixth named extension seam for custody posture declaration.
Kernel remains neutral; bindings populate the seam.

Refs: architectural review 2026-04-15"
```

---

## Task 2: Create new Assurance layer — directory + abstract

**Files:**
- Create: `wos-spec/specs/assurance/assurance.md`
- Create: `wos-spec/schemas/assurance/` (empty directory)

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p wos-spec/specs/assurance wos-spec/schemas/assurance
```

- [ ] **Step 2: Create `assurance.md` with header, abstract, and normative conventions**

Create the file with this skeleton (prose below is the normative opening; body sections follow in later tasks):

```markdown
# WOS Assurance Layer

## Abstract

The WOS Assurance Layer specifies identity and attestation semantics for workflows that handle rights-impacting, safety-impacting, or otherwise consequential decisions. It defines an assurance-level taxonomy independent of disclosure posture, a subject-continuity primitive for linking related activity across time without requiring full legal-identity disclosure, and normative rules for representing attestations provider-neutrally.

This layer attaches to the WOS Kernel via the `provenanceLayer` seam (S10.3) and the `custodyHook` seam (S10.6). It is opt-in: kernel-only deployments conform to WOS without implementing any assurance layer. Deployments that record identity facts, issue attestations, or make claims about the evidentiary weight of provenance MUST conform to this layer.

## Status of This Document

This document is a normative companion to the WOS Kernel. Statements using BCP 14 keywords are normative. All other statements are informative.

## 1. Introduction

### 1.1 Scope

Within scope: assurance-level taxonomy; subject continuity; provider-neutral attestation representation; disclosure posture independence from assurance level (Invariant 6); legal-sufficiency disclosure obligations; assurance-upgrade facts.

Out of scope: cryptographic signing algorithms; key lifecycle mechanics; custody posture declarations (see `custodyHook` seam, Kernel S10.6); concrete identity-provider bindings.

### 1.2 Notational Conventions

The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED, NOT RECOMMENDED, MAY, and OPTIONAL in this document are to be interpreted as described in BCP 14 [RFC2119] [RFC8174].
```

- [ ] **Step 3: Validate markdown parses**

Run: `node -e "require('fs').readFileSync('wos-spec/specs/assurance/assurance.md', 'utf8')"`
Expected: no output (file reads successfully).

- [ ] **Step 4: Commit**

```bash
git add wos-spec/specs/assurance/assurance.md
git commit -m "feat(wos-assurance): create assurance layer skeleton

New companion layer for identity/attestation/continuity semantics.
Attaches via provenanceLayer + custodyHook seams."
```

---

## Task 3: Assurance §2 — Assurance-Level Taxonomy

**Files:**
- Modify: `wos-spec/specs/assurance/assurance.md` (append §2)

- [ ] **Step 1: Append §2 Assurance Levels section**

```markdown
## 2. Assurance Levels

### 2.1 Taxonomy

An **assurance level** is an ordered declaration of the binding strength between a recorded fact and the subject or actor it identifies. Assurance levels are declared per fact; they are not properties of the subject or actor.

Implementations MUST support at minimum the following four-level taxonomy:

| Level | Label | Meaning |
|---|---|---|
| `L1` | Self-asserted | Subject or actor asserted the identity binding; no external corroboration. |
| `L2` | Corroborated | Binding corroborated by at least one external source (e.g., emailed magic link, phone verification). |
| `L3` | Verified | Binding verified against an authoritative source (e.g., government ID match, credential issuer). |
| `L4` | In-person or equivalent | Binding verified under conditions equivalent to in-person government-issued identity check. |

Implementations MAY define additional levels; additional levels MUST be declared against the base four.

### 2.2 Assurance Level Is Not Authorization

Assurance level describes how strongly a fact is bound to its subject or actor. It does NOT describe what that subject or actor is authorized to do. Authorization decisions MAY use assurance level as an input but MUST NOT collapse authorization into assurance.

### 2.3 Assurance-Upgrade Facts

A subject's assurance level MAY be upgraded (but not silently downgraded) by recording an assurance-upgrade fact. Assurance-upgrade facts:

- MUST reference the existing subject continuity reference (§3).
- MUST declare the prior assurance level and the new assurance level.
- MUST declare the basis for the upgrade (document inspection, biometric match, etc.).
- MUST be canonical facts admitted through the normal Kernel Facts tier.
- MUST NOT rewrite prior facts. Upgrades apply forward only.
- MUST preserve disclosure posture independently from assurance level (see §4).
```

- [ ] **Step 2: Commit**

```bash
git add wos-spec/specs/assurance/assurance.md
git commit -m "feat(wos-assurance): §2 assurance-level taxonomy + upgrade facts"
```

---

## Task 4: Assurance §3 — Subject Continuity

**Files:**
- Modify: `wos-spec/specs/assurance/assurance.md` (append §3)

- [ ] **Step 1: Append §3 Subject Continuity section**

```markdown
## 3. Subject Continuity

### 3.1 Definition

A **subject continuity reference** is a stable identifier linking related activity, records, or attestations across time without, by itself, requiring full legal-identity disclosure.

Subject continuity is a provenance primitive, not an identity claim. Two facts sharing a subject continuity reference assert that they concern the same subject; they do NOT assert what that subject's legal identity is.

### 3.2 Requirements

Implementations that record identity facts MUST:

- Support at least one subject continuity reference mechanism.
- Declare the scope within which a continuity reference is stable (instance, case, tenant, deployment).
- Preserve continuity references across workflow instance migration (Kernel S9.6).
- Allow distinct continuity references to be held by the same legal subject (pseudonymous separation).

Implementations MUST NOT:

- Assume that a continuity reference implies any particular assurance level.
- Assume that distinct continuity references imply distinct legal subjects.
- Merge continuity references implicitly. Explicit merge MUST be recorded as a canonical fact.
```

- [ ] **Step 2: Commit**

```bash
git add wos-spec/specs/assurance/assurance.md
git commit -m "feat(wos-assurance): §3 subject continuity primitive"
```

---

## Task 5: Assurance §4 — Invariant 6 (Disclosure Posture ≠ Assurance Level)

**Files:**
- Modify: `wos-spec/specs/assurance/assurance.md` (append §4)

- [ ] **Step 1: Append §4 Invariant 6 section (one authoritative home)**

```markdown
## 4. Invariant 6: Disclosure Posture Is Not Assurance Level

### 4.1 Statement

**Invariant 6 (normative, constitutional):** Disclosure posture and assurance level are independent properties of a fact. Implementations MUST NOT conflate them, MUST NOT derive one from the other, and MUST NOT couple their transitions.

### 4.2 Background

**Disclosure posture** declares how much of a subject's identity is revealed in a given context (anonymous, pseudonymous, identified, public). **Assurance level** declares how strongly a fact is bound to its subject (§2).

A fact MAY be highly assured and pseudonymously disclosed (a verified-L3 claim disclosed under a pseudonym). A fact MAY be weakly assured and fully identified (a self-asserted L1 claim tied to a legal name). All four combinations are valid. Implementations that force these to co-vary violate this invariant.

### 4.3 Behavioral Consequences

- Profiles MAY constrain disclosure posture or assurance level independently. A profile that constrains both MUST constrain them as independent predicates, not a joint predicate.
- Assurance-upgrade facts (§2.3) MUST NOT implicitly change disclosure posture.
- Disclosure re-scoping (e.g., a pseudonymous record being identified later) MUST NOT imply an assurance upgrade.
- Verifiers MUST be able to check assurance claims independently of disclosure claims.

### 4.4 Normative Home

This invariant is stated normatively here. Other specifications in the WOS family, and bindings such as Trellis, MUST reference this section rather than restating the invariant.
```

- [ ] **Step 2: Commit**

```bash
git add wos-spec/specs/assurance/assurance.md
git commit -m "feat(wos-assurance): §4 Invariant 6 (disclosure ≠ assurance) as normative home"
```

---

## Task 6: Assurance §5 — Provider-Neutral Attestation + §6 Legal-Sufficiency Disclaimer

**Files:**
- Modify: `wos-spec/specs/assurance/assurance.md` (append §5 and §6)

- [ ] **Step 1: Append §5 Provider-Neutral Attestation**

```markdown
## 5. Provider-Neutral Attestation

### 5.1 Requirement

An **attestation** is a fact asserting that some predicate about a subject is true under a declared assurance level. Attestations MUST be representable provider-neutrally — that is, without requiring a verifier to bind to a specific identity provider, issuer, or adapter in order to interpret the attestation's meaning.

Implementations MAY use provider-specific bindings for operational convenience (e.g., OIDC claims, SAML assertions, verifiable credentials). The semantic meaning of an attestation — subject, predicate, assurance level, validity scope — MUST be representable independently of any particular binding.

### 5.2 Attestation vs. Signing

User-originated signing (the act of a subject cryptographically binding themselves to a submitted fact) is **not** defined in this layer. Signing semantics belong in the Formspec Response specification, because they are a property of the submitted data contract, not of the workflow substrate.

An implementation MAY record that a fact was signed; the signing mechanism itself is defined by Formspec or by a distribution binding (Trellis).

## 6. Legal-Sufficiency Disclosure Obligations

### 6.1 Disclaimer Requirement

Implementations MUST NOT imply, either in user-facing surfaces or in specifications they publish, that cryptographic controls alone guarantee legal admissibility or evidentiary sufficiency in any particular jurisdiction.

Implementations MAY make stronger evidentiary claims only to the extent supported by declared process, signature semantics, canonical append attestations, records-management practice, and applicable law — and MUST disclose which of those conditions they rely on when making such claims.

### 6.2 Rationale

Cryptographic controls establish integrity and provenance. Legal admissibility additionally requires process, chain-of-custody, records-management, statutory authorization, and judicial acceptance. These are jurisdiction-specific and cannot be guaranteed by a specification. Implementations that elide this distinction mislead users and create liability for adopters.
```

- [ ] **Step 2: Commit**

```bash
git add wos-spec/specs/assurance/assurance.md
git commit -m "feat(wos-assurance): §5 provider-neutral attestation + §6 legal-sufficiency disclaimer"
```

---

## Task 7: Governance §2.9 — Schema Upgrade as Named Lifecycle Operation

**Files:**
- Modify: `wos-spec/specs/governance/workflow-governance.md` (add §2.9)
- Modify: `wos-spec/schemas/governance/wos-workflow-governance.schema.json` (add `schemaUpgrade`)

- [ ] **Step 1: Locate existing §2 Lifecycle structure in governance spec**

Open `wos-spec/specs/governance/workflow-governance.md` and find the section covering lifecycle/instance migration. Confirm where to insert §2.9.

- [ ] **Step 2: Insert §2.9 section**

```markdown
### 2.9 Schema Upgrade as Named Lifecycle Operation

A **schema upgrade** is an explicit migration of a workflow instance (or of referenced Formspec Definitions) to a newer definition version. Schema upgrades are named lifecycle operations distinct from ordinary instance migration.

A schema upgrade MUST:

- Be recorded as a canonical fact in the Facts tier.
- Declare the prior definition version and the new definition version.
- Declare the migration mechanism (Formspec Changelog reference, custom migration map, or declared equivalence).
- Preserve enough interpretation material to verify historical records under the definition version in effect when they were produced (cf. Kernel S9.6).
- NOT silently reinterpret historical records under newer rules.

Schema upgrades MAY apply to an individual instance, to all instances of a workflow, or to all instances within a tenant scope. The scope MUST be declared.
```

- [ ] **Step 3: Add `schemaUpgrade` to governance schema**

In `wos-spec/schemas/governance/wos-workflow-governance.schema.json`, add a top-level property:

```json
"schemaUpgrade": {
  "type": "object",
  "description": "Schema upgrade lifecycle operation (S2.9).",
  "properties": {
    "priorVersion": { "type": "string" },
    "newVersion": { "type": "string" },
    "migrationMechanism": { "type": "string", "enum": ["formspec-changelog", "custom-map", "declared-equivalence"] },
    "scope": { "type": "string", "enum": ["instance", "workflow", "tenant"] }
  },
  "required": ["priorVersion", "newVersion", "migrationMechanism", "scope"]
}
```

- [ ] **Step 4: Validate schema**

Run: `python -c "import json; json.load(open('wos-spec/schemas/governance/wos-workflow-governance.schema.json'))"`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add wos-spec/specs/governance/workflow-governance.md wos-spec/schemas/governance/wos-workflow-governance.schema.json
git commit -m "feat(wos-governance): §2.9 schema upgrade as named lifecycle operation"
```

---

## Task 8: Governance §4.9 — Quorum-Based Delegation

**Files:**
- Modify: `wos-spec/specs/governance/workflow-governance.md` (add §4.9)
- Modify: `wos-spec/schemas/governance/wos-workflow-governance.schema.json` (add `quorumCount` to delegation)

- [ ] **Step 1: Insert §4.9 after existing §4 delegation subsections**

```markdown
### 4.9 Quorum-Based Delegation

A delegation chain MAY require a quorum — that is, authorization by N of M distinct authorities — rather than a single delegated authority. Quorum-based delegation is a governance capability applicable to any high-stakes operation (adverse decision, irreversible lifecycle fact, exceptional access grant).

A quorum-based delegation MUST declare:

- `quorumCount`: the minimum number of distinct authorities required (N).
- `quorumPool`: the set of eligible authorities (M).
- The requirement that each counted authority be a distinct principal (not the same principal exercising multiple roles).

A quorum-based delegation MUST NOT:

- Count the same principal more than once toward quorum.
- Silently reduce the quorum count. Reductions MUST be recorded as explicit policy transitions.

The cryptographic mechanism for proving quorum participation (threshold signatures, multi-party computation, manual countersigning) is implementation-defined and binding-specific. A monolithic implementation MAY satisfy quorum purely through database-recorded approvals.
```

- [ ] **Step 2: Extend delegation schema with `quorumCount`**

In `wos-spec/schemas/governance/wos-workflow-governance.schema.json`, locate the `delegations[]` item schema and add:

```json
"quorumCount": {
  "type": "integer",
  "minimum": 2,
  "description": "Minimum distinct authorities required for delegation to take effect (S4.9). Omit for single-authority delegation."
},
"quorumPool": {
  "type": "array",
  "items": { "type": "string" },
  "description": "Eligible authority principal IDs (S4.9). Required when quorumCount is set."
}
```

Add a cross-property constraint at the delegation item level:

```json
"dependentRequired": {
  "quorumCount": ["quorumPool"]
}
```

- [ ] **Step 3: Validate schema**

Run: `python -c "import json; json.load(open('wos-spec/schemas/governance/wos-workflow-governance.schema.json'))"`

- [ ] **Step 4: Commit**

```bash
git add wos-spec/specs/governance/workflow-governance.md wos-spec/schemas/governance/wos-workflow-governance.schema.json
git commit -m "feat(wos-governance): §4.9 quorum-based delegation (N-of-M)"
```

---

## Task 9: Governance §7.15 — Legal Hold as Distinct Hold Type

**Files:**
- Modify: `wos-spec/specs/governance/workflow-governance.md` (add §7.15)
- Modify: `wos-spec/schemas/governance/wos-workflow-governance.schema.json` (extend `holdType` enum)

- [ ] **Step 1: Insert §7.15 after existing §7.14 EU AI Act row (or at end of §7)**

```markdown
### 7.15 Legal Hold (Distinct from Workflow Hold)

A **legal hold** is a distinct hold type with statutory-override semantics. Unlike workflow holds (S7.10), which suspend a workflow pending an event or condition and expect eventual resumption, a legal hold:

- Blocks data destruction, retention expiry, and scheduled lifecycle operations regardless of ordinary workflow state.
- Survives terminal workflow states. A case under legal hold MUST NOT be purged, archived, or cryptographically erased even if the workflow has otherwise concluded.
- Does NOT have an event-based resume trigger. Release requires an explicit legal-hold-release fact, typically tied to external legal authority.
- Takes precedence over retention policies when both apply.

Implementations MUST:

- Record legal-hold placement and release as canonical facts with the authority (court order, agency directive, statutory trigger) recorded in the fact.
- Propagate legal-hold state to derived artifacts (exports, projections) so that downstream systems honor the hold.
- Log any attempt to destroy, archive, or export data under legal hold as a rejected operation with the hold reference in the rejection provenance.

Legal hold is an ORTHOGONAL dimension to workflow lifecycle state. A case MAY simultaneously be in a terminal workflow state and under an active legal hold.
```

- [ ] **Step 2: Extend `holdType` enum in schema**

Find the `holdPolicies[].holdType` enum in `wos-spec/schemas/governance/wos-workflow-governance.schema.json` and add `"legal-hold"` to the enum. Example addition:

```json
"holdType": {
  "type": "string",
  "enum": [
    "pending-event",
    "pending-data",
    "pending-approval",
    "pending-legal-review",
    "legal-hold"
  ]
}
```

Update the `description` to note that `legal-hold` has distinct semantics per S7.15 (no resume trigger, survives terminal state).

- [ ] **Step 3: Validate schema**

Run: `python -c "import json; json.load(open('wos-spec/schemas/governance/wos-workflow-governance.schema.json'))"`

- [ ] **Step 4: Commit**

```bash
git add wos-spec/specs/governance/workflow-governance.md wos-spec/schemas/governance/wos-workflow-governance.schema.json
git commit -m "feat(wos-governance): §7.15 legal hold as distinct hold type"
```

---

## Task 10: Governance preamble — Legal-Sufficiency Disclaimer Cross-Reference

**Files:**
- Modify: `wos-spec/specs/governance/workflow-governance.md` (preamble or §1 Introduction)

- [ ] **Step 1: Insert cross-reference to Assurance §6**

Add a normative paragraph in the governance spec's introduction (or at the start of §7 Due Process):

```markdown
**Legal sufficiency.** Governance rules defined in this specification contribute to, but do not guarantee, legal admissibility. Implementations MUST comply with the legal-sufficiency disclosure obligations in the WOS Assurance Layer §6. In particular, implementations MUST NOT imply that structured governance alone guarantees evidentiary sufficiency in any particular jurisdiction.
```

- [ ] **Step 2: Commit**

```bash
git add wos-spec/specs/governance/workflow-governance.md
git commit -m "feat(wos-governance): cross-reference assurance §6 legal-sufficiency disclaimer"
```

---

## Task 11: Create `wos-assurance.schema.json`

**Files:**
- Create: `wos-spec/schemas/assurance/wos-assurance.schema.json`

- [ ] **Step 1: Author the schema**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://wos.org/schemas/assurance/wos-assurance.schema.json",
  "title": "WOS Assurance Declaration",
  "description": "Assurance-level and subject-continuity declarations (WOS Assurance Layer).",
  "type": "object",
  "properties": {
    "assuranceLevel": {
      "type": "string",
      "enum": ["L1", "L2", "L3", "L4"],
      "description": "Assurance level taxonomy (S2.1). Implementations MAY define additional levels; additional levels MUST be declared against the base four."
    },
    "subjectContinuity": {
      "type": "object",
      "description": "Subject continuity reference (S3).",
      "properties": {
        "reference": { "type": "string" },
        "scope": { "type": "string", "enum": ["instance", "case", "tenant", "deployment"] }
      },
      "required": ["reference", "scope"]
    },
    "disclosurePosture": {
      "type": "string",
      "enum": ["anonymous", "pseudonymous", "identified", "public"],
      "description": "Disclosure posture — independent of assuranceLevel per Invariant 6 (S4)."
    },
    "attestation": {
      "type": "object",
      "description": "Provider-neutral attestation (S5).",
      "properties": {
        "subject": { "type": "string" },
        "predicate": { "type": "string" },
        "basis": { "type": "string" },
        "validityScope": { "type": "string" }
      },
      "required": ["subject", "predicate", "basis"]
    }
  },
  "additionalProperties": false
}
```

- [ ] **Step 2: Validate schema parses**

Run: `python -c "import json; json.load(open('wos-spec/schemas/assurance/wos-assurance.schema.json'))"`

- [ ] **Step 3: Commit**

```bash
git add wos-spec/schemas/assurance/wos-assurance.schema.json
git commit -m "feat(wos-assurance): schema for assurance declarations"
```

---

## Task 12: Update `WOS-FEATURE-MATRIX.md` with new capability rows

**Files:**
- Modify: `wos-spec/WOS-FEATURE-MATRIX.md`

- [ ] **Step 1: Read existing section numbering in the matrix**

Confirm current §2 (Lifecycle), §4 (Human Task Management), §7 (Due Process), §8 (Provenance & Audit) structures.

- [ ] **Step 2: Add row 2.9 to §2 Lifecycle & Durable Execution table**

Insert before the closing `---`:

```markdown
| 2.9 | **Schema upgrade as named lifecycle operation** | Records explicit migrations with version provenance and migration mechanism; preserves historical verifiability | ✅ | ~ | ~ | ~ | ~ | ✘ | ~ | ~ |
```

- [ ] **Step 3: Add row 4.9 to §4 Human Task Management table**

```markdown
| 4.9 | **Quorum-based delegation (N-of-M authorization)** | Requires authorization from N of M distinct authorities for high-stakes operations | ✅ | ~ | ~ | ✘ | ✘ | ✘ | ✘ | ~ |
```

- [ ] **Step 4: Add row 7.15 to §7 Due Process & Legal Compliance table**

```markdown
| 7.15 | **Legal hold (distinct from workflow hold)** | Statutory-override hold that survives terminal state and blocks destruction with explicit release semantics | ✅ | ~ | ~ | ✘ |
```

- [ ] **Step 5: Add rows 8.11 and 8.12 to §8 Provenance & Audit table**

```markdown
| 8.11 | **Custody seam (custodyHook)** | Named extension seam for custody posture declaration; enables both trust-the-host monolith and distributed-trust bindings | ✅ | ✘ | ✘ | ✘ | ✘ | ✘ |
| 8.12 | **Invariant 6 (disclosure ≠ assurance)** | Structurally prevents conflation of identity-revelation level with identity-binding strength | ✅ | ✘ | ✘ | ✘ | ✘ | ✘ |
```

- [ ] **Step 6: Add a new §14 Identity & Assurance section after §13**

Note: §13 does NOT exist in the matrix as of this plan; if the current matrix already has a §13, insert this as the next number. Structure:

```markdown
## 14. Identity & Assurance

| # | Requirement | Description | WOS | SNow | Pega | Palnt |
|---|------------|-------------|-----|------|------|-------|
| 14.1 | **Assurance-level taxonomy** | Four-level ordered declaration of identity-binding strength (L1–L4), independent of disclosure posture | ✅ | ✘ | ✘ | ~ |
| 14.2 | **Subject continuity primitive** | Links related activity across time without requiring full legal-identity disclosure | ✅ | ✘ | ✘ | ✘ |
| 14.3 | **Provider-neutral attestation representation** | Attestation meaning representable independently of identity-provider bindings | ✅ | ✘ | ✘ | ✘ |
| 14.4 | **Assurance-upgrade facts** | Forward-only, non-rewriting facts for strengthening identity bindings over time | ✅ | ✘ | ✘ | ✘ |
| 14.5 | **Legal-sufficiency disclaimer (normative)** | Implementations MUST NOT imply cryptographic controls alone guarantee legal admissibility | ✅ | ✘ | ✘ | ✘ |
```

- [ ] **Step 7: Commit**

```bash
git add wos-spec/WOS-FEATURE-MATRIX.md
git commit -m "docs(wos-matrix): add capabilities 2.9, 4.9, 7.15, 8.11, 8.12, §14 identity & assurance"
```

---

## Task 13: Update `WOS-IMPLEMENTATION-STATUS.md`

**Files:**
- Modify: `wos-spec/WOS-IMPLEMENTATION-STATUS.md`

- [ ] **Step 1: Add assurance crate row to §1 Crate Maturity Matrix**

```markdown
| **wos-assurance** | 🟡 | Spec complete; reference implementation pending. Attaches via provenanceLayer and custodyHook seams. |
```

- [ ] **Step 2: Update §2 Verification Progress header**

Note that the total rules count will change after new lint rules are authored. Add a note:

```markdown
**NB:** Tier counts above reflect the baseline kernel+governance+AI rule set. Assurance layer rules (S2.9, S4.9, S7.15, §14.x) add approximately 9 Tier 1/2 rules, to be authored alongside the reference implementation.
```

- [ ] **Step 3: Commit**

```bash
git add wos-spec/WOS-IMPLEMENTATION-STATUS.md
git commit -m "docs(wos-status): add assurance crate and note pending lint rules"
```

---

## Task 14: Cross-reference pass — verify no duplicated normative text

**Files:**
- Read (no modifications in this task unless findings surface): multiple

- [ ] **Step 1: Grep for potential Invariant 6 duplication**

Run: `grep -rn "disclosure posture" wos-spec/specs/`
Expected: the phrase should appear normatively only in `wos-spec/specs/assurance/assurance.md` §4. Other occurrences should be informative references or absent.

- [ ] **Step 2: Grep for legal-sufficiency duplication**

Run: `grep -rn "legal admissibility\|legal sufficiency" wos-spec/specs/`
Expected: normative statement only in `wos-spec/specs/assurance/assurance.md` §6. Other occurrences (e.g., in governance) should be cross-references, not restatements.

- [ ] **Step 3: If any restatements found, convert to cross-references**

For each finding that is a normative restatement rather than a cross-reference: edit the occurrence to replace restatement with a `See [Assurance §X]` style reference.

- [ ] **Step 4: Commit any changes from Step 3**

```bash
git add -A
git commit -m "refactor(wos): deduplicate normative text — single source for Invariant 6 and legal-sufficiency"
```

---

## Self-Review

Ran inline after writing the above tasks.

**1. Spec coverage:**
- ✅ `custodyHook` seam — Task 1
- ✅ Assurance layer scaffold — Task 2
- ✅ Assurance-level taxonomy — Task 3
- ✅ Subject continuity — Task 4
- ✅ Invariant 6 (disclosure ≠ assurance) — Task 5
- ✅ Provider-neutral attestation + legal-sufficiency disclaimer — Task 6
- ✅ Schema upgrade as lifecycle op (§2.9) — Task 7
- ✅ Quorum delegation (§4.9) — Task 8
- ✅ Legal hold as distinct (§7.15) — Task 9
- ✅ Legal-sufficiency cross-reference in governance — Task 10
- ✅ Assurance schema file — Task 11
- ✅ Feature matrix updates — Task 12
- ✅ Implementation status updates — Task 13
- ✅ Deduplication sweep — Task 14

**2. Placeholder scan:** No "TBD", "implement later", "fill in details". Every prose block is complete. Every schema addition is complete JSON. Every commit message is specific.

**3. Type consistency:**
- Assurance levels spelled `L1`/`L2`/`L3`/`L4` consistently across Tasks 3, 11.
- Disclosure posture enum `anonymous`/`pseudonymous`/`identified`/`public` consistent across Task 5 and Task 11 schema.
- `quorumCount` / `quorumPool` consistent between Task 8 prose and schema.
- `holdType` enum extension in Task 9 uses existing `holdPolicies[].holdType` path.
- `custodyHook` property name consistent between Kernel prose (Task 1) and governance cross-references.

**4. Known residual gap:** Lint rules for the new capabilities (roughly 9 projected Tier 1/2 rules) are acknowledged in Task 13 but not authored in this plan. They belong in a separate "wos-assurance reference implementation" plan because they require Rust implementation work, not spec authoring. That is out of scope for Plan 1, which covers spec+schema only.

---

## Plan Complete

Plan saved to `thoughts/plans/2026-04-15-wos-custody-and-assurance.md`.

**Follow-up plans** (to be authored after this plan lands):
- **Plan 2:** Extract user-originated signing from Trellis `assurance-traceability.md` into Formspec Response spec (`specs/core/spec.md` or a new `specs/core/signing.md`).
- **Plan 3:** Trim Trellis specs to reference WOS for substrate-neutral material; remove duplicated Invariant 6 prose; trim `trust-profiles.md`, `projection-runtime-discipline.md`, `assurance-traceability.md` to ledger-specific content only.
