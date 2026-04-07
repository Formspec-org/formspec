---
title: Formspec — Project Context
description: >
  The canonical source of truth for Formspec's features, design reasoning,
  architectural vision, target audiences, and project roadmap. Intended for
  both human contributors and AI agents as the single document that answers
  "what is Formspec, why does it exist, and where is it going?"
purpose:
  - Feature inventory — what Formspec does and how the pieces fit together
  - Design reasoning — why each architectural choice was made
  - Vision and roadmap — where the project is headed and what's next
  - Conceptual grounding — the mental model behind the spec, not just the spec itself
  - Audience alignment — who this is for and what problems it solves for them
audience:
  - New contributors and maintainers seeking project orientation
  - AI agents needing full-context project understanding
  - Stakeholders evaluating Formspec's scope and direction
status: living document — update as the project evolves
---

# Formspec — Project Context

## The Problem

Complex forms are everywhere — tax preparation, grant applications, insurance claims, clinical intake, regulatory filings, loan origination, safety inspections, benefits enrollment. The harder the form, the worse the tools. A 200-field application with conditional sections, calculated totals, and cross-field validation takes months to build. A mid-cycle rule change means re-opening submissions and contacting everyone who already filed. A calculation error surfaces in production because there was no way to test it before deployment. The same form needs to work on a tablet with spotty connectivity, in a browser at the office, and on a server for re-validation — and the results have to be identical everywhere.

Someone could rebuild TurboTax with this — the conditional logic engine, the calculation model, the multi-page navigation, the contextual help, the version-locked definitions are all there.

Formspec exists because no existing tool handles all of this. It is an open-source, JSON-native form specification — not a platform, not a SaaS product — that defines forms as portable, version-controlled JSON documents. One definition renders on web, React, iOS, and server without modification. The same validation runs in the browser and on the server, identically, including offline.

The specification is organized into three tiers:
- **Core** — data model, field logic, validation, expressions (FEL)
- **Theme** — presentation tokens, widget catalog, page layout
- **Components** — 33 built-in interaction components, slot binding, responsive design

Two reference implementations exist: TypeScript (client-side engine + web component + React hooks) and Python (server-side evaluation, linting, mapping). A Rust shared kernel (compiled to WASM and PyO3) ensures identical evaluation across all platforms.

**Project status:** Pre-release, open-core (Apache-2.0 runtime, BSL 1.1 authoring tools). No production users yet.

---

## Designed for Humans and AI

Formspec is AI-native. Every design decision — JSON as the canonical format, typed schemas for every document, an Excel-like expression language, structured validation results, semantic field identity — was made so that AI can author, validate, and help fill forms while humans can always read, audit, and modify everything.

### How AI builds forms

Describe the form you need in plain English. AI builds a validated first draft through ~48 typed tool calls (MCP server) — not freeform text generation. Three verification layers catch errors automatically:
1. **Tool schemas** — reject invalid field types before execution
2. **JSON Schema validation** — catch structural errors on every write
3. **Static linting** — catch semantic errors (undefined references, circular dependencies, type mismatches)

FEL's determinism means AI-generated expressions are auditable and statically verifiable — the linter catches plausible-but-wrong bugs before a human sees them. The human role shifts from line-by-line construction to high-level oversight: reviewing what was built, tweaking wording, adjusting structure.

### How AI helps people complete forms

Users can ask "what does Modified Total Direct Costs mean?" and get an answer grounded in the form's own documentation and regulations — not a probabilistic guess from the internet. 15 tools across 4 categories (introspection, mutation, profile, navigation) surface the metadata the author already created at the moment someone needs it:

- **Field help** — deterministic lookup against the Ontology's concept URIs and the References document's regulations, examples, and guidance. No LLM required for the structured answer.
- **Profile matching** — auto-fill from saved profiles using semantic concept identity. Confidence scores range from 0.95 (exact concept match) to 0.30 (field-key fallback). Every auto-fill requires user confirmation.
- **Context resolution** — grounded in form metadata, not model inference.
- **Transport-agnostic** — works over postMessage, WebMCP (W3C draft), MCP, HTTP.

### Why this works

The specification is the contract. JSON is readable by humans and parseable by machines. Schemas enforce structure. FEL expressions are deterministic and side-effect-free — an AI can generate them, a linter can verify them, and a human can read them. The Ontology gives fields semantic identity that both AI and humans can look up. Nothing is opaque. Nothing requires trust in a black box.

**Studio** — real-time AI form building with human review. Visual editor + AI agent collaboration. Preview, validate, deploy from a single interface.

---

## Who It's For

### Form Authoring Teams

**Today you deal with:** Months of back-and-forth between program staff and developers. "Can we add a conditional section?" becomes a project. Logic errors surface in production. Every change request reopens the development cycle.

**Formspec gives you:** AI-powered structured tool calls (MCP server with ~48 typed tools) that build a validated first draft from a plain-English description. Three verification layers — typed tool schemas, JSON Schema validation, and static linting — catch errors automatically. You describe the form you need; the AI builds it; you review and refine. The human role shifts from line-by-line construction to high-level oversight.

### Program and Operations Managers

**Today you deal with:** Calculation errors nobody catches until audit. Conditional logic that only the original developer understands. Mid-cycle rule changes that invalidate in-progress submissions. Data locked in one vendor's format. Whether you manage grant applications, tax forms, insurance claims, benefits enrollment, or regulatory filings — the problems are the same.

**Formspec gives you:** Complex conditional logic and built-in calculations with base-10 decimal arithmetic — `$0.10 + $0.20 = $0.30`, always. Multi-format output (JSON/XML/CSV via the Mapping DSL). Version-locked definitions that prevent rule changes from breaking in-progress submissions. Contextual help via References and Ontology sidecars so end users can understand your form without calling the help desk.

### Field Operations

**Today you deal with:** Forms that fail when the internet drops. Validation that runs differently on the server than on the device. Translating forms that breaks the logic.

**Formspec gives you:** Offline-first with on-device validation — the Rust/WASM kernel evaluates locally, no server round-trip needed. Native rendering on iOS (Swift/SwiftUI); Android (Kotlin/Compose) architecture is finalized. Multilingual support via Locale Documents — add languages by adding files, never edit the original definition. Warning/error distinction lets inspectors flag issues without blocking submission.

### Technology Evaluators (Government, Enterprise, Nonprofit)

**Today you deal with:** Vendor lock-in. Proprietary form definitions you can't move. Accessibility bolted on as an afterthought. Form platforms that can't produce data in the format your systems need.

**Formspec gives you:** AGPL-3.0 open source with no vendor lock-in. JSON definitions you own and version-control. Designed to support WCAG 2.2 AA conformance with built-in accessibility primitives. USWDS adapter included; headless architecture supports Bootstrap, Tailwind, Material, and custom design systems. Spec-defined interoperability — your data flows into compliance databases, audit trails, or PDF generation through a declared Mapping DSL, not export macros.

The primary site audience is **non-technical form managers**, not developers — though developers get dedicated technical depth (architecture, code examples, extension points).

---

## Concrete Scenarios

**Tax preparation with guided logic.** A tax prep service builds a 300-field return with conditional sections (self-employed? rental income? foreign accounts?), cascading calculations, and real-time error checking. FEL handles the calculation graph — modified adjusted gross income flows through dozens of dependent fields, all in base-10 decimal. The Assist layer provides contextual help: "What counts as a qualified business expense?" pulls from IRS guidance, not an LLM guess. Version-locked definitions mean mid-season tax law changes don't break returns already in progress.

**Clinical intake at remote sites.** A tribal health organization runs intake forms at 12 sites, half with unreliable connectivity. The form has 180 fields, conditional screener routing (behavioral health vs. primary care), ICD-10 coded dropdowns, and nested repeat groups for household members. The same JSON definition runs on clinic tablets offline. Validation, calculations, and conditional logic execute locally via the WASM kernel. The Locale Document provides Navajo and Spanish translations without touching the form logic. The Ontology sidecar tags diagnosis fields with ICD-10 concept URIs so downstream data pipelines merge reliably.

**Insurance claims with multi-format output.** An insurer processes property damage claims. The form calculates depreciation, applies coverage limits, and routes to different review queues based on claim amount. One submission produces JSON for the claims API, XML for the legacy actuarial system, and a PDF for the adjuster — all declared in a Mapping Document, no custom export code. When the state regulator updates reporting requirements mid-policy-year, in-progress claims are pinned to the version they started with.

**Field inspection on a construction site.** An inspector conducts a 90-item safety checklist on a tablet. No cell service. Some items require photos. Conditional sections appear based on building type. The form renders natively, validates on-device, enforces required photo attachments, and marks warnings vs. blocking errors so the inspector can flag a concern without halting the inspection.

---

## Key Differentiators

1. **Specification, not platform** — Portable, vendor-independent, version-controlled definitions
2. **One definition, multiple runtimes** — Identical behavior on web, React, iOS, and server, including offline. Android is architecture-finalized.
3. **Deterministic expressions** — FEL is auditable, statically analyzable, non-Turing-complete, with base-10 decimal arithmetic
4. **Separation of concerns** — Ten independent document types (Definition, Theme, Component, Locale, References, Ontology, Registry, Mapping, Changelog, Assist), each with its own authoring team and review cycle
5. **AI-native, human-auditable** — Designed from the ground up for AI authoring and AI-assisted filling, with every artifact (definitions, expressions, validation results) remaining human-readable and machine-verifiable
6. **High-stakes focus** — Built for tax prep, grants, insurance, clinical, compliance, inspection — not contact forms or surveys
7. **Accessible by default** — Designed for WCAG 2.2 AA conformance; accessibility primitives (ARIA, keyboard navigation, focus management) built into the behavior layer. USWDS adapter for federal projects.
8. **Semantic data** — Ontology layer gives fields machine-readable identity, enabling deterministic AI data engineering
9. **Non-relevant field handling** — Configurable per-bind `nonRelevantBehavior` (remove/empty/keep) controls what happens to data when fields become irrelevant — a nuance most form specs ignore

---

## Core Architecture

### Rust Shared Kernel

FEL parsing/evaluation, validation semantics, coercion, mapping execution, and lint rules live in Rust crates (`fel-core`, `formspec-core`, `formspec-eval`, `formspec-lint`). Six crates, 10,931 lines, 239 tests. Compiled to:
- **WASM** — browser and TypeScript engine (this is how offline validation works: the kernel runs on-device)
- **PyO3** — Python server-side evaluation
- **Future: UniFFI** — native mobile FFI without WebView bridge

The TypeScript engine (`FormEngine`) handles reactive state management via Preact Signals. The Rust kernel handles all spec business logic. This hybrid avoids rewriting the reactive layer while eliminating double-implementation maintenance.

### Runtimes

| Runtime | Package | Status | Technology |
|---------|---------|--------|------------|
| Web Component | `formspec-webcomponent` | Shipped | `<formspec-render>` custom element, accessibility primitives |
| React | `formspec-react` | Shipped | Hooks-first (`useField`, `useFieldValue`), bring-your-own-components |
| iOS/macOS | `formspec-swift` | Shipped | SwiftUI renderer with WebView bridge |
| Android | `formspec-kotlin` | Architecture finalized | Jetpack Compose renderer with WebView bridge (planned) |
| Python | `formspec-py` | Shipped | Server-side re-validation, linting, mapping |

Same JSON definition, same Rust kernel evaluation, native UI on each platform. Zero validation divergence — guaranteed by the shared Rust kernel.

### FEL (Formspec Expression Language)

Purpose-built, non-Turing-complete expression language for calculated values and conditional logic. If you've written an Excel formula, you can read FEL. Design synthesis of Power Fx syntax + JSONata's JSON model + XForms' bind semantics.

Key properties:
- **Deterministic** — side-effect-free; individual expressions always terminate (no loops, no recursion, no I/O)
- **Excel-like** — `sum(items[*].amount)`, `if($income > 50000, $rate_a, $rate_b)`, not map/reduce
- **Form-domain-specific** — `$quantity` auto-scopes to current repeat row; `valid()`, `relevant()`, `readonly()` query bind state; `let`/`if-then-else` for inline conditionals
- **Statically analyzable** — dependency extraction, circular reference detection, type checking at author time
- **Base-10 decimal arithmetic** — financial calculations are exact, not floating-point

### Processing Model

The engine evaluates form state in a four-phase reactive cycle:
1. **Rebuild** — reconstruct the item tree (repeat instances, relevance)
2. **Recalculate** — re-evaluate all `calculate` expressions in dependency order
3. **Revalidate** — run bind constraints and shape rules
4. **Notify** — push changes to subscribers (UI, signals)

This cycle runs until stable, with a convergence cap of 100 iterations to prevent infinite loops from circular calculations.

### Validation

Two mechanisms:
- **Bind constraints** — field-level: required, constraint, readonly, calculate, default
- **Shape rules** — cross-field/form-level constraints with per-shape validation timing

`ValidationReport` contains structured results with severity levels (error/warning/info), constraint kinds, and path-based field targeting with wildcard support.

Non-relevant fields receive special treatment: validation is suppressed, and the `nonRelevantBehavior` property (remove/empty/keep) controls whether their data is preserved, cleared, or excluded from the response. A separate `excludedValue` property controls what downstream expressions see for non-relevant fields' in-memory values — two independent axes that most form specs conflate into one. This dual-channel design means a calculated total can still include a non-relevant field's value (for audit trail continuity) while excluding it from the submitted response.

Per-shape validation timing interacts with three global pipeline modes: `continuous` (validate as the user types), `deferred` (validate on submit), or `disabled` (skip validation entirely). Individual shapes can override the global mode — "budget must balance" fires at submit; "formatting looks unusual" fires continuously. This gives form authors fine-grained control over when users see which feedback.

Missing fields (defined but no value entered) resolve to `null` in FEL expressions. This is distinct from a field whose value is an empty string or zero — a distinction that matters for progressive data collection where partial submissions are valid.

### Extension Model

Extensions use an `x-` namespace prefix and resolve against loaded registry entries. The Registry spec defines extension publishing, discovery, and lifecycle. Unresolved extensions emit validation errors — they don't silently pass through. Extension functions can be registered and called from FEL expressions.

---

## Offline-First

"Offline-first" is not a feature flag — it is a consequence of the architecture. The Rust shared kernel compiles to WASM and runs in the browser. Form rendering, validation, calculations, conditional logic, and FEL expression evaluation all execute locally on the device. No server round-trip. No "please reconnect" modal.

What works offline:
- Full form rendering with conditional sections, repeat groups, and page navigation
- All validation — bind constraints, shape rules, required fields, cross-field constraints
- All FEL calculations — budget totals, derived values, aggregations over repeat groups
- Language switching (Locale Documents are loaded with the form)
- Warning vs. error distinction (inspectors can flag concerns without blocking submission)

What requires connectivity:
- Initial form definition download (cached afterward)
- AI-assisted filling (the Assist conversational layer needs an LLM endpoint)
- Submission to the server (queued locally until connectivity returns)
- Vector store lookups from References (field-level help text works offline; deep RAG queries do not)

A concrete example: a field inspector conducting a 90-item safety checklist on a construction site. The form loads once over WiFi at the office. On-site, with no cell service, every conditional section, every calculated field, and every validation rule runs identically to how it would run online. When the inspector returns to connectivity, the completed response submits.

---

## Companion Documents (Sidecar Architecture)

Formspec separates concerns into independent, composable sidecar documents — files that ship alongside a Definition, each authored, reviewed, and versioned separately by different teams:

| Document | Purpose |
|----------|---------|
| **Definition** | Data model, fields, logic, validation rules |
| **Theme** | Visual presentation tokens, widget catalog, page layout |
| **Component** | Interaction widgets, slot binding, responsive design |
| **Locale** | Translations with cascade fallback (regional -> language -> inline). Supports FEL expressions in strings (`{{formatNumber($remaining)}}`) and context suffixes (`@accessibility`, `@pdf`, `@short`) for variant text. CLDR plural forms via `pluralCategory()`. Cross-tier translation covers theme titles, component labels, and error messages. Version compatibility scoping (`compatibleVersions: ">=1.0.0 <3.0.0"`) lets translations ship independently from the form definition. |
| **References** | Per-field bibliography: regulations, help articles, vector stores, tools. Audience-tagged (`human`/`agent`/`both`) so AI assistants and human readers get different context. Relationship types (`rel: "constrains"`, `rel: "defines"`) specify how references relate to fields. Tool invocation schemas at the field level let agents call rate calculators, drug interaction checkers, or other domain tools. Vector store and RAG endpoints are first-class reference types. |
| **Ontology** | Concept identity: stable URIs with cross-system equivalences (FHIR, schema.org, coding standards). Transforms "what does this field mean?" from inference to lookup. Concept dictionary serves as centralized version management — update one entry when ICD-10 releases a new version, every form picks up the change. Per-form overlays handle integration-specific mappings. Enables compliance automation (PII tracing across all forms) and reduces data preparation cost by eliminating the column-mapping problem. |
| **Registry** | Extension publishing, discovery, lifecycle |
| **Mapping** | Bidirectional output transforms. Submit once, get JSON, XML, and CSV — no re-entry, no export macros. The Mapping DSL defines field-level transforms, value maps, and coercion rules |
| **Changelog** | Change objects, impact classification, migration generation |
| **Assist** | Form-filling interoperability: 15 tools across 4 categories (introspection, mutation, profile, navigation). Profile matching uses semantic concept identity with confidence scores (0.95 for exact concept match down to 0.30 for field-key fallback). User confirmation required for every auto-fill. LLM-optional design — structured help works without AI; the conversational layer is additive. WebMCP transport (W3C draft) with polyfill shim. The Formy browser extension implements three operating modes: full assist on Formspec pages, bootstrapped assist on pages with `<formspec-render>`, and degraded heuristic mode on plain HTML forms. |

---

## Design Philosophy

### Spec-first methodology

Formspec was built as a chain of formal models — research into specs, specs into schemas, schemas into implementations. The code is the last mile, not the starting point.

```
Research (prior-art analysis, feature extraction)
    |
Specification (normative prose, behavioral semantics)
    |
Schemas (structural contracts, JSON Schema)
    |
Reference implementations (TS engine, Python evaluator)
    |
Tooling interfaces (core, studio-core, MCP)
    |
Applications (web component, studio)
```

Each layer constrains the next. This matters especially for AI-assisted development — AI is effective at working within constraints but unreliable at inventing them. Formal models provide the constraints.

The prior-art research decomposed XForms, SHACL, FHIR, JSON Forms, SurveyJS, and ODK into 517 testable features. Each was classified: Adopted (directly incorporated), Adapted (spirit captured, mechanism differs), or Missing (not addressed). All 97 Critical-priority features are Adopted or Adapted. Zero critical gaps. The missing features cluster around XML-specific mechanisms and transport concerns that are out of scope by design.

Three LLM providers received the same research prompt independently. All three converged on the same core architecture — instance/bind/shape separation, reactive dependency graphs, structured validation with severity levels. The divergences were equally useful: different providers contributed different edge-case insights. The synthesis cherry-picked from each, then validated against the actual W3C and HL7 specifications.

### Models are the product

The specification and schemas are not documentation of the code — they are the source of truth the code implements. A feature that exists in code but not in the spec is a bug. A feature that exists in the spec but not in code is a known gap. This inversion means the spec can be reviewed, versioned, and audited independently from any implementation.

---

## Competitive Positioning

### Compared to existing tools

If your forms are simple — contact forms, surveys, customer feedback — pick the tool with the best developer experience for your stack and move on. Formspec is not the right choice for simple cases. It is designed for complex, high-stakes forms — tax returns, grant applications, insurance claims, clinical assessments, regulatory filings — that have more than two of these requirements:

- Cross-field expressions that run identically on client and server
- Computed values with automatic dependency tracking
- Validation results that are machine-readable, not just display strings
- Form definitions that are version-controlled, lintable, and schema-validated
- Data that flows into compliance databases, audit trails, or PDF generation

| Tool | Good at | Where it falls short for high-stakes use |
|------|---------|------------------------------------------|
| **Google Forms / Typeform** | Quick surveys, simple data collection | No conditional logic, no calculations, no offline, no version control, vendor lock-in |
| **ODK Collect / KoboToolbox** | Field data collection, offline, open source | XPath-based expressions (hard for non-developers), XML-native, no dual-runtime validation parity, limited calculation model |
| **REDCap** | Clinical research, regulatory compliance | Proprietary-ish (consortium license), limited expression language, no portable form definitions, no AI-assisted authoring |
| **SurveyJS** | Expression engine, no-code authoring | No data/UI separation, proprietary expression language, single runtime, no portable spec |
| **JSON Forms / RJSF** | JSON Schema grounding, React ecosystem | No expression language, no calculation model, conditional logic via JSON Schema fragments (breaks down for complex cases) |

### Where Formspec is NOT the right choice

- **Simple forms.** A contact form or feedback survey does not need a specification. Use whatever your framework provides.
- **Workflow management.** Formspec produces structured responses. Routing them through approvals, notifications, and review cycles is your application's job.
- **Hosted service.** Formspec is not a SaaS product. You host it, or you integrate it into your stack. If you want a managed form service, this is not it.
- **Mature ecosystem (today).** Formspec is pre-release with no production users. If you need a battle-tested tool this quarter, evaluate the established options for your domain. If you are planning a form infrastructure investment for the next 2-3 years, Formspec is worth evaluating now.

---

## Prior Art

Formspec is a synthesis, not a reinvention. The design team decomposed XForms, SHACL, FHIR, JSON Forms, SurveyJS, and ODK into 517 testable features. 97 critical features are all Adopted or Adapted from prior art.

| Standard | What Formspec Adopts |
|----------|---------------------|
| XForms | Instance/bind separation, Model Item Properties, 4-phase processing model |
| SHACL | Validation shapes, cross-field constraints, severity levels |
| FHIR | Versioning model, extension registry, response pinning |
| ODK | Readability, field-first ergonomics, `$field` reference syntax |
| SurveyJS | Expression validation patterns, static analysis concept |
| JSON Forms | JSON Schema grounding, data/UI schema separation |

---

## Data Privacy and Security

### Where data lives

Form data lives on the device until explicitly submitted. The WASM kernel evaluates everything locally — validation, calculations, conditional logic. No form data is sent to a server during editing. Completed responses submit when the user (or the host application) triggers submission. The host application controls where responses go — Formspec produces structured JSON; storage and transport are your stack.

### Security model

Form definitions are **trusted input from authors**, not untrusted user input. The engine evaluates FEL expressions from definitions — but FEL is non-Turing-complete, side-effect-free, and sandboxed. No file system access, no network calls, no arbitrary code execution. The attack surface is limited to the expression evaluator's input domain.

User-entered form data is **untrusted input** validated against the definition's constraints. The validation pipeline runs in the Rust kernel with no `eval()` or dynamic code execution.

### Data sovereignty

For tribal, indigenous, and sovereign communities: form definitions and responses are JSON files under your control. No data flows to Formspec's infrastructure (there is none). The AGPL-3.0 license ensures you can inspect, modify, and host every component. Concept dictionaries and ontology bindings are files you own and publish — not entries in a vendor's database.

### Compliance considerations

Formspec is a form engine, not a compliance product. It provides mechanisms relevant to HIPAA (data stays on-device during editing, no server round-trips during form completion), FERPA (structured data with audit trails, version-pinned responses), and FedRAMP (open-source, inspectable, self-hostable). Your organization's compliance posture depends on how you deploy it, where you store responses, and how you manage access — Formspec handles the form layer; the rest is your infrastructure.

---

## Accessibility

Formspec's accessibility model is built into the behavior layer, not bolted on as a rendering concern.

**Current capabilities:**
- ARIA attributes (`aria-required`, `aria-invalid`, `aria-describedby`) are set by the engine based on bind state, not by individual component implementations
- Keyboard navigation: all 33 built-in components are keyboard-operable. Focus management handles conditional visibility (focus moves to the next relevant field when a field becomes non-relevant)
- Screen reader support: repeat group add/remove actions announce changes. Validation errors are associated with their fields via `aria-describedby`. Locale Documents support `@accessibility` context suffixes for purpose-written screen reader text
- USWDS adapter provides federal design system compliance out of the box

**Conformance status:** Designed to support WCAG 2.2 AA. Not yet formally audited against the standard. The React package ships accessible defaults (`useField` returns pre-built `inputProps` with ARIA attributes already set). The web component registers accessible components by default. Section 508 conformance is a design target, not a certified claim.

---

## Licensing

Formspec uses an open-core licensing model:

- **Runtime packages are Apache-2.0** — the specification, schemas, form engine, renderers (web component, React, Swift), FEL evaluator, layout algorithm, linter, and all Rust crates needed to render, validate, and lint forms. You can embed these freely in any application, including proprietary and commercial products. No copyleft. Includes a patent grant.
- **Authoring tools are BSL 1.1** — Studio, MCP server, chat interface, assist implementation, and changeset analysis. You can use these for internal purposes, development, testing, and non-commercial work. The restriction: you cannot offer them as part of a competing form-authoring product (hosted or packaged). On April 7, 2030 (or four years after each version's release), all BSL code converts automatically to Apache-2.0.
- **Form definitions are your data.** Your JSON form definitions, responses, themes, mappings, and all other documents you create are yours. They are not derivative works. No license applies to them regardless of which tools you used.

**Government procurement:** The runtime packages are Apache-2.0, which is universally accepted by government procurement offices. No copyleft concerns for the components you embed in your applications. The authoring tools (BSL) are relevant only if you're building a competing form-authoring product — internal use is unrestricted.

For commercial licensing of the authoring tools, contact Michael.Deeb@tealwolf.consulting. Full details in [LICENSING.md](LICENSING.md).

---

## Governance and Sustainability

**Maintained by:** Michael Deeb (primary author and maintainer), with AI-assisted development (Claude).

**Spec changes:** Proposed via ADRs (Architecture Decision Records) in `thoughts/adr/`. Each ADR has a status (Proposed, Accepted, Deprecated). Schema changes follow a required workflow: edit schema and spec, run generation, run validation checks. The spec is the source of truth — code follows the spec, not the other way around.

**Contributions:** Open to contributions under AGPL-3.0. The spec-first methodology means feature requests start as spec proposals, not pull requests. Code contributions are welcome for implementations, tooling, and adapters.

**Sustainability:** The project is designed to be self-sustaining as open infrastructure. Form definitions are portable JSON — even if the project stopped today, your definitions remain usable by any JSON-capable system. The specification is a public document that any team can implement independently.

---

## Honest Tradeoffs

**WASM call overhead.** Every FEL evaluation crosses the JS-WASM boundary. On the hot path — per-keystroke reactive evaluation — this adds latency. Mitigation: compiled ASTs are cached on the Rust side. `evaluate()` is called per change, not `parse()` + `evaluate()`. The parse is the expensive part; evaluation is cheap.

**WebView bridge latency for mobile.** iOS and Android renderers use a hidden WebView running the TypeScript engine + WASM kernel. This adds a message-passing layer between native UI and the engine. Mitigation: the UniFFI roadmap replaces the WebView with direct native FFI from the Rust kernel.

**Bundle size.** The WASM binary is a fixed cost added to the browser bundle — it does not grow per-form. Acceptable for internal tools and government portals. Worth measuring for consumer-facing applications. Lazy loading is available for the web component.

**Dual processing model.** The Rust Definition Evaluator (batch) and the TypeScript FormEngine (reactive) both implement the same 4-phase processing model independently. Behavioral parity for edge cases (non-relevant blanking, repeat groups, null propagation) is enforced by shared conformance tests, not by sharing code. This is a real maintenance surface.

**Pre-release status.** No production users. No formal accessibility audit. No stable API guarantee yet. The specification is approaching stability; the implementations are maturing. Early adopters should expect breaking changes.

---

## Roadmap

### Current Status (March 2026)

| Component | Status |
|-----------|--------|
| Core Specification | Draft complete, iterating toward 1.0 freeze |
| FEL Grammar | Stable — PEG grammar formalized, ~61 stdlib functions |
| Theme Specification | Draft complete |
| Component Specification | Draft complete, 33 built-in components defined |
| Locale Specification | Draft complete |
| References Specification | Draft complete |
| Ontology Specification | Draft complete |
| Mapping Specification | Draft complete |
| Assist Specification | In progress |
| Rust Shared Kernel | 6 crates shipped — FEL, core, eval, lint, WASM, PyO3 |
| TypeScript Engine | Shipped, WASM-backed |
| Web Component | Shipped |
| React Package | Shipped |
| iOS/SwiftUI | Shipped (WebView bridge) |
| Android/Compose | Architecture finalized (ADR accepted), implementation planned |
| Python Backend | Shipped, migrating to PyO3 bindings |
| MCP Server | Shipped, ~48 tools |
| Studio | Shipped (visual editor + AI) |
| Formy Extension | Prototyping |

### Near-Term Milestones

- **Spec 1.0 freeze** — lock Core, FEL, Theme, and Component specifications. After freeze, breaking changes require a new major version.
- **Assist specification completion** — finalize the filling-side protocol, publish alongside Core.
- **Android runtime** — implement Kotlin/Compose renderer backed by the shared kernel.
- **Formal accessibility audit** — WCAG 2.2 AA conformance testing against the web component and React packages.
- **Conformance test suite expansion** — cross-runtime behavioral parity tests covering edge cases in non-relevant handling, repeat groups, and null propagation.

### What "production-ready" means

Production readiness for Formspec means: Spec 1.0 is frozen. The conformance test suite covers all normative MUST requirements. At least one runtime (web component or React) has passed a formal WCAG audit. The WASM binary size and call overhead are measured and documented. Breaking API changes follow semver.

### Long-Term Direction

- **UniFFI for native mobile** — replace WebView bridges on iOS and Android with direct Rust FFI via Mozilla's UniFFI. Eliminates bridge latency and reduces mobile package complexity.
- **Additional design system adapters** — Material 3, Apple Human Interface Guidelines component sets alongside the existing USWDS adapter.
- **Dual licensing** — offer a permissive license option for organizations where AGPL is a procurement blocker.
- **Predicate filtering and quantified expressions** — `items[status = 'active'].amount`, `every`/`some` expressions in FEL. Identified as genuine capability gaps in the prior-art research.

---

## Deployment

### What deploying Formspec looks like

**Web (simplest path):** The `<formspec-render>` web component is a single JavaScript import. Host the component bundle on any static file server (S3, Cloudflare, Netlify, your agency's CDN). Load a JSON definition. The form renders. No backend required for form display and validation.

**React:** Install `formspec-react` via npm. Use `<FormspecForm>` for a drop-in auto-renderer, or use hooks (`useField`, `useFieldValue`) for full control with your own components.

**Server-side validation:** Install `formspec-py` via pip. The Python backend re-validates submitted responses against the same definition — same rules, same kernel.

**Infrastructure requirements:** A static file host for the form definition JSON and the component bundle. An HTTP endpoint to receive submitted responses. That's the minimum. Everything else — auth, workflow, storage, notifications — is your application's concern. Formspec produces structured JSON responses; where they go is up to you.

**Connecting to existing systems:** The Mapping DSL defines bidirectional transforms. A single form submission can produce JSON for your API, XML for a legacy system, and CSV for a spreadsheet — all declared in the Mapping Document, no custom export code.

---

## Example

A minimal grant budget form definition (5 fields, 2 binds):

```json
{
  "formspec": "1.0",
  "meta": { "title": "Grant Budget", "id": "grant-budget-v1" },
  "items": [
    { "key": "org_name", "type": "string", "label": "Organization Name" },
    { "key": "personnel", "type": "number", "label": "Personnel Costs" },
    { "key": "travel", "type": "number", "label": "Travel Costs" },
    { "key": "equipment", "type": "number", "label": "Equipment Costs" },
    { "key": "total", "type": "number", "label": "Total Budget", "readonly": true }
  ],
  "binds": [
    { "target": "total", "calculate": "$personnel + $travel + $equipment" },
    { "target": "total", "constraint": ". <= 500000", "constraintMsg": "Total budget must not exceed $500,000" }
  ]
}
```

`$personnel` references the field value. The `calculate` bind auto-computes the total. The `constraint` bind enforces a ceiling. All of this evaluates identically on every runtime.

---

## What Formspec Is Not

Formspec is a **form engine** — data, logic, validation, rendering. It defines what forms are and how they behave.

It is **not**:
- A form builder SaaS (Studio is a reference implementation, not a hosted product)
- A drag-and-drop UI builder
- A workflow engine (submission routing, approvals, notifications are your stack)
- A database (it produces structured responses; where you store them is up to you)
- Hosting, auth, or infrastructure

---

## How We Talk About This

The project communicates with an **evidence-based, principled stance**:
- Heavy citations of prior art; scorecards showing what was adopted vs. adapted vs. novel
- Honest about tradeoffs (WASM call overhead, WebView bridge latency, bundle size costs)
- "We evaluated X and chose Y because..." — every decision is reasoned, not dogmatic
- Pain-first messaging: opens with friction, closes with proof
- Targets both architects (deep specification dives) and practitioners (grant officers, form fillers)

---

## Resources

- **Repository:** `github.com/formspec/formspec` (AGPL-3.0)
- **Specifications:** `specs/` directory — Core, FEL Grammar, Theme, Component, Mapping, Registry, Locale, References, Ontology, Assist, Changelog
- **Schemas:** `schemas/` — JSON Schema files for all document types
- **API docs:** `docs/api/` or regenerate with `make api-docs`
- **LLM-optimized specs:** `specs/**/*.llm.md` — compact summaries for AI context injection
- **Blog:** In-depth posts on FEL design, the Rust kernel, AI integration, the prior-art landscape, locale/references/ontology sidecars, and more
