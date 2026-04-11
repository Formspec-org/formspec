# ADR-0016: Feature Completeness Gap Remediation

**Status**: Implemented (execution complete, updated 2026-02-24)
**Date**: 2026-02-23
**Authors**: Claude (AI), exedev
**Deciders**: exedev

---

## 1. Context and Problem Statement

A cross-cutting audit (`thoughts/feature-complete.md`) reveals that while the Formspec schema coverage is near-perfect (97%) and FEL has full TS/Python parity, significant implementation gaps remain across the TypeScript engine, web component layer, Python backend, and E2E test suite.

**Current coverage**:

| Layer | Coverage |
|-------|----------|
| Spec <> Schema | 97% |
| TS Engine (core logic) | 85% |
| TS WebComp (components) | 67% (22 of 33) |
| TS WebComp (props) | ~22% (~12 of ~55) |
| Python Backend | 89% |
| E2E Tests | 53% |

The project is greenfield with zero users, zero production deployments, and zero backwards-compatibility constraints. This means breaking changes are free and bad code should be torn out rather than preserved.

## 2. Decision Drivers

- **Spec correctness first**: The engine's data structures use wrong field names (`target` vs `path`, `message` vs `constraintMessage`) and emit structurally incorrect responses. This must be fixed before building new features.
- **Core before presentation**: Missing engine features (bind properties, shape composition, variables) affect data correctness. Missing web component props are cosmetic by comparison.
- **Test alongside features**: E2E coverage at 53% is too low. Each feature phase must include its own E2E tests rather than deferring testing to a separate phase.
- **Extended features are lower priority (except assembly)**: `screener` and `migrations` remain lower-priority Extended features. `$ref`/`keyPrefix` is handled earlier as a core assembly prerequisite because it rewrites imported items, binds, shapes, and variables.

## 3. Considered Options

**Option A: Horizontal slices (one layer at a time)**
Fix all TS Engine gaps, then all WebComponent gaps, then all Python gaps, then all tests. Rejected: features can't be verified end-to-end until the test phase, and web component work depends on engine work.

**Option B: Vertical slices by feature area (chosen)**
Group work by functional area (binds, FEL, shapes, components, etc.), implementing engine + web component + tests together. Each phase is independently committable and verifiable.

**Option C: Priority-only ordering**
Address gaps strictly by impact score regardless of logical grouping. Rejected: creates excessive context-switching between unrelated subsystems.

## 4. Decision

Adopt **Option B**: 12 vertical phases ordered by dependency and impact, with each phase independently committable. Schema alignment is Phase 1 since every subsequent phase depends on correct naming.

Two policy decisions are fixed up front:

- **`$ref`/`keyPrefix` is a full assembly concern, not a runtime shortcut**: implement publish-time-style assembly semantics (recursive resolution, rewrite, collision/cycle checks). Runtime engine consumes assembled definitions.
- **Submit always runs submit-timed validation**: the submission path MUST evaluate continuous + submit shapes before deriving response `status`.

### 4.1 Implementation Status Update (2026-02-24)

All 12 phases in this remediation plan are now complete.

| Phase | Status |
|-------|--------|
| 1 | Complete |
| 2 | Complete |
| 3 | Complete |
| 4 | Complete |
| 5 | Complete |
| 6 | Complete |
| 7 | Complete |
| 8 | Complete |
| 9 | Complete |
| 10 | Complete |
| 11 | Complete |
| 12 | Complete |

Recent closure work included reactive reconciliation (`c452d94`), Popover and component-spec alignment (`ac86fcb`), component E2E gap expansion (`684b9aa`), and remote options binding (`79e07aa`).

## 5. Implementation Phases

### Phase 1: Schema Alignment and Naming Correctness

**Rationale**: The engine uses `bind.target` where the schema says `bind.path`, and `bind.message` where the schema says `bind.constraintMessage`. The response emits `validationReport` (an object) where the schema requires `validationResults` (a flat array). These are pervasive mismatches that every subsequent phase would have to work around.

**Changes**:

| Change | File(s) | Detail |
|--------|---------|--------|
| Rename `FormspecBind.target` to `path` | `packages/formspec-engine/src/index.ts`, all E2E fixtures | Interface + all references in `initializeBindConfigs`, `initItem`, `bindConfigs` keying |
| Rename `FormspecBind.message` to `constraintMessage` | Same | Interface + all bind processing that reads `message` |
| Response: `validationReport` (object) to `validationResults` (array) | `packages/formspec-engine/src/index.ts` `getResponse()` | Per `response.schema.json`, the response has `validationResults` as a flat array |
| Add `id`, `author`, `subject` to response | `packages/formspec-engine/src/index.ts` `getResponse()` | Accept as optional params: `getResponse(meta?: { id?, author?, subject? })` |
| Add `counts` + `timestamp` to `ValidationReport` | `packages/formspec-engine/src/index.ts` `getValidationReport()` | `counts: { error, warning, info }` aggregation + ISO 8601 `timestamp` |
| Update E2E assertions | `tests/e2e/playwright/schema-compliance.spec.ts` | Assert correct response shape, counts, timestamp |

**Estimated effort**: Small (2-3 hours)

---

### Phase 2: Definition Assembly (`$ref` / `keyPrefix`)

**Rationale**: `$ref`/`keyPrefix` was previously treated as a low-priority runtime convenience. Spec conformance requires full assembly semantics that rewrite imported structure and behavior artifacts consistently, with cycle/collision safety.

**Changes**:

| Change | File(s) | Detail |
|--------|---------|--------|
| Assembly module | New `packages/formspec-engine/src/assembler.ts` | Resolve Group `$ref` inclusions recursively into a self-contained definition graph |
| Fragment + local resolver | `assembler.ts` | Support `url\|version#itemKey` fragment selection and local/in-memory registry resolution first (remote fetch deferred) |
| `keyPrefix` rewrite | `assembler.ts` | Prefix imported item keys recursively and rewrite all affected references |
| Behavior artifact import + rewrite | `assembler.ts` | Import referenced `binds`, `shapes`, `variables`; rewrite bind paths, shape targets, variable scopes/refs to new host paths |
| Safety checks | `assembler.ts` | Detect key collisions after rewrite; detect circular `$ref` chains and fail assembly |
| Metadata | `assembler.ts` | Emit `assembledFrom` provenance metadata on assembled output |
| Engine integration boundary | `packages/formspec-engine/src/index.ts` | Constructor accepts assembled definitions; runtime path does not perform ad-hoc `$ref` expansion |
| Tests | New `tests/e2e/playwright/assembly.spec.ts` + TS unit tests | Rewrite correctness, collisions, cycles, fragment targeting |

**Estimated effort**: Medium-Large (8-12 hours)

---

### Phase 3: Core Bind Features

**Rationale**: These are spec-required bind properties that the engine silently ignores. They affect data correctness (whitespace, precision, nonRelevantBehavior) and FEL evaluation correctness (excludedValue).

**Changes**:

| Change | Insertion Point | Detail |
|--------|----------------|--------|
| Add missing fields to `FormspecBind` interface | Interface declaration | `whitespace`, `excludedValue`, `nonRelevantBehavior`, `disabledDisplay`, `default`, `precision` |
| `whitespace` transform | `setValue()`, before writing to signal | `trim`: `.trim()`; `normalize`: collapse whitespace + trim; `remove`: strip all whitespace; `preserve`: no-op |
| `precision` enforcement | `setValue()`, after numeric coercion | `Math.round(value * 10^precision) / 10^precision` when `item.precision` is set |
| `nonRelevantBehavior` | `getResponse()` loop | Currently only implements "remove" (skip). Add "empty" (include key with `null`) and "keep" (include with current value). Respect definition-level default and per-bind override. |
| `excludedValue` | `compileFEL`'s `getSignalValue` context | When `excludedValue === "null"` and field is non-relevant, return `null` instead of actual value |
| `disabledDisplay` | New getter `getDisabledDisplay(path)` | Store per-field config from bind; expose for web component to distinguish "hidden" vs "protected" rendering |
| `optionSets` resolution | New `resolveOptionSets()` in constructor | Resolve `item.optionSet` references into `item.options` using `definition.optionSets` map |
| `default` bind | `initItem()`, effect on relevant signal | Watch relevance transitions; apply `bind.default` value when field transitions from non-relevant to relevant |
| E2E tests | New `tests/e2e/playwright/bind-features.spec.ts` | Cover whitespace, precision, nonRelevantBehavior modes, default on re-entry, optionSet resolution |

**Estimated effort**: Medium (6-8 hours)

---

### Phase 4: FEL Completeness and Variables

**Rationale**: Missing FEL functions (`valid()`, `countWhere()`, `@count`) and the `variables` system prevent forms from using spec-defined patterns. The `variables` feature is needed for computed form-level values referenced as `@variableName`.

**Changes**:

| Change | File | Detail |
|--------|------|--------|
| Add `valid($path)` MIP function | `packages/formspec-engine/src/fel/interpreter.ts` | Query field validation state for referenced path; return `true` when no error-severity results exist |
| Add `@count` context ref | `interpreter.ts` `contextRef` method | Return total instances in current repeat group (walk backwards from current path to find enclosing repeat) |
| Add `countWhere(array, predicate)` | `interpreter.ts` `felStdLib` | Implement two-argument form where predicate is evaluated per-element with `$` rebound to current element |
| Implement scoped `variables` system | `packages/formspec-engine/src/index.ts` | New scope-aware variable signal store keyed by `(scopePath, name)`; initialize after signal graph; compute in dependency order with cycle detection |
| Extend `contextRef` for variables | `interpreter.ts` `contextRef` | After `@index`/`@current`/`@count`, resolve nearest visible variable by lexical scope (ancestor search; `#` global fallback) |
| Python parity verification | `src/formspec/fel/evaluator.py` | Verify existing Python support for `valid()`, `countWhere()`, `@count`; only patch if delta discovered during parity tests |
| E2E tests | `tests/e2e/playwright/fel-functions.spec.ts` | New test cases for `valid()`, `@count`, `countWhere()`, variables |
| Python tests | `tests/test_fel_evaluator.py` | Matching Python test cases |

**Estimated effort**: Medium (8-10 hours)

---

### Phase 5: Shape Composition and Timing

**Rationale**: Shape composition (`and`/`or`/`not`/`xone`) is declared in the `FormspecShape` interface but `initShape` never processes these fields — they're silently ignored. Shape timing only works as `continuous`; `submit` and `demand` modes are spec-required.

**Changes**:

| Change | Insertion Point | Detail |
|--------|----------------|--------|
| Composition operators | `initShape()` | After evaluating `constraint`, evaluate `and` (all must pass), `or` (any passes), `not` (must fail), `xone` (exactly one passes). Each is a FEL expression or array of FEL expressions. |
| Shape `context` | `initShape()`, on failure | Evaluate the `context` map (name → FEL expression) and include results in the emitted `ValidationResult` |
| Shape `timing` | `initShape()` + `getValidationReport()` | `continuous` shapes: reactive (current behavior). `submit` shapes: evaluated by `getValidationReport({mode: "submit"})`. `demand` shapes: evaluated via explicit `evaluateShape(shapeId)` API. |
| Submission enforcement | `getResponse()` + web submit path | `getResponse()` MUST compute status from submit-mode validation (`continuous` + `submit`) so submit-only checks cannot be bypassed |
| Draft/non-blocking path | New `getDraftResponse()` (or `getResponse({mode: "continuous"})`) | Explicit API for save-draft workflows that should not run submit-only blocking validation |
| `mode` param on `getValidationReport()` | `getValidationReport()` | `"continuous"` (default) returns only continuous shapes. `"submit"` includes continuous + submit shapes. `"demand"` is per-shape via `evaluateShape()` |
| E2E tests | New `tests/e2e/playwright/shape-validation.spec.ts` | Test composition, timing modes, submit enforcement, and explicit draft flow behavior |

**Estimated effort**: Medium (4-5 hours)

---

### Phase 6: Instances and Pre-population

**Rationale**: Secondary data sources (`instances`) and `prePopulate` are needed for forms that pull default values from external data. The `@instance()` FEL function depends on this infrastructure.

**Changes**:

| Change | File | Detail |
|--------|------|--------|
| `instances` initialization | `packages/formspec-engine/src/index.ts` | New `instanceData: Record<string, any>` map. New `initializeInstances()` method storing inline `data` from `definition.instances`. |
| `@instance('name')` FEL function | `interpreter.ts` | Resolve against `engine.instanceData` map (parser already accepts `@Identifier("string")`; implement evaluation semantics and null/error behavior) |
| `prePopulate` on fields | `initItem()` | Look up value from named instance at specified path; set as initial signal value; when `editable === false`, compose lock state with existing readonly bind semantics (do not clobber bind-driven readonly logic) |
| E2E tests | New `tests/e2e/playwright/instances.spec.ts` | Inline instances, `@instance()` in FEL, prePopulate with editable flag |

**Estimated effort**: Medium (5-6 hours)

---

### Phase 7: Fix Existing WebComponent Issues and Add Props

**Rationale**: RadioGroup is fundamentally broken (renders as a text input). Wizard has no step navigation (only renders first child). ~43 component-specific props are silently ignored.

**Changes**:

| Change | File | Detail |
|--------|------|--------|
| **Fix RadioGroup** | `packages/formspec-webcomponent/src/index.ts` `renderInputComponent()` | Add explicit branch for `componentType === 'RadioGroup'` that creates `<input type="radio">` elements with `<label>` wrappers, grouped by `name` attribute |
| **Rewrite Wizard** | `packages/formspec-webcomponent/src/components/interactive.ts` | Add prev/next navigation buttons, current step tracking, progress indicator (`showProgress`), optional skip (`allowSkip`). Currently only renders `children[0]`. |
| **Stack props** | `components/layout.ts` | `align` → `alignItems`, `wrap` → `flexWrap: 'wrap'` |
| **Grid props** | `components/layout.ts` | `rowGap` → `rowGap` CSS property |
| **Page props** | `components/layout.ts` | `description` → `<p>` after title |
| **NumberInput props** | `index.ts` `renderInputComponent()` | `step`/`min`/`max` → HTML attributes on `<input type="number">`; `showStepper` (native stepper is default) |
| **TextInput props** | `renderInputComponent()` | `prefix`/`suffix` → wrap input in flex container with span elements |
| **Select props** | `renderInputComponent()` | `placeholder` → disabled default `<option>`; `clearable` → add reset option |
| **DatePicker props** | `renderInputComponent()` | `minDate`/`maxDate` → `min`/`max` HTML attributes |
| **CheckboxGroup props** | `renderInputComponent()` | `columns` → CSS grid layout; `selectAll` → add "Select All" toggle |
| **Toggle props** | `renderInputComponent()` | `onLabel`/`offLabel` → label text beside toggle |
| **Card props** | `components/display.ts` | `subtitle` → `<p>` after title; `elevation` → box-shadow scaling |
| **Alert props** | `components/display.ts` | `dismissible` → add close button that removes element |
| **Tabs props** | `components/interactive.ts` | `position` → tab bar placement (top/bottom/left/right); `defaultTab` → initial active tab index |
| **DataTable props** | `components/special.ts` | `showRowNumbers` → row index column; `allowAdd`/`allowRemove` → row manipulation controls |
| E2E tests | Update `component-layer.spec.ts`, consider un-skipping `demo.spec.ts` | RadioGroup radio inputs, Wizard nav, key props |

**Estimated effort**: Large (8-10 hours)

---

### Phase 8: New Components (12 Missing)

**Rationale**: 12 of 33 spec components are unregistered. 3 are Core (Divider, Collapsible, FileUpload) and must be implemented. 9 are Progressive with defined fallback behavior.

**Registration pattern** (from `packages/formspec-webcomponent/src/registry.ts`): Each component is a `{ type: string, render: (comp, parent, ctx) => void }` object registered via `globalRegistry.register(plugin)`.

**Core components** (must-have):

| Component | Implementation | Key Props |
|-----------|---------------|-----------|
| **Divider** | `<hr>` with optional label overlay | `label` |
| **Collapsible** | `<details>`/`<summary>` native elements | `title` (required), `defaultOpen` |
| **FileUpload** | `<input type="file">` with drag-drop zone | `accept`, `maxSize`, `multiple`, `dragDrop` |

**Progressive components** (graceful degradation acceptable):

| Component | Implementation | Key Props | Core Fallback |
|-----------|---------------|-----------|---------------|
| **Columns** | CSS multi-column or grid | `columnCount` | Grid |
| **Accordion** | Multiple `<details>` with exclusive-open option | `defaultOpen` | Stack + Collapsible |
| **Panel** | Bordered container with header | `title`, `width` | Card |
| **Modal** | `<dialog>` element or overlay | `trigger`, `triggerLabel`, `closable`, `size` | Collapsible |
| **MoneyInput** | Currency selector + amount input pair | `showCurrency` | NumberInput |
| **Slider** | `<input type="range">` | `showValue`, `showTicks`, `min`/`max`/`step` | NumberInput |
| **Rating** | Clickable star/icon row | `icon`, `allowHalf`, `max` | NumberInput |
| **Signature** | `<canvas>` with drawing handlers | `strokeColor`, `height` | FileUpload |
| **ProgressBar** | `<progress>` or styled div | `showPercent`, `value`, `max` | Text |

**Files**: Add to appropriate category files in `packages/formspec-webcomponent/src/components/`, register in `components/index.ts`.

**E2E tests**: New `tests/e2e/playwright/progressive-components.spec.ts`

**Estimated effort**: Large (10-12 hours)

---

### Phase 9: Accessibility, Responsive Overrides, Custom Components

**Rationale**: Three spec-required cross-cutting capabilities with zero implementation. Accessibility is particularly important for forms.

**Changes**:

| Capability | Implementation | Detail |
|-----------|---------------|--------|
| **Accessibility block** | New `applyAccessibility(el, comp)` helper on `RenderContext` | Set `role`, `aria-description`, `aria-live` from `comp.accessibility` block. Add `aria-required`, `aria-invalid`, `aria-readonly` to all input components. Add `aria-describedby` linking inputs to hint/error elements by ID. |
| **Responsive overrides** | `matchMedia` listeners in `FormspecRender` | Read `breakpoints` from component document. Set up listeners. When rendering, merge `comp.responsive[activeBreakpoint]` props over base props using mobile-first cascade. |
| **Custom components** | Extend `renderActualComponent()` | When component type not found in global registry, look up in `componentDocument.components`. Expand the custom component's `tree` template with `{param}` interpolation. Detect and reject recursive cycles. |

**Files**: `packages/formspec-webcomponent/src/index.ts`, `types.ts` (RenderContext extension)

**E2E tests**: New `accessibility.spec.ts` (ARIA assertions), `responsive.spec.ts` (viewport resize), custom component rendering tests.

**Estimated effort**: Medium-Large (6-8 hours)

---

### Phase 10: Python Mapping Engine

**Rationale**: The three format adapters (JSON/XML/CSV) handle serialization only. The spec defines a mapping DSL with `rules[]`, transforms, value maps, and conditions that requires an execution engine.

**Architecture**:

```
MappingDocument → MappingEngine.forward(response_data) → transformed_dict → Adapter.serialize() → bytes
bytes → Adapter.deserialize() → dict → MappingEngine.reverse() → response_data
```

**Changes**:

| Change | File | Detail |
|--------|------|--------|
| `MappingEngine` class | New `src/formspec/mapping/engine.py` | `forward(source_data) -> dict`, `reverse(target_data) -> dict` |
| Transform implementations | New `src/formspec/mapping/transforms.py` | 10 types: `preserve`, `drop`, `expression` (FEL via `src/formspec/fel/evaluator.py`), `coerce`, `valueMap`, `flatten`, `nest`, `constant`, `concat`, `split` |
| Path resolution | In engine.py | Dot-notation + bracketed paths, wildcard expansion for repeat groups |
| Condition guards | In engine.py | FEL evaluation via Python evaluator to conditionally skip rules |
| Priority ordering | In engine.py | Sort rules by `priority` (forward) or `reversePriority` (reverse) |
| Array descriptors | In engine.py | `each` (per-element), `whole` (entire array), `indexed` (by position) |
| Custom adapter registration | `src/formspec/adapters/__init__.py` | `register_adapter(prefix, adapter_class)` for `x-` prefixed custom adapters |
| Tests | New `tests/test_mapping_engine.py` | Each transform type, conditions, bidirectional, priority ordering, adapter integration |

**Estimated effort**: Large (10-14 hours)

---

### Phase 11: Extended Engine Features (Lower Priority)

**Rationale**: These are Extended processor features or metadata-only concerns. Important for full spec completeness but lower impact than core features.

**Changes**:

| Feature | Implementation | Effort |
|---------|---------------|--------|
| `formPresentation` | Expose `definition.formPresentation` as public getter on FormEngine | Trivial |
| `screener` routing | New `evaluateScreener()` method — iterate `screener.routes`, evaluate FEL conditions, return first matching `{ target, label }` | Small |
| `labels` (i18n) | New `setLabelContext(ctx)` + `getLabel(item)` — resolve from `item.labels[context]` with fallback to `item.label` | Small |
| `migrations` | New `migrateResponse(response, fromVersion)` — apply migration descriptors from `definition.migrations` | Medium |
| E2E tests | `tests/e2e/playwright/extended-features.spec.ts` | Screener routing, label switching |

**Estimated effort**: Medium-Large total (6-9 hours)

---

### Phase 12: Python Changelog and Registry

**Rationale**: Spec-defined tooling features with no implementation. These are development-time tools (not runtime), so lowest priority.

**Changes**:

| Feature | File | Detail |
|---------|------|--------|
| Changelog generation | New `src/formspec/changelog.py` | Diff two definition versions; classify changes by `target` (8 categories: item, bind, shape, option, variable, instance, screener, migration); determine `impact` (breaking / non-breaking / cosmetic); produce `changes[]` per `changelog.schema.json` |
| Impact classification | In changelog.py | Rules: adding optional = cosmetic, removing required = breaking, type change = breaking, adding with default = non-breaking, etc. |
| Extension registry resolution | New `src/formspec/registry.py` | Parse registry documents; match `(name, version)` constraints; validate lifecycle state transitions (experimental → stable → deprecated → retired) |
| Well-known URL discovery | In registry.py | `/.well-known/formspec-extensions` resolution |
| Tests | New `tests/test_changelog.py`, `tests/test_registry.py` | Diffing, classification, registry resolution, lifecycle validation |

**Estimated effort**: Medium (6-8 hours)

---

## 6. Consequences

### Positive
- Engine data structures will match the canonical JSON schemas exactly
- All 33 spec components will be registered in the web component layer
- E2E coverage will increase from 53% to ~75%
- Response output will be schema-compliant (currently structurally wrong)
- FEL parity between TS and Python will be maintained throughout
- Each phase is independently committable with its own tests

### Negative
- Phase 1 naming changes are pervasive — every fixture and test referencing `bind.target` must be updated
- Full `$ref` assembly (Phase 2) is substantially larger than the prior runtime-subset approach
- The Wizard rewrite (Phase 7) changes existing behavior (currently renders first child only)
- Adding ~12 new component files increases the web component bundle size
- Python mapping engine (Phase 10) is a substantial new subsystem with its own test surface

### Risks
- `$ref` assembly rewrite logic (Phase 2) can introduce subtle path rewrite bugs across imported binds/shapes/variables
- Submit-vs-draft API split (Phase 5) can regress existing save flows if callers are not migrated explicitly
- Custom component `{param}` interpolation (Phase 9) needs careful design to avoid injection issues
- Responsive overrides (Phase 9) require careful interaction with the reactive rendering system

## 7. Phase Dependencies

```
Phase 1 (Schema Alignment)
  └── Phase 2 (Definition Assembly)
        ├── Phase 3 (Bind Features)
        ├── Phase 4 (FEL + Variables)
        │     └── Phase 6 (Instances)
        ├── Phase 5 (Shapes + Submit/Draft Semantics)
        └── Phase 7 (Fix Components)
              ├── Phase 8 (New Components)
              └── Phase 9 (A11y/Responsive/Custom)

Phase 10 (Python Mapping) — independent, can parallel with 3-9
Phase 11 (Extended Engine) — depends on Phases 3-6
Phase 12 (Python Tooling) — depends on Phase 10
```

Phases 3, 4, 5 can proceed in parallel after Phase 2. Phases 7-9 are sequential. Phase 10 is independent of the TS work and can proceed in parallel.

## 8. Verification

After each phase:
```bash
npm run build                    # TypeScript compilation
npm test                         # Playwright E2E (auto-starts Vite)
python3 -m pytest tests/ -v      # Python conformance suite
```

After all phases, re-run the feature completeness audit to verify coverage targets are met.
