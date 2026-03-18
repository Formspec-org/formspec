---
title: "Introducing Formspec: A JSON-native form specification for high-stakes environments"
description: "Why we built a new form specification, what it solves, and how it fits into the ecosystem of tools for grants, field operations, and compliance workflows."
date: 2026-02-20
tags: ["announcement", "specification"]
author: "Michael Deeb & Claude"
---

Most form systems handle simple cases well. Grant applications, compliance reports, and field inspection checklists are not simple cases. ([Why another form thing?](/blog/why-another-form-thing) covers the gap in detail.)

## What Formspec is

Formspec is a **JSON-native form specification**. A form definition is a structured JSON document — validated by JSON Schema, lintable by the static analyzer, runnable by two reference implementations (TypeScript and Python).

Here's a minimal example:

```json
{
  "title": "Grant Application",
  "items": [
    {
      "id": "org_name",
      "type": "string",
      "label": "Organization name",
      "bind": { "required": "true" }
    },
    {
      "id": "org_type",
      "type": "choice",
      "label": "Organization type",
      "choices": [
        { "value": "nonprofit", "label": "Nonprofit (501c3)" },
        { "value": "government", "label": "Government agency" }
      ]
    },
    {
      "id": "ein",
      "type": "string",
      "label": "EIN",
      "bind": {
        "relevant": "$org_type = 'nonprofit'",
        "required": "true"
      }
    }
  ]
}
```

A few things to notice:

- The `bind.relevant` expression uses **[FEL](/blog/fel-design)** (Formspec Expression Language) — a deterministic, side-effect-free language for computed values and conditions
- The EIN field is conditionally required: it's only relevant when the org type is nonprofit, and only then required
- This same definition can be loaded into the TypeScript engine (browser) or the Python evaluator (server) — the same rules run in both environments

## What Formspec is not

Formspec is the form engine — data, logic, validation, rendering. It is not:
- A hosting platform
- An auth system
- A workflow engine
- A database

Your stack handles those. Formspec handles the form.

## Three tiers

The specification is organized into three tiers:

**Core** — The data and logic layer: field types, binds (required, relevant, readonly, calculate), FEL expressions, repeatable groups, validation reports.

**Theme** — The presentation layer: visual tokens, widget catalog, page layout, responsive design. Separated cleanly so you can change how a form looks without touching what it validates.

**Components** — The interaction layer: 33 built-in components (TextInput, Select, DatePicker, etc.), slot binding, custom components, responsive configuration.

## Status

The specification, two reference implementations (TypeScript and Python), conformance suite, web component, static linter, [MCP server](/blog/zero-hallucination-forms), and visual studio are all functional. The specification and reference implementations are published openly.

If you're working on a high-stakes form problem — grants, inspections, compliance, intake — we'd like to hear from you.
