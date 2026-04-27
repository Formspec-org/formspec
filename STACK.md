---
title: The Stack — Formspec + WOS + Trellis
description: >
  Top-level integrative document for the three specifications that compose into
  one JSON-native, LLM-authorable, provenance-sealed stack for rights-impacting
  work. Conceptual — explains what the stack is, why it has the shape it does,
  how the layers compose, and where a reader goes for technical detail. Numbers,
  identifiers, file paths, version strings, and per-project status deliberately
  live in each subproject's own README / TODO, not here.
audience:
  - New contributors orienting across Formspec, WOS, and Trellis at once
  - AI agents needing shared cross-project context
  - Partners, procurement evaluators, and investors on first read
scope: conceptual and integrative — implementation truth lives in each project
status: living document — update when layer boundaries, contracts, or deploy posture change
---

# The Stack — Formspec + WOS + Trellis

Three JSON-native specifications compose one portable case record: what was collected (Formspec), how the decision was governed (WOS), and what survives when the system is gone (Trellis). Authored by LLMs. Governed by declared rules. Sealed by provenance that does not depend on the vendor staying alive.

- **[Formspec](README.md)** — the intake layer.
- **[WOS](wos-spec/README.md)** — the governance layer.
- **[Trellis](trellis/README.md)** — the integrity layer.

Each layer is independently useful and independently conformance-checkable. Together they describe one signed, offline-verifiable case record for a governed decision, including intake data, workflow provenance, evidence bindings, identity and signature attestations, amendments, clock state, and migration pins where the workflow requires them.

This document is conceptual. It explains what the stack *is* and *how it thinks*. Counts, file paths, ratification gates, version strings, and per-project status belong in each project's own README, TODO, and ratification documents. Every technical claim points there.

---

## End-state commitments

The stack's target state is not three adjacent artifacts. It is one portable case record a third party can verify without the original vendor runtime.

Seven commitments follow from that target:

1. **Independent verification.** A serious stack claim must reduce to published semantics, schemas or byte grammars, vectors, and verifier behavior. A live dashboard is useful product surface, not proof.
2. **One case record.** For a governed case, canonical response, respondent ledger, governance events, integrity checkpoints, evidence, identity, signatures, amendments, statutory clocks, and migration pins compose into one verifier-understandable artifact set.
3. **One meaning of signing.** Intake evidence may capture a click or authored response, but the stack-level meaning of "signed" flows through WOS signature semantics and Trellis custody/export verification.
4. **Ledger-visible workflow truth.** Durable engines may orchestrate and retry, but decisions, stalls, resumes, compensation, overrides, and policy-relevant transitions must be visible in exported evidence when they affect the case.
5. **Custody-honest privacy.** Encryption, key destruction, selective disclosure, metadata minimization, and identity separation must match what operators can decrypt and what verifiers can still prove.
6. **Product sequencing cannot weaken the center.** Demos, SaaS onboarding, and procurement packages may ship in practical order, but they cannot introduce rival semantics for proof, signing, custody, or governance.
7. **Data-and-workflow zero trust is the architectural posture.** Server processes never hold case content plaintext at rest; per-class encryption keyed to client-held authenticators (WebAuthn PRF for respondents, hardware tokens / OIDC-mediated wrapped keys for staff); two-layer access (relationship-based authorization gates the metadata, key-bag membership gates the content). Three deployment modes — SBA (audited server-side decryption fallback), Federal (TEE-attested processing), Sovereign (respondent client-origin keys) — declared per deployment, with declaration matching observable behavior. NIST SP 800-207, CISA ZTMM v2.0 Data pillar, OMB M-22-09, FedRAMP rev5 cross-reference cleanly.

These commitments are architectural. Concrete storage engines, witness services, identity providers, workflow engines, and legal postures remain adapters unless a spec promotes them with vectors and conformance behavior.

Not every inbound submission is already a governed case. The stack distinguishes three related objects:

- **Submission** — the raw inbound artifact: canonical response, validation result, and intake evidence.
- **Intake record** — the first-class handling object created when the platform acknowledges a submission and takes responsibility for what happens next.
- **Governed case** — the subset of intake records accepted into WOS-managed identity, lifecycle, provenance, and, where applicable, Trellis-backed export.

A simple product may stop at the intake-record layer. A deeper workflow may promote the intake record into a governed case or attach it to an existing governed case. The portable case-record commitment applies to the governed-case layer, not to every inbound artifact by default.

---

## The three layers

### Formspec — intake

A specification for collecting structured data with behavior. Fields, validation, computed values, conditional logic, repeat groups, cross-field constraints — all expressed as JSON documents backed by a schema. One definition runs identically everywhere it needs to: browser, server, mobile. Designed first for LLM authoring: the schema constrains generation, a linter gives structural feedback in seconds, a conformance suite gives behavioral feedback. Companion specs separately address theme, components, mapping to downstream formats, screening, locale, ontology, references, assist, and a respondent-side audit ledger.

### WOS — governance

A specification for the governance layer of rights-impacting workflows — benefits adjudication, permit reviews, claims, fraud investigations. It does not replace the workflow engine; it runs on top of whatever durably executes the process. What it adds is the governance semantics no engine covers: constraints on AI agents, structured human review protocols, due-process requirements, authority-ranked reasoning traces, and a separation of verified fact from AI-generated narrative in the provenance record.

### Trellis — integrity

A cryptographic specification for making the record portable and durable. Content-addressed, signed events; sealed checkpoints; export bundles that verify offline without access to the original system. Identity-decoupled: pseudonymous continuity references carry the audit chain while identity proofing attaches separately through provider-neutral adapters. The audit chain tracks continuity and integrity of respondent activity; it does not require every event to embed legal identity directly, and it does not collapse explicit signing attestation into ordinary event continuity. Anchoring to external trust substrates is pluggable.

**Phased arc (conceptual).** Near term, the integrity story is **attested exports** — a signed bundle and a verifier that do not depend on the vendor runtime. Later phases add **runtime-time attestation** on every write, a **portable case ledger** that composes sealed intake heads with governance events, and optional **federation / witness** tiers (transparency-log-class anchors such as OpenTimestamps, Sigstore Rekor, or tile-based logs) for third-party consistency — without replacing the three-layer separation above. The envelope is designed so later phases are **strict supersets** of the export shape, not parallel byte religions. Detail and gate vocabulary live in [Trellis product vision](trellis/thoughts/product-vision.md) and the [stack-wide vision model](.claude/vision-model.md).

### The Respondent Ledger bridge

A Formspec companion specifies *what* events a respondent-facing audit chain records and declares the abstract integrity seams Trellis fills. The Respondent Ledger says *what*; Trellis says *how it survives*. Identity attestations and authored signatures can be attached to that chain, but they remain separate claims: continuity of activity, proof of identity, and explicit consent-to-content are different contracts. Without Trellis the ledger is a logical event stream; with Trellis it becomes a signed, offline-verifiable record.

---

## Why three specs, not one

Three different failure modes require three different specifications.

**Intake fails** when the data is ambiguous, inconsistent across runtimes, or impossible to re-verify on the server with the same semantics the browser used.

**Governance fails** when a decision affecting someone's rights was made without an appeal path, without an authority trace, without distinguishing a verified fact from an AI-generated narrative, or without a structural guarantee that the human formed judgment before seeing the machine's.

**Integrity fails** when the record cannot be verified without the original system running, when key rotation breaks the audit trail, when "append-only" is a database constraint rather than a cryptographic property.

Collapsing any two of these makes both worse. Intake doesn't care about reasoning traces. Governance doesn't care about bind evaluation order. Integrity doesn't care about review protocols. Three specs give three separate authors, three review cycles, three adoption paths. A team that needs one doesn't pay for the other two until they need them.

---

## Start here: what a deployment does

A rural county processes emergency rental-assistance applications. The workflow has an AI-assisted prescreen, a caseworker review under an independent-first protocol, a supervisor approval on denials, and a statutory right of appeal. The record must survive the county's vendor going out of business.

### Timeline of one case

- **Session opens.** The form loads. In workflow-initiated flows, a WOS case shell may already exist; in public-intake flows, Formspec opens intake first and WOS creates the governed case only after accepting the handoff. A respondent ledger begins, hash-chained and signed.
- **AI prescreen runs.** The agent is declared at the autonomy level governance permits and prohibited from adverse determinations. Its recommendation is recorded as AI-generated narrative — never conflated with verified fact.
- **Applicant fills the form.** Reactive validation and computed fields run locally. Autosaves record material changes. Identity verification, if required, lands normalized into the shape the ledger expects.
- **Submission.** The browser signs the response. The server re-validates with the same semantics. A checkpoint seals events so far and anchors outward to one or more trust substrates.
- **Caseworker review.** Governance structurally gates the review: the interface cannot reveal the AI's recommendation until the caseworker commits an independent judgment. Any change-of-mind after reveal becomes a counterfactual trace the audit can analyze later.
- **Decision.** Authority-ranked reasoning recorded. Final checkpoint sealed.
- **Export.** A single portable bundle carries everything needed to verify the case — canonical response, version-pinned definition, ledger events, signed anchored checkpoints, governance events, reasoning, evidence bindings, identity attestations, signature affirmations, amendment links, clock state, migration pins, and anchor proofs. A verifier tool proves the chain offline, without the county, without the vendor, without the original system.

For most workflows you do not need this. For rights-impacting workflows where the record must outlive the vendor, this is what the stack is for.

### Submission, intake, and case

A submission is always first-class, but it is not always already a governed case.

- **Submission** means "something came in."
- **Intake record** means "the platform now owns handling this somehow."
- **Governed case** means "this now has WOS identity, lifecycle, actors, and provenance expectations."

That distinction keeps both ends of the product range honest:

- a Google-Forms-style deployment can treat the intake record as the whole story;
- a workflow-lite deployment can auto-promote the intake record into a tiny governed case;
- a regulated deployment can route, screen, attach, or promote intake into a long-running governed case with full review, signature, and appeal semantics.

The mistake is treating submissions as nothing. The opposite mistake is forcing every inbound artifact into heavyweight case semantics before the host has decided how it will be handled.

### Topology of what runs

Four conceptual processes:

```text
  Browser runtime           renders the form, evaluates behavior locally,
                            re-validates client-side
         │
         ▼
  Intake service            re-verifies submissions with the same semantics
                            the browser used
         │
         ├──────────────────┐
         ▼                  ▼
  Governance runtime    Integrity service
  evaluates the         canonicalizes, signs,
  workflow state        chains, and anchors
  machine, enforces     events from intake
  AI constraints,       and governance into
  gates reviewer        one append-only,
  interactions          offline-verifiable chain
```

Plus pluggable adapters around them: a workflow engine of the deployment's choice, an identity provider, a key management backend, one or more anchor targets, and storage tiers for responses, ledgers, and attachments.

---

## Architecture: dependency inversion

One principle that every other decision follows from: **the specification is the abstraction; everything else is a concretion.**

```text
                     ┌─────────────────────────────────────────┐
                     │             STABLE CENTER                │
                     │                                          │
                     │  Formspec spec + schemas + kernel        │
                     │  WOS spec + governance + AI semantics    │
                     │  Trellis envelope + chain + checkpoint   │
                     │  Respondent Ledger integrity seams       │
                     │  Shared conformance                      │
                     └──┬──────┬──────┬──────┬──────┬──────────┘
                        │      │      │      │      │
       ┌────────────────┘      │      │      │      └────────────┐
       ▼                       │      │      │                   ▼
 RUNTIME                  IDENTITY  STORAGE  ANCHOR           LEGAL
 ADAPTERS                 ADAPTERS  ADAPTERS ADAPTERS         POSTURE
 (workflow engines,       (OIDC,    (append- (transparency    (licensing,
  browser runtimes,        wallets,  only     logs, public     jurisdiction,
  native clients,          DIDs)     stores,  anchors, TSAs)   governance)
  server re-verify)                  blobs)
```

The *center* is versioned, LLM-authorable, and changes only through normative spec proposals.

The *adapters* are concrete runtimes, identity providers, key management backends, anchor targets, storage tiers, legal postures, and market-facing narratives. A deployment picks one of each. A different deployment picks others. None of the choices contaminate the center.

Three practical consequences:

1. **No runtime is load-bearing.** Any workflow engine that implements the governance kernel semantics is substitutable. The same applies to identity, anchoring, and storage.
2. **No vendor is load-bearing.** Export bundles verify against published schemas and signature profiles. Every component vendor can disappear and the record still verifies.
3. **Center changes require normative spec proposals.** Adapter choices don't. This is how the platform stays multi-consumer without fragmenting.

Market messaging is not an architectural adapter, though it plugs in like one. It lives in the Positioning section below.

---

## The five contracts

Five interfaces cross layer boundaries. They are the only surfaces where cross-project compatibility claims live.

1. **The canonical response** — what intake produces, pinned to exactly one definition version. Downstream layers cannot reinterpret it against a later definition.
2. **The governance coprocessor** — how WOS asks Formspec to prefill, validate, or map response data into case state, and how Formspec hands public intake evidence back to WOS for governed case creation.
3. **The event hash chain** — the abstract sequencing declared by the Respondent Ledger and concretized by Trellis.
4. **The checkpoint seal** — the abstract sealing point declared by the Respondent Ledger and concretized by Trellis.
5. **The governance custody hook** — the abstract provenance emit from workflow transitions, received and merged by Trellis into the same chain.

Everything in the stack composes through these five seams. Their specific shapes, section references, Rust-level signatures, and current stability postures live in the project that owns each surface — see Reading order below.

### Open contracts

The five contracts are the baseline, not the full end state. The stack needs additional contracts before it can make serious full-stack product claims. Naming them honestly matters more than pretending the seam list is complete. Open contracts come in two shapes: event-shape gaps (*what lands in the record*) and integration primitives (*how the three layers compose*). The services underneath the event-shape gaps typically exist as adapters already; the integration primitives are fully center work.

**Event-shape gaps.**

- **Evidence integrity.** Files attached during intake — pay stubs, ID photos, supporting documents — are load-bearing for rights-impacting decisions. A contract declaring how their content hashes bind into the chain and travel in the export bundle is missing. Full proposal at [ADR 0072](thoughts/adr/0072-stack-evidence-integrity-and-attachment-binding.md). Storage is an adapter; the binding is center.
- **Identity attestation shape.** Identity proofing is an adapter slot. The normalized attestation that lands in the ledger is a center concern, currently described in prose rather than contracted.
- **Signature attestation shape.** Signing workflows — multi-party signatures, countersignatures, consent capture under ESIGN, UETA, or eIDAS — are load-bearing for any rights-impacting use case that needs legal weight. The **machine-verifiable** slice is now wired end-to-end in reference form: canonical intake fields, WOS `SignatureAffirmation` provenance, `custodyHook` append, and Trellis export catalog rows that verifiers check against payloads. What remains center-shaped is **human-facing completion** (certificate-of-completion composition), **shared cross-repo fixtures** that pin one byte story across all three layers, and any further normative tightening of the claim graph — not greenfield invention of the seam.
- **Actor authorization.** Governance constrains AI agents through deontic modalities and structures human review. A parallel shape for *human* authorization — actor acted under which policy at which moment, attested into the chain — is implicit. IAM is an adapter; the claim shape is center.
- **Per-field access classification.** Whether a given field is PII, financial, medical, or routine procedural metadata is left to downstream consumers; the encryption boundary arrives too late for the browser to gate plaintext at the keystroke. Closed by [ADR-0074](thoughts/adr/0074-formspec-native-field-level-transparency.md) — `accessControl` as a normative Formspec item property; class taxonomy in an Access-Class Registry companion (registry-tier infrastructure); per-deployment audience policy in a Privacy Profile sidecar; bucketed Response wire shape with per-class DEKs in the key bag; cross-class FEL is a definition error at Core. Companion specs and reference implementation pending.
- **Amendment and supersession.** Append-only is correct until a decision is wrong. Cross-layer semantics for one decision superseding another — new chain, linked chain, governance event shape — are undefined. Full proposal drafted at [ADR 0066](thoughts/adr/0066-stack-amendment-and-supersession.md); no adapter supplies this — fully center work.
- **Statutory clocks.** Rights-impacting workflows run on deadlines — appeal windows, SLA limits, expirations. A contract declaring how a deadline attaches to an event, what fires when it elapses, and how clock state seals into the chain is missing. Full proposal drafted at [ADR 0067](thoughts/adr/0067-stack-statutory-clocks.md); timers are adapters, deadline semantics are center.

**Integration primitives.** Not event shapes but composition protocols — how the three layers agree on initiation, scope, time, failure, and version. All five touch all three layers; none has an adapter that fills the gap. Four remain proposed ADRs; case initiation is accepted with an initial Formspec/WOS reference implementation and remaining Trellis/vector closeout.

- **Case initiation and intake handoff.** Public forms and workflow-started cases are both normal. Every submission creates a first-class intake record. WOS owns governed case identity and `case.created`; Formspec owns the intake session, canonical response, validation report, and respondent-ledger evidence. The seam decides whether an intake record closes without promotion, attaches to an existing governed case, or creates a new governed case. Accepted in [ADR 0073](thoughts/adr/0073-stack-case-initiation-and-intake-handoff.md); Formspec now has an `IntakeHandoff` schema and WOS has a typed parser plus `caseCreated` provenance constructor. Trellis vectors and the shared stack fixture remain open.
- **Tenant and scope composition.** Formspec has definition scope, WOS has `DurableRuntime` tenant scope, Trellis has ledger scope. Three parallel scoping concepts that do not yet compose. Full proposal at [ADR 0068](thoughts/adr/0068-stack-tenant-and-scope-composition.md).
- **Time semantics.** All three layers timestamp. No shared pin on RFC3339 UTC, monotonic versus wall-clock, or leap-second policy. Full proposal at [ADR 0069](thoughts/adr/0069-stack-time-semantics.md).
- **Cross-layer failure and compensation.** Partial-commit semantics — what happens when intake commits, governance fails, integrity has anchored — are undefined. Full proposal at [ADR 0070](thoughts/adr/0070-stack-failure-and-compensation.md).
- **Cross-layer migration and versioning.** Single-spec migration is covered by each project's changelog. Chain validity under evolving cross-spec semantics is not. Full proposal at [ADR 0071](thoughts/adr/0071-stack-cross-layer-migration-and-versioning.md).

Cost differs sharply. Evidence, identity, signatures, and authorization are cheap: adapters exist; the missing work is the shape they emit. Amendment, clocks, and the five integration primitives are expensive: they touch all three layers and every existing seam has to accommodate them. That cost does not make them optional; it makes them required closure work before the stack presents the full portable-case-record claim. Eight stack ADRs now cover the active cross-layer closure set (0066-0073, with 0072 accepted and the rest proposed); identity attestation and signature attestation are tracked in submodule TODOs (WOS-T4 for signatures; identity generalizes from T4-6).

Open contracts are named here so downstream readers are not surprised, and so proposals can reference them by name. Their resolution lives in each owning project's planning documents or, when fully cross-layer, in stack-scoped ADRs at [`thoughts/adr/`](thoughts/adr/).

---

## Composition at deploy time

Each row is an adapter slot; the column values illustrate the kinds of choices available.

| Slot | Minimum viable | Enterprise / regulated |
|---|---|---|
| Form runtime | A browser-embedded renderer of the official web component | Native React, iOS, and Android integrations with identical semantics |
| Workflow engine | A simple durable executor | A commercial BPMN or workflow orchestrator |
| Identity proofing | None | A verified-identity provider (public or commercial) |
| Key management | Local or file-backed | Cloud KMS, hardware security module, or qualified trust service |
| Anchor target | None | One or more external timestamp or transparency-log services (time anchors, public append-only logs, or tile-served logs — adapter choice, not center) |
| Storage | Ordinary database plus append-only tables | Tenant-isolated encrypted stores plus WORM-class ledger storage |
| Delivery | Email | Email plus secondary channels with retry, bounce handling, and delivery receipts |
| Legal posture | Open-core defaults | A dual-license or Apache-only arrangement suited to the buyer |

Operational complexity at full three-layer deployment is higher than a plain workflow-engine-plus-audit-log stack. The delta: cryptographically verifiable, offline-exportable, AI-governance-constrained, vendor-survivable records.

---

## Governance

A stack claim is only as durable as the rules that keep the contracts stable.

### Ownership

Maintained by Michael Deeb ([TealWolf Consulting](https://tealwolf.consulting/)) with [Focus Consulting](https://focusconsulting.io/) as strategic partner. All three projects share a single maintainer today — a first-order key-person risk, stated plainly. A broader governance model lands before any 1.0 freeze.

### Cross-project change management

Each project owns its own change log, ADR tree, and TODO list. A change that crosses a contract seam — altering a shape that one project declares and another consumes — requires an ADR in each affected project referencing the others. Stack-scoped ADRs that are fully cross-layer by construction (the integration primitives above, composition across all three specs) live at [`thoughts/adr/`](thoughts/adr/) in the monorepo parent; per-project ADRs live in each project's own tree. Author discipline currently carries the cross-seam convention; a mechanical cross-check remains open work.

### Conformance ownership

Each project owns its own conformance suite. Trellis additionally enforces **byte identity across two implementations** (Rust as byte authority, Python as CI cross-check) on its vector corpus; **G-5** — an independent second implementation commissioned against spec prose alone — is **closed** for that byte story. A **shared stack-level** suite — cross-seam fixtures that exercise canonical-response, governance-coprocessor, event-chain, checkpoint-seal, custody-hook, evidence, signature, amendment, clock, and migration composition in one pinned artifact — remains **required open work** tracked under WOS and Trellis closeout (see their TODOs). When it lands, full-stack composition claims stop depending on prose alone.

### Contribution and cadence

Contributions accepted under Apache-2.0 for runtime, BSL 1.1 for authoring tools. No CLA today. Security disclosure policy is now load-bearing — Trellis has a reference implementation and a disclosure policy lands before final ratification. Pre-release; release sequencing and dependency ordering tracked in each project's own planning documents.

---

## Status

Pre-release. Across the three layers, maturity varies by design:

- **The intake runtime** is deployable today at the kernel level. Its authoring tools ship under a license that converts to fully open in 2030.
- **The governance kernel** compiles and evaluates lifecycles, deontic rules, structured review gates, and provenance emission — including Signature Profile semantics and `SignatureAffirmation` emission where the profile applies. Engine-specific bindings to production workflow platforms are future work.
- **The integrity layer** has a reference implementation **and** an independent second implementation; the **G-5** stranger gate for Trellis byte conformance is **complete**, so the “verifier you did not write” story for the export bundle is no longer hypothetical. Remaining work is **product and stack glue** — human certificate-of-completion, authoring UX, shared fixtures — not the existence of a second verifier.

Each project tracks its own finishing work. Current counts, gate names, open decisions, and ratification status live in each project's README, TODO, and ratification files. See Reading order.

---

## Proof packages

The stack needs two proof packages, and they serve different readers.

The **engineering proof package** is verifier-facing: specs, schemas or byte grammars, vectors, release artifacts, and verifier behavior that reproduce the same case outcome without a SaaS login.

The **buyer proof package** is procurement-facing: accessibility conformance, operational attestations, security posture, schedule vehicles, counsel-reviewed signing claims, and deployment evidence. It makes the stack purchasable; it does not replace verifier evidence.

Product demos sit outside both packages unless they run the same verifier path. An online trust surface may help users understand the record, but it cannot stand in for offline verification or introduce a second proof story.

---

## Positioning

The stack admits multiple valid audiences because the center is multi-valent, but multiple valid audiences is an architectural property, not a go-to-market strategy. The lead wedge for the near term is mid-market regulated-industry CTOs with a current audit finding about AI-assisted decisioning — a budget, a clear pain (compliance cannot reconstruct what the model saw), and a sales cycle short enough for a pre-release stack to land.

Supporting audiences — each genuinely valid but not prioritized:

- Government, primes, and SBIR channels: governance artifacts as a scored differentiator on rights-impacting-workflow proposals.
- Press and founder-led attention: the record survives the vendor.
- The developer community: portable form runtime, shared kernel, identical semantics on every platform.
- The design-systems community: honest seams between data, behavior, and presentation.

The supporting wedges do not fight the lead architecturally. They compete for engineering hours; the lead wins them by default and supporting wedges earn them with concrete pull signal.

The one positioning mistake that is load-bearing: letting any wedge leak into the center. Chasing a pitch by modifying the specs to flatter it is how multi-valent stacks become narrow ones.

---

## What this is not

- **A hosted product.** No SaaS exists. Each project is a specification plus reference implementation; you host it or integrate it.
- **A workflow engine.** The governance layer runs on top of existing engines. It does not durably execute workflows; it governs them.
- **A rendering library.** The intake layer is a data and behavior specification. Rendering is a pluggable sidecar.
- **A blockchain.** The integrity layer anchors to external trust substrates. Specific substrate choices are pluggable; none is required.
- **A standalone signing product.** Agreement-style flows compose across Formspec, WOS, and Trellis; signing product UX, administration, and counsel-specific legal packaging live above the center.
- **Complete.** Pre-release. Each project tracks its own finishing work.

---

## Reading order

Numbers, ratification status, technical surfaces, and open decisions live in the project that owns them. This document points at them, not at itself.

First time here:

1. This document.
2. [Stack-wide vision model](.claude/vision-model.md) — foundational Q1–Q4 answers and per-spec commitments; update there when cross-layer posture changes.
3. [Platform decisioning register](thoughts/specs/2026-04-22-platform-decisioning-forks-and-options.md) — end-state commitments, implementation leans, open forks, kill criteria, and product constraints.
4. [Formspec root README](README.md) — intake depth.
5. [WOS root README](wos-spec/README.md) — governance depth.
6. [Trellis root README](trellis/README.md) — integrity depth.
7. [Trellis product vision](trellis/thoughts/product-vision.md) — phased delivery arc (exports → runtime integrity → portable case file → federation) without duplicating ratification tables here.
8. [Respondent Ledger specification](specs/audit/respondent-ledger-spec.md) — the bridge.
9. [LICENSING](LICENSING.md) — authoritative on the open-core split.

**Adapter and risk posture (integrity adjacent).** For the menu of mature components (storage, anchoring, selective disclosure defaults, key management) and for **standards-first vs. bespoke** discipline on the ledger path, see [Trellis unified ledger technology survey](trellis/thoughts/research/2026-04-10-unified-ledger-technology-survey.md) and [ledger risk reduction](trellis/thoughts/research/ledger-risk-reduction.md). They inform adapter choices; they do not redefine the three-layer center.

For technical truth — counts, schemas, tests, open work, ratification status — each project's own README, TODO, and (for Trellis) ratification files are the source. Avoid duplicating their numbers here; they drift.

For contributors:

- Formspec ADRs: [`thoughts/adr/`](thoughts/adr/).
- WOS planning: [`wos-spec/TODO.md`](wos-spec/TODO.md) and the WOS `thoughts/` tree.
- Trellis planning: [`trellis/TODO.md`](trellis/TODO.md), [`trellis/ratification/`](trellis/ratification/), and the Trellis `thoughts/` tree.

---

## Glossary

- **Adapter** — a concrete implementation that plugs into a spec-declared slot. Disposable, swappable, does not alter the center.
- **Authored signature** — a cryptographic binding by the respondent (or delegate) to a response at authoring time, distinguished from a ledger audit entry *about* a signature.
- **Case file / export bundle** — the portable artifact that carries a case's full record and verifies offline without the original system.
- **Center** — the stable abstraction: the three specifications, their schemas, their shared conformance. Changes require normative spec proposals.
- **Deontic modalities** — permission, prohibition, obligation, right. The four ways AI agents are constrained in the governance layer.
- **Epistemic provenance tiers** — the separation of verified fact, human reasoning, counterfactual analysis, and AI-generated narrative within the record. Prevents conflation of what the machine said with what was verified true.
- **Impact level** — the governance classification that determines which protections apply to a given workflow.
- **Independent-first review** — a structured review protocol where the interface cannot reveal AI output until the human has committed an independent judgment.
- **Multi-valent center** — the property of an architecture that supports multiple valid audiences, narratives, and adapters without modifying the core.
- **Ratification gate** — a checkpoint in a project's path to its 1.0 freeze. Names and statuses live in each project.
- **Respondent Ledger** — the Formspec companion that defines the respondent-side event shape and declares the abstract integrity seams Trellis concretizes.

---

**Maintained by:** Michael Deeb (primary author), TealWolf Consulting, with Focus Consulting as strategic partner.

**Licensing:** runtime under [Apache-2.0](LICENSE); authoring tools under [BSL 1.1](LICENSE-BSL), converting to Apache-2.0 on 2030-04-07. See [LICENSING.md](LICENSING.md).
