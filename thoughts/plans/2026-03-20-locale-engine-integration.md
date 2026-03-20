# Plan: Wire Locale Documents into the Formspec Stack

**Date:** 2026-03-20
**Status:** Proposed
**Branch:** `claude/add-i18n-support-tpQ9A`
**Prerequisites:** Locale Specification (specs/locale/locale-spec.md), JSON Schema (schemas/locale.schema.json), ADR 0048

---

## Context

The Locale Specification, schema, and ADR are complete on branch `claude/add-i18n-support-tpQ9A`. This plan covers how to integrate locale resolution into the three implementation packages so that localized strings actually reach the DOM.

The core question: where does string resolution live, and how does it flow through the existing architecture?

## Architecture Decision: Engine-Level Resolution

Locale resolution belongs in **FormEngine** (formspec-engine), not in formspec-layout or formspec-webcomponent. Reasons:

1. **FEL interpolation** in locale strings (e.g., `"Total: {{$count}}"`) requires the engine's binding context — field signals, FEL evaluator, repeat state.
2. **`locale()` FEL function** must be registered in the FEL runtime, which lives in the engine.
3. **Reactivity** must flow through the signal graph. The engine owns all signals; string resolution must participate in the same reactive system.
4. **Server-side parity** — the Python evaluator also needs locale resolution, so it must be a core concept, not a rendering concern.

`formspec-layout` stays out — it's pure functions for theme cascade, no signals, no state. Locale doesn't change layout.

## Existing Plumbing

- `FormEngineRuntimeContext` already has `locale?: string` (interfaces.ts:21)
- `setRuntimeContext({ locale })` already updates it (index.ts:430-431)
- `setLabelContext(context)` / `getLabel(item)` handle context labels (index.ts:2317-2336) — this gets **superseded** by locale resolution
- Behavior hooks read `item.label`, `item.hint`, `item.description` directly — this is the seam we change

## Integration by Package

### 1. formspec-engine — Core locale store & resolution

**New file: `packages/formspec-engine/src/locale.ts`**

`LocaleStore` class — holds loaded locale documents, manages cascade, resolves strings.

```ts
class LocaleStore {
  private documents: Map<string, LocaleDocument>  // keyed by locale code
  private activeLocale: Signal<string>             // reactive; "" = no locale
  private version: Signal<number>                  // bumps on any load/setLocale

  loadLocale(doc: LocaleDocument): void
  setLocale(code: string): void
  getActiveLocale(): string
  resolveString(itemKey: string, property: string, context?: string): string | null
  resolveValidationMessage(itemKey: string, constraintKind: string): string | null
}
```

- `resolveString()` walks the cascade (§4.1 of the spec): regional → explicit fallback → implicit language → returns null (caller falls back to inline).
- FEL interpolation: calls `engine.compileExpression()` on `{{...}}` segments, evaluates in the item's binding context.
- Reading `activeLocale.value` inside `resolveString()` makes any computed/effect that calls it auto-subscribe.

**Changes to `FormEngine` (index.ts):**

- Add `localeStore: LocaleStore` (created in constructor, or lazily)
- Add public methods that delegate to the store:
  - `loadLocale(document)` → `this.localeStore.loadLocale(document)`
  - `setLocale(code)` → `this.localeStore.setLocale(code)` + also updates `runtimeContext.locale`
  - `getActiveLocale()` → `this.localeStore.getActiveLocale()`
  - `resolveString(path, property, context?)` → cascade lookup + FEL interpolation + inline fallback
- `resolveString()` is the unified API: it tries locale store first, then falls back to inline `item[property]` / `item.labels[context]`.
- Update `getLabel(item)` to go through `resolveString()` (backwards-compatible).
- `setRuntimeContext({ locale })` should also call `setLocale()` if the locale store is initialized.

**FEL function registration:**

- `locale()` — reads `localeStore.getActiveLocale()`. Non-deterministic like `now()`.
- `plural(count, singular, plural)` — pure function, straightforward.
- `formatNumber(value, locale?)` — delegates to `Intl.NumberFormat` (TS) / platform equivalent.
- `formatDate(value, pattern?, locale?)` — delegates to `Intl.DateTimeFormat`.

Register these in `initializeSignals()` or in the constructor after FEL runtime is ready, via `felRuntime.registerFunction()`.

**IFormEngine interface (interfaces.ts):**

Add to the interface:
```ts
loadLocale(document: LocaleDocument): void;
setLocale(code: string): void;
getActiveLocale(): string;
resolveString(path: string, property: string, context?: string): string;
```

### 2. formspec-core — Locale state in ProjectState

**Changes to `ProjectState` (types.ts):**

```ts
interface ProjectState {
  // ... existing fields ...
  locales: Record<string, LocaleState>;   // keyed by locale code
  activeLocaleCode?: string;              // which locale is active
}

interface LocaleState {
  locale: string;        // BCP 47 code
  version: string;
  fallback?: string;
  targetDefinition: { url: string; compatibleVersions?: string };
  strings: Record<string, string>;
  // metadata: name, title, description, url (stored but not used for resolution)
}
```

**New handler module: `src/handlers/locale.ts`**

Handlers:
- `locale.load` — add/replace a locale document in `state.locales[code]`
- `locale.remove` — remove a locale document
- `locale.setActive` — set `state.activeLocaleCode`
- `locale.setString` — edit a single string key (for authoring)
- `locale.removeString` — remove a string key

Pattern follows existing `theme.ts` handlers exactly — mutate cloned state, return `{ rebuildComponentTree: false }`.

**State normalizer (state-normalizer.ts):**

Add locale `targetDefinition.url` sync (same pattern as theme/component sync).

**project.import handler (handlers/project.ts):**

Handle locale documents in the import bundle — split and store in `state.locales`.

**IProjectCore (project-core.ts):**

Add query methods:
- `localeAt(code: string): LocaleState | undefined`
- `activeLocale(): string | undefined`

### 3. formspec-webcomponent — Locale-aware rendering

**New property setter on `<formspec-render>` (element.ts):**

```ts
set localeDocuments(docs: LocaleDocument | LocaleDocument[]) {
  const arr = Array.isArray(docs) ? docs : [docs];
  for (const doc of arr) {
    this.engine?.loadLocale(doc);
  }
  this.scheduleRender();
}

set locale(code: string) {
  this.engine?.setLocale(code);
  this._locale = code;
  this.scheduleRender();
}
```

Order: `registryDocuments` → `definition` → `localeDocuments` → `locale` (engine must exist before loading locales).

**Behavior hook changes — the critical seam:**

Currently in `behaviors/text-input.ts:43-50`:
```ts
const labelText = comp.labelOverride || item?.label || item?.key || comp.bind;
const hint = comp.hintOverride || item?.hint || null;
const description = item?.description || null;
```

Changes to:
```ts
const labelText = comp.labelOverride || ctx.engine.resolveString(fieldPath, 'label') || comp.bind;
const hint = comp.hintOverride || ctx.engine.resolveString(fieldPath, 'hint') || null;
const description = ctx.engine.resolveString(fieldPath, 'description') || null;
```

Since these are called inside `effect()` blocks, reading `activeLocale.value` through `resolveString()` auto-subscribes to locale changes. When `setLocale()` is called, all affected effects re-run and DOM updates.

Same pattern applies to:
- `behaviors/shared.ts` — required indicator label text
- `behaviors/select.ts` — option labels
- `behaviors/checkbox.ts`, `behaviors/radio.ts` — option labels
- `adapters/default/shared.ts:createFieldDOM()` — label/hint/description DOM

**Validation message localization (behaviors/shared.ts:88-104):**

Currently reads `ctx.engine.errorSignals[fieldPath]?.value`. Change to:
```ts
effect(() => {
  const errorMsg = ctx.engine.errorSignals[fieldPath]?.value;
  if (errorMsg && touched) {
    // Try locale override first
    const localizedMsg = ctx.engine.resolveValidationMessage(fieldPath, errorMsg.constraintKind);
    errorEl.textContent = localizedMsg || errorMsg.message;
  }
});
```

**Option label localization:**

For select/radio/checkbox, option labels need locale resolution. `engine.resolveString(fieldPath, 'options.yes.label')` or a dedicated `resolveOptionLabel(fieldPath, optionValue)` helper.

## Key Files to Modify

| Package | File | Change |
|---------|------|--------|
| formspec-engine | `src/locale.ts` | **NEW** — LocaleStore class |
| formspec-engine | `src/index.ts` | Add locale methods, update getLabel |
| formspec-engine | `src/interfaces.ts` | Add locale methods to IFormEngine |
| formspec-core | `src/types.ts` | Add `locales` + `activeLocaleCode` to ProjectState |
| formspec-core | `src/handlers/locale.ts` | **NEW** — locale handlers |
| formspec-core | `src/handlers/index.ts` | Register locale handlers |
| formspec-core | `src/state-normalizer.ts` | Sync locale targetDefinition URLs |
| formspec-core | `src/handlers/project.ts` | Handle locale in import |
| formspec-core | `src/project-core.ts` | Add locale queries to interface |
| formspec-webcomponent | `src/element.ts` | Add `localeDocuments` + `locale` setters |
| formspec-webcomponent | `src/behaviors/text-input.ts` | Use resolveString() for labels |
| formspec-webcomponent | `src/behaviors/shared.ts` | Locale-aware validation messages |
| formspec-webcomponent | `src/behaviors/select.ts` | Locale-aware option labels |
| formspec-webcomponent | `src/behaviors/*.ts` | All behavior hooks: resolveString() |
| formspec-webcomponent | `src/adapters/default/shared.ts` | Locale-aware createFieldDOM |

## What NOT to Do

- **No changes to formspec-layout** — it's pure theme resolution. Locale is orthogonal.
- **No locale-specific signals per string** — that's an explosion of signals. Instead, `resolveString()` is a function that reads the `activeLocale` signal internally, making it reactive when called inside `effect()`.
- **No breaking changes to existing API** — `getLabel()` still works, `item.label` still exists in the definition. Locale is additive.

## Build Sequence

1. **formspec-engine** first (no package dependencies for locale)
2. **formspec-core** second (depends on engine types)
3. **formspec-webcomponent** last (depends on both)

## Verification

1. **Unit tests** (engine): Load two locale documents (fr, fr-CA), setLocale, verify resolveString cascade. Test FEL interpolation in strings. Test locale() and plural() FEL functions. Test circular fallback detection.
2. **Unit tests** (core): Handler tests for locale.load, locale.setActive, locale.remove. State normalizer tests.
3. **E2E tests** (Playwright): Render a form with locale documents, verify labels change when locale is set. Verify interpolation. Verify option labels. Verify validation messages.
4. **Schema validation**: Validate test locale documents against locale.schema.json.
