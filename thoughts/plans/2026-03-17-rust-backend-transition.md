# Rust Backend Transition Plan

**Date:** 2026-03-17
**Status:** Archived — superseded by `2026-03-20-rust-decommission-tasks.md` and successor plans.
**Goal:** Replace the TypeScript (formspec-engine) and Python (src/formspec) implementations with a shared Rust crate, exposed via WASM (TypeScript) and PyO3 (Python), while keeping all existing tests and consumers working.

---

## Current State

Dependency inversion interfaces have been extracted for the major subsystems. The existing implementations satisfy these contracts. A Rust backend can implement the same interfaces and be swapped in without changing consumer code.

### Interfaces Already Extracted

| Subsystem | TypeScript Interface | Python Protocol | Status |
|-----------|---------------------|-----------------|--------|
| FEL evaluation | `IFelRuntime`, `ICompiledExpression` | `FelRuntime` | ✅ Done |
| Form engine | `IFormEngine` | `FormProcessor` | ✅ Done |
| Mapping | `IRuntimeMappingEngine` | `MappingProcessor` | ✅ Done |
| Validation | `SchemaValidator` (pre-existing) | `FormValidator` | ✅ Done |
| Adapters | N/A | `DataAdapter` | ✅ Done |

### Key Files

- `packages/formspec-engine/src/fel/runtime.ts` — `IFelRuntime`, `ICompiledExpression`, `FelContext`
- `packages/formspec-engine/src/fel/chevrotain-runtime.ts` — `ChevrotainFelRuntime` (current impl)
- `packages/formspec-engine/src/interfaces.ts` — `IFormEngine`, `IRuntimeMappingEngine`
- `src/formspec/fel/runtime.py` — `FelRuntime` protocol, `DefaultFelRuntime`
- `src/formspec/protocols.py` — `FormProcessor`, `FormValidator`, `MappingProcessor`, `DataAdapter`

---

## Remaining Interface Refactoring

### Priority 1 — Consumers that construct concrete classes

These files instantiate concrete implementations. To swap backends, they need factory functions or constructor injection.

#### TypeScript

| File | Import | Usage | Fix |
|------|--------|-------|-----|
| `formspec-webcomponent/src/element.ts` | `FormEngine` | `new FormEngine(def)` | Add factory: `createFormEngine(def, ctx)` |
| `formspec-studio/.../BehaviorPreview.tsx` | `FormEngine` | `new FormEngine(def)` | Use factory |
| `formspec-studio/.../TestResponse.tsx` | `FormEngine` | `new FormEngine(def)` | Use factory |
| `formspec-studio-core/src/evaluation-helpers.ts` | `FormEngine` | `new FormEngine(def)` | Use factory |
| `formspec-core/src/handlers/mapping.ts` | `RuntimeMappingEngine` | `new RuntimeMappingEngine(doc)` | Add factory: `createMappingEngine(doc)` |
| `formspec-mcp/src/schemas.ts` | `createSchemaValidator` | Factory call | Already a factory — just swap the impl |
| `formspec-core/tests/diagnostics.test.ts` | `createSchemaValidator` | Factory call | Same |

#### Python

| File | Import | Usage | Fix |
|------|--------|-------|-----|
| `src/formspec/validate.py` | `DefinitionEvaluator`, `MappingEngine` | Construction | Accept via param or factory |
| `examples/references/server/main.py` | `DefinitionEvaluator`, `MappingEngine` | Construction | Use factories |
| Tests (8 files) | `DefinitionEvaluator` | Construction | Use factory or parametrize |
| Tests (3 files) | `MappingEngine` | Construction | Use factory or parametrize |

### Priority 2 — Direct FEL pipeline access (bypasses runtime interface)

These files use FEL internals (lexer/parser singletons, AST nodes) directly rather than going through `IFelRuntime`/`FelRuntime`. They'll break if the AST format changes with Rust.

#### TypeScript

| File | Import | Usage | Fix |
|------|--------|-------|-----|
| `formspec-studio/src/lib/fel-editor-utils.ts` | `FelLexer`, `parser` | Tokenize + parse for syntax highlighting | Add `IFelAnalyzer` interface with `tokenize()` and `analyze()` |
| `formspec-studio-core/src/project.ts` | `rewriteFELReferences` | FEL path rewriting | Add to `IFelRuntime` or separate `IFelRewriter` |
| `formspec-core/src/handlers/definition-instances.ts` | `rewriteFELReferences` | FEL path rewriting | Same |
| `formspec-engine/src/fel/analysis.ts` | `FelLexer`, `parser`, `dependencyVisitor` | Static analysis | Add `IFelAnalyzer` interface |

#### Python

| File | Import | Usage | Fix |
|------|--------|-------|-----|
| `src/formspec/validator/expressions.py` | `parse` (via `_default_parse`) | Expression compilation | ✅ Already accepts `parse` callable |
| `src/formspec/validator/dependencies.py` | `extract_dependencies` | AST-level dep extraction | Operates on parsed AST — needs `IFelRuntime.extract_dependencies_from_ast()` or keep Python-side |
| `src/formspec/mapping/engine.py` | `Evaluator`, `Environment`, etc. | Still imported (unused after refactor?) | Clean up dead imports |

### Priority 3 — Test files using concrete FEL internals

These test files directly construct `Evaluator`, `Environment`, `parse()` etc. They're testing the *current* implementation, not the interface. Two options:
1. Keep them as impl-specific tests (run only against Python backend)
2. Rewrite as interface-level tests (run against any backend)

| File | Imports | Recommendation |
|------|---------|----------------|
| `tests/unit/test_fel_parser.py` | `parse`, `RESERVED_WORDS` | Keep as impl test |
| `tests/unit/test_fel_evaluator.py` | `parse`, `Evaluator`, `Environment` | Rewrite to use `FelRuntime.evaluate()` |
| `tests/unit/test_fel_functions.py` | `evaluate` (convenience fn) | ✅ Already uses public API |
| `tests/unit/test_fel_api.py` | `parse`, `evaluate`, etc. | ✅ Already uses public API |
| `tests/unit/test_fel_repeat.py` | `parse`, `Evaluator`, `Environment` | Rewrite to use `FelRuntime` |
| `tests/unit/test_fel_mip.py` | `parse`, `Evaluator`, `Environment` | Rewrite to use `FelRuntime` |
| `tests/conformance/parity/test_shared_suite.py` | Multiple concrete imports | Rewrite to use `FelRuntime` |
| `tests/conformance/fuzzing/test_*.py` | Multiple concrete imports | Rewrite to use `FelRuntime` |

---

## Transition Phases

### Phase 1: Factory Functions (pre-Rust)

Add factory functions that default to the current implementations but can be overridden. This is the last refactoring step before Rust work begins.

**TypeScript:**
```typescript
// packages/formspec-engine/src/factories.ts
export function createFormEngine(
    definition: FormspecDefinition,
    runtimeContext?: FormEngineRuntimeContext,
    registryEntries?: RegistryEntry[],
): IFormEngine {
    return new FormEngine(definition, runtimeContext, registryEntries);
}

export function createMappingEngine(doc: any): IRuntimeMappingEngine {
    return new RuntimeMappingEngine(doc);
}
```

**Python:**
```python
# src/formspec/factories.py
def create_form_processor(
    definition: dict,
    registries=None,
    fel_runtime=None,
) -> FormProcessor:
    from .evaluator import DefinitionEvaluator
    return DefinitionEvaluator(definition, registries, fel_runtime)

def create_mapping_engine(doc: dict, fel_runtime=None) -> MappingProcessor:
    from .mapping.engine import MappingEngine
    return MappingEngine(doc, fel_runtime)
```

Update all constructor call sites to use factories. Tests can parametrize over `factory` to run against both backends.

### Phase 2: Rust Crate

Build the shared Rust crate implementing FEL evaluation first (highest value, most complex).

```
crates/
  formspec-core/          # Shared Rust crate
    src/
      fel/                # FEL lexer, parser, interpreter
        mod.rs
        lexer.rs
        parser.rs
        evaluator.rs
        stdlib.rs
      engine/             # Form state management
      mapping/            # Bidirectional mapping
      validation/         # Constraint + shape evaluation
      lib.rs
```

**Build targets:**
- `wasm32-unknown-unknown` → WASM for TypeScript (`wasm-bindgen`)
- `cdylib` → Python extension via PyO3/maturin

**Migration order (by risk/complexity):**

1. **FEL evaluator** — Self-contained, most testable. The conformance suite validates correctness.
2. **Dependency extractor** — Static analysis, no state.
3. **Validation engine** — Bind constraints + shape evaluation.
4. **Form processor** — 4-phase batch processing (Python `DefinitionEvaluator`).
5. **Response builder** — Serialization with NRB handling.
6. **Mapping engine** — Rule-based transforms.

### Phase 3: WASM Bridge (TypeScript)

```typescript
// packages/formspec-engine/src/fel/wasm-runtime.ts
import init, { WasmFelEngine } from 'formspec-core-wasm';

export class WasmFelRuntime implements IFelRuntime {
    private engine: WasmFelEngine;

    static async create(): Promise<WasmFelRuntime> {
        await init();
        return new WasmFelRuntime();
    }

    compile(expression: string): FelCompilationResult { ... }
    listBuiltInFunctions(): FELBuiltinFunctionCatalogEntry[] { ... }
}
```

Usage:
```typescript
const runtime = await WasmFelRuntime.create();
const engine = createFormEngine(definition, { felRuntime: runtime });
```

### Phase 4: PyO3 Bridge (Python)

```python
# Installed as formspec-core-rs via pip (maturin build)
from formspec_core_rs import RustFelRuntime

class PyO3FelRuntime:
    """FelRuntime backed by Rust via PyO3."""
    def __init__(self):
        self._inner = RustFelRuntime()

    def parse(self, source: str) -> Any: ...
    def evaluate(self, source, data=None, **kw) -> EvalResult: ...
    def extract_dependencies(self, source) -> DependencySet: ...
```

Usage:
```python
from formspec_core_rs import PyO3FelRuntime
processor = create_form_processor(definition, fel_runtime=PyO3FelRuntime())
```

### Phase 5: Dual-Run Validation

Run both backends in parallel to catch behavioral differences.

```python
# tests/conftest.py
@pytest.fixture(params=['python', 'rust'])
def fel_runtime(request):
    if request.param == 'python':
        return DefaultFelRuntime()
    else:
        return PyO3FelRuntime()

@pytest.fixture
def form_processor(fel_runtime):
    return create_form_processor(definition, fel_runtime=fel_runtime)
```

The conformance suite (`tests/conformance/`) is purpose-built for this — it already validates cross-implementation parity.

### Phase 6: Deprecate & Remove Old Implementations

Once Rust passes all conformance tests:
1. Make Rust the default runtime (keep Python/Chevrotain as fallback)
2. Run both in CI for one release cycle
3. Remove the Python FEL evaluator, Chevrotain pipeline, and old FormEngine internals
4. The interfaces remain — they're the permanent API contract

---

## Shared Type Contract

Both WASM and PyO3 bridges must produce values matching the existing type contracts. Critical shared types:

**FEL values:** null, boolean, number (decimal), string, date, array, money object
**Validation results:** `{ path, severity, code, constraintKind, message }`
**Dependency sets:** field paths, instance refs, context refs, MIP deps, structural flags
**Processing results:** `{ valid, results, data, variables, counts }`

The JSON Schema files in `schemas/` are the canonical structural definitions. FEL behavioral semantics are defined in `specs/fel/fel-grammar.md` and tested by the conformance suite.

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| FEL behavioral divergence | Conformance suite + property-based fuzzing already exist |
| WASM bundle size | Tree-shake unused stdlib functions; lazy-load WASM |
| PyO3 type marshaling overhead | Batch operations; avoid per-field round-trips |
| Signal reactivity mismatch | Keep Preact signals in TypeScript; Rust only does computation |
| Partial migration stalls | Each phase is independently shippable; can stop at any point |

---

## Immediate Next Steps

1. **Add factory functions** (Phase 1) — last refactoring before Rust
2. **Set up Rust workspace** — `Cargo.toml`, CI, wasm-pack, maturin
3. **Port FEL lexer/parser** — start with the grammar, validate against `tests/conformance/spec/test_fel_spec_examples.py`
4. **Port FEL stdlib** — 40+ functions, each independently testable
5. **Wire WASM runtime** — `WasmFelRuntime implements IFelRuntime`
