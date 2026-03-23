# Implementation plan: WASM runtime / tools split (ADR 0050)

**ADR:** [0050-wasm-runtime-tools-split.md](../adr/0050-wasm-runtime-tools-split.md)  
**Status:** In progress (partial implementation landed)  
**Date:** 2026-03-23

## 1. Goal

Ship two separately built and loaded WASM artifacts:

| Artifact | Role |
|----------|------|
| **Runtime** | Default `initFormspecEngine()` / `createFormEngine()` path — definition evaluation, FEL, coercion, migrations, option-set inlining, path/item helpers, screener. Keeps `registryDocuments` evaluation contract; **no** `jsonschema` / full lint crate in the binary. |
| **Tools** | Lazy-loaded — lint/schema planning, registry document helpers, changelog, mapping execution, definition assembly, FEL authoring helpers (tokenize, print, catalog, rewrites, `validateExtensionUsage`). |

Public TypeScript entrypoints on `formspec-engine` stay stable; internals route to runtime vs tools and lazy-init tools on first use.

## 2. Phase 0 — Baseline (before any split)

Record **evidence** for ADR acceptance criteria §Measure and gate.

- [ ] Monolith `wasm-pkg/formspec_wasm_bg.wasm`: raw bytes, gzip, brotli (same `wasm-opt` flags as today). *Optional historical row — compare from a pre-split commit if needed.*
- [x] Post-split runtime/tools `.wasm` sizes (raw + gzip + brotli) recorded in [2026-03-23-wasm-split-baseline.md](../reviews/2026-03-23-wasm-split-baseline.md). *Note: same Rust crate today → sizes match until Rust split.*
- [x] Rough Node cold-process timings: `initFormspecEngine()` vs `init` + `initFormspecEngineTools()` in baseline doc.
- [x] Node: `createFormEngine()` + first `setValue` on kitchen-sink fixture — recorded in [wasm-split-baseline.md](../reviews/2026-03-23-wasm-split-baseline.md). *Browser + explicit eval/validation step still open.*
- [ ] Optional: `cargo bloat` / `twiggy` on `formspec-wasm` for Rust-side intuition (not a gate by itself).

Store numbers in this plan or the baseline template [2026-03-23-wasm-split-baseline.md](../reviews/2026-03-23-wasm-split-baseline.md) and link from ADR implementation notes when done.

## 3. Rust: crate layout (pick one, document in PR)

ADR allows either **two crates** or **one crate + features + two `wasm-pack` builds**.

**Recommended default:** two crates for clarity and to avoid accidental feature unification:

| Crate | Depends on | Excludes |
|-------|------------|----------|
| `formspec-wasm-runtime` | `fel-core`, `formspec-core`, `formspec-eval` | `formspec-lint` |
| `formspec-wasm-tools` | runtime crate **or** shared `formspec-wasm-core` glue + `formspec-lint` + mapping/assembly/registry/changelog modules | N/A (full surface) |

**Alternative:** single `formspec-wasm` with `default = ["full"]`, `runtime = []`, and two `wasm-pack` invocations with `--no-default-features --features runtime` vs full. Higher risk of `cfg` drift; only choose if duplication is worse than discipline.

**Concrete tasks:**

- [x] List every `#[wasm_bindgen]` export in `crates/formspec-wasm/src/*.rs` and assign **runtime** vs **tools** (TS §5). *Rust split below: runtime Cargo build omits **lint-only** exports; all other symbols ship in both `.wasm` files until further cfg work.*
- [x] **Single-crate feature split (landed):** `formspec-wasm` feature `lint` (default on) + optional `formspec-lint`; runtime `wasm-pack` uses `-- --no-default-features`. *Two separate crates (`formspec-wasm-runtime` / `-tools`) still optional for clearer boundaries.*
- [ ] Ensure **runtime** build still compiles `formspec-eval` paths that use `registryDocuments` / extension constraints. **Invariant:** extension validation required during batch definition evaluation stays in **runtime** WASM (Rust eval path). The TS wrapper `wasmValidateExtensionUsage` belongs in **tools** only if it is diagnostics/authoring-only and not invoked on the `FormEngine` hot path; grep call sites before locking the matrix.
- [x] Confirm `formspec-eval` does **not** depend on `formspec-lint` (verified in `crates/formspec-eval/Cargo.toml` — runtime split is structurally viable).
- [x] `formspec-py` / native consumers: grep for `formspec-wasm`; update if they embed the monolith; document which artifact(s) each consumer loads. *(2026-03-23: `crates/formspec-py` has no wasm references.)*

**Rust `#[wasm_bindgen]` vs Cargo `lint`:** All exports in `fel`, `evaluate`, `value_coerce`, `definition`, `mapping`, `registry`, `changelog`, `split_abi`, and the **non-lint** `document` APIs (`detectDocumentType`, `jsonPointerToJsonPath`, `planSchemaValidation`) appear in **both** WASM artifacts today. Only `lintDocument` and `lintDocumentWithRegistries` are behind `feature = "lint"` and exist **only** in the tools build. TS still routes document/lint calls through the tools module only (ADR 0050).

## 4. Export ownership matrix (`wasm-bridge.ts` → WASM)

Lock ambiguous rows (**especially `wasmParseFEL`**, which may overlap runtime compilation) with repo-wide grep **before** splitting implementation; treat that lock as part of Phase 0 or the first task in this section.

**Runtime (eager)** — required for `FormEngine` hot path and definition setup:

| TS wrapper | Notes |
|------------|--------|
| `wasmEvalFEL` | Public / tests |
| `wasmEvalFELWithContext` | Engine |
| `wasmPrepareFelExpression` | FEL pipeline |
| `wasmResolveOptionSetsOnDefinition` | `definition-setup` |
| `wasmApplyMigrationsToResponseData` | Response migration |
| `wasmCoerceFieldValue` | `setValue` path |
| `wasmGetFELDependencies` | Dependency wiring |
| `wasmAnalyzeFEL` | Variable + calculate bind setup |
| `wasmNormalizeIndexedPath` | Path helpers |
| `wasmItemAtPath`, `wasmItemLocationAtPath` | Engine helpers |
| `wasmEvaluateDefinition` | Core eval loop |
| `wasmEvaluateScreener` | Screener routing |
| `wasmEvaluateDefinitionPayload` | Lives in `wasm-fel.ts`; stays on runtime |

**Tools (lazy)** — load second module on first call:

| TS wrapper | Notes |
|------------|--------|
| `wasmPlanSchemaValidation` | Lint / schema planning |
| `wasmLintDocument`, `wasmLintDocumentWithRegistries` | Lint |
| `wasmAssembleDefinition` | `assembleDefinition` public API |
| `wasmExecuteMapping`, `wasmExecuteMappingDoc` | `RuntimeMappingEngine` / mapping |
| `wasmParseRegistry`, `wasmFindRegistryEntry`, `wasmValidateLifecycleTransition`, `wasmWellKnownRegistryUrl` | Registry **document** tooling |
| `wasmGenerateChangelog` | Changelog |
| `wasmCollectFELRewriteTargets`, `wasmRewriteFELReferences`, `wasmRewriteFelForAssembly`, `wasmRewriteMessageTemplate` | Assembly / FEL rewrite |
| `wasmPrintFEL`, `wasmListBuiltinFunctions` | `fel-api` |
| `wasmTokenizeFEL`, `wasmValidateExtensionUsage` | `fel-api` / `formspec-core` diagnostics (studio) |

**Ambiguous — locked (2026-03-24 grep):**

| TS wrapper | Bucket | Evidence |
|------------|--------|----------|
| `wasmParseFEL` | **Tools** | No TS callers outside `wasm-bridge`; `Project.parseFEL` uses `analyzeFEL` (runtime), not `wasmParseFEL`. |
| `wasmExtractDependencies` | **Tools** | No monorepo imports; `wasmGetFELDependencies` remains runtime for engine deps. |
| `wasmDetectDocumentType`, `wasmJsonPointerToJsonPath` | **Tools** | No monorepo imports outside bridge; not on `FormEngine` path. |

*Update this table if grep finds a runtime import — matrix is the contract.*

## 5. TypeScript bridge

- [x] Add `packages/formspec-engine/wasm-pkg-runtime/` and `wasm-pkg-tools/` (names TBD — keep consistent with generated crate names, e.g. `formspec_wasm_runtime_*`). Record the final directory and generated module name prefix in one place (fences, docs, CI) to avoid drift.
- [x] Reconcile **two `wasm-pack` outputs**: duplicate generated types / `InitInput` shapes if any; expose a **single** stable public type surface through the compatibility barrel (`wasm-bridge.ts`) so app code does not import both glue packages directly.
- [x] Export a shared split-module compatibility constant from both generated JS glue packages (for example `FORMSPEC_WASM_SPLIT_ABI_VERSION`) and validate it before any tools wrapper becomes callable.
- [x] Implement `initWasm()` → **runtime only** (current behavior for render-first apps).
- [x] Implement `initWasmTools()` — idempotent promise, dynamic `import()` of tools JS glue; Node path mirrors current `readFileSync` + `initSync` resolution logic.
- [x] `initWasmTools()` must verify runtime/tools compatibility before exposing tools APIs. On mismatch, fail fast with a targeted error that includes the runtime version, tools version, and artifact names.
- [x] Split implementation files:
  - `wasm-bridge-shared.ts` — Node `.wasm` path resolution (Vitest-safe)
  - `wasm-bridge-runtime.ts` — runtime `_wasm` + runtime wrappers
  - `wasm-bridge-tools.ts` — tools `_wasmTools` + tools wrappers
  - `wasm-bridge.ts` — re-export **same** `wasmXxx` names as today (compatibility barrel per ADR)
- [x] `createMappingEngine` / `assembleDefinition` / lint entrypoints: ensure first call triggers `initWasmTools()` only (never from `initFormspecEngine()` / `createFormEngine()` alone). *(Note: `await assembleDefinition()` calls `initWasmTools()` lazily; sync `assembleDefinitionSync` / `RuntimeMappingEngine` require explicit `initFormspecEngineTools()`.)*
- [x] Error messages: runtime vs “tools not loaded” vs `initWasmTools` load failure (see `wasm-bridge-runtime.ts` / `wasm-bridge-tools.ts`).

## 6. Build & packaging

- [x] `packages/formspec-engine/package.json`: two `wasm-pack build` commands, same `wasm-opt` profile as today for apples-to-apples baseline.
- [x] `Makefile` / root build scripts: no `wasm-pack` / `wasm-pkg` references found (2026-03-24); `npm run build` in engine owns WASM. *Re-check if Makefile gains a wasm step later.*
- [ ] CI (e.g. `.github/workflows`): replace hardcoded monolith WASM paths or copy steps with both artifacts where needed.
- [ ] Publish layout: both artifact dirs under `formspec-engine` package (or document if tools is optional peer — default: bundle both in `formspec-engine`).
- [x] Vite / Vitest: Node `readFileSync` for `.wasm` must not assume `file:` `import.meta.url` (Vitest can rewrite it). `resolveWasmAssetPathForNode()` in `wasm-bridge.ts` + `formspec-studio-core/tests/setup.ts` loads tools WASM like engine tests.
- [ ] Update any consumer docs that reference a single `.wasm` filename (including Python/native embedders if they document WASM loading).

## 7. Dependency fences & repo hygiene

- [x] `scripts/check-dep-fences.mjs`: extend `WASM_PATTERN` / owner rule so only `formspec-engine` may import `wasm-pkg-runtime`, `wasm-pkg-tools`, or generated module names (replace single `formspec_wasm` string with explicit allowlist).
- [x] Grep repo for `formspec_wasm`, `wasm-pkg/formspec_wasm`, `formspec-wasm` in docs, scripts, and workflow YAML; update CI/build instructions. *(CI had no hardcoded monolith paths; `CLAUDE.md` / `AGENTS.md` / engine README / `.gitignore` / dep fences updated.)*

## 8. Testing strategy

**Unit / integration (Vitest):**

- [x] **Runtime isolation:** test that after `initFormspecEngine()` (or `initWasm()`) and through first `createFormEngine()` + minimal render/eval, tools JS glue module was **not** imported — e.g. Vitest mock on the dynamic import path, or assert no tools chunk is requested in the browser harness. *(Partial: `packages/formspec-engine/tests/isolation/wasm-runtime-isolation.mjs` runs without global setup and asserts tools stay unloaded + sync tools API throws.)*
- [x] **Tools init idempotence:** `initFormspecEngineTools()` safe to call multiple times after global setup (`tests/wasm-tools-init.test.mjs`).
- [x] **Lazy tools (full):** `tests/isolation/wasm-tools-import-count.mjs` — `_toolsWasmDynamicImportCount` increments once across repeated `initFormspecEngineTools()` (`npm run test:wasm-tools-import-count`).
- [ ] **Top-level API compatibility:** package-root imports for existing public APIs still resolve from `formspec-engine` without caller rewrites unless explicitly documented as a breaking change.
- [x] **Compatibility guard:** `assertRuntimeToolsSplitAbiMatch` + `tests/wasm-split-abi.test.mjs` lock the mismatch error text; full mismatched-artifact integration test still optional.
- [ ] **Regression:** full engine test suite + `formspec-webcomponent` tests unchanged in public API.
- [ ] **Registry:** fixture with `registryDocuments: [{ entries: [...] }]` still produces same eval / extension constraint behavior as baseline (snapshot or existing tests).

**Browser build / E2E:**

- [ ] Build a minimal runtime-first browser entry and verify the initial bundle/chunk graph does **not** include tools JS glue or tools `.wasm`.
- [ ] Load studio or a minimal Vite app: network tab shows only runtime artifacts until a tools feature is used.
- [ ] After first tools API call, tools JS glue and tools `.wasm` load once and are reused.

## 9. Completion checklist (maps to ADR acceptance criteria)

- [x] `initFormspecEngine()` / `createFormEngine()` do not import, fetch, or initialize tools JS glue or tools WASM.
- [x] `formspec-webcomponent` render path: no `wasm-pkg-tools` / `initFormspecEngineTools` references (grep 2026-03-23). *Formal E2E/network proof still open (§8 browser).*
- [x] `formspec-layout` unchanged (still no engine/WASM; grep 2026-03-24).
- [ ] Package-root `formspec-engine` public APIs remain stable where ADR 0050 expects stability; tools-owned APIs still resolve from the top-level package and lazy-load internally.
- [x] Baseline doc: runtime artifact **smaller than tools/full** (raw + gzip + brotli) — see [wasm-split-baseline.md](../reviews/2026-03-23-wasm-split-baseline.md). *Historical monolith row still optional.*
- [ ] Lint / registry / changelog / mapping / assembly behave the same once tools loaded.
- [ ] `registryDocuments` contract preserved for extension-aware evaluation.
- [ ] Runtime/tools compatibility mismatch fails early with a targeted error rather than surfacing as a late lazy-load failure.

## 10. Follow-ups (non-blocking, from ADR)

- Path-normalization: reduce regex use where hand parsing is simpler.
- After split: re-measure; then reconsider schema validator / `jsonschema` strategy if still too heavy in **tools** only.

## 11. Locked decisions for first implementation

1. **Supported packaging story**
   `formspec-engine` ships one package containing both generated artifacts:
   - runtime WASM + JS glue
   - tools WASM + JS glue

   The only supported consumer model in this phase is:
   - runtime loads by default
   - tools loads lazily on first tools API call

   We do **not** support a separate "tools re-exports the full public surface as a monolith replacement" mode in the first split. If embedders need a single CLI-sized artifact later, treat that as follow-up design work after the split lands and is measured.

2. **Versioning / compatibility**
   Runtime and tools artifacts version in **lockstep**. Both generated JS glue packages must expose the same split-module compatibility constant/version.

   `initWasmTools()` must verify that:
   - runtime can report its compatibility version
   - tools reports the same compatibility version

   If versions differ, fail fast with a targeted error that names both versions and tells the caller to align the package artifacts.
