# ADR-0020: CSS Integration and Design System Interop

**Status**: Accepted
**Date**: 2026-02-24
**Authors**: exedev, Claude (AI)
**Deciders**: exedev

---

## 1. Context and Problem Statement

The Formspec spec defines a token system (`$token.X`) and a `style` map on every component, but says nothing about how these should manifest in rendered output. Tokens resolve at "theme-application time" into inline style values — and that's where the pipeline ends.

This creates a gap when integrating with real CSS frameworks (USWDS, Material, Bootstrap, GOV.UK). These frameworks work through CSS classes and custom properties, not inline styles. A form author who wants their TextInput styled as a `usa-input` has no way to express that in a component or theme document. A theme author who wants to ship USWDS as the base stylesheet has no way to declare it.

The spec is correctly design-system-agnostic. It should stay that way. But it needs three small escape hatches to let external CSS participate.

## 2. Decision Drivers

- **The spec already handles tokens and style** — we're not redesigning, we're closing gaps.
- **CSS classes are the universal interop mechanism** — every design system works through them.
- **CSS custom properties are the standard token bridge** — they let CSS reference values defined in JSON without JavaScript coupling.
- **Backwards compatibility** — all changes must be additive and optional.
- **Renderer freedom** — the spec should recommend, not mandate, rendering strategies. A PDF renderer doesn't use CSS classes.

## 3. Gap Analysis

### Gap 1: No way to apply CSS classes to components

The component spec (§3.1) defines `style` as the only visual hook — a flat map of key-value pairs interpreted as inline styles. There's no property for CSS class names.

**Impact**: Form authors can't hook into any class-based CSS framework from within a component document. Renderers must hardcode framework-specific class names or rely on bridge CSS targeting internal implementation classes.

### Gap 2: No way to apply CSS classes via the theme cascade

The theme spec's `PresentationBlock` (§5) has `widget`, `widgetConfig`, `labelPosition`, `style`, `accessibility`, and `fallback`. No `cssClass` property.

**Impact**: Theme authors can't use the cascade to apply design-system classes by dataType or item key. A USWDS theme can't say "all money inputs get `usa-input`" through the spec's own cascade mechanism.

### Gap 3: No way to declare external stylesheets

A theme document defines tokens (JSON values) and style blocks (inline overrides), but can't point to an external CSS file. Loading USWDS CSS is entirely the renderer's problem.

**Impact**: Theme portability is limited. A USWDS theme document works only if the renderer independently knows to load USWDS CSS. The theme can't be self-describing.

### Gap 4: No guidance on CSS custom property emission

The spec says tokens resolve at "theme-application time" but doesn't say what that means for web renderers. Should resolved values be inline styles? CSS custom properties? Both?

**Impact**: Every web renderer invents its own approach. Bridge CSS can't reliably reference theme tokens because there's no convention for how they appear in the DOM.

## 4. Proposed Changes

All changes are additive and optional. No existing documents break.

### 4.1 Add `cssClass` to component base properties

**Spec**: Component spec §3.1 (Component Object Base Properties)
**Schema**: `component.schema.json` — every component definition

Add a `cssClass` property:

| Property | Type | Cardinality | Description |
|----------|------|-------------|-------------|
| `cssClass` | string \| array of strings | 0..1 | CSS class name(s) that renderers SHOULD apply to the component's root element. |

```json
{
  "component": "TextInput",
  "bind": "name",
  "cssClass": ["usa-input", "usa-input--xl"]
}
```

Normative requirements:
- Web renderers SHOULD apply `cssClass` values as CSS class names on the component's outermost rendered element.
- Non-web renderers (PDF, native) MAY ignore `cssClass`.
- `cssClass` values MAY contain `$token.` references (resolved to strings before application).
- `cssClass` is additive — it does not replace any classes the renderer generates internally.

### 4.2 Add `cssClass` to theme PresentationBlock

**Spec**: Theme spec §5 (Selector Cascade)
**Schema**: `theme.schema.json` → `PresentationBlock`

Add `cssClass` to the PresentationBlock definition:

```json
{
  "defaults": {
    "cssClass": "formspec-field"
  },
  "selectors": [
    {
      "match": { "dataType": "money" },
      "apply": { "cssClass": ["usa-input", "usa-input--currency"] }
    }
  ],
  "items": {
    "totalBudget": {
      "cssClass": "budget-total-highlight"
    }
  }
}
```

Cascade semantics: `cssClass` values from all matching cascade levels are **merged** (unioned), not replaced. This differs from other PresentationBlock properties which use shallow replace. Rationale: classes are additive by nature — a selector adding `usa-input` shouldn't remove a default-level `formspec-field`.

### 4.3 Add `stylesheets` to theme document top-level

**Spec**: Theme spec §2.1 (Top-Level Properties)
**Schema**: `theme.schema.json`

Add an optional `stylesheets` array:

| Property | Type | Cardinality | Description |
|----------|------|-------------|-------------|
| `stylesheets` | array of URI strings | 0..1 | External CSS files the renderer SHOULD load when applying this theme. |

```json
{
  "$formspecTheme": "1.0",
  "version": "1.0.0",
  "stylesheets": [
    "https://cdn.example.com/uswds/3.11/uswds.min.css"
  ],
  "targetDefinition": { "url": "*" }
}
```

Normative requirements:
- Web renderers SHOULD load declared stylesheets before rendering.
- Renderers MAY cache stylesheets, load them lazily, or scope them to the form container.
- Renderers MUST NOT fail if a stylesheet cannot be loaded; they SHOULD warn and continue.
- Non-web renderers MAY ignore `stylesheets`.
- Ordering is significant: stylesheets are loaded in array order.

### 4.4 Add prose guidance on CSS custom property emission

**Spec**: Component spec §10 (Theming and Design Tokens) — new subsection §10.5
**Schema**: No schema changes.

Recommended prose (informative, not normative):

> **§10.5 CSS Custom Property Emission (Web Renderers)**
>
> Web renderers SHOULD emit resolved theme tokens as CSS custom properties on the form's root container element. The recommended naming convention is:
>
> ```
> --formspec-{token-key-with-dots-replaced-by-hyphens}
> ```
>
> For example, a theme token `color.primary` with value `#005ea2` SHOULD be emitted as:
>
> ```css
> --formspec-color-primary: #005ea2;
> ```
>
> This enables external CSS — including design-system bridge stylesheets and author-defined overrides — to reference theme tokens without JavaScript. Bridge CSS can use `var(--formspec-color-primary)` to stay in sync with the active theme.
>
> Renderers that emit CSS custom properties SHOULD update them when the theme document changes. Renderers MAY also emit tokens from the component document's `tokens` map, with component tokens taking precedence over theme tokens for identically named properties.

## 5. Schema Changes (Concrete)

### `component.schema.json`

Add to every component definition and to the base property list:

```json
"cssClass": {
  "oneOf": [
    { "type": "string" },
    { "type": "array", "items": { "type": "string" } }
  ],
  "description": "CSS class name(s) applied to the component's root element. Additive to renderer-generated classes."
}
```

### `theme.schema.json`

Add to `PresentationBlock`:

```json
"cssClass": {
  "oneOf": [
    { "type": "string" },
    { "type": "array", "items": { "type": "string" } }
  ],
  "description": "CSS class name(s) applied to matching items. Merged (unioned) across cascade levels."
}
```

Add to top-level properties:

```json
"stylesheets": {
  "type": "array",
  "items": { "type": "string", "format": "uri" },
  "description": "External CSS files to load when applying this theme. Web renderers SHOULD load these before rendering."
}
```

## 6. Examples

### USWDS Theme Document

```json
{
  "$formspecTheme": "1.0",
  "version": "1.0.0",
  "name": "uswds-default",
  "title": "USWDS Default",
  "targetDefinition": { "url": "*" },
  "stylesheets": [
    "https://cdn.example.com/uswds/3.11/uswds.min.css"
  ],
  "tokens": {
    "color.primary": "#005ea2",
    "color.error": "#b50909",
    "color.success": "#00a91c",
    "spacing.md": "1rem",
    "border.radius": "0.25rem"
  },
  "defaults": {
    "cssClass": "usa-form-group"
  },
  "selectors": [
    {
      "match": { "type": "field" },
      "apply": { "cssClass": "usa-form-group" }
    }
  ]
}
```

### Component Document Using cssClass

```json
{
  "$formspecComponent": "1.0",
  "version": "1.0.0",
  "targetDefinition": { "url": "https://example.com/form" },
  "tree": {
    "component": "Stack",
    "cssClass": "usa-form",
    "children": [
      {
        "component": "TextInput",
        "bind": "name",
        "cssClass": "usa-input"
      },
      {
        "component": "Alert",
        "severity": "info",
        "text": "Complete all fields.",
        "cssClass": "usa-alert usa-alert--info"
      }
    ]
  }
}
```

### Resulting DOM (Web Renderer)

```html
<div class="formspec-container"
     style="--formspec-color-primary: #005ea2;
            --formspec-color-error: #b50909;
            --formspec-spacing-md: 1rem;">
  <div class="formspec-stack usa-form">
    <div class="formspec-field usa-form-group">
      <label class="formspec-label usa-label">Full Name</label>
      <input class="formspec-input usa-input" type="text" />
    </div>
    <div class="formspec-alert formspec-alert--info usa-alert usa-alert--info">
      Complete all fields.
    </div>
  </div>
</div>
```

Note the dual class pattern: `formspec-*` classes are renderer-generated (the stable contract), `usa-*` classes come from `cssClass` declarations (author-specified). Both coexist.

## 7. What This Does NOT Change

- **Token resolution** — `$token.X` lookup and cascade are unchanged.
- **`style` property** — inline style maps work exactly as before.
- **Component catalog** — no new components, no changed props.
- **Schema strictness** — all new properties are optional.
- **Non-web renderers** — explicitly allowed to ignore CSS-specific features.
- **The spec's design-system-agnostic stance** — Formspec doesn't endorse or require any CSS framework. It provides hooks that work with any of them.

## 8. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `cssClass` enables XSS via class injection | Low | Class names are applied as DOM classes, not as HTML. Renderers should sanitize (no whitespace injection, no `"` escaping). |
| `stylesheets` enables loading arbitrary remote CSS | Medium | Renderers SHOULD respect CSP and CORS. Spec should note that `stylesheets` URLs are subject to the host application's security policy. |
| `cssClass` merge semantics differ from other PresentationBlock properties | Low | Clearly documented as the exception. Classes are inherently additive; replace semantics would be surprising. |
| Adds complexity to the spec | Low | Four optional properties and one prose section. No new data model concepts. |

## 9. Open Questions

- Should `cssClass` support `$token.` references (e.g., `"cssClass": "$token.input-class"`)? This enables theme-driven class assignment but adds resolution complexity. Recommendation: yes, for consistency with other token-able properties.
- Should `stylesheets` support relative URIs (relative to the theme document's `url`)? Recommendation: yes, following standard URI resolution rules.
- Should there be a `cssClass` property on `Region` objects in the theme page layout? Probably not in v1.0 — regions are structural, not visual.

## 10. References

- Component spec §3.1: Component Object Base Properties
- Component spec §10: Theming and Design Tokens
- Theme spec §3: Design Tokens
- Theme spec §5: Selector Cascade
- Theme schema: `schemas/theme.schema.json`
- Component schema: `schemas/component.schema.json`
- USWDS design tokens: https://designsystem.digital.gov/design-tokens/
- CSS Custom Properties: https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties
