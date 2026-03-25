---
title: "Give your form a bibliography and AI stops guessing"
description: "Formspec's References and Ontology specs create a dual context layer — meaning plus evidence — that lets AI agents auto-fill, explain, and support form completion with grounded, domain-accurate answers instead of plausible-sounding hallucinations."
date: 2026-03-25
tags: ["ai", "specification", "deep-dive", "ontology"]
author: "Michael Deeb & Claude"
---

A grant program officer opens a federal financial report — 47 fields across six pages, half of them conditioned on answers to previous questions. She knows this form. She's filled it out twenty times. But the new indirect cost rate negotiation just closed, and she needs to remember whether the de minimis rate applies to modified total direct costs or total direct costs, and whether equipment over $5,000 is excluded from the base. The answer is buried in 2 CFR §200.414, subsection (f), cross-referenced with §200.68.

She could look it up. She will, eventually. But first she'll spend twenty minutes re-reading regulation she's already read, confirming what she mostly remembers, because getting this wrong means a disallowed cost finding in the next audit.

Now picture the same form with an AI companion. She focuses the field, and the agent says: "The de minimis rate is 10% of modified total direct costs per 2 CFR §200.414(f). MTDC excludes equipment over $5,000, patient care costs, rental costs, tuition remission, and subawards beyond the first $25,000 — per §200.1." It cites the regulation. It links to the exact subsection. It didn't guess.

The question is: how did the agent know to look there?

## Forms have context. The context doesn't travel with them.

Every form exists in a web of external knowledge — regulations, policies, help articles, glossaries, coding standards, institutional guidance. The people who build the form know this context intimately. But the form itself doesn't carry it. The form is a data structure: fields, types, labels, validation rules. The context lives in separate documents, training materials, and the heads of experienced staff.

This is the gap that makes AI form assistance unreliable. A language model can read a field label and infer what it probably means. It can generate a plausible answer to "what's an indirect cost rate?" from its training data. But plausible isn't the same as correct, and training data isn't the same as the specific regulation that governs this specific form in this specific context.

When the AI guesses, it sometimes gets it right — which is worse than always getting it wrong, because it builds misplaced confidence. The program officer starts trusting the suggestions. Then one day the model cites a regulation section that was superseded in the latest rulemaking, or applies a rate ceiling from a different agency's guidance, and the error propagates into a submission that takes months to unwind.

The problem isn't that AI can't reason about forms. It's that forms don't give AI anything specific to reason with.

## Two layers that close the gap

Formspec addresses this with two companion specifications that attach machine-readable context to form definitions. Each is a standalone sidecar document — a separate file that lives alongside the form definition, independently authored and versioned. Neither modifies the form's behavior; both enrich what humans and agents can do with it.

**The [Ontology spec](/blog/ontology-layer) declares what each field *means*.** It binds form fields to concepts in external standards — schema.org, FHIR, ICD-10, Dublin Core, whatever ontology governs the domain. A field isn't just `indirectCostRate` with a label and a number type. It's formally identified as a concept in the federal cost accounting framework, with cross-system equivalences to related concepts in other standards. The AI doesn't have to guess what the field represents from its label. The ontology tells it.

**The References spec declares where to find authoritative context.** It binds external resources — regulatory documents, knowledge bases, vector store collections, help articles, tool schemas — to specific fields or to the form as a whole. Each reference declares its type (regulation, documentation, vector-store, tool, context), its intended audience (human, agent, or both), and its priority. The AI doesn't have to search its training data for relevant guidance. The references tell it exactly where to look.

Separately, each layer is useful. Together, they're transformative. The ontology tells the agent *what* a field represents. The references tell it *where the authoritative answer lives*. That's the difference between "here's what I think an indirect cost rate is" and "here's what 2 CFR §200.414(f) says about the rate that applies to this specific field."

## What this looks like in practice

Here's a simplified References Document for a federal financial report. It attaches context at two levels — form-wide regulatory guidance, and field-specific resources for the indirect cost rate:

```json
{
  "$formspecReferences": "1.0",
  "version": "1.0.0",
  "title": "SF-425 Federal Guidance References",
  "targetDefinition": {
    "url": "https://example.gov/forms/sf-425"
  },
  "references": [
    {
      "target": "#",
      "type": "regulation",
      "audience": "both",
      "title": "2 CFR Part 200 — Uniform Administrative Requirements",
      "uri": "https://www.ecfr.gov/current/title-2/part-200",
      "priority": "primary"
    },
    {
      "target": "#",
      "type": "vector-store",
      "audience": "agent",
      "title": "Federal grants guidance knowledge base",
      "uri": "vectorstore:pinecone/federal-grants-v3",
      "tags": ["rag", "grants", "2-cfr-200"]
    },
    {
      "target": "indirectCostRate",
      "type": "regulation",
      "audience": "both",
      "rel": "constrains",
      "title": "2 CFR §200.414 — Indirect (F&A) Costs",
      "uri": "https://www.ecfr.gov/current/title-2/section-200.414",
      "selector": "Section 200.414(f) — De minimis rate of 10%"
    },
    {
      "target": "indirectCostRate",
      "type": "context",
      "audience": "agent",
      "rel": "defines",
      "title": "Indirect cost rate guidance",
      "content": "The indirect cost rate is a percentage negotiated between the grantee organization and its cognizant federal agency. Organizations without a negotiated rate may use the de minimis rate of 10% per 2 CFR §200.414(f).",
      "priority": "primary"
    }
  ]
}
```

And here's the corresponding Ontology Document fragment, binding the same field to its formal concept identity:

```json
{
  "$formspecOntology": "1.0",
  "version": "1.0.0",
  "targetDefinition": {
    "url": "https://example.gov/forms/sf-425"
  },
  "concepts": {
    "indirectCostRate": {
      "concept": "urn:us-gov:2cfr200:indirect-cost-rate",
      "system": "urn:us-gov:2cfr200",
      "display": "Negotiated Indirect Cost Rate",
      "equivalents": [
        {
          "system": "https://schema.org",
          "code": "MonetaryAmount.rate",
          "type": "related"
        }
      ]
    }
  }
}
```

When an AI agent encounters the `indirectCostRate` field, it now has:

1. **Semantic identity** — this isn't a generic rate field. It's a negotiated indirect cost rate under the 2 CFR 200 framework, related to (but not the same as) a generic monetary rate.
2. **Inline context** — a concise explanation of what the field means and how it's determined, written specifically for agent consumption.
3. **Authoritative source** — the specific regulation section that governs this value, with a selector pointing to the exact subsection about the de minimis rate.
4. **A searchable knowledge base** — a vector store the agent can query for deeper context when the inline guidance isn't enough.
5. **The relationship type** — `rel: "constrains"` on the regulation means this isn't just background reading; the regulation actively constrains what values are valid.

The agent doesn't hallucinate. It reads.

## Five things this enables

### 1. Grounded auto-fill suggestions

When a user asks the agent to help fill a field, the agent doesn't generate an answer from training data. It queries the field's references — inline context first, then vector store or knowledge base if needed — and constructs a response grounded in authoritative sources. The suggestion includes a citation. The user can click through to the regulation.

This is retrieval-augmented generation scoped to the individual field. The References spec is the retrieval configuration; the Ontology spec provides the semantic query context.

### 2. Field-level "explain this" that actually explains

A user clicks a help icon on the indirect cost rate field. The agent assembles context from three sources: the field's ontology binding (what this concept means in the domain), the field's references (the specific regulation, the inline guidance), and any form-level references (the broader regulatory framework). It synthesizes an explanation that is specific to this field, this form, this regulatory context — not a generic definition pulled from a training corpus.

### 3. Cross-field reasoning with domain grounding

An agent reviewing a completed form can use ontology bindings to understand relationships between fields and references to check consistency. The `indirectCostRate` field is bound to the 2 CFR 200 framework. The `totalDirectCosts` field is bound to the same framework. The agent can query the vector store for the relationship between these concepts and flag if the math doesn't match the applicable rate agreement — citing the specific regulation, not just flagging a numerical inconsistency.

### 4. Human access to the right document at the right time

References aren't just for agents. Every reference with `audience: "human"` or `audience: "both"` is a resource the form renderer can surface as contextual help. A field that links to a regulation section, a worked example, and a completion guide gives the human user one-click access to exactly the resources they need for that field. No searching. No guessing which document covers which topic. The form author already did that work; the references spec makes it declarative and portable.

### 5. Agent tool invocation at the field level

The References spec supports `type: "tool"` — a reference whose `content` is a tool schema. An agent encountering a field with a tool reference can invoke that tool to compute or look up the answer. A tax form field could reference a rate calculator tool. A clinical form field could reference a drug interaction checker. The tool schema travels with the form definition, so any agent that loads the form has access to the right tools for the right fields — without bespoke integration work per field.

## Why two documents, not one?

This is a design choice worth explaining. Ontology and References could be a single document. They're both metadata sidecars, both use path-based binding, both target the same Definition. Why separate them?

Because they have different authors, different update cadences, and different audiences.

The ontology document is typically authored by a data governance team or standards body. It changes when domain standards change — when ICD-10 releases a new version, when a FHIR resource is updated, when the organization adopts a new concept dictionary. These changes are infrequent and deliberate.

The references document is typically authored by the form owner or a subject-matter expert. It changes when guidance documents are updated, when new help articles are published, when the organization deploys a new vector store, or when an agent needs access to a new tool. These changes are more frequent and operational.

Bundling them would force coordination between teams that don't need to coordinate. The standards team would have to re-publish the ontology document every time a help article URL changes. The form owner would have to touch the concept bindings every time a terminology version bumps.

Separate documents also mean separate versioning, separate review processes, and separate deployment. The ontology document for a clinical intake form might be published by HL7. The references document for the same form might be authored by the hospital's IT team, pointing to their specific knowledge base and help system. Neither party needs to know about the other's document.

## The composability argument

Both specs allow multiple documents per form. An organization can layer references:

- A **base references document** with regulatory guidance that applies to all forms of this type.
- An **agency-specific overlay** with additional guidance from the funding agency.
- A **locale variant** with references translated for Spanish-speaking users.
- An **agent-specific document** with vector store endpoints and tool schemas.

Same with ontology documents:

- A **healthcare overlay** binding fields to FHIR concepts.
- A **research overlay** binding the same fields to CDISC standards.
- A **government overlay** binding them to federal data standards.

Each document is authored by the team that owns that context. They merge additively — no coordination required, no conflicts to resolve. A field can have regulatory guidance from the compliance team, help articles from the training team, vector store access from the AI team, and concept identity from the data governance team, all without any of those teams touching each other's documents.

## The agent that reads the bibliography

The vision that motivated the [References ADR](https://github.com/focusconsulting/formspec/blob/main/thoughts/adr/0047-form-references.md) was straightforward: forms exist in context, and that context should be machine-readable. But the combination with the Ontology spec creates something more powerful than either piece alone.

An AI agent filling or assisting with a form now has:

- **What each field means** — not inferred from labels, but declared by ontology bindings.
- **Where to find authoritative answers** — not from training data, but from curated reference resources.
- **What type of resource each reference is** — documentation to read, a vector store to query, a tool to invoke, inline context to include.
- **Who each reference is for** — what to show the human, what to consume silently, what to use for both.
- **How each reference relates to the field** — does it constrain valid values, define the concept, provide an example, or supersede an older version?

This isn't AI that knows things. It's AI that knows where to look — and the form definition tells it where. The result is an agent that can help a program officer fill out a federal financial report not by guessing what regulations might apply, but by reading the specific guidance the form author attached to each field, querying the knowledge base the organization curated for exactly this purpose, and citing the regulation section that constrains the answer.

The form has a bibliography. The agent reads it. The user gets grounded answers instead of plausible ones.
