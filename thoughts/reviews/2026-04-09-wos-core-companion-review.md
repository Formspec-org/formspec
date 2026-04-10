# WOS Implementation Plan — Hierarchical Kernel + Layered Governance

**Date:** 2026-04-09 (v3 — human-first architecture audit)
**Updated:** 2026-04-09 (v4 — implementation complete through Phase 3 + profiles + companion)
**Author:** Formspec project
**Status:** Phases 1-3 COMPLETE. Profiles and companion COMPLETE. Phase 4 PLANNED.
**Draft corpus:** `wos-spec/DRAFTS/` (13 files: v0.1 through v7, agent tier, lifecycle tier, amendments, proposals, schemas)
**Delivered:** 15 specs, 14 schemas, 19 fixtures (see Section 12 for full inventory)

---

## 1. Architectural Vision

### 1.1 The Principle

> **The kernel orchestrates. Layers govern. Contracts validate. Sidecars enrich.**
> **AI is a dropdown, not a prerequisite.**

WOS is a workflow orchestration standard first. It supports infinitely complex human-only workflows. AI integration is an optional capability that plugs into governance structures designed for human work — not a separate track bolted on afterward.

Every layer exists because human workflows need it. AI layers extend those same structures with AI-specific semantics. The seams for AI integration are organic because they're the same seams humans use for review, validation, and accountability.

### 1.2 The Human-First Test

Before placing any concept in the architecture, ask:

> **Does a pure-human, rights-impacting government workflow need this?**

- YES → it belongs at the layer where human workflows need it
- NO, but AI workflows need it → it belongs in an AI extension layer
- NO, but complex AI workflows need it → it belongs in an advanced AI layer

Due process, review protocols, data validation pipelines, and structured audit exist because of constitutional law and administrative procedure — not because of AI. They go where human workflows need them.

### 1.3 The LLM-Authoring Test

Every document type (spec + schema) must pass:

> An LLM given (1) the layer's schema, (2) the schema of the layer below, and (3) a natural-language description of the workflow can author a valid, complete WOS document without reading any other layer or sidecar.

**Phase 1 gate:** Three real workflow descriptions — benefits adjudication, procurement approval, and FOIA request processing — are each given to an LLM with only the kernel schema, the Layer 1 schema, and a one-paragraph description. Pass criteria: (a) the output is schema-valid, (b) the lifecycle models the described workflow (states and transitions match the described process), and (c) governance constraints match the described rules (due process, review protocols, validation pipelines). If the schemas aren't LLM-authorable by Phase 1 end, the schemas are too complex.

### 1.4 The Human-Auditability Test

> A non-technical auditor can read the provenance at the appropriate layer and understand who did what, what constraints were applied, and whether governance was followed.

### 1.5 Design Principles

1. **Human workflows are first-class.** A complex, multi-agency, rights-impacting workflow with zero AI is fully supported by Kernel + Layer 1. No AI layer is ever required.
2. **AI plugs into human governance, not alongside it.** Deontic constraints extend the review framework. Agent output validation extends data validation pipelines. AI oversight extends review protocols. The seams are the same.
3. **Each layer's schema is self-contained.** A Layer 1 document targets a kernel workflow. A Layer 2 document targets a kernel workflow. Neither requires the other to validate.
4. **Sidecars are pure metadata.** They enrich without affecting processing.
5. **Provenance grows upward.** Layer 0 records facts. Each higher layer adds interpretive structure. Lower layers are never modified.
6. **Complexity is opt-in.** Kernel-only is a valid deployment. Each layer adds capability proportional to the governance need.

---

## 2. The Hierarchy

```
PARALLEL SEAMS (cross-cutting, attach at any layer via named hooks)
┌──────────────┬───────────────┬───────────────┬──────────────┐
│  Semantic    │  Integration  │  Federation   │  Learning    │
│  (JSON-LD,   │  (Arazzo,     │  (cross-org,  │  (drift,     │
│   SHACL,     │   CWL,        │   trust,      │   feedback   │
│   PROV-O)    │   CloudEvents)│   data sov.)  │   loops)     │
└──────┬───────┴───────┬───────┴───────┬───────┴──────┬───────┘
       ▼               ▼               ▼              ▼

VERTICAL LAYERS (each optional, each builds on the one below)
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: ADVANCED GOVERNANCE (optional)                 │
│  • Verifiable constraints (SMT)  • Equity guardrails        │
│  • Constraint zones (DCR)        • Multi-step sessions      │
│  • Tool use governance           • Behavioral attestations  │
│  Sidecars: Equity Config, Verification Report               │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: AI INTEGRATION (optional)                         │
│  • Agent registration (deterministic/statistical/generative)│
│  • Deontic constraints (Permission/Prohib./Oblig./Right)    │
│  • Autonomy levels (autonomous/supervisory/assistive/manual)│
│  • Confidence framework (decay, calibration, cumulative)    │
│  • Formspec-as-validator (agent output = untrusted input)   │
│  • Fallback chains       • Decision drift detection         │
│  • AI-specific oversight extensions (suppression, diff)     │
│  • Narrative tier (non-authoritative, AI-specific)          │
│  • Assist Governance Proxy                                  │
│  Sidecars: Agent Config, Drift Monitor                      │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: WORKFLOW GOVERNANCE (optional)                     │
│  • Due process (notice, explanation, appeal, continuation)  │
│  • Review protocols (independentFirst, dualBlind, etc.)     │
│  • Data validation pipelines (staged, assertion gates)      │
│  • Structured audit (Reasoning + Counterfactual tiers)      │
│  • Quality controls (review sampling, separation of duties) │
│  • Task catalog with verifiability matrix                   │
│  • Screener integration (intake routing)                    │
│  Sidecars: Due Process, Review, Gate Library, Policy Params  │
├─────────────────────────────────────────────────────────────┤
│  Layer 0: KERNEL (required)                                 │
│  • Lifecycle topology (states, transitions, events)         │
│  • Case state (typed data, mutation history)                │
│  • Actor model (human, system — extensible seam)            │
│  • Impact level (informational/operational/safety/rights)   │
│  • Contract validation (Formspec recommended, JSON Schema)  │
│  • Provenance: Facts tier (immutable facts)                  │
│  • Durable execution (G1-G5)                                │
│  • Separation principles    • Named extension seams         │
│  Sidecars: Business Calendar, Notification Template         │
├─────────────────────────────────────────────────────────────┤
│  FORMSPEC SUBSTRATE                                         │
│  Definitions · FEL · Mapping DSL · Screener · Assist        │
│  References · Ontology · Respondent Ledger · Registry       │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Why This Order

**Layer 1 is Workflow Governance, not AI Preparation.**

A pure-human benefits adjudication workflow needs:
- Kernel: lifecycle (intake → review → determination → notify), case state, actors (caseworkers, reviewers, supervisors), rights-impacting impact level, Formspec contracts, Facts tier provenance, durable execution
- Layer 1: due process (30-day notice, individualized explanation, appeal to independent adjudicator, continuation-of-service), dual-blind review for contested cases, separation of duties, data validation for external income verification, Reasoning tier audit

That's a real, complex, non-AI workflow that needs Kernel + Layer 1. Zero AI involved.

When AI arrives, it plugs into structures that already exist:
- Layer 1's data validation pipelines → Layer 2 validates agent output through them
- Layer 1's review protocols → Layer 2 extends them with AI-specific suppression
- Layer 1's quality controls → Layer 2 adds agent-specific sampling
- Layer 1's Reasoning + Counterfactual tiers → Layer 2 adds Narrative tier (non-authoritative, AI-specific)
- Layer 1's due process → Layer 2 adds agent disclosure requirement

AI doesn't get its own governance track. It extends human governance.

### 2.2 Named Kernel Seams

Five extension points. Governance attaches primarily through `lifecycleHook` using **semantic transition tags** — the kernel author tags transitions with their nature (e.g., `"tags": ["determination", "review"]`), and governance documents declare rules that match on tags. Transition-specific rules are available as overrides when tag-based governance isn't specific enough.

| Seam | Purpose | What Layer 1 Attaches | What Layer 2 Attaches |
|---|---|---|---|
| `actorExtension` | Actor model | Nothing — human + system are sufficient | Agent as actor type with taxonomy |
| `contractHook` | Data validation | Data validation pipelines (validate external data against contracts) | Formspec-as-validator (agent output as untrusted input) |
| `provenanceLayer` | Audit trail | Reasoning tier + Counterfactual tier (due process, not AI-specific) | Narrative tier (non-authoritative, AI-specific) |
| `lifecycleHook` | Governance attachment | Tag-based: review protocols on `review`-tagged transitions, due process on `adverse-decision`-tagged transitions, sampling on `quality-check`-tagged transitions, separation of duties | Tag-based: deontic checks on governed transitions, autonomy enforcement, AI-specific suppression on `review`-tagged transitions, agent-specific sampling |
| `extensions` | Escape hatch | Standard `x-` mechanism | Standard `x-` mechanism |

**Why five, not seven.** Earlier drafts proposed separate `reviewHook` and `qualityHook` seams. These dissolve under tag-based governance — review protocols and quality controls are governance rules that match on transition tags, not separate kernel extension points. The kernel publishes tags; layers declare rules against them. One seam (`lifecycleHook`) handles all governance attachment.

### 2.3 Composition Rules

| Composition | What You Get | Who Needs This |
|---|---|---|
| **Kernel only** | Workflow orchestration with human + system actors, contract validation, Facts tier audit | Simple workflows, internal operations |
| **Kernel + Layer 1** | Governed human workflows: due process, review protocols, data validation, structured audit | **Government agencies, regulated industries, high-stakes human workflows** |
| **Kernel + Layer 2** | AI-assisted workflows with agent governance but no due process (informational/operational only) | Internal AI automation, low-stakes AI |
| **Kernel + L1 + L2** | Fully governed AI-assisted workflows: human governance + AI governance | **Rights-impacting AI workflows — the target use case** |
| **Kernel + L1 + L2 + L3** | Advanced: SMT-verifiable constraints, equity monitoring, constraint zones | Regulated AI, EU AI Act compliance |
| **Any + parallel seams** | Semantic interop, external integration, federation, learning governance | Cross-system, cross-agency, evolving models |

**Key insight:** Layer 2 CAN be adopted without Layer 1 for informational/operational workflows where due process and review protocols aren't needed. But for rights-impacting or safety-impacting workflows, Layer 1 is effectively required because the impact level demands due process — and due process lives in Layer 1.

### 2.4 Sidecar Pattern

Same as Formspec: each sidecar is a separate JSON document with its own `$wos*` marker, targets a parent via binding property, pure metadata, own version and lifecycle.

---

## 3. Formspec Integration Rules

Apply to every WOS document at every layer:

1. **Additive only.** WOS MUST NOT alter core Formspec processing semantics.
2. **Cite, never restate.** Reference Formspec spec sections by number.
3. **Delegate processing.** WOS processors MUST delegate Formspec Definition evaluation to a Formspec-conformant processor (Core S1.4).
4. **Canonical terminology.** "VP-01 (Core S6.4)" not "Formspec Pinning Rule."
5. **Formspec-as-validator (Layer 2).** Agent output is untrusted input validated against the same Formspec contract a human would submit against.

### 3.1 FEL Strategy

- `every`, `some`, `duration` — planned as Formspec built-in function additions (Core S3.5)
- Extension functions (Core S3.12) for domain-specific operations
- No grammar changes

### 3.2 Formspec Specification References

| Formspec Spec | WOS Layer | Integration Point |
|---|---|---|
| Core S1.4 (Conformance) | All | Processor delegation |
| Core S2.3 (Three-Layer Invariant) | L2 | Headless contract pattern |
| Core S2.4 (Processing Model) | All | Closed system — WOS wraps, never enters |
| Core S3.5, S3.12 (Functions) | All | FEL built-ins + extensions |
| Core S1.4.3, S6.4 (VP-01/VP-02) | All | Version pinning |
| Screener S4-S8 | L1 | Intake routing via Determination Records |
| Assist S2.1-2.3, S7.1-7.2 | L2 | Assist Governance Proxy wraps protocol |
| Mapping S2.4 (Data Flow Pipeline) | L1, L2 | Data flow between workflow stages |
| Respondent Ledger | L1 | WOS elevates Respondent Ledger conformance from SHOULD to MUST |
| Ontology S3 | L2 | Semantic agent contracts |
| Changelog S4 | All | Impact classification for version migration |

---

## 4. Document Inventory

### 4.1 Layer 0: Kernel

| Document | File | Schema | Est. Lines |
|---|---|---|---|
| **Kernel Spec** | `specs/kernel/spec.md` | `schemas/wos-kernel.schema.json` | ~600-800 |
| Business Calendar | `specs/kernel/business-calendar.md` | `schemas/wos-business-calendar.schema.json` | ~150 |
| Notification Template | `specs/kernel/notification-template.md` | `schemas/wos-notification.schema.json` | ~150 |

**Kernel contents:** Lifecycle topology (states, transitions, events, milestones, cancellation policy on parallel states, semantic transition tags). **Deterministic evaluation algorithm:** the lifecycle is a pure function of (current states × event × guards → next states). Guards evaluated in document order, first satisfied guard wins. Fork activates all parallel branches simultaneously; join fires when all branches reach a final state. Events that match no transition from current states are recorded in provenance but do not change lifecycle state. Case state (typed data, append-only mutation history — grows regardless of lifecycle transitions; lifecycle state and case state are independent). Actor model (human + system, extensible via actorExtension). Impact level declaration (four levels, proportional governance table — points to Layer 1 for due process, Layer 2 for AI governance). Contract validation (abstract interface, Formspec recommended, JSON Schema baseline). **Evaluation context:** kernel defines base context from case state; layers enrich it through seams (Layer 1 adds temporal parameter resolution, Layer 2 adds deontic constraint context). All FEL evaluation — guards, assertion gates, deontic constraints — uses the fully enriched context. Provenance Facts tier (immutable facts: who, what, when, version, inputs, outputs, optional `inputDigest`/`outputDigest` for tamper detection). Durable execution (G1-G5 + compensation seam + idempotency keys + instance versioning constraint). Correlation keys on signals/callbacks. Separation principles. Named seams (actorExtension, contractHook, provenanceLayer, lifecycleHook, extensions — five seams, see Section 2.2). Conformance: Kernel Structural, Kernel Complete.

**Research-validated kernel additions (see Section 10):**
- `idempotencyKey` on `invokeService` — closes the crash-between-invoke-and-persist window
- `correlationKey` on signals — fundamental for any workflow awaiting external callbacks
- `inputDigest`/`outputDigest` on provenance records — lightweight tamper detection
- `compensatingAction` on actions + `compensable` flag on scopes — compensation seam only, not full saga (detailed execution semantics deferred to Lifecycle Detail companion)
- `cancellationPolicy` on parallel states — cancel-siblings / wait-all / fail-fast
- Instance versioning constraint: instance bound to creation-time definition version unless explicitly migrated
- PROV-DM compatibility as a design constraint (ensure mappability, defer vocabulary to Semantic Profile)

**What's NOT in the kernel:** Due process, review protocols, data validation pipelines, Reasoning/Counterfactual/Narrative tiers, anything AI-specific, full saga execution semantics, defeasible rules engine, discretionary planning.

### 4.2 Layer 1: Workflow Governance

| Document | File | Schema | Est. Lines |
|---|---|---|---|
| **Workflow Governance Spec** | `specs/governance/workflow-governance.md` | `schemas/wos-workflow-governance.schema.json` | ~800-1000 |
| Due Process Config | `specs/governance/due-process-config.md` | `schemas/wos-due-process.schema.json` | ~200 |
| Review Config | `specs/governance/review-config.md` | `schemas/wos-review.schema.json` | ~150 |
| Assertion Gate Library | `specs/governance/assertion-library.md` | `schemas/wos-assertion-gate.schema.json` | ~200 |
| Policy Parameter Config | `specs/governance/policy-parameters.md` | `schemas/wos-policy-parameters.schema.json` | ~150 |

**Workflow Governance contents:**

*Due process (for rights-impacting/safety-impacting workflows):*
- Notice with grace period, individualized explanation, appeal to independent human adjudicator, continuation-of-service, disclosure requirements
- Counterfactual explanation for adverse decisions: positive (what controllable factors would change the outcome) and negative (what irrelevant factors, including protected characteristics, did NOT affect the outcome). This is a legal/due process requirement that predates AI
- Legal citations: State v. Loomis, Houston Federation of Teachers, APA, ECOA, OMB M-24-10, EU AI Act

*Review protocols (for ANY review step, human or AI):*
- independentFirst: reviewer forms independent assessment before seeing any recommendation
- considerOpposite: reviewer articulates counter-arguments before confirming
- calibratedConfidence: confidence scores displayed alongside recommendation
- dualBlind: two independent reviewers, results reconciled
- unassisted: no assistance, unmediated professional judgment
- Research citations: Vaccaro 2024, Bucinca 2021, Li 2024

*Data validation pipelines (for ANY untrusted data source):*
- Staged processing with assertion gates between stages
- Gate types: source-grounded, arithmetic, range, consistency, format, cross-document, temporal
- Pipeline provenance: each stage records inputs, outputs, gate results
- Verifiability matrix: which tasks are verifiable, which are judgment

*Structured audit (extends kernel Facts tier):*
- Reasoning tier: rules applied, evidence consulted, criteria checked, decision table trace
- Counterfactual tier: what would change the outcome (positive counterfactuals) and what did NOT affect it (negative counterfactuals, including protected characteristics). Required for adverse decisions in rights-impacting workflows. This is a due process requirement — not AI-specific
- Decision requirements declarations: which inputs were required, which rules from which authority, which date-effective thresholds
- Both tiers are for HUMAN decisions too — not just AI. When a caseworker applies eligibility criteria, the reasoning trace records which rules, which evidence, which thresholds. The counterfactual records what the applicant could change to qualify

*Rejection and remediation (for pipeline and gate failures):*
- `rejectionPolicy` on pipeline stages and assertion gates: what happens when validation fails
- Policies: `retryWithCorrections` (return to submitter with structured explanation of what failed), `escalateToSupervisor` (route to authority with override capability), `holdPendingData` (suspend pending external data resolution), `failWithExplanation` (terminate with structured rejection record)
- Rejection provenance: which gate failed, what the input was, what the threshold was, what would pass
- Layer 2 extends this via fallback chains (escalateToHuman, retry, alternateAgent, fail) — but Layer 1 must define the human-workflow equivalent independently

*Temporal parameter versioning (sidecar):*
- Date-indexed parameter values: rates, thresholds, eligibility criteria that change on specific dates
- Each parameter declares its resolution date reference (e.g., `eligibilityThreshold` resolves against the `applicationDate` case state field; `appealDeadlineDays` resolves against the `appealFilingDate` field). Different parameters can resolve against different dates
- The system applies rules effective at the relevant date, not today's date (OpenFisca model)
- Composes with Business Calendar: "the income threshold effective on the application date, adjusted for the applicable business calendar"
- **Resolution mechanism:** Temporal parameters resolve through the kernel's evaluation context enrichment model (see Section 4.1). The sidecar declares date-indexed values and resolution date references. Layer 1 resolves them and injects the effective values into the evaluation context via `lifecycleHook`. By the time any FEL expression evaluates — kernel guards, Layer 1 assertion gates, Layer 2 deontic constraints — the context already contains the correct date-effective values. The workflow author writes `income < eligibilityThreshold`; the resolution is automatic. No separate `temporalResolutionHook` seam is needed because temporal resolution is a specific case of evaluation context enrichment, which the kernel already defines

*Quality controls:*
- Review sampling: configurable percentage of decisions reviewed for quality
- Separation of duties: reviewer != original caseworker, with sameInstance/global scope
- Override authority: structured rationale, authority verification, supporting evidence

*Task catalog:*
- Verifiability matrix for task patterns (extraction: verifiable; credibility assessment: not verifiable)
- Screener integration: Screener Documents for intake classification and routing

*Conformance:* Workflow Governance Basic (due process + review protocols), Workflow Governance Complete (+ pipelines + audit + quality controls)

**Why this is Layer 1, not kernel:** The kernel is the minimal orchestration substrate. A simple internal workflow (track a purchase order through approval steps) doesn't need due process, review protocols, or data validation pipelines. Layer 1 is for complex, regulated, or high-stakes workflows — which is most government work, but not all workflows.

### 4.3 Layer 2: AI Integration

| Document | File | Schema | Est. Lines |
|---|---|---|---|
| **AI Integration Spec** | `specs/ai/ai-integration.md` | `schemas/wos-ai-integration.schema.json` | ~600 |
| Agent Config | `specs/ai/agent-config.md` | `schemas/wos-agent-config.schema.json` | ~200 |
| Drift Monitor Config | `specs/ai/drift-monitor.md` | `schemas/wos-drift-monitor.schema.json` | ~150 |

**AI Integration contents:**

*Agent registration (via kernel actorExtension seam):*
- Agent as actor type: deterministic / statistical / generative
- Agent identity: id, version, model identifier, model version
- Capability declaration with Formspec Definition references for I/O contracts
- Model version policy: pinned / approved / latest

*Deontic constraints (AI-specific governance primitive):*
- Permission, Prohibition, Obligation, Right — extends Layer 1's review framework
- Enforcement ordering: Permissions → Prohibitions → Obligations → Confidence → Volume → Sampling
- Conflict resolution: reject > escalateToHuman > switchToAssistive > flag
- Null propagation: impact-dependent (escalate for rights/safety, pass for operational/informational)
- FEL examples for each type

*Autonomy levels (action-site property, not agent property):*
- autonomous / supervisory / assistive / manual
- Impact-level caps
- Fallback-to-human requirement

*Formspec-as-validator (extends Layer 1's data validation pipelines):*
- Agent output validated against same Formspec contract as human input
- Agent-touched fields annotated with `agentProvenance` metadata
- Validation failures trigger fallback, not silent acceptance

*Confidence framework:*
- ConfidenceReport: overall (0-1), method enum, fieldLevel, explanation
- Confidence decay: half-life + event triggers (multiplicative)
- Temporal confidence thresholds
- Cumulative confidence across sessions

*Fallback chains:*
- escalateToHuman, retry, alternateAgent, fail
- 5-step execution algorithm
- MUST terminate in escalateToHuman or fail

*Decision drift detection:*
- Training data contamination (trained on outcomes = determination, not preparation)
- Optimization objective misalignment
- Rubber-stamp detection (reviewer engagement declining)

*AI-specific oversight extensions (extends Layer 1's review protocols via lifecycleHook on review-tagged transitions):*
- independentFirst suppression: hide agent output until independent assessment recorded
- showDiffFromIndependent: highlight disagreements between reviewer and agent
- Presentation properties: showConfidence, showAlternatives, highlightLowConfidenceFields

*Assist Governance Proxy (WOS construct consuming Formspec Assist protocol):*
- Per-tool-category governance
- Cites Assist S2 (conformance roles), S7 (transport bindings)
- NOT a Formspec concept

*Agent provenance (extends Layer 1's Reasoning + Counterfactual tiers via provenanceLayer seam):*
- Narrative tier: model's natural language explanation. NON-AUTHORITATIVE. This is the only AI-specific provenance tier — it exists because model-generated explanations are systematically unfaithful (Turpin 2023, Lanham 2023) and must be labeled as non-authoritative
- Layer 1 already provides Reasoning and Counterfactual tiers for human decisions. Layer 2 extends them with agent-specific metadata (model version, confidence scores, input summaries) but does not add new tier types

*Volume constraints and review sampling (extends Layer 1's quality controls via lifecycleHook on quality-check-tagged transitions):*
- maxAutonomousPerHour / maxAutonomousPerDay
- Agent-specific sampling methods: random, stratified, adversarial

*Conformance:* AI Basic (agent registration + Formspec-as-validator), AI Governed (+ deontic + autonomy + confidence), AI Complete (+ all)

### 4.4 Layer 3: Advanced Governance

| Document | File | Schema | Est. Lines |
|---|---|---|---|
| **Advanced Governance Spec** | `specs/advanced/advanced-governance.md` | `schemas/wos-advanced.schema.json` | ~1000-1200 |
| Equity Config | `specs/advanced/equity-config.md` | `schemas/wos-equity.schema.json` | ~150 |
| Verification Report | `specs/advanced/verification-report.md` | `schemas/wos-verification-report.schema.json` | ~150 |

**Contents:** Verifiable Constraint Subset (SMT). Equity guardrails (groupBy, maxDisparity) — applies to human AND AI decisions. Constraint zones (DCR-style) — compliance rules and case evolution for human and AI workflows. Multi-step sessions (DAG-ordered steps, checkpoints, interventions). Tool use governance. Agent lifecycle state machine (active/degraded/suspended/retired). Calibration methods (Platt/isotonic/binning). Drift detection methods (PSI/KS/chi2/accuracy). Shadow Mode + Circuit Breaker patterns.

**Why "Advanced Governance" not "Advanced AI Governance":** DCR constraint zones model compliance rules for human workflows (when fraud is discovered, include additional verification steps). Equity monitoring of human decisions (are certain demographics disproportionately denied?) is a civil rights concern, not an AI concern. These capabilities serve any complex workflow, not just AI-assisted ones.

**Sub-conformance levels:** Layer 3 packages conceptually distinct capabilities for pragmatic reasons (few deployments need any of them). To prevent all-or-nothing adoption, conformance is split:
- *Advanced Governance: Runtime* — constraint zones (DCR), multi-step sessions, equity guardrails, agent lifecycle. These are runtime governance patterns.
- *Advanced Governance: Verification* — SMT verifiable constraints, calibration methods, drift detection, verification reports. These are static/offline analysis tools.
- *Advanced Governance: Complete* — both Runtime and Verification.

An implementer can adopt constraint zones for human case management without building an SMT solver integration.

### 4.5 Parallel Seams

| Document | File | Phase |
|---|---|---|
| Semantic Profile | `specs/profiles/semantic.md` | Phase 3 |
| Integration Profile | `specs/profiles/integration.md` | Phase 2 |
| Federation Profile | `specs/profiles/federation.md` | Phase 4 |
| Learning Profile | `specs/profiles/learning.md` | Phase 4 |

---

## 5. How AI Plugs Into Human Governance

This section makes explicit how each Layer 2 concept extends a Layer 1 concept, demonstrating that AI governance is not a separate track but an extension of human governance.

| Layer 1 Concept (Human) | Seam | Transition Tag | Layer 2 Extension (AI) |
|---|---|---|---|
| Review protocols (independentFirst, dualBlind) | `lifecycleHook` | `review` | AI-specific suppression: hide agent output until independent assessment |
| Data validation pipelines (assertion gates) | `contractHook` | — | Formspec-as-validator: agent output validated through same gates |
| Due process (notice, appeal, disclosure) | `lifecycleHook` | `adverse-decision` | Agent disclosure requirement added to notice |
| Structured audit (Reasoning + Counterfactual tiers) | `provenanceLayer` | — | Narrative tier (non-authoritative, AI-specific) |
| Quality controls (review sampling) | `lifecycleHook` | `quality-check` | Agent-specific sampling: stratified, adversarial methods |
| Separation of duties | `lifecycleHook` | `review` | Agent MUST NOT review its own output |
| Override authority | `lifecycleHook` | `determination` | Agent output MUST NOT override human override |
| Task catalog (verifiability matrix) | — (reference) | — | Drift detection: is a "verifiable" task drifting to "judgment"? |
| Screener intake routing | `contractHook` | — | Agent-assisted screening via preparation pipeline |

---

## 6. Implementation Phases

### Phase 1: Kernel + Workflow Governance — COMPLETE

**Goal:** Agencies can build complex, governed, rights-impacting human workflows with zero AI.

**Delivered:**
1. ✅ Kernel spec + schema — `specs/kernel/spec.md`, `schemas/wos-kernel.schema.json`
2. ✅ Workflow Governance spec + schema — `specs/governance/workflow-governance.md`, `schemas/wos-workflow-governance.schema.json`
3. ✅ Due Process Config sidecar + schema
4. ✅ Assertion Gate Library sidecar + schema
5. ✅ Policy Parameter Config sidecar + schema
6. ⏳ Formspec built-in functions `every`, `some`, `duration` — NOT YET IMPLEMENTED in Formspec. Fallback to extension functions (Core S3.12) available.
7. ✅ Conformance fixture pack (6 fixtures: purchase order, benefits kernel, benefits governance, policy parameters, provenance trace, 8 invalid documents)
8. ✅ Kernel-only smoke test (purchase order approval)

**Validation:** Both exercises completed. Kernel-only purchase order validates without Layer 1. Benefits adjudication fully expressible with Kernel + Layer 1.

**Reviews:** Semi-formal code review completed. All findings addressed (kernel-generated events, task management, schema limitations, x-lm.critical examples, `$join` synthetic event, section renumbering).

### Phase 2: AI Integration — COMPLETE

**Goal:** Agencies can add AI to governed workflows. AI plugs into existing governance structures.

**Delivered:**
9. ✅ AI Integration spec + schema — `specs/ai/ai-integration.md`, `schemas/wos-ai-integration.schema.json`
10. ✅ Agent Config sidecar + schema — `specs/ai/agent-config.md`, `schemas/wos-agent-config.schema.json`
11. ✅ Drift Monitor Config sidecar + schema — `specs/ai/drift-monitor.md`, `schemas/wos-drift-monitor.schema.json`
12. ✅ Integration Profile — `specs/profiles/integration.md`, `schemas/wos-integration-profile.schema.json`

**Validation:** Benefits workflow extends with AI without changing Kernel or Layer 1 documents. Cross-layer evaluation context proven by fixture FEL expressions referencing `output` (L2), `caseFile` (kernel), `parameters` (L1).

**Reviews:** Semi-formal code reviews completed for AI Integration and Integration Profile. All findings addressed (x-lm.critical examples, cascadingInvocations, screener row, confidenceFloor definition, FEL examples, CaMeL note, autonomy escalation/demotion, constraint composition, evaluation context variables).

### Phase 3: Advanced Governance + Semantic + Companion — COMPLETE

**Delivered:**
13. ✅ Advanced Governance spec + schema — `specs/advanced/advanced-governance.md`, `schemas/wos-advanced.schema.json`
14. ✅ Equity Config sidecar + schema — `specs/advanced/equity-config.md`, `schemas/wos-equity.schema.json`
15. ✅ Verification Report sidecar + schema — `specs/advanced/verification-report.md`, `schemas/wos-verification-report.schema.json`
16. ✅ Semantic Profile — `specs/profiles/semantic.md`, `schemas/wos-semantic-profile.schema.json`
17. ✅ Lifecycle Detail companion — `specs/companions/lifecycle-detail.md`, `schemas/wos-lifecycle-detail.schema.json`

**Validation:** Constraint zones model fraud investigation with full DCR semantics. Equity guardrails evaluate asynchronously. SMT verification report shows 2 proven-safe, 1 inconclusive (defense-in-depth). PROV-O mapping fulfills Kernel S8.4 deferral.

**Reviews:** Semi-formal code reviews completed for Advanced Governance, Semantic Profile, and Lifecycle Detail. All findings addressed (agent lifecycle schema expansion, constraint zone integration, governance attachment sections, SCXML mapping, compensation algorithm pseudocode, actor type mapping harmonization, XES lifecycle semantics).

### Phase 4: Future Profiles — PLANNED

**Not started:**
18. Federation Profile — cross-org trust, data sovereignty, multi-agency workflow coordination
19. Learning Profile — drift feedback loops, model improvement governance, continuous calibration

### LLM-Authoring Validation Gate — PASSED

Three test workflows authored by Sonnet from schemas alone (no spec access):

| Test | Schemas | Result | Iterations |
|------|---------|--------|------------|
| Procurement approval (kernel-only) | kernel | PASS | 0 fixes |
| Benefits AI integration (kernel + AI) | kernel, AI integration | PASS | 0 fixes |
| FOIA request (kernel + governance) | kernel, governance, due process | PASS | 1 fix (Action.description added to schema) |

Fixtures at `fixtures/validation/`.

---

## 7. Content Recovery Map

### Phase 1 Recovery (Kernel + Workflow Governance)

| Item | Source Draft | Destination |
|---|---|---|
| Lifecycle state types and transitions | `wos-core-v2.md` S6.2-6.4 | Kernel |
| Actions catalog | `wos-core-v2.md` S6.5 | Kernel |
| Internal event catalog | `wos-core-v2.md` S6.6 | Kernel |
| Case file structure | `wos-core-v2.md` S10.2 | Kernel |
| Separation principles | `wos-core-spec.md` S4.2 | Kernel |
| Five timeout categories | `wos-core-v2.md` S13.3 | Kernel (durable execution) |
| Impact level table | `wos-core-v7-kernel.md` S4 | Kernel |
| Due process (notice, explanation, appeal, continuation) | `wos-core-v7-kernel.md` S9, `wos-core-v2.md` S16 | **Layer 1 Workflow Governance** |
| Legal citations (State v. Loomis, Houston Fed.) | `wos-core-v2.md` S16.1 | Layer 1 |
| Notice grace period | `wos-core-v2.md` S16.2 | Layer 1 |
| Oversight protocols (5 protocols with research citations) | `wos-core-v7-kernel.md` S7 | **Layer 1 (as review protocols, not AI oversight)** |
| Assertion gate types (7 types) | `wos-core-v7-proposal.md` S4.3.1-4.3.2 | Layer 1 |
| Pipeline pattern (staged processing) | `wos-core-v7-proposal.md` S4.3.1 | Layer 1 |
| Task catalog with verifiability matrix | `wos-core-v7-proposal.md` S4.3.3 | Layer 1 |
| Separation of duties | `wos-core-spec.md` S8.7 | Layer 1 |
| Override authority structure | `wos-core-spec.md` S8.8 | Layer 1 |
| Task lifecycle state diagram + operations table | `wos-core-v2.md` S8.3-8.4 | Layer 1 |
| Five assignment roles | `wos-core-v2.md` S8.5 | Layer 1 |
| SLA definitions | `wos-core-spec.md` S8.6 | Layer 1 |
| Screener integration | Review doc clarification #9 | Layer 1 |

### Phase 2 Recovery (AI Integration)

| Item | Source Draft | Destination |
|---|---|---|
| Agent type taxonomy | `wos-core-v7-proposal.md` S4.2 | Layer 2 |
| Formspec-as-validator pattern | `wos-core-v7-proposal.md` S4.3.2 | Layer 2 |
| Decision drift detection | `wos-core-v7-proposal.md` S4.3.5 | Layer 2 |
| Deontic constraint examples with FEL | `wos-core-v4.md` S9.5, `wos-core-v7-kernel.md` S6 | Layer 2 |
| Enforcement ordering (6-step) | `wos-core-v4.md` S9.5.5, amendments S7.7.2 | Layer 2 |
| Null propagation by impact level | `wos-core-v7-kernel.md` S6.6 | Layer 2 |
| Autonomy levels + policies | `wos-core-v7-kernel.md` S5, amendments S6.9 | Layer 2 |
| Confidence framework + decay | `wos-agent-tier-spec.md` S7 | Layer 2 |
| Fallback chains (5-step algorithm) | `wos-agent-tier-spec.md` S15.2 | Layer 2 |
| Volume constraints | Amendments S7.7.1 | Layer 2 |
| Agent-specific sampling | Amendments S7.7.1 | Layer 2 |
| AI oversight extensions (showDiffFromIndependent) | `wos-core-v4.md` ActivityDef example | Layer 2 |
| Assist Governance Proxy | `wos-core-v5.md` Appendix E | Layer 2 |
| Counterfactual tier provenance | `wos-core-v7-kernel.md` S8 | **Layer 1** (due process requirement, not AI-specific) |
| Narrative tier provenance (non-authoritative) | `wos-core-v7-kernel.md` S8 | Layer 2 (AI-specific: model explanations are unfaithful) |
| CaMeL dual-LLM architecture | `wos-core-v2.md` S9.7 | Layer 2 (security) |
| Shadow/canary/production deployment | `wos-core-v2.md` S9.8 | Layer 2 |
| Model version policy | Amendments S8, `wos-agent-tier-spec.md` S5.3 | Layer 2 |
| Arazzo sequence example | `wos-core-v5.md` S11.2 | Integration Profile |
| CWL tool example | `wos-core-v5.md` S11.3 | Integration Profile |
| CloudEvents extensions | `wos-core-spec.md` S10.3 | Integration Profile |

### Phase 3 Recovery (Advanced AI)

| Item | Source Draft | Destination |
|---|---|---|
| Equity guardrails | `wos-agent-tier-spec.md` S8.3.3 | Layer 3 |
| Verifiable Constraint Subset | `wos-core-v6.md` Appendix F | Layer 3 |
| Constraint zone semantics | `wos-core-v6.md` Appendix G | Layer 3 |
| Multi-step sessions | `wos-agent-tier-spec.md` S9 | Layer 3 |
| Tool use governance | `wos-agent-tier-spec.md` S10 | Layer 3 |
| Agent lifecycle state machine | `wos-agent-tier-spec.md` S12 | Layer 3 |
| Drift detection methods | `wos-agent-tier-spec.md` S13 | Layer 3 |
| Shadow Mode + Circuit Breaker | `wos-agent-tier-spec.md` Appendix C | Layer 3 |
| SHACL shapes (8 in Turtle) | `wos-core-v4.md` Appendix B | Semantic Profile |
| Full @context JSON-LD | `wos-core-v3.md` Appendix A | Semantic Profile |
| Transition evaluation algorithm | `wos-core-spec.md` S6.4.1 | Lifecycle Detail |
| SCXML mapping | `wcos-lifecycle-spec.md` Appendix C | Lifecycle Detail |

---

## 8. Formspec Integration Issues

These apply regardless of architecture:

1. **Null propagation** — impact-dependent for deontic constraints (Layer 2)
2. **FEL** — built-in additions, not grammar changes
3. **Assist Governance** — WOS construct consuming Assist protocol (Layer 2)
4. **Cite, never restate** — strict across all layers
5. **Processor delegation** — stated in kernel, inherited by all
6. **Canonical terminology** — VP-01, Assist Provider, Impact Classification
7. **Conformance without equivalence** — SHOULD for implementation-defined outcomes
8. **Unpublished dependencies** — honest about deferred conformance

---

## 9. Research Synthesis

Five research documents were reviewed by parallel agents against the implementation plan and kernel spec. This section records the convergent findings, what was adopted, what was rejected, and where the agents overreached.

**Source documents:** `wos-spec/research/` (3 .docx landscape surveys + 1 .md compass artifact + 1 research prompt)

### 9.1 Adopted (integrated into the plan above)

| Finding | Convergence | Where | Notes |
|---|---|---|---|
| Compensation seam | 5/5 unanimous | Kernel | Seam only (`compensatingAction` + `compensable` flag), NOT full saga. Detailed execution semantics (reverse ordering, pivot steps) deferred to Lifecycle Detail companion. See "Agent Overreach" below |
| Idempotency key on `invokeService` | 4/5 | Kernel S9 | Closes crash-between-invoke-and-persist window. Optional property |
| Correlation key on signals | 3/5 | Kernel | Too fundamental for Integration Profile. Any callback-waiting workflow needs it |
| Input/output digests on provenance | 2/5 | Kernel S8 | Optional `inputDigest`/`outputDigest`. Lightweight tamper detection |
| Instance versioning constraint | 2/5 | Kernel S9 | One normative statement: bound to creation-time version unless migrated |
| Cancellation policy on parallel states | 1/5 | Kernel | cancel-siblings / wait-all / fail-fast. Small, prevents implementation divergence |
| Temporal parameter versioning | 3/5 | Layer 1 sidecar | OpenFisca model. Date-indexed values for rates/thresholds. New Policy Parameter Config sidecar |
| Decision requirements in Reasoning tier | 3/5 | Layer 1 audit | Metadata declarations (required inputs, applicable rules, citing authority), NOT a decision engine |
| Layer 3 rename | 2/5 | Plan | "Advanced Governance" not "Advanced AI Governance." DCR and equity serve human workflows |
| Conformance fixture packs | 3/5 | All phases | Canonical valid documents + expected provenance + expected rejections |
| PROV-DM compatibility | 3/5 | Kernel S8 design constraint | Ensure mappability to PROV-DM. Defer PROV-O vocabulary to Semantic Profile |

### 9.2 Rejected (with rationale)

| Recommendation | Reviews | Why Rejected |
|---|---|---|
| Full saga/compensation semantics in kernel | 5/5 recommended full saga | **Agent overreach.** All five agents recommended full saga execution semantics (reverse ordering, pivot steps, forward/backward recovery). This is too much mechanism for the minimal kernel. The Formspec pattern applies: Core defines `widgetHint` (the hook), Theme defines the rendering (the detailed semantics). The kernel defines the compensation seam; a Lifecycle Detail companion defines the algorithm. Adding a full saga pattern would roughly double the kernel's conceptual weight |
| Discretionary planning as Layer 1 concept | 1/5 | Already covered by DCR constraint zones (now in Layer 3 "Advanced Governance"). DCR include/exclude relations allow dynamic activity activation within a governed framework. Adding arbitrary runtime topology mutation undermines soundness verification and deterministic replay |
| Proposal/Commit as formal object model | 1/5 | Premature abstraction. Kernel compound states already model recommendation → decision flows via transitions. Layer 1 review protocols handle the review pattern. A formal Proposal object adds rigidity without proportionate benefit |
| Defeasible rules engine | 3/5 | Scope creep. WOS shouldn't build a rules engine. Kernel has `invokeService` for calling OpenFisca, Catala, or any external decision engine. Formspec Shapes provide cross-field validation. FEL provides expressions. Decision requirements *declarations* (adopted above) are the right level — declaring which rules, not evaluating them |
| Content trust labeling | 2/5 | Nice-to-have but implicit. Pipeline stages already distinguish by type: agent invocation = untrusted, assertion gate = verified, human review = attested. Explicit labels add metadata without changing behavior |
| Evidence model as core data type | 1/5 | Real need, but Layer 1 sidecar for Phase 2/3, not a kernel or Phase 1 concern. The kernel's case state has typed fields; an evidence model (document refs with hashes, custody) is governance, not orchestration |
| Seven-layer concern-separation architecture | 2/5 | Every review independently validated the four-layer governance-proportional model over seven-layer concern-separation. Seven layers would require referencing all seven schemas for a complete document. Four layers serve the LLM-authoring test and human-first principle |
| FEEL over FEL | 2/5 | Not negotiable. WOS is a Formspec companion; FEL is Formspec's expression language. Research written without knowledge of the Formspec relationship |
| YAML over JSON | 2/5 | Not negotiable. Formspec is JSON-native. YAML's type ambiguity (Norway problem, boolean coercion) makes it a poor fit for schema-validated documents |
| Agent as kernel actor type | 1/5 | The human-first test governs. Kernel defines human + system; Layer 2 registers agent via `actorExtension` seam. A kernel-only deployment should not need to know what an "agent" is |

### 9.3 Architecture Validation

All five reviews independently validated:
- The four-layer hierarchy is correct over seven-layer or flat models
- FEL over FEEL given the Formspec relationship
- Agent in Layer 2, not kernel (human-first principle)
- The WOS architecture independently converges with the landscape survey's recommended "hybrid process + policy + task with Harel-first lifecycle" direction
- The human-first refinement (Layer 1 = Workflow Governance for human workflows, not AI Preparation) is an improvement the research did not articulate

### 9.4 Deferred for Future Phases

| Item | Phase | Notes |
|---|---|---|
| Evidence model sidecar (typed objects, versioning, integrity) | Phase 2-3 | Layer 1 sidecar, not kernel |
| XES/OCEL process mining export | Phase 3 | Semantic Profile |
| External policy engine bridge (XACML/OPA/Cedar) | Phase 2 | Integration Profile — wraps external engines into deontic evaluation pipeline |
| Delegation chain model (multi-agent accountability) | Phase 3 | Layer 3 |
| Merkle tree tamper evidence | Phase 3 | Optional audit sidecar or Semantic Profile |
| Formal soundness verification algorithms | Phase 3 | Kernel Complete conformance or Verification parallel seam |
| Simulation trace format | Phase 4 | Conformance testing companion |

---

## 10. Success Criteria

### Phase 1 (Kernel + Workflow Governance):

- [x] A kernel-only purchase order approval workflow (three states, two actors, no governance) validates without Layer 1 concepts
- [x] A pure-human, rights-impacting benefits adjudication workflow is fully expressible with Kernel + Layer 1. No AI layers needed
- [x] Due process, dual-blind review, separation of duties, data validation, and structured reasoning trace all work for human-only workflows
- [x] Rejection/remediation policies work for pipeline failures: a failed assertion gate routes to the correct remediation path
- [x] LLM-authoring gate passes for all three test workflows (benefits adjudication, procurement approval, FOIA) — schema-valid, lifecycle-correct, governance-correct
- [ ] `every`, `some`, `duration` implemented in Formspec — **OUTSTANDING: not yet implemented in Formspec codebase. Fallback to extension functions available.**
- [x] Temporal parameter resolution requirements documented in each layer's conformance section

### Phase 2 (AI Integration):

- [x] The Phase 1 benefits workflow extends with AI-assisted extraction WITHOUT changing the Kernel or Layer 1 documents
- [x] AI governance plugs into Layer 1 governance structures via the named seams
- [x] Deontic constraints evaluate against Formspec processor output
- [x] Agent disclosure appears in due process notices via Layer 1's existing notice mechanism
- [x] Review protocol suppression (independentFirst) works for both human recommendations and AI recommendations

### Phase 3 (Advanced AI):

- [x] At least one deontic constraint formally verified via SMT
- [x] Equity guardrails evaluate asynchronously without blocking
- [x] Constraint zones model a real case management scenario

---

## 11. Audit Findings — Resolved Design Decisions

*Added 2026-04-09 after wos-spec-author audit and design brainstorm. Sections 11.1-11.3 are resolved and integrated into the plan above. Sections 11.4-11.5 remain open.*

### 11.1 Lifecycle Topology — RESOLVED: Deterministic Pure Function

**Decision:** The kernel defines a deterministic evaluation algorithm. The lifecycle is a pure function of (current states × event × guards → next states). Two conformant processors given the same document and same events MUST produce the same state transitions.

**Specific behaviors the kernel owns:**

- **Branching:** Guards evaluated in document order, first satisfied guard wins
- **Parallel (fork/join):** Fork activates all branches simultaneously. Join fires when all branches reach a final state
- **Cancellation:** Policy on parallel states (cancel-siblings / wait-all / fail-fast)
- **Event matching:** Events that match a transition from current states fire it. Events that match no transition are recorded in provenance but do not change lifecycle state
- **Reentry:** Entering a state fires entry behavior regardless of prior visits. Context from prior visits lives in case state history

**What the kernel does NOT own:**

- **Timers:** Whether a timeout event is generated by a cron job, scheduler, or cloud function is infrastructure. The kernel reacts to timeout events like any other event
- **Full saga execution:** Compensation seam only (compensatingAction + compensable flag). Detailed execution semantics (reverse ordering, pivot steps) deferred to Lifecycle Detail companion

**Key separation:** Lifecycle state (where in the workflow) and case state (what data exists) are independent. Case state is an append-only log that grows regardless of lifecycle transitions. Events always affect case state (provenance). They only affect lifecycle state if they match a transition. This separation is what makes governance attachment clean — governance injects at transitions without touching the state machine's determinism.

**Impact on plan:** Kernel line estimate increased to ~600-800 (Section 4.1) to accommodate the evaluation algorithm. The Lifecycle Detail companion (Phase 3) covers advanced execution semantics, not the core algorithm.

### 11.2 Temporal Parameters — RESOLVED: Evaluation Context Enrichment

**Decision:** Temporal parameter resolution is a specific case of evaluation context enrichment, not a separate mechanism. No `temporalResolutionHook` kernel seam is needed.

**How it works:**

- The **kernel** defines that all FEL evaluation (guards, and any layer-injected expressions) happens in an evaluation context. The base context is a flat namespace of named variables (recovered from draft lineage v1→v5):

  | Variable | Source | Description |
  |----------|--------|-------------|
  | `caseFile` | Kernel | Current case file data |
  | `event` | Kernel | Triggering event data (transition guards and actions only) |
  | `task` | Kernel | Current task data (task-related expressions only) |
  | `instance` | Kernel | Workflow instance metadata (id, creation time, current state) |
  | `parameters` | Layer 1 | Temporal parameters, resolved to date-effective values |
  | `agent` | Layer 2 | Agent operational state including calibration metrics (agent policy expressions only) |
  | `output` | Layer 2 | Agent output being evaluated (deontic constraint and contract validation expressions only) |
  | `env` | Kernel | Implementation-defined environment variables |

  Layers enrich the context by adding their variables through seams — this is not an abstract mechanism, it is simply adding named entries to this table
- The **Policy Parameter Config sidecar** (Layer 1) declares date-indexed parameter values and their resolution date references — e.g., `eligibilityThreshold` resolves against the `applicationDate` case state field, while `appealDeadlineDays` resolves against `appealFilingDate`. Different parameters can resolve against different dates
- **Layer 1** resolves temporal values to their date-effective values and injects them into the evaluation context via `lifecycleHook`. By the time any FEL expression evaluates, the context already contains the correct values
- **Layer 2** uses the same mechanism to inject deontic constraint context
- The workflow author writes `income < eligibilityThreshold` — resolution is automatic

**Why this works:** The cross-layer coupling concern dissolves because it was never about temporal parameters specifically. It was about evaluation context enrichment, which the kernel must define for guards to work at all. Temporal resolution, deontic context, and any future layer-specific bindings all flow through the same mechanism.

**Impact on plan:** The temporal parameter runtime coupling note in Section 4.2 has been updated. The sidecar gains resolution date references per parameter (not just date-indexed values).

### 11.3 Kernel Seams — RESOLVED: Five Seams with Tag-Based Governance

**Decision:** Five kernel seams, down from seven. `reviewHook` and `qualityHook` dissolve under tag-based governance.

**The mechanism:** The kernel author tags transitions with semantic metadata (e.g., `"tags": ["determination", "review"]`). Governance documents declare rules that match on tags. Tag-based governance is the default; transition-specific rules are available as overrides.

**Example:** A Layer 1 document says "all transitions tagged `determination` require dual-blind review." This applies across the workflow without naming specific transitions. A transition-specific override says "the submit→approve transition in this workflow uses this specific reviewer pool."

**Why `reviewHook` and `qualityHook` dissolve:** Review protocols and quality controls are governance rules that match on transition tags — they're Layer 1 concepts, not kernel extension points. The kernel publishes tags; layers declare rules against them. One seam (`lifecycleHook`) handles all governance attachment.

**The five seams:** `actorExtension` (actor model), `contractHook` (data validation), `provenanceLayer` (audit trail), `lifecycleHook` (governance attachment via tags), `extensions` (escape hatch). See Section 2.2.

**Impact on plan:** Section 2.2 updated with five-seam table and tag-based governance explanation. Section 5 updated with transition tag column.

### 11.4 Missing Conventions — RESOLVED

- **`$wos*` document type markers:** `$wosKernel`, `$wosWorkflowGovernance`, `$wosAIIntegration`, `$wosAdvancedGovernance`, `$wosDueProcess`, `$wosAssertionLibrary`, `$wosPolicyParameters`, `$wosAgentConfig`, `$wosDriftMonitor`, `$wosEquityConfig`, `$wosVerificationReport`, `$wosIntegrationProfile`, `$wosSemanticProfile`, `$wosLifecycleDetail`.
- **Inter-document referencing:** `targetWorkflow` (URI matching kernel's `url`). Follows Formspec sidecar binding pattern. All layers and sidecars use the same mechanism.
- **Actor assignment in kernel-only deployments:** Implementation-defined (Kernel S3.4). The `assignTo` property on `createTask` provides a minimal mechanism.

### 11.5 Content Recovery Gaps — RESOLVED

Full audit of all 4 flagged draft files completed 2026-04-09. Results:

- **`wos-core-v6.md` appendices A-D, H-I** — Appendices A (JSON-LD), B (SHACL), E (Assist), F (SMT), G (DCR) already covered by delivered specs. **Appendix C (FEL Grammar Additions) explicitly rejected** in Kernel S7.4 with rationale. Appendix D (FEEL translation), H (patch operations) deferred to Integration Profile. **Appendix I (Standards Matrix) recovered** as Kernel Appendix A.
- **`wos-core-spec.md`** (3066 lines) — 11 of 21 sections already covered by delivered specs (layers 1-6 map to kernel, governance, AI integration). 4 sections deferred to future profiles (versioning, security, conformance scaffolding). **Standards relationship matrix (Appendix C) recovered** as Kernel Appendix A. Tamper evidence (Merkle tree) remains deferred per Section 9.4.
- **`wos-core-v3.md`** (1598 lines) — Core content (layers 1-4, actor model, due process) covered. JSON-LD processing semantics and RDF graph queries deferred to Semantic Profile. Standards matrix recovered.
- **`wos-agent-tier-v7.md`** (1428 lines) — Superseded by `wos-agent-tier-spec.md` and delivered AI Integration + Advanced Governance specs. **Three genuine gaps recovered:** (1) autonomy escalation/demotion algorithms → AI Integration S5.4-5.6, (2) guardrail composition semantics → AI Integration S4.7, (3) graceful degradation modes already covered by AI Integration S8 fallback chains. Standards matrix gaps folded into Kernel Appendix A.

---

## 12. Delivered Inventory

*Added 2026-04-09 after all Phases 1-3 + profiles + companion completed.*

### Specs (15 documents)

| Layer | Document | Path |
|-------|----------|------|
| L0 Kernel | Kernel Spec | `specs/kernel/spec.md` |
| L1 Governance | Workflow Governance Spec | `specs/governance/workflow-governance.md` |
| L1 sidecar | Due Process Config | `specs/governance/due-process-config.md` |
| L1 sidecar | Assertion Gate Library | `specs/governance/assertion-library.md` |
| L1 sidecar | Policy Parameter Config | `specs/governance/policy-parameters.md` |
| L2 AI | AI Integration Spec | `specs/ai/ai-integration.md` |
| L2 sidecar | Agent Config | `specs/ai/agent-config.md` |
| L2 sidecar | Drift Monitor Config | `specs/ai/drift-monitor.md` |
| L3 Advanced | Advanced Governance Spec | `specs/advanced/advanced-governance.md` |
| L3 sidecar | Equity Config | `specs/advanced/equity-config.md` |
| L3 sidecar | Verification Report | `specs/advanced/verification-report.md` |
| Profile | Integration Profile | `specs/profiles/integration.md` |
| Profile | Semantic Profile | `specs/profiles/semantic.md` |
| Companion | Lifecycle Detail | `specs/companions/lifecycle-detail.md` |

### Schemas (14)

| Schema | Path |
|--------|------|
| `wos-kernel.schema.json` | `schemas/wos-kernel.schema.json` |
| `wos-workflow-governance.schema.json` | `schemas/wos-workflow-governance.schema.json` |
| `wos-due-process.schema.json` | `schemas/wos-due-process.schema.json` |
| `wos-assertion-gate.schema.json` | `schemas/wos-assertion-gate.schema.json` |
| `wos-policy-parameters.schema.json` | `schemas/wos-policy-parameters.schema.json` |
| `wos-ai-integration.schema.json` | `schemas/wos-ai-integration.schema.json` |
| `wos-agent-config.schema.json` | `schemas/wos-agent-config.schema.json` |
| `wos-drift-monitor.schema.json` | `schemas/wos-drift-monitor.schema.json` |
| `wos-advanced.schema.json` | `schemas/wos-advanced.schema.json` |
| `wos-equity.schema.json` | `schemas/wos-equity.schema.json` |
| `wos-verification-report.schema.json` | `schemas/wos-verification-report.schema.json` |
| `wos-integration-profile.schema.json` | `schemas/wos-integration-profile.schema.json` |
| `wos-semantic-profile.schema.json` | `schemas/wos-semantic-profile.schema.json` |
| `wos-lifecycle-detail.schema.json` | `schemas/wos-lifecycle-detail.schema.json` |

### Conformance Fixtures (19)

| Fixture | Path | Purpose |
|---------|------|---------|
| Purchase Order Approval | `fixtures/kernel/purchase-order-approval.json` | Kernel-only smoke test |
| Benefits Adjudication (Kernel) | `fixtures/kernel/benefits-adjudication.json` | Full K+L1 workflow |
| Purchase Order Provenance | `fixtures/kernel/purchase-order-provenance.json` | Expected provenance trace |
| Invalid Documents | `fixtures/kernel/invalid-documents.json` | 8 expected rejections |
| Benefits Governance | `fixtures/governance/benefits-adjudication-governance.json` | L1 governance document |
| Benefits Policy Parameters | `fixtures/governance/benefits-policy-parameters.json` | Temporal parameters sidecar |
| Benefits AI Integration | `fixtures/ai/benefits-adjudication-ai.json` | L2 AI integration |
| Document Extractor Config | `fixtures/ai/document-extractor-config.json` | Agent config sidecar |
| Benefits Drift Monitor | `fixtures/ai/benefits-drift-monitor.json` | Drift monitor sidecar |
| Benefits Advanced Governance | `fixtures/advanced/benefits-advanced-governance.json` | L3 constraint zones + equity |
| Verification Report | `fixtures/advanced/verification-report.json` | SMT verification results |
| Benefits Equity Config | `fixtures/advanced/benefits-equity-config.json` | Equity monitoring sidecar |
| Integration Profile | `fixtures/profiles/integration-benefits-adjudication.json` | 7 binding types |
| Semantic Profile | `fixtures/profiles/semantic-benefits-adjudication.json` | JSON-LD + SHACL + PROV-O config |
| Lifecycle Detail | `fixtures/companions/benefits-lifecycle-detail.json` | Compensation + timer + SCXML config |
| LLM Test: Procurement | `fixtures/validation/procurement-approval-llm-test.json` | LLM-authoring gate |
| LLM Test: FOIA | `fixtures/validation/foia-kernel-llm-test.json` | LLM-authoring gate |
| LLM Test: FOIA Governance | `fixtures/validation/foia-governance-llm-test.json` | LLM-authoring gate |
| LLM Test: Benefits AI | `fixtures/validation/benefits-ai-llm-test.json` | LLM-authoring gate |

### Review History

| Phase | Verdict | Findings | Status |
|-------|---------|----------|--------|
| Phase 1 | APPROVE with warnings | 10 findings | All addressed |
| Phase 2 | APPROVE with warnings | 10 findings | All addressed |
| Phase 3 | REQUEST CHANGES (1 blocker) | 9 findings | All addressed |
| Accumulated fixes | REQUEST CHANGES (3 blockers) | 15 findings | All addressed |
| Integration Profile | REQUEST CHANGES (2 blockers) | 7 findings | All addressed |
| Semantic Profile | REQUEST CHANGES (1 blocker) | 8 findings | All addressed |
| Lifecycle Detail | REQUEST CHANGES (1 blocker) | 8 findings | All addressed |

### Outstanding Items

1. **FEL built-in functions** (`every`, `some`, `duration`) — Formspec core work, not WOS spec work. Fallback to extension functions available.
2. **Federation Profile** — Phase 4, not started.
3. **Learning Profile** — Phase 4, not started.
4. **Deferred items** (Section 9.4) — evidence model, Merkle tamper evidence, delegation chains, formal verification, simulation traces.
