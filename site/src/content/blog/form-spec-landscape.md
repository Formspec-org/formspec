---
title: "517 features, 6 standards: what we learned surveying the form specification landscape"
description: "We decomposed XForms, SHACL, FHIR, JSON Forms, SurveyJS, and ODK into 517 testable features before writing Formspec. Here's what each system gets right, where each falls short, and what the gaps tell you about the state of form infrastructure."
date: 2026-03-18
tags: ["research", "deep-dive", "specification"]
author: "Michael Deeb & Claude"
---

Before writing a single line of specification, we read six standards cover-to-cover and decomposed them into 517 independently testable features. Each feature was classified against our synthesized proposal: **Adopted** (directly incorporated), **Adapted** (spirit captured, mechanism differs), or **Missing** (not addressed). The result is a feature matrix that maps the entire form specification landscape — what exists, what's genuinely novel, and where the gaps are.

This post walks through that landscape. If you're evaluating form systems for high-stakes environments — grants, compliance, clinical intake, field inspection — this is the terrain.

## The methodology

Six sources. 517 features. Three classification buckets.

| Source               | Features | Adopted | Adapted | Missing |
|----------------------|----------|---------|---------|---------|
| XForms 1.1 *         | 198      | 92      | 52      | 54      |
| XForms 2.0           | 74       | 16      | 17      | 41      |
| SHACL                | 70       | 42      | 16      | 12      |
| FHIR R5 / SDC        | 80       | 40      | 17      | 23      |
| Secondary Influences | 95       | 51      | 21      | 23      |

\* XForms 1.1 was analyzed in two passes — a feature-by-feature spec review (110 features) and a deeper conceptual model analysis of evaluation semantics, scoping rules, and the processing cycle (88 features).

The secondary influences bucket covers JSON Forms, React JSON Schema Form (RJSF), SurveyJS, ODK XLSForm, and CommonGrants — the tools most developers have actually touched.

One number stands out: **all 97 Critical-priority features are Adopted or Adapted.** Zero critical gaps. The missing features cluster around XML-specific mechanisms, UI-level events, submission transport, and convenience functions — things that are either out of scope by design or handled by the host application.

[Why another form thing?](/blog/why-another-form-thing) covers the three W3C-era standards (XForms, SHACL, FHIR) in detail. Here I'll focus on what each system contributed, what we deliberately didn't adopt, and — most importantly — the practical tools that most developers have actually used.

## The W3C-era foundations: XForms, SHACL, FHIR

**XForms** (~40% of Formspec's DNA) gave us the core architecture: five Model Item Properties (`calculate`, `relevant`, `required`, `readonly`, `constraint`) evaluated reactively over a dependency graph, with non-relevant data handling specified precisely. We absorbed 73 of its 110 features. What we didn't adopt: the entire XML submission pipeline, the declarative action language, and DOM-level events. XForms is the right architecture trapped in the wrong data format.

**SHACL** (~15%) gave us the validation model. Named shapes with targets, severity levels, logical composition (`and`/`or`/`not`/`xone`), and structured results. One deliberate divergence: SHACL's `sh:conforms` is false if *any* results are produced — even warnings. Formspec's `valid` property only considers `error` severity, because treating every warning as a conformance failure doesn't match how compliance workflows actually operate.

**FHIR R5/SDC** (~15%) gave us the identity and versioning layer. Canonical URLs, semver with algorithm declaration, lifecycle status, responses pinned to definition versions, and modular composition via assembly. We adopted or adapted 61 of 80 features (76%), skipping the healthcare-specific semantics and FHIR's deeply nested coding systems.

These three sources account for ~70% of Formspec's feature set. The remaining story — and the part most relevant to developers choosing a form system today — is in the tools you've actually heard of.

## The interesting adaptations

The "Adapted" column — 123 features where the spirit was captured but the mechanism differs significantly — is where the most interesting design decisions live.

**XPath → FEL.** XForms' expression language is XPath 1.0. Powerful, but XML-native and notoriously hard for non-developers. We replaced it entirely with FEL — same role (reactive expressions for binds and validation), different syntax and execution model. FEL is JSON-native, statically analyzable, and implemented identically in TypeScript and Python.

**Four-phase processing → signal-based reactivity.** XForms names four discrete phases (rebuild, recalculate, revalidate, refresh). Formspec specifies the *ordering* of MIP evaluation (calculate → relevant → required/readonly → constraint) but lets the signal graph handle propagation. Same guarantees, different runtime model.

**SHACL node shapes → path-targeted shapes.** SHACL targets shapes to RDF node types. Formspec targets shapes to field paths with wildcard support (`items[*].amount`). Same composition model, different targeting mechanism.

**FHIR `initialExpression` vs. `calculatedExpression` → split across two mechanisms.** FHIR's distinction between one-time and continuous expressions maps to two Formspec features: `initialValue` (supports expression strings prefixed with `=`, evaluated once at creation) and `calculate` binds (continuously reactive). The concepts are adopted but live in different places than FHIR puts them.

## JSON Forms: what it gets right and where it breaks

JSON Forms is probably the tool most readers have used in production. Its core insight is correct: **separate data schema from UI schema.** A JSON Schema describes your data model. A separate UI schema describes how to render it. A renderer set maps schema types to components. The UI schema is optional — JSON Forms can auto-generate a default layout from the data schema alone.

We adopted this separation — it's Formspec's Core/Theme/Component tier architecture. We also adopted JSON Forms' external error injection pattern (`additionalErrors`), which lets server-side validation results flow into the client-side display using the same AJV `ErrorObject` format as client-side validation. And its renderer architecture — swappable sets for Material UI, Vanilla, Angular Material, Vue Vuetify — directly influenced our component registry.

JSON Forms also gets validation modes right in principle. Three modes — `ValidateAndShow`, `ValidateAndHide`, `NoValidation` — cover the practical states you need (display errors, validate silently for programmatic access, or skip entirely). We adopted a similar pattern with richer granularity: three runtime modes (`continuous`, `deferred`, `disabled`) plus per-shape `timing` declarations.

**But JSON Forms has four critical limitations:**

**1. No expression language.** JSON Forms' conditional logic works by validating data against JSON Schema fragments. Want to hide a field when `counter` equals 10?

```json
{
  "rule": {
    "effect": "HIDE",
    "condition": {
      "scope": "#/properties/counter",
      "schema": { "const": 10 }
    }
  }
}
```

This is clever — it reuses JSON Schema syntax for conditions, so there's no new language to learn. But it breaks down fast. You cannot write `total_budget - amount_spent` and have it reactively recompute. There is no `calculate`, no `constraint` beyond what JSON Schema provides, no way to express cross-field relationships declaratively. Every team building complex forms on JSON Forms ends up writing imperative JavaScript to fill this hole.

**2. No calculation model.** Without expressions, there are no computed values. No way to declare "this field's value is the sum of those line items." You do it in application code and push values back in. In Formspec, that's a one-liner: `"calculate": "sum(line_items[*].amount)"`.

**3. Single-scope rule conditions.** Each rule condition evaluates one `scope` against one JSON Schema fragment. You can show field B when field A equals "yes." For multi-field conditions, you can scope to `#` (root) and write nested JSON Schema with `required` and `properties` — but you're now writing JSON Schema validation rules to express "show this section when the budget exceeds $50,000 AND the reporting period is quarterly." It works. It's not pleasant.

**4. No repeat expressions.** You can't aggregate over array items declaratively. No `sum(line_items[*].amount)`. No `count(participants[*])`. No expressions that span repeat instances.

These aren't obscure edge cases. They're the exact features that high-stakes form scenarios require. Grant applications need cross-field budget validation. Compliance reports need computed totals. Inspection checklists need conditional sections based on multiple field values. JSON Forms can render the form, but the logic lives in your application code — unversioned, untestable by the form system, and reimplemented on every platform.

Formspec's FEL (Formspec Expression Language) addresses all four gaps directly. It's purpose-built, JSON-native, deterministic, side-effect-free, and dual-implemented in TypeScript and Python. ([Designing FEL](/blog/fel-design) covers the full comparison — the same expressions written in FEL, CEL, JSONLogic, JSONata, Power Fx, and JEXL side by side.)

## React JSON Schema Form (RJSF): same premise, same ceiling

RJSF starts from the same premise as JSON Forms — JSON Schema for data, a UI schema for presentation, a widget registry — but the UI schema is architecturally different. Where JSON Forms uses a structured layout tree (`VerticalLayout` → elements → `Control`), RJSF's `uiSchema` is a flat key-value overlay: `{ "name": { "ui:widget": "text" } }`. Less expressive for complex layouts, but simpler for basic forms.

RJSF shares the same critical limitation: no expression language. It adds `dependencies` for conditional fields, but that relies on a deprecated JSON Schema feature and still only handles one-field-at-a-time conditions. There's no `relevant` equivalent — showing and hiding fields requires schema manipulation or custom widgets.

Both JSON Forms and RJSF validate Formspec's architecture more than they compete with it. They prove that JSON Schema + UI schema separation works. They prove that component registries work. And they prove — by absence — that an expression language isn't optional for complex forms.

## SurveyJS: the expression engine that proved it's possible

SurveyJS is the most interesting secondary influence because it actually has an expression engine. A PEG.js-based parser with dependency tracking, `{field_name}` references, date functions, aggregate functions — a real, working expression system powering production forms.

SurveyJS expressions look like this:

```
visibleIf: "age({birthdate}) >= 16"
requiredIf: "{employment_status} = 'employed'"
```

It has rich comparison operators (`empty`, `notempty`, `contains`, `anyof`, `allof`), built-in functions (`iif()`, `age()`, `today()`, `sum()`, `avg()`, `dateDiff()`), custom function registration with async support, and — critically — a `validateExpressions()` API that detects unknown variables, unknown functions, and semantic errors at authoring time. That last feature directly inspired our Python linter.

We adopted several SurveyJS patterns: the static expression validation concept, expression-based validation with custom messages, and the overall proof that a JavaScript expression engine with automatic dependency tracking is practical at scale.

**But SurveyJS has its own gaps:**

- **No data/UI schema separation.** Everything is one JSON document. Definition, layout, and logic are interleaved. You can't version the data model independently from the presentation. You can't swap renderers without touching your form definitions.
- **No formal dependency graph exposure.** The engine parses expressions on instantiation and tracks which values they reference — but the graph isn't exposed. You can't lint expressions across a form, detect cycles statically, or visualize data flow. Formspec's `DependencyVisitor` builds and exposes the full graph.
- **Repeat context navigation is ad-hoc.** SurveyJS has `{row.columnid}`, `{prevRow.columnid}`, and `{parentPanel.qid}` — special-cased syntax for common patterns. FEL provides equivalent capability through `prev()`, `next()`, and `parent()` functions with a unified path resolution model rather than prefix-based shortcuts.
- **Proprietary expression language.** Not based on any standard. The grammar exists internally (PEG.js requires one), but there's no published specification. One implementation, one runtime. If you need the same logic on a Python backend, you rewrite it.

The lesson from SurveyJS: expression engines work. The challenge is designing one that's also formally specified, statically analyzable, and portable across runtimes. That's FEL.

## ODK XLSForm: readability at scale

ODK's contribution is subtle but important: **field reference syntax matters.** ODK proved that `${field_name}` shorthand — which compiles down to XPath under the hood — dot notation for nested values, and the `.` self-reference in constraints make the difference between form definitions that domain experts can review and definitions that only developers can parse.

An ODK constraint reads: `. >= 18` (the current field must be at least 18). A calculation reads: `round(${bill_amount} * 0.18, 2)`. Readable to a program officer, not just a developer.

FEL adopted bare field references (`total_budget` rather than `instance('main')/data/total_budget`), dot-path notation, and the `.` self-reference operator — all descended from ODK's readability focus. Where ODK hits its ceiling is the underlying XPath engine: complex expressions require XPath knowledge, there's no dependency graph (every expression re-evaluates on every change), and the spreadsheet authoring format doesn't translate to programmatic or API-driven form definition.

## CommonGrants: bidirectional mapping

CommonGrants contributed the mapping DSL concept — the idea that form data needs structured, bidirectional transformations to flow between the form engine and external systems. Their three mapping operations are minimal and expressive:

```json
{ "field": "summary.opportunity_amount" }
{ "const": "USD" }
{ "switch": { "field": "status", "case": { "active": "open" }, "default": "custom" } }
```

Our Mapping specification with `field`, `const`, and `switch` operations descends directly from this work, extended with FEL expressions for computed transforms and adapter support for CSV, XML, and alternate JSON layouts.

## What's deliberately missing

153 features are classified as Missing. Most are intentional omissions, but a few are genuine gaps we plan to address.

**Intentional skips:** XML-specific mechanisms (namespace prefixes, schema composition), the HTTP submission pipeline (Formspec produces data; transport is the host's problem), DOM/UI events (delegated to the web component layer), privacy metadata (`p3ptype`), cryptographic functions, and XForms' declarative action language.

**XForms 2.0 has the lowest adoption at 45%** — and that's deliberate. Most XF2 features address XML-specific concerns, add UI-level mechanisms, or provide conveniences already subsumed by FEL. The useful XF2 innovations we did adopt: non-relevant handling modes and multiple constraints per field.

**Genuine gaps on the roadmap:** Predicate filtering on repeat paths (`items[status = 'active'].amount`), quantified expressions (`every`/`some`), and declared runtime inputs (`launchContext`). These are the features where the research identified real missing capability, not design divergence. (Several other gaps flagged in the original research — repeat context navigation, one-time defaults, field validity queries — have since been addressed: `prev()`/`next()`/`parent()` functions, `initialValue` with expression support, and `valid()`.)

## What's genuinely new

After absorbing ~80% of what the landscape offers, about 20% of Formspec is original:

1. **FEL** — No predecessor expression language was built to be simultaneously JSON-native, deterministic, side-effect-free, and dual-implemented.
2. **Non-relevant field policy** — Separate submission vs. evaluation behavior for non-relevant fields. XForms 1.1 retains values in memory but prunes from submission — one policy for everything. XForms 2.0 added three modes (`keep`, `remove`, `empty`) but as a global setting. Formspec splits this into two independent properties: `nonRelevantBehavior` (controls submission serialization — overridable per-bind, not just global) and `excludedValue` (controls what downstream expressions see for non-relevant fields' in-memory values). Two separate axes that XForms conflates into one.
3. **`money` composite type** — Decimal-string arithmetic with currency enforcement. Financial forms shouldn't depend on IEEE 754.
4. **Per-shape validation timing** — Individual shapes declare when they fire (`continuous`, `submit`, `demand`), independent of the global validation mode. "Budget must balance" fires at submit. "Formatting looks unusual" fires continuously.
5. **Screener routing** — Declarative form variant selection based on initial answers.

## The lineage

If you had to draw a pie chart of Formspec's DNA:

| Origin | Contribution |
|--------|:---:|
| XForms 1.1 / Conceptual Model | ~40% |
| SHACL | ~15% |
| FHIR R5 / SDC | ~15% |
| Secondary Influences (ODK, SurveyJS, JSON Forms, CommonGrants, RJSF) | ~10% |
| Original Formspec innovations | ~20% |

XForms is the skeleton. SHACL is the validation system. FHIR is the identity layer. The secondary influences are the practical patterns. And about a fifth is things nobody else has built.

## Choosing a form system

If your forms are simple — contact forms, surveys, customer feedback — pick the tool with the best DX for your stack and move on. JSON Forms for React, SurveyJS for no-code authoring, RJSF for quick prototypes. They all work.

The landscape gets thin when your requirements include more than two of these:

- Cross-field expressions that run identically on client and server
- Computed values with automatic dependency tracking
- Validation results that are machine-readable, not just display strings
- Form definitions that are version-controlled, lintable, and schema-validated
- Data that flows into compliance databases, audit trails, or PDF generation

No single existing system covers all five. That's the gap this research quantified — and the gap Formspec was built to close.

The [full comparative analysis](https://github.com/mikewolfd/formspec/blob/main/thoughts/research/comparative-analysis.md) is public: 517 features, every classification documented, every design decision traceable to prior art or an explicit gap.
