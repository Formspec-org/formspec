# Formspec Studio — Design Handoff

**Date:** 2026-04-20
**Status:** Handoff for an original design pass — no current-design constraints
**Audience:** Designer producing a net-new Studio design from first principles

---

## 0. Read this first

This document explains what Formspec Studio is, who uses it, and what it has to do. It does **not** tell you how to design it. Every screen layout, panel arrangement, nav pattern, and interaction model is yours to invent. The current Studio codebase shipped a working design — that design is a reference point for *what the product does*, not a constraint on *how it should look or feel*. Assume you are designing from zero.

The goal is an original design that fits the product described below. If after reading this you think the product should be structured differently from how today's Studio structures it, say so — the conceptual frame ("ChatGPT for forms") is new enough that the right IA is an open question.

---

## 1. What Formspec is (30-second version)

Formspec is a **JSON-native specification for complex forms** — tax returns, grant applications, clinical intake, insurance claims, regulatory filings, safety inspections. Not contact forms. Not surveys. Forms with hundreds of fields, conditional sections, cascading calculations, cross-field validation, multi-format output, and offline requirements.

A Formspec form is a set of JSON documents:

- **Definition** — the data model: fields, types, structure, validation rules, calculations, conditional logic
- **Theme** — presentation tokens, widget catalog, page layout
- **Component** — interaction widgets, slot binding, responsive design
- **Mapping** — bidirectional transforms to JSON / XML / CSV for downstream systems

Plus optional sidecars (Locale, References, Ontology, Registry, Changelog, Assist) that most authors will never touch directly.

The same JSON definition renders identically on web, React, iOS, and server. The same validation runs in the browser and on the backend. The same calculations produce the same decimal-exact numbers offline on a tablet and on a cloud server.

Formspec is a **specification**, not a platform. There is no hosted service. Form definitions are JSON files that authors own.

---

## 2. What Studio is

Studio is the **authoring environment** for Formspec. It is where someone sits down to build a form and leaves with a valid set of JSON documents. It is a single-page web application; it is not a SaaS; it is the reference implementation of what authoring should feel like.

Studio has to serve two overlapping jobs:

1. **Visual authoring** — direct manipulation of every tier: definition, component, theme, mapping. Every structural change, rule, token, and transform is editable. Undo, redo, import, export are table stakes. Every mutation flows through a typed command catalog so the edit history is auditable and reversible.

2. **AI-assisted authoring** — a conversational collaborator that can build, modify, refine, and reason about the form alongside the author. The AI calls into the same typed command catalog as the human. Nothing the AI does is unreviewable, un-undoable, or magical.

Studio is not a form-filling tool. End users of the form never see Studio. Studio's output is the JSON documents; those get deployed into any runtime (web component, React, iOS, server) for end users to fill.

### The conceptual frame: "ChatGPT for forms"

The short internal pitch for Studio is **"ChatGPT for forms"**. Take that seriously as a framing device, not as a literal UI pattern:

- A non-technical author describes the form they need in plain language. The system produces a validated first draft.
- The author reviews, refines, and corrects — through conversation, through direct manipulation, or both.
- The author's role is **oversight and judgement**, not line-by-line construction.
- Every AI action is reviewable. The author can always see what changed, why, and undo it.
- The underlying artifacts (JSON documents) stay human-readable. There is no black box.

The frame implies a product where *conversation is a first-class authoring surface*, not a side panel bolted onto a traditional form builder. How strongly you lean into that is a design decision. You could design Studio as "chat is the whole interface, with a live preview", or "chat and visual editing are equal peers", or "visual editing is primary with chat as an accelerator". Any of those are defensible — the current implementation leans toward the third, but nothing forces that choice.

Note: the current codebase ships **two separate chat surfaces** — one embedded in the editor (refines the live project via tool calls), one standalone (conversational intake that scaffolds a form, then hands off to the editor). The fact that there are two is an implementation artifact, not a product requirement. A unified design is welcome.

### The design philosophy behind the spec and Studio's role in it

One idea sits under everything in this document; the design should internalize it.

**Formspec the specification was designed to be simple enough for a human to create by hand and structured enough for AI to create forms of effectively unlimited complexity.** A grant budget form is a few dozen lines of JSON a domain expert can read and edit. A 300-field tax return with cascading calculations, conditional branches, multi-format output, and version-locked change history is the same shape — just more of it. Nothing about the spec gets heavier as the form gets harder. The tools scale, the JSON scales, the reader scales.

**Studio's job is to give authors access to that full range of power without it feeling overwhelming at any point on the curve.** A first-time author building their first intake form should feel like they are using a simple, approachable tool. A program director rebuilding a tax package for the next regulatory cycle should feel like they are using a tool that can handle what they are asking of it. The underlying capability surface is the same; the experience of using it should stretch without snapping.

**The JSON is present, never hidden, never primary.** The author can always see, export, and if they want, edit the underlying JSON documents. But they should never *have to*. The complexity of authoring JSON — getting the schema right, writing FEL by hand, keeping Definition / Theme / Component / Mapping consistent with each other — should be invisible. The author works with concepts (fields, rules, pages, styles, outputs); the tool produces correct JSON. When the author opens the JSON panel, they see a readable, sensible document — one they could have written themselves if they had to.

**The conceptual benefits of the spec's separation of concerns should come through in the design, even if the mechanics don't.** The author does not need to know they are editing four separate documents. They *should* come away with an intuitive understanding of three ideas:

- **The data model is separate from how it looks.** Changing the theme does not change what the form collects. Two forms can share data structure and have completely different presentations.
- **The layout is separate from the data model.** The field "total" can appear in a card, a sidebar, or on its own page — the data it collects is the same.
- **The output is separate from the input.** The same response can flow out as JSON to one system, XML to another, and CSV to a third, declared once in the mapping — not re-implemented for every destination.

These separations pay off the first time an author changes a theme without touching their logic, or reuses a data model across two visual layouts, or re-targets their output to a new downstream system. The design should make those moments feel like natural consequences of the product, not special tricks.

**AI is how the complexity curve stays flat.** The spec is simple enough to author by hand at the low end and rich enough that an AI can compose arbitrarily complex forms at the high end. Studio is where those two meet. The author stays in conceptual mode ("add a section for household members that repeats"); the AI handles the structural and logical machinery; the JSON stays correct and legible the whole time.

---

## 3. Who uses Studio

The primary audience is **non-technical form authors** — the people who today file tickets with IT to get a form built, or spend months going back and forth with developers. They understand their domain (grants, eligibility, clinical intake, inspections, compliance) deeply. They do not write code. Many have used Google Forms, Typeform, SurveyMonkey, or REDCap; fewer have used ODK or a real expression language.

A secondary audience is **developers and form engineers** who will edit the JSON directly, tune FEL expressions, write mapping rules, and integrate the output into their stack. Studio should stay legible to them, but the primary reader of the screen is the domain expert, not the engineer.

The authors typically work in these settings:

- **Government program staff** — benefits eligibility, permitting, tax, licensing. Risk-averse, compliance-sensitive, long procurement cycles, Section 508 / WCAG expectations.
- **Nonprofit and grant operations** — grant applications, reports, compliance submissions. Often small teams; one person wears many hats.
- **Clinical and health intake** — patient questionnaires, screening tools, referrals. Coded vocabularies (ICD-10, SNOMED, LOINC) matter.
- **Insurance and financial services** — claims, applications, underwriting. Calculation correctness and audit trails are non-negotiable.
- **Field inspection and compliance** — safety checklists, site surveys. Offline is not optional.

These authors share a few traits that shape the design:

- They are accountable for the form being correct. A calculation error is their problem.
- They iterate a lot. Rules change mid-cycle. Wording gets tweaked. New sections appear.
- They do not read docs. They expect the tool to teach them by being legible.
- They are used to forms being second-class citizens in whatever tool they have. They will be surprised by good tooling.
- They do not think in terms of "definition vs. theme vs. component" — they think in terms of "the form".

That last point is important. Formspec separates concerns across four tiers (Definition, Theme, Component, Mapping) because that separation is architecturally valuable — and the *benefits* of that separation (change theme without touching logic; reuse data model across layouts; retarget output without rebuilding the form) should be something the author feels in how the product behaves. The *mechanics* of the separation (four JSON documents, four schemas, cross-document consistency) are authoring overhead the tool should absorb. Today's Studio exposes all four as top-level tabs; that is one answer, and it is not necessarily the right one.

---

## 4. What Studio must be able to do

This section enumerates the capability surface — what the tool has to support. It does not prescribe screens, panels, or flows. Think of this as the complete list of verbs an author needs. How you group them, surface them, and sequence them is the design.

### 4.1 Create and seed a form

- Start from nothing (blank form).
- Start from a conversation ("I need a grant budget form with personnel, travel, and equipment sections and a $500k cap").
- Start from a template (built-in archetypes: housing intake, grant application, patient intake, compliance checklist, employee onboarding).
- Start from an uploaded file (PDF, Word, CSV, screenshot — the AI extracts structure).
- Start from an existing JSON bundle (paste, drag-drop, or import).

### 4.2 Edit the data model (Definition tier)

- Add, remove, rename, reorder, move, duplicate, and wrap items.
- Items come in three kinds: **fields** (collect a value), **groups** (nest other items), **content** (headings, paragraphs, banners, dividers — display only).
- Field types: text, integer, decimal, boolean, date, datetime, choice, multi-choice, currency, email, phone, file, signature, rating, slider, URL.
- Mark groups as **repeatable** (min/max instances, add/remove labels).
- Define **named option sets** (reusable choice lists with usage tracking).
- Define **variables** (named FEL expressions the form can reference).
- Define **instances** (external data sources the form can reference).
- Edit per-field metadata: label, hint, placeholder, default value, concept URI (for ontology), help text, references.

### 4.3 Express logic (Binds and Shapes)

Formspec has two logic mechanisms; the author needs access to both:

- **Binds** attach behavior to a single field: `required`, `relevant` (show/hide), `readonly`, `constraint`, `calculate`, `default`.
- **Shapes** attach cross-field or form-level rules with severity (error / warning / info), timing (continuous / deferred / disabled), and activation conditions.

Binds and shapes are expressed in **FEL** — the Formspec Expression Language. FEL is Excel-like: `$personnel + $travel`, `if($income > 50000, 'A', 'B')`, `sum(items[*].amount)`. Authors will write FEL. The editor has to help them:

- Autocomplete for field names, function names, variables.
- Real-time parse error feedback.
- Dependency visualization (what does this field depend on? what depends on this field?).
- Static error surfacing (circular references, type mismatches, undefined names).
- A human-readable rendering of expressions ("Show this field when income is greater than $50,000") for authors who prefer prose.

### 4.4 Organize into pages and flows

- Multi-page forms (wizard mode, tabs mode, single-page mode).
- Assign items to pages; pages have order, title, description.
- **Screener routing** — an upfront mini-form that routes users into different branches based on their answers. (Think: "Are you a resident? Employee? Contractor?" → different downstream form.)

### 4.5 Shape presentation (Theme tier)

- Design tokens: colors, spacing, typography, radii.
- Theme defaults: label position, density, help text style.
- Selector cascade: match items by type / concept / path and apply styling overrides.
- Per-item overrides for one-off adjustments.
- Breakpoints and responsive behavior.

### 4.6 Shape layout (Component tier)

- Visual layout of the form: which fields go where, how they cluster.
- Layout containers: stacks, cards, collapsibles, columns (2/3/4), sidebars, inline groups.
- Drag-and-drop arrangement on a canvas.
- Widget selection per field (which of the 33 built-in components renders this field).
- Multi-page composition.

### 4.7 Shape output (Mapping tier)

- Define transforms from form response → target format (JSON, XML, CSV).
- Field-level rules: source path → target path, with coercion and value maps.
- Preview the mapping result against a test response.

### 4.8 Preview and test

- Live preview of the form as an end-user would see it.
- Viewport switcher (mobile / tablet / desktop).
- Test with scenario data — pre-fill answers and watch conditional logic, calculations, and validation react.
- **Behavior lab** — a panel where the author sees bind states (relevance, required, readonly, calculations) update in real time as scenario values change.
- Inspect generated JSON documents (Definition, Component, Theme, Mapping) at any point.
- Validate a response — check whether a set of answers is complete and correct against the rules.

### 4.9 Conversational authoring

Two distinct conversational flows exist today; the design may keep them separate or unify them:

- **Scaffolding conversation** — the AI interviews the author, gathers requirements, and produces a first-draft form. Works from plain language, templates, or uploaded files. The author watches the form materialize.
- **Refinement conversation** — once a form exists, the author talks to the AI to modify it. ("Add an email field with validation." "Make the budget section only appear for large grants." "Split the address into street, city, state, ZIP.") The AI calls typed tools that mutate the live project, producing reviewable changesets.

Characteristics the conversational surface has to support:

- Streaming responses.
- Source tracing — every element the AI created should be traceable back to the conversation turn or upload that produced it.
- Issue tracking — contradictions, low-confidence choices, and missing config surface as a reviewable queue.
- Regeneration — discard and re-scaffold from the full conversation.
- Message truncation — "go back to here and try again."
- Diff view — after a refinement, show what changed.
- Tool-call transparency — the author can see which operations the AI invoked.

### 4.10 History and collaboration primitives

- Undo / redo at the command level.
- Command history as a visible log (who did what, when).
- Import / export of the full bundle.
- Save / restore / list sessions (for conversational state).

### 4.11 Cross-cutting: selection, navigation, search

- A persistent notion of "the selected item" (a field, a group, a rule, a variable) that drives contextual panels.
- Fast navigation across all entities: items, binds, shapes, variables, option sets, mappings, pages.
- Full-text / command-palette search.
- Entity counts at a glance (how many fields, how many rules, how many unresolved issues).

### 4.12 Settings and metadata

- Form metadata: title, description, version, status, page mode, density, label position.
- Extension registry configuration (which extensions are loaded).
- Presentation defaults.

---

## 5. Unpacking the "ChatGPT for forms" frame

The frame is intentionally provocative. "ChatGPT for forms" is shorthand for a cluster of ideas worth spelling out so the design can decide how much of each to adopt.

**What "ChatGPT for X" products share:**

- The primary input is natural language intent, not direct manipulation of artifacts.
- The system produces a first draft the user reviews, rather than requiring the user to produce the first draft themselves.
- Iteration happens in conversation: "make it shorter", "add a section about X", "change the tone".
- The user's artifacts (a document, an image, a slide deck) exist alongside the conversation — they are the subject of the conversation, not its output.
- The user can edit the artifacts directly when conversation is too slow or imprecise.
- Nothing is hidden. The user sees what the system produced and can modify or reject it.

**What is different for Formspec:**

- Forms are **structured artifacts with rules**. The AI cannot ship something invalid — it has to pass JSON Schema validation, FEL static analysis, and cross-tier consistency checks. Every AI action flows through typed tool calls that the engine can reject.
- Forms have a **behavior dimension**, not just a content dimension. "Add a field" is trivial; "make the total update when any line item changes" is the actual work. Conversation has to be able to express logic, not just structure.
- Forms have **end users who are not the author**. The author is designing an experience for someone else. The preview / testing surface matters as much as the authoring surface — the author is constantly asking "what does the respondent see?"
- Forms have **multiple correct answers**. There is no single "good" budget form. The design has to leave room for the author's judgement and domain expertise — the AI is a collaborator, not an oracle.
- Forms are **long-lived**. A form shipped this year may run for five years and collect thousands of responses. Revision, versioning, and the ability to audit every change matter more than in a chat-to-produce-a-document product.

**What this means for the design:**

These are observations, not directives:

- Conversation is not the only surface, but it should feel native — not a support chat widget in the corner. A first-time author should be able to go from empty state to a working first draft entirely through conversation.
- Direct manipulation has to be seamless with conversation. If the author fixes something by hand, the AI should pick up where they left off. If the AI changes something, the author should see it in the direct-manipulation surface immediately.
- The system's trustworthiness comes from the author being able to see and undo anything. Design should expose, not hide, what the AI did.
- Preview is not a separate mode you enter — it is part of the authoring loop. The author should see the form-as-respondent as they build.
- The AI is most valuable for the tedious parts: initial scaffolding, writing FEL expressions, suggesting validation rules, extracting structure from documents, naming things, translating. The direct manipulation is most valuable for the structural decisions only the author can make. The design should make the handoff between the two frictionless.

---

## 6. Constraints the design must respect

These are things the design cannot change, because they are downstream of the specification or the architecture.

### 6.1 The four tiers are real, but the author shouldn't feel four tools

Definition, Theme, Component, and Mapping are separate JSON documents with separate schemas. They are authored, reviewed, and versioned separately. The *benefits* of this separation should come through in the product (theme swaps don't affect logic; layout is editable without touching data; output retargets without rebuilding the form). The *mechanics* of this separation (four documents, four schemas, keeping them consistent) should be invisible. When the author exports, they get four files — but getting there should not have felt like running four editors in a trench coat.

### 6.2 Every mutation is a typed command

All edits flow through a command catalog (`definition.addItem`, `theme.setToken`, `component.addNode`, `mapping.mapField`, etc.). This is what makes undo/redo, audit logging, and AI tool calls work uniformly. The design does not have to expose commands as a concept, but it cannot invent ad-hoc edit paths that bypass them.

### 6.3 FEL is the logic language

Calculations and conditions are FEL expressions. The design must provide a way to author, read, and debug FEL. Authors of complex forms will write non-trivial expressions — `sum(items[*].amount)`, `if($income > 50000, $rate_a, $rate_b)`, nested `let`-bindings, etc. The design can offer a visual/prose abstraction over FEL, but the raw expression has to be reachable.

### 6.4 Validation has two mechanisms

**Binds** (per-field) and **shapes** (cross-field) are structurally different. Shapes have severity levels (error / warning / info) and timing (continuous / deferred / disabled). The design needs to make the distinction legible — authors will want to express "this field is required" (a bind) and "the budget total must balance" (a shape) and will conflate them unless the UI helps.

### 6.5 Preview is a real form runtime

The preview surface runs the actual `FormEngine` against the live definition. It is not a mock or an approximation. Reactive updates, conditional visibility, calculations, and validation all run through the same engine an end user would hit. The design can rely on this being accurate.

### 6.6 The AI runs through typed tools, not freeform generation

The scaffold step produces a `FormDefinition` through structured output against a JSON schema. The refinement step calls tools from a catalog (the MCP server exposes ~48 typed tools). The AI cannot produce invalid state because the tools reject invalid inputs. This is an asset, not a limitation — the design can promise "the AI cannot break your form" and mean it.

### 6.7 Offline-first authoring is not required, but runtime offline-first is

Studio itself runs in a browser with a network connection. The *forms Studio produces* must work offline, which affects what Studio has to show the author (calculation correctness, on-device validation semantics) but not how Studio itself is architected.

### 6.8 The output must be portable JSON

Nothing Studio produces can require Studio to run. An author must be able to export, hand the JSON to a developer, and have it work in any runtime (web component, React, iOS, server). The design should not invent Studio-specific concepts that have no representation in the underlying JSON.

### 6.8.1 The JSON is always reachable, never required

The author can always open, read, copy, and edit the underlying JSON documents. This is a first-class capability, not a hidden developer escape hatch — domain experts sometimes want to look under the hood, and developers will want to live there. But the author must never *need* to edit JSON to do their job. Every authoring path has a non-JSON expression. The JSON is the artifact; it is not the interface.

### 6.9 Accessibility is a first-class requirement

Studio targets government, clinical, and nonprofit authors. Many work in organizations with WCAG 2.2 AA requirements. Studio itself must meet accessibility standards (keyboard operability, screen reader support, focus management, sufficient contrast). The forms Studio produces must also meet accessibility standards — Studio should teach the author to do the right thing (e.g., surfacing when a field is missing a label).

### 6.10 Session persistence and recovery

Authors walk away and come back. They close tabs. They crash. The design needs a session model — sessions persist, can be listed, can be resumed. Both the project state and any active conversation must be restorable.

### 6.11 Scale

A realistic form is 50–300 fields with dozens of binds, several shapes, multiple repeat groups, and a few pages. The design has to work at that scale without becoming unusable — searching, filtering, and navigating large forms matters. A design that looks beautiful at 5 fields and breaks at 150 is not acceptable.

---

## 7. What a good design answers

This section is not a brief. It is a list of questions the design has to have an answer to. How it answers them is open.

**Framing and identity**

- What does a first-time author see in the first ten seconds? What does the product look like it is for?
- What does an author who has built forms before recognize? What is the closest mental-model anchor — IDE, design tool, word processor, notebook, document editor, agent interface?
- Does conversation feel like a peer to direct manipulation, a front door to it, a supporting surface, or something else entirely?

**Core authoring loop**

- How does an author go from "I need a form" to "I have a first draft"?
- Once a draft exists, how do they see what's there, what's missing, and what's wrong?
- When they want to change something, what's the fastest path — conversation, direct edit, keyboard, search?
- How does the author move between thinking about the structure (what fields exist), the behavior (what rules apply), the presentation (how it looks), and the output (what systems consume it)?

**Trust and review**

- When the AI does something, how does the author see what changed?
- How does the author accept, reject, or modify an AI action?
- What does the history of the form look like? Can the author read it?
- How does the author know the form is correct — no broken rules, no undefined references, no unreachable fields?

**Complexity management**

- Where do logic, validation, and calculations live? How does an author with 40 rules not get lost?
- How does the author see the dependency graph — what depends on this field? what does this field depend on?
- How does search and navigation work at 200 fields?
- How does the author work on one part of the form without losing context on the rest?

**Preview and testing**

- When and where does the author see the form-as-respondent? Is it a separate mode, a constant companion, an on-demand overlay?
- How does the author test behavior — conditional visibility, calculations, validation — with sample data?
- How does the author switch between author-view and respondent-view mentally?

**Tier legibility**

- Does the author ever need to know the difference between Definition, Component, Theme, and Mapping? If yes, how is it framed? If no, how are the concerns still separable under the hood?
- Where does layout (drag-drop arrangement) live relative to structure (the item tree)?
- Where does theming live — as a separate surface, inline with items, globally, or something else?
- How do the *benefits* of tier separation (theme swaps, reusable data models, retargetable output) surface as natural moments in the product rather than as things the author has to go hunt for?

**JSON and transparency**

- How does an author see the underlying JSON when they want to? Where does that surface live?
- How does the product avoid ever making the author *need* to touch JSON to accomplish a task?
- How do the JSON documents look when the author opens them — are they readable, organized, commented, or dense?

**Conversation as a surface**

- Is there one conversation or many? Per-form, per-session, per-topic?
- Does the conversation remember context across sessions?
- How does the author see what tools the AI is calling, and at what granularity?
- How does the author redirect, correct, or roll back an AI action?
- How does conversation surface issues, suggestions, and warnings the AI has surfaced?

**Empty states, error states, edge cases**

- What does the first-run experience look like?
- What does a broken form (invalid FEL, dangling reference, circular calculation) look like?
- What does a large, production-scale form look like three months into its life?
- What does a form imported from a file look like before the author has cleaned it up?

A complete design answers all of the above, consistently, without resorting to "it's in a settings menu somewhere."

---

## 8. What the current Studio has, for reference

The existing implementation is not the design to match — it is a working reference for the capability surface. Treat it like a feature catalog, not a layout proposal. Look at it to understand what has to be supported; do not copy its structure.

Quick summary of what ships today:

- **Tabbed workspace**: Editor (item tree), Logic (variables, binds, shapes), Data (schema, instances, option sets), Layout (visual canvas), Theme (tokens, cascades), Mapping (rules, preview), Preview (live form + behavior lab).
- **Blueprint sidebar** with nine sections: Structure, Component Tree, Theme, Screener, Variables, Data Sources, Option Sets, Mappings, Settings.
- **Right-hand properties panel** driven by the current selection.
- **Header** with tab navigation, undo/redo, import/export, command palette (⌘K).
- **Two chat entry points**: an embedded sidebar panel (refinement via MCP tools) and a standalone conversational intake page (scaffolds a form, hands off to the editor).
- **Preview** with viewport switcher, scenario data editor, and a diagnostics panel.
- **Source tracing**: every AI-created element links back to the conversation turn that produced it.
- **Issue queue**: contradictions, low-confidence choices, and missing config surface as a reviewable list.

This is *an* answer to the product described in this document. Your job is to produce a new answer.

---

## 9. Source material

For deeper context, the following are canonical:

- `context.md` (repo root) — Formspec project context, audiences, positioning.
- `packages/formspec-studio/README.md` — current Studio architecture and workspace inventory.
- `packages/formspec-studio-core/README.md` — the authoring API the UI is a surface over (51+ helpers, the vocabulary of things Studio can do).
- `packages/formspec-chat/README.md` — the conversational authoring core (sessions, adapters, scaffolding, refinement, source tracing, issues).
- `specs/core/spec.llm.md` — Formspec core specification.
- `specs/fel/fel-grammar.llm.md` — FEL expression language grammar and semantics.
- `specs/theme/theme-spec.llm.md` — Theme specification.
- `specs/component/component-spec.llm.md` — Component specification, including the 33 built-in components.
- `specs/mapping/mapping-spec.llm.md` — Mapping DSL specification.
- `thoughts/studio/` — prior Studio design reviews, visual specs, product requirements docs (historical, not binding).

You do not need to read all of this to design. Start with this handoff, `context.md`, and the Studio README. Reach for the specs when you need to understand a specific capability in depth.

---

## 10. The ask

Produce an original design for Formspec Studio that:

- Fits the product described in sections 1–6.
- Answers the questions in section 7.
- Takes the "ChatGPT for forms" frame seriously without being bound to any existing ChatGPT-like layout.
- Is grounded in the real audiences (non-technical domain experts in government, nonprofit, clinical, and compliance settings).
- Does not assume the current Studio structure is correct.

Nothing about tabs, sidebars, canvases, panels, or modes is load-bearing in this document. If the right design has none of those things, that's a valid answer. If the right design has all of them but arranged differently, that's a valid answer. If the right design looks like a notebook, a document, a chat, a spreadsheet, or something that doesn't have a common name yet — those are all valid answers.

What is load-bearing: the product has to let a non-technical domain expert build, review, refine, and ship a complex, correct form, alongside an AI collaborator, while keeping the author in control of everything that ends up in the final JSON.






