# ADR 0076: Product-Tier Workflow Schema Consolidation

**Status:** Proposed
**Date:** 2026-04-25
**Scope:** WOS — schema family, release streams, spec organization
**Related:** [ADR 0073 (case initiation and intake handoff)](./0073-stack-case-initiation-and-intake-handoff.md); [ADR 0074 (governed output-commit pipeline)](./0074-governed-output-commit-pipeline.md); [ADR 0075 (rejection register)](./0075-rejection-register.md); [ADR 0077 (canonical kernel extension seams)](./0077-canonical-kernel-extension-seams.md); [ADR 0078 (foreach topology)](./0078-foreach-topology.md); [`wos-spec/schemas/wos-workflow.schema.json`](../../wos-spec/schemas/wos-workflow.schema.json); [`wos-spec/examples/`](../../wos-spec/examples/); [`wos-spec/counter-proposal-disposition.md`](../../wos-spec/counter-proposal-disposition.md); [`wos-spec/thoughts/2026-04-24-standards-absorption-gap-analysis.md`](../../wos-spec/thoughts/2026-04-24-standards-absorption-gap-analysis.md)

## Context

WOS today ships 27 JSON Schema files across `kernel/`, `governance/`, `ai/`, `advanced/`, `companions/`, `profiles/`, `sidecars/`, plus tooling. The four-document author-time model (`wos-kernel` + `wos-workflow-governance` + `wos-ai-integration` + `wos-advanced`) was rationalized as rights-proportional release streams. That framing is sound for **release** identity. It is wrong for **authoring** identity.

Three concrete failures of the four-document model:

- **AI single-shot generation requires 4–5 coherent files.** A capable LLM authoring a `rightsImpacting` workflow with AI agents must produce kernel + governance + AI integration + (optionally) advanced + sidecars, while maintaining `targetWorkflow` URI consistency, transition-tag agreement, and actor-id agreement across files. Schema validation cannot catch divergence between files.
- **Human reviewers cannot read a workflow end-to-end without paging between files.** The most load-bearing rules — due process, review protocols, agent deontic constraints — live in separate documents from the lifecycle they govern. The reviewer reconstructs coherence in their head.
- **The "optional sidecar" framing is wrong for governance.** Kernel §6 normatively requires governance for `rightsImpacting` and `safetyImpacting` workflows — every WOS primary use case (SBA PoC, benefits adjudication, permit review, fraud investigation). Calling governance "optional" markets the optional-tier model to people building `informational` workflows that aren't WOS's market. The schema does not enforce the requirement; the spec asserts it in prose.

Formspec's tiering pattern, distilled: **one document carries the business logic; everything that varies presentation, integration, or output is an optional satellite joined by a URL reference and a named key.** A Formspec `definition.schema.json` runs the form's data and logic with no satellites required. Themes, components, mappings, response schemas, validation reports — separate, optional, joined by url. Satellites MUST NOT alter core processing semantics.

Applied to WOS through three product-behavior tiers:

| Tier | Product behavior | Realistic size | Load-bearing concerns |
|---|---|---|---|
| **Forms+** | Intake form + thin routing/notification (Google-Forms-plus-approval) | ~30–80 lines | Lifecycle (trivial), actors (1–2), Formspec-backed intake |
| **DocuSign** | Multi-party signature workflow with order, identity, audit, expiry | ~200–500 lines | Lifecycle (real), actor roles, signature semantics, audit certificate |
| **Case management** | Multi-stage adjudication with AI assist, due process, statutory deadlines, signed determination, appeal | ~1500–4000 lines | Everything: governance, agents, advanced, signature, full provenance |

Across all three: the spine is *what data, who acts, what states, what rules, what outputs.* Five concepts. Everything else is opt-in. The spine cannot be split across files without forcing every tier to confront every file.

## Decision

### D-1. One author-time core schema

A single schema, `wos-workflow.schema.json`, is the WOS workflow author's artifact. It is sufficient on its own to specify any workflow at any tier. Sidecars are deployment-environment configuration; they do not carry workflow logic. The runtime executes a workflow given the core document plus, where deployed, its sidecars.

The merged schema replaces:

- `wos-kernel.schema.json` — absorbed.
- `wos-workflow-governance.schema.json` — absorbed as embedded `governance` block.
- `wos-ai-integration.schema.json` — agent declarations absorbed as embedded `agents[]`; framework-level oversight absorbed as `aiOversight`.
- `wos-advanced.schema.json` — absorbed as embedded `advanced` block.
- `wos-policy-parameters.schema.json` — inlined into `governance.policyParameters`.
- `wos-due-process.schema.json` — inlined into `governance.dueProcess`.
- `wos-assertion-gate.schema.json` — inlined into `governance.pipelines[*].stages[*]`.
- `wos-agent-config.schema.json` — inlined into per-agent `agents[]` declarations.
- `wos-drift-monitor.schema.json` — inlined into per-agent `driftMonitoring`.
- `wos-equity.schema.json` — inlined into `advanced.equity`.
- `wos-verification-report.schema.json` — author-time `verifiableConstraints` inlined into `advanced`; runtime certificate is a record kind in `wos-provenance-log`.
- `wos-assurance.schema.json` — absorbed as embedded `assurance` block.
- `wos-extension-registry.schema.json` — moved to tooling.
- `wos-integration-profile.schema.json` — normative `invokeService` binding surface absorbed into the merged schema; vendor adapter content moved to non-normative `docs/adapters/`.
- `wos-semantic-profile.schema.json` — split: transition-tag vocabulary stays kernel-owned (now lives in core); ontology export (JSON-LD, SHACL, PROV-O, XES/OCEL) moves to a renamed sidecar.
- `wos-signature-profile.schema.json` — absorbed as embedded `signature` block (signing order **is** the workflow for signature-gated lifecycles; load-bearing, not optional). Trellis custody binding stays sidecar.

### D-2. Behavior-driven embedded blocks

Seven optional embedded blocks. Each appears only when product behavior demands it. Each is self-contained — no cross-file references for what the workflow itself defines.

| Block | When required | What it owns |
|---|---|---|
| `governance` | `impactLevel` is `rightsImpacting` or `safetyImpacting` | Due process, review protocols, validation pipelines, task catalog, delegation, holds, policy parameters, escalation levels |
| `agents` | Any `actors[].type == "agent"` | Per-agent declarations: model identity, autonomy, deontic constraints (OASIS LegalRuleML names — `permission` / `prohibition` / `obligation` / `right`), confidence floor, fallback chain, capabilities, drift monitoring |
| `aiOversight` | Paired with `agents` (SHOULD); required when `agents` and `advanced` both present | Disclosure (EU AI Act Art. 13, OMB M-24-10), drift detection, volume constraints, narrative-tier templates |
| `signature` | Any transition gates on `kind: "signature"` | Signers, signing order, identity verification, consent text, reminders, void conditions, audit certificate |
| `custody` | Author opt-in (load-bearing whenever a workflow declares Trellis anchoring requirements) | Trellis custody posture, Trust Profile binding, anchor requirements per transition or signature event |
| `advanced` | Author opt-in | DCR constraint zones, equity guardrails, SMT verifiable constraints, circuit breaker, shadow mode |
| `assurance` | Author opt-in | Assurance level, attestation, subject continuity |

Block presence rules are JSON Schema `if/then` conditionals where expressible (e.g. `impactLevel → governance`); cross-reference rules (every agent actor has a matching `agents[]` entry; every signature-gated transition has a covering signer) are lint rules `WOS-AGENT-XREF-001` and `WOS-SIG-COVER-001`.

### D-3. True sidecars

Two sidecars survive. Each varies a single deployment-environment axis, joins core by `targetWorkflow` URI, and contains no workflow logic.

| Sidecar | Owns | Replaces |
|---|---|---|
| `wos-delivery.schema.json` | Business calendar (holiday rules, SLA definitions), notification templates (notice variables, channel config), correspondence metadata (document tracking) | `wos-business-calendar`, `wos-notification-template`, `wos-correspondence-metadata` |
| `wos-ontology-alignment.schema.json` | JSON-LD `@context`, SHACL shapes, PROV-O export, XES/OCEL mapping | `wos-semantic-profile` (renamed; transition-tag vocabulary returns to core) |

Test for inclusion: *if removing this document changes what the workflow does to a case, it is not a sidecar.* Calendar resolves SLAs but does not change determinations. Ontology alignment exports for interop but does not change determinations. Custody, by contrast, *does* change what the workflow does to a case (anchoring is load-bearing for any workflow that claims it) — moved to embedded blocks (D-2).

### D-4. Runtime artifact schemas

Two runtime schemas survive. Both describe artifacts produced by processors, not authored by workflow designers.

- `wos-case-instance.schema.json` — running-instance state: active tasks, case state, timers, pending events, governance state, volume counters. Moves to `schemas/kernel/` (the `companions/` directory disappears).
- `wos-provenance-log.schema.json` — append-only audit log, wrapping all record kinds: state-transition records, case-file snapshots, capability invocation records, signature affirmation records, mutation records (with `mutationSource` / `verificationLevel` per ADR 0074), iteration records (per ADR 0078), verification certificates (formerly `wos-verification-report` runtime half).

`FactsTierRecord`, `MutationSource`, `VerificationLevel`, `CaseFileSnapshot`, `CapabilityInvocationRecord` `$defs` move from the standalone `wos-provenance-record.schema.json` into the core `wos-workflow.schema.json` (the kernel owns their normative definition); the runtime log schema imports them via `$ref`. Higher-tier records (Reasoning, Counterfactual, Narrative) attach via the `provenanceLayer` seam (ADR 0077 §10.3) and live alongside whichever embedded block emits them.

### D-5. Tooling schema

One tooling schema absorbs lint diagnostics, conformance traces, synthesis traces, MCP tool catalog, and extension registry. These are consumed by tooling, never authored.

`wos-tooling.schema.json` replaces `wos-lint-diagnostic`, `conformance-trace`, `wos-synth-trace`, `wos-mcp-tools`, `wos-extension-registry`.

### D-6. Final schema family — 6 files

| Role | File |
|---|---|
| Author-time core | `wos-workflow.schema.json` |
| Sidecar | `wos-delivery.schema.json` |
| Sidecar | `wos-ontology-alignment.schema.json` |
| Runtime | `wos-case-instance.schema.json` |
| Runtime | `wos-provenance-log.schema.json` |
| Tooling | `wos-tooling.schema.json` |

27 → 6. Author writes one document; runtime produces two artifact types; deployment configures up to two sidecars; tooling consumes one schema.

### D-7. Single top-level version marker

The four-stream rights-proportional conformance model (ADR 0075 invariant I-8) is **unchanged**. What changes is *how* the stream identity is signalled.

The merged schema declares one top-level version marker: `$wosWorkflow`. Stream identity (governance, agents, signature, advanced, custody) is implicit in the workflow envelope version. Compliance claims compose as `$wosWorkflow@X.Y`; the version's semantics define what each embedded block means at that version. Per-stream conformance suites (T4 signature, governance pipelines, AI deontic constraints, advanced equity) run against the workflow envelope at the claimed version, not against independent stream versions.

Procurement narrative collapses to one number: "we comply with `$wosWorkflow@1.0`." The historical four-stream marketing claim ("`wos-kernel@1.0 + wos-governance@1.1`") translates to "`$wosWorkflow@1.0`" plus a one-paragraph "claims map" in `RELEASE-STREAMS.md` enumerating which embedded blocks are exercised in the claim.

This satisfies invariant I-8 (rights-proportional conformance claims) by replacing per-file version pinning with envelope-version pinning. T4 signature track stays operationally separate (its own conformance suite, its own roadmap) but ships its schema shape inside the workflow envelope at each version (Q11).

### D-8. Schemas merge; specs do not physically merge

Schema merge is in-scope. Spec merge is **not**. `kernel/spec.md`, `governance/spec.md`, `ai/ai-integration.md`, `advanced/spec.md` stay as separate physical documents with their existing §-numbering preserved. This protects every existing citation ("Kernel §10.3 contract validation," "Governance §6.2 due process," "AI Integration §3.3 capability declaration") from anchor breakage at v1.0.

What moves at the spec layer:

- Existing Kernel §11 (Contract Validation) → §6 of `kernel/spec.md` (adjacent to Case State within the same document).
- Existing Kernel §12 (Separation Principles) → §2 of `kernel/spec.md`.
- Existing Kernel §13 (Conformance Fixtures) → out of normative spec, into `crates/wos-conformance/README.md`.
- Runtime Companion content (CaseInstance serialization, evaluation modes, Formspec coprocessor protocol, durability guarantees, timer precision, multi-version coexistence, action execution) → kernel chapters §11–§13 and §9.x expansions **within `kernel/spec.md`**.
- Lifecycle Detail Companion content (transition evaluation pseudocode, history states, parallel execution, compensation, timer lifecycle) → kernel §4.6/§4.7/§4.8/§4.14, §9.5, §9.7 **within `kernel/spec.md`**.
- Integration Profile normative content (`invokeService` binding surface, CloudEvents extension attributes, correlation rules, idempotency, execution ordering) → kernel §9.2 **within `kernel/spec.md`**.
- Companions directory deleted (`specs/companions/`, `schemas/companions/`).
- Profiles directory split: signature absorbed into core `signature` embedded block; semantic renamed to ontology-alignment sidecar; integration normative content → `kernel/spec.md`, vendor content → `docs/adapters/`.

What every spec document gains: schema references update from per-stream schemas (`wos-kernel.schema.json`, `wos-workflow-governance.schema.json`, etc.) to the merged `wos-workflow.schema.json`. The spec text describing each slice still lives in its own file; only the schema citation target changes.

What every spec document keeps: its filename, its top-level numbering scheme, every existing §-anchor that didn't move. The owner ratified this explicitly — "schemas can merge, specs don't need to physically merge" — to preserve external citation validity.

### D-9. Examples define the tier ladder

Three reference examples in `wos-spec/examples/` test the ladder:

- `timeoff.workflow.json` — Forms+ tier. ~30 lines. No governance, no agents, no signature, no advanced. Validates the "scale-down" claim.
- `nda.workflow.json` — DocuSign tier. ~85 lines. Embedded `signature` block; no governance, no agents, no advanced. Validates the load-bearing-signature claim.
- `benefits-adjudication.workflow.json` — Case management tier. ~600 lines (representative, not exhaustive). Every embedded block present. Validates the "scale-up" claim.

The examples are the conformance proof for D-2. If a tier cannot express its product behavior at its natural size against the merged schema, the schema is wrong.

### D-10. Seam architecture is preserved

The six canonical kernel seams (ADR 0077: `actorExtension`, `contractHook`, `provenanceLayer`, `lifecycleHook`, `custodyHook`, `extensions`) are unchanged. Inlining governance, agents, signature, and advanced into the core schema does not alter how higher-layer concerns attach. Governance still attaches to transitions via `lifecycleHook` (semantic `tags`); contracts still attach via `contractHook`; provenance tiers still attach via `provenanceLayer`; Trellis still attaches via `custodyHook`. Embedded-block presence changes the document's surface area, not its extensibility model.

## Consequences

**Positive.**

- **Single-shot AI authoring.** One schema, one document, one generation context. No cross-file URI maintenance.
- **Coherent human review.** Reviewer reads one document end-to-end to understand what a workflow does, who acts, under what governance, with what AI oversight.
- **Cross-document coherence becomes free.** Class of bugs where governance references a transition tag missing from the kernel, or where AI integration declares an agent that has no actor entry, is eliminated at schema-validation time.
- **Behavior-driven tiering is enforceable.** `impactLevel = rightsImpacting → governance required` is a schema rule. The spec no longer asserts a relationship the schema cannot enforce.
- **Reference implementation simplification.** The `wos-core` library stops carrying cross-document resolution for the common case. Resolution remains only for true sidecars.
- **27 → 7 schemas.** Tooling, lint, conformance, and version management all simplify.

**Negative.**

- **Merged schema is large.** Kernel-only is ~1834 lines today; the merged author-time schema reaches ~4000 lines including governance, agents, signature, advanced. Schema editors, intellisense, and `*.llm.md` generation handle this; not a blocker but real work.
- **Procurement story is slightly harder.** "We comply with `wos-governance@1.0`" was clean. "We implement `governance` block at `$wosGovernance@1.1` semantics within `$wosWorkflow@1.0`" is harder for a procurement checklist. Mitigation: publish a one-paragraph "claims map" that translates between the version-marker form and the historical multi-document form.
- **Governance-only / AI-only tooling cannot exist.** Any tool touching governance or agents must understand the full workflow schema. Real governance lint already needs kernel context, so this is not a practical loss — but worth surfacing.
- **All current `$wosKernel` / `$wosWorkflowGovernance` / `$wosAIIntegration` / `$wosAdvanced` document markers retire.** No production users; cheap now, expensive post-1.0.

**Neutral.**

- **Seam architecture unchanged.** ADR 0077's six seams are intact.
- **Determinism unchanged.** Kernel §4.2 deterministic-evaluation guarantee lives in the algorithm, not the document boundary.
- **Trellis boundary unchanged.** WOS still emits provenance; Trellis still anchors via `custodyHook`. The custody encoding sidecar still joins by url.
- **Rights-proportional compliance preserved.** I-8 (ADR 0075) claims survive via top-level version markers in the merged document.
- **Sidecars remain composable additions.** Calendar, ontology, custody encoding still join by url; deployment can add or remove them without changing the workflow.

## Implementation plan

Numbered for tracking. Lands on a `workflow-consolidation` branch (replacing the previous `kernel-restructure` branch).

1. **Land merged schema sketch.** `wos-spec/schemas/wos-workflow.schema.json` — illustrative version published alongside this ADR. Examples in `wos-spec/examples/`.
2. **Land full merged schema.** Promote sketch to full normative schema with complete `$defs`, lint-rule cross-references, and `x-lm.critical` annotations on load-bearing nodes.
3. **Spec absorption pass.** Per-spec schema references update to `wos-workflow.schema.json`. `kernel/spec.md` absorbs Runtime Companion + Lifecycle Detail Companion content (D-8 list); existing §11/§12/§13 renumber within `kernel/spec.md`. Integration Profile normative content lands in `kernel/spec.md` §9.2. `governance/spec.md`, `ai/ai-integration.md`, `advanced/spec.md` stay separate physical documents — only their schema references change. Existing §-numbering preserved across all four documents; external citations (e.g. "Kernel §10.3") remain valid.
4. **Sidecar split.** Land `wos-delivery.schema.json` (merging calendar + templates + correspondence). Rename `wos-semantic-profile.schema.json` → `wos-ontology-alignment.schema.json`. Migrate transition-tag vocabulary back into `kernel/spec.md`. **Custody promotes to embedded `custody` block; `wos-custody-hook-encoding.schema.json` deleted.**
5. **Runtime artifact migration.** Move `wos-case-instance.schema.json` and `wos-provenance-record.schema.json` to `schemas/`. Rename provenance-record → `wos-provenance-log.schema.json`. Promote `FactsTierRecord` / `MutationSource` / `VerificationLevel` / `CaseFileSnapshot` `$defs` into core schema; runtime log imports via `$ref`.
6. **Tooling consolidation.** Merge `wos-lint-diagnostic`, `conformance-trace`, `wos-synth-trace`, `wos-mcp-tools`, `wos-extension-registry` into `wos-tooling.schema.json`. Add `$views` declarations (Q3 owner decision: tooling-schema sub-views, not core-schema annotations).
7. **Profiles deletion.** Delete `specs/profiles/integration.md` (normative content moved to `kernel/spec.md`; vendor content to `docs/adapters/`). Delete `specs/profiles/semantic.md` (renamed). Delete `specs/profiles/signature.md` (absorbed into core `signature` block; T4 conformance suite stays separate per Q11).
8. **Companions deletion.** Delete `specs/companions/` and `schemas/companions/` directories.
9. **CLAUDE.md and README updates.** `wos-spec/CLAUDE.md` Schema-structure section. `wos-spec/README.md` Specification inventory + "How the layers work" + "What to adopt" + release-stream paragraph. `RELEASE-STREAMS.md` and `COMPATIBILITY-MATRIX.md` rewrite to single `$wosWorkflow` marker plus claims-map paragraph.
10. **Disposition and gap-analysis follow-up.** `wos-spec/counter-proposal-disposition.md` §"Artifact taxonomy" already shortened to a pointer at this ADR. `wos-spec/thoughts/2026-04-24-standards-absorption-gap-analysis.md` §"Refactor Target" item 1 (governed work activation) and item 2 (governed output commit) land into the merged schema's `bindings[]` and seam attachments.
11. **Conformance fixture migration.** Rename markers in conformance fixtures: `$wosKernel` / `$wosWorkflowGovernance` / `$wosAIIntegration` / `$wosAdvanced` → `$wosWorkflow`. Compatibility shim in `wos-conformance` accepts old document markers for one minor version, fails with deprecation diagnostic. T4 conformance suite reads `$wosWorkflow` envelope, asserts signature-block invariants — bundle stays separate per Q11.
12. **Lint rule reanchoring.** `LINT-MATRIX.md` rule I-001 reanchors to `kernel/spec.md` §9.2; `WOS-AGENT-XREF-001` and `WOS-SIG-COVER-001` registered as new lint rules enforcing block-presence cross-references. `WOS-VER-LEVEL-NN` registered to warn when `fallbackChain` declared without `verificationLevel` (Q6 owner decision).

Sequencing: 1 lands now (this ADR + sketch + examples). 2–8 land on the consolidation branch as one structural pass. 9–12 land in follow-up commits on the same branch. The branch merges as one unit; no production users, no compatibility shim past one minor version.

## Decisions made (closing prior open questions)

- **Q1 — Schemas merge, specs don't.** Owner decision 2026-04-25. `kernel/spec.md`, `governance/spec.md`, `ai/ai-integration.md`, `advanced/spec.md` stay as separate physical documents with existing §-numbering preserved. Only the schema references update. See D-8.
- **Q2 — Single top-level version marker.** Owner decision 2026-04-25. Only `$wosWorkflow`. See D-7. Per-stream conformance suites (T4 signature etc.) operate against the workflow envelope at the claimed version.
- **Q3 — Tooling sub-views in `wos-tooling.schema.json`.** Owner decision 2026-04-25. Core schema does not carry `$views`; tooling schema does. See implementation plan step 6.
- **Q4 — Custody is embedded.** Owner decision 2026-04-25. `custody` joins governance/agents/aiOversight/signature/advanced/assurance as an embedded block. `wos-custody-hook-encoding.schema.json` deleted in step 4. See D-2.

## Open questions

None outstanding for this ADR. Cross-cutting follow-ups tracked separately:

- **Formspec ↔ WOS native intake handoff.** Q10 owner decision 2026-04-25 — Formspec emits `IntakeHandoff` natively when targeting a WOS workflow. Cross-spec change; ADR amendment to ADR 0073 or a new Formspec-side ADR. Tracked in PLANNING.md.
- **Shared coercion library across all six surfaces.** Q5 owner decision 2026-04-25 — `fel-core::coerce` used by `commit_external_output`. Tracked in ADR 0074 implementation plan + PLANNING.md.
