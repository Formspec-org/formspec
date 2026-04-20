# Formspec Studio — Design Handoff

**Date:** 2026-04-20 (rewritten after review)
**Status:** Handoff for an original design pass
**Audience:** Designer producing a net-new Studio design

---

## 1. How to use this document

This explains what Formspec Studio is, who uses it, what it has to do, and what can't change. It does not specify screens, panels, nav patterns, or interaction models. Those are yours.

The current Studio has shipped; a quick summary is in §8. Treat it as a reference for the capability surface, not as a template. If you think the product should be structured differently than it is today, that's a valid outcome.

---

## 2. What Formspec is

Formspec is a **JSON-native specification for complex forms** — tax returns, grant applications, clinical intake, insurance claims, regulatory filings, safety inspections. Not contact forms or surveys. Forms with hundreds of fields, conditional sections, cascading calculations, cross-field validation, multi-format output, and offline requirements.

A Formspec form is a set of JSON documents — a Definition (the data model and its rules), plus optional Theme, Component, and Mapping documents, plus additional sidecars (Locale, References, Ontology, Registry, Changelog, Assist) that most authors never touch.

The same JSON renders identically on web, React, iOS, and server. The same validation runs in the browser and on the backend. The same calculations produce the same decimal-exact numbers offline on a tablet and on a cloud server.

Formspec is a specification, not a platform. There is no hosted service.

---

## 3. What Studio is

Studio is the authoring environment for Formspec — where someone sits down to build a form and leaves with a valid set of documents. It is a single-page web application, the reference implementation of what authoring should feel like. End users filling out the form never see Studio.

Studio has one job with two halves. Authors should be able to build and modify forms by **direct manipulation** of the form itself — items, rules, pages, styles, outputs. Authors should also be able to build and modify forms by **conversation with an AI collaborator** that understands the form and can mutate it through the same typed operations a human would. Neither half is a side panel on the other. Both are first-class. How they relate visually and interactively is open.

The short internal pitch is **"ChatGPT for forms"** — a non-technical author describes what they need in plain language, reviews what the system produces, refines through conversation and direct edits, and ends up with a working form without ever having written code. Take that frame seriously, but not literally: the question of whether conversation dominates the interface, shares it equally with direct manipulation, or lives alongside it is a design decision.

The AI is not freeform. It mutates the form through typed tool calls against a command catalog, constrained by JSON Schema, static analysis, and FEL validity. Nothing the AI produces can be structurally invalid; nothing it does is unreviewable or un-undoable. That is an asset the design can lean on — the product can truthfully promise that the AI cannot break the form.

---

## 4. Design philosophy

The specification was designed to be simple enough for a human to create by hand and structured enough for AI to compose forms of effectively unlimited complexity. A grant budget form is a few dozen lines of JSON a domain expert can read. A 300-field tax return with cascading calculations and multi-format output is the same shape — just more of it. Nothing about the spec gets heavier as the form gets harder. Studio's job is to give authors access to that full range of power without it feeling overwhelming at any point on the curve.

The spec separates concerns across several documents — data model, presentation, layout, output transforms, translations, references, ontology. That separation is architecturally valuable. The *benefits* should come through in the product: change the theme without touching logic, reuse a data model across layouts, retarget output to a new system by editing one document. The *mechanics* — four schemas, cross-document consistency, the coordination that separation requires — are authoring overhead the tool should absorb.

The JSON is the artifact, not the interface. The author works in concepts — fields, rules, pages, styles, outputs — and the tool produces correct JSON. Export exists so the author can hand the files to a developer or check them into a repository. A view-source affordance is reasonable for transparency. Neither needs to be prominent, and the primary user is never expected to edit JSON to accomplish a task.

---

## 5. Who uses Studio

The primary user is a **non-technical program manager or analyst** — the person who today files tickets with IT to get a form built, or spends months going back and forth with developers. They know their domain cold (grants, eligibility, clinical intake, inspections, compliance). They do not write code. They do not read schemas. They will not hand-edit JSON.

They can, however, read and write **FEL expressions**. FEL (the Formspec Expression Language) is deliberately Excel-like: `$personnel + $travel`, `if($income > 50000, $rate_a, $rate_b)`, `sum(items[*].amount)`. Someone who has written a formula in Excel or a calculated column in a spreadsheet can read and write the common cases. The AI will write most expressions for them; they will read what it produced and tweak it. For unusual expressions the AI struggles with, the author can edit directly. FEL is not a language this user is afraid of — treat it like a spreadsheet formula, not like code.

Typical settings:

- **Government program staff** — benefits, permitting, tax, licensing. Compliance-sensitive, Section 508 / WCAG expectations.
- **Nonprofit and grant operations** — grant applications, reports, submissions. Small teams, one person wearing many hats.
- **Clinical and health intake** — questionnaires, screening, referrals. Coded vocabularies (ICD-10, SNOMED, LOINC) matter.
- **Insurance and financial services** — claims, applications, underwriting. Calculation correctness and audit trails are non-negotiable.
- **Field inspection and compliance** — checklists, site surveys. Offline is not optional for the forms they produce.

Shared traits:

- Accountable for the form being correct. A bad calculation is their problem.
- Iterate constantly. Rules change mid-cycle, wording gets tweaked, sections come and go.
- Do not read docs. Expect the tool to teach them by being legible.
- Used to forms being second-class citizens in every tool they have.

A secondary user is the **developer or form engineer** who will inspect the bundle, integrate it into a stack, write mapping rules against an unusual target system, or extend the registry. They are not blocked — they can export, view source, and edit files in their own editor. But the screen is not for them. When a decision trades clarity for the program manager against convenience for the engineer, the program manager wins.

---

## 6. What Studio must be able to do

A list of verbs, not screens. How you group, surface, sequence, or collapse them is the design.

**Start a form.** From nothing, from conversation, from a built-in template (housing intake, grant application, patient intake, compliance checklist, employee onboarding), from an uploaded file (the AI adapter accepts file attachments today; only generic extraction exists — no per-format pipelines yet), from an existing JSON bundle (paste, drop, or import).

**Shape the data model.** Add, remove, rename, reorder, move, duplicate, and wrap items. Items are fields (collect a value), groups (nest items), or content (headings, paragraphs, banners, dividers — display only). Field types include single-line text, multi-line text, integer, decimal, boolean, date, datetime, time, choice, multi-choice, currency, email, phone, URL, file, signature, rating, and slider. Groups can be made repeatable with min/max cardinality. Authors also define named option sets (reusable choice lists), named variables (FEL expressions other logic can reference), and named instances (external data sources). Per-item metadata includes label, hint, placeholder, default, concept URI, help text, and references.

**Express logic.** Formspec has two mechanisms and the author needs both. **Binds** attach behavior to a single field: required, relevant (show/hide), readonly, constraint, calculate, default. **Shapes** attach cross-field or form-level rules with severity (error / warning / info), timing (continuous / deferred / disabled), and activation conditions. Both are written in FEL. The editor must help the author read and write FEL — autocomplete for field and function names, real-time parse feedback, dependency visualization (what does this field depend on; what depends on it), and static-error surfacing (circular references, undefined names, type mismatches). The AI will write most expressions; the human will read and tweak them.

**Organize into pages and flows.** Multi-page forms in wizard, tabs, or single-page modes. Assign items to pages; pages have order, title, description. **Screener routing** — an upfront mini-form that routes users into different branches based on their answers — is a first-class feature.

**Shape presentation.** Design tokens (colors, spacing, typography, radii), global defaults (label position, density, help text), a selector cascade that targets items by type, concept, or path, and per-item overrides. Breakpoints and responsive behavior.

**Shape layout.** Visual arrangement: which fields go where, how they cluster. Layout containers (stacks, cards, collapsibles, columns, sidebars, inline groups), drag-and-drop on a canvas, widget selection per field (which of the built-in components renders it), multi-page composition.

**Shape output.** Transforms from form response to target format — JSON, XML, CSV. Field-level rules with coercion and value maps. Preview the mapped result against a test response.

**Preview and test.** A live preview of the form as an end user would see it. Viewport switcher (mobile / tablet / desktop). Scenario data — pre-fill answers and watch conditional logic, calculations, and validation react. A **behavior view** that surfaces bind states (relevance, required, readonly, calculations) and diagnostics as scenario values change. Validate a response against the rules without leaving Studio. Headless evaluation is available (the underlying API exposes `previewForm` and `validateResponse` that run a form engine without a browser), which means preview and behavior views can be scenario-driven without full DOM rendering.

**Converse with the AI.** Two conversational flows exist in the product today and the design may unify or separate them:
- **Scaffolding** — the AI interviews the author, gathers requirements (from plain language, a template, or an uploaded file), and produces a first-draft form. The scaffold step produces a complete `FormDefinition` and swaps it in wholesale — it does not go through the incremental command catalog.
- **Refinement** — once a form exists, the author talks to the AI to modify it. Refinement goes through typed tool calls against the command catalog; every change is the same kind of operation a human would make and is therefore undoable and auditable. Refinement operations are grouped into **changesets** the author can open, review, accept, or reject as a unit.
Both flows stream, produce structural diffs, and support regenerating or truncating the conversation. Source tracing — linking elements back to the conversation turn that produced them — is populated today only in the standalone scaffold path; parity across both surfaces is a design/implementation question, not a given.

**Track issues.** Contradictions, low-confidence AI choices, missing configuration, and validation problems surface as a reviewable queue with severities and categories. Issues can be resolved, deferred, or reopened.

**Undo, redo, and look back.** Every human or AI mutation is a typed command. Undo and redo work across both. The underlying command history is available as data; whether Studio exposes it as a visible log is a design call (today it doesn't).

**Save, restore, hand off.** Session persistence — authors close tabs, crash, walk away, come back. Sessions list, open, resume. Export and import of the full bundle. Import from a partial bundle is undoable like any other operation.

**Navigate a large form.** A persistent notion of the selected item (field, group, rule, variable, mapping rule) that drives contextual panels. Fast navigation across all entities. Full-text / command-palette search. Entity counts at a glance. Filtering and scoped views at real form sizes (50–300 fields is typical; hundreds of binds, dozens of shapes, multiple repeat groups).

**Configure metadata and extensions.** Form title, description, version, status, page mode, density, label position. Extension registry configuration — which extensions are loaded, how they resolve. Authors of forms in regulated domains will also touch sidecars beyond the four main tiers (Locale for translations, References for citations and help text, Ontology for concept URIs, Changelog for versioned change logs, Assist for filling-side tooling). These are optional for most authors and rarely edited in-band; their authoring surface is a real scope question, not a given.

---

## 7. Constraints and technical realities

Things the design cannot change and things it should know about before making IA decisions.

**The four tiers are real, but the author shouldn't feel four tools.** Definition, Theme, Component, and Mapping are separate JSON documents with separate schemas, separately versioned. The benefits of that separation should come through in product behavior (theme swaps don't touch logic; layouts are editable without touching data; output retargets without rebuilding). The mechanics should be absorbed.

**Sidecars exist.** Beyond the four main tiers there are Locale, References, Ontology, Registry, Changelog, and Assist documents. Most authors won't touch them; regulated / multilingual / ontology-bound forms will. The design should have an answer for how a sidecar-authoring user reaches those surfaces without cluttering the primary experience.

**Every mutation is a typed command.** All edits — human or AI — flow through a command catalog. This is what makes undo/redo, audit logging, and AI tool-calling work uniformly. The design does not expose commands as a concept, but it cannot invent ad-hoc edit paths that bypass them.

**The AI's two paths are architecturally different.** Scaffolding produces a complete `FormDefinition` via structured output and swaps it in wholesale — it does not go through the command catalog, it replaces the definition. Refinement goes through the command catalog (the MCP server exposes roughly 48 tools, organized into around 28 consolidated families). This asymmetry matters for the design: an AI scaffold feels like a reset; an AI refinement feels like an edit. Today the two live in separate surfaces (integrated sidebar for refinement, standalone page for scaffolding). That split is implementation-driven, not product-required — a unified conversational experience is welcome.

**Changesets are the refinement primitive.** When the AI modifies an existing form, it opens a changeset, makes a batch of edits, and leaves it for the author to accept or reject as a unit. This is the mechanism behind "reviewable AI actions" — the design should assume it exists and build its review UX around it.

**Imports go through a two-phase lifecycle.** When a file is uploaded or a bundle is imported, the system first enters a **bootstrap** phase where the draft accumulates schema errors, then transitions to an **authoring** phase against a live project. This directly shapes empty-state, broken-import, and recovery UX.

**FEL is the logic language.** Excel-like syntax, statically analyzable, deterministic, side-effect-free. The AI writes most expressions; humans read and tweak them. The design needs authoring, reading, and debugging surfaces for FEL — the raw expression must be reachable even if a prose or visual rendering is offered alongside.

**Validation is two mechanisms, not one.** Binds (per-field) and shapes (cross-field, with severity and timing) are structurally different. The distinction should be legible — authors will conflate "this field is required" (bind) with "the budget must balance" (shape) unless the product helps them see the difference.

**Preview is the real engine.** The preview surface runs the actual `FormEngine` against the live definition. It is not a mock. Reactive updates, conditional visibility, calculations, and validation all execute through the same engine an end user would hit. The design can trust that what preview shows is what respondents will see.

**JSON is the artifact, not the interface.** The primary user never encounters JSON in the normal flow. Export exists. A view-source affordance exists for transparency. Neither is featured. No authoring path requires touching JSON.

**The output must be portable.** Nothing Studio produces can require Studio to run. An exported bundle has to work in any runtime (web component, React, iOS, server). The design should not invent Studio-only concepts with no representation in the JSON.

**Accessibility is first-class.** Studio targets government, nonprofit, and clinical audiences — many with WCAG 2.2 AA requirements. Studio itself must meet accessibility standards. Studio should also help authors produce accessible forms (for example, surfacing when a field is missing a label).

**Session persistence and recovery.** Authors close tabs, crash, walk away. Sessions persist, list, and resume. Both project state and conversational state must be restorable.

**Known gaps the designer should not design around as if they work today:**
- **`renameVariable` is not implemented.** Renaming a named variable is blocked at the core; the helper throws. The design can plan for variable renames, but if variable rename flows are critical path to an early demo, they are not wireable today.
- **Upload-to-scaffold is generic.** The AI adapter accepts file attachments and passes them to the model; there is no per-format extraction (no "drop a CSV and see columns map to fields"). Designs assuming format-specific upload UX are ahead of the implementation.
- **Source tracing is partial.** Links from form elements back to the conversation turn that produced them populate in the standalone scaffold path; the integrated refinement path does not feed them back today. Parity is a design question, not a given.
- **Command history is data, not yet UI.** The command log is queryable; no visible audit panel ships.

**Scale.** Realistic forms are 50–300 fields with dozens of binds, several shapes, multiple repeat groups, and several pages. A design that looks clean at 5 fields and breaks at 150 is not viable. Search, filter, navigation, and scoping at real form sizes are first-order concerns.

---

## 8. Today's Studio, for reference

A brief factual summary of what ships now. Use it to understand the capability surface; do not use it as a layout proposal.

- **Tabbed workspace** with Editor (item tree), Logic (variables, binds, shapes), Data (schema, instances, option sets), Layout (visual canvas), Theme (tokens, selector cascade), Mapping (rules, preview), and Preview (live form, behavior view, viewport switcher).
- **Blueprint sidebar** with nine sections (Structure, Component Tree, Theme, Screener, Variables, Data Sources, Option Sets, Mappings, Settings) and entity count badges.
- **Right-hand properties panel** driven by the current selection.
- **Header** with tab navigation, undo/redo, import/export, command palette (⌘K).
- **Two separate chat entry points** — an embedded sidebar that refines the live project via MCP tool calls (integrated refinement), and a standalone page that runs a conversational intake, scaffolds a definition, and hands off to the editor (standalone scaffolding).
- **Preview** with viewport switcher, scenario data editor, and a diagnostics panel.
- **Issue queue** for AI-surfaced contradictions, low-confidence choices, and missing config.

This is one answer to the product described above. The rewrite ask is to produce a new one.

---

## 9. Questions a good design answers

The design has to have an answer to these. How is open.

1. What does a first-time author see in the first ten seconds, and what does the product look like it is for?
2. How does an author go from "I need a form" to "I have a first draft"?
3. How does conversation relate to direct manipulation — and how does the handoff between them feel when the author switches mid-task?
4. When the AI does something, how does the author see what changed, accept or reject it, and keep going?
5. Where do logic, validation, and calculations live, and how does the author not get lost in them at 40+ rules?
6. When and where does the author see the form-as-respondent? Is preview a mode, a companion, an overlay, or something else?
7. How do the benefits of tier separation (swap theme without touching logic; reuse data model across layouts; retarget output) surface as natural product moments?
8. How does search and navigation work at 200 fields?
9. What does a broken form look like — invalid FEL, dangling references, circular calculations, failed import?
10. What does this product look like three months into the life of a real form, when the author is maintaining it rather than building it?

---

## 10. The real tension

Studio has to do two things at once. It has to be a tool a program manager uses for hours at a stretch to build and maintain a correct, complex, high-stakes form — craftwork, not spectacle. It also has to be the most visible surface of the Formspec project, the thing people see in a screenshot or a short demo before they decide whether any of this is worth their attention. Those two pressures can reinforce each other (a tool that is a genuine pleasure to use is also a tool that demos well), but they can also pull apart (flourishes that look good in a hero shot and get in the way at hour six; depth that takes a walkthrough to appreciate).

The ask is to hold both. A design that only serves the program manager will be competent and invisible. A design that only serves the screenshot will be beautiful and unusable. The design should look, at a single glance, like something meaningfully different from the form builders it competes with — because it is. It should also earn the second hour, the tenth hour, the hundredth.

---

## 11. Deliverables and inputs

**What the designer returns:** high-fidelity designs for the primary authoring flows — empty state, scaffolding-by-conversation, direct editing of items and rules, preview, refinement-by-conversation, review of an AI changeset, navigation of a large form. Coverage of mobile is not required for authoring surfaces (authors work on desktop); preview must show how authored forms render across viewports.

**What the designer gets:**
- This document.
- `context.md` at the repo root for project-level positioning.
- `packages/formspec-studio/README.md` for the current Studio's architecture summary.
- `packages/formspec-studio-core/README.md` for the authoring API (the vocabulary of operations the product supports — 51+ helpers).
- `packages/formspec-chat/README.md` for the conversational layer (session lifecycle, adapters, scaffolding, refinement, changesets, issues).
- A canonical reference form will be provided separately (suggested: a grant budget form at the simple end, a patient intake form at the complex end). Design mockups should use real form content, not lorem ipsum.
- Access to a running instance of today's Studio, for reference. Open it to see the current answer; don't copy it.
- Formspec brand assets (logo, typography, palette) if and when they exist. If they don't, the designer is free to propose.

---

## 12. Source material for deeper context

- `specs/core/spec.llm.md` — Formspec core specification.
- `specs/fel/fel-grammar.llm.md` — FEL grammar and semantics.
- `specs/theme/theme-spec.llm.md` — theme specification.
- `specs/component/component-spec.llm.md` — component specification, including the built-in component catalog.
- `specs/mapping/mapping-spec.llm.md` — mapping DSL.
- `thoughts/studio/` — prior Studio design reviews and product requirements. Historical, not binding.

Start with this document, `context.md`, and the three package READMEs. Reach for the specs when you need to understand a specific capability in depth.




