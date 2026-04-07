# Formspec Licensing

Formspec uses an open-core licensing model. The specification, schemas, and runtime libraries are permissively licensed to maximize adoption. The authoring and tooling packages are source-available under a commercial-use restriction that converts to Apache-2.0 after four years.

## Versions prior to this change

All versions released before this relicensing were published under AGPL-3.0-only. Those versions remain available under AGPL-3.0 terms. This license change applies to all subsequent releases.

## Apache-2.0 — Specification, Schemas, and Runtime

The following are licensed under the [Apache License 2.0](LICENSE):

**Specification and schemas:**
- `specs/` — All specification documents
- `schemas/` — All JSON Schema files

**TypeScript runtime packages:**
- `@formspec-org/types` — TypeScript type definitions
- `@formspec-org/engine` — Form state engine, FEL evaluator, validation
- `@formspec-org/layout` — Layout algorithm
- `@formspec-org/webcomponent` — `<formspec-render>` web component
- `@formspec-org/react` — React hooks and renderer
- `@formspec-org/adapters` — Design-system render adapters

**Rust crates:**
- `fel-core` — FEL parser, evaluator, and dependency analysis
- `formspec-core` — Path utils, schema validation, assembler
- `formspec-eval` — Batch evaluator
- `formspec-wasm` — WASM bindings
- `formspec-py` — Python (PyO3) bindings

**Python package:**
- `formspec-py` (on PyPI) — Server-side FEL, validation, linting, mapping

**Swift:**
- `FormspecSwift` — iOS/macOS/visionOS renderer

You may use, modify, and distribute these packages freely under the terms of Apache-2.0, including in proprietary and commercial applications. See [LICENSE](LICENSE) for full terms.

## BSL 1.1 — Authoring and Tooling

The following are licensed under the [Business Source License 1.1](LICENSE-BSL):

**TypeScript authoring packages:**
- `@formspec-org/core` — Project model, handlers, normalization
- `@formspec-org/studio-core` — Authoring helpers and evaluation layer
- `@formspec-org/studio` — Visual form designer
- `@formspec-org/chat` — Conversational form-filling interface
- `@formspec-org/mcp` — MCP server for AI-driven form authoring
- `@formspec-org/assist` — Assist interoperability implementation

**Rust crates:**
- `formspec-lint` — Static analysis pipeline
- `formspec-changeset` — Changeset dependency analysis

**What the BSL allows:**
- Internal use within your organization
- Development, testing, and evaluation
- Non-commercial and academic use
- Any use that is not a competing hosted "Form Authoring Service"

**What requires a commercial license:**
- Offering a hosted or managed service that allows third parties to create, edit, or manage Formspec form definitions using the BSL-licensed components

**Change date:** April 7, 2030 — on this date, all BSL-licensed code converts automatically to Apache-2.0.

For commercial licensing inquiries, contact Michael.Deeb@tealwolf.consulting.

## Form definitions are your data

Your JSON form definitions, responses, themes, mappings, and all other Formspec documents you create are **your data**. They are not covered by any Formspec license. You own them completely regardless of which tools you used to create them.

## Contributing

By submitting a contribution (pull request, patch, or other code) to this repository, you agree to license your contribution under the same license that applies to the package(s) you are modifying. We require a Contributor License Agreement (CLA) for all contributions — the CLA bot will guide you through this on your first pull request.
