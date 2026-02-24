# Formspec

**A schema-driven declarative form framework built for structured-data workflows and LLM integration.**

Formspec is a JSON-native standard for defining forms, validation rules, computed values, conditional logic, and repeatable sections. It draws on ideas from W3C XForms (declarative binds and a model/view split), SHACL (shape-based validation graphs), HL7 FHIR Questionnaire (healthcare-grade form semantics), and JSON Forms (JSON Schema-driven UI generation) — distilled into a coherent, JSON-first design suitable for web, mobile, server-side, and offline implementations.

Every artifact — definitions, responses, validation reports — is a JSON document backed by a JSON Schema, making Formspec a natural fit for LLM structured-output pipelines where models generate or consume form data directly.

## Why Formspec?

- **Schema-first** — Every artifact has a JSON Schema. LLMs can generate valid form definitions, fill responses, and interpret validation reports using structured output constraints.
- **Expression language (FEL)** — Built-in language for calculated fields, conditional visibility, cross-field validation, and aggregation functions. No custom code required.
- **Rendering-agnostic** — The same definition drives web, mobile, server-side, and offline implementations. Separate your data model from your UI.
- **Tiered architecture** — Core (data & logic), Theme (presentation), and Components (interaction) are independently specifiable and composable.
- **Dual reference implementation** — TypeScript engine with reactive signals for the client; Python implementation for server-side evaluation, static analysis, and tooling.

## Specification

The specification is organized into tiers that separate concerns:

### Tier 1: Core (Data & Logic)

Defines the data model, bind constraints, validation shapes, FEL expressions, and the processing model.

- [Core Specification](specs/core/spec.md) — Normative spec
- [FEL Grammar](specs/fel/fel-grammar.md) — Expression language (lexical rules, operator precedence, path references, 40+ stdlib functions)
- Schemas: [`definition`](schemas/definition.schema.json) | [`response`](schemas/response.schema.json) | [`validationReport`](schemas/validationReport.schema.json)

### Tier 2: Theme (Presentation)

Defines layout, design tokens, widget styling, selector cascade, page structure, and CSS custom property interop.

- [Theme Specification](specs/theme/theme-spec.md)
- Schema: [`theme`](schemas/theme.schema.json)

### Tier 3: Components (Interaction)

Defines 33 built-in interactive components, slot binding, custom component extensions, accessibility attributes, and responsive breakpoints.

- [Component Specification](specs/component/component-spec.md)
- Schema: [`component`](schemas/component.schema.json)

### Related Specifications

- [Mapping DSL](specs/mapping/mapping-spec.md) — Bidirectional transforms between form data and external formats (JSON, XML, CSV). Schema: [`mapping`](schemas/mapping.schema.json)
- [Extension Registry](specs/registry/extension-registry.md) — Publishing, discovery, and lifecycle for custom extensions. Schema: [`registry`](schemas/registry.schema.json)
- [Changelog Format](specs/registry/changelog-spec.md) — Structured change tracking with impact classification. Schema: [`changelog`](schemas/changelog.schema.json)

## Repository Structure

```
schemas/                        JSON Schema files (8 schemas)
specs/                          Specification documents by tier
packages/
  formspec-engine/              TypeScript core engine
                                  FormEngine, FEL lexer/parser/interpreter,
                                  reactive signals (@preact/signals-core),
                                  definition assembler, path resolver
  formspec-webcomponent/        <formspec-render> custom element
                                  Component registry, theme resolver,
                                  33 built-in components, accessibility
src/formspec/                   Python reference implementation
  fel/                            FEL parser, AST, evaluator, stdlib
  validator/                      Static linter (schema + semantic checks)
  adapters/                       JSON, XML, CSV serialization
  mapping/                        Mapping DSL engine
tests/
  unit/                         Python conformance suite (1000+ tests)
  e2e/                          Playwright browser tests + JSON fixtures
```

## Quick Start

### Install and Build

```bash
npm install
npm run build
```

### Validate a Definition (Python)

```python
import json, jsonschema

with open("schemas/definition.schema.json") as f:
    schema = json.load(f)

with open("my-form.json") as f:
    definition = json.load(f)

jsonschema.validate(instance=definition, schema=schema)
```

### Render a Form (Browser)

```html
<script type="module">
  import "formspec-webcomponent";
</script>

<formspec-render></formspec-render>

<script>
  const el = document.querySelector("formspec-render");
  el.definition = { /* Formspec definition JSON */ };
  el.addEventListener("formspec-submit", (e) => {
    console.log(e.detail); // structured response
  });
</script>
```

### Run the Linter

```bash
# Authoring mode (default) — recoverable issues are warnings
python3 -m formspec.validator path/to/definition.json

# Strict mode — warnings escalated to errors (for CI)
python3 -m formspec.validator --mode strict path/to/definition.json

# Component validation with definition context
python3 -m formspec.validator --definition definition.json component.json
```

## Development

### Build Commands

```bash
npm run build              # Build TypeScript packages
npm run docs:generate      # Regenerate spec artifacts (BLUF, schema refs, LLM docs)
npm run docs:check         # Enforce doc/schema freshness gates (used in CI)
make docs                  # Build HTML documentation (requires pandoc)
```

### Testing

Three test layers cover the full stack:

```bash
# Python conformance suite (schema, FEL, validator, cross-spec contracts)
python3 -m pytest tests/ -v

# TypeScript unit tests (Node test runner + Vitest)
npm run test:unit

# Playwright E2E (auto-starts Vite dev server)
npm test

# Run all tests
npm run test:all
```

See [`tests/README.md`](tests/README.md) for the full test suite breakdown.

### Spec Authoring Workflow

Any change to schemas or specification prose must follow this pipeline:

1. Edit the schema (`schemas/*.json`), canonical spec (`specs/**/*.md`), and/or BLUF summary (`*.bluf.md`)
2. Run `npm run docs:generate` to regenerate derived artifacts
3. Run `npm run docs:check` to verify freshness and cross-spec contracts

Generated files (`*.llm.md`, `*.semantic.md`) must not be hand-edited.

## LLM Integration

Formspec's schema-first design makes it straightforward to integrate with LLM structured-output APIs:

1. **Generate forms** — Pass `schemas/definition.schema.json` as the output schema constraint. The LLM produces a valid Formspec definition directly.
2. **Fill responses** — Pass `schemas/response.schema.json` as the schema. The LLM produces structured form responses that validate against the definition's constraints.
3. **Interpret validation** — Feed `schemas/validationReport.schema.json`-shaped reports back into an LLM for natural-language error explanations or automated remediation.

The compact `*.llm.md` spec variants under `specs/` are optimized for LLM context windows when you need the model to understand Formspec semantics.

## Status

**Version**: 1.0.0-draft.1 — This is a draft specification under active development.

Design rationale is documented in [Architecture Decision Records](thoughts/adr/).
