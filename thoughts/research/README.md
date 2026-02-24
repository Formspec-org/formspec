# Research — Prior Art Investigation

This directory contains the research that informed the Formspec specification design. The work happened in two phases:

## Phase 1: Spec Proposals (`proposals/`)

A [research prompt](prompt.md) was written to investigate XForms, SHACL, and FHIR R5, then synthesize findings into an original JSON-native form standard. The prompt was given to three LLM providers, each producing an independent spec proposal:

| File | Provider | Proposed Name |
|------|----------|---------------|
| [`proposals/claude.md`](proposals/claude.md) | Claude (Anthropic) | Universal Declarative Forms (UDF) |
| [`proposals/gemini.md`](proposals/gemini.md) | Gemini (Google) | Universal Declarative Form Architecture (UDFA) |
| [`proposals/gpt.md`](proposals/gpt.md) | GPT (OpenAI) | JSON Declarative Form Model (JDFM) |

Each proposal independently arrived at similar core abstractions (instance/bind/shape separation, reactive dependency graphs, structured validation with severity levels, canonical versioning). The convergence across providers validated the design direction; the divergences highlighted areas needing deeper analysis.

Each proposal was then evaluated against the full requirements list from the research prompt, producing a feature requirements matrix:

| File | Proposal | Coverage |
|------|----------|----------|
| [`proposals/claude.feature-requirements-matrix.md`](proposals/claude.feature-requirements-matrix.md) | UDF (Claude) | 35 Full, 0 Partial, 0 None |
| [`proposals/gemini.feature-requirements-matrix.md`](proposals/gemini.feature-requirements-matrix.md) | UDFA (Gemini) | 34 Full, 1 Partial, 0 None |
| [`proposals/gpt.feature-requirements-matrix.md`](proposals/gpt.feature-requirements-matrix.md) | JDFM (GPT) | 33 Full, 2 Partial, 0 None |

The matrices identified each proposal's strengths and weaknesses, which informed the final synthesis.

### Synthesized Proposal

The three proposals and their matrices were combined into a single synthesized specification: [`proposals/synthesized.md`](proposals/synthesized.md). This uses the Claude (UDF) proposal as the structural backbone — the most specification-grade of the three — enhanced with the best ideas from the other two:

- **From GPT (JDFM):** `whenExcluded` policy object (submission/evaluation split), four-tier validation modes (`draft`/`save`/`submit`/`audit`), `money` composite type, `Missing` runtime type, dual addressing (`path` + `dataPointer`), `activeWhen` naming, `explain` object on shapes, spec version field, `??` null-coalescing operator
- **From Gemini (UDFA):** First-class `financial` composite type design (amount + currency tuple), execution narrative style for worked examples

## Phase 2: Deep-Dive Analysis (`analysis/`)

Using Claude Opus 4.6 via [Shelly](https://exe.dev) (AI coding agent on exe.dev), targeted deep-dives were conducted against the actual W3C and HL7 specifications to extract precise semantics rather than LLM-summarized approximations:

| File | Subject |
|------|---------|
| [`analysis/xforms-spec-analysis.md`](analysis/xforms-spec-analysis.md) | XForms 1.1 — MIPs, dependency graphs, repeat semantics, submission processing |
| [`analysis/xforms-conceptual-model.md`](analysis/xforms-conceptual-model.md) | XForms 1.1 — distilled conceptual model (MIP table, recalculation rules, key design patterns) |
| [`analysis/xforms2-spec-analysis.md`](analysis/xforms2-spec-analysis.md) | XForms 2.0 — changes from 1.1: new MIPs (`initial`, `whitespace`), JSON/CSV instances, custom functions, non-relevant submit modes, per-constraint alerts, form composition |
| [`analysis/shacl-spec-analysis.md`](analysis/shacl-spec-analysis.md) | SHACL — shapes, constraint composition, validation reporting, severity model |
| [`analysis/fhir-conceptual-model.md`](analysis/fhir-conceptual-model.md) | FHIR R5 Questionnaire & SDC — versioning, identity, response pinning, modular composition |
| [`analysis/other-spec-analysis.md`](analysis/other-spec-analysis.md) | Secondary influences — ODK XLSForm, SurveyJS, JSON Forms, CommonGrants |

Each analysis was also distilled into a feature exploration matrix — a structured inventory of every distinct feature/pattern with priority classification:

| File | Source | Features |
|------|--------|----------|
| [`analysis/xforms-spec-analysis.feature-exploration-matrix.md`](analysis/xforms-spec-analysis.feature-exploration-matrix.md) | XForms 1.1 | 110 (XF-001–110) |
| [`analysis/xforms-conceptual-model.feature-exploration-matrix.md`](analysis/xforms-conceptual-model.feature-exploration-matrix.md) | XForms 1.1 (conceptual) | 88 (XCM-001–088) |
| [`analysis/xforms2-spec-analysis.feature-exploration-matrix.md`](analysis/xforms2-spec-analysis.feature-exploration-matrix.md) | XForms 2.0 | 74 (XF2-001–074) |
| [`analysis/shacl-spec-analysis.feature-exploration-matrix.md`](analysis/shacl-spec-analysis.feature-exploration-matrix.md) | SHACL | 70 (SH-001–070) |
| [`analysis/fhir-conceptual-model.feature-exploration-matrix.md`](analysis/fhir-conceptual-model.feature-exploration-matrix.md) | FHIR R5/SDC | 80 (FH-001–080) |
| [`analysis/other-spec-analysis.feature-exploration-matrix.md`](analysis/other-spec-analysis.feature-exploration-matrix.md) | Secondary influences | 95 (SI-001–095) |

**Total: 517 features extracted** (98 Critical, 181 High, 151 Medium, 87 Low).

## Phase 3: Comparative Analysis

The [`comparative-analysis.md`](comparative-analysis.md) cross-references all research artifacts against the implemented spec in two parts:

**Part 1 — Prior Art vs. Synthesized Proposal:** Maps all 517 extracted features against the synthesized proposal. Result: 241 Adopted (46.6%), 123 Adapted (23.8%), 153 Missing (29.6%). Zero Critical-priority features are missing from the synthesis.

**Part 2 — Synthesis + Prior Art vs. Implemented Core Spec:** Compares the full research pipeline against what actually shipped in [`specs/core/spec.md`](../../specs/core/spec.md). Result: 259 Implemented (50.1%), 90 Partially Implemented (17.4%), 168 Not Implemented (32.5%). 92% of Critical-priority features are implemented. Identifies 16 novel features unique to the real spec that weren't in any prior art. Provides prioritized actionable recommendations (must-add / should-add / consider / defer).

## Outcome

All of this research culminated in the formal Formspec Core Specification: [`specs/core/spec.md`](../../specs/core/spec.md).

Key lineage from each source into the final spec:

- **XForms** — MIP vocabulary (`calculate`, `constraint`, `relevant`, `required`, `readonly`), reactive dependency DAG, non-relevant data exclusion, repeatable sections as first-class primitives
- **SHACL** — Validation shapes decoupled from data, three severity levels (error/warning/info), structured validation results with field paths and constraint metadata
- **FHIR R5/SDC** — Canonical URL + semver identity, definition/response separation, status lifecycle, modular composition via assembly
- **ODK XLSForm** — Clean field reference syntax as alternative to XPath verbosity
- **SurveyJS/JSON Forms** — Practical validation mode patterns, external error injection
