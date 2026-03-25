# formspec-react — React Hooks + Auto-Renderer

**Date:** 2026-03-25
**Status:** Implemented, reviewed

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

### Implemented (v0.1)

| Feature | File | Tests |
|---------|------|-------|
| `useSignal` — signal→React bridge | `use-signal.ts` | 2 unit |
| `useField` — full FieldViewModel unwrap | `use-field.ts` | 3 unit |
| `useFieldValue` — granular value hook | `use-field-value.ts` | 1 unit |
| `useFieldError` — granular error hook | `use-field-error.ts` | 1 unit |
| `useForm` — form-level state | `use-form.ts` | 2 unit |
| `useWhen` — FEL conditional evaluation | `use-when.ts` | 2 unit |
| `useRepeatCount` — repeat instance count | `use-repeat-count.ts` | 3 unit |
| `FormspecProvider` — context + engine | `context.tsx` | 2 unit |
| `FormspecForm` — auto-renderer | `renderer.tsx` | 7 unit |
| `FormspecNode` — recursive walker | `node-renderer.tsx` | — |
| `WhenGuard` — conditional layout nodes | `node-renderer.tsx` | 2 unit |
| `RepeatGroup` — repeat template stamping | `node-renderer.tsx` | 3 unit |
| `DefaultField` — semantic HTML fields | `defaults/fields/default-field.tsx` | via renderer tests |
| `DefaultLayout` — layout containers | `defaults/layout/default-layout.tsx` | via renderer tests |
| Component map overrides | `component-map.ts` | 2 unit |
| E2E tests (react-demo) | `tests/e2e/browser/react-demo.spec.ts` | 14 Playwright |

**Total: 30 unit tests + 14 E2E tests**

### Review Findings (spec-expert + scout, 2026-03-25)

#### Must fix (pre-release)

| # | Issue | Severity | Detail |
|---|-------|----------|--------|
| 1 | `@preact/signals-core` as peerDependency | **Critical** | Currently devDependency. If npm deduplicates to two instances, signal subscriptions silently break. Must be peerDependency matching engine's version. |
| 2 | `useSignal` subscribe churn | **Major** | `subscribe` closure recreated every render → effect disposed and recreated each cycle. Fix: `useCallback` with stable `signalRef`. |
| 3 | `findItemByKey` indexOf bug | **Minor** | Uses `parts.indexOf(part)` — breaks on duplicate path segments (e.g., `a.a.b`). Fix: use loop index. |
| 4 | No signal reactivity tests | **Major** | All unit tests verify initial render only. No test mutates a signal and verifies re-render. The core purpose of the hooks is untested. |
| 5 | `role="alert"` on empty error elements | **Minor** | Screen readers may announce empty alert on mount. Fix: conditionally render or remove role when empty. |
| 6 | Missing `types` in conditional exports | **Minor** | `./hooks` export lacks `"types"` condition. TS `moduleResolution: "bundler"` may fail to resolve types. |

#### Feature gaps vs webcomponent

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Repeat groups | **Implemented** | — | `RepeatGroup` + `useRepeatCount` + `rewriteBindPaths` |
| `when` conditionals | **Implemented** | — | `WhenGuard` + `useWhen` |
| `disabledDisplay: 'protected'` | Missing | Medium | Non-relevant fields always hidden; should render disabled when `protected` |
| Display nodes (Heading, Paragraph, Divider) | Missing | Medium | Render as empty containers — should render content |
| Interactive nodes (SubmitButton) | Missing | Medium | No submit button component |
| `registryEntries` in provider | Missing | Medium | Extension validation won't work |
| `initialData` hydration | Missing | **High** | No way to load existing response data for edit flows |
| Runtime context (`now`, `timezone`, `locale`) | Missing | Medium | Can't configure FEL functions like `today()` |
| Locale document loading | Missing | Low | No `loadLocale`/`setLocale` hooks |
| Touched/dirty tracking | Missing | Low | Validation shows immediately, not after interaction |
| External validation injection | Missing | Low | Server-side validation can't be merged |
| Screener flow | Missing | Low | No screener rendering |
| Wizard/pagination | Missing | Low | No multi-page navigation |
| `description` rendering in DefaultField | Missing | Low | Subscribed but not rendered |
| `templatePath` in UseFieldResult | Missing | Low | Useful for locale key lookups |
| `display`/`interactive` component map categories | Missing | Low | Can't override Heading/SubmitButton via map |
| Heading level tracking | Missing | Low | No automatic h2→h3→h4 nesting |
| Group-level relevance | Missing | Medium | Only field-level visibility checked |
| `scopeChange` prefix propagation | Needs verification | Medium | May already work if planner outputs fully-qualified bindPaths |

#### Architectural notes

- **`inputProps` spread helper** — good DX addition, not in engine VM but synthesized by `useField`. Enables `<Input {...field.inputProps} />` with any component library.
- **`useForm.submit()` signature** — only passes `mode` to `getResponse()`, not full metadata (`author`, `subject`, `id`). Document as convenience or expand signature.
- **Inline `components` prop** — if passed as object literal, causes unnecessary context re-renders. Document: define component maps as module-level constants.
- **Layout plan not reactive** — computed once via `useMemo`. Definition/theme changes require new engine. Acceptable for v0.1.

### Demo App

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
