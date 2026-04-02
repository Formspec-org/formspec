# Screener Specification Reference Map

> specs/screener/screener-spec.md -- 1508 lines, ~65K -- Companion: Standalone Respondent Screening, Classification, and Routing

## Overview

The Formspec Screener Specification is a companion specification to Formspec v1.0 that defines a standalone Screener Document for respondent classification and routing. A Screener Document is a freestanding JSON document (not bound to any single Definition) that declares screening items, an ordered evaluation pipeline with pluggable strategies, override routes for safety-critical classifications, and lifecycle primitives. The evaluation pipeline produces a structured Determination Record capturing matched/eliminated routes, scores, inputs with three-state answer tracking, and validity metadata. The Screener replaces and generalizes the embedded `screener` property from core spec S4.7 into a multi-strategy, multi-phase routing instrument.

## Section Map

### Front Matter and Introduction (Lines 1-220)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| Abstract | Abstract | Summarizes the Screener Document as a freestanding routing instrument that classifies respondents and directs them to target Definitions, external URIs, or named outcomes using FEL for all conditions and computations. | Screener Document, freestanding routing, FEL, Determination Record | Getting a one-paragraph summary of the screener spec |
| -- | Status of This Document | Declares this is a draft companion specification that does not modify or extend the core spec. | draft, companion, not stable | Checking maturity/stability of the screener spec |
| -- | Conventions and Terminology | RFC 2119 keyword definitions, JSON/URI/ISO 8601 standards references, incorporation of core spec terms (Definition, Item, Bind, FEL). | RFC 2119, RFC 8259, RFC 3986, ISO 8601 | Understanding normative language conventions |
| -- | Bottom Line Up Front | 10-bullet summary covering freestanding nature, required properties, phase pipeline, override routes, Determination Record, lifecycle, answer states. | BLUF summary | Quick orientation before reading the full spec |
| S1 | 1. Introduction | Frames the Screener as a standalone document replacing the embedded core S4.7 screening mechanism. | -- | Understanding the motivation and architectural context |
| S1.1 | 1.1 Purpose and Scope | Explains why a standalone Screener Document exists: to decouple respondent classification from any single Definition, support multiple evaluation strategies, lifecycle management, and structured output. Multiple screeners MAY route to the same Definition; one screener MAY route to many Definitions. | freestanding, decoupled, multi-strategy, multi-definition | Understanding why the screener spec exists and what problem it solves |
| S1.2 | 1.2 Scope | Enumerates what is defined (Screener Documents, evaluation strategies, override routes, Determination Record, lifecycle primitives, answer states) and what is NOT (transport, session management, identity matching, rendering, execution scheduling). | in-scope vs out-of-scope | Determining if a feature belongs in the screener spec |
| S1.3 | 1.3 Relationship to Formspec Core | Screener is a companion spec, not extension or supersession. Core processors are NOT required to implement it. Screener processors MUST understand Item/Bind schemas and implement FEL. Every valid S4.7 screener object is expressible as a Screener Document with a single first-match phase. | companion spec, S4.7 replacement, FEL requirement, degenerate case | Understanding how the screener and core specs relate |
| S1.4 | 1.4 Terminology | Defines 7 key terms: Screener Document, Evaluation Phase, Strategy, Route, Override Route, Determination Record, Answer State, Result Validity, Availability Window. | Screener Document, Evaluation Phase, Strategy, Route, Override Route, Determination Record, Answer State | Looking up precise definitions of screener-specific terms |
| S1.5 | 1.5 Notational Conventions | JSON comment conventions, monospace for property names, section reference prefixing for cross-spec refs. | notation, `//` comments, `core S4.2` prefix | Understanding notation used in examples |

### Screener Document Structure (Lines 222-296)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S2 | 2. Screener Document Structure | Defines the Screener Document as a JSON object. SC-13 requires recognition of all top-level properties and rejection of screeners missing required ones. | Screener Document, JSON object, SC-13 | Understanding the overall document shape |
| S2.1 | 2.1 Top-Level Properties | Complete property table: `$formspecScreener` (required, "1.0"), `url` (required, URI), `version` (required, semver), `title` (required), `description`, `availability`, `resultValidity` (ISO 8601 duration), `evaluationBinding` ("submission"/"completion"), `items` (required, Item array), `binds` (Bind array), `evaluation` (required, Phase array), `extensions`. | `$formspecScreener`, `url`, `version`, `title`, `items`, `evaluation`, `availability`, `resultValidity`, `evaluationBinding` | Authoring or validating the root of a Screener Document |
| S2.2 | 2.2 Identification | A Screener is uniquely identified by `url` + `version`. The `url` is a stable opaque identifier (URN syntax acceptable, need not be resolvable HTTP URL). | url, version, unique identification, URN | Understanding screener identity and versioning |
| S2.3 | 2.3 No Target Binding | Unlike Theme/Component/Mapping, Screeners have no `targetDefinition` or `definitionRef`. The relationship to Definitions is expressed entirely through route targets. The Screener is a gateway to Definitions, not a projection of one. Association is a project-level concern. | no target binding, gateway vs projection, project-level concern | Understanding why screeners are architecturally different from other sidecar documents |

### Items and Binds (Lines 298-382)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S3 | 3. Items and Binds | Covers screener items, binds, answer states, FEL scope, and null propagation in screening context. | -- | Understanding how items and binds work in the screener context |
| S3.1 | 3.1 Screener Items | Screener items use the same Item schema from core S4.2 (field, group, content types all valid). Screener items are NOT part of any form's instance data -- they exist solely for routing classification. SC-14: item keys must be unique within the Screener but MAY collide with Definition item keys (separate scopes). | Item schema reuse, separate scope, SC-14, routing-only data | Understanding what items screeners can contain and their isolation |
| S3.2 | 3.2 Screener Binds | Screener binds use the same Bind schema from core S4.3 with all bind properties supported. Binds are evaluated in the screener's own scope and reference screener item keys only. Isolation is absolute: screener binds cannot reference Definition items and vice versa. | Bind schema reuse, isolated scope, absolute isolation | Understanding bind scope isolation in screeners |
| S3.3 | 3.3 Answer States | Three-state model: `answered` (value provided), `declined` (explicitly declined), `not-presented` (not shown, e.g. relevance=false). SC-01: must preserve states in Determination Record; three states must be distinguishable; declined != null. SC-02: declined items evaluate as null in FEL. SC-03: not-presented items evaluate as null in FEL. | answered, declined, not-presented, SC-01, SC-02, SC-03 | Implementing answer state tracking, understanding how declined/not-presented affect evaluation |
| S3.4 | 3.4 FEL in Screener Context | FEL expressions have access to screener item values (`$key`), calculated values, and standard functions/operators. They do NOT have access to Definition item values, bind values, shape results, or any external state. | FEL scope, `$key` references, no Definition access | Understanding what FEL expressions can and cannot reference in screeners |
| S3.5 | 3.5 Null Propagation in Conditions and Scores | FEL null propagation (core S3.4) applies when referencing declined/not-presented items (null per SC-02/SC-03). SC-11: condition evaluating to null is treated as false (route eliminated). SC-12: score evaluating to null is treated as negative infinity (route eliminated with reason "null-score"). | null propagation, SC-11, SC-12, null-score | Implementing null handling in route conditions and score expressions |

### Evaluation Pipeline (Lines 384-491)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S4 | 4. Evaluation Pipeline | The pipeline is an ordered array of phases. Override routes are evaluated first (before any phase). Phases execute in declaration order. Results from all phases and overrides aggregate into the Determination Record. Terminal override routes halt the entire pipeline. | evaluation pipeline, phase ordering, override-first, aggregation | Understanding the overall evaluation flow |
| S4.1 | 4.1 Phase Structure | JSON example showing a two-phase pipeline: a fan-out eligibility check and a score-threshold form selection phase. | phase JSON structure, multi-phase example | Seeing how phases are structured in JSON |
| S4.2 | 4.2 Phase Properties | Property table: `id` (required, SC-15: must match `[a-zA-Z][a-zA-Z0-9_-]*`), `label`, `description`, `strategy` (required, normative: first-match/fan-out/score-threshold; SC-16: extension strategies use `x-` prefix), `routes` (required, Route array), `activeWhen` (FEL boolean), `config` (strategy-specific). | id, strategy, routes, activeWhen, config, SC-15, SC-16 | Authoring or validating evaluation phases |
| S4.3 | 4.3 Route Properties (Common) | Common route properties: `condition` (FEL boolean, conditional), `score` (FEL number, conditional), `target` (required, URI), `label`, `message` (supports `{{expression}}` interpolation, SC-17), `metadata` (opaque key-value), `override` (boolean). | condition, score, target, message interpolation, metadata, override, SC-17 | Understanding the shared route property schema |
| S4.4 | 4.4 Phase Execution Semantics | When a phase evaluates: (1) if activeWhen is false, phase is skipped (status "skipped" in Determination Record); (2) otherwise, strategy determines route evaluation; (3) results added to Determination Record. Phases are independent -- a match in phase 1 does not prevent phase 2. Exception: terminal override halts all. | activeWhen skip, phase independence, terminal exception | Understanding how phases execute and interact |

### Normative Strategies (Lines 493-591)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S5 | 5. Normative Strategies | Defines the three built-in evaluation strategies. | first-match, fan-out, score-threshold | Selecting or implementing an evaluation strategy |
| S5.1 | 5.1 `first-match` | Evaluates routes in declaration order, selects the FIRST route whose condition is true, then stops. SC-08: each route MUST have condition. A route with `"condition": "true"` acts as default/fallback. No additional config. Equivalent to core S4.7 routing semantics. | first-match, declaration order, stop at first, SC-08, S4.7 equivalent | Implementing first-match strategy or migrating from core S4.7 |
| S5.2 | 5.2 `fan-out` | Evaluates ALL routes and returns EVERY route whose condition is true. SC-09: each route MUST have condition. Eliminated routes get reason "condition-false". Config: `minMatches` (minimum required, "below-minimum" warning), `maxMatches` (cap on matches, excess get "max-exceeded" reason). | fan-out, all routes evaluated, SC-09, minMatches, maxMatches, condition-false | Implementing fan-out strategy for multi-program eligibility |
| S5.3 | 5.3 `score-threshold` | Evaluates numeric score expression per route, matches if score >= threshold, ranks by score descending (ties broken by declaration order). SC-10: each route MUST have score and threshold. Eliminated routes get "below-threshold" reason. Config: `topN` (limit results), `normalize` (0.0-1.0 range, max=0 means all zeros). | score-threshold, score >= threshold, descending rank, SC-10, topN, normalize | Implementing scoring-based routing or risk assessment |

### Override Routes (Lines 593-650)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S6 | 6. Override Routes | Safety-critical routes that fire unconditionally regardless of evaluation phase or strategy. Any route MAY be marked `"override": true` and is hoisted into a virtual override set. | override, safety-critical, hoisted | Understanding the override mechanism |
| S6.1 | 6.1 Purpose | Override routes are the "crisis triage" / "hard exclusion" / "sanctions list" mechanism for classifications that must always fire. | crisis triage, hard exclusion, sanctions | Understanding when to use override routes |
| S6.2 | 6.2 Override Evaluation | SC-18: overrides evaluated BEFORE the phase pipeline in cross-phase declaration order. All overrides checked regardless of prior matches (no short-circuit within override evaluation). Terminal flag (`"terminal": true`) operates in two stages: (1) all overrides evaluated first; (2) if ANY matched override is terminal, phase pipeline is halted, phases array is empty, `overrides.halted` is true. Multiple terminal overrides MAY match simultaneously. | SC-18, pre-pipeline, no short-circuit, terminal two-stage, overrides.halted | Implementing override evaluation, understanding terminal semantics |
| S6.3 | 6.3 Override Route Properties | SC-25: override routes MUST have a condition. Additional properties: `override` (must be true), `terminal` (when true, halts pipeline; ignored when override is false). | SC-25, override, terminal | Authoring override routes |

### Route Targets (Lines 652-694)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S7 | 7. Route Targets | Defines the three categories of route target URIs. | target URI, Definition reference, external URI, named outcome | Understanding where routes can point |
| S7.1 | 7.1 Target Syntax | Three categories: Formspec Definition (`url|version`), External URI (any valid URI), Named outcome (`outcome:name`). | `url|version`, `outcome:name`, external URI | Authoring route targets |
| S7.2 | 7.2 Named Outcomes | Use `outcome:` URI scheme for application-defined dispositions (ineligible, closed, review, referral). Not an enumeration -- custom outcomes allowed. SC-19: processors MUST pass named outcomes through without interpretation. | outcome:ineligible, outcome:closed, outcome:review, outcome:referral, SC-19 | Defining or handling non-Definition route destinations |
| S7.3 | 7.3 Formspec Definition References | `url|version` syntax references a specific Definition version. Consuming application resolves the reference; the screener processor does not load or validate it. Bare URL without version means "latest compatible version." | url|version, bare URL, consumer resolves | Understanding how screeners reference target Definitions |

### Determination Record (Lines 696-838)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S8 | 8. Determination Record | The primary output artifact of screener evaluation. Separate schema (`schemas/determination.schema.json`, `$id: https://formspec.org/schemas/determination/1.0`). | Determination Record, output artifact, separate schema | Understanding the screener's output document |
| S8.1 | 8.1 Structure | Complete JSON example showing a Determination Record with screener reference, timestamp, status, overrides (empty), two phase results (fan-out eligibility + score-threshold form selection), inputs with answer states (including declined and not-presented), and validity. | Determination Record structure, complete example | Seeing the full shape of a Determination Record |
| S8.2 | 8.2 Determination Record Properties | Property table: `$formspecDetermination` (required, "1.0"), `screener` (required, {url,version}), `timestamp` (required, ISO 8601), `evaluationVersion` (required, semver -- may differ from screener.version per evaluationBinding), `status` (required: completed/partial/expired/unavailable), `overrides` (required: {matched, halted}), `phases` (required, PhaseResult array -- empty if overrides halted), `inputs` (required, map of path->{value,state}), `validity` (optional: {validUntil, resultValidity}). | $formspecDetermination, status enum, evaluationVersion, inputs map, validity | Authoring, validating, or consuming Determination Records |
| S8.3 | 8.3 Phase Result Properties | Property table: `id`, `status` (evaluated/skipped/unsupported-strategy), `strategy`, `matched` (RouteResult array), `eliminated` (RouteResult array), `warnings` (string array, e.g. "below-minimum"). | PhaseResult, evaluated, skipped, unsupported-strategy, warnings | Understanding per-phase output structure |
| S8.4 | 8.4 Route Result Properties | Property table: `target`, `label`, `message` (preserved for display), `score` (score-threshold only), `reason` (eliminated only: condition-false/below-threshold/max-exceeded/null-score), `metadata`. | RouteResult, elimination reasons, null-score | Understanding per-route output structure |
| S8.5 | 8.5 Determination Record as Extension Point | The normative record is the minimum. Extensions MAY add operator identity, digital signatures, audit timestamps, calculation breakdowns, linked prior determinations, consent records. SC-20: extensions use `extensions` property and MUST NOT modify normative properties. | SC-20, extensions, operator identity, signatures, audit | Extending the Determination Record for domain-specific needs |

### Lifecycle (Lines 840-922)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S9 | 9. Lifecycle | Defines availability windows, result validity, and evaluation binding. | lifecycle primitives | Understanding screener lifecycle management |
| S9.1 | 9.1 Availability Window | `availability.from` and `availability.until` (both optional ISO 8601 dates, inclusive). SC-04: processors MUST NOT begin new sessions outside the window (SHOULD route to outcome:closed). SC-05: sessions started within the window MUST complete even if the window closes mid-session. | availability, from, until, SC-04, SC-05, outcome:closed | Implementing time-bounded screener access |
| S9.2 | 9.2 Result Validity | `resultValidity` is an ISO 8601 duration (P14D, P90D, P1Y). SC-21: Determination Record MUST include validity object with computed validUntil. SC-06: expired records MUST NOT be treated as valid; consuming application SHOULD prompt re-screening. When omitted, no expiration. | resultValidity, validUntil, SC-21, SC-06, ISO 8601 duration | Implementing Determination Record expiration |
| S9.3 | 9.3 Evaluation Binding | `evaluationBinding`: "submission" (default -- rules at session start govern) or "completion" (rules at completion govern). SC-07: evaluationVersion in Determination Record MUST reflect the actual version applied. Stateless processors should use the version available at evaluation time. | evaluationBinding, submission, completion, SC-07, evaluationVersion | Implementing version pinning for mid-session screener updates |

### Processing Model (Lines 924-990)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S10 | 10. Processing Model | Normative evaluation order and special processing modes. | processing model | Implementing a conformant screener processor |
| S10.1 | 10.1 Evaluation Order | 6-step ordered pipeline: (1) Availability check (SC-04, produce "unavailable" Determination Record with outcome:closed), (2) Item collection (binds in isolated scope, presentation order not prescribed), (3) Answer state recording, (4) Override evaluation (terminal check), (5) Phase evaluation (declaration order, activeWhen guard), (6) Determination Record assembly. | 6-step pipeline, availability check first, override before phases | Implementing the end-to-end evaluation flow |
| S10.2 | 10.2 Partial Evaluation | Processors MAY produce "partial" Determination Records when not all items answered. Unanswered items marked not-presented. SC-22: partial records MUST NOT be treated as definitive routing decisions. Enables save-and-resume and progressive disclosure. | partial evaluation, SC-22, save-and-resume | Implementing partial/incremental screener completion |
| S10.3 | 10.3 Re-screening | Spec does not define re-screening mechanics. Determination Records MAY be linked via extensions (e.g. `x-rescreening.supersedes`). Semantics are extension-defined. | re-screening, supersedes, extension-linked | Understanding how to link multiple screening sessions |

### Conformance (Lines 992-1015)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S11 | 11. Conformance | Two conformance levels and extension handling. | conformance levels | Determining what a processor must implement |
| S11.1 | 11.1 Conformance Levels | Core: must support first-match, Determination Record, availability, result validity, answer states. Complete: must support all normative strategies, overrides with terminal, activeWhen, all Determination Record properties. Core processors MAY reject fan-out/score-threshold but MUST clearly report rejection. | Core level, Complete level | Determining minimum vs full implementation requirements |
| S11.2 | 11.2 Extension Conformance | SC-23: unsupported extension strategies (x- prefix) must be skipped (phase status "unsupported-strategy" in Determination Record). MUST NOT fail the entire evaluation. | SC-23, unsupported-strategy, graceful degradation | Handling unknown extension strategies |

### Extension Points (Lines 1017-1068)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S12 | 12. Extension Points | Four extension surfaces: custom strategies, document extensions, route metadata, Determination Record extensions. | extension points | Extending the screener spec |
| S12.1 | 12.1 Custom Strategies | Extension strategies use `x-` prefix. Config object carries strategy-specific configuration. SC-24: extension strategies MUST follow the same route evaluation contract (receive routes, produce matched/eliminated sets). | x- prefix, custom strategy, SC-24 | Implementing a custom evaluation strategy |
| S12.2 | 12.2 Document Extensions | Top-level `extensions` follows the same mechanism as Definition extensions (core S4.6). | document extensions, core S4.6 | Adding domain-specific metadata to the Screener Document |
| S12.3 | 12.3 Route Extensions | Routes use `metadata` (opaque, preserved in Determination Record) rather than the `extensions` mechanism. Metadata is for output annotation (classification codes, severity tags), not behavioral extension. | metadata vs extensions, opaque, output annotation | Adding domain-specific annotations to individual routes |
| S12.4 | 12.4 Determination Record Extensions | Determination Record MAY include `extensions` property for domain-specific output (per S8.5). | Determination Record extensions | Extending the output record with domain data |

### Examples (Lines 1070-1428)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S13 | 13. Examples | Four complete end-to-end Screener Document examples covering all normative strategies, overrides, and multi-phase evaluation. | -- | Seeing realistic complete screener configurations |
| S13.1 | 13.1 Simple Grant Eligibility (first-match) | Direct translation of core S4.7 embedded screener into standalone format: single-item money field, single first-match phase with fallback, two Definition targets. | first-match example, S4.7 migration, fallback route | Seeing the simplest possible screener and S4.7 migration pattern |
| S13.2 | 13.2 Multi-Benefit Eligibility (fan-out) | Benefit navigator: household items, single fan-out phase evaluating SNAP/LIHEAP/WIC eligibility simultaneously. Uses domain-specific `fpl()` function. | fan-out example, multi-benefit, fpl(), simultaneous evaluation | Seeing a fan-out screener for multi-program eligibility |
| S13.3 | 13.3 Clinical Trial with Overrides and Scoring | Clinical trial pre-screening: terminal overrides for pregnancy and stage IV exclusion, score-threshold phase with composite eligibility scoring (neutrophil count, ECOG, prior treatments). Three tiers: eligible, borderline review, ineligible. | override + score-threshold example, terminal overrides, composite scoring, clinical trial | Seeing overrides combined with scoring in a safety-critical domain |
| S13.4 | 13.4 Multi-Phase Behavioral Health Intake | Three-phase screener: (1) terminal crisis override for active suicidal ideation with plan, (2) LOCUS-based level-of-care score-threshold (residential/PHP/IOP/outpatient), (3) fan-out program matching (substance use, co-occurring, FEP, trauma, child/adolescent). | multi-phase example, crisis override, LOCUS scoring, program matching, behavioral health | Seeing a full multi-phase screener combining all three strategies |

### Security Considerations (Lines 1430-1473)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| S14 | 14. Security Considerations | Security guidance for sensitive data, evaluation logic confidentiality, and override route safety. | security | Understanding security implications of screener implementations |
| S14.1 | 14.1 Sensitive Data | Screener items frequently collect sensitive PII (health, income, immigration, criminal history). Implementations SHOULD encrypt at rest and in transit, apply access controls, support data retention policies (HIPAA, FERPA, GDPR), and protect declined answer states. | sensitive data, encryption, HIPAA, FERPA, GDPR, declined state protection | Implementing data protection for screener responses |
| S14.2 | 14.2 Evaluation Logic Confidentiality | Some domains require confidential evaluation logic (clinical blinding, fraud detection, sanctions). Implementations MAY support server-side-only evaluation, redacted Determination Records, and headless API mode. | confidential logic, server-side evaluation, redacted records, headless API | Implementing screeners where the logic itself is sensitive |
| S14.3 | 14.3 Override Route Safety | Terminal overrides are safety-critical. Implementations SHOULD audit changes, prevent accidental deletion/reordering, and ensure terminal overrides cannot be bypassed by client-side manipulation. | terminal override safety, audit, bypass prevention | Implementing safety controls around override routes |

### Appendices (Lines 1475-1508)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| App A | Appendix A: Migration from Core S4.7 | Mechanical 6-step migration: extract screener object, create Screener Document with required properties, move items/binds, wrap routes in single first-match phase, remove screener from Definition. The embedded `definition.screener` mechanism is deprecated. | S4.7 migration, 6-step algorithm, deprecated embedded screener | Migrating existing embedded screeners to standalone documents |
| App B | Appendix B: Relationship to Sidecar Documents | Comparison table: Theme/Component/Mapping bind inward to a Definition (projections), Screener has no binding and points outward to Definitions (gateway). Screener is the only sidecar document without target binding. | gateway vs projection, no target binding, sidecar comparison | Understanding the screener's unique architectural role among sidecar documents |

## Cross-References

| Reference | Context | Location |
|-----------|---------|----------|
| Formspec v1.0 core specification | Parent spec; Screener is a companion. Item schema (S4.2), Bind schema (S4.3), FEL (S3), embedded screener (S4.7), extensions (S4.6) are incorporated by reference. | Abstract, S1.1, S1.3, S2.1, S3.1, S3.2, S3.4, S12.2 |
| Core S4.7 (embedded screener) | The standalone Screener Document replaces and generalizes this mechanism. Every valid S4.7 screener is expressible as a single first-match phase. Deprecated in favor of standalone documents. | S1.1, S1.3, S5.1, S13.1, Appendix A |
| Core S4.2 (Item schema) | Screener items use the same Item schema. All item types and data types are valid. | S1.3, S3.1 |
| Core S4.3 (Bind schema) | Screener binds use the same Bind schema. All bind properties supported. | S1.3, S3.2 |
| Core S3 (FEL) | FEL is the computation substrate for all conditions, score expressions, and calculated values. Screener processors MUST implement FEL. | S1.3, S3.4, S3.5 |
| Core S3.4 (FEL null propagation) | Null propagation rules apply to screener FEL expressions, affecting how declined/not-presented items behave in conditions and scores. | S3.5 |
| Core S4.3.3 (path syntax) | Determination Record inputs use the same path syntax including indexed repeat paths. | S8.2 |
| Core S4.6 (extensions) | Screener Document extensions follow the same mechanism as Definition extensions. | S2.1, S12.2 |
| schemas/screener.schema.json | Canonical JSON Schema governing Screener Document structure. | S2 (implied) |
| schemas/determination.schema.json | Standalone schema for the Determination Record output (`$id: https://formspec.org/schemas/determination/1.0`). | S8 |
| Semantic Versioning 2.0.0 | `version` follows semver. Independent of any Definition version. | S2.1 |
| ISO 8601 | Duration syntax for `resultValidity`, date syntax for `availability`, datetime for timestamps. | Conventions, S9.1, S9.2, S8.2 |
| RFC 2119 / RFC 8174 | Normative keyword definitions. | Conventions |
| RFC 8259 (JSON) | JSON syntax standard. | Conventions |
| RFC 3986 (URI) | URI syntax for `url`, route targets. | Conventions |
| Theme, Component, Mapping specs | Compared in Appendix B as inward-binding projections vs the Screener's outward-pointing gateway role. | S2.3, Appendix B |

## Conformance Rule Quick Reference

| Rule | Summary |
|------|---------|
| SC-01 | Preserve answer states in Determination Record; three states must be distinguishable; declined != null |
| SC-02 | Declined items evaluate as null in FEL |
| SC-03 | Not-presented items evaluate as null in FEL |
| SC-04 | Must not begin sessions outside availability window; route to outcome:closed |
| SC-05 | Sessions started within window must complete even if window closes |
| SC-06 | Expired Determination Records must not be treated as valid |
| SC-07 | evaluationVersion must reflect actual version applied |
| SC-08 | first-match routes must have condition |
| SC-09 | fan-out routes must have condition |
| SC-10 | score-threshold routes must have score and threshold |
| SC-11 | Condition evaluating to null treated as false |
| SC-12 | Score evaluating to null treated as negative infinity (reason: null-score) |
| SC-13 | Must recognize all top-level properties; reject if required property missing |
| SC-14 | Item keys unique within Screener; may collide with Definition keys |
| SC-15 | Phase id must match `[a-zA-Z][a-zA-Z0-9_-]*` |
| SC-16 | Extension strategies must use x- prefix |
| SC-17 | Processors not supporting message interpolation must display raw string |
| SC-18 | Override routes evaluated before phases, in cross-phase declaration order, no short-circuit |
| SC-19 | Named outcomes passed through without interpretation |
| SC-20 | Determination Record extensions use extensions property, must not modify normative properties |
| SC-21 | When resultValidity declared, Determination Record must include validity object with validUntil |
| SC-22 | Partial Determination Records must not be treated as definitive routing decisions |
| SC-23 | Unsupported extension strategies: skip phase, record "unsupported-strategy" |
| SC-24 | Extension strategies must follow route evaluation contract (matched/eliminated sets) |
| SC-25 | Override routes must have condition |

## Critical Behavioral Rules

1. **Screener items are NOT part of any form's instance data.** They exist solely for routing classification. Answers feed into evaluation conditions and scores but are never included in a Definition's Response.

2. **Screener scope is absolutely isolated.** Screener binds and FEL expressions reference screener item keys only. They cannot reference Definition items, bind values, or shape results -- and vice versa. There is no cross-scope visibility.

3. **Override routes are evaluated BEFORE the phase pipeline, not within it.** All overrides are hoisted out of their declared phases and evaluated first. All override routes are checked regardless of prior matches (no short-circuit within override evaluation).

4. **Terminal override halting is two-stage.** First, ALL override routes are evaluated (no early exit). Second, if ANY matched override has `terminal: true`, the phase pipeline is halted entirely -- no phases execute, phases array is empty, `overrides.halted` is true.

5. **A condition evaluating to null is treated as false (SC-11).** A score evaluating to null is treated as negative infinity (SC-12, reason "null-score").** This follows from FEL null propagation when referencing declined or not-presented items.

6. **The three answer states (answered, declined, not-presented) must be distinguishable.** Declined is NOT equivalent to null or to answered-with-null. Both declined and not-presented evaluate as null in FEL, but the distinction is preserved in the Determination Record for audit purposes.

7. **Phases are independent.** A matched route in one phase does not prevent other phases from executing. Results from all phases aggregate into the Determination Record. The only mechanism that halts the pipeline is a terminal override.

8. **Score-threshold routes are ranked by score descending, with ties broken by declaration order.** All routes are evaluated regardless of prior matches (not first-match). Routes matching if `score >= threshold`.

9. **Fan-out config.maxMatches truncates by declaration order.** Excess matches beyond maxMatches are added to the eliminated set with reason "max-exceeded", keeping only the first N in declaration order.

10. **Availability window enforcement: sessions started within the window MUST complete (SC-05).** The evaluationBinding property controls which version of the rules governs when the screener is updated mid-session.

11. **Screeners have no target binding.** Unlike Theme/Component/Mapping documents, a Screener has no `targetDefinition` or `definitionRef`. It is a gateway, not a projection. The association between a screener and its forms is a project-level concern.

12. **The Determination Record has its own standalone schema** (`schemas/determination.schema.json`), separate from the Screener Document schema. They are validated independently.

13. **Route message interpolation uses `{{expression}}` syntax** where expression is FEL evaluated against screener item values. Literal `{{` is escaped as `\{{`. Processors that do not support interpolation MUST display the raw string (SC-17).

14. **Named outcomes use `outcome:name` URI scheme** and are NOT an enumeration -- applications MAY define custom outcome names. Processors MUST pass them through without interpretation (SC-19).

15. **A Core conformance processor MAY reject fan-out and score-threshold strategies** but MUST clearly report the rejection rather than silently degrading behavior.
