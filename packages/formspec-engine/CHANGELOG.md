# @formspec-org/engine

**Velocity tier:** 1 — Foundation
**Target cadence:** 3–6 months

All notable changes to this package will be documented in this file.

## [Unreleased]

### Changed

- **FEL analysis wire format:** WASM/Rust `fel_analysis_to_json_value` exposes parse failures as `errors: { message, span? }[]` (not plain strings). `@formspec-org/engine` normalizes these to `FELAnalysisError` with `line`, `column`, and `offset` for backward-compatible UX; optional `span` is passed through when present.
