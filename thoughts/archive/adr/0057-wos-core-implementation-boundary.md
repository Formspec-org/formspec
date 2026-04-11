# ADR-0057: WOS Core vs. Implementation Boundary

**Status:** Accepted
**Date:** 2026-04-10
**Author:** Mike (TealWolf Consulting LLC)
**Applies to:** wos-core, wos-lint, wos-conformance, future WOS runtime adapters

---

## Context

The WOS spec suite (16 specs, 16 schemas, 187 normative constraints) defines workflow orchestration semantics. A Rust toolchain is being built: `wos-lint` for static analysis, `wos-conformance` for behavioral testing, and `wos-core` for the shared domain model and evaluation algorithm.

Five real-world deployment scenarios were analyzed: state Medicaid eligibility, insurance claims AI adjudication, federal cross-agency grants, hospital care protocols under EU AI Act, and fintech AI underwriting. Each scenario needs capabilities beyond what WOS currently defines — instance persistence, multi-user concurrency, federated state, access control, report generation, domain-specific type adapters.

The central question: **which of these capabilities belong in the WOS specification and core engine, and which belong in deployment-specific implementation adapters?**

The wrong answer creates one of two failure modes:
- **Too much in core:** WOS becomes a framework that prescribes deployment architecture, making it unusable for organizations that don't match its assumptions. A hospital using Epic can't adopt WOS if it requires DynamoDB.
- **Too little in core:** Every deployment reinvents concurrency semantics, instance serialization, and explanation assembly. Two "WOS-conformant" processors produce different results for the same document and events because the spec left behavioral questions to implementors.

---

## Decision

We draw the boundary using a single test:

> **Does a difference in this behavior make two processors produce different observable outcomes for the same document and event sequence?**

If YES, it's a core engine concern — the spec must define it, and `wos-core` must implement it. If NO, it's an implementation adapter — `wos-core` defines a trait interface, and deployments provide concrete implementations.

### Core engine concerns (wos-core owns)

These are behavioral semantics where divergent implementations would break interoperability or correctness.

**1. CaseInstance shape.**

The structure of runtime instance data — active state configuration, case file snapshot, provenance log position, timer state — must be defined by `wos-core` so instances can migrate between processors. If Processor A serializes active states as `["review", "substate"]` and Processor B expects `{"primary": "review", "nested": "substate"}`, migration fails silently.

```rust
pub struct CaseInstance {
    pub id: String,
    pub definition_url: String,
    pub definition_version: String,
    pub configuration: Configuration,
    pub case_state: HashMap<String, Value>,
    pub provenance: ProvenanceLog,
    pub timers: Timers,
    pub created_at: String,
    pub updated_at: String,
}
```

**2. Concurrency semantics.**

The deterministic evaluation algorithm (Kernel S4.2) requires that events are processed one at a time per instance. This is a correctness requirement, not an implementation suggestion. Two concurrent events on the same instance must be serialized — the spec must state this normatively, and the core engine must enforce it via its API (e.g., `&mut self` on `process_event` prevents concurrent calls at the type level).

Multiple actors *appending* to case state is safe (append-only, Kernel S5.4). Multiple actors *triggering events* must be serialized through a queue. The core engine defines the serialization requirement; the implementation provides the queue.

**3. Async action model.**

Whether `invokeService` actions within a parallel state execute concurrently or sequentially affects observable provenance ordering. The spec must declare:
- Actions within a single state's `onEntry`/`onExit` execute sequentially in document order.
- Actions across parallel regions MAY execute concurrently (the processor is not required to parallelize, but must produce equivalent provenance regardless of execution order).

This is a spec concern because provenance ordering is observable. The core engine exposes an `ActionExecutor` trait that implementations can fulfill synchronously or asynchronously.

**4. Conditional governance scoping.**

"For cases in California, apply additional disclosure requirements" is governance semantics, not deployment configuration. The governance document needs a scoping mechanism: a FEL guard expression on governance rule applicability.

```json
{
  "reviewProtocols": [{
    "tags": ["determination"],
    "protocols": ["independentFirst"],
    "scope": "caseFile.state = 'CA' or caseFile.state = 'NY'"
  }]
}
```

This is core because the scoping expression participates in the deterministic evaluation — different processors must agree on which governance rules apply to which cases.

**5. Case relationship event semantics.**

Currently, case relationships are metadata-only (Kernel S5.5). The correlationKey mechanism (Kernel S9.4) handles cross-case events, but there's no standard for *which* events a related case should receive. Define standard relationship-triggered events:

- `$related.stateChanged` — fired when a related case transitions
- `$related.resolved` — fired when a related case reaches a final state
- `$related.holdReleased` — fired when a related case exits a hold state

These are kernel-generated events (following the `$` prefix convention from S4.10) that the processor emits based on relationship declarations. Core, because they affect lifecycle evaluation.

**6. Explanation assembly interface.**

How Reasoning tier facts and Counterfactual tier data compose into an explanation is a spec concern — the assembly algorithm must be deterministic so two processors produce the same explanation from the same provenance. Define:

- Which Reasoning tier entries are included (all, or filtered by the governance document's `explanationScope`)
- The ordering of explanation elements (chronological, by rule authority, by impact)
- How positive and negative counterfactuals are formatted

The rendered format (PDF, HTML, plain text) is implementation. The assembled content structure is core.

**7. Streaming evaluation mode.**

For scenarios where upstream data changes continuously (clinical decision support, real-time fraud detection), the engine must support a mode where guards are re-evaluated when case state changes, not only on discrete events. Define:

- `continuous` mode: after any `setData` mutation, the engine re-evaluates all guards in the current configuration and fires any newly-enabled transitions
- `event-driven` mode (default): guards are only evaluated when an explicit event arrives

This is core because it changes which transitions fire and when — observable behavioral difference.

### Implementation adapter concerns (traits in wos-core, fulfilled by deployments)

These are infrastructure decisions that don't affect the evaluation algorithm's observable behavior. `wos-core` defines trait interfaces; each deployment provides concrete implementations.

**Instance persistence:**

```rust
/// Where workflow instances are stored between events.
pub trait InstanceStore: Send + Sync {
    fn load(&self, instance_id: &str) -> Result<CaseInstance, StoreError>;
    fn save(&self, instance: &CaseInstance) -> Result<(), StoreError>;
    fn list_by_state(&self, state_id: &str) -> Result<Vec<String>, StoreError>;
}
```

Implementations: `InMemoryStore` (conformance tests), `PostgresStore`, `DynamoStore`, `TemporalStore`.

**Document resolution:**

```rust
/// Where WOS documents (kernel, governance, sidecars) are loaded from.
pub trait DocumentResolver: Send + Sync {
    fn resolve_kernel(&self, url: &str) -> Result<KernelDocument, ResolveError>;
    fn resolve_sidecar(&self, url: &str, anchor_date: Option<&str>) -> Result<Value, ResolveError>;
}
```

Implementations: `FileResolver` (local JSON files), `GitResolver`, `S3Resolver`, `RegistryResolver`.

**Contract validation (Formspec coprocessor):**

```rust
/// Validates data against a Formspec Definition or JSON Schema contract.
pub trait ContractValidator: Send + Sync {
    fn validate(&self, contract_ref: &str, data: &Value) -> ValidationResult;
}

pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<ValidationError>,
}
```

Implementations: `StubValidator` (conformance fixtures declare outcomes), `FormspecValidator` (calls `formspec-eval`), `JsonSchemaValidator`.

**Access control:**

```rust
/// Controls which actors can see and do what.
pub trait AccessControl: Send + Sync {
    fn can_read(&self, actor: &str, field_path: &str) -> bool;
    fn can_transition(&self, actor: &str, transition: &Transition) -> bool;
    fn can_delegate(&self, delegator: &str, delegate: &str, scope: &DelegationScope) -> bool;
}
```

Implementations: `NoAccessControl` (conformance tests), `OpaAccessControl`, `CedarAccessControl`, `RbacAccessControl`.

**External service execution:**

```rust
/// Fulfills invokeService actions.
pub trait ExternalService: Send + Sync {
    fn invoke(&self, service_ref: &str, input: &Value, idempotency_key: Option<&str>) -> Result<Value, ServiceError>;
}
```

Implementations: `StubService` (conformance fixtures), `HttpService`, `PlaidAdapter`, `FhirAdapter`.

**Report generation:**

```rust
/// Renders provenance and case state into human-readable formats.
pub trait ReportRenderer: Send + Sync {
    fn render_explanation(&self, reasoning: &[ProvenanceRecord], counterfactual: &[ProvenanceRecord], template: &str) -> Result<String, RenderError>;
    fn render_audit(&self, provenance: &ProvenanceLog, format: ReportFormat) -> Result<Vec<u8>, RenderError>;
}
```

Implementations: `PdfRenderer`, `HtmlRenderer`, `HmdaExporter`, `XesExporter` (Semantic Profile).

**Provenance signing:**

```rust
/// Signs and verifies provenance records for cross-org trust.
pub trait ProvenanceSigner: Send + Sync {
    fn sign(&self, record: &ProvenanceRecord) -> Result<SignedRecord, SignError>;
    fn verify(&self, signed: &SignedRecord) -> Result<bool, SignError>;
}
```

Implementations: `NoSigning` (single-org), `PkiSigner`, `JwsSigner`.

---

## Consequences

### Architecture

The `wos-core` crate becomes the dependency inversion point:

```text
wos-core
├── model/        — typed document models (KernelDocument, State, Transition, ...)
├── eval.rs       — deterministic evaluation algorithm
├── instance.rs   — CaseInstance type
├── provenance.rs — ProvenanceKind enum, ProvenanceLog
├── context.rs    — FEL evaluation context builder
├── timer.rs      — timer lifecycle
├── project.rs    — multi-document project
├── explain.rs    — explanation assembly algorithm
└── traits/       — InstanceStore, DocumentResolver, ContractValidator,
                    AccessControl, ExternalService, ReportRenderer, ProvenanceSigner
```

Downstream crates provide concrete adapters:

```text
wos-conformance  → InMemoryStore + FileResolver + StubValidator + StubService
wos-lint         → typed models + project (no runtime traits needed)
wos-temporal     → TemporalStore + S3Resolver + FormspecValidator + HttpService  (future)
wos-lambda       → DynamoStore + S3Resolver + FormspecValidator + HttpService    (future)
```

### Spec impact

Seven normative additions to the spec suite:

1. **CaseInstance serialization format** — new section in Kernel spec or a companion document defining the JSON shape of a serialized instance.
2. **Concurrency statement** — normative statement in Kernel S4.2: "Events MUST be processed serially per instance. Concurrent event delivery MUST be serialized by the processor."
3. **Async action semantics** — normative statement in Kernel S9.2: "Actions within a single state execute sequentially in document order. Actions across parallel regions MAY execute concurrently; provenance MUST record the actual execution order."
4. **Governance scoping** — new `scope` property on governance rule bindings (ReviewProtocolBinding, DueProcess, HoldPolicy) accepting a FEL guard expression.
5. **Relationship-triggered events** — new kernel-generated events (`$related.stateChanged`, `$related.resolved`) added to S4.10.
6. **Explanation assembly** — new section defining how Reasoning + Counterfactual tiers compose into structured explanations.
7. **Evaluation mode** — new `evaluationMode` property on the kernel document (`event-driven` or `continuous`).

### Risks

- **Trait proliferation.** Seven traits is a lot of wiring for a simple deployment. Mitigate with a `DefaultRuntime` struct that bundles `InMemoryStore + FileResolver + NoAccessControl + StubService` for quick starts.
- **Explanation assembly complexity.** Defining a deterministic assembly algorithm for human-readable explanations is genuinely hard. The ordering and filtering rules will require iteration with real regulatory reviewers. Start with a simple chronological assembly and refine.
- **Streaming evaluation mode.** Re-evaluating all guards on every data change could create infinite loops (setData in onEntry triggers re-evaluation which fires a transition whose onEntry does another setData). Mitigate with the same convergence cap used by Formspec's processing model (100 iterations).

---

## Alternatives Considered

**Alternative 1: Everything in core.** Define instance persistence, access control, and report generation as spec constructs. Rejected because it would make WOS a framework, not a specification. A hospital using Epic can't adopt WOS if it mandates DynamoDB.

**Alternative 2: Everything as implementation.** Define no traits; let each deployment figure it out. Rejected because instance serialization, concurrency semantics, and explanation assembly require interoperability guarantees. Two "WOS-conformant" processors that produce different explanations from the same provenance are not conformant.

**Alternative 3: Separate spec for runtime concerns.** Create a "WOS Runtime Specification" distinct from the orchestration spec. Initially deferred, then **adopted** — the WOS Runtime Companion (`wos-spec/specs/companions/runtime.md`, 717 lines) was written to formalize the behavioral contracts identified in this ADR. The companion covers: CaseInstance serialization (S3), event delivery (S4), action execution (S5), durability guarantees (S6), timer management (S7), governance enforcement (S8), explanation assembly (S9), evaluation modes (S10), multi-version coexistence (S11), host interfaces (S12), security model (S13), and relationship-triggered events (S14). Several normative statements from the companion still need backporting to the kernel and governance specs (see `wos-spec/TODO.md`).

---

## References

- WOS Kernel Specification v1.0, S4.2 (deterministic evaluation), S5.4 (append-only case state), S9.4 (correlation keys), S4.10 (kernel-generated events)
- WOS Lifecycle Detail Companion, S2 (transition evaluation algorithm)
- WOS Runtime Companion, `wos-spec/specs/companions/runtime.md` — implements the runtime behavioral contracts defined in this ADR (Alternative 3 is no longer deferred)
- WOS TODO, `wos-spec/TODO.md` — actionable work items derived from this ADR's normative additions and architecture
- WOS Verification Matrix, `wos-spec/LINT-MATRIX.md` — 187 normative constraints with tier assignments
- Scenario analysis: Medicaid eligibility, insurance claims, federal grants, hospital care protocols, fintech underwriting
- Formspec CLAUDE.md: "Architecture over code — spend your thinking time on where the seams go"
