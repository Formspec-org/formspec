# Formspec Licensing

Formspec uses an open-core licensing model. The specification, schemas, and runtime libraries are permissively licensed to maximize adoption. The authoring and tooling packages are source-available under a commercial-use restriction that converts to Apache-2.0 after four years.

## License history

This project has been relicensed twice:

1. **MIT** — original license at project inception
2. **AGPL-3.0-only** — adopted during development
3. **Apache-2.0 / BSL 1.1** — current open-core model (this version)

Code obtained under a prior license remains available under those terms for the version at which it was obtained. This license change applies to all subsequent releases.

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
- `formspec-lint` — Static analysis pipeline
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
- `@formspec-org/assist` — Assist interoperability implementation

_Note: `@formspec-org/studio-core`, `@formspec-org/studio`, `@formspec-org/chat`, and `@formspec-org/mcp` are also BSL-1.1 but live in the `formspec-studio` sibling repo._

**Rust crates:**
- `formspec-changeset` — Changeset dependency analysis

**What the BSL allows:**
- Internal use within your organization
- Development, testing, and evaluation
- Non-commercial and academic use
- Building internal tools, even commercially, as long as they are not offered to third parties as a form authoring product
- Any use that is not a competing "Form Authoring Product" (hosted *or* packaged)

**What requires a commercial license:**
- Offering a product — hosted, managed, on-premises, or packaged — that allows third parties to create, edit, or manage Formspec form definitions using the BSL-licensed components

**Change date:** April 7, 2030 — on this date, all BSL-licensed code converts automatically to Apache-2.0.

For commercial licensing inquiries, contact Michael.Deeb@tealwolf.consulting.

## Form definitions are your data

Your JSON form definitions, responses, themes, mappings, and all other Formspec documents you create are **your data**. They are not derivative works of Formspec. They are not covered by any Formspec license. You own them completely regardless of which tools you used to create them. This is stated explicitly in the [BSL license text](LICENSE-BSL).

## Trademarks

"Formspec," the Formspec logo, and "FEL" are trademarks of Michel Deeb / TealWolf Consulting LLC. The Apache-2.0 and BSL 1.1 licenses grant rights to the *code*, not to the name or brand.

**You may:**
- Use the name "Formspec" to accurately describe your project's relationship to Formspec (e.g., "built on Formspec," "compatible with Formspec," "uses the Formspec engine")
- Use the name in technical documentation, blog posts, and conference talks

**You may not:**
- Use "Formspec" or confusingly similar names as the name of your own product, service, or company
- Use the Formspec logo in a way that suggests endorsement or affiliation without written permission
- Register domain names or social media accounts using "Formspec" without written permission

For trademark use questions, contact Michael.Deeb@tealwolf.consulting.

## Contributing

By submitting a contribution to this repository, you agree to license your contribution under the same license that applies to the file(s) you are modifying, and you acknowledge that the maintainers may offer the project (including your contributions) under commercial license terms. See [CONTRIBUTING.md](CONTRIBUTING.md) for full terms.
