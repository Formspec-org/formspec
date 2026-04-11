# Presentation Tier Architecture Audit

## Bottom line

The three documents are trying to solve three real jobs:

- `definition.schema.json` is the portable source of truth for data, logic, and the minimum rendering hints needed for a usable default renderer.
- `theme.schema.json` is for platform/design-system teams who want one renderer to produce many branded or platform-specific variants without rewriting the form.
- `component.schema.json` is for product/application teams who want to author an explicit experience: custom flow, custom composition, custom review screens, custom interaction patterns.

That product segmentation is valid. The current contracts are not.

The main debt vectors are:

- too many duplicated concepts across tiers
- vocabulary drift between spec and schema
- a hybrid fallback model that will create unpredictable UX
- weak theme selectors that will not scale to real form portfolios
- shared schema primitives coupled in the wrong direction

My recommendation is to keep all three artifacts, but narrow them deliberately and make the authoring modes explicit.

This review was later pressure-tested with red-team and green-team passes. The main thesis still holds, but some recommendations should be sequenced as clarification and ADR work before deletion or contraction.

## What real users are actually trying to do

### 1. Definition-only mode

Who uses it:

- standards authors
- backend teams
- teams validating or exchanging forms across systems

Problem being solved:

- describe the questionnaire and its logic once
- render it anywhere
- preserve data semantics independently of UI

What they need:

- stable keys
- data types
- binds and validation
- enough rendering hints for a usable null renderer

What they do not need:

- branded layout systems
- explicit page choreography
- app-specific component trees

### 2. Definition + Theme mode

Who uses it:

- design-system teams
- platform teams serving many forms
- agencies needing web/mobile/pdf variations from the same definition

Problem being solved:

- avoid hand-authoring a component tree for every form
- apply consistent widget policy, spacing, tokens, and generic layout
- let business authors keep owning the form content while design teams own the visual policy

What they need:

- strong selectors
- tokens
- widget policy and fallbacks
- a generic page/grid model

What they do not need:

- per-screen bespoke interaction trees
- product-specific flow logic embedded in the data model

### 3. Definition + Component mode

Who uses it:

- product teams
- teams building a guided wizard, intake journey, kiosk flow, or highly curated review/summary experience

Problem being solved:

- generic renderer output is not enough
- the form experience is part of the product
- some fields appear multiple times as summaries, review data, help panels, modals, or progressive disclosure

What they need:

- explicit composition
- reusable templates
- custom layout
- conditional rendering
- strong control over progression and review screens

What they do not need:

- a surprise fallback renderer appending extra required fields after the custom experience

## What is working in the current architecture

- Sidecar Theme and Component documents are the right instinct. They preserve the portability of the Definition.
- Keeping behavioral truth in the Definition is correct. Presentation should not override `required`, `relevant`, `readonly`, `constraint`, or `calculate`.
- Token inheritance from Theme into Component is useful. Product teams should be able to inherit a platform design system and override only what they need.
- A null-theme renderer is important. A definition should remain renderable without a presentation sidecar.

## Findings

### 1. The bind model is internally contradictory, and the more complex version is unnecessary

Core requires item keys to be globally unique across the entire Definition, not merely among siblings. See [`specs/core/spec.md` line 1925](/Users/mikewolfd/Work/formspec/specs/core/spec.md#L1925). Once that is true, a dotted component binding path does not buy much.

The canonical Component spec now says `bind` accepts both a flat key and a dotted qualified path. See [`specs/component/component-spec.md` lines 480-500](/Users/mikewolfd/Work/formspec/specs/component/component-spec.md#L480). But the schema descriptions still describe `bind` as an item key from the target definition. See [`schemas/component.schema.json` lines 499-502](/Users/mikewolfd/Work/formspec/schemas/component.schema.json#L499), [`schemas/component.schema.json` line 546](/Users/mikewolfd/Work/formspec/schemas/component.schema.json#L546), and the repeated pattern across the component schema.

Product judgment:

- the dotted-path addition is suspicious
- it adds a second addressing mode without a clearly proven user need if keys are already global
- it increases author confusion, binding resolution complexity, and migration burden unless there is a deliberate long-term plan for scoped addressing

Recommendation:

- choose one addressing model explicitly through an ADR
- the cleaner choice is still likely flat globally unique keys everywhere
- do not let both modes drift forward casually; either justify dotted paths as strategic or remove them cleanly

### 2. Canonical vocabularies are not actually canonical

The Component layer drifts from Core in multiple places:

- When presentation tiers are talking about Definition field `dataType` values, Core uses `decimal` and `money`; Component prose and some schema metadata repeatedly use `number`. Compare [`specs/core/spec.md` lines 2084-2096](/Users/mikewolfd/Work/formspec/specs/core/spec.md#L2084) with [`specs/component/component-spec.md` lines 610-620](/Users/mikewolfd/Work/formspec/specs/component/component-spec.md#L610) and [`schemas/component.schema.json` lines 537-543](/Users/mikewolfd/Work/formspec/schemas/component.schema.json#L537).
- The Component reference helper is stale relative to the canonical spec on `bind`; it still says flat key only.
- `MoneyInput` is correct in the schema as `money`-compatible, but the component prose/helper drift into `number`/`integer` language. Compare [`schemas/component.schema.json` lines 1033-1039](/Users/mikewolfd/Work/formspec/schemas/component.schema.json#L1033) with the component prose around compatibility.
- `Rating` says it is integer-only, but `allowHalf` says values can be stored as decimal. See [`schemas/component.schema.json` lines 1091-1109](/Users/mikewolfd/Work/formspec/schemas/component.schema.json#L1091).

Core itself still legitimately uses `number` as the FEL/runtime numeric type. See [`specs/core/spec.md` lines 1125-1137](/Users/mikewolfd/Work/formspec/specs/core/spec.md#L1125) and [`specs/core/spec.md` lines 1299-1307](/Users/mikewolfd/Work/formspec/specs/core/spec.md#L1299). The problem is not that `number` is globally invalid in Formspec; it is that presentation tiers are mixing runtime-type terminology with Definition item `dataType` terminology.

This is not editorial noise. It means the architecture has no single generated vocabulary source for:

- data types
- control/widget identifiers
- binding semantics
- compatibility matrices

Product judgment:

- `decimal` should be the canonical name whenever presentation tiers are referring to Definition field data types; `number` remains correct for FEL/runtime numeric semantics
- `MoneyInput` should stay `money`-only
- `Rating` should be simplified: either remove `allowHalf` or explicitly support `decimal`; I would remove `allowHalf`

Recommendation:

- create one canonical registry for data types and one canonical registry for control IDs
- generate the tables into Core, Theme, Component, and the reference helpers

### 3. Theme and Component use different control taxonomies for the same idea

Tier 1 and Theme speak in widget names like `dropdown`, `radio`, `checkboxGroup`, and `datePicker`. See [`specs/core/spec.md` lines 2084-2096](/Users/mikewolfd/Work/formspec/specs/core/spec.md#L2084) and [`schemas/theme.schema.json` lines 285-307](/Users/mikewolfd/Work/formspec/schemas/theme.schema.json#L285). Tier 3 speaks in component names like `Select`, `RadioGroup`, `CheckboxGroup`, and `DatePicker`.

That means authors are forced to mentally translate between two vocabularies:

- Theme `dropdown` -> Component `Select`
- Theme `radio` -> Component `RadioGroup`

Some cases are true alias drift and some are just naming-style drift. `dropdown` -> `Select` and `radio` -> `RadioGroup` are the stronger examples. `checkboxGroup` -> `CheckboxGroup` and `datePicker` -> `DatePicker` are mostly casing/style differences. The net effect is still avoidable translation work for authors and tooling.

Product judgment:

- this is avoidable debt
- it makes migration from Theme-mode to Component-mode harder than it should be

Recommendation:

- introduce one canonical registry for control concepts and compatibility
- if Theme remains an abstract policy layer, keep an explicit alias map from theme widget IDs to component IDs
- do not let the relationship between Theme control names and Component control names remain implicit

### 4. Partial component trees are a major UX debt trap

The current model says:

- Tier 3 takes precedence over Tier 2 and Tier 1 for bound items; see [`specs/component/component-spec.md` lines 2836-2858](/Users/mikewolfd/Work/formspec/specs/component/component-spec.md#L2836)
- unbound required items must be rendered as fallback inputs after the component tree output; see [`specs/component/component-spec.md` lines 581-602](/Users/mikewolfd/Work/formspec/specs/component/component-spec.md#L581)
- Theme pages may still render unassigned items after all pages; see [`specs/theme/theme-spec.md` lines 756-759](/Users/mikewolfd/Work/formspec/specs/theme/theme-spec.md#L756)

This creates a hybrid mode that sounds flexible but will be brittle in real products:

- a bespoke wizard can suddenly get extra fields appended after the custom flow
- required fields can appear outside the intended IA
- QA has to test both the custom tree and the fallback renderer behavior
- analytics and accessibility flows become harder because “the form” is now partly authored and partly emergent

Product judgment:

- this needs containment
- if a team chooses a Component document, they may or may not want to own the whole experience, but the current fallback behavior is too implicit

Recommendation:

- keep partial component trees as a supported mode
- require an explicit flag such as `coverageMode: "partial"` when fallback rendering is intended
- in partial mode, require explicit fallback zones/slots rather than “append after the tree”
- reserve “full experience ownership” as either the default or a clearly declared `coverageMode: "full"` path, but decide that explicitly rather than by accident

### 5. Page and navigation concepts are duplicated across all three tiers

Core has:

- `formPresentation.pageMode`; see [`specs/core/spec.md` lines 1873-1883](/Users/mikewolfd/Work/formspec/specs/core/spec.md#L1873)
- `presentation.layout.page`; see [`specs/core/spec.md` lines 2108-2114](/Users/mikewolfd/Work/formspec/specs/core/spec.md#L2108)

Theme has:

- `pages[]` and the region grid; see [`specs/theme/theme-spec.md` lines 673-811](/Users/mikewolfd/Work/formspec/specs/theme/theme-spec.md#L673)

Component has:

- `Page`
- `Wizard`
- `Tabs`

This is too many ways to express “how the user moves through the form.”

Real-world product behavior:

- business authors think in sections and content hierarchy
- design-system teams think in generic page and grid layout
- product teams think in explicit task flow and screen choreography

The spec currently lets all three tiers speak about paging. That guarantees confusion.

Recommendation:

- clarify ownership now, reduce later
- Core may keep minimal fallback pagination hints for null-theme/default renderers
- Theme should own generic page grouping for generic renderers
- once a Component document exists, it should own navigation and IA for the items it controls
- whether Core page choreography should be removed entirely belongs in a follow-on ADR after fallback behavior is redesigned

### 6. Theme selectors are too weak for real portfolio theming

Theme selectors currently match only `type` and `dataType`. See [`specs/theme/theme-spec.md` lines 513-528](/Users/mikewolfd/Work/formspec/specs/theme/theme-spec.md#L513) and [`schemas/theme.schema.json` lines 453-470](/Users/mikewolfd/Work/formspec/schemas/theme.schema.json#L453).

That is enough for demos, not enough for a form portfolio.

Real teams will want to target:

- `semanticType`
- repeatable groups
- required or readonly fields
- specific label contexts
- key prefixes or naming conventions
- extension metadata
- display items of a certain semantic role

Without stronger selectors, the `items` override map becomes a giant per-key exception list. That does not scale across dozens or hundreds of forms.

Recommendation:

- extend selector grammar to include at least `semanticType`, `repeatable`, `keyPattern`, and extension predicates
- keep item-key overrides for surgical exceptions, not primary theming

### 7. Styling and accessibility are fragmented across tiers at different abstraction levels

Core has semantic `styleHints` plus `accessibility`; see [`specs/core/spec.md` lines 2126-2149](/Users/mikewolfd/Work/formspec/specs/core/spec.md#L2126).
Theme has arbitrary `style` plus `accessibility`; see [`schemas/theme.schema.json` lines 331-380](/Users/mikewolfd/Work/formspec/schemas/theme.schema.json#L331).
Component also has arbitrary `style` and `accessibility`; see [`specs/component/component-spec.md` lines 337-385](/Users/mikewolfd/Work/formspec/specs/component/component-spec.md#L337).

This creates three different authoring questions:

- semantic intent in Core
- renderer style policy in Theme
- explicit instance styling in Component

That split is defensible for style. It is much weaker for accessibility metadata like `role` and `liveRegion`.

Product judgment:

- the current boundary is muddy
- Core should prioritize durable author intent and platform-agnostic accessibility metadata
- Theme and Component should own the more renderer-specific accessibility behavior

Recommendation:

- do not strip Core accessibility immediately
- first clarify which parts are durable cross-platform metadata versus renderer-level overrides
- preserve durable author intent via labels, hints, descriptions, and semantic annotations
- then decide whether Core `presentation.accessibility` should be narrowed, split, or partially moved outward

### 8. Shared schema primitives are coupled in the wrong direction

The Theme schema artifact imports `TargetDefinition`, `Tokens`, `AccessibilityBlock`, and `Breakpoints` from the Component schema artifact. See [`schemas/theme.schema.json` lines 273-279](/Users/mikewolfd/Work/formspec/schemas/theme.schema.json#L273), [`schemas/theme.schema.json` lines 407-408](/Users/mikewolfd/Work/formspec/schemas/theme.schema.json#L407), and [`schemas/theme.schema.json` lines 654-655](/Users/mikewolfd/Work/formspec/schemas/theme.schema.json#L654).

That means the published Theme schema is structurally coupled to sibling definitions housed under the Component schema artifact. That is a schema/package dependency, not proof that a Theme document requires any Component document at runtime. It is still the wrong dependency direction if Theme is meant to evolve as a sibling tier rather than as a child of Component.

Product judgment:

- this is the wrong dependency direction
- it creates avoidable version entanglement between sibling tiers

Recommendation:

- extract shared primitives into a small common presentation schema
- or generate those repeated defs into both schemas from one source
- do not make the Theme schema artifact depend on the Component schema artifact to define its core shapes

### 9. Shallow merge on nested objects is a theme-authoring footgun

Theme cascade and Component responsive merges are shallow. See [`specs/theme/theme-spec.md` lines 551-596](/Users/mikewolfd/Work/formspec/specs/theme/theme-spec.md#L551) and [`specs/component/component-spec.md` lines 2635-2691](/Users/mikewolfd/Work/formspec/specs/component/component-spec.md#L2635).

That means:

- adding a selector with `style.background` replaces the whole `style` object
- adding a breakpoint `style` override replaces the whole `style` object
- adding one accessibility property replaces the full block

This will surprise authors. Most people expect additive behavior for nested style/config objects.

Recommendation:

- either deep-merge `style`, `widgetConfig`, and `accessibility`
- or explicitly split them into leaf props so replacement is obvious
- at minimum, add lint warnings whenever a higher level replaces a lower nested block

## Decision matrix

This section summarizes the main unresolved design paths in product terms.
The goal is not to prematurely freeze every decision, but to make the tradeoffs
explicit before the ADRs are written.

### 1. Component coverage model

| Path | Behavior example | Pros | Cons |
|---|---|---|---|
| **Full ownership by default** | A grant-application wizard defines every field, review panel, and summary row in the Component tree. Nothing renders unless the product author placed it. | Predictable UX. Clean analytics. Clear accessibility testing surface. Strong product control. | High authoring cost. Harder incremental adoption. Teams must fully re-author generic forms. |
| **Implicit partial customization** | A hospital intake app customizes only the insurance review screen and lets everything else render generically. | Lowest friction for adoption. Good for experimenting with one section. | Dangerous implicit behavior. Required fields may appear outside intended flow. Hard to reason about QA coverage. |
| **Explicit hybrid with fallback zones** | A component tree customizes the intake flow, but declares zones like “render remaining applicant fields here” and “render remaining required fields in final review.” | Good balance between adoption and predictability. Makes hybrid behavior intentional. Keeps generic rendering useful. | More spec surface. Authors must understand fallback slots and coverage rules. |

**Suggested direction:** explicit hybrid with fallback zones. It preserves incremental adoption without the current “surprise append” behavior.

### 2. Navigation ownership

| Path | Behavior example | Pros | Cons |
|---|---|---|---|
| **Core owns minimal fallback guidance** | A null-theme renderer uses `formPresentation.pageMode` to render a basic wizard for a long form. | Keeps default renderers usable. Preserves portability. Low complexity. | Continues some overlap with higher tiers. Easy to let Core grow too much UI meaning. |
| **Theme owns generic navigation** | An agency web renderer applies the same `pages[]` grouping pattern across dozens of forms without custom component trees. | Good portfolio consistency. Clear design-system ownership. | Still overlaps with Component unless precedence is explicit. |
| **Component owns explicit navigation when present** | A mobile intake experience uses `Wizard`, `Page`, and `Tabs` to create a curated user journey. | Best for product UX. Matches actual app ownership. | Needs careful coexistence rules with Theme and fallback renderers. |
| **Core owns no navigation** | Paging exists only in Theme or Component. A Definition-only renderer gets no built-in step guidance. | Cleanest layering on paper. | Weakens null-theme rendering and default portability today. |

**Suggested direction:** Core keeps minimal fallback guidance, Theme owns generic grouping, and Component owns explicit navigation for the experience it defines.

### 3. Bind addressing model

| Path | Behavior example | Pros | Cons |
|---|---|---|---|
| **Flat global keys only** | Every renderer and summary binds `orgName`, never `applicantInfo.orgName`, because keys are globally unique. | Simplest mental model. Lowest implementation complexity. Easier validation and migration. | Requires strong discipline on key naming. Less human-readable nested addressing. |
| **Flat key plus qualified path** | Authors may bind either `orgName` or `applicantInfo.orgName` depending on what feels clearer. | Flexible. Can be friendlier in large nested forms. | Two addressing modes to support forever. Harder tooling and refactoring. More room for ambiguity. |
| **Scoped local keys with required qualification** | Nested groups can reuse `name`, so renderers must bind `applicant.name` and `spouse.name`. | Strong local modeling and reuse patterns. | Much larger model change. Breaks current assumptions about key uniqueness. Highest migration cost. |

**Suggested direction:** decide this explicitly via ADR. Flat global keys remain the leading option unless there is a strategic reason to move toward qualified addressing.

### 4. Theme vs Component control vocabulary

| Path | Behavior example | Pros | Cons |
|---|---|---|---|
| **Theme stays abstract, Component stays concrete** | Theme says `radio`; Component says `RadioGroup`. Theme expresses widget policy, Component expresses explicit UI nodes. | Preserves abstraction boundary. Lets Theme stay renderer-policy oriented. | Forces authors and tooling to translate between vocabularies. |
| **Unified vocabulary across both tiers** | Theme and Component both use the same control identifiers for inputs and displays. | Easier migration from generic theming to explicit components. Simpler docs and tooling. | May collapse a useful distinction between policy and concrete UI. Could be disruptive if the current split is intentional. |
| **Canonical registry plus alias map** | One registry defines the control concept, while Theme and Component may temporarily expose different names with explicit mapping. | Best transition path. Reduces drift immediately. Preserves optional abstraction. | Slightly more moving parts in the short term. |

**Suggested direction:** canonical registry plus alias map now. Collapse names later only if the abstraction proves unnecessary.

### 5. Core accessibility boundary

| Path | Behavior example | Pros | Cons |
|---|---|---|---|
| **Keep current Core accessibility scope** | A Definition-only renderer can still honor item-level accessible descriptions and live-region intent without a Theme or Component sidecar. | Strong null-theme baseline. Keeps accessibility intent portable. | Boundary remains muddy. Risk of renderer-specific concerns leaking into Core. |
| **Keep only durable cross-platform metadata in Core** | Core carries durable descriptions and high-level semantic intent; Theme/Component own renderer-level overrides. | Better separation of concerns. Still preserves author intent in the Definition. | Requires a careful split and migration story. |
| **Move most accessibility to Theme/Component** | Accessibility behavior is authored alongside the renderer policy or explicit UI tree. | Cleanest layering. | Weakens Definition portability and the null-theme baseline. Risks making accessibility optional. |

**Suggested direction:** move toward “durable metadata in Core, renderer-specific behavior in Theme/Component,” but do it as a staged narrowing, not an immediate removal.

### 6. Nested merge semantics

| Path | Behavior example | Pros | Cons |
|---|---|---|---|
| **Keep shallow merge, add lint** | A selector that sets `style.background` still replaces the whole `style` object, but tooling warns when that happens. | Lowest implementation cost. Preserves current semantics. | Still surprising at runtime. Authors will keep tripping over object replacement. |
| **Deep-merge nested objects** | Defaults set border radius, a selector adds background, and both survive in the resolved result. | Closer to author expectations. Better for layered design-system usage. | More complex spec and implementation rules. Needs careful conflict semantics. |
| **Flatten more properties** | Instead of nested `style` or `accessibility` objects, more props become leaf-level fields. | Fewer merge surprises. Easier to reason about precedence. | Noisier schema. Less flexible for extensibility. |

**Suggested direction:** add lint immediately, then evaluate deep-merge versus flatter objects based on real authoring examples.

## Recommended target model

### Definition

Keep:

- items
- binds
- shapes
- labels, hints, descriptions
- maybe `widgetHint` as a null-renderer hint

Remove or rethink:

- `formPresentation.pageMode`
- `presentation.layout.page`
- freeform `presentation.accessibility`
- semantic `styleHints` if Theme is the real presentation policy layer

### Theme

Make Theme the generic-renderer policy layer:

- tokens
- control/widget selection policy
- selector-based presentation policy
- generic page/grid layout
- platform/theme metadata

Improve:

- stronger selector grammar
- one canonical control vocabulary shared with Component
- better merge semantics or better warnings

### Component

Make Component the explicit experience layer:

- explicit tree
- explicit navigation
- custom templates
- conditional visibility
- review/summary/help surfaces

Change:

- exhaustive by default
- hybrid fallback only by explicit opt-in
- use the same control IDs and data-type vocabulary as Theme/Core

## Low-regret fixes to do now

### Resolve spec/schema drift immediately

- replace `number` with `decimal` anywhere presentation tiers are referring to Definition item data types; keep `number` where Core means the FEL/runtime numeric type
- decide the `bind` addressing model explicitly and then align spec, schema, and helpers to it
- remove `allowHalf` from `Rating`, or formally support `decimal`
- regenerate or rewrite the helper reference maps so they match the canonical spec

### Write the ownership ADRs before deleting concepts

- one ADR on binding/addressing: flat key only vs flat key + qualified path
- one ADR on navigation ownership across Core, Theme, and Component
- one ADR on partial Component trees and fallback zones
- one ADR on accessibility metadata boundaries across tiers

### Make authoring modes explicit

Document three supported modes:

- Definition-only
- Definition + Theme
- Definition + Component (+ optional Theme tokens)

Then define what is illegal or ignored in each mode.

### Decide who owns navigation

My recommendation:

- Core owns minimal fallback guidance only
- Theme owns generic pagination when rendering generically
- Component owns explicit navigation for the experience it defines
- do not leave mixed ownership implicit

### Extract shared primitives

Create a `presentation-common` schema or a generation step for:

- `TargetDefinition`
- `Tokens`
- `Breakpoints`
- `AccessibilityBlock`

### Add architectural lint rules

- error when Theme and Component both try to own page flow without an explicit bridge rule
- error or strong warning when a Component tree is partial unless partial mode is explicitly declared
- error when presentation tiers use non-canonical data-type names
- warn when shallow merges replace nested blocks

## Recommendation in one sentence

Keep the three-tier idea, but turn it into three clear authoring modes with one canonical vocabulary, one binding model, and no implicit hybrid rendering behavior.
