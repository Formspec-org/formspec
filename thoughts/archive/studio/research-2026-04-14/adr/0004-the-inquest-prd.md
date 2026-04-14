# The Inquest — Guided Creation Flow

**Version:** 1.4  
**Status:** Draft  
**Date:** March 13, 2026  
**Parent Document:** The Stack PRD v2.0  
**Companion Document:** `0006-the-inquest-technical-addendum.md`  
**Mutation Layer:** formspec-studio-core v0.1

---

## 1. Purpose

The Inquest is the guided creation flow that bridges the gap between "I have a regulatory requirement" and "I'm ready to move a structured form into The Stack." It replaces the blank-canvas problem with a browser-based conversational process that accepts unstructured input — plain language descriptions, scanned paper forms, policy PDFs, existing spreadsheets — and progressively transforms it into a valid Formspec scaffold.

The flow exists because the people who need The Stack cannot start from an empty editor. An analyst who knows that Section 8 eligibility requires income verification, household size thresholds, and citizenship checks cannot translate that knowledge into items, binds, shapes, screeners, and presentation hints without first understanding Formspec's structural vocabulary. The Inquest teaches by doing: the analyst starts from a template or a description, the system proposes structure, the analyst verifies or edits it, and the result is a populated project ready to hand off into Studio for detailed authoring.

The Inquest is not a one-shot generator. It is a local, resumable investigation workspace. Inputs, extracted requirements, review decisions, and draft scaffolds are treated like case material that the analyst can return to later on the same browser and device.

### 1.1 Product Constraints

The initial release of The Inquest is delivered as its own browser-based application surface, not as a modal or embedded workspace inside the main Studio shell. It may live in the same package as Studio, but it must remain independent at the app-shell level. No desktop wrapper, hosted AI proxy, or server-managed model tenancy is required for the primary flow.

The Inquest reuses the same authoring runtime and the relevant editor primitives as Studio — especially `formspec-studio-core`, the Studio command catalog, and shared block/property components — but wraps them in its own routes, layout, and visual language. It should feel like a sister product, not a skin of the existing editor.

Implementation is modular by default. The standalone app shell is only one layer. Template selection, input inventory, review workspace, behavior preview, source traceability, provider setup, issue queue, and Studio handoff should each exist as separable modules with explicit interfaces. Studio should be able to adopt those modules later without inheriting the full Inquest shell, routing, or bring-your-own-key setup.

Independence is defined by dependency boundaries, not by npm package boundaries. Keeping Inquest and Studio code in the same package is acceptable if they are exposed through separate app entry points and a one-way import structure. Shared features must not import the Inquest app shell.

LLM access is bring-your-own-key. V1 supports Gemini, OpenAI, and Anthropic (Claude) provider keys. Gemini may be recommended as the easiest path for obtaining a key, but it is not a privileged architecture path; all providers are peer-level integrations. The analyst selects a provider, pastes an API key, and the browser uses that key directly against the provider API for chat, image analysis, document analysis, and structured output. Keys are stored locally only, can be cleared or replaced at any time, and are never sent to our backend.

Provider outputs are normalized into shared internal contracts before rendering or dispatch. Inquest does not allow provider-specific response shapes to leak into feature modules.

Templates are part of the day-one experience, not a later enhancement. An analyst should be able to begin from a common form archetype in one click, then customize through chat and visual editing.

Session persistence is local-only in v1. Inquest drafts autosave on the same browser/device. There is no cloud sync, team workspace, or cross-device resume in the initial release. The UI must say this plainly.

The product must support two explicit working modes:

- **Draft fast.** Optimize for speed to first scaffold. Surface issues, but allow handoff once the scaffold is structurally valid.
- **Verify carefully.** Optimize for semantic confidence. This is the recommended default for regulatory, eligibility, and compliance-heavy workflows.

The generated Definition is the primary product artifact. Theme and Component output may be seeded for preview continuity, but the v1 contract prioritizes Definition fidelity and traceable logic over full Tier 3 presentation authorship.

---

## 2. Entry Points

The Inquest is accessible from five locations.

**Direct App Entry.** Analysts can open The Inquest directly as its own browser app. The landing surface shows "Start New Inquest" actions and a Recent Inquests list populated from local browser storage.

**New Project.** When the analyst creates a new project in Studio, they are presented with four choices: "Use a template" (launches The Inquest with starter templates), "Describe your form" (launches The Inquest in blank mode), "Start from scratch" (opens an empty Stack editor), or "Import existing" (opens a file picker for Formspec JSON). "Use a template" is the default highlighted option.

**Empty State.** If the analyst opens The Stack with an empty definition (no items), the editor canvas shows an empty state with prominent "Start with a Template" and "Start with The Inquest" call-to-action buttons that open the separate Inquest app.

**Command Palette.** ⌘K -> "New Inquest" opens the separate app at any time, even with an existing project. In this case, the generated structure targets a later merge into the current definition rather than replacing it.

**Project Re-entry.** Studio projects with `x-inquest` provenance should expose a "Reopen Inquest" action. When matching local session state still exists on the same browser, this action reopens the exact Inquest session. When local session state no longer exists, Studio falls back to provenance summary and an option to start a new Inquest.

---

## 3. Experience Model

The Inquest remains a five-phase architecture internally. Each phase produces an intermediate artifact that feeds the next. The analyst can exit at any phase, save progress inside The Inquest, and later hand off the current scaffold into Studio.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  1. INTAKE   │────▶│  2. ANALYSIS │────▶│  3. PROPOSAL │────▶│  4. REFINE   │────▶│  5. HANDOFF   │
│              │     │              │     │              │     │              │     │               │
│ Inputs +     │     │  Extracted   │     │  Definition  │     │  Visual +    │     │  Open in      │
│ Provider     │     │  requirements│     │  scaffold    │     │  chat edits  │     │  Studio       │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └──────────────┘
```

**Phase 1: Intake** — Template selection, model setup, and conversational input gathering.  
**Phase 2: Analysis** — LLM processes inputs and extracts structured requirements.  
**Phase 3: Proposal** — System generates a Formspec scaffold and presents it for review.  
**Phase 4: Refine** — Analyst edits the scaffold in a simplified visual editor.  
**Phase 5: Handoff** — Approved scaffold is handed off into Studio through the shared command model.

V1 should not make these feel like five separate products. The visible journey should feel like four milestones:

1. **Inputs**
2. **Review**
3. **Refine**
4. **Handoff**

Analysis and Proposal remain distinct internal artifacts, but they render within one Review workspace in the product UI so the analyst is not forced through multiple ceremonial review steps for the same information.

### 3.1 Modular Composition

The Inquest should be implemented as three layers:

1. **Standalone app shell.** Routes, session persistence, top-level navigation, recent-session listing, provider key management, and Inquest-specific theming.
2. **Reusable feature modules.** Template gallery, upload intake, input inventory, review workspace, behavior preview, source trace panel, issue queue, provider setup, and handoff launcher.
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

Full-screen browser app. It is not a modal over The Stack. The opening surface uses The Inquest's own shell, navigation, and visual system, with a centered working area and persistent project/session controls.

The intake shell contains three working regions:

- **Top rail:** current session title, autosave status, working mode chip, provider setup entry point, and "Saved on this browser only" copy.
- **Main column:** template starters followed by the chat stream.
- **Side panel:** an Inputs inventory showing the selected template, uploaded files, extracted context, and open issues.

### 4.2 Provider Setup and Working Mode

Before the first model-backed action, the analyst selects a provider and pastes an API key in a lightweight setup popover. The setup UI includes:

- Provider selector with Gemini, OpenAI, and Anthropic (Claude) options
- API key input
- "Test connection" action
- Clear explanation that requests are sent directly from the browser to the selected provider
- Local-only storage notice
- "Remember this key on this browser" opt-in control

If no key is configured, template browsing remains available but Analyze / Generate actions are disabled.

The intake surface also asks the analyst how they want to work:

- **Verify carefully** (recommended)
- **Draft fast**

This setting changes how issue resolution and handoff gating behave later in the flow. It is a product behavior switch, not just a label.

### 4.3 Chat Interface

The chat is a conversational thread between the analyst and an LLM assistant. The assistant's personality is professional, precise, and gently guiding. It asks clarifying questions when useful, but does not require a rigid interview.

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

The assistant is trained to ask follow-up questions across five dimensions, but only as needed:

1. **Regulatory basis.** "What regulation, program, or policy does this form serve?"
2. **Audience.** "Who fills this out — applicants, case workers, or reviewers?"
3. **Data collected.** "What information do you need to capture?"
4. **Logic and conditions.** "Are there parts of the form that should only appear under certain conditions?"
5. **Flow and structure.** "Should this be a single page or multiple steps? Are there sections that repeat?"

### 4.4 Upload Handling

The chat input supports three upload types, each processed by the LLM with specialized extraction.

**Images** (JPEG, PNG, TIFF, HEIC). The analyst photographs or screenshots an existing paper form. The LLM performs visual analysis to extract field labels, field types, section headers, page structure, instructional text, and conditional instructions.

**PDFs.** The analyst uploads a regulatory document, policy manual, or existing digital form. The LLM extracts section structure, defined terms, eligibility criteria, required data points, calculation formulas, conditional requirements, and cross-references.

**Spreadsheets** (CSV, XLSX). The analyst uploads an existing data collection spreadsheet. The LLM maps column headers to field labels, infers data types from cell values, and detects implicit validation rules, formulas, and controlled vocabularies.

### 4.5 Inputs Panel

The side panel accumulates everything the analyst has provided. Each input renders as a card:

- **Template seed:** starter sections, fields, and rules
- **Chat excerpts:** key statements tagged by dimension
- **Uploaded files:** filename, file type badge, summary, and processing state
- **Extracted items:** inferred label, data type, source, and confidence state

The analyst can delete inputs, correct extracted labels, and flag items as ignore. This panel persists across all phases as a working case file.

### 4.6 Progression

The analyst proceeds to Phase 2 by clicking **Analyze** or by the assistant suggesting it is ready. The analyst can also keep adding inputs; the flow never forces progression.

A minimum threshold for progression is required: at least one meaningful input (template, non-trivial description, uploaded file, or substantive conversation). Below that threshold, Analyze is disabled with a tooltip explaining what is missing.

All intake state is autosaved locally. Refreshing the tab must not discard the session.

---

## 5. Phase 2: Analysis

### 5.1 Processing

The LLM processes all accumulated inputs, including any selected template seed, and produces a structured requirements document. This is not yet a Formspec Definition. It is an intermediate representation that the analyst can review before structure is generated.

The analysis produces five outputs:

1. **Field inventory.** Proposed label, inferred data type, requiredness hint, and source trace.
2. **Section structure.** Proposed grouping of fields into logical sections.
3. **Conditional logic.** Detected visibility rules, calculations, and validation constraints in plain language.
4. **Repeating structures.** Detected one-to-many relationships with proposed bounds.
5. **Routing logic.** Proposed screener fields and routes when pre-qualification or branching is implied.

### 5.2 Review Surface

The analysis results render inside the Review workspace. The requirements view should be editable, not frozen.

**Field Inventory.** Scrollable review table with include/exclude, editable label, inferred data type, required flag, source citation, and confidence label.

**Section Structure.** Editable tree showing proposed sections and assigned fields.

**Logic Review.** Plain-language rules with include/exclude, editable explanation, affected fields, and source reasoning.

**Repeating Structures.** Group name, included fields, and editable min/max bounds.

**Routing Review.** Screener fields, route conditions, and target destinations.

### 5.3 Confidence and Issue States

Every detected element shows a confidence state using label, icon, and color:

- **High confidence**
- **Medium confidence**
- **Low confidence**

Confidence must not be color-only. Low-confidence elements and contradictions appear in the Issue Queue immediately.

### 5.4 Analyst Actions

The analyst can:

- edit any proposed element inline
- exclude elements without deleting them
- add missed elements manually
- re-run analysis with changes
- continue to Proposal generation

---

## 6. Phase 3: Proposal

### 6.1 Generation

The system transforms the reviewed analysis into a Formspec scaffold. The Definition is the primary generated artifact and must always be structurally valid before handoff is allowed.

The proposal produces:

- **Items** with keys, labels, data types, hints, and nested structure
- **Binds** with FEL for `required`, `relevant`, `calculate`, `readonly`, and `constraint`
- **Shapes** for cross-field validation rules
- **Variables** for intermediate calculations
- **Option sets** for reusable choices
- **Screeners and routes** when routing was detected
- **Presentation defaults** such as `formPresentation.pageMode`
- **Page grouping hints** by assigning section groups to named page values rather than inventing a separate page entity

A minimal Component Document shell MAY also be generated to preserve preview continuity, but it is secondary. V1 should not attempt to synthesize a full Tier 3 component architecture from ambiguous inputs when a simpler Definition-first scaffold would be clearer and safer.

### 6.2 Review and Trust Surfaces

The proposal stays inside the same Review workspace. It combines three forms of trust-building:

**Source Trace.** Each generated element links back to the originating chat excerpt, scan region, spreadsheet column, or PDF section.

**Plain-English Explanation.** Each generated rule shows a short explanation of what it does in analyst language.

**Behavior Preview.** Every consequential rule can be previewed with example or analyst-entered values. The preview shows:

- which fields become visible or hidden
- which fields become required or readonly
- which validation results appear
- how non-relevant behavior affects response shape
- what screener route would be taken

This preview must reflect actual Formspec semantics, not a fake narrative summary.

### 6.3 Statistics and Open Issues

A summary bar shows total fields, sections, rules, shapes, repeat groups, screeners/routes, and a coverage percentage indicating how much of the reviewed analysis was translated into Formspec constructs.

The proposal also shows an **Open Issues** section for:

- unresolved contradictions
- low-confidence logic
- unsupported patterns
- merge-mode limitations
- structurally invalid generated elements that still require repair

### 6.4 Analyst Actions

- **Accept** the proposal and proceed to handoff if gates are satisfied
- **Refine** in the visual editor
- **Regenerate** with adjusted parameters
- **Back** to update the reviewed analysis

### 6.5 Handoff Gates

Handoff rules are mode-dependent.

**Always blocking**

- structurally invalid Definition output
- invalid or unrepairable FEL
- duplicate-key conflicts not resolved by the command layer
- invalid merge target or unsupported import payload

**Verify carefully blocks**

- unresolved contradictions
- unresolved low-confidence logic affecting `required`, `relevant`, `calculate`, `constraint`, screener routing, eligibility, or submission shape
- unsupported logic that would materially change respondent flow or regulatory outcome

**Draft fast behavior**

- surface the same issues clearly
- allow handoff once the scaffold is structurally valid
- require an explicit acknowledgment of unresolved issues

---

## 7. Phase 4: Refine

### 7.1 Purpose

A lightweight visual editor for the scaffold that sits between Proposal review and Studio handoff. It exposes the most common modifications analysts need to make before committing, without exposing the full complexity of Studio's full shell.

### 7.2 Layout

The refine workspace uses an Inquest-specific shell and theme while reusing relevant shared components:

- **Left:** narrative outline of sections, repeat groups, and completion state
- **Center:** scaffold canvas with a reduced operation set
- **Right:** simplified inspector showing Identity, Field Config, source traceability, behavior rules, and response behavior notes

The refine workspace should be decomposed so the outline, scaffold canvas, simplified inspector, behavior preview, and issue queue can each be mounted independently.

### 7.3 Issue Queue

Refine uses a persistent Issue Queue rather than ephemeral toast prompts. Each issue remains visible until the analyst:

- resolves it
- explicitly defers it
- regenerates the affected structure

Common examples:

- setting a currency for a money field
- verifying a conditional rule
- adjusting repeat bounds
- adding format validation to a required identifier

Acting on an issue focuses the relevant property or opens the relevant preview.

### 7.4 Chat Continuation

The LLM chat from Intake remains accessible as a collapsible drawer. The analyst can continue the conversation:

> Actually, make the employer fields only show up when the income source is Employment.

The assistant translates this into the appropriate command patch and applies it through the shared mutation layer. Conversational edits are not a side channel; they dispatch the same commands as direct UI edits.

### 7.5 Progression

The analyst proceeds to handoff by clicking **Open in Studio** or by the assistant suggesting the scaffold is ready once required gates are satisfied.

---

## 8. Phase 5: Handoff

### 8.1 Dispatch

The finalized scaffold is prepared inside The Inquest using the shared Studio command model, then handed off to Studio with a serialized payload.

**New-project mode**

- Studio creates a fresh project
- Studio replays the Inquest command bundle
- the resulting history remains undoable in Studio

**Import-subform mode**

- Inquest packages a generated standalone Definition snapshot for the selected subtree
- Studio applies `project.importSubform` into the chosen target group
- Studio may then replay a small set of safe follow-up commands that do not conflict with host structure
- unsupported root-level constructs such as whole-form screener replacement, root metadata changes, or page-mode rewrites are surfaced before handoff instead of being silently merged

The handoff does not use `project.import`, because that clears undo history and would erase provenance of the generated changes.

### 8.2 Transition

Clicking **Open in Studio** navigates into Studio with the handoff payload attached. After Studio loads, the imported/generated content is selected and a welcome banner explains what was created, what remains editable, and whether any issues were deferred.

Studio should expose a **Reopen Inquest** action in the resulting project. When the original local session still exists on the same browser, this action returns to the saved Inquest workspace.

### 8.3 Provenance Boundaries

Project metadata stores summary provenance under `x-inquest`, including:

- template used
- provider identifier
- working mode
- summarized inputs
- summarized analysis/proposal decisions
- source trace references
- open/deferred issue summaries

Project metadata must not store:

- raw API keys
- raw uploaded files
- raw full chat transcript
- local-only draft artifacts

Those remain in local browser storage only.

---

## 9. LLM Integration

### 9.1 Model Requirements

The Inquest requires multimodal LLM capability for:

- text conversation
- image analysis
- PDF reasoning
- structured JSON output

V1 supports Gemini, OpenAI, and Anthropic (Claude) through direct browser calls using analyst-supplied keys.

### 9.2 Prompt Architecture

The model context includes:

- Formspec Definition semantics relevant to generation
- FEL syntax and function guidance
- Studio command catalog guidance
- template seed context
- source input summaries
- current reviewed requirements
- current scaffold state during later edits

Prompting must specifically teach behavior that affects trust, including:

- `relevant`
- `required`
- `readonly`
- `constraint`
- shape severity
- screener scope
- `nonRelevantBehavior`
- route ordering and fallback behavior

### 9.3 Normalized Output Contracts

Provider-specific responses are normalized into shared internal contracts before feature modules consume them. The core contracts are:

- `AnalysisV1`
- `ProposalV1`
- `CommandPatchV1`
- `TraceMapV1`

Malformed outputs trigger validation errors and targeted retries. Inquest feature modules should never parse vendor-native payloads directly.

### 9.4 Error Handling

If the model produces invalid structure or invalid commands, the system:

1. validates the output against the normalized contract
2. retries with diagnostic feedback when appropriate
3. attempts bounded repair only when the result remains explainable
4. moves unresolved elements into Open Issues when repair fails
5. blocks handoff until structural validity is restored

Mode-specific issue rules then determine whether semantic uncertainty also blocks handoff.

If the browser cannot reach the provider API, the setup chip switches to an error state with retry guidance. Existing local session artifacts remain intact; only model-backed actions are paused.

---

## 10. Edge Cases

### 10.1 Minimal Input

If the analyst provides only a short description such as "I need a patient intake form," the system may generate a broad scaffold from common patterns. In Verify Carefully mode, this should surface prominently as low-confidence content rather than pretending confidence that does not exist.

### 10.2 Excessive Input

If the analyst uploads a very large regulatory document, the system should summarize the document structure, show coverage by section, and let the analyst narrow the scope before full generation.

### 10.3 Contradictory Input

If user instructions conflict with uploaded materials, the contradiction must be elevated into the Issue Queue. In Verify Carefully mode, the analyst must resolve it before handoff.

### 10.4 Multiple Form Scans

If the analyst uploads multiple images of a multi-page paper form, the system should maintain page order, section continuity, and a unified field inventory.

### 10.5 Existing Project Merge

When invoked from an existing project, the system receives existing keys and target context before generation. Merge mode should behave like subform import, not like whole-project overwrite. Any generated constructs that cannot be merged safely must be surfaced before handoff.

### 10.6 Re-entry

If the analyst closes The Inquest mid-flow and reopens it on the same browser/device, the previous session state is restored. The landing surface should clearly show recent sessions and the current saved milestone.

If browser storage has been cleared, the analyst may still see provenance inside Studio, but the full local draft cannot be recovered. The product must be explicit about this limitation.

---

## 11. Command Mapping

Every mutation during The Inquest maps to the same Studio commands via shared `formspec-studio-core` primitives.

| Phase | Commands Used |
|-------|--------------|
| Phase 1: Intake | None (accumulates inputs, no Definition mutation) |
| Phase 2: Analysis | None (processing and review state only) |
| Phase 3: Proposal | None (generates scaffold in memory, not yet committed) |
| Phase 4: Refine | `definition.addItem`, `definition.deleteItem`, `definition.renameItem`, `definition.moveItem`, `definition.reorderItem`, `definition.setBind`, `definition.setItemProperty`, `definition.setFieldDataType`, `definition.setFieldOptions`, `definition.setDefinitionProperty`, `definition.setFormPresentation`, `definition.addShape`, `definition.setShapeProperty`, `definition.setShapeComposition`, `definition.addVariable`, `definition.setVariable`, `definition.setOptionSet`, `definition.addInstance`, `definition.setInstance`, `definition.setScreener`, `definition.addScreenerItem`, `definition.setScreenerBind`, `definition.addRoute`, `definition.setRouteProperty`, `definition.reorderRoute`, `component.addNode`, `component.setNodeProperty` |
| Phase 5: Handoff | `new-project`: replay the same command bundle. `import-subform`: use `project.importSubform` plus safe follow-up commands when applicable. |

Inquest must not invent a parallel mutation language.

---

## 12. Design Specifications

### 12.1 Visual Direction

The Inquest has its own visual identity. It should not reuse The Stack's Swiss Brutalist shell styling directly.

Base palette: warm parchment background (`#F4EEE2`), deep ink panels (`#1C2433`), brass accent (`#B7791F`), blue-teal action color (`#2F6B7E`), and rust warning color (`#B44C3B`).

The overall feel is an editorial research desk: precise, investigative, and calm. It should feel like a sister product to Studio, not an embedded Studio mode.

### 12.2 Review Presentation

Confidence and issue states must use icon + label + color, not color alone.

Source trace, behavior preview, and open issues should read like analyst tools, not chat gimmicks.

### 12.3 Accessibility and Typography

Fraunces is used for major headings and section titles, IBM Plex Sans for UI/body text, and IBM Plex Mono for structured data and command references.

Primary body copy and controls should not render below 14px. Dense metadata may go to 12px when contrast remains AA-compliant.

### 12.4 Transitions

Review to Refine and Inquest to Studio transitions may animate, but motion must clarify state change rather than decorate it.

---

## 13. Analytics and Success

### 13.1 Tracked Events

- Inquest started
- Inquest resumed
- working mode selected
- provider configured
- input provided
- analysis completed
- proposal generated
- behavior preview used
- issue resolved or deferred
- refine edit applied
- handoff completed
- handoff blocked
- Inquest abandoned

### 13.2 Quality Metrics

- **Extraction accuracy.** Percentage of detected fields that survive into the final Definition without material label changes.
- **Logic translation accuracy.** Percentage of reviewed natural-language rules that produce valid FEL without manual correction.
- **Issue resolution before handoff.** Percentage of blocking or warned issues resolved before Studio handoff.
- **Time to first trusted scaffold.** Time from Inquest start to a structurally valid scaffold with traceable logic.
- **Scaffold retention.** Percentage of generated items that remain in the published definition.

---

## 14. Future Enhancements

### 14.1 Expanded Template Library

Expand the initial starter set into richer jurisdiction- and domain-specific libraries.

### 14.2 Iterative Re-Inquest

Allow analysts to upload new regulatory guidance against an existing definition and generate targeted updates instead of starting over.

### 14.3 Multi-Form Programs

Support generation of related form suites with shared option sets, shared field groups, and migration-aware versioning.

### 14.4 Collaborative Inquest

Support shared sessions, attribution, comments, and cloud-backed case history once local-only v1 has proven the workflow.

---

*End of document.*
