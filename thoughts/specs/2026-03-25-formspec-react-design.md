# formspec-react — React Hooks + Auto-Renderer

**Date:** 2026-03-25
**Status:** v0.3 complete (59 unit + 14 E2E tests) — see Roadmap for v0.4 remaining work

## Problem

`formspec-webcomponent` fuses field resolution logic with imperative DOM binding. React apps can't use formspec without the web component indirection layer, and can't compose with their own component libraries (shadcn, MUI, Radix).

## Key Insight

`FieldViewModel` and `FormViewModel` already exist in `formspec-engine` and provide the full framework-agnostic reactive field state: `label`, `hint`, `value`, `required`, `visible`, `readonly`, `errors`, `firstError`, `options`, `optionsState`, `setValue()`. All as `ReadonlyEngineSignal<T>`. The engine's `getFieldVM(path)` and `getFormVM()` are the shared layer — no extraction from webcomponent needed.

## Design Decisions

1. **Approach B** — hooks layer + composable renderer with layout/field split
2. **Layer 2** in the dependency fence, peer to `formspec-webcomponent`
3. **Both convenience and granular hooks** — `useField(path)` for convenience, `useFieldValue(path)` / `useFieldError(path)` for performance
4. **Auto-renderer** — `<FormspecForm>` walks `LayoutNode` tree from `formspec-layout` planner
5. **Default components** — semantic HTML with theme cascade applied (cssClass, style, accessibility). No design-system CSS opinions.
6. **Overridable component map** — `components={{ fields: { TextInput: MyShadcnInput }, layout: { Card: MyCard } }}`

## Architecture

```
formspec-engine (layer 1)        formspec-layout (layer 1)
    │ FieldViewModel                  │ LayoutNode, planner
    │ FormViewModel                   │ theme cascade
    │ Preact signals                  │
    └──────────┬──────────────────────┘
               │
    ┌──────────┴──────────┐
    │   formspec-react    │  Layer 2
    │                     │
    │  Hooks Layer:       │
    │   useSignal()       │  generic signal→React bridge
    │   useField(path)    │  full FieldViewModel unwrap
    │   useFieldValue()   │  granular: value + setValue
    │   useFieldError()   │  granular: error string
    │   useForm()         │  form-level state
    │   useWhen()         │  FEL conditional evaluation
    │   useRepeatCount()  │  repeat group instance count
    │   FormspecProvider  │  context with FormEngine
    │                     │
    │  Renderer Layer:    │
    │   <FormspecForm>    │  definition → LayoutNode → React tree
    │   <FormspecNode>    │  recursive tree walker
    │   WhenGuard         │  conditional layout nodes
    │   RepeatGroup       │  repeat template stamping
    │   FieldNode         │  dispatches to field component map
    │   LayoutNodeRenderer│  dispatches to layout component map
    │                     │
    │  Default Components:│
    │   DefaultField      │  semantic HTML + ARIA + theme
    │   DefaultLayout     │  Stack/Card/Grid containers
    └─────────────────────┘
```

## Signal→React Bridge

`FieldViewModel` exposes `ReadonlyEngineSignal<T>` (Preact signals). React subscribes via `useSyncExternalStore`:

```ts
function useSignal<T>(signal: ReadonlyEngineSignal<T>): T {
    return useSyncExternalStore<T>(
        (onStoreChange) => {
            return effect(() => {
                signalRef.current.value; // track
                onStoreChange();
            });
        },
        () => signalRef.current.value as T,
        () => signalRef.current.value as T,
    );
}
```

`useField(path)` calls `engine.getFieldVM(path)` then unwraps each signal property via `useSignal`. Granular hooks (`useFieldValue`, `useFieldError`) subscribe to individual signals for minimal re-renders.

## Component Map

```ts
interface ComponentMap {
    layout?: Partial<Record<string, React.ComponentType<LayoutComponentProps>>>;
    fields?: Partial<Record<string, React.ComponentType<FieldComponentProps>>>;
}
```

- `FieldComponentProps` receives `{ field: UseFieldResult, node: LayoutNode }`
- `LayoutComponentProps` receives `{ node: LayoutNode, children: React.ReactNode }`
- Defaults render semantic HTML with theme `cssClass`/`style`/`accessibility` applied
- Users override any subset: `components={{ fields: { TextInput: MyShadcnInput } }}`

## Usage

### Hooks only (full control):
```tsx
import { FormspecProvider, useField } from 'formspec-react/hooks';
import { Input } from '@/components/ui/input';

function MyForm() {
    const name = useField('contactInfo.fullName');
    return (
        <div>
            <label htmlFor={name.id}>{name.label}</label>
            <Input id={name.id} value={name.value} onChange={e => name.setValue(e.target.value)} />
            {name.error && <p>{name.error}</p>}
        </div>
    );
}
```

### Auto-renderer (drop-in):
```tsx
import { FormspecForm } from 'formspec-react';

<FormspecForm definition={myDef} />
```

### Auto-renderer with overrides:
```tsx
<FormspecForm
    definition={myDef}
    components={{ fields: { TextInput: MyShadcnInput } }}
/>
```

## Exports

| Path | Contents |
|------|----------|
| `formspec-react` | Everything: hooks + renderer + defaults |
| `formspec-react/hooks` | Hooks only: `FormspecProvider`, `useField`, `useFieldValue`, `useFieldError`, `useForm`, `useSignal`, `useWhen`, `useRepeatCount` |

## Peer Dependencies

- `react` >= 18
- `formspec-engine`
- `formspec-layout`
- `@preact/signals-core` (must be singleton with formspec-engine's instance)

## Implementation Status

### Implemented

| Feature | File | Tests |
|---------|------|-------|
| `useSignal` — signal→React bridge | `use-signal.ts` | 2 unit |
| `useField` — full FieldViewModel unwrap + touched | `use-field.ts` | 4 unit |
| `useFieldValue` — granular value hook | `use-field-value.ts` | 1 unit |
| `useFieldError` — granular error hook | `use-field-error.ts` | 1 unit |
| `useForm` — form-level state | `use-form.ts` | 2 unit |
| `useWhen` — FEL conditional evaluation | `use-when.ts` | 2 unit |
| `useRepeatCount` — repeat instance count | `use-repeat-count.ts` | 3 unit |
| `FormspecProvider` — context + engine + touched tracking | `context.tsx` | 2 unit |
| `FormspecForm` — auto-renderer | `renderer.tsx` | 7 unit |
| `FormspecNode` — recursive walker | `node-renderer.tsx` | — |
| `WhenGuard` — conditional layout nodes | `node-renderer.tsx` | 2 unit |
| `RepeatGroup` — repeat template stamping | `node-renderer.tsx` | 3 unit |
| `DefaultField` — semantic HTML fields | `defaults/fields/default-field.tsx` | via renderer |
| `DefaultLayout` — layout containers | `defaults/layout/default-layout.tsx` | via renderer |
| Component map overrides | `component-map.ts` | 2 unit |
| Touched tracking (`touchField`, `isTouched`, `onBlur`) | `context.tsx`, `use-field.ts` | 2 unit |
| E2E tests (react-demo) | `tests/e2e/browser/react-demo.spec.ts` | 14 Playwright |
| Signal reactivity (re-render on mutation) | `tests/hooks.test.tsx` | 6 unit |
| `initialData` prop (edit flows) | `context.tsx`, `tests/hooks.test.tsx` | 2 unit |
| `registryEntries` prop (extension validation) | `context.tsx`, `tests/hooks.test.tsx` | 1 unit |
| `findItemByKey` indexOf fix + tests | `context.tsx`, `tests/hooks.test.tsx` | 4 unit |
| Stable `useSignal` subscribe closure | `use-signal.ts` | via reactivity |
| `@preact/signals-core` peer dep | `package.json` | — |
| Conditional exports with `types` | `package.json` | — |

**Total: 59 unit tests + 14 E2E tests — all passing**

## Roadmap

### v0.2 — Blocking real usage ✅ COMPLETE

| # | Item | Type | Status |
|---|------|------|--------|
| 1 | Move `@preact/signals-core` to peerDependencies | **Bug fix** | ✅ Done |
| 2 | Stabilize `useSignal` subscribe closure | **Bug fix** | ✅ Done — `useCallback` + stable `signalRef` |
| 3 | Add `initialData` prop to `FormspecProvider` | **Feature** | ✅ Done — iterates `Record<string,any>`, calls `setValue` per entry |
| 4 | Add `registryEntries` prop to `FormspecProvider` | **Feature** | ✅ Done — passed to `createFormEngine` third arg |
| 5 | Add signal reactivity tests | **Test gap** | ✅ Done — 6 tests: useSignal(2), useField, useFieldValue, useWhen, useRepeatCount |
| 6 | Fix `findItemByKey` indexOf bug | **Bug fix** | ✅ Done — replaced `indexOf` with loop index `i` |
| 12 | `types` in conditional exports | **DX fix** | ✅ Done — both `.` and `./hooks` have `types` condition |

### v0.3 — Rendering completeness ✅ COMPLETE

| # | Item | Type | Status |
|---|------|------|--------|
| 7 | Display node rendering | **Feature** | ✅ Done — Heading→h3, Text→p, Divider→hr, Alert→div[role=status] |
| 8 | SubmitButton component | **Feature** | ✅ Done — `onSubmit` prop on FormspecForm, renders submit button, calls with `{response, validationReport}` |
| 9 | `disabledDisplay: 'protected'` | **Feature** | ✅ Done — irrelevant fields render disabled/readonly with `formspec-protected` class |
| 10 | Group-level relevance | **Feature** | ✅ Done — `RelevanceGatedLayout` subscribes to `engine.relevantSignals[bindPath]` |
| 11 | `role="alert"` on empty errors | **A11y fix** | ✅ Done — error element conditionally rendered only when `field.error` is truthy |

### v0.4 — Engine integration

| # | Item | Type | Detail |
|---|------|------|--------|
| 13 | Runtime context prop (`now`, `timezone`, `locale`) | **Feature** | `FormEngineRuntimeContext` not exposed. FEL `today()` and locale-aware formatting won't be configurable. |
| 14 | Locale hooks (`useLocale`) | **Feature** | No way to load locale documents or switch languages. Add `loadLocale`/`setLocale` forwarding. |
| 15 | External validation injection | **Feature** | Server-side validation results can't be merged. Forward `engine.injectExternalValidation()`. |
| 16 | `useForm.submit()` full metadata | **DX** | Currently only passes `mode`. Should accept full `{ id, author, subject, mode }` for response metadata. |

### Not planned (handle via component overrides)

- Wizard/pagination — custom layout component
- Screener flow — separate component outside form
- Heading level tracking — custom layout component can track depth
- Theme token resolution — handled by CSS variable cascade
- `templatePath` exposure — niche, available on VM if needed

## Architectural Notes

- **`inputProps` spread helper** — good DX, synthesized by `useField`. Enables `<Input {...field.inputProps} />` with any component library. Includes `onBlur` for touched tracking.
- **Inline `components` prop pitfall** — if passed as object literal, causes unnecessary context re-renders. Define component maps as module-level constants.
- **Layout plan not reactive** — computed once via `useMemo`. Definition/theme changes require new engine. Acceptable for now.
- **`scopeChange` prefix propagation** — needs verification. May already work if the planner outputs fully-qualified `bindPath` values on all nodes.

## Review History

- **2026-03-25 spec-expert review** — 6 must-fix issues, 18 feature gaps identified. Signal bridge fundamentally correct. Granular hook split praised. `inputProps` called out as strong DX.
- **2026-03-25 scout review** — confirmed spec-expert findings. Noted craftsman added repeat groups, `when` conditionals, and touched tracking (7 additional tests). Flagged signal reactivity tests as critical gap.

## Demo App

`examples/react-demo/` — Community Impact Grant Application

- 30+ fields across 6 groups (Organization, Contact, Project, Budget, Documents, Certification)
- 8 field types: string, integer, decimal, choice, multiChoice, boolean, text, attachment
- 3 optionSets (org types, states, focus areas)
- Conditional field: Prior Grant ID appears when "is renewal" checked
- 19 required fields + constraints (year range, budget cap)
- 3 certification checkboxes with custom constraint messages
- 1 cross-field shape rule (budget consistency warning)
- Custom styled components via component map overrides
- `FormspecProvider` + `FormspecNode` pattern (shared provider for form + submit panel)

Run: `cd examples/react-demo && npm install && npm run dev` → http://localhost:5200
