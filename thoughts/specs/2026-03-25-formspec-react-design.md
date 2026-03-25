# formspec-react — React Hooks + Auto-Renderer

**Date:** 2026-03-25
**Status:** Approved

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
    │   FormspecProvider  │  context with FormEngine
    │                     │
    │  Renderer Layer:    │
    │   <FormspecForm>    │  definition → LayoutNode → React tree
    │   <FormspecField>   │  dispatches to field component map
    │   <FormspecLayout>  │  dispatches to layout component map
    │                     │
    │  Default Components:│
    │   Semantic HTML     │  theme cascade applied, ARIA complete
    │   + theme classes   │
    └─────────────────────┘
```

## Signal→React Bridge

`FieldViewModel` exposes `ReadonlyEngineSignal<T>` (Preact signals). React subscribes via `useSyncExternalStore`:

```ts
function useSignal<T>(signal: ReadonlyEngineSignal<T>): T {
    return useSyncExternalStore(
        (cb) => effect(() => { signal.value; cb(); }),
        () => signal.value,
    );
}
```

`useField(path)` calls `engine.getFieldVM(path)` then unwraps each signal property via `useSignal`. Granular hooks (`useFieldValue`, `useFieldError`) subscribe to individual signals for minimal re-renders.

## Component Map

```ts
interface ComponentMap {
    layout?: Partial<Record<string, React.ComponentType<LayoutNodeProps>>>;
    fields?: Partial<Record<string, React.ComponentType<FieldProps>>>;
}
```

- `FieldProps` receives the unwrapped `FieldViewModel` state plus the resolved presentation
- `LayoutNodeProps` receives the `LayoutNode` data plus `children`
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
import { FormspecForm } from 'formspec-react';
import { shadcnFieldComponents } from 'formspec-react/shadcn';

<FormspecForm definition={myDef} components={{ fields: shadcnFieldComponents }} />
```

## Exports

| Path | Contents |
|------|----------|
| `formspec-react` | Everything: hooks + renderer + defaults |
| `formspec-react/hooks` | Hooks only: `FormspecProvider`, `useField`, `useFieldValue`, `useFieldError`, `useForm`, `useSignal` |

## Peer Dependencies

- `react` >= 18
- `react-dom` >= 18
- `formspec-engine`
- `formspec-layout`
