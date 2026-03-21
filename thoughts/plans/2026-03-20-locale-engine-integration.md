# Plan: FieldViewModel + Locale Integration

**Date:** 2026-03-20 (revised 2026-03-21)
**Status:** Proposed
**Branch:** `claude/add-i18n-support-tpQ9A`
**Prerequisites:** Locale Specification (specs/locale/locale-spec.md), JSON Schema (schemas/locale.schema.json), ADR 0048
**Design doc:** thoughts/specs/2026-03-21-presentation-locale-and-fieldvm-design.md

---

## Context

The Locale Specification, schema, and ADR are complete on branch `claude/add-i18n-support-tpQ9A`. This plan covers how to integrate locale resolution into the implementation packages so that localized strings reach the DOM.

The original plan (v1) proposed adding `resolveString()` calls to every behavior hook — touching ~18 files across 3 packages. This revision takes a different approach: introduce a **FieldViewModel** abstraction that collapses all per-field reactive state into a single object, making locale integration a natural part of the rendering model rather than a bolt-on.

## Architecture Decision: FieldViewModel

### Why not resolveString() in every behavior?

The engine currently exposes ~12 separate signal maps (`signals`, `requiredSignals`, `relevantSignals`, `readonlySignals`, `errorSignals`, `validationResults`, `optionSignals`, etc.). Every behavior hook manually wires 5-8 of these. Adding locale means adding 3 more signal reads per behavior — making the scatter worse.

Worse, locale strings with FEL interpolation (e.g., `"Total: {{$itemCount}}"`) must update reactively when field values change. Labels are currently captured once during behavior construction and never re-read. Making them reactive requires either:
- Per-string signals (explosion of signals), or
- Computed signals in an organized abstraction

The FieldViewModel is that abstraction. It unifies all per-field state into one reactive object, making locale one of several inputs rather than a cross-cutting concern threaded through 15 files.

### What is a FieldViewModel?

```ts
interface FieldViewModel {
  // ── Identity ──
  readonly templatePath: string;    // for locale key lookup (indices stripped)
  readonly instancePath: string;    // for FEL interpolation context, value access
  readonly id: string;
  readonly itemKey: string;
  readonly dataType: string;

  // ── Presentation (locale-resolved, FEL-interpolated, reactive) ──
  readonly label: ReadonlySignal<string>;
  readonly hint: ReadonlySignal<string | null>;
  readonly description: ReadonlySignal<string | null>;

  // ── State ──
  readonly value: ReadonlySignal<any>;
  readonly required: ReadonlySignal<boolean>;
  readonly visible: ReadonlySignal<boolean>;
  readonly readonly: ReadonlySignal<boolean>;
  readonly disabledDisplay: 'hidden' | 'protected';  // static, from bind config

  // ── Validation ──
  readonly errors: ReadonlySignal<ValidationResult[]>;
  readonly firstError: ReadonlySignal<string | null>;

  // ── Options (choice fields) ──
  readonly options: ReadonlySignal<OptionEntry[]>;
  readonly optionsState: ReadonlySignal<RemoteOptionsState>;

  // ── Write ──
  setValue(value: any): void;
}
```

Created during `initItem()` in FormEngine. Each VM wraps the existing signal maps — it doesn't replace them. `getResponse()`, `getValidationReport()`, and FEL evaluation still read the raw signal maps internally.

### FormViewModel (form-level counterpart)

```ts
interface FormViewModel {
  readonly title: ReadonlySignal<string>;
  readonly description: ReadonlySignal<string>;
  pageTitle(pageId: string): ReadonlySignal<string>;
  pageDescription(pageId: string): ReadonlySignal<string>;
  readonly isValid: ReadonlySignal<boolean>;
  readonly validationSummary: ReadonlySignal<{ errors: number; warnings: number; infos: number }>;
}
```

Handles `$form.title`, `$form.description`, `$page.<id>.title`, `$page.<id>.description`, and form-level validation state.

## Locale Resolution

### LocaleStore

**New file: `packages/formspec-engine/src/locale.ts`**

```ts
class LocaleStore {
  readonly activeLocale: Signal<string>;           // "" = no locale
  readonly version: Signal<number>;                // bumps on load/setLocale
  private documents: Map<string, LocaleDocument>;  // keyed by BCP 47 code

  loadLocale(doc: LocaleDocument): void;
  setLocale(code: string): void;
  lookupKey(key: string): string | null;           // walks cascade, returns raw string
}
```

- `lookupKey()` walks the cascade: regional → explicit fallback → implicit language → returns null.
- Circular fallback detection via visited set per lookup.
- BCP 47 case-insensitive comparison, normalized to lowercase-language + titlecase-region.
- `loadLocale()` for the currently-active locale bumps `version` to trigger re-resolution.

### String Resolution Cascade

#### Label with context (6-step)

When a label context is active (e.g., "short"):

1. `fr-CA` strings for `key.label@short`
2. `fr` strings for `key.label@short` (via fallback)
3. `fr-CA` strings for `key.label`
4. `fr` strings for `key.label` (via fallback)
5. Definition `labels["short"]`
6. Definition `label`

Each "locale lookup" step walks the full locale cascade internally.

#### Hint, description (2-step)

1. Locale lookup for `key.hint` / `key.description`
2. Inline `item.hint` / `item.description`

#### Option labels

Key format: `templatePath.options.<escapedValue>.label` (dots and backslashes in values escaped per §3.1.3).

#### Validation messages (4-step)

1. Per-kind key: `templatePath.errors.<constraintKind>` (e.g., `email.errors.REQUIRED`)
2. Per-bind key: `templatePath.requiredMessage` or `templatePath.constraintMessage`
3. Inline bind `constraintMessage`
4. Processor default `ValidationResult.message`

Shape messages: `$shape.<id>.message` → inline shape `message`.

ValidationResult objects are NOT mutated — the VM produces new objects with localized messages (presentation overlay per §8.2).

#### Presentation-tier strings

- `$form.title`, `$form.description` — on FormViewModel
- `$page.<pageId>.title`, `$page.<pageId>.description` — on FormViewModel
- `$node:<nodeId>.<property>` — resolved by webcomponent during component rendering

FEL interpolation context for `$page.` and `$node:` keys is global (all field values, no specific item scope).

### FEL Interpolation in Strings

**New function: `interpolateMessage()`** — a runtime string interpolator for `{{expr}}` sequences. The Rust WASM layer has `rewrite_message_template` (compile-time path rewriter in `fel_rewrite_exact.rs`), but that's for static path rewriting, not runtime evaluation. `interpolateMessage()` is a **new TS function** that:

1. Handles `{{{{` escape → literal `{{` (replace before regex, §3.3.1 rule 1)
2. Matches `{{expr}}` via regex, calls `compileFEL(expr, contextPath)`, evaluates
3. Coerces results: `null`/`undefined` → `""`, booleans → `"true"`/`"false"`, numbers → default string (§3.3.1 rule 3)
4. **Error recovery (MUST, §3.3.1 rule 2):** failed parse/eval produces literal `{{original expression}}` + warning, not a crash
5. Non-recursive: replacement text is not re-scanned for `{{` (§3.3.1 rule 5)

### FEL Functions

| Function | Pattern | Reactive? |
|----------|---------|-----------|
| `locale()` | `localeProvider` callback (like `now()`) reads `activeLocale.value` | Yes — via signal |
| `plural(count, singular, plural)` | Pure function, null-propagating | No |
| `formatNumber(value, locale?)` | Delegates to `Intl.NumberFormat` | Only if `locale?` omitted |
| `formatDate(value, pattern?, locale?)` | Delegates to `Intl.DateTimeFormat` | Only if `locale?` omitted |

`locale()` and `formatNumber/Date` (without explicit locale) are non-deterministic — dependency visitor flags them like `now()`.

## Integration by Package

### 1. formspec-engine — LocaleStore + FieldViewModel + FormViewModel

**New files:**

| File | Contents |
|------|----------|
| `src/locale.ts` | `LocaleStore` class |
| `src/field-view-model.ts` | `FieldViewModel` interface + factory |
| `src/form-view-model.ts` | `FormViewModel` interface + factory |

**Changes to FormEngine (`src/index.ts`):**

- Add `localeStore: LocaleStore` (created in constructor)
- Add `fieldViewModels: Record<string, FieldViewModel>` map
- Add `formViewModel: FormViewModel` instance
- `initItem()` creates a FieldViewModel per field alongside existing signals
- VM wraps existing signals: `vm.value` = `this.signals[path]`, `vm.required` = `this.requiredSignals[path]`, etc.
- VM `label`/`hint`/`description` are computed signals that call `resolveString()` → `localeStore.lookupKey()` → `interpolateMessage()`
- VM `options` computed maps raw options through `resolveOptionLabel()`
- VM `errors` computed maps raw `ValidationResult[]` through `resolveValidationMessage()`
- Public methods: `loadLocale()`, `setLocale()`, `getActiveLocale()`, `getFieldVM(path)`, `getFormVM()`
- `labelContext` becomes a `Signal<string | null>` (currently a plain string) so VM label signals react to context changes
- `setRuntimeContext({ locale })` delegates to `setLocale()` if locale store exists
- `getLabel()`/`setLabelContext()` remain for backwards compat but are internally wired through the VM/signal

**Changes to IFormEngine (`src/interfaces.ts`):**

```ts
// New methods
loadLocale(document: LocaleDocument): void;
setLocale(code: string): void;
getActiveLocale(): string;
getFieldVM(path: string): FieldViewModel | undefined;
getFormVM(): FormViewModel;
```

Add `'locale'` to `DocumentType` enum (currently lists definition, response, validationReport, mapping, theme, component, registry). Required for schema validation to recognize locale documents. Also update the Rust `schema_validator.rs` accordingly.

**New `interpolateMessage()` function** (see "FEL Interpolation in Strings" section above).

**`loadLocale()` version compatibility:** On load, check `doc.targetDefinition.url` against `this.definition.url`. If `doc.targetDefinition.compatibleVersions` is present and the definition version falls outside the range, emit a warning (§2.2 SHOULD). Do not reject — fall back to inline strings for that locale.

**Register FEL functions** in constructor after FEL runtime is ready:

- `locale()` with `localeProvider` closure over `localeStore.activeLocale`
- `plural()`, `formatNumber()`, `formatDate()`

### 2. formspec-webcomponent — Simplified behaviors via VM

**Changes to `<formspec-render>` (`src/element.ts`):**

```ts
set localeDocuments(docs: LocaleDocument | LocaleDocument[]) {
  const arr = Array.isArray(docs) ? docs : [docs];
  for (const doc of arr) this.engine?.loadLocale(doc);
}

set locale(code: string) {
  this.engine?.setLocale(code);
  this._locale = code;
}
```

Property order: `registryDocuments` → `definition` → `localeDocuments` → `locale`.

No `scheduleRender()` needed — locale change propagates through computed signals.

**Changes to BehaviorContext (`src/behaviors/types.ts`):**

```ts
interface BehaviorContext {
  // ... existing ...
  getFieldVM(comp: any): FieldViewModel;  // NEW — resolves path, returns VM
}
```

**Behavior hook simplification (all 13 field behaviors):**

Before (~90 lines each):
```ts
export function useTextInput(ctx: BehaviorContext, comp: any): TextInputBehavior {
  const fieldPath = resolveFieldPath(comp.bind, ctx.prefix);
  const id = comp.id || toFieldId(fieldPath);
  const item = ctx.findItemByKey(comp.bind);
  const labelText = comp.labelOverride || item?.label || item?.key || comp.bind;
  // ... 20 more lines of extraction ...
  return {
    fieldPath, id, label: labelText,
    hint: comp.hintOverride || item?.hint || null,
    description: item?.description || null,
    // ... bind() with 5-8 manual signal subscriptions ...
  };
}
```

After (~40 lines each):
```ts
export function useTextInput(ctx: BehaviorContext, comp: any): TextInputBehavior {
  const vm = ctx.getFieldVM(comp);
  const presentation = ctx.resolvePresentation(comp, vm);
  return {
    vm,
    presentation,
    placeholder: comp.placeholder,
    inputMode: comp.inputMode,
    // ... only component-specific props ...
    bind(refs: FieldRefs): () => void {
      const disposers = bindSharedFieldEffects(ctx, vm, refs);
      // ... only component-specific value sync ...
      return () => disposers.forEach(d => d());
    }
  };
}
```

**`bindSharedFieldEffects` refactor (`src/behaviors/shared.ts`):**

Takes `vm: FieldViewModel` instead of `(ctx, fieldPath, labelText, refs)`:

```ts
export function bindSharedFieldEffects(
  ctx: BehaviorContext,
  vm: FieldViewModel,
  refs: FieldRefs
): Array<() => void> {
  const disposers: Array<() => void> = [];

  // Required indicator — now reactive to locale changes
  disposers.push(effect(() => {
    const isRequired = vm.required.value;
    refs.label.textContent = vm.label.value;  // reactive!
    if (isRequired) {
      const indicator = document.createElement('span');
      indicator.className = 'formspec-required';
      indicator.textContent = ' *';
      refs.label.appendChild(indicator);
    }
  }));

  // Validation — uses localized messages
  disposers.push(effect(() => {
    ctx.touchedVersion.value;
    const error = vm.firstError.value;
    // ... same touched logic, but error is already localized ...
  }));

  // Readonly, relevance — same pattern but reads vm.readonly, vm.visible
  // ...
  return disposers;
}
```

**Adapter adjustments (`src/adapters/default/*.ts`):**

Behavior contract shape changes: adapters read `behavior.vm.label.value` instead of `behavior.label`. Since `vm.label` is a signal, adapters that need reactive labels read it inside effects (which `bindSharedFieldEffects` already handles).

**Component-tier locale (`$node:` keys):**

For non-field components (Heading, Text, Alert, Card, etc.), the component render function resolves locale strings using the component's `id`:

```ts
// In heading component render
const nodeId = comp.id;
const text = nodeId
  ? engine.localeStore.lookupKey(`$node:${nodeId}.text`) ?? comp.text
  : comp.text;
```

This is localized on render and re-renders when locale changes (via `structureVersion` or a locale-aware render trigger).

### 3. Schema changes

**`locale.schema.json` — update `propertyNames` pattern:**

From: `^(\$form\.|\$shape\.|[a-zA-Z])[a-zA-Z0-9_@.\\]*$`
To: `^(\$form\.|\$shape\.|\$page\.|\$node:[a-zA-Z][a-zA-Z0-9_\-]*\.|[a-zA-Z])[a-zA-Z0-9_@.\\]*$`

Note: No `[]` in the character class — locale string keys use template paths (indices stripped), not instance paths.

**`component.schema.json` — add `id` to `ComponentBase`:**

```json
{
  "id": {
    "type": "string",
    "pattern": "^[a-zA-Z][a-zA-Z0-9_\\-]*$",
    "description": "Optional unique identifier for locale addressing ($node:<id>.prop), test selectors, and accessibility anchoring. MUST be unique across the component tree."
  }
}
```

### 4. Spec prose changes

**Locale spec §1.2:** Replace presentation-tier exclusion with: "Locale Documents address all human-readable strings across all tiers. They MUST NOT alter non-string properties."

**Locale spec §3.1:** Add sections 3.1.7 (Page Layout Strings: `$page.<id>.title/description`) and 3.1.8 (Component Node Strings: `$node:<id>.<prop>`).

**Locale spec §7.2:** Add orphaned `$page`/`$node:` key validation checks (warning severity).

**Component spec:** Document optional `id` property on ComponentBase with uniqueness constraint.

### 5. formspec-core — Locale state & authoring handlers

**Changes to `ProjectState` (`src/types.ts`):**

```ts
interface ProjectState {
  // ... existing fields ...
  locales: Record<string, LocaleState>;   // keyed by locale code
  selectedLocaleId?: string;              // which locale is active in the editor
}

interface LocaleState {
  locale: string;        // BCP 47 code
  version: string;
  fallback?: string;
  targetDefinition: { url: string; compatibleVersions?: string };
  strings: Record<string, string>;
  // metadata: name, title, description, url
  name?: string;
  title?: string;
  description?: string;
  url?: string;
}
```

**New handler module: `src/handlers/locale.ts`**

Follows the mapping handler pattern (multi-instance collection with selection state):

```ts
function getLocale(state: ProjectState, localeId?: string): LocaleState {
  const id = localeId || state.selectedLocaleId;
  if (!id || !state.locales[id]) throw new Error(`Locale not found: ${id}`);
  return state.locales[id];
}
```

Handlers (null = delete, one-command-per-mutation):

| Command | Payload | Effect |
|---------|---------|--------|
| `locale.load` | `{ document: LocaleDocument }` | Parse + store in `state.locales[doc.locale]` |
| `locale.remove` | `{ localeId: string }` | Delete from `state.locales` |
| `locale.select` | `{ localeId: string }` | Set `state.selectedLocaleId` |
| `locale.setString` | `{ localeId?, key, value }` | Set/delete a single string key |
| `locale.setStrings` | `{ localeId?, strings: Record<string, string> }` | Batch set string keys |
| `locale.removeString` | `{ localeId?, key }` | Delete a string key |
| `locale.setMetadata` | `{ localeId?, property, value }` | Set name/title/description/version |
| `locale.setFallback` | `{ localeId?, fallback: string \| null }` | Set/clear fallback locale |

All return `{ rebuildComponentTree: false }`.

**Handler registry (`src/handlers/index.ts`):**

```ts
import { localeHandlers } from './locale.js';
// Add to builtinHandlers spread
```

**State normalizer (`src/state-normalizer.ts`):**

Sync `targetDefinition.url` on all locales when definition URL changes:

```ts
for (const locale of Object.values(state.locales ?? {})) {
  if (locale.targetDefinition) {
    locale.targetDefinition.url = url;
  }
}
```

**Import handler (`src/handlers/project.ts`):**

Handle locale documents in the import bundle:

```ts
if (p.locales) {
  state.locales = p.locales;
} else if (p.locale) {
  // Single locale import
  const doc = p.locale;
  state.locales[doc.locale] = splitLocaleState(doc);
}
```

Sync `targetDefinition.url` on imported locales.

**IProjectCore (`src/project-core.ts`):**

Add query methods:

```ts
// State getter
readonly locales: Readonly<Record<string, LocaleState>>;

// Query methods
localeAt(code: string): LocaleState | undefined;
activeLocaleCode(): string | undefined;
```

**State initializer (`src/raw-project.ts`):**

`createDefaultState()` must initialize `locales: {}` and `selectedLocaleId: undefined`. Without this, existing callers of `createRawProject()` get a state without `locales`, crashing locale handlers.

**Project bundle export:**

Update `ProjectBundle` type and `export()` method to include locale documents. When exporting, reconstitute `LocaleState` objects back to `LocaleDocument` format (add `$formspecLocale: "1.0"` envelope). Import path already handled above.

## Key Files to Modify

| Package | File | Change |
|---------|------|--------|
| formspec-engine | `src/locale.ts` | **NEW** — LocaleStore class |
| formspec-engine | `src/field-view-model.ts` | **NEW** — FieldViewModel interface + factory |
| formspec-engine | `src/form-view-model.ts` | **NEW** — FormViewModel interface + factory |
| formspec-engine | `src/index.ts` | Create VMs in initItem(), locale methods, fix interpolateMessage() |
| formspec-engine | `src/interfaces.ts` | Add VM + locale methods to IFormEngine, add `'locale'` to DocumentType |
| formspec-webcomponent | `src/element.ts` | Add `localeDocuments` + `locale` setters |
| formspec-webcomponent | `src/behaviors/types.ts` | Add `getFieldVM()` to BehaviorContext, update behavior type contracts |
| formspec-webcomponent | `src/behaviors/shared.ts` | Refactor bindSharedFieldEffects to take VM |
| formspec-webcomponent | `src/behaviors/*.ts` | Simplify all 13 field behaviors to use VM |
| formspec-webcomponent | `src/adapters/default/*.ts` | Read from `behavior.vm.*` |
| formspec-webcomponent | `src/components/*.ts` | Non-field components: resolve `$node:` locale keys |
| formspec-core | `src/types.ts` | Add `LocaleState`, `locales` + `selectedLocaleId` to ProjectState |
| formspec-core | `src/handlers/locale.ts` | **NEW** — locale handlers (load, remove, select, setString, etc.) |
| formspec-core | `src/handlers/index.ts` | Register locale handlers |
| formspec-core | `src/state-normalizer.ts` | Sync locale `targetDefinition.url` |
| formspec-core | `src/handlers/project.ts` | Handle locale documents in import bundle |
| formspec-core | `src/project-core.ts` | Add `locales`, `localeAt()`, `activeLocaleCode()` to IProjectCore |
| formspec-core | `src/raw-project.ts` | Initialize `locales: {}` in `createDefaultState()`, update `ProjectBundle` export |
| schemas | `locale.schema.json` | Extend propertyNames pattern for `$page.`, `$node:` |
| schemas | `component.schema.json` | Add optional `id` to ComponentBase |
| specs | `locale/locale-spec.md` | §1.2 scope, §3.1.7-3.1.8, §7.2 validation |
| specs | `component/component-spec.md` | Document node IDs |

## What NOT to Do

- **No formspec-layout changes** — pure theme resolution, orthogonal to locale.
- **No per-string signals** — VM computed signals read `activeLocale.value` internally, making them reactive without an explosion of individual string signals.
- **No breaking changes to existing API** — `getLabel()` still works, raw signal maps still exist. VM is additive.
- **No mutation of ValidationResult** — localized messages are a presentation overlay in the VM, not mutations of the engine's validation output.

## Build Sequence

1. **Create `interpolateMessage()`** — new runtime string interpolator with `{{{{` escape, null coercion, error recovery (§3.3.1)
2. **`LocaleStore`** — new file, no existing code changes
3. **`FieldViewModel` + `FormViewModel`** — new files, interface definitions
4. **Engine: create VMs in `initItem()`** — wraps existing signals, adds locale resolution
5. **Engine: expose public API** — `getFieldVM()`, `getFormVM()`, `loadLocale()`, `setLocale()`
6. **Engine: register FEL functions** — `locale()`, `plural()`, `formatNumber()`, `formatDate()`
7. **Schema changes** — locale.schema.json + component.schema.json
8. **Spec prose changes** — locale spec §1.2, §3.1.7-3.1.8, §7.2; component spec node IDs
9. **formspec-core: types + state init** — `LocaleState`, `ProjectState.locales`, `selectedLocaleId`; `createDefaultState()` initializes `locales: {}`
10. **formspec-core: locale handlers** — new handler module + registry registration
11. **formspec-core: state-normalizer** — sync locale `targetDefinition.url`
12. **formspec-core: project.import + export** — handle locale documents in import bundle; update `ProjectBundle` type and `export()` to include locales
13. **formspec-core: IProjectCore** — add `locales`, `localeAt()`, `activeLocaleCode()` queries
14. **Webcomponent: BehaviorContext + shared.ts** — `getFieldVM()`, refactored `bindSharedFieldEffects`
15. **Webcomponent: behavior hooks** — simplify all 13 to use VM (can be done one at a time)
16. **Webcomponent: adapter adjustments** — read from `behavior.vm.*`
17. **Webcomponent: element.ts** — `localeDocuments` + `locale` setters
18. **Webcomponent: non-field components** — `$node:` locale key resolution

Steps 1-6 are engine-only. Steps 7-8 are spec/schema. Steps 9-13 are formspec-core. Steps 14-18 are webcomponent. Each step is independently testable.

## Verification

### Unit tests (engine)

- **LocaleStore:** Load `fr` + `fr-CA` documents, verify `lookupKey()` cascade. Test circular fallback detection. Test BCP 47 normalization. Test hot-reload (load replacement for active locale).
- **FieldViewModel:** Create VM for a field, verify `label`/`hint`/`description` signals resolve through locale cascade. Test with label context (6-step cascade). Test FEL interpolation in strings (reactive to value changes). Test template path vs. instance path for repeat groups.
- **Option localization:** Load locale with `field.options.yes.label`, verify VM `options` signal produces localized labels. Test escaped option values (dots, backslashes).
- **Validation message localization:** Load locale with `field.errors.REQUIRED`, verify VM `errors` signal produces localized messages. Test 4-step cascade. Verify original ValidationResult not mutated.
- **FormViewModel:** Verify `title`/`description` signals. Test `pageTitle(id)` with theme page fallback.
- **FEL functions:** `locale()` returns active locale code, re-evaluates on `setLocale()`. `plural()` null propagation. `formatNumber()` / `formatDate()` with explicit and implicit locale.
- **interpolateMessage:** `{{{{` → `{{`. `null` → `""`. Non-recursive (output not re-scanned). Error recovery: failed `{{badExpr}}` → literal `{{badExpr}}` + warning, not crash (§3.3.1 rule 2 MUST).
- **Edge cases:** `locale()` returns `""` when no locale active. Empty `strings` object is a valid no-op (all strings fall through to inline). `compatibleVersions` mismatch emits warning but still loads. `$form.title` with FEL interpolation evaluates in global context.

### Unit tests (formspec-core)

- **Locale handlers:** `locale.load` stores document, `locale.remove` deletes, `locale.select` sets `selectedLocaleId`. `locale.setString` with value sets key, with null deletes key. `locale.setStrings` batch sets. `locale.setMetadata` sets name/title/description/version. `locale.setFallback` sets/clears fallback.
- **State normalizer:** After dispatch, locale `targetDefinition.url` syncs with definition URL.
- **Import/Export:** `project.import` with `locales` object populates `state.locales`. Single locale import via `locale` key also works. Export reconstitutes `LocaleDocument` format with `$formspecLocale` envelope.
- **IProjectCore queries:** `localeAt(code)` returns correct state. `activeLocaleCode()` returns `selectedLocaleId`.
- **State init:** `createRawProject()` produces state with `locales: {}` and `selectedLocaleId: undefined`.

### E2E tests (Playwright)

- Render form with locale documents, verify labels display in target language.
- Switch locale via `setLocale()`, verify labels update without full re-render.
- FEL interpolation: `"Total: {{$count}}"` updates when count field changes.
- Option labels: select dropdown shows localized options.
- Validation messages: required error shows localized message.
- Repeat groups: `"Item {{@index + 1}}"` produces correct per-instance labels.
- Page titles: wizard step labels / tab headers show localized text.
- Component-tier: heading, alert, submit button show localized text via `$node:` keys.
- Context labels: switch label context, verify locale-resolved context cascade.

### Schema validation

- Validate test locale documents against updated `locale.schema.json`.
- Verify `$page.` and `$node:` keys pass the new `propertyNames` pattern.
- Verify component documents with `id` pass `component.schema.json`.
