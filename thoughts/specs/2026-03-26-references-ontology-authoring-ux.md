# References & Ontology Authoring — UX Design Specification

**Date:** 2026-03-26
**Status:** Draft
**Depends on:** References Schema (schemas/references.schema.json), Ontology Schema (schemas/ontology.schema.json)
**Feeds into:** Locale Translation Management (2026-03-26-locale-translation-management.md)

---

## Why This Comes First

The locale translation spec identified that AI translation quality depends on context — and that context lives in the References and Ontology documents. But those documents don't exist for most forms because there's no way to create them. Nobody is going to hand-author JSON with FHIR URIs and regulatory citations.

This interface is the upstream dependency for everything downstream: better translations, better AI form-filling, better interoperability, better documentation. If the References and Ontology documents are empty, every consumer of that context is flying blind.

The goal is to make it so easy and natural to annotate a form with context and meaning that people actually do it.

---

## Who Uses This

Three distinct users, one interface:

1. **Form authors** — building the form, want to attach help text, glossary entries, and regulatory citations as they go. They think in terms of "this field needs an explanation" and "this field is governed by CFR 200.414." They don't think in terms of JSON documents.

2. **Domain experts** — know the subject matter (clinical, financial, regulatory) but aren't building the form. They want to review a form and annotate it: "this field should map to FHIR Patient.identifier" or "this section is governed by HIPAA §164.512." They need to understand the form structure but not edit it.

3. **Data architects** — care about interoperability. They want to tag fields with concept URIs, declare vocabulary bindings for option sets, and set up cross-system alignments. They know what schema.org and FHIR are. They still shouldn't have to hand-write JSON.

The interface must serve all three without making any of them feel lost or talked down to.

---

## Core UX Principle: Annotate the Form, Don't Fill Out a Schema

The References and Ontology schemas are implementation details. Users should never feel like they're "authoring a References Document." They should feel like they're **adding context to their form**.

The mental model:

> "I'm looking at my form. I select a field. I tell the tool what this field means, what rules govern it, and what context someone (human or AI) needs to work with it."

Everything flows from selection → annotation. Not from "open the references tab → create a binding → enter a target path."

---

## Interface Design: The Context Layer

### Not a Tab — A Mode

References and Ontology don't warrant their own workspace tabs. They're metadata about the form's fields — they should appear **where the fields are**. Instead of a 7th tab, this is a **layer toggle** on the Editor canvas.

The Editor currently shows the form structure. The Context Layer overlays it with annotations, badges, and an editing surface for References and Ontology data.

```
┌──────────────────────────────────────────────────────────────────┐
│ [Editor ▾]  [Logic]  [Data]  [Layout]  [Theme]  [Mapping]       │
│                                                                  │
│  Editor Mode:  [Build]  [Context]  [Preview]                     │
│                                                                  │
│  ┌─ Context Layer ─────────────────────────────┬─────────────── │
│  │                                              │               │
│  │  ┌─ Patient Demographics ──────────────┐    │  SELECTED:    │
│  │  │                                      │    │  mrn          │
│  │  │  Medical Record Number    🏷 🔗 📖   │    │               │
│  │  │  [text field]                        │    │  ┌─────────┐ │
│  │  │                                      │    │  │ Meaning │ │
│  │  │  Date of Birth            🏷 📖      │    │  │ Context │ │
│  │  │  [date field]                        │    │  │ Rules   │ │
│  │  │                                      │    │  └─────────┘ │
│  │  │  Primary Diagnosis        🏷 🔗 📖 📚│    │               │
│  │  │  [choice field]                      │    │  (panels      │
│  │  │                                      │    │   below)      │
│  │  └──────────────────────────────────────┘    │               │
│  │                                              │               │
│  └──────────────────────────────────────────────┴───────────────┘
└──────────────────────────────────────────────────────────────────┘
```

**Badge legend on each field:**
- 🏷 = has concept binding (Ontology)
- 🔗 = has references attached
- 📖 = has glossary entry
- 📚 = has vocabulary binding (option set linked to external terminology)

Badges are small, muted icons — not emoji. They tell you at a glance which fields have context and which are bare.

Clicking a field opens the **Context Panel** on the right.

---

### The Context Panel

When a field is selected in Context mode, the right panel shows three collapsible sections. These use plain language, not schema terminology.

#### Section 1: Meaning (Ontology → ConceptBinding)

What does this field represent in the real world?

```
┌─ Meaning ──────────────────────────────────────┐
│                                                  │
│  What this field represents                      │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │ 🔍 Search: "medical record number"       │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌ Matched concept ───────────────────────────┐ │
│  │ Medical Record Number                       │ │
│  │ HL7 FHIR · v2-0203 · Code: MR              │ │
│  │ http://terminology.hl7.org/.../v2-0203#MR   │ │
│  │                                    [Attach] │ │
│  └─────────────────────────────────────────────┘ │
│  ┌ Also found ────────────────────────────────┐ │
│  │ Patient Identifier                          │ │
│  │ schema.org · identifier                     │ │
│  │                                    [Attach] │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  Already attached:                               │
│  ┌─────────────────────────────────────────────┐ │
│  │ 🏷 Medical Record Number                    │ │
│  │ HL7 FHIR · v2-0203#MR                      │ │
│  │                                             │ │
│  │ Also known as:                              │ │
│  │  · schema.org/identifier  (broader)  [✕]   │ │
│  │  · LOINC 76435-7          (exact)    [✕]   │ │
│  │  + Add equivalent                           │ │
│  │                                             │ │
│  │                                    [Detach] │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ── or describe it yourself ──                   │
│  [+ Custom concept URI]                          │
│                                                  │
└──────────────────────────────────────────────────┘
```

**How search works:**
- User types a natural-language description: "medical record number", "date of birth", "employer ID"
- System searches known ontology registries (FHIR, schema.org, ICD-10, Dublin Core, etc.) — this can be a local index, a web search, or an AI-assisted lookup
- Results show: display name, system, code, URI
- User clicks "Attach" — done. The ConceptBinding is created.
- AI auto-suggest: when a field is selected and has no concept binding, the system suggests concepts based on the field's name, type, and label. "This looks like a Medical Record Number — attach FHIR v2-0203#MR?"

**Equivalents** (cross-system mappings) are shown inline under the primary concept. Users add them the same way — search for a concept in another system, declare the relationship type (exact, broader, narrower, related). The relationship picker uses plain language: "is the same as", "is a broader version of", "is a narrower version of", "is related to."

**For option sets** (choice fields with an optionSet), a "Vocabulary" sub-section appears:

```
┌─ Vocabulary ───────────────────────────────────┐
│                                                  │
│  This field's options come from: diagnosisCodes  │
│                                                  │
│  Link to a standard terminology:                 │
│  ┌──────────────────────────────────────────┐   │
│  │ 🔍 Search: "ICD-10"                      │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌ ICD-10-CM (2024) ─────────────────────────┐ │
│  │ International Classification of Diseases    │ │
│  │ http://hl7.org/fhir/sid/icd-10             │ │
│  │                                    [Link]  │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  Linked: ICD-10-CM                               │
│  Filter: Codes under F00-F99, depth ≤ 3          │
│  [Edit filter]                                   │
│                                                  │
│  Value mapping (if your codes differ):           │
│  ┌──────────┬────────────┐                       │
│  │ Your code│ ICD-10 code│                       │
│  ├──────────┼────────────┤                       │
│  │ anxiety  │ F41.1      │                       │
│  │ depression│ F32.9     │                       │
│  └──────────┴────────────┘                       │
│  [+ Add mapping]  [AI: Auto-map]                 │
│                                                  │
└──────────────────────────────────────────────────┘
```

The "AI: Auto-map" button takes the option set values and the linked terminology, and suggests code mappings. This is a high-value AI feature — mapping "anxiety" to "F41.1" is exactly the kind of domain knowledge an LLM handles well.

---

#### Section 2: Context (References → type: context, documentation, glossary)

What should someone (human or AI) know about this field?

```
┌─ Context ──────────────────────────────────────┐
│                                                  │
│  Help & documentation for this field             │
│                                                  │
│  ┌ Glossary ──────────────────────────────────┐ │
│  │ The indirect cost rate is a percentage       │ │
│  │ negotiated with the cognizant federal        │ │
│  │ agency. It represents the ratio of           │ │
│  │ indirect costs to direct costs.              │ │
│  │                                     [Edit]  │ │
│  └─────────────────────────────────────────────┘ │
│  [+ Add glossary entry]                          │
│                                                  │
│  ┌ Documentation ─────────────────────────────┐ │
│  │ 📄 Budget Line Item Help                    │ │
│  │    Explains how to calculate each line       │ │
│  │    https://agency.gov/help/budget-lines     │ │
│  │    For: humans                      [Edit]  │ │
│  │                                             │ │
│  │ 🤖 Agent Context                            │ │
│  │    "This field must be between 0-100%.       │ │
│  │     The rate is pre-negotiated and should    │ │
│  │     not change between reporting periods."   │ │
│  │    For: AI agents                   [Edit]  │ │
│  └─────────────────────────────────────────────┘ │
│  [+ Add documentation]                           │
│                                                  │
│  ┌ AI Context ────────────────────────────────┐ │
│  │ 🤖 Vector Store: grant-regulations          │ │
│  │    vectorstore:pinecone/grant-regulations   │ │
│  │    For: AI agents                   [Edit]  │ │
│  │                                             │ │
│  │ 🤖 Knowledge Base: grant-kb                 │ │
│  │    kb:bedrock/ABCDEF1234                    │ │
│  │    For: AI agents                   [Edit]  │ │
│  └─────────────────────────────────────────────┘ │
│  [+ Add AI resource]                             │
│                                                  │
│  ── Quick add ──                                 │
│  [📝 Glossary]  [📄 Link]  [🤖 AI note]         │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Glossary entries** are the most common reference type. They're inline text that explains what the field means. The input is a simple textarea. This is the entry point for non-technical users — "just explain what this field is."

**Documentation links** point to external resources (URLs, PDFs). The input is: title + URL + optional description + audience toggle (humans / AI / both).

**AI resources** are agent-oriented: vector stores, knowledge bases, tool schemas. These show up only when a user explicitly adds them. The input asks for a URI and description. This is the data architect's territory.

**Quick add** buttons at the bottom offer one-click creation for the most common types.

**AI assist**: "Generate context" button that reads the field's name, type, label, concept binding, and any existing references, then writes a glossary entry and agent context note. This is especially useful for bulk annotation — select 20 fields, hit "Generate context for all", review the results.

---

#### Section 3: Rules (References → type: regulation, policy)

What regulations or policies govern this field?

```
┌─ Rules ────────────────────────────────────────┐
│                                                  │
│  Regulations & policies that apply               │
│                                                  │
│  ┌ 2 CFR § 200.414 — Indirect Costs ─────────┐ │
│  │ Regulation                                   │ │
│  │ https://ecfr.gov/.../section-200.414        │ │
│  │ Section 414(f)                              │ │
│  │ Constrains this field              [Edit]   │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ┌ Agency Policy 2024-03 ─────────────────────┐ │
│  │ Policy                                       │ │
│  │ https://agency.gov/policies/2024-03         │ │
│  │ Authorizes this field              [Edit]   │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  [+ Add regulation]  [+ Add policy]              │
│                                                  │
└──────────────────────────────────────────────────┘
```

Regulations and policies are a distinct category because they have different semantics: they *constrain* or *authorize* fields, they have specific section references, and they're often shared across many fields. The `rel` property (constrains, authorizes, defines, etc.) is shown as a plain-language verb: "Constrains this field", "Authorizes this field", "Defines this field."

---

### Form-Level Context (target: "#")

When no field is selected — or when the user clicks the form title — the Context Panel shows form-level references and the ontology document metadata:

```
┌─ Form Context ─────────────────────────────────┐
│                                                  │
│  About this form                                 │
│                                                  │
│  Domain: Clinical Intake                         │
│  Default ontology: HL7 FHIR R4                   │
│  Publisher: Health Data Standards Board           │
│                                                  │
│  ── Form-level references ──                     │
│                                                  │
│  📄 2 CFR Part 200 (regulation, both)            │
│  📄 Grant Application Manual (documentation)     │
│  🤖 Grant Regulations KB (knowledge-base)        │
│                                                  │
│  [+ Add form-level reference]                    │
│                                                  │
│  ── Cross-system alignments ──                   │
│                                                  │
│  mrn ⟷ FHIR Patient.identifier (exact)          │
│  dob → schema.org/birthDate (exact)              │
│  diagnosis → ICD-10/F41.1 (narrower)             │
│                                                  │
│  [+ Add alignment]                               │
│                                                  │
│  ── JSON-LD context ──                           │
│  { "@vocab": "https://schema.org/" }             │
│  [Edit]                                          │
│                                                  │
└──────────────────────────────────────────────────┘
```

The form-level view is also where the **default ontology system** is set. If the form is clinical, set the default to FHIR — then concept bindings on individual fields can omit the system URI.

---

### Reusable References (referenceDefs)

When a user adds a reference to one field and then wants to attach it to another, the system should handle this seamlessly. Implementation detail: the first time a reference is used on multiple fields, promote it to `referenceDefs` and use `$ref` pointers. The user never sees this — they just see "2 CFR § 200.414" attached to three fields, and editing it in one place updates all three.

In the Context Panel, shared references show a badge: "Used on 3 fields" with a link to see which ones.

---

### Bulk Annotation Mode

For domain experts reviewing a form they didn't build, a **bulk annotation view** shows every field in a table with annotation status:

```
┌─ Bulk Annotation ──────────────────────────────────────────────┐
│                                                                  │
│  [Filter: All ▾]  [Missing meaning ▾]  [No context ▾]           │
│                                                                  │
│  Field              │ Type    │ Meaning │ Context │ Rules        │
│  ───────────────────┼─────────┼─────────┼─────────┼────────      │
│  mrn                │ string  │ 🏷 FHIR │ 📝 ✓   │ —            │
│  dob                │ date    │ 🏷 FHIR │ 📝 ✓   │ —            │
│  diagnosis          │ choice  │ —       │ —       │ —            │
│  indirectCostRate   │ decimal │ —       │ —       │ 🔗 CFR 200   │
│  budget.personnel   │ decimal │ —       │ —       │ —            │
│  budget.travel      │ decimal │ —       │ —       │ —            │
│                                                                  │
│  4 of 6 fields have no concept binding                           │
│  3 of 6 fields have no context                                   │
│                                                                  │
│  [🤖 AI: Suggest meanings for all]                               │
│  [🤖 AI: Generate context for all]                               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

Clicking a row opens the Context Panel for that field. The AI bulk actions are the power feature: "Suggest meanings for all" uses the field names, types, labels, and any existing annotations to propose concept bindings across the entire form. The user reviews and approves each suggestion.

This is accessible from a toggle in the Context mode — switch between "Canvas" (visual form with badges) and "Table" (bulk annotation grid).

---

## AI Features

### 1. Auto-Suggest Concept Bindings

When a field is selected and has no concept binding, the system suggests one based on:
- Field name (`mrn` → "Medical Record Number")
- Field label ("Date of Birth" → schema.org/birthDate)
- Field type (date → temporal concepts, choice → coded concepts)
- Parent group label ("Patient Demographics" → FHIR Patient resource)
- Form-level default system (if FHIR, prioritize FHIR concepts)

Suggestions appear as a subtle prompt below the search box: *"This might be: Medical Record Number (FHIR v2-0203#MR)"* with an [Accept] button.

### 2. Bulk Concept Suggestion

"Suggest meanings for all untagged fields" — the AI analyzes the entire form structure and proposes concept bindings for every field that doesn't have one. Returns a review list where the user can accept, reject, or modify each suggestion.

This is the highest-leverage AI feature. A 50-field form that would take hours to manually annotate with FHIR bindings can be done in minutes with AI suggestions + human review.

### 3. Generate Context Notes

"Generate context for this field" — the AI writes a glossary entry and an agent context note based on the field's name, type, concept binding, and any attached references. For the glossary, it writes a clear, non-technical explanation. For the agent context, it writes structured guidance for AI systems.

### 4. Auto-Map Option Values to Terminology Codes

Given an option set (e.g., `{ "anxiety": "Anxiety", "depression": "Depression" }`) and a linked vocabulary (e.g., ICD-10-CM), the AI suggests code mappings: `anxiety → F41.1`, `depression → F32.9`.

### 5. Reference Discovery

"Find regulations for this field" — given a concept binding or field description, the AI searches for relevant regulations, standards, and documentation. For a field bound to FHIR Patient.identifier, it might suggest HIPAA §164.512 and CMS Interoperability Rule.

### 6. Cross-System Alignment Suggestion

"Suggest alignments" — given concept bindings on multiple fields, the AI proposes cross-system alignments. If `mrn` is bound to FHIR v2-0203#MR, it suggests an alignment to schema.org/identifier (broader) and LOINC 76435-7 (exact).

---

## How This Feeds Translation

When the locale translation interface (per the companion spec) assembles a `TranslationContext` for each string key, it pulls from whatever the user has annotated here:

| Annotation | Translation benefit |
|------------|-------------------|
| Concept binding: FHIR MR | AI knows this is a medical record number, uses correct clinical terminology in target language |
| Glossary entry | AI reads the definition, translates with domain understanding |
| Vocabulary: ICD-10 | AI knows option labels are medical codes, preserves standard terminology |
| Regulation: 2 CFR 200 | AI understands the regulatory context, uses official translated terminology where it exists |
| Agent context | AI reads what the field means to other AI systems, maintains consistency |

Even partial annotation helps. A form with concept bindings but no glossary entries still gives the translator field semantics. A form with glossary entries but no concept bindings still gives natural-language context. Both together give the best results.

The incentive structure is: **annotate your form → get better translations for free.** This makes the References and Ontology interface feel immediately valuable, not like busywork.

---

## State & Data Model

### New State in ProjectState

```typescript
interface ProjectState {
  // ... existing ...
  references: Record<string, ReferencesState>;   // keyed by document name
  selectedReferencesId?: string;
  ontology: Record<string, OntologyState>;        // keyed by document name
  selectedOntologyId?: string;
}
```

Multiple References and Ontology documents are supported per definition (different audiences, domains). The common case is one of each.

### New Handlers in formspec-core

**References handlers:**
- `references.load` — register a References Document
- `references.remove` — remove a references document
- `references.select` — set active references document
- `references.addReference` — add a reference binding (target path + reference data)
- `references.updateReference` — update a reference by index
- `references.removeReference` — remove a reference by index
- `references.setReferenceDef` — add/update a reusable reference definition
- `references.removeReferenceDef` — remove a reusable reference definition
- `references.setMetadata` — update document metadata

**Ontology handlers:**
- `ontology.load` — register an Ontology Document
- `ontology.remove` — remove an ontology document
- `ontology.select` — set active ontology document
- `ontology.setConcept` — set concept binding for a field path
- `ontology.removeConcept` — remove concept binding
- `ontology.setVocabulary` — set vocabulary binding for an option set
- `ontology.removeVocabulary` — remove vocabulary binding
- `ontology.addAlignment` — add a cross-system alignment
- `ontology.updateAlignment` — update an alignment
- `ontology.removeAlignment` — remove an alignment
- `ontology.setDefaultSystem` — set the default concept system
- `ontology.setMetadata` — update document metadata

### New MCP Tool

| Tool | Purpose |
|------|---------|
| `formspec_context` | Unified tool for References + Ontology CRUD. Actions: `add_reference`, `remove_reference`, `set_concept`, `remove_concept`, `set_vocabulary`, `add_alignment`, `set_glossary`, `suggest_concepts`, `suggest_context`, `coverage_report` |

One tool, not two — from the MCP consumer's perspective, they're adding context to fields, not authoring separate JSON documents.

### New studio-core Helpers

```typescript
// References
project.addReference(target: string, ref: ReferenceInput): HelperResult
project.updateReference(target: string, index: number, ref: Partial<ReferenceInput>): HelperResult
project.removeReference(target: string, index: number): HelperResult
project.addGlossary(target: string, text: string): HelperResult  // shorthand
project.addRegulation(target: string, title: string, uri: string, section?: string): HelperResult  // shorthand

// Ontology
project.setConcept(path: string, concept: ConceptInput): HelperResult
project.removeConcept(path: string): HelperResult
project.setVocabulary(optionSetName: string, vocab: VocabularyInput): HelperResult
project.removeVocabulary(optionSetName: string): HelperResult
project.addAlignment(alignment: AlignmentInput): HelperResult
project.removeAlignment(index: number): HelperResult

// Context assembly (for translation and AI consumers)
project.getFieldContext(path: string): FieldContext  // assembles all context for a field
project.getFormContext(): FormContext                  // assembles form-level context
project.contextCoverage(): CoverageReport             // how annotated is the form?
```

---

## Phasing

### Phase 1: Handlers + MCP Tool

Build `formspec-core` handlers for both References and Ontology, the `formspec_context` MCP tool, and studio-core helpers. This unlocks chat-driven annotation immediately:

```
User: "Tag all the clinical fields with FHIR concepts"
AI:   [analyzes field names/types, suggests bindings]
      "I've suggested FHIR concept bindings for 12 fields. Review?"
```

### Phase 2: Context Layer UI

Build the Editor "Context" mode toggle, the Context Panel (Meaning / Context / Rules sections), and the badge overlay on the canvas. Wired to Phase 1 handlers.

### Phase 3: Bulk Annotation + AI Features

Build the bulk annotation table view, AI auto-suggest for concepts, AI context generation, and vocabulary auto-mapping. This is where the tool becomes a multiplier — one domain expert can annotate a 100-field form in 30 minutes.

### Phase 4: Concept Search Infrastructure

Build or integrate a concept search backend. Options:
- **Bundled index**: ship a local index of common ontologies (FHIR R4, schema.org, Dublin Core, ICD-10 top-level) — no network required
- **Web search**: query FHIR terminology server, BioPortal, Linked Open Vocabularies — richer but requires connectivity
- **AI-mediated**: ask the LLM to suggest concept URIs — works offline with the model, but URIs need validation

Phase 4 is independent of Phases 2-3. The UI works with manual URI entry from day one; search makes it faster.

---

## Open Questions

1. **One document or many?** Most forms will have one References doc and one Ontology doc. Supporting multiple (per audience, per domain) adds complexity. Start with one of each; add multi-document support only when a real use case demands it.

2. **Import from existing standards?** If a form is clinical, could we import FHIR StructureDefinition and auto-populate concept bindings? This is a Phase 4+ feature but worth designing the import seam now.

3. **Validation?** Should the Context Layer warn about concept URIs that don't resolve, or references with broken links? Yes, but as non-blocking warnings — annotation is better than no annotation, even if a URI has a typo.

4. **Export for review?** Domain experts may want to review annotations in a spreadsheet (field | concept | glossary | references). A CSV export of the context coverage report would be low-effort and high-value.
