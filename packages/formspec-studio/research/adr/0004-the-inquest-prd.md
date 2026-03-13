# The Inquest — Guided Creation Flow

**Version:** 1.3  
**Status:** Draft  
**Date:** March 13, 2026  
**Parent Document:** The Stack PRD v2.0  
**Companion Document:** `0006-the-inquest-technical-addendum.md`  
**Mutation Layer:** formspec-studio-core v0.1

---

## 1. Purpose

The Inquest is the guided creation flow that bridges the gap between "I have a regulatory requirement" and "I'm ready to move a structured form into The Stack." It replaces the blank-canvas problem with a browser-based conversational process that accepts unstructured input — plain language descriptions, scanned paper forms, policy PDFs, existing spreadsheets — and progressively transforms it into a valid Formspec definition.

The flow exists because the people who need The Stack cannot start from an empty editor. An analyst who knows that Section 8 eligibility requires income verification, household size thresholds, and citizenship checks cannot translate that knowledge into items, binds, and shapes without first understanding Formspec's structural vocabulary. The Inquest teaches by doing: the analyst starts from a template or a description, the system proposes structure, the analyst refines, and the result is a populated project ready to hand off into Studio for detailed editing.

### 1.1 Product Constraints

The initial release of The Inquest is delivered as its own browser-based application surface, not as a modal or embedded workspace inside the main Studio shell. It may live in the same package as Studio, but it must remain independent at the app-shell level. No desktop wrapper, hosted AI proxy, or server-managed model tenancy is required for the primary flow.

The Inquest reuses the same authoring runtime and the relevant editor primitives as Studio — especially `formspec-studio-core`, the Studio command catalog, and shared block/property components — but wraps them in its own routes, layout, and visual language. It should feel like a sister product, not a skin of the existing editor.

Implementation is modular by default. The standalone app shell is only one layer. Template selection, input inventory, analysis review cards, proposal summary, refine canvas, source traceability, provider setup, and Studio handoff should each exist as separable modules with explicit interfaces. Studio should be able to adopt those modules later without inheriting the full Inquest shell, routing, or bring-your-own-key setup.

Independence is defined by dependency boundaries, not by npm package boundaries. Keeping Inquest and Studio code in the same package is acceptable if they are exposed through separate app entry points and a one-way import structure. Shared features must not import the Inquest app shell.

LLM access is bring-your-own-key. The analyst selects a provider, pastes an API key, and the browser uses that key directly against the provider's API for chat, image analysis, and document analysis. Keys are stored locally in the browser and can be cleared or replaced at any time.

Templates are part of the day-one experience, not a later enhancement. An analyst should be able to begin from a common form archetype in one click, then customize through chat and visual editing.

---

## 2. Entry Points

The Inquest is accessible from four locations.

**Direct App Entry.** Analysts can open The Inquest directly as its own browser app and start from templates, uploads, or chat without opening Studio first.

**New Project.** When the analyst creates a new project in Studio, they are presented with four choices: "Use a template" (launches The Inquest with starter templates), "Describe your form" (launches The Inquest in blank mode), "Start from scratch" (opens an empty Stack editor), or "Import existing" (opens a file picker for Formspec JSON). "Use a template" is the default highlighted option.

**Empty State.** If the analyst opens The Stack with an empty definition (no items), the editor canvas shows an empty state with prominent "Start with a Template" and "Start with The Inquest" call-to-action buttons that open the separate Inquest app.

**Command Palette.** ⌘K → "New Inquest" opens the separate app at any time, even with an existing project. In this case, the generated structure is merged into the current definition via a later handoff into `project.importSubform` mode rather than replacing it.

---

## 3. Flow Architecture

The Inquest is a five-phase flow. Each phase produces an intermediate artifact that feeds the next. The analyst can exit at any phase, save progress inside The Inquest, and later hand off the current scaffold into Studio.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  1. INTAKE   │────▶│  2. ANALYSIS │────▶│  3. PROPOSAL │────▶│  4. REFINE   │────▶│  5. HANDOFF   │
│              │     │              │     │              │     │              │     │               │
│ Template +   │     │  LLM extracts│     │  Structured  │     │  Visual edit │     │  Open in      │
│ Key + Upload │     │  requirements│     │  scaffold    │     │  of scaffold │     │  Studio       │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └──────────────┘
```

**Phase 1: Intake** — Template selection, model setup, and conversational input gathering.  
**Phase 2: Analysis** — LLM processes inputs and extracts structured requirements.  
**Phase 3: Proposal** — System generates a Formspec scaffold and presents it for review.  
**Phase 4: Refine** — Analyst edits the scaffold in a simplified visual editor.  
**Phase 5: Handoff** — Approved scaffold is handed off into Studio through the shared command model.

### 3.1 Modular Composition

The Inquest should be implemented as three layers:

1. **Standalone app shell.** Routes, session persistence, top-level navigation, provider key management, and Inquest-specific theming.
2. **Reusable feature modules.** Template gallery, upload intake, inputs inventory, analysis report, proposal viewer, refine workspace, source trace panel, guided prompts, and handoff launcher.
3. **Shared authoring primitives.** `formspec-studio-core`, Studio command schemas, block canvas primitives, inspector primitives, diagnostics, and path/query helpers.

Only the app shell is truly Inquest-only. Feature modules should be written so they can later render inside Studio as embedded panels, new-project flows, or sidecar tools.

No feature module should hardcode ownership of the full page, browser route, or provider key lifecycle if that responsibility can be injected. Modules should accept serialized inputs and callbacks so they can run either in standalone Inquest or inside Studio-hosted surfaces.

The preferred organization is a single package with multiple entry points and strict import direction:

1. `app-shell/` or equivalent for the standalone Inquest application surface.
2. `features/` for reusable modules that can be mounted by either Inquest or Studio.
3. `shared/` for authoring primitives, adapters, contracts, and low-level helpers.

`features/` may depend on `shared/`, but must not depend on `app-shell/`. This is the rule that keeps "same package" from turning into hidden coupling.

---

## 4. Phase 1: Intake

### 4.1 Layout

Full-screen browser app. It is not a modal over The Stack. The opening surface uses The Inquest's own shell, navigation, and visual system, with a centered working area (max-width 720px) and persistent project/session controls.

At the top of the left column: a starter row with template cards and an LLM setup chip. Below that: the chat stream. Right side: an "Inputs" panel showing the selected template, uploaded files, and extracted context as a growing inventory.

### 4.2 Chat Interface

The chat is a conversational thread between the analyst and an LLM assistant. The assistant's personality is professional, precise, and gently guiding — it asks clarifying questions, but never requires them. It can work with whatever the analyst provides, whether they start from a blank prompt or a template.

Before the first model-backed action, the analyst selects a provider and pastes an API key in a lightweight setup popover. The setup UI includes:

- Provider selector
- API key input
- "Test connection" action
- Clear explanation that requests are sent directly from the browser to the selected provider
- Local-only key storage notice

If no key is configured, template browsing remains available but Analyze / Generate actions are disabled.

**System opening message:**

> What form are you building? You can start from a template, describe it in your own words, upload an existing paper form or PDF, or paste regulatory text. I'll help translate it into a structured specification.

The starter templates cover a small but high-value set of common archetypes in the initial release:

- Housing intake / recertification
- Grant application
- Patient intake
- Employee onboarding
- Compliance checklist

Selecting a template preloads a starter field inventory, section structure, common validation rules, and example prompts into the session. The analyst can accept the template as a starting point, delete pieces of it, or layer uploaded reference material on top.

The template gallery is intentionally a shared module, not an Inquest-only widget. Inquest uses it as a primary entry surface; Studio can later use the same module in new-project flows, import assistance, or scaffold generation entry points.

The assistant is trained to ask follow-up questions across five dimensions, but only as needed — it adapts to how much information the analyst volunteers:

1. **Regulatory basis.** "What regulation, program, or policy does this form serve?" The answer populates `definition.description` and informs field naming conventions.

2. **Audience.** "Who fills this out — applicants, case workers, or reviewers?" The answer influences density, hint text, and presentation defaults.

3. **Data collected.** "What information do you need to capture?" This is the core question. The analyst may describe fields in natural language, upload a reference document, or both.

4. **Logic and conditions.** "Are there parts of the form that should only appear under certain conditions?" This surfaces the visibility rules, calculations, and validation constraints that will become binds and shapes.

5. **Flow and structure.** "Should this be a single page or multiple steps? Are there sections that repeat (like listing household members)?" This informs page mode, group structure, and repeat configuration.

### 4.3 Upload Handling

The chat input supports three upload types, each processed by the LLM with specialized extraction.

**Images** (JPEG, PNG, TIFF, HEIC). The analyst photographs or screenshots an existing paper form. The LLM performs visual analysis to extract: field labels, field types (text boxes, checkboxes, dropdowns, signature lines), section headers, page structure, and any instructional text. The extracted structure appears in the Inputs panel as a "Form Scan" card with a thumbnail and a list of detected fields.

Typical use case: An analyst at a housing authority photographs the paper HUD-50058 form they've been using for 20 years. The LLM identifies 47 fields across 4 sections, detects that "Household Members" is a repeating table, and recognizes the income calculation section.

**PDFs.** The analyst uploads a regulatory document, policy manual, or existing digital form. The LLM extracts: section structure, defined terms, eligibility criteria, required data points, calculation formulas, conditional requirements, and cross-references. The extracted requirements appear in the Inputs panel as a "Policy Document" card with key excerpts highlighted.

Typical use case: An analyst uploads the 24 CFR §982 regulation governing the Housing Choice Voucher program. The LLM identifies income limits, household size thresholds, citizenship requirements, and documentation rules — then maps these to form fields, validation shapes, and conditional binds.

**Spreadsheets** (CSV, XLSX). The analyst uploads an existing data collection spreadsheet. The LLM maps column headers to field labels, infers data types from cell values, and detects implicit validation rules (dropdown lists, conditional formatting, formula cells). The result appears as a "Spreadsheet Import" card.

### 4.4 Inputs Panel

The right-side panel accumulates everything the analyst has provided. Each input renders as a card:

- **Template seed:** The selected starter template, if any, with a summary of which starter sections, fields, and rules were preloaded.
- **Chat excerpts:** Key statements extracted from the conversation, tagged by dimension (regulatory basis, audience, data, logic, flow).
- **Uploaded files:** Thumbnail with filename, file type badge, and a "Detected N fields" or "Extracted N requirements" summary.
- **Extracted items:** As the LLM processes inputs, individual detected fields appear as compact rows with an inferred label, data type, and confidence indicator (high/medium/low).

The analyst can delete inputs, correct extracted labels, and flag items as "ignore" before proceeding. This panel persists across all phases as a reference.

### 4.5 Progression

The analyst proceeds to Phase 2 by clicking "Analyze" or by the assistant suggesting it's ready: "I think I have enough to propose a structure. Shall I analyze what we have?" The analyst can also continue adding inputs — the flow never forces progression.

A minimum threshold for progression: at least one meaningful input (a selected template, a description of more than 20 words, an uploaded file, or 3+ chat exchanges). Below this threshold, the "Analyze" button is disabled with a tooltip: "Choose a template or tell me more about your form first."

---

## 5. Phase 2: Analysis

### 5.1 Processing

The LLM processes all accumulated inputs, including any selected template seed, and produces a structured requirements document. This is not yet a Formspec definition — it's an intermediate representation that the analyst can review before structure is generated. The processing happens in the background; the analyst sees an animated progress indicator.

The analysis produces five outputs:

1. **Field inventory.** A flat list of every detected data point with: proposed label, inferred data type, whether it's required, and the source input that suggested it (chat excerpt, form scan region, PDF section).

2. **Section structure.** Proposed grouping of fields into logical sections (e.g., "Applicant Information," "Household Composition," "Income & Assets").

3. **Conditional logic.** Detected visibility rules, calculations, and validation constraints expressed in natural language (not yet FEL). Each rule shows: the triggering condition, the affected fields, and the source reasoning.

4. **Repeating structures.** Detected one-to-many relationships (household members, line items, employment history) with proposed min/max bounds.

5. **Routing logic.** If the inputs suggest pre-qualification or branching (e.g., "applicants over the income limit are redirected to a different form"), the analysis proposes screener fields and routes.

### 5.2 Review Screen

The analysis results render in the same full-screen app shell. The report is organized into the five sections above, each rendered as a card.

**Field Inventory Card.** A scrollable table showing each detected field with: checkbox (include/exclude), proposed label (editable inline), inferred data type (dropdown: string, integer, boolean, date, choice, money, attachment), required flag (toggle), and source citation (expandable to show the original input text or image region).

**Section Structure Card.** A visual tree showing proposed sections as headers with their assigned fields listed below. Fields can be dragged between sections. Sections can be renamed, reordered, or merged. An "Add Section" button at the bottom allows manual section creation.

**Logic Card.** A list of detected rules in natural language. Each rule has: a toggle (include/exclude), an editable condition description, and a list of affected fields. The analyst can modify the natural-language description; FEL translation happens in Phase 3.

**Repeating Structures Card.** Each detected repeat group shows: the group name, which fields are inside it, and proposed min/max instance counts (editable).

**Routing Card.** If routing was detected: proposed screener fields, routing conditions, and target destinations. If no routing was detected, this card shows "No pre-qualification routing detected" with an "Add Screener" button.

### 5.3 Analyst Actions

The analyst can:

- **Edit** any proposed element inline (labels, types, grouping, conditions).
- **Exclude** elements by unchecking them (they remain visible but greyed out, available for re-inclusion).
- **Add** elements manually that the LLM missed.
- **Re-analyze** by clicking "Re-analyze with changes," which sends the modified requirements back to the LLM for a refined pass.
- **Continue** to Phase 3 by clicking "Generate Structure."

### 5.4 Confidence Indicators

Each detected element shows a confidence indicator: green (high confidence — the element was explicitly stated or clearly visible in a form scan), amber (medium — inferred from context), or red (low — guessed from ambiguous input). Low-confidence elements are flagged for the analyst's attention. The threshold for a "complete" analysis is that fewer than 20% of elements are low-confidence.

---

## 6. Phase 3: Proposal

### 6.1 Generation

The system transforms the reviewed analysis into a Formspec definition scaffold. This is a real, valid Formspec JSON document — but it's presented visually, not as raw JSON. The generation produces:

- **Items** with keys, labels, data types, hints, and nested structure.
- **Binds** with FEL expressions for required, relevant, calculate, and constraint properties, translated from the natural-language rules.
- **Shapes** for cross-field validation rules.
- **Variables** for computed intermediate values.
- **Pages** based on the section structure, with `formPresentation.pageMode` set to wizard if the analysis detected multi-step flow.
- **Option sets** for any choice fields with reusable options.
- **Screener** if routing was detected.

A parallel Component Document scaffold is also generated with a basic layout tree (Wizard → Pages → Cards → Grid/Stack → Input components).

### 6.2 Presentation

The proposal renders in a split view. Left: a visual summary of the generated structure. Right: the Inputs panel from Phase 1, allowing the analyst to cross-reference the proposal against their original inputs.

The visual summary reuses the same underlying block primitives and authoring model as Studio — group headers, field cards with type icons, bind summary strips — but presents them in an Inquest-specific read-only shell. This preserves continuity of structure without making the surface look like a copy of the Studio editor.

The proposal viewer should be a reusable module in its own right. Studio should later be able to embed this surface for "generate from prompt," "import review," or "AI suggestions" workflows without depending on the full Inquest app shell.

Each generated element shows a "Source" link that highlights the original input (chat excerpt, form scan region, PDF section) that produced it. This traceability is essential for analyst trust: they can verify that the system understood their intent.

### 6.3 Statistics

A summary bar shows: total fields generated, pages, logic rules, validation shapes, and a "coverage" percentage indicating how many of the detected requirements were successfully translated into Formspec constructs. Elements that couldn't be translated (ambiguous logic, unsupported patterns) are listed in a "Needs Manual Configuration" section with explanations.

### 6.4 Analyst Actions

- **Accept** the proposal as-is and proceed to Phase 5 (Handoff).
- **Refine** by proceeding to Phase 4 for visual editing.
- **Regenerate** with adjusted parameters (e.g., "Make all fields required by default," "Use a single page instead of wizard," "Split the income section into two pages").
- **Back** to Phase 2 to modify the analysis.

---

## 7. Phase 4: Refine

### 7.1 Purpose

A lightweight visual editor for the scaffold that sits between the Proposal view and Studio handoff. It exposes the most common modifications analysts need to make before committing, without exposing the full complexity of Studio's nine-section Blueprint.

### 7.2 Layout

The layout keeps three working zones because the information architecture is sound, but it does not mirror Studio chrome one-for-one. The refine workspace uses an Inquest-specific shell and theme while reusing the relevant shared components beneath it:

- **Left:** A narrative outline of pages and sections. Shows top-level groups, completion state, and unresolved prompts.
- **Center:** A scaffold canvas built from shared editor blocks with a reduced toolbar. Only the most common operations are exposed: reorder, rename, change type, toggle required, delete.
- **Right:** A simplified inspector showing Identity, Field Config, source traceability, and Behavior Rules. No extensions, no advanced presentation hints, no low-level repeat config. These remain available in Studio.

The refine workspace should be decomposed so the outline, scaffold canvas, simplified inspector, and prompt tray can each be mounted independently. Studio may later want only the prompt tray, only the source-trace inspector, or only the simplified scaffold canvas inside existing workspaces.

### 7.3 Guided Prompts

The refine phase includes contextual prompts that surface common next actions:

- After generating a money field: "Would you like to set a currency? Default is USD."
- After generating a conditional rule: "This field will be hidden when [condition]. Does that look right?"
- After generating a repeating group: "Members can repeat 0–12 times. Should I adjust the limits?"
- When a required field has no validation: "Should [field] have a format requirement? (e.g., SSN as XXX-XX-XXXX)"

These prompts appear as non-blocking toast-style cards at the bottom of the center column. Dismissing a prompt removes it permanently. Acting on a prompt opens the relevant property in the Properties panel.

### 7.4 Chat Continuation

The LLM chat from Phase 1 remains accessible as a collapsible drawer at the bottom of the screen. The analyst can continue the conversation:

> "Actually, make the employer fields only show up when the income source is 'Employment'."

The assistant translates this into the appropriate bind modification and applies it to the scaffold. This is the key interaction: the analyst can make structural changes through conversation rather than direct manipulation, using whichever modality feels more natural. Conversational edits dispatch commands just like UI edits.

### 7.5 Progression

The analyst proceeds to Phase 5 by clicking "Open in Studio" or by the chat suggesting: "Your form looks ready. Want to open it in Studio?"

---

## 8. Phase 5: Handoff

### 8.1 Dispatch

The finalized scaffold is prepared inside The Inquest using the shared Studio command model, then handed off to Studio as an ordered command bundle plus current scaffold state. Studio applies that bundle to a fresh project or target import location. The handoff does not use `project.import` (which clears undo history). Instead, Studio replays individual `definition.addItem`, `definition.setBind`, `definition.addShape`, `definition.addVariable`, `definition.setOptionSet`, `definition.addInstance`, `definition.addPage`, and `component.addNode` commands in sequence. This means:

- The entire creation is undoable — ⌘Z walks back through every generated item.
- The command history shows a clear provenance: "Generated by The Inquest" markers on each batch of commands.
- If the analyst opened The Inquest from an existing project (`project.importSubform` mode), only the new items are added without disturbing existing structure.

### 8.2 Transition

Clicking "Open in Studio" navigates into Studio with the handoff bundle attached. After Studio loads, the first generated page is selected and the first field is highlighted in the Properties panel. A one-time welcome banner appears at the top of the editor:

> ✨ Your form has been generated with [N] fields, [N] rules, and [N] pages. Everything here is editable — click any block to customize it, or use the Logic tab to fine-tune behavior.

The banner includes a "Show me around" link that triggers a lightweight feature tour highlighting the Blueprint sections, Properties panel, and Logic tab.

### 8.3 Inquest History

The Inputs panel content (chat transcript, uploaded files, extracted requirements) is preserved in the handoff payload and then stored in project metadata as an `x-inquest` extension. This allows the analyst to revisit the original conversation and inputs later — useful when another team member asks "why was this field structured this way?"

---

## 9. LLM Integration

### 9.1 Model Requirements

The Inquest requires a multimodal LLM capable of: text conversation, image analysis (form scans), PDF text extraction and reasoning, and structured JSON output generation. The browser integration must support direct HTTPS calls to the provider API using an analyst-supplied key. The product should define a thin provider adapter so the UI, prompts, and output schemas are provider-agnostic.

### 9.2 System Prompt Architecture

The LLM system prompt includes:

- The Formspec Definition schema (summary, not full JSON Schema) — enough for the model to understand item types, data types, bind properties, shape structure, and FEL syntax.
- The FEL function catalog — so the model can generate valid expressions.
- The Studio Command Catalog — so the model can generate valid command payloads for the dispatch layer.
- The selected template seed, if any, including starter sections and starter rules.
- Domain-specific context about common form patterns (government intake forms, grant applications, compliance checklists, clinical research instruments).
- Persona instructions: professional, precise, never condescending, comfortable with ambiguity, asks clarifying questions only when genuinely uncertain.

### 9.3 Structured Output

The LLM's analysis and proposal outputs are requested as structured JSON matching predefined schemas. The system prompt specifies the output format explicitly, and the response is parsed and validated before rendering. Malformed outputs trigger a retry with diagnostic feedback. Provider-specific response envelopes are normalized by the browser adapter before validation.

### 9.4 Image Processing

For uploaded form images, the LLM is prompted with:

> Analyze this image of a paper form. Extract every visible field, section header, instructional text, checkbox group, dropdown, signature line, and repeating table. For each element, provide: the label text (exactly as written), the inferred data type, whether it appears required (marked with an asterisk or "Required"), and its position in the form's visual hierarchy (which section it belongs to). Note any conditional instructions (e.g., "Complete only if...") as logic rules.

The response is rendered in the Inputs panel as a structured field list with a minimap showing detected regions overlaid on the original image.

### 9.5 PDF Processing

For uploaded PDFs, the document is sent as base64-encoded content. The LLM is prompted to distinguish between: form-like content (fields to extract directly), regulatory text (requirements to translate into fields and rules), and reference material (definitions, thresholds, schedules to potentially populate as instances or option sets).

### 9.6 Conversation State

The full conversation history is maintained in the LLM context window across all phases. When the analyst asks a follow-up question in Phase 4 ("Actually, make the employer fields conditional"), the model has access to all prior exchanges, uploaded files, the generated analysis, and the current scaffold state. This continuity is essential — the analyst should never have to re-explain context.

Template provenance is also preserved in context. If the analyst started from "Grant application," the model continues to treat that as a starting assumption until the analyst edits or removes those seeded elements.

### 9.7 Error Handling

If the LLM produces an invalid Formspec structure (e.g., duplicate keys, invalid FEL syntax, circular variable references), the system:

1. Attempts automatic repair (deduplicating keys with suffixes, simplifying invalid FEL to placeholder expressions).
2. If repair succeeds, flags the repaired elements with amber confidence indicators.
3. If repair fails, shows the element in a "Needs Manual Configuration" section with the error description in plain language.
4. Never blocks progression — the analyst can always proceed with partial results and fix issues after handoff in Studio.

If the browser cannot reach the provider API, the setup chip switches to an error state with retry guidance. Existing local session artifacts remain intact; only model-backed actions are paused.

---

## 10. Edge Cases

### 10.1 Minimal Input

The analyst provides only a single sentence: "I need a patient intake form." The LLM generates a reasonable scaffold based on common patterns for the form type, with all elements at medium confidence. The analyst is encouraged to provide more detail but is not required to.

### 10.2 Excessive Input

The analyst uploads a 200-page regulatory document. The LLM summarizes the document structure, identifies the sections most likely to produce form fields, and generates a scaffold from those sections. A "Coverage" indicator shows which document sections were processed and which were skipped. The analyst can direct the LLM to specific sections: "Focus on Chapter 4, Section 982.201."

### 10.3 Contradictory Input

The analyst says "all fields are optional" in the chat but uploads a form scan where fields are marked with asterisks. The LLM surfaces the contradiction: "I noticed some fields in the uploaded form appear required, but you mentioned all fields should be optional. Which should I follow?" The analyst resolves the contradiction, and the LLM proceeds.

### 10.4 Multiple Form Scans

The analyst uploads three images of a multi-page paper form. The LLM processes them in sequence, maintaining field numbering and section structure across pages. The result is a single unified field inventory with page-break markers that translate into Formspec pages.

### 10.5 Existing Project Merge

When invoked from an existing project (⌘K → "New Inquest"), the LLM is provided with the existing definition's item keys to avoid collisions. Generated items use unique keys that don't conflict with existing ones. The handoff dispatches `project.importSubform` with the target group path selected by the analyst.

### 10.6 Re-entry

If the analyst closes The Inquest mid-flow and reopens it, the previous session state is restored. The conversation, uploads, analysis, and scaffold are all preserved. A banner shows: "Welcome back. You were on step [N] of The Inquest. Pick up where you left off?"

---

## 11. Command Mapping

Every mutation during The Inquest maps to the same Studio commands via shared `formspec-studio-core` primitives. The following table shows which commands each phase uses.

| Phase | Commands Used |
|-------|--------------|
| Phase 1: Intake | None (accumulates inputs, no state mutation) |
| Phase 2: Analysis | None (LLM processing, no state mutation) |
| Phase 3: Proposal | None (generates scaffold in memory, not yet committed) |
| Phase 4: Refine | `definition.addItem`, `definition.deleteItem`, `definition.renameItem`, `definition.moveItem`, `definition.reorderItem`, `definition.setBind`, `definition.setItemProperty`, `definition.setFieldDataType`, `definition.setFieldOptions`, `definition.addShape`, `definition.addVariable`, `definition.setOptionSet`, `definition.addPage`, `definition.setFormPresentation`, `definition.addInstance`, `definition.setScreener`, `definition.addScreenerItem`, `definition.addRoute`, `component.addNode`, `component.setNodeProperty` |
| Phase 5: Handoff | Same as Phase 4 (dispatched in batch), or `project.importSubform` for merge mode |

In Phase 4, the chat continuation can dispatch any command — the LLM generates command payloads from natural language and the system validates and executes them through `Project.dispatch()`.

The reusable feature modules should communicate through serializable state and command/result boundaries rather than hidden singleton state. That keeps them portable between the standalone Inquest app and future Studio embeddings.

Shared modules that are expected to be used by both Inquest and Studio — especially the template gallery, proposal viewer, source trace panel, and guided prompt surfaces — should expose neutral props and events rather than product-specific orchestration APIs.

---

## 12. Design Specifications

### 12.1 Phase 1 Visual Treatment

The Inquest has its own visual identity. It should not reuse The Stack's Swiss Brutalist shell styling directly.

That visual identity should be expressed through theme tokens and wrapper components, not by forking shared structural primitives. Reusable modules should remain styleable so Studio can later host them with either Inquest styling or Studio styling, depending on the embedding context.

Base palette: warm parchment background (`#F4EEE2`), deep ink panels (`#1C2433`), brass accent (`#B7791F`), blue-teal action color (`#2F6B7E`), and rust warning color (`#B44C3B`). Template cards and the LLM setup chip sit above the conversation in the left rail like dossier tabs. Upload cards render with file-type icons, thumbnails for images, and extraction progress indicators. The Inputs panel uses the same ink-panel treatment with parchment cards nested inside.

The overall feel is an editorial research desk: precise, investigative, and calm. It should feel like a sister product to Studio, not an embedded Studio mode.

### 12.2 Phase 2–3 Visual Treatment

Analysis and proposal continue the same Inquest palette. Report cards use deep ink shells with parchment interiors. Confidence indicators use green (`#2E8B57`), brass (`#B7791F`), and rust (`#B44C3B`). Structured data remains monospaced; labels and editorial copy use the Inquest typography system.

### 12.3 Phase 4 Transition

The refine workspace shifts toward a lighter parchment canvas (`#F7F1E6`) with a 300ms cross-fade, but it remains unmistakably Inquest. The scaffold canvas reuses the same block components underneath, restyled through Inquest theme tokens. The simplified inspector reuses the same Row, Sec, BindCard, and Pill primitives where useful, but with its own spacing, borders, and typography.

### 12.4 Phase 5 Transition

The handoff screen resolves into Studio over 400ms via route navigation, not a modal fade. The first generated page is selected, the first field is highlighted, and the Properties panel is populated. The welcome banner uses a subtle accent-tinted background (`#2563EB` at 6% opacity) with a left border.

### 12.5 Typography

The Inquest has its own typography stack: Fraunces for major headings and section titles, IBM Plex Sans for body copy and UI labels, and IBM Plex Mono for structured data, key names, and command-like references. Minimum font size across The Inquest is 12px.

---

## 13. Analytics and Feedback

### 13.1 Tracked Events

- Inquest started (entry point: new project / empty state / command palette)
- Template selected (template id, later accepted / heavily modified / mostly discarded)
- LLM provider configured (provider only, never the key)
- Input provided (type: chat / image / pdf / spreadsheet)
- Analysis completed (field count, section count, rule count, confidence distribution)
- Proposal generated (field count, bind count, shape count, coverage percentage)
- Refine edits (count, type: rename / delete / reorder / add / modify bind)
- Chat continuation edits in Phase 4 (count, success rate)
- Handoff completed (total commands dispatched, merge vs. new project)
- Inquest abandoned (phase at abandonment, time spent)
- Re-entry (phase resumed from)

### 13.2 Quality Metrics

- **Extraction accuracy.** Percentage of LLM-detected fields that survive into the final definition without label changes. Target: 80%.
- **Logic translation accuracy.** Percentage of natural-language rules that produce valid FEL without manual correction. Target: 70%.
- **Time to first edit.** Time from Inquest start to first manual edit in Studio after handoff. Target: under 5 minutes for a 30-field form.
- **Scaffold retention.** Percentage of generated items that remain in the published definition (not deleted by the analyst). Target: 75%.

---

## 14. Future Enhancements

### 14.1 Expanded Template Library

Expand the initial starter set into a richer library with jurisdiction-specific government packages (Section 8, SF-425, SF-424), clinical trial case report forms, grant applications, compliance checklists, and employer HR workflows. Each template can carry example policy references, starter option sets, and opinionated presentation defaults.

### 14.2 Iterative Re-Inquest

After a form has been in production, the analyst uploads new regulatory guidance and asks The Inquest to identify what needs to change. The system diffs the new requirements against the existing definition and proposes targeted modifications (new fields, updated validation thresholds, deprecated sections) rather than regenerating from scratch.

### 14.3 Multi-Form Programs

For programs that involve multiple related forms (application, annual review, recertification), The Inquest could generate a suite of definitions with shared option sets, common field groups via `$ref`, and pre-configured migration paths between versions.

### 14.4 Collaborative Inquest

Multiple analysts contribute to the same Inquest session — one uploads the regulatory document, another describes field-level requirements, a third reviews the proposal. Each participant's contributions are attributed in the Inputs panel.

---

*End of document.*
