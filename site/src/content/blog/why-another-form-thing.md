---
title: "Why another form thing?"
description: "Forms have been solved a hundred times — unless your data actually matters. A look at the gap between form builders and form infrastructure, and how six prior-art standards shaped Formspec."
date: 2026-02-18
tags: ["specification", "deep-dive", "research"]
author: "Michael Deeb & Claude"
---

If you're building a contact form or a customer survey, stop reading. You're well served. Google Forms, Typeform, React Hook Form, SurveyJS, Formik — pick one, ship it, move on.

This post is for the other teams. The ones building grant applications for federal agencies, regulatory compliance reports, field inspection checklists, clinical intake workflows. Teams building forms where the data actually matters — where what gets submitted feeds into compliance databases, audit trails, analytics pipelines, and PDF generation systems that can't tolerate ambiguity.

Those teams keep falling through the cracks.

The conditional logic is genuinely complex — not "show field B when field A is yes" but *"the total of all line items must not exceed the award amount, but only when the reporting period overlaps with the performance period, and only flag it at submission time."* Validation must run identically on client and server. Definitions must be version-controlled and linted like configuration. Data flows downstream into compliance databases, audit systems, and PDF generation.

No existing tool handles all of these. We looked — across six prior-art standards, extracting 517 distinct features. The gap is real.

## What's actually new

Before the research archaeology, here's what Formspec adds that no predecessor offers. This is the point of the project.

**FEL (Formspec Expression Language)** — XForms uses XPath, FHIR uses FHIRPath, ODK wraps XPath in macros, SurveyJS uses a custom PEG grammar. FEL was designed from the start to be JSON-native, deterministic, side-effect-free, and dual-implemented in TypeScript and Python. No predecessor expression language was built with all four of those goals.

**The `whenExcluded` policy** — When a field becomes non-relevant, what should its value be in running calculations? What about in the submitted response? XForms uses empty string for both. FHIR doesn't address it. Formspec lets you specify these independently — prune, null, or retain the default — because the right answer depends on the use case. A budget calculation should treat hidden line items as zero, but the submission should probably omit them entirely.

**Per-shape validation timing** — SurveyJS has validation timing as a global setting. XForms has no concept of deferred enforcement. Formspec separates *when* from *what*: three runtime modes (`continuous`, `deferred`, `disabled`) control the global pipeline, while individual shapes declare their own `timing` (`continuous`, `submit`, `demand`). A "budget must balance" shape fires at submit. A "formatting looks unusual" shape fires continuously. Saving is never blocked by validation — results are advisory until submission.

**Structured `explain` on validation results** — No predecessor provides machine-readable "how to display this error" metadata. Formspec shapes can declare which related fields to highlight and what context to show, enabling renderers to generate inline explanations rather than just red text.

**`Missing` as distinct from `null`** — Most form systems conflate "the user hasn't answered yet" with "the user explicitly set this to nothing." Formspec distinguishes these, which matters for progressive data collection and for expressions that need to know whether a field has been touched.

## Standing on the shoulders

None of this was invented from scratch. We spent three weeks doing comparative analysis across six standards — using AI to do the heavy reading — before writing a line of spec. (The companion post, [How we built Formspec](/blog/how-we-built-formspec), covers the full research pipeline.) Here's the lineage.

### XForms (W3C, 2003-2009)

XForms is the intellectual ancestor. The W3C got the architecture right twenty years ago: separate the data model from the business logic from the UI. Their key abstraction — **Model Item Properties** — five declarative expressions (`calculate`, `relevant`, `required`, `readonly`, `constraint`) attached to data nodes, evaluated reactively over a dependency graph. That's the complete set. Most form systems reinvent subsets of them, but XForms had all five, composable and unified, in 2003.

XForms also nailed non-relevant data handling — when a field becomes invisible, what happens to its value? Retained? Pruned? They thought through all the cases.

So why not just use it? Because it's welded to XML. The expression language is XPath. The data model is an XML document. The submission pipeline serializes to XML. In 2026, the systems that need these capabilities speak JSON, Python, and TypeScript.

We adopted the architecture wholesale and rebuilt it for JSON.

### SHACL (W3C, 2017)

SHACL gave us our validation model. Its key insight: validation rules should be first-class, composable objects — not anonymous predicates buried inside field definitions.

A SHACL shape is a named entity with a target, a severity (violation, warning, info), a constraint, and a structured result when it fails — which node, which value, which rule, all machine-readable. Compare that to a typical form library where validation produces a string: `"This field is required"`.

SHACL also provides logical composition — `and`, `or`, `not`, `xone` — for building complex rules from simple pieces. We adopted its three severity levels, structured results, composition operators, and the concept of shapes as reusable, named validation units.

### FHIR R5 / SDC (HL7, 2019-2024)

FHIR taught us about identity and evolution. Every questionnaire has a canonical URL, a version with explicit algorithm declaration, a lifecycle status (`draft`, `active`, `retired`), and responses pinned to specific definition versions. Exactly the rigor you need when form definitions are deployed across organizations and responses arrive months later requiring validation against the rules that existed when they were filled out.

FHIR's SDC expressions also validated our computed value model — the distinction between `initialExpression` (set once) and `calculatedExpression` (continuously recomputed) — and SDC's variable scoping gave us a clean model to adopt directly.

### The secondary influences

**ODK XLSForm** proved that field reference syntax matters for readability. **SurveyJS** demonstrated that a PEG-based expression engine with dependency tracking is practical at scale, and their static expression validation API directly inspired our linter. **JSON Forms** showed the power of separating data schema from UI schema, and their external error injection API influenced our external validation mechanism.

## The scorecard

Through those deep-dives, we decomposed each specification into independently testable behavioral requirements — 517 distinct features total — and classified each against our synthesis:

| Source                  | Total | Adopted | Adapted | Missing |
|-------------------------|------:|--------:|--------:|--------:|
| XForms 1.1              |   110 |      44 |      29 |      37 |
| XForms Conceptual Model |    88 |      48 |      23 |      17 |
| XForms 2.0              |    74 |      16 |      17 |      41 |
| SHACL                   |    70 |      42 |      16 |      12 |
| FHIR R5/SDC             |    80 |      40 |      17 |      23 |
| Secondary Influences    |    95 |      51 |      21 |      23 |

All 97 Critical-priority features are Adopted or Adapted — zero critical features missing. SHACL and the XForms Conceptual Model are the most thoroughly absorbed, at 83% and 81% adoption rates respectively. Those two form Formspec's backbone.

XForms 2.0 has the lowest adoption at 45%, but that's deliberate: most XF2 features address XML-specific concerns or low-priority conveniences. The missing features cluster around XML mechanisms, UI-level event handling, submission transport (delegated to the host application), and advanced repeat index management. Intentional omissions, not gaps.

## The synthesis

Formspec is not a greenfield invention. Its layered architecture comes from XForms' model/bind/UI separation. The validation model comes from SHACL's shapes. The identity and versioning model comes from FHIR. The expression language draws on all of them while belonging to none.

The alternative was picking one existing system and working around its limitations. XForms is brilliant but trapped in XML. SHACL is the right validation model but isn't a form system. FHIR is comprehensive but tied to healthcare semantics.

The gap was real. Formspec closes it. [Introducing Formspec](/blog/introducing-formspec) covers what we built. [Three weeks from research to runtime](/blog/how-we-built-formspec) covers how.
