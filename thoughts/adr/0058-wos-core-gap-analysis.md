# ADR-0058: WOS Core Specification Gap Analysis — Government Workflow Capabilities

**Status:** Accepted (with modifications)
**Date:** 9 April 2026
**Updated:** 10 April 2026 (implementation disposition added)
**Author:** Mike (TealWolf Consulting LLC)
**Applies to:** WOS Core Specification v6.0.0 and v7 Change Proposal

### Implementation Disposition

All 7 proposed constructs have been resolved. 4 accepted (3 modified), 2 rejected, 1 accepted as-is. See [TODO.md](../../wos-spec/TODO.md) for remaining work.

| Construct | Decision | What was built |
|-----------|----------|----------------|
| 1A. Case Linking | **Accepted (modified)** | Kernel S5.5 — typed links only, NO cross-case FEL guards (breaks deterministic evaluation). Cross-case behavior uses `correlationKey` (S9.4) events instead. |
| 1B. Regulatory Effective Dating | **Accepted** | Policy Parameters sidecar S1.2-S1.5 — date-indexed scalar values + regulatory version bindings for document URIs. Same `resolutionDateRef` mechanism for both. |
| 1C. Delegation of Authority | **Accepted** | Governance S11 — delegator/delegate/scope/authority/legalInstrument with `maxDelegationDepth`. Enforcement via `lifecycleHook` on `determination` tags. |
| 1D. Review Cycles | **Rejected** | Existing statechart semantics are sufficient. Medicaid redetermination fixture (`fixtures/kernel/medicaid-redetermination.json`) proves cyclical lifecycle without a new construct: compound state with `$timeout.state` loop, history state for context resumption, cycle counter. |
| 2A. Batch Operations | **Rejected** | Implementation concern, not a spec construct. N individual events to N instances. |
| 2B. Correspondence Events | **Accepted (modified)** | Correspondence Metadata sidecar (`specs/kernel/correspondence-metadata.md`) — lightweight metadata schema for case correspondence, using existing kernel event model (S4.9). NOT a new event type. |
| 2C. Typed Hold Reasons | **Accepted** | Governance S12 — `holdType` enum, `expectedDuration`, event-based `resumeTrigger` (NOT FEL polling), `timeoutAction`. `hold` added to kernel S4.12 conventional tag table. |

---

## Context

Following the v7 change proposal (which restructures WOS around a minimal kernel with optional Preparation and Governance profiles), a dependency inversion analysis was conducted to determine what capabilities are missing from WOS when peer specifications (Formspec, foundation layer specs) are assumed to exist.

The analysis evaluated WOS against the operational realities of government case management workflows — benefits adjudication, licensing, inspections, grants processing, compliance review — and compared against the feature surface of production workflow tools (Camunda, Temporal, ServiceNow, DocuSign CLM).

The central question: assuming Formspec owns data collection/validation and a foundation layer owns calendar, content assembly, notification, and registry services — **what is WOS still missing from its own domain of orchestration, lifecycle, and case management?**

---

## Decision

We classify identified gaps into three categories based on whether they require normative spec constructs, lightweight extension points, or no spec changes.

### Category 1: Normative Spec Additions (4 constructs)

These gaps cannot be addressed by implementations without proprietary extensions. They represent structural or semantic concepts that must exist in the document model for interoperability.

#### 1A. Case Linking and Relationships

**Problem:** WOS models a single case with a self-contained case file. Government workflows require inter-case relationships: a fraud investigation spanning multiple benefit applications, a family whose linked cases affect each other, an appeal that creates a child case from a parent.

**What's missing:** No construct for inter-case references, case hierarchies (parent/child), case groups (linked siblings), or cross-case constraints.

**Proposed construct:**

```yaml
caseRelationships:
  - type: "parent"          # parent | child | sibling | related | supersedes
    targetCase: "urn:wos:example.gov:cases:APP-2026-00412"
    relationship: "appeal-of"
    constraints:
      - type: "hold"
        description: "Suspend adverse action on parent case during appeal"
        guard: "$related.status != 'resolved'"
    bidirectional: true
    established: "2026-04-09T14:30:00Z"
    establishedBy: "urn:wos:example.gov:actors:system"
```

**Key semantics:**

- Case relationships are typed and carry optional constraints (FEL expressions evaluated across case boundaries).
- Cross-case constraints participate in the DAG-based processing model — a state change in one case triggers re-evaluation in related cases.
- Relationships are recorded as provenance events.
- Relationship types are extensible via the `x-` model, but the core types (`parent`, `child`, `sibling`, `related`, `supersedes`) are normative.
- Aligns with OCEL 2.0 Object-to-Object relationships already referenced in the case state layer.

**Where it lives:** Kernel Layer 5 (Case State and Evidence). This is a structural extension to the case model, not a profile concern.

---

#### 1B. Regulatory Effective Dating

**Problem:** WOS §18.2 handles migrating in-flight instances when a regulation changes. But the more common scenario is concurrent version execution: applications filed before a policy change are processed under the old rules, applications filed after use the new rules, and both are running simultaneously in the same system.

**What's missing:** No concept of a regulatory effective date that binds a specific version of decision rules, thresholds, and policies to a case based on a case-specific anchor date (typically filing date, not current date).

**Proposed construct:**

```yaml
regulatoryVersioning:
  anchorField: "$caseFile.applicationReceivedDate"
  versions:
    - effectiveDate: "2025-10-01"
      expirationDate: "2026-03-31"
      bindings:
        incomeThreshold: 40000
        decisionRulesRef: "urn:wos:example.gov:decisions:eligibility:2.1.0"
        formRef: "urn:formspec:example.gov:application:3.0.0"
    - effectiveDate: "2026-04-01"
      expirationDate: null
      bindings:
        incomeThreshold: 45000
        decisionRulesRef: "urn:wos:example.gov:decisions:eligibility:3.0.0"
        formRef: "urn:formspec:example.gov:application:4.0.0"
```

**Key semantics:**

- The anchor field determines which regulatory version applies. This is evaluated once at case intake and recorded in provenance.
- Version bindings override decision service references, Formspec form references, threshold values, and any other version-sensitive parameters.
- The bound version is immutable for the life of the case unless a regulatory migration event (§18.2) explicitly rebinds it.
- This is distinct from instance migration: migration changes which version a case uses; effective dating determines which version a case *starts* with.
- Multiple regulatory versions coexist in the same workflow definition. The topology is shared; the parameterization differs.

**Where it lives:** Kernel Layer 1 (Lifecycle and Topology) with references resolved in Kernel Layer 5 (Case State). The regulatory version binding is a lifecycle concept; the bound values are case state.

---

#### 1C. Delegation of Authority

**Problem:** WOS models role-based task assignment and separation of duties. But government agencies operate under formal delegation-of-authority chains: a director delegates signing authority to a deputy for cases within certain parameters. This delegation has legal significance — the deputy's signature carries the director's authority — and has scope, duration, and revocation rules.

**What's missing:** No construct for authority chains distinct from task assignment. The spec conflates "assigned to do the work" with "authorized to make the determination," which are different in government practice.

**Proposed construct:**

```yaml
delegations:
  - id: "del-2026-0042"
    delegator: "urn:wos:example.gov:actors:director-smith"
    delegate: "urn:wos:example.gov:actors:deputy-jones"
    scope:
      impactLevels: ["operational"]
      maxDollarValue: 50000
      caseTypes: ["standard-grant"]
    authority: "signing"           # signing | determination | review | override
    legalInstrument: "Delegation Order 2026-003"
    effectiveDate: "2026-01-15"
    expirationDate: "2026-07-15"
    revocable: true
    revokedDate: null
```

**Key semantics:**

- Delegation is recorded as a provenance event and referenced in determination provenance records ("this determination was made under delegated authority from X to Y per instrument Z").
- Scope constraints are FEL expressions evaluated at determination time. A determination outside the delegation scope is a conformance error.
- Delegation chains are bounded — the spec defines a maximum delegation depth (configurable per workflow, default 1) to prevent unbounded sub-delegation.
- Delegation does not affect task assignment — a delegate may be assigned tasks through normal assignment rules and separately hold delegated authority to sign determinations within those tasks.
- Revocation is immediate and produces a provenance record. In-flight tasks assigned under a revoked delegation must be re-authorized.

**Where it lives:** §14 (Actor Model) extended with delegation constructs, with enforcement integrated into the task lifecycle (Profile Layer 3).

---

#### 1D. Redetermination and Periodic Review Cycles

**Problem:** WOS models workflows with terminal states. But ongoing benefits — Medicaid, SNAP, housing assistance, professional licenses — require periodic redetermination: the same case re-enters active processing on a schedule, the case file is re-evaluated against current data and current regulatory versions, and a new determination is issued. The case never truly closes.

**What's missing:** No lifecycle construct for cyclical re-entry. The spec's model is linear: `draft → active → [processing] → final`. Ongoing benefits need: `draft → active → [processing] → determination → monitoring → [redetermination trigger] → active → [processing] → determination → monitoring → ...`

**Proposed construct:**

```yaml
reviewCycle:
  id: "annual-eligibility-review"
  trigger:
    type: "scheduled"                    # scheduled | event | condition
    interval: "P12M"                     # ISO 8601 duration, resolved via business calendar
    anchorField: "$caseFile.lastDeterminationDate"
    preNotification: "P60D"              # notify 60 days before review due
  onActivation:
    inheritCaseFile: true                # carry forward existing case data
    requiredUpdates:                     # fields that must be refreshed
      - "$caseFile.currentIncome"
      - "$caseFile.householdComposition"
    regulatoryVersion: "current"         # rebind to current regulatory version
    resetFields:                         # clear previous determination artifacts
      - "$caseFile.determinationResult"
      - "$caseFile.reviewerAssignment"
  lifecycle:
    entryState: "redetermination-intake"
    reusesTopology: true                 # same workflow states, fresh traversal
  continuationOfBenefits:
    duringReview: true                   # benefits continue during redetermination
    onMissedDeadline: "extend-90-days"   # grace period if review not completed
  provenance:
    linkToPriorCycle: true               # provenance chain connects all cycles
    cycleNumber: "auto-increment"
```

**Key semantics:**

- A review cycle creates a new traversal of the same (or a designated subset of the) workflow topology, inheriting the case file but requiring specified fields to be refreshed.
- The trigger can be time-based (annual review), event-based (change of circumstance reported), or condition-based (FEL expression evaluating case data or external signals).
- Regulatory version rebinding on review cycle activation allows the redetermination to apply current rules, distinct from the original determination's effective-dated rules. The rebinding is recorded in provenance.
- Continuation of benefits during redetermination is a due process requirement (§16.5) that the review cycle construct operationalizes.
- Provenance chains link across cycles, enabling longitudinal audit: "this individual has been determined eligible 4 times over 4 years, with the following changes in circumstances."
- Missed-deadline handling (what happens if the agency fails to complete the redetermination on time) is a required field for `rights-impacting` workflows.

**Where it lives:** Kernel Layer 1 (Lifecycle and Topology) as a new lifecycle construct alongside states, transitions, and constraint zones.

---

### Category 2: Lightweight Extension Points (3 constructs)

These gaps are addressable with small normative additions that define a contract shape and provenance requirements without prescribing domain-specific behavior.

#### 2A. Batch Operations Contract

**Problem:** Government workflows operate at scale. Bulk approvals, mass reassignments, cohort-based policy changes.

**Proposed extension:** Define a `batchOperation` construct with:

- A query expression (FEL) selecting target instances.
- A transition or action to apply.
- Atomicity semantics: `all-or-nothing` or `best-effort` with per-instance error handling.
- Provenance requirements: each affected instance gets its own provenance record; the batch itself is recorded as a separate provenance event referencing all affected instances.
- Authorization: batch operations require elevated authority (configurable per workflow).

**What the spec defines:** The contract shape, provenance requirements, and authorization model.

**What implementations define:** Query execution strategy, parallelization, failure recovery, UI.

---

#### 2B. External Correspondence Events

**Problem:** Government cases accumulate external events that aren't workflow state transitions — phone calls, submitted documents, applicant inquiries, third-party verifications.

**Proposed extension:** Define an `externalEvent` case entry type with:

- Required: timestamp, actor (with type — applicant, representative, third-party, system), channel (in-person, phone, mail, email, portal), direction (inbound/outbound).
- Optional: content reference (claim check pattern, consistent with existing evidence model), summary, related task reference.
- Trigger semantics: an external event MAY trigger timer resets, escalations, or guard re-evaluation via the processing model.
- Provenance: external events are immutable case entries, not editable after recording.

**What the spec defines:** The event schema, provenance requirements, and trigger integration with the processing model.

**What implementations define:** Channel-specific metadata, intake UI, correspondence search.

---

#### 2C. Typed Hold Reasons

**Problem:** `suspend` and `resume` exist but carry no semantic payload. Government workflows have holds with distinct behavioral implications.

**Proposed extension:** Add a `holdType` property to the suspend operation with:

- Required: `reason` (typed string from an extensible vocabulary), `expectedDuration` (ISO 8601 duration or `indefinite`).
- Optional: `resumeTrigger` (FEL expression or event reference), `timeoutAction` (what happens when `expectedDuration` expires — escalate, auto-resume, cancel), `notificationTemplate` (content assembly reference for hold notification).
- Normative vocabulary (extensible via `x-`): `pending-applicant-response`, `pending-external-verification`, `pending-legal-review`, `pending-legislation`, `pending-related-case`, `voluntary-hold`.
- Provenance: hold initiation and resumption are distinct provenance records capturing the reason, duration, and resolution.

**What the spec defines:** The hold type schema, timeout semantics, and provenance requirements.

**What implementations define:** Hold reason vocabularies beyond the normative set, notification content, dashboard treatment.

---

### Category 3: Already Expressible — No Spec Changes (4 items)

These were initially identified as potential gaps but are already addressable with existing WOS constructs.

| Item | Why it's already covered |
|------|------------------------|
| **Workload management** | Assignment rules and SLAs define constraints; queue balancing and load distribution are execution engine optimizations, not orchestration primitives. Camunda Optimize does this as a product feature, not a BPMN construct. |
| **Scheduling and appointments** | Modeled as a task ("schedule inspection") fulfilled via integration contract. Resource-constrained scheduling is a domain application behind the contract boundary, not a workflow primitive. |
| **Recusal and conflict of interest** | Expressible as a guard expression on task assignment: `$actor.id not in $caseFile.conflictList`. The mechanism (guards, role-based access, separation of duties) exists; the specific rule is policy, not spec. |
| **Withdrawal and voluntary termination** | Modeled as a transition from any active state to a withdrawal-processing compound state. The lifecycle constructs (states, transitions, events, actions) are sufficient. The specific withdrawal topology is a workflow design choice. |

---

## Consequences

### Spec Impact

- **4 new normative constructs** added to the kernel: case relationships (Layer 5), regulatory effective dating (Layer 1), delegation of authority (§14), review cycles (Layer 1).
- **3 lightweight extension points** added: batch operations, external correspondence events, typed hold reasons. Each is approximately one page of normative text.
- **0 changes** to existing constructs. All additions are backward-compatible.

### Estimated Spec Volume

- Category 1 additions: ~8–12 pages of normative text across the four constructs.
- Category 2 additions: ~3–4 pages of normative text.
- Total: ~11–16 pages added to a spec that is currently ~30 pages of normative content (excluding appendices).

### Dependencies

- Case relationships depend on the case state model (Layer 5) and the processing model (§6.8) for cross-case constraint evaluation.
- Regulatory effective dating depends on the calendar foundation spec for duration resolution.
- Delegation of authority depends on the identity interface contract for actor resolution.
- Review cycles depend on regulatory effective dating for version rebinding and on the notification foundation spec for pre-review notifications.

### Risks

- **Cross-case constraints introduce computational complexity.** Evaluating guards across case boundaries could create performance bottlenecks at scale. The spec should define evaluation semantics but allow implementations to choose consistency models (immediate vs. eventual consistency for cross-case constraint evaluation).
- **Regulatory effective dating adds document model complexity.** Workflow definitions become parameterized, which complicates validation — a workflow must be sound under *every* possible regulatory version binding, not just the current one.
- **Review cycles blur the line between case management and workflow orchestration.** WOS is a workflow spec, not a case management spec. Review cycles push it toward CMMN territory. This is intentional — government workflows *are* case management — but it increases the spec's surface area.

---

## Alternatives Considered

**Alternative 1: Defer all gaps to implementation guidance.** Rejected because case relationships, regulatory effective dating, delegation of authority, and review cycles are structural concepts that require document model support. Implementations that invent proprietary solutions for these will be incompatible.

**Alternative 2: Create a separate WOS-CaseManagement companion spec.** Considered but rejected for the initial proposal. The four Category 1 constructs are tightly coupled to the kernel (lifecycle topology, case state, actor model) and would create circular dependencies if separated. If the spec grows further in the case management direction, extraction may be warranted in a future version.

**Alternative 3: Adopt CMMN instead of extending WOS.** Rejected because CMMN lacks AI governance, provenance architecture, and the Formspec integration that are WOS's differentiators. The constraint zone construct already provides CMMN-style adaptive case management. The gaps identified here are specific constructs that CMMN also doesn't fully address (CMMN has no regulatory effective dating, no delegation of authority, no review cycles).

---

## References

- WOS Core Specification v6.0.0
- WOS v7 Change Proposal: Profile-Based Architecture with Minimal Kernel
- [WOS Implementation Plan](../reviews/2026-04-09-wos-core-companion-review.md) — the implementation plan that executed this ADR's proposals, with phase tracking, success criteria, and content recovery map
- [ADR-0057](0057-wos-core-implementation-boundary.md) — the core vs. implementation boundary decision that followed this gap analysis
- [WOS TODO](../../wos-spec/TODO.md) — remaining work items derived from both ADRs
- OCEL 2.0 (Object-to-Object relationships for case linking precedent)
- CMMN 1.1 (case management lifecycle patterns)
- OMB Circular A-123 (delegation of authority in federal agencies)
- 42 CFR §435.916 (Medicaid redetermination requirements — review cycle precedent)
- 7 CFR §273.14 (SNAP recertification periods — review cycle precedent)
