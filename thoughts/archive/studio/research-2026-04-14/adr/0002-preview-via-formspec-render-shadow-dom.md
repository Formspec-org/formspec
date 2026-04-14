# ADR-0002: Preview Workspace via `<formspec-render>` in Shadow DOM

**Status:** Proposed
**Date:** 2026-03-11
**Relates to:** ADR-0001 (The Stack), `formspec-webcomponent` package

---

## Context

The Preview workspace currently renders a simplified mock — basic HTML inputs and labels built directly in React. This is useful for early iteration but has zero fidelity with the actual respondent experience. The real renderer is `<formspec-render>`, a custom element in `formspec-webcomponent` that provides:

- 37 built-in components (layout, input, display, interactive, special)
- Theme cascade (5-level: formPresentation → item presentation → defaults → selectors → item overrides)
- Responsive breakpoints via `matchMedia`
- Reactive ARIA attributes and validation display
- Wizard navigation, screener gates, repeat groups
- External stylesheet injection with ref-counting

Using the actual renderer in Preview gives WYSIWYG fidelity — what you author is what respondents see.

## Problem

Embedding `<formspec-render>` inside the React 19 + Tailwind CSS 4 studio creates three conflicts:

1. **CSS collision.** Tailwind 4's `@theme` tokens (e.g., `--color-accent`, `--radius-DEFAULT`) and utility classes will leak into the rendered form. The webcomponent's `formspec-base.css` and theme-injected CSS custom properties (`--formspec-spacing-lg`) will leak into the studio shell. Both use global CSS custom properties; both target common element selectors.

2. **Engine duplication.** `formspec-studio-core` already creates a `FormEngine` for authoring. `<formspec-render>` creates its own internal `FormEngine` when `definition` is set. These must remain independent — the authoring engine tracks edit state; the preview engine tracks respondent state (field values, validation, page progress).

3. **Property bridging.** React 19 improved custom element support but still has quirks. Complex object properties (definition JSON, component document, theme document) must be set as JS properties, not HTML attributes. Event listeners for `formspec-submit` and `formspec-screener-route` need explicit wiring.

## Decision

**Embed `<formspec-render>` inside a Shadow DOM boundary managed by a React ref-based wrapper component.**

### Why Shadow DOM, not iframe

| Concern | Shadow DOM | iframe |
|---------|-----------|--------|
| Style isolation | Full (shadow boundary blocks inheritance) | Full (separate document) |
| State transfer | Direct JS property assignment on element | postMessage serialization or shared ref |
| Performance | Single process, no document overhead | Separate browsing context |
| Viewport simulation | Container width constraint | Can set iframe width directly |
| Theme stylesheet loading | Injected into shadow root | Loaded in iframe document |
| Complexity | Moderate (ref management) | High (cross-frame coordination) |

Shadow DOM gives sufficient isolation without the coordination overhead of cross-frame messaging. The webcomponent already works in any DOM context — shadow roots are a natural fit.

### Why not direct embedding (no shadow DOM)

Without a shadow boundary, Tailwind's reset (`*, ::before, ::after { box-sizing: border-box; border: 0; }`) strips the webcomponent's styled borders and spacing. The webcomponent's `formspec-base.css` would fight Tailwind's preflight. CSS custom property names could collide (`--color-*` from both systems). The result would be a broken visual that defeats the purpose of a WYSIWYG preview.

## Architecture

### Component: `FormspecPreviewHost`

```
PreviewTab
 └─ ViewportSwitcher (width constraint)
    └─ FormspecPreviewHost (React component)
       └─ <div ref={hostRef}>
          └─ ShadowRoot (mode: 'open')
             ├─ <link rel="stylesheet" href="formspec-base.css">
             ├─ <link rel="stylesheet" href="..."> (theme stylesheets)
             ├─ <style> (theme CSS custom properties)
             └─ <formspec-render>
                 ├─ .definition = project.state.definition
                 ├─ .componentDocument = project.state.component
                 └─ .themeDocument = project.state.theme
```

### Data Flow

```
Project.state (authoring)
    │
    ├─ definition ──────┐
    ├─ component ───────┼──▶ <formspec-render> properties
    ├─ theme ───────────┘        │
    │                            ▼
    │                    FormEngine (preview, independent)
    │                            │
    │                            ▼
    │                    Rendered DOM (inside shadow root)
    │
    └─ onChange() ──▶ useProjectState() ──▶ re-sync properties
```

The authoring `Project` and the preview `FormEngine` are fully independent. The preview engine receives the same definition JSON but maintains its own field values, validation state, and page position. This is correct behavior — the preview simulates a fresh respondent session.

### Property Sync Strategy

Sync on every `useProjectState()` change is wasteful — most edits (renaming a field, toggling a bind) don't need an immediate preview refresh since it would reset the respondent's in-progress state. Two modes:

1. **Auto-sync** (default): Debounced. After 500ms of no dispatches, push current definition/component/theme to the preview element. The webcomponent's internal `FormEngine` reinitializes, resetting field values.

2. **Manual sync**: User clicks a "Refresh Preview" button. Better for deep editing sessions where you don't want to lose test data entered in the preview.

Both are cheap — setting `.definition` on the element triggers an internal re-render via microtask coalescing in the webcomponent.

### Viewport Simulation

The `ViewportSwitcher` already constrains the preview area width. Inside the shadow root, `<formspec-render>` uses `matchMedia` for responsive breakpoints. Since `matchMedia` queries the actual viewport (not the container), responsive previewing at non-viewport widths requires:

**Option A: CSS `width` constraint only.** Set the shadow host's width to the simulated viewport. Components using percentage-based or flex layouts respond correctly. `matchMedia`-driven breakpoints won't fire (they see the real viewport), but this is acceptable for most preview scenarios.

**Option B: Container queries.** If the webcomponent is updated to support CSS container queries alongside `matchMedia`, the shadow host can declare `container-type: inline-size` and breakpoints respond to container width. This is a future enhancement to `formspec-webcomponent`, not a studio concern.

**Recommendation: Option A for now.** Width constraint handles 90% of responsive preview needs. True breakpoint simulation is a `formspec-webcomponent` enhancement.

### Registry Forwarding

Per project memory: `registryDocuments` must be set BEFORE `definition` on `<formspec-render>`. The sync logic must respect this ordering:

```
1. Set registryDocuments from project.state.extensions.registries
2. Set definition from project.state.definition
3. Set componentDocument from project.state.component
4. Set themeDocument from project.state.theme
```

### Theme Stylesheet Isolation

`<formspec-render>` normally injects theme `stylesheets` as `<link>` elements in the main document with ref-counting. Inside a shadow root, these links must be injected into the shadow root instead, or they won't apply. Two approaches:

1. **Patch the element**: Override or configure the stylesheet injection target to use `shadowRoot` instead of `document.head`. Requires a minor API addition to the webcomponent.

2. **Pre-inject**: Read `themeDocument.stylesheets`, create `<link>` elements manually in the shadow root before setting `.themeDocument`. The webcomponent's internal ref-counting still works for its own injections, but the shadow-root links provide the actual styles.

**Recommendation: Option 2 initially** (no webcomponent changes needed), then Option 1 when the webcomponent adds shadow root awareness.

### Event Handling

Wire these events from the shadow root for studio integration:

| Event | Studio Action |
|-------|--------------|
| `formspec-submit` | Show submission result in a toast/panel |
| `formspec-screener-route` | Display routing decision in status area |
| `formspec-screener-state-change` | Update screener indicator |

Events bubble through shadow DOM boundaries (they're composed), so listeners on the host div will receive them.

## Implementation Sketch

```tsx
// src/workspaces/preview/FormspecPreviewHost.tsx

function FormspecPreviewHost({ width }: { width: number }) {
  const state = useProjectState();
  const hostRef = useRef<HTMLDivElement>(null);
  const renderRef = useRef<any>(null);
  const shadowRef = useRef<ShadowRoot>(null);

  // One-time: attach shadow, create element
  useEffect(() => {
    const host = hostRef.current!;
    const shadow = host.attachShadow({ mode: 'open' });
    shadowRef.current = shadow;

    // Inject base styles
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/node_modules/formspec-webcomponent/formspec-base.css';
    shadow.appendChild(link);

    // Create render element
    const el = document.createElement('formspec-render');
    shadow.appendChild(el);
    renderRef.current = el;

    return () => { shadow.innerHTML = ''; };
  }, []);

  // Sync state → element properties (debounced)
  useEffect(() => {
    const el = renderRef.current;
    if (!el) return;
    const timer = setTimeout(() => {
      el.definition = state.definition;
      el.componentDocument = state.component;
      el.themeDocument = state.theme;
    }, 500);
    return () => clearTimeout(timer);
  }, [state.definition, state.component, state.theme]);

  return (
    <div
      ref={hostRef}
      style={{ width, maxWidth: '100%', margin: '0 auto' }}
    />
  );
}
```

## Consequences

**Positive:**
- True WYSIWYG preview using the production renderer
- Complete style isolation — no Tailwind/formspec-base conflicts
- Independent preview engine — respondent behavior (validation, wizard nav, screener) works correctly
- No changes needed to `formspec-webcomponent` for initial implementation

**Negative:**
- Shadow DOM makes DevTools inspection slightly harder (extra tree level)
- `matchMedia` breakpoints don't respond to container width (viewport only)
- Theme external stylesheets need manual shadow root injection until webcomponent adds support
- Setting `.definition` resets the preview engine's field values (by design, but may surprise authors mid-test)

**Neutral:**
- Two `FormEngine` instances in memory (authoring + preview) — negligible cost
- Bundle size increases by pulling in `formspec-webcomponent` + `formspec-layout` — already workspace dependencies, tree-shakeable

## Alternatives Considered

1. **iframe embedding** — Full isolation but high coordination cost. postMessage serialization of definition JSON on every edit is wasteful. Cross-frame event handling is fragile.

2. **Direct embedding without shadow DOM** — CSS collisions make the preview unreliable. Tailwind's preflight and the webcomponent's base styles are incompatible in the same scope.

3. **Re-implementing the renderer in React** — Defeats the purpose. We'd be maintaining two renderers. The webcomponent IS the reference implementation; the preview should use it directly.

4. **Rendering to a canvas/image** — Loses interactivity. Authors need to click through the form, test validation, navigate wizard steps.
