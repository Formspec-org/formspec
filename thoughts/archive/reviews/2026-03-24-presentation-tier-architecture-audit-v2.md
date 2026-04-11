# Presentation Tier Architecture Audit — v2

## Revision history

- **v1** (2026-03-23): Initial audit. Nine findings, decision matrix, target model.
- **v2** (2026-03-24): Comprehensive rewrite. All v1 assumptions validated against normative spec text and codebase by dedicated spec-expert and codebase-scout agents. Findings corrected, reordered by operational dependency, and expanded from 9 to 16. Three findings added from spec/code validation (core spec internal contradiction, cascade implementation disagreement, compatibility matrix structural disconnection). Five findings added from greenfield gap analysis (declarative lifecycle model, validation display through tiers, cross-document validation contract, presentation document composition, custom component contracts). Two proposed gaps validated as non-gaps (relevant/when interaction, token resolution depth). Effort estimates and codebase current-state sections added throughout. v1 is superseded; this document is the authoritative reference.

---

## Bottom line

The three-tier presentation architecture (Definition, Theme, Component) segments real user needs correctly. The sidecar split is the right design — Theme augments the Definition's item tree via cascade; Component builds a parallel UI tree that replaces it. Merging them would lose the ability to swap themes independently of component trees.

The contracts between tiers are not sound, and the spec stops short at two critical boundaries:

**Static architecture:** The core spec contradicts itself on key uniqueness. The component compatibility matrix uses a dataType that does not exist. Two cascade implementations produce different results. Vocabularies drift between tiers. Schemas are coupled in the wrong direction.

**Dynamic behavior:** The spec rigorously defines how validation results are produced, structured, and reported — then provides a single sentence for how they are displayed: "display adjacent." The spec defines a four-phase processing model — then provides no lifecycle contract for when navigation, submission, or validation events fire. The spec defines sidecar documents that target specific Definitions — then provides no contract for what happens when the Definition evolves.

**Ecosystem readiness:** Presentation documents are monolithic. Themes cannot extend themes. Component fragments cannot be shared across documents. Custom components are macro expansion with no metadata contract.

The recommendation: keep the three-tier model. Fix the 3 internal contradictions. Align vocabularies. Decouple schemas. Define behavioral ownership (coverage, navigation, lifecycle, validation display). Then build the scaling infrastructure (composition, cross-document validation, custom component contracts). This v2 orders the work by operational dependency so each fix unblocks the next.

---

## What real users are actually trying to do

### 1. Definition-only mode

Who uses it: standards authors, backend teams, teams validating or exchanging forms across systems.

Problem being solved: describe the questionnaire and its logic once, render it anywhere, preserve data semantics independently of UI.

What they need: stable keys, data types, binds and validation, enough rendering hints for a usable null renderer.

What they do not need: branded layout systems, explicit page choreography, app-specific component trees.

### 2. Definition + Theme mode

Who uses it: design-system teams, platform teams serving many forms, agencies needing web/mobile/pdf variations from the same definition.

Problem being solved: avoid hand-authoring a component tree for every form, apply consistent widget policy, spacing, tokens, and generic layout, let business authors keep owning the form content while design teams own the visual policy.

What they need: strong selectors, tokens, widget policy and fallbacks, a generic page/grid model, **theme inheritance** so a base theme can be extended per form or per agency.

What they do not need: per-screen bespoke interaction trees, product-specific flow logic embedded in the data model.

### 3. Definition + Component mode

Who uses it: product teams building a guided wizard, intake journey, kiosk flow, or highly curated review/summary experience.

Problem being solved: generic renderer output is not enough, the form experience is part of the product, some fields appear multiple times as summaries, review data, help panels, modals, or progressive disclosure.

What they need: explicit composition, reusable templates, custom layout, conditional rendering, strong control over progression and review screens, **lifecycle control** over when validation fires and how submission works.

What they do not need: a surprise fallback renderer appending extra required fields after the custom experience.

### 4. Embedding applications

Who uses it: application developers embedding `<formspec-render>` into their product.

Problem being solved: the form is a component inside a larger application. The application needs to react to form events, show loading states, auto-save progress, block navigation when dirty, trigger server-side validation, and control submission flow.

What they need: a typed event API, lifecycle hooks, dirty-state signals, programmatic validation triggers, submission protocol.

What they do not need: to poll engine state or reach into webcomponent internals.

---

## What is working

- **Sidecar architecture.** Theme and Component documents are separate from the Definition. This preserves portability — the Definition remains the single behavioral source of truth. Validation confirmed this is the right design: Theme augments via cascade, Component replaces via tree. These are genuinely different paradigms serving different audiences; merging them would force everyone into the more complex model.
- **Behavioral truth stays in the Definition.** Presentation tiers never override `required`, `relevant`, `readonly`, `constraint`, or `calculate`. See [`component-spec.md` lines 2856-2858](/specs/component/component-spec.md#L2856).
- **Token inheritance.** Component Documents inherit Theme tokens and override selectively. See [`component-spec.md` lines 2854-2855](/specs/component/component-spec.md#L2854).
- **Null-theme rendering.** A Definition is renderable without any presentation sidecar. Core `formPresentation` and item-level `presentation` hints enable this.
- **`widget-vocabulary.ts` already exists.** The codebase has a canonical widget-to-component mapping at [`packages/formspec-types/src/widget-vocabulary.ts`](/packages/formspec-types/src/widget-vocabulary.ts). It contains `SPEC_WIDGET_TO_COMPONENT` (37 entries), `COMPONENT_TO_HINT` (reverse map), `COMPATIBILITY_MATRIX` (dataType to component list), and `widgetTokenToComponent()`. v1 missed this entirely; the widget/control vocabulary problem is already partially solved.
- **Theme exhaustive-pages alternative.** The theme spec already provides an opt-out from surprise-append behavior for unassigned items: "a renderer MAY hide unassigned items if the theme's pages are treated as exhaustive." See [`theme-spec.md` lines 756-759](/specs/theme/theme-spec.md#L756). v1 did not acknowledge this.
- **`relevant` and `when` interaction is fully specified.** Component spec S8.2 explicitly addresses the interaction between Core's `relevant` (data-model visibility) and Component's `when` (presentation-only visibility). `relevant=false` always wins. `when=false` hides but preserves data. The spec calls this "the most common source of confusion" and provides a normative interaction table. This is a non-gap; only a cross-reference from core S5.6 to component S8.2 would improve discoverability.
- **Token system is deliberately simple and correct.** Both specs explicitly forbid token-to-token references (MUST NOT), restrict values to strings/numbers, and resolve at theme-application time. No circular reference risk. CSS custom properties handle computation natively. This is the right design for a cross-platform spec.
- **Partial cross-document validation already exists in the linter.** The Rust linter has W705-W707 (theme item/page/region keys validated against definition) and E802-E803 (component bind references validated against definition items). Static staleness detection at authoring time works. What is missing is runtime validation and version-aware compatibility checking.
- **Three-level custom component system.** The webcomponent provides: (1) schema-level templates with `{param}` interpolation expanded by the planner, (2) `ComponentRegistry` plugins with full `RenderContext` access, (3) `RenderAdapter` system for design-system-level re-skinning. The Tailwind and USWDS adapters demonstrate the system works for real design systems.

---

## Findings — ordered by operational dependency

Findings are organized into five phases. Each phase's resolutions unblock the next phase. Within a phase, findings are independent and can be addressed in parallel.

---

### Phase 0: Internal contradictions

These are bugs in the spec or codebase that must be fixed before any cross-tier alignment work can proceed. They affect the meaning of foundational concepts.

---

#### Finding 1: Core spec contradicts itself on key uniqueness

**Status:** New finding (discovered during v1 validation).

The core spec contains two contradictory normative statements about item key uniqueness:

- Section 2.1.3 (line 294): "a stable, machine-readable identifier that is **unique among its siblings**"
- Section 4.2.1 (line 1925): "MUST be **unique across the entire Definition** (not merely among siblings)"

These cannot both be true. The formal property table at 4.2.1 uses normative MUST language and explicitly negates the weaker claim, suggesting it was written later as a deliberate tightening. But the conceptual model at 2.1.3 was never updated to match.

Why this matters first: the bind addressing model (Finding 7) depends entirely on which uniqueness guarantee holds. If keys are only sibling-unique, dotted qualified paths (`applicantInfo.orgName`) are necessary for disambiguation. If keys are globally unique, dotted paths add complexity without clear benefit. Every downstream decision about component binding, theme selectors, and reference resolution branches on this.

Product judgment: Global uniqueness is the stronger, more useful guarantee. It simplifies binding, enables flat key lookups, and eliminates ambiguity. But the spec must say one thing, not two.

Recommendation:

- Fix section 2.1.3 to match 4.2.1 (globally unique).
- Add a non-normative note explaining the design rationale: global uniqueness was chosen to enable flat-key binding and unambiguous field references.
- Or, if fragment reuse (address blocks, contact sections used in multiple contexts) is a strategic requirement, choose sibling-unique and justify the scoped addressing model that follows. This is the harder path with more consequences.

Effort: Low (spec edit). Risk: Low. Dependency: Blocks Finding 7.

---

#### Finding 2: Component compatibility matrix uses a non-existent dataType

**Status:** Confirmed from v1, severity upgraded.

The component spec's compatibility matrix at [`component-spec.md` lines 610-621](/specs/component/component-spec.md#L610) uses `number` as a dataType:

| Component spec says | Definition schema says |
|---|---|
| `number` | (does not exist) |
| (missing) | `decimal` |
| (missing) | `text` |
| (missing) | `uri` |
| (missing) | `money` |

This is not prose drift. It is a structural disconnection: a `decimal` field in a Definition matches zero entries in the component compatibility table. The component spec's appendix matrix at lines 3322-3333 repeats the same error — `number` appears as a dataType throughout, and `text`, `decimal`, `uri`, and `money` are all absent.

The component schema's `x-lm.compatibleDataTypes` metadata mirrors this error:

- `NumberInput` line 542: `["integer", "number"]` — should be `["integer", "decimal"]`
- `Slider` line 1068: `["integer", "number"]` — should be `["integer", "decimal"]`

Additionally, `MoneyInput` has a spec-vs-schema contradiction within the component tier itself:

- Component spec line 1686: `Compatible dataTypes: number, integer`
- Component schema line 1038: `compatibleDataTypes: ["money"]`

The schema is correct; the spec prose is wrong. `MoneyInput` exists specifically for the `money` dataType.

The `Rating` component has a self-contradiction:

- Schema line 1096: `compatibleDataTypes: ["integer"]`
- Schema line 1109: `allowHalf: "Whether half-values are allowed (stored as decimal, e.g. 3.5)."`

An integer field cannot store 3.5. Either `allowHalf` is removed, or Rating must support `decimal`.

Why this matters first: the compatibility matrix is the contract between Definition items and Component bindings. If the matrix uses the wrong vocabulary, tooling that validates bindings (linters, editors, LLM assistants) will produce wrong results. Every downstream discussion about "which components work with which fields" is built on this table.

Current state: `widget-vocabulary.ts` already has the correct vocabulary — its `COMPATIBILITY_MATRIX` uses `decimal`, `text`, `uri`, and `money` correctly. The TypeScript codebase is ahead of the spec. No sync test exists to enforce this.

Recommendation:

1. Fix the component spec compatibility table (lines 610-621): replace `number` with `decimal`, add rows for `text`, `uri`, and `money`.
2. Fix the component spec appendix matrix (lines 3322-3333): same corrections.
3. Fix `MoneyInput` spec prose (line 1686): `number, integer` → `money`.
4. Fix `NumberInput` and `Slider` schema `compatibleDataTypes`: `["integer", "number"]` → `["integer", "decimal"]`.
5. Decide on `Rating.allowHalf`: remove it (simplest) or change `compatibleDataTypes` to `["integer", "decimal"]`.
6. Add a schema-sync test that verifies `COMPATIBILITY_MATRIX` keys match `definition.schema.json`'s `dataType` enum.

Effort: Low (spec/schema edits + one test). Risk: None — no runtime code uses the `x-lm` annotations for validation. Dependency: Unblocks Finding 4 (canonical vocabulary).

---

#### Finding 3: Two cascade implementations produce different merge behavior

**Status:** New finding (discovered during v1 validation). Partially corrects v1 Finding 9.

The spec says cascade merge is shallow — nested objects like `style`, `widgetConfig`, and `accessibility` are "replaced as a whole, not deep-merged." See [`theme-spec.md` lines 592-596](/specs/theme/theme-spec.md#L592) and [`theme.schema.json` PresentationBlock description at line 283](/schemas/theme.schema.json#L283).

Two implementations exist in the codebase. They disagree:

**`formspec-core/src/theme-cascade.ts`** (used by studio-core authoring tools): Purely shallow. Each property at any level overwrites. No special handling of nested objects. Matches the spec.

**`formspec-layout/src/theme-resolver.ts`** (used by the renderer): One-level deep merge for `style`, `widgetConfig`, and `accessibility`:

```typescript
// theme-resolver.ts line 282-283
if (higher.style !== undefined) {
    merged.style = { ...merged.style, ...higher.style };
}
```

This means:
- In the authoring cascade (studio-core): setting `style.background` at a selector level replaces the entire `style` object, losing `style.borderRadius` from defaults.
- In the rendering cascade (layout): setting `style.background` preserves `style.borderRadius` from lower levels.

The rendering implementation is more intuitive for authors and matches how CSS cascade works. But it contradicts the normative spec.

Additionally, responsive overrides (`formspec-layout/src/responsive.ts` line 17) are truly shallow — `{ ...comp, ...overrides }` — which means `style` in a responsive override replaces the entire `style` block. This is the one place where the v1 concern about shallow-merge footguns is fully valid.

Why this matters first: if two implementations of the same algorithm produce different results, every test and every behavior built on top is unreliable. The cascade is the core mechanism for both Theme and Component presentation resolution. It is also the foundation for the validation display cascade proposed in Finding 12.

Recommendation:

1. Decide: deep-merge is the right default for `style`, `widgetConfig`, and `accessibility`. Authors expect additive behavior for nested style objects. The renderer implementation is correct; the spec is wrong.
2. Update the spec to document one-level deep merge for these three properties. Keep `cssClass` union semantics (already correct). All other properties remain shallow-replace.
3. Align `formspec-core/theme-cascade.ts` to match the renderer's behavior.
4. Fix `responsive.ts` to apply the same merge semantics for `style`, `widgetConfig`, and `accessibility` within responsive overrides.
5. Add an explicit `$replace: true` escape hatch (or equivalent) for cases where full replacement is intended.

Effort: Medium. The spec change is small, but aligning three merge sites and adding tests is real work. Risk: Behavioral change in authoring tools (studio-core). Dependency: Independent of other Phase 0 work. Blocks Finding 12 (validation display through the cascade).

---

### Phase 1: Canonical vocabularies

Once internal contradictions are resolved, the next bottleneck is vocabulary drift between tiers. Every cross-tier reference (bind validation, widget assignment, selector matching, compatibility checks) depends on shared terminology.

---

#### Finding 4: Presentation tiers have no canonical dataType registry

**Status:** Confirmed from v1, reframed.

v1 said "the architecture has no single generated vocabulary source." That was partially wrong — `widget-vocabulary.ts` already exists as the canonical source for widget/component mappings. What is actually missing is a canonical **dataType** registry that is enforced across schemas.

The definition schema (`definition.schema.json` line 557) defines 13 dataTypes. The theme schema (`theme.schema.json` SelectorMatch at line 473) correctly uses the same 13. The component schema's `x-lm.compatibleDataTypes` uses `number` instead of `decimal` (see Finding 2). The component spec's prose compatibility tables omit `text`, `uri`, `decimal`, and `money`.

The `COMPATIBILITY_MATRIX` in `widget-vocabulary.ts` (lines 100-114) already uses the correct 13 dataTypes. It is the TypeScript source of truth. But nothing enforces that these constants stay synchronized with the schema enum.

Recommendation:

1. After fixing Finding 2, add a conformance test that reads `definition.schema.json`'s `dataType` enum and verifies every key in `COMPATIBILITY_MATRIX` matches.
2. Add a similar test for the theme schema's `SelectorMatch.dataType` enum.
3. Consider generating the `x-lm.compatibleDataTypes` values in component.schema.json from `widget-vocabulary.ts` as part of the build, rather than maintaining them by hand.

Effort: Low. Risk: None. Dependency: Finding 2 must be fixed first.

---

#### Finding 5: Theme and Component use different control names for the same concepts

**Status:** Confirmed from v1, partially mitigated by existing code.

Theme/Core Tier 1 speaks in camelCase widget hints: `dropdown`, `radio`, `checkboxGroup`, `datePicker`. See [`spec.md` lines 2082-2096](/specs/core/spec.md#L2082).

Component Tier 3 speaks in PascalCase component names: `Select`, `RadioGroup`, `CheckboxGroup`, `DatePicker`. See component spec sections 5-6.

Some of this is genuine semantic drift:

- `dropdown` → `Select` (different concept name)
- `radio` → `RadioGroup` (singular vs plural)
- `checkbox` → `Toggle` (different control entirely)

Some is just casing convention:

- `datePicker` → `DatePicker`
- `checkboxGroup` → `CheckboxGroup`
- `moneyInput` → `MoneyInput`

The split may be intentional by design: Theme expresses abstract widget policy ("use a dropdown"), Component expresses concrete UI ("render a Select node"). But the relationship between vocabularies must be explicit either way.

Current state: `widget-vocabulary.ts` already solves this. `SPEC_WIDGET_TO_COMPONENT` maps every Tier 1 widget hint to its Tier 3 component name (37 entries). `COMPONENT_TO_HINT` maps each component back to its canonical widget hint. `widgetTokenToComponent()` handles normalization, backwards-compatible lookup, and extension prefixes (`x-`).

What remains:

- The spec documents do not reference this canonical map. The Theme spec and Component spec describe their vocabularies independently with no cross-reference.
- The alias map is not generated from or verified against the schema. It is hand-maintained.

Recommendation:

1. Add a normative cross-reference table to both specs linking Theme widget names to Component type names.
2. Add a conformance test verifying that every component type in `component.schema.json` has a corresponding entry in `SPEC_WIDGET_TO_COMPONENT` or `KNOWN_COMPONENT_TYPES`.
3. Document the design intent: Theme uses abstract policy vocabulary, Component uses concrete type names, and the canonical mapping is the bridge.

Effort: Low. Risk: None. Dependency: Independent within Phase 1.

---

### Phase 2: Structural decoupling

With vocabularies aligned, the next bottleneck is structural coupling between tiers. Two issues prevent Theme and Component from evolving independently.

---

#### Finding 6: Theme schema depends on Component schema for shared types

**Status:** Confirmed from v1.

The theme schema (`theme.schema.json` `$defs` at lines 273-278, 408, 655) contains four `$ref` imports pointing to the component schema:

```json
"TargetDefinition": { "$ref": "https://formspec.org/schemas/component/1.0#/$defs/TargetDefinition" }
"Tokens":           { "$ref": "https://formspec.org/schemas/component/1.0#/$defs/Tokens" }
"AccessibilityBlock": { "$ref": "https://formspec.org/schemas/component/1.0#/$defs/AccessibilityBlock" }
"Breakpoints":      { "$ref": "https://formspec.org/schemas/component/1.0#/$defs/Breakpoints" }
```

These are literal JSON Schema `$ref` imports. The theme schema cannot validate without resolving the component schema. This is a build-time/schema-publishing coupling, not a runtime dependency — a Theme document does not require a Component document to function. But it means:

- The theme schema cannot be published, versioned, or validated independently of the component schema.
- Any change to these four types in the component schema implicitly changes the theme schema's contract.
- The type generator (`generate-types.mjs`) handles this correctly by inlining, but the schema-level dependency is still wrong.

Additionally, `formspec-layout/src/theme-resolver.ts` (lines 32-111) redeclares its own copies of `AccessibilityBlock`, `PresentationBlock`, `SelectorMatch`, `ThemeDocument`, and `Breakpoints` rather than importing from `formspec-types`. This is a smaller but related problem — a package defining its own versions of canonical types.

Recommendation:

1. Create `schemas/presentation-common.schema.json` containing `TargetDefinition`, `Tokens`, `AccessibilityBlock`, and `Breakpoints`.
2. Update both `theme.schema.json` and `component.schema.json` to `$ref` the common schema instead.
3. Add the common schema to `generate-types.mjs`'s `SCHEMA_SOURCES` and `URI_TO_LOCAL` mappings.
4. Follow up: migrate `formspec-layout/theme-resolver.ts` to import from `formspec-types` instead of redeclaring types.

Effort: Medium. Create one new schema file, update 4 `$ref`s in theme, move 4 `$defs` from component, update the type generator, verify tests. Risk: Low — no behavioral change. Dependency: Independent of Phase 1 vocabulary work. Blocks nothing directly but unblocks independent schema versioning.

---

#### Finding 7: The bind addressing model is internally contradictory

**Status:** Confirmed from v1, strengthened by Finding 1.

The component spec at [`component-spec.md` lines 480-496](/specs/component/component-spec.md#L480) says `bind` accepts two forms:

1. Flat key: `"projectName"`
2. Dotted qualified path: `"applicantInfo.orgName"`

The component schema descriptions at [`component.schema.json` lines 499-502, 546](/schemas/component.schema.json#L499) say only: "Item key from the target Definition." No mention of dotted paths.

The component spec's own reference map entry for section 4.1 says `bind` is a "flat item key string (not a path, pointer, or FEL expression)" — contradicting the actual normative text it summarizes.

If Finding 1 is resolved in favor of global key uniqueness (the recommended path), then dotted paths add a second addressing mode without a proven user need. Every renderer, linter, and binding validator must support both forms forever.

If Finding 1 is resolved in favor of sibling-only uniqueness, then dotted paths become necessary, and the flat key form becomes ambiguous for nested items.

Recommendation:

1. Resolve Finding 1 first. The bind addressing decision follows directly.
2. If globally unique keys: remove dotted path support from the component spec. Align the schema descriptions. Simplify all binding resolution to flat key lookup.
3. If sibling-unique keys: make dotted paths the canonical form. Define resolution rules (leftmost-match? longest-match?). Update all examples and helpers.
4. Either way: write an ADR documenting the decision and its consequences for fragment reuse, tooling, and migration.

Effort: Low for the ADR and spec edit. Medium if dotted path code exists that must be removed or canonicalized. Risk: Low if flat keys are chosen (current examples already use flat keys). Dependency: Blocked by Finding 1. Blocks nothing directly but clarifies the mental model for all component binding work.

---

### Phase 3: Ownership and dynamic behavior

With vocabularies aligned and schemas decoupled, the next class of problems is unclear ownership: which tier is responsible for which concern — including the dynamic behavioral concerns the spec currently leaves to implementations.

---

#### Finding 8: Partial component trees produce implicit fallback behavior

**Status:** Confirmed from v1. Severity confirmed for Component tier, softened for Theme tier.

The component spec at [`component-spec.md` lines 581-602](/specs/component/component-spec.md#L581) establishes this behavior:

- A Component Document is NOT required to bind every Definition item (line 583).
- For unbound **required** items: the renderer **MUST** render a fallback input, appended **after** the component tree, in Definition document order (lines 589-595).
- For unbound **non-required** items: the renderer **MAY** omit them entirely (line 599).
- For unbound **relevant** non-required items: the renderer **SHOULD** render them using fallback rules (lines 600-602).

This creates the "surprise append" problem: a product team builds a carefully choreographed intake wizard, and a required field they forgot to bind appears as a generic input tacked onto the end.

For the Theme tier, the behavior is softer. [`theme-spec.md` lines 756-759](/specs/theme/theme-spec.md#L756): "Items not referenced by any region on any page SHOULD be rendered after all pages, using the default top-to-bottom order. Alternatively, a renderer MAY hide unassigned items if the theme's pages are treated as exhaustive." The SHOULD + MAY-hide-if-exhaustive gives Theme more flexibility than Component's MUST-append.

Current state: No `coverageMode` property or equivalent exists in the component schema. No unbound-item detection logic exists in the webcomponent renderer. No test fixtures demonstrate partial component trees. Building this feature requires:

1. Schema addition (trivial)
2. Unbound-item detection in the renderer (non-trivial — must walk the component tree, collect all `bind` values, and cross-reference against definition items)
3. Fallback zone placement if explicit hybrid mode is supported (significant design surface)

Recommendation:

1. Add `coverageMode` to the ComponentDocument schema:
   ```json
   "coverageMode": {
     "type": "string",
     "enum": ["full", "partial"],
     "default": "partial",
     "description": "Whether this Component Document binds all items (full) or a subset (partial). In full mode, unbound items are NOT rendered. In partial mode, unbound required items get fallback rendering."
   }
   ```
2. In `full` mode: the renderer renders only what the tree declares. No fallback. If a required field is unbound, that is a validation error at authoring time, not a renderer concern.
3. In `partial` mode: keep the current fallback behavior, but require explicit **fallback zones** — slot-like placements in the tree that say "render remaining fields here" — rather than appending after the tree. This makes hybrid behavior intentional.
4. Consider making `full` the default for new Component Documents. Teams choosing Component mode are choosing to own the experience. `partial` should be the opt-in for incremental adoption.
5. Write an ADR capturing the design decision and its interaction with Theme-tier exhaustive-pages.

Effort: High. Schema change is trivial, but the renderer infrastructure for unbound-item detection and fallback zones is a new feature. Dependency: Independent of Phase 1/2 work. Can be designed (ADR) now and implemented later.

---

#### Finding 9: Navigation concepts are duplicated across all three tiers

**Status:** Confirmed from v1, reframed.

Four mechanisms express "how the user moves through the form":

| Tier | Mechanism | Nature |
|------|-----------|--------|
| Tier 1 (Core) | `formPresentation.pageMode` (`single`/`wizard`/`tabs`) | Advisory hint. Spec explicitly says "MAY ignore." [`spec.md` lines 1877-1882](/specs/core/spec.md#L1877). |
| Tier 1 (Core) | `presentation.layout.page` on groups | Named step/tab label. "Only meaningful when `pageMode` is not `single`." [`spec.md` line 2114](/specs/core/spec.md#L2114). |
| Tier 2 (Theme) | `pages[]` with regions and 12-column grid | Structural page layout for generic renderers. [`theme-spec.md` lines 673-704](/specs/theme/theme-spec.md#L673). |
| Tier 3 (Component) | `Page`, `Wizard`, `Tabs` components | Explicit UI nodes with full navigation control. |

The overlap is real but less redundant than v1 suggested. Each mechanism serves a different persona and abstraction level:

- Tier 1: enables null-theme rendering. Without `pageMode`, a Definition-only renderer cannot produce multi-page output. All five existing examples use `pageMode: "wizard"`.
- Tier 2: enables generic page grouping with grid layout. Design-system teams apply this across form portfolios.
- Tier 3: enables explicit product-level navigation choreography. Product teams build curated experiences.

The actual problem is not the overlap per se but the **lack of explicit interaction rules** when multiple tiers are active. The component spec says "Tier 3 > Tier 2 > Tier 1" at [`component-spec.md` lines 2836-2858](/specs/component/component-spec.md#L2836) and adds "Tier 3 component tree completely replaces Tier 2 page layout for bound items" (line 2852). But it does not spell out:

- What happens to Tier 2 pages when Tier 3 owns some but not all items?
- Whether Tier 1 `pageMode` is ignored entirely when a Theme is present, or only for themed items.
- How a Wizard component interacts with Theme `pages[]` for unbound items falling through to fallback.

Recommendation:

1. **Do not remove Tier 1 navigation.** It is the null-theme rendering baseline and is explicitly advisory. Removing it breaks all existing examples and degrades Definition-only rendering.
2. **Document explicit interaction rules** in a cross-tier navigation section of the component spec:
   - When a Component Document is present and defines navigation (Wizard, Tabs, Pages): Component owns navigation for all items it binds. Theme `pages[]` applies only to fallback items. Tier 1 `pageMode` is ignored.
   - When only a Theme Document is present: Theme `pages[]` owns navigation. Tier 1 `pageMode` is ignored if Theme defines pages.
   - When neither is present: Tier 1 `pageMode` and `layout.page` are the only navigation source.
3. **Add conformance tests** verifying these precedence rules.
4. **Write an ADR** if and when Tier 1 navigation should be contracted further. Do not delete concepts before the interaction rules are settled.

Effort: Low for documentation and tests. Medium for a potential future contraction. Dependency: Partially depends on Finding 8 (coverageMode affects how fallback items interact with navigation). The interaction rules can be documented now regardless.

---

#### Finding 10: Accessibility metadata is fragmented across tiers

**Status:** Confirmed from v1.

Core has `presentation.accessibility` for item-level semantic metadata. See [`spec.md` lines 2126-2149](/specs/core/spec.md#L2126).

Theme has `PresentationBlock.accessibility` for cascade-resolved renderer overrides. See [`theme.schema.json` lines 331-380](/schemas/theme.schema.json#L331).

Component has `accessibility` (AccessibilityBlock) on every component object. See [`component-spec.md` lines 337-385](/specs/component/component-spec.md#L337).

The split is defensible for style (semantic intent → policy → instance). It is weaker for accessibility properties like `role` and `liveRegion`, which are both authored intent and renderer behavior depending on context.

The current boundary is:

- Core: durable cross-platform metadata (descriptions, labels, hints, semantic annotations that make sense on any renderer).
- Theme/Component: renderer-specific behavior (ARIA roles, live-region policies, focus management that only make sense in specific rendering contexts).

The problem is that this boundary is implicit. Nothing in the spec says which accessibility properties belong at which tier.

Recommendation:

1. Do not move accessibility properties between tiers yet.
2. Document which properties are "durable author intent" (appropriate for Core: `accessibleDescription`, `accessibleName`, `semanticRole`) versus "renderer-specific behavior" (appropriate for Theme/Component: `role`, `liveRegion`, `tabIndex`).
3. Add this classification to the AccessibilityBlock definition in the common presentation schema (after Finding 6 extracts it).
4. Consider staged narrowing of Core `presentation.accessibility` in a future version, after the classification is validated against real usage.

Effort: Low for documentation. Medium for eventual narrowing. Dependency: Benefits from Finding 6 (shared primitives extraction). Can be documented independently.

---

#### Finding 11: No declarative lifecycle model

**Status:** New finding (greenfield gap analysis). The largest real gap in the presentation tier.

The spec rigorously defines a four-phase processing model (Rebuild, Recalculate, Revalidate, Notify — core spec S2.4). It defines three validation modes (continuous, deferred, off — core spec S5.5). It defines Wizard with normative validation-on-navigate behavior (component spec S5.4: "MUST validate the current Page's bound items before allowing forward navigation unless `allowSkip` is `true`").

But there is no general lifecycle contract. The spec has a blind spot between "no imperative scripts" (correctly excluded at component spec S13.1) and "no behavioral specification at all."

What is unspecified:

- **Navigation events.** What triggers validation on page transition in non-Wizard contexts (Theme page layout, Tabs)? The Wizard rule is specific to Wizard; Theme pages and Component Tabs have no equivalent.
- **Submission protocol.** What happens between "user clicks submit" and "Response is created"? Is there a normative sequence (switch to continuous validation → full revalidate → check valid flag → construct Response)? Currently this is left entirely to implementations.
- **Validation timing.** When does validation fire beyond the three modes? On field blur? On page leave? On submit? On demand? The spec mentions "continuous-soft" informatively but does not define it. There is no way for a form author to declare validation timing at the form, page, or field level.
- **Progressive disclosure interaction.** When a ConditionalGroup becomes visible (due to `when` changing to true), are newly-visible fields validated immediately or deferred?
- **Dirty state.** No concept of "the form has unsaved changes." Embedding applications cannot determine whether to block navigation.

Current state: The webcomponent emits ~10 ad-hoc Custom Events (`formspec-submit`, `formspec-page-change`, `formspec-screener-route`, `formspec-screener-state-change`, `formspec-signature-drawn`, `formspec-files-dropped`, etc.) but these are implementation artifacts, not a designed API. There is no `formspec:ready`, no `formspec:value-change`, no `formspec:validation-change`, no `formspec:dirty-change`. The `FormEngine` has no lifecycle hooks. Embedding applications cannot observe form state changes without polling.

Product judgment: This is the gap that embedding applications will hit first. Every app that uses `<formspec-render>` needs to know when the form is ready, when values change, when validation state changes, and when submission completes. Without a spec-level lifecycle, every renderer will answer these questions differently, breaking the portability promise.

Recommendation:

The spec needs a **Declarative Lifecycle Model** — not imperative handlers, but declarative configuration that controls when things happen:

1. **Navigation triggers as declarative properties on Page/Wizard/Tabs:**
   ```json
   {
     "component": "Page",
     "title": "Applicant Info",
     "onLeave": { "validate": "bound-items" },
     "onEnter": { "validate": "none" }
   }
   ```
   This is still declarative data, not scripting. It declares what happens, not how.

2. **Normative submission protocol** in the core spec:
   - Switch to continuous validation mode
   - Run full revalidation cycle
   - Check `valid` flag on ValidationReport
   - If valid: construct Response with status `completed`
   - If invalid: report results to presentation tier
   Implementations currently improvise this sequence; the spec should define it.

3. **Validation trigger taxonomy** declarable at form, page, and field levels:
   ```json
   "validationTrigger": "blur" | "immediate" | "navigate" | "submit"
   ```
   - `blur`: validate on field exit (default for most fields)
   - `immediate`: validate on every keystroke (continuous)
   - `navigate`: validate on page leave only
   - `submit`: validate only on explicit submit

4. **Typed event contract** for the webcomponent:
   ```
   formspec:ready          — engine booted, form rendered
   formspec:value-change   — { path, value, previousValue }
   formspec:validation-change — { path, errors[] }
   formspec:page-change    — { fromIndex, toIndex, pageName }
   formspec:submit         — { response, validationReport, mode }
   formspec:dirty-change   — { dirty: boolean }
   formspec:field-focus     — { path }
   ```
   These bubble to the `<formspec-render>` element. Embedding apps listen on the host element.

5. **Engine-level hooks** for non-DOM consumers:
   ```
   engine.on('valueChange', (path, value) => { ... })
   engine.on('validationChange', (report) => { ... })
   ```

Effort: High. This is new spec surface (lifecycle properties on navigation components, submission protocol, validation triggers) plus implementation (typed events, engine hooks). Risk: Medium — lifecycle semantics are hard to get right and hard to change later. Dependency: Benefits from Finding 9 (navigation ownership) being settled first, since navigation events depend on knowing which tier owns navigation.

---

#### Finding 12: Validation display has no presentation contract

**Status:** New finding (greenfield gap analysis). The most user-visible gap.

The spec defines validation thoroughly on the data side: `ValidationReport` contains `ValidationResult` entries with `path`, `severity` (error/warning/info), `message`, `code`, and `constraintKind`. Core spec S5.3-5.4 cover the report structure. The component spec adds one rendering rule at S4.2: "Validation errors for the bound key MUST be displayed adjacent to this component."

That single sentence — "display adjacent" — is the entire presentation contract for validation. The spec does not address:

- **What "adjacent" means.** Inline below the field? Tooltip? Sidebar? The renderer decides, and different renderers will decide differently.
- **Theme control over error styling.** The theme cascade's `PresentationBlock` has no error-specific properties. Error display uses hardcoded CSS classes (`formspec-error`, `formspec-field--readonly`, `formspec-required`). A Theme cannot say "show errors below the field" vs "show errors as tooltips" vs "show errors with a red border only."
- **Component control over error placement.** The component tree cannot specify where error messages appear for a specific field. They are always rendered as a child of the field wrapper.
- **Severity-based styling.** Error, warning, and info results all render identically at the field level. No visual distinction between severity levels. The existing `ValidationSummary` component separates them, but inline display does not.
- **Group-level and form-level errors.** Shape (cross-field) validation errors and cardinality errors (min/max repeat count violations) have no guaranteed display location. They exist in the ValidationReport but may not be rendered.

Current state: The webcomponent renders errors via `bindSharedFieldEffects` in `packages/formspec-webcomponent/src/behaviors/shared.ts` (lines 58-146). Errors are touch-gated (shown only after field interaction or submit). Each field has an `error` ref element. The `onValidationChange` callback in `FieldRefs` (line 32 in `behaviors/types.ts`) is the existing seam — the Tailwind adapter already uses it to toggle error classes. But error DOM construction is hardcoded in the behavior hook, not delegable to adapters or controllable via the component tree.

Product judgment: Validation display is the most user-visible quality signal of any form. USWDS has specific error display patterns (error text + red border + error icon). Material has different patterns. Every design system has opinions about error presentation. The current implementation works for the default adapter but cannot be customized without forking the behavior hook.

Recommendation:

A **three-tier validation display model** that mirrors the existing three-tier pattern for everything else:

1. **Core: `validationPresentation` on Shapes.** Shapes already have `severity`, `message`, `code`. Add advisory display hints:
   ```json
   "display": {
     "location": "field" | "page" | "form" | "none",
     "style": "inline" | "toast" | "banner"
   }
   ```
   These are advisory (like all Tier 1 presentation) — they tell the renderer where the author intends errors to appear.

2. **Theme: `validation` in PresentationBlock.** Allow the theme cascade to control error presentation per-item, per-type, or per-dataType:
   ```json
   "validation": {
     "position": "below" | "above" | "tooltip" | "end",
     "showIcon": true,
     "showSeverity": true
   }
   ```
   This lets the design system control error appearance consistently across all forms.

3. **Component: `ValidationDisplay` and `ValidationSummary` components.** A `ValidationDisplay` component that slot-binds to a specific field's validation state:
   ```json
   { "component": "ValidationDisplay", "bind": "budgetTotal", "filter": { "severity": ["error", "warning"] } }
   ```
   When present, errors render there instead of inline. When absent, the current "display adjacent" behavior applies. A `ValidationSummary` component aggregates all results with filtering by severity, path prefix, and source.

4. **Error DOM ownership moves to adapters.** The `onValidationChange` callback in `FieldRefs` becomes the primary error rendering seam. The behavior hook calls it with full error details (message, severity, constraint kind). The adapter decides how to render. The default adapter renders inline text below the field (current behavior). The USWDS adapter renders the USWDS error pattern. The Tailwind adapter renders Tailwind-styled errors.

5. **Group-level error zones.** A `ValidationZone` component that collects and displays all errors for fields within a specific group scope. This addresses cardinality errors and cross-field Shape errors that have no natural "adjacent" field.

Effort: High. New spec surface (validation display properties in all three tiers), new components (`ValidationDisplay`, `ValidationZone`), adapter API changes. Risk: Medium — the adapter seam (`onValidationChange`) already exists and the Tailwind adapter already uses it. Dependency: Benefits from Finding 3 (cascade alignment) for theme-level validation styling. Benefits from Finding 8 (coverage model) for knowing where fallback field errors should render.

---

### Phase 4: Authoring quality and ecosystem

With foundations fixed, vocabularies aligned, schemas decoupled, and ownership (including dynamic behavior) defined, the remaining findings improve author experience at scale and build the infrastructure for a Formspec ecosystem.

---

#### Finding 13: Theme selectors are too weak for portfolio theming

**Status:** Confirmed from v1.

Theme selectors currently match only `type` (3 values: `group`, `field`, `display`) and `dataType` (13 values). See [`theme.schema.json` SelectorMatch at lines 453-498](/schemas/theme.schema.json#L453). The schema enforces this with `additionalProperties: false`.

This gives a maximum of 39 meaningful selector combinations. Real design-system teams will need to target:

- `semanticType` — match fields with specific semantic meaning (e.g., "all phone numbers")
- `repeatable` — match repeatable vs non-repeatable groups
- `keyPattern` — regex match against item keys (e.g., "all keys starting with `addr_`")
- Extension predicates — match items with specific extensions

v1 also suggested `required` as a selector criterion. Validation revealed this is fundamentally different from the others: `required` is a FEL expression evaluated at runtime against dynamic state (including repeat instance context). Matching on it at theme-cascade time would require the engine's computed state, not just the static definition. The other proposed selectors (`semanticType`, `repeatable`, `keyPattern`) are all derivable from the static Definition structure.

Without stronger selectors, the `items` override map becomes a per-key exception list. That scales for one form, not for a portfolio of dozens or hundreds.

Current state: Both cascade implementations (`theme-cascade.ts` line 18 and `theme-resolver.ts` line 293) check only `match.type` and `match.dataType`. The `ItemDescriptor` type carries `{ key, type, dataType }`. Extending selectors requires:

1. Adding properties to the schema's `SelectorMatch` (removing `additionalProperties: false` or adding explicit properties).
2. Extending `ItemDescriptor` to carry `semanticType`, `repeatable`, etc.
3. Updating both `selectorMatches` implementations.
4. For `keyPattern` with regex: add bounded-pattern validation or regex timeout to prevent ReDoS.

Recommendation:

1. Extend `SelectorMatch` with static-derivable properties:
   - `semanticType` (string — match items with this semantic type)
   - `repeatable` (boolean — match repeatable/non-repeatable groups)
   - `keyPattern` (string — regex against item key, with length/complexity bounds)
2. Do NOT add `required` as a selector. It requires runtime state and would change the cascade from a static resolution to a dynamic one.
3. Keep `items` map for surgical per-key exceptions.
4. Add extension predicates in a later phase when the extension registry is more mature.

Effort: Medium. Schema change is straightforward; updating both cascade implementations and enriching `ItemDescriptor` is moderate work. Risk: Low — additive, backward-compatible. Dependency: Benefits from Finding 3 (cascade reconciliation) being resolved first, so the selector logic only needs to be added to one canonical cascade implementation.

---

#### Finding 14: No cross-document validation contract

**Status:** New finding (greenfield gap analysis). Partially addressed by existing linter.

Both Theme and Component documents declare a `targetDefinition` with `url` (required) and `compatibleVersions` (optional semver range). The specs define snapshot referential integrity:

- Component spec S12.2: "Every `bind` value MUST correspond to an item `key` in the target Definition. Unknown bind keys MUST produce a warning."
- Theme spec S7.4: "Unknown item key in `items` — SHOULD warn, MUST NOT fail."
- Both specs: "A processor MUST NOT fail if the [compatibleVersions] range is unsatisfied; it SHOULD warn."

What is addressed: **snapshot validation** — at load time, check whether binds and item references resolve. The linter already implements this (W705-W707 for theme, E802-E803 for component).

What is missing: **evolution validation** — what happens when the Definition changes and a previously-valid presentation document becomes stale.

- No spec for detecting dataType drift (component was bound as TextInput to a `string` field; Definition changes field to `integer`)
- No runtime evaluation of `compatibleVersions` semver ranges — the field exists in both schemas but no code checks it
- No cross-tier validation (Theme tokens referenced by Component are never validated)
- No "presentation health" signal at runtime — the webcomponent checks `targetDefinition.url` mismatch with a `console.warn` but does nothing about it; everything silently degrades

Current state: The state normalizer (`packages/formspec-core/src/state-normalizer.ts`) keeps `targetDefinition.url` synced across documents when the definition URL changes. The webcomponent emits a console warning on URL mismatch. But there is no programmatic API to ask "is this theme still valid against this definition?"

Product judgment: Silent degradation is the worst failure mode for form authors. A theme page region pointing to a deleted group renders nothing. A component binding to a nonexistent key renders nothing. No error, no warning in the rendered form. The linter catches this at authoring time, but nothing catches it at runtime or during Definition upgrades.

Recommendation:

1. **Bundle validator API.** Add a `validateBundle({ definition, component?, theme?, registry? })` function that returns `BundleDiagnostic[]`. Cross-checks all bind references, item keys, page region keys, token references, and dataType compatibility in one pass. This is the project-level equivalent of what the linter does per-document.

2. **Presentation Compatibility Manifest.** Allow presentation documents to declare their required keys and expected dataTypes:
   ```json
   "requires": {
     "firstName": { "dataType": "string" },
     "budget[*].amount": { "dataType": "money" }
   }
   ```
   A processor can statically verify compatibility when binding a presentation document to a new Definition version without loading the full component tree.

3. **Changelog integration.** The changelog spec already classifies changes by impact. Extend it to compute whether a given Definition change breaks a specific Theme or Component Document. A `fieldRemoved` change for key `X` breaks any Component Document with `bind: "X"`. A `dataTypeChanged` change breaks any Component with an incompatible binding.

4. **Runtime bundle health signal.** Expose a reactive `bundleHealth` signal on `FormspecRender` (or the engine) that surfaces cross-document issues without blocking rendering. Embedding applications choose how to surface these. This subsumes the current `console.warn` for URL mismatch.

Effort: Medium for the bundle validator. High for the compatibility manifest and changelog integration. Risk: Low — all additive. Dependency: Benefits from Finding 4 (canonical dataType registry) for type-compatibility checking. Benefits from Finding 6 (shared schema) for cross-tier type validation.

---

#### Finding 15: No composition model for presentation documents

**Status:** New finding (greenfield gap analysis). Deliberately deferred per spec.

Both specs are explicitly monolithic. Component spec S13.1 excludes "Component inheritance." Theme spec S9.1 mentions "`extends` in future versions" informatively, confirming the authors are aware of this gap but deliberately deferred it.

What is missing:

- **Theme inheritance.** No ability to create a base theme and extend it. An agency cannot define "USWDS base theme" and have each form inherit and override specific tokens or selectors.
- **Cross-document component reuse.** Custom components (via the `components` registry) are scoped to a single component document. A reusable `AddressBlock` template cannot be shared across component documents without copy-pasting.
- **Token packages.** No lightweight document type for distributing tokens independently of a full theme. Design system teams cannot publish a token palette that both themes and component documents import.

Current state: The core spec's `$ref` + assembly pattern (S6.6) provides a working model for fragment inclusion and resolution. The assembler (`packages/formspec-engine/src/assembly/assembleDefinition.ts`) resolves `$ref` references into flat definitions. The Rust assembler (`crates/formspec-core/src/assembler.rs`) has the same resolver pattern. The component planner already expands custom components within a document via deep-clone + `interpolateParams`. The infrastructure exists; it just has not been applied to presentation documents.

Product judgment: This is the gap that will hurt organizations deploying many forms. Without theme inheritance, every form's theme is a complete copy. Without cross-document component reuse, every component tree redeclares common patterns. Copies drift. Maintenance cost scales linearly with form count.

Recommendation:

Apply the existing `$ref` + assembly pattern (core spec S6.6) to presentation documents:

1. **Theme `derivedFrom` property.** A theme declares `"derivedFrom": { "url": "...", "version": "..." }` and specifies only overrides. The processor deep-merges the parent theme's tokens, defaults, selectors, and pages, then applies the child's overrides using the existing cascade rules. This is cascade composition, which the theme spec already understands deeply.

2. **Cross-document component imports.** Allow the `components` registry to reference templates from an external Component Library document:
   ```json
   "AddressBlock": { "$ref": "https://example.org/components/address.formspec-component.json#components/AddressBlock" }
   ```
   Assembly resolves these at publish time, producing a self-contained document. This mirrors core spec S6.6 exactly.

3. **Token package documents.** A new lightweight document type that is just tokens + metadata. Both themes and component documents can import token packages, creating clean layering: `base-tokens.json` → `theme.json` → `component.json`.

4. **Single assembly mechanism.** Both theme and component assembly use the same `$ref` + assembly pattern that core spec S6.6 already defines. No new concepts needed — just applying an existing concept to presentation documents.

Effort: Medium for theme `derivedFrom` (cascade composition is well-understood). Medium for component imports (planner already expands templates). Low for token packages (flat key-value documents with metadata). Risk: Low — all additive, backward-compatible. Dependency: Benefits from Finding 6 (shared primitives schema) for token package typing.

---

#### Finding 16: Custom component contracts lack ecosystem metadata

**Status:** New finding (greenfield gap analysis). Partially addressed by existing system.

The custom component system operates at three levels, which is more complete than initially expected:

**Level 1: Schema-level templates.** Defined in the `components` map of a component document. Templates have `params` (optional string array) and `tree` (component subtree). The planner expands them via deep-clone + `{param}` interpolation. This is macro expansion — syntactic sugar for reusable tree fragments.

**Level 2: ComponentRegistry plugins.** JavaScript-level registration mapping component type strings to `ComponentPlugin` implementations. The `RenderContext` provides full engine access, theme/component documents, token resolution, styling helpers, recursive child rendering, submit/focus APIs, and cleanup tracking.

**Level 3: RenderAdapter system.** Design-system-level re-skinning. `AdapterRenderFn` functions per component type with `AdapterContext` for styling. The Tailwind and USWDS adapters demonstrate this works for real design systems.

What is missing is **ecosystem metadata** for Level 1 templates:

- **No `description`.** A consumer of a shared component template has no human-readable documentation.
- **No `requiredTokens`.** No way to declare which `$token.` keys a template expects. Static validation of token completeness is impossible.
- **No `bindContract`.** No way to declare which params are expected to be bound to items and what dataTypes they accept. Static validation at instantiation time is impossible.
- **No `version`.** No semver for template evolution or changelog tracking.
- **No `examples`.** No example instantiations (unlike schemas, which have `x-lm.examples`).

For Level 2 plugins, the gap is in **domain-specific extensibility**:

- **No custom data type registration.** The engine recognizes fixed `dataType` values. A custom component for a "rich text" or "address" composite type cannot participate in the engine's validation/response pipeline.
- **No behavior hook factory.** Custom components that need field behavior (required indicator, validation display, readonly, relevance) must reimplement `bindSharedFieldEffects` rather than composing with it.

Product judgment: For most use cases (design-system adaptation via Level 3), the system is excellent. The gap is for **component libraries** (Level 1 templates shared across documents via Finding 15) and **domain-specific components** (Level 2 plugins for address lookup, code editor, map picker).

Recommendation:

1. **Custom Component Manifest** for Level 1 templates:
   ```json
   "AddressBlock": {
     "description": "US mailing address with autocomplete",
     "version": "1.0.0",
     "requiredTokens": ["spacing.md", "color.border"],
     "bindContract": {
       "field": { "dataTypes": ["string", "text"] }
     },
     "params": ["field", "showCounty"],
     "tree": { ... },
     "examples": [
       { "component": "AddressBlock", "field": "mailingAddress", "showCounty": "true" }
     ]
   }
   ```
   This turns the `components` registry from a macro system into a proper component contract system, aligned with the Extension Registry's metadata model.

2. **Behavior composition for Level 2 plugins.** Expose `createFieldBehavior(componentType, fieldRefs)` so custom components can reuse the shared field behavior pipeline without reimplementing it. The `bindSharedFieldEffects` function is the existing implementation; expose it as a composable API.

3. **Custom data type registration** (future): `engine.registerDataType('address', { coerce, validate, serialize })` so custom types participate in the full pipeline. This is a larger change that affects the engine's core processing model.

Effort: Low for the manifest metadata (schema addition). Medium for behavior composition (API extraction from existing code). High for custom data types (engine-level change). Risk: Low for manifest and behavior composition — additive. Dependency: Benefits from Finding 15 (composition model) for cross-document template sharing.

---

## Decision matrix

### 1. Component coverage model

| Path | Example | Pros | Cons |
|---|---|---|---|
| **Full ownership by default** | A wizard defines every field. Nothing renders unless explicitly placed. | Predictable. Clean analytics. Clear a11y surface. | High authoring cost. Harder incremental adoption. |
| **Implicit partial** (current) | Customize one screen; everything else renders generically. Missing required fields append after the tree. | Lowest friction. | Surprise append. Hard to test. Required fields outside intended flow. |
| **Explicit hybrid with fallback zones** | Customize the intake flow; declare "render remaining fields here" in specific locations. | Intentional hybrid. Best adoption/predictability balance. | More spec surface. Authors must understand slots. |

Suggested direction: **Explicit hybrid with fallback zones.** Make `full` the default for new documents. `partial` is opt-in with required fallback zone declarations.

### 2. Navigation ownership

| Path | Example | Pros | Cons |
|---|---|---|---|
| **Layered with explicit precedence** | Core hints enable null-theme rendering. Theme owns generic grouping. Component owns navigation for bound items. Precedence rules documented. | Preserves all three use cases. Clear "what wins" rules. | Three mechanisms coexist. |
| **Core owns no navigation** | Paging exists only in Theme/Component. Definition-only renderers have no step guidance. | Cleanest layering. | Weakens null-theme rendering. Breaks all existing examples. |
| **Theme + Component only** | Core keeps advisory hints but they are explicitly ignored when a higher tier is present. | Pragmatic middle ground. | Still three mechanisms, just with clearer precedence. |

Suggested direction: **Layered with explicit precedence.** Core keeps advisory hints for null-theme rendering. Document interaction rules. Do not delete until interaction rules are tested.

### 3. Bind addressing model

| Path | Example | Pros | Cons |
|---|---|---|---|
| **Flat global keys only** | `bind: "orgName"` everywhere. Keys are globally unique. | Simplest. Easiest validation. One addressing mode. | Requires unique keys across fragments. Less readable for deep nesting. |
| **Flat + qualified** (current spec) | `bind: "orgName"` or `bind: "applicantInfo.orgName"`. | Flexible. | Two modes forever. Ambiguity. Tooling must support both. |
| **Scoped local keys** | `applicant.name` and `spouse.name` can coexist. | Strong fragment reuse. | Largest spec change. Breaks global-key assumption. |

Suggested direction: **Flat global keys only** unless fragment reuse is a strategic requirement. Resolve the core spec contradiction (Finding 1) first. Write an ADR.

### 4. Cascade merge semantics

| Path | Example | Pros | Cons |
|---|---|---|---|
| **Deep merge for nested objects** (renderer already does this) | Adding `style.background` preserves `style.borderRadius` from lower levels. | Matches author expectations. CSS-like behavior. Already implemented in renderer. | Spec change. Needs reconciliation across implementations. |
| **Shallow replace** (spec says this) | Adding `style.background` replaces entire `style` block. | Simplest implementation. Spec-compliant. | Surprises authors. Renderer already diverged. |
| **Flatten to leaf props** | `styleBackground`, `styleBorderRadius` instead of nested `style.background`. | No merge ambiguity. | Noisier schema. Less extensible. |

Suggested direction: **Deep merge for `style`, `widgetConfig`, `accessibility`.** The renderer is already doing this. Update the spec and align the other implementations.

### 5. Core accessibility boundary

| Path | Example | Pros | Cons |
|---|---|---|---|
| **Keep current scope** | Definition-only renderers honor all item-level a11y metadata. | Strong baseline. Portable. | Boundary remains muddy. |
| **Classify and narrow** | Core keeps durable metadata (descriptions, names). Theme/Component owns renderer-specific behavior (roles, live-regions). | Better separation. Still preserves author intent. | Requires careful classification. |
| **Move most to Theme/Component** | A11y behavior is authored alongside renderer policy. | Cleanest. | Weakens portability. Risks making a11y optional. |

Suggested direction: **Classify and narrow** over time. Document the classification first. Narrow in a future version based on real usage data.

### 6. Lifecycle model

| Path | Example | Pros | Cons |
|---|---|---|---|
| **Declarative lifecycle properties** | Page components declare `onLeave: { validate: "bound-items" }`. Submission protocol is normative. Validation triggers are configurable. | Still declarative. Portable. Covers the real embedding-app needs. | New spec surface. Lifecycle semantics are hard to get right. |
| **Implementation-defined** (current) | Each renderer decides when validation fires, what submission means, what events to emit. | Simplest for the spec. | Breaks portability. Every renderer answers differently. |
| **Imperative event handlers** | `onClick`, `onChange` on components. | Maximum flexibility. | Contradicts the declarative philosophy. Creates a scripting language. |

Suggested direction: **Declarative lifecycle properties.** Add navigation triggers, normative submission protocol, and validation timing configuration. Do not add imperative handlers.

### 7. Validation display

| Path | Example | Pros | Cons |
|---|---|---|---|
| **Three-tier validation display** | Core provides advisory display hints on Shapes. Theme cascade controls error styling. Component tree has ValidationDisplay/ValidationSummary components. | Mirrors existing three-tier pattern. Full customizability. | Significant spec surface. |
| **Single "display adjacent" rule** (current) | Errors always render inline below the field. Renderers hardcode display. | Simplest. | Not customizable. Different design systems cannot control error UX. |
| **Adapter-only** | Error rendering delegated entirely to adapters. No spec contract. | Flexible per design system. | No portability. No spec guarantee about error presentation. |

Suggested direction: **Three-tier validation display.** Apply the same pattern the spec already uses for styling and layout to validation feedback.

### 8. Presentation composition

| Path | Example | Pros | Cons |
|---|---|---|---|
| **$ref + assembly** (mirror core S6.6) | Theme `derivedFrom` + component template `$ref` to external documents. Assembly resolves at publish time. | Consistent with existing Definition assembly. Self-contained after resolution. | Assembly pipeline complexity. |
| **Runtime import** | Themes and components load dependencies at render time. | No assembly step. | Runtime latency. Resolution complexity in the renderer. Offline fragility. |
| **No composition** (current) | Each document is monolithic. Copy-paste for reuse. | Simplest. | Copies drift. Scales linearly with form count. |

Suggested direction: **$ref + assembly** mirroring core S6.6. Resolve at publish time to produce self-contained documents.

---

## Recommended target model

### Definition (Tier 1)

Keep: items, binds, shapes, labels, hints, descriptions, `widgetHint` as null-renderer hint, `formPresentation` as advisory defaults (including `pageMode`).

Add: normative submission protocol, validation trigger taxonomy (`validationTrigger` on `formPresentation`), advisory `validationPresentation` on Shapes.

Rethink later (after interaction rules are settled): whether `presentation.accessibility` should be narrowed to durable metadata only.

### Theme (Tier 2)

Make Theme the generic-renderer policy layer: tokens, control/widget selection policy (via canonical vocabulary), selector-based presentation policy, generic page/grid layout, platform/theme metadata.

Add: `validation` properties in `PresentationBlock` for error display styling, `derivedFrom` for theme inheritance.

Improve: stronger selector grammar (semanticType, repeatable, keyPattern), deep-merge semantics for nested objects, import shared types from `presentation-common.schema.json` instead of Component.

### Component (Tier 3)

Make Component the explicit experience layer: explicit tree, explicit navigation, custom templates, conditional visibility, review/summary/help surfaces.

Add: `coverageMode` with explicit fallback zones for partial coverage, declarative lifecycle properties on navigation components (`onLeave`, `onEnter`), `ValidationDisplay` and `ValidationSummary` components, cross-document template `$ref` imports, custom component manifest metadata.

Change: use the same dataType vocabulary as Definition, reference the canonical widget vocabulary for compatibility.

### Cross-cutting

Add: `presentation-common.schema.json` for shared types, bundle validator API, presentation compatibility manifest, typed event contract for `<formspec-render>`.

---

## Sequencing with dependency graph

```
Phase 0 (foundations)      Phase 1 (vocabulary)     Phase 2 (structure)      Phase 3 (ownership+behavior)     Phase 4 (ecosystem)
─────────────────────      ────────────────────     ───────────────────      ────────────────────────────     ───────────────────
┌────────────────┐         ┌────────────────┐       ┌────────────────┐       ┌────────────────┐               ┌────────────────┐
│ F1: Key        │────────>│                │       │                │       │                │               │                │
│ uniqueness     │         │ F4: dataType   │       │ F6: Shared     │       │ F8: Coverage   │               │ F13: Selector  │
│ contradiction  │  ┌─────>│ registry       │  ┌───>│ schema         │  ┌───>│ model          │          ┌───>│ grammar        │
└────────────────┘  │      │ + sync tests   │  │   │ primitives     │  │   │ + fallback     │          │   │ extension      │
                    │      └────────────────┘  │   └────────────────┘  │   │ zones          │          │   └────────────────┘
┌────────────────┐  │                          │                       │   └────────────────┘          │
│ F2: Compat     │──┘      ┌────────────────┐  │   ┌────────────────┐  │                               │   ┌────────────────┐
│ matrix         │         │ F5: Control    │  │   │ F7: Bind       │  │   ┌────────────────┐          │   │ F14: Cross-doc  │
│ disconnection  │         │ vocabulary     │  │   │ addressing     │  │   │ F9: Navigation │          ├──>│ validation      │
└────────────────┘         │ formalization  │  │   │ ADR            │  │   │ interaction    │          │   │ contract        │
                           └────────────────┘  │   └────────────────┘  │   │ rules          │          │   └────────────────┘
┌────────────────┐                             │          ↑            │   └────────────────┘          │
│ F3: Cascade    │─────────────────────────────┘          │            │          │                    │   ┌────────────────┐
│ implementation │                             F1 ────────┘            │          │                    │   │ F15: Presenta-  │
│ disagreement   │─────────────────────────────────────────────────────┤          ▼                    ├──>│ tion            │
└────────────────┘                                                     │   ┌────────────────┐          │   │ composition     │
        │                                                              │   │ F10: A11y      │──────────┤   └────────────────┘
        │                                                              │   │ boundary       │          │
        │                                                              │   └────────────────┘          │   ┌────────────────┐
        │                                                              │          │                    │   │ F16: Custom     │
        │                                                              │          ▼                    └──>│ component       │
        │                                                              │   ┌────────────────┐               │ contracts       │
        └──────────────────────────────────────────────────────────────┤   │ F11: Lifecycle  │               └────────────────┘
                                                                       │   │ model           │
                                                                       │   └────────────────┘
                                                                       │          │
                                                                       │          ▼
                                                                       │   ┌────────────────┐
                                                                       └──>│ F12: Validation │
                                                                           │ display         │
                                                                           └────────────────┘
```

**Key dependency arrows:**

- F1 (key uniqueness) → F7 (bind addressing): cannot decide bind model until key uniqueness is resolved.
- F2 (compat matrix) → F4 (dataType registry): must fix the broken vocabulary before building enforcement.
- F3 (cascade disagreement) → F6 (shared primitives): aligning implementations benefits from shared types.
- F3 (cascade disagreement) → F8 (coverage model): fallback rendering uses the cascade; it must be deterministic first.
- F3 (cascade disagreement) → F12 (validation display): error styling through the cascade requires a settled merge model.
- F6 (shared primitives) → F10 (a11y boundary): AccessibilityBlock classification benefits from shared schema extraction.
- F9 (navigation) → F11 (lifecycle): navigation events depend on knowing which tier owns navigation.
- F10 (a11y boundary) → F13 (selector grammar): knowing which a11y metadata is in Core informs what selectors should target.
- F11 (lifecycle) → F12 (validation display): validation timing affects when and how errors are shown.
- F4 (dataType registry) → F14 (cross-doc validation): type-compatibility checking requires canonical vocabulary.
- F6 (shared primitives) → F15 (composition): theme inheritance uses the same assembly model as shared types.
- F15 (composition) → F16 (custom components): cross-document template sharing is the primary consumer of component manifests.

**Effort summary:**

| Phase | Findings | Total effort | Nature |
|---|---|---|---|
| Phase 0 | F1, F2, F3 | Low + Low + Medium | Spec edits, schema fixes, implementation alignment |
| Phase 1 | F4, F5 | Low + Low | Sync tests, doc cross-references |
| Phase 2 | F6, F7 | Medium + Low | Schema extraction, ADR |
| Phase 3 | F8, F9, F10, F11, F12 | High + Low + Low + High + High | Coverage model, documentation, lifecycle model, validation display |
| Phase 4 | F13, F14, F15, F16 | Medium + Medium + Medium + Medium | Selectors, cross-doc validation, composition, component contracts |

---

## Validated non-gaps

The following items were investigated as potential gaps and confirmed to be well-addressed by the existing spec:

1. **`relevant` vs `when` interaction.** Component spec S8.2 provides a normative interaction table. `relevant=false` always wins. `when=false` hides but preserves data. Only needs a cross-reference from core S5.6 to component S8.2 for discoverability.

2. **Token resolution depth.** Both specs explicitly forbid token-to-token references (MUST NOT). Values are strings or numbers only. Resolved at theme-application time. No circular reference risk. CSS custom properties handle computation. A future enhancement could add one-level indirection for semantic/primitive token layering (like DTCG), but the current design is correct and deliberately simple.

3. **Sidecar document split.** Theme and Component are separate documents because they represent genuinely different paradigms (cascade augmentation vs tree replacement) serving different audiences. Merging them would lose the ability to swap themes independently of component trees. The right fix is better co-loading (already implemented via ProjectBundle in formspec-core) and shared primitives extraction (Finding 6), not document merger.

---

## Recommendation in one sentence

Fix the three internal contradictions first, then align vocabularies, then decouple schemas, then define dynamic behavioral ownership (lifecycle, validation display, coverage), then build the ecosystem infrastructure (composition, cross-document validation, component contracts) — in that order, because each phase unblocks the next and the first phase is the cheapest.
