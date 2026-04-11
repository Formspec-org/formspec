# Page Mode Branch Review — Issue Register

**Date:** 2026-03-26
**Branch:** `claude/unified-authoring-architecture-msWWJ`
**Reviewers:** spec-expert, formspec-scout
**Scope:** 270 files changed, +23449/-5110 lines across the page-mode-as-presentation refactor
**Validation:** All issues verified against source files by both reviewers on 2026-03-26.

---

## Priority Tiers

- **P0 — Fix before merge**: Bugs or inconsistencies that will cause incorrect runtime behavior or schema validation failures.
- **P1 — Fix before merge**: Spec/schema inconsistencies introduced by this branch that violate the spec authoring contract (structural truth in schemas, behavioral truth in spec prose).
- **P2 — Fix soon after merge**: Dead code, stale references, and missing test coverage that don't affect correctness but create confusion.
- **P3 — Future work**: Feature gaps and enhancements identified during review but out of scope for this branch.

---

## P0 — Fix Before Merge

### I-01: Migration does not set `formPresentation.pageMode` ✅ CONFIRMED

| | |
|---|---|
| **Severity** | Bug — incorrect runtime behavior |
| **Files** | `packages/formspec-core/src/handlers/migration.ts`, `packages/formspec-core/tests/migration.test.ts`, `packages/formspec-core/src/raw-project.ts:166-185` |
| **Found by** | formspec-scout |
| **Validated** | CONFIRMED by both reviewers. `migrateWizardRoot` returns `migratedMode: 'wizard'` but this field is never consumed. `migratedProps` never includes `pageMode`. Test at `migration.test.ts:105-106` asserts `showProgress`/`allowSkip` but not `pageMode`. |

**Context:** `migrateWizardRoot()` detects Wizard/Tabs root nodes, rewrites them to Stack, and extracts `showProgress`/`allowSkip` into `migratedProps`. However, it never sets `pageMode` in the migrated props. When `createDefaultState` calls `Object.assign(formPresentation, migration.migratedProps)`, the resulting `formPresentation` has `showProgress: true` but `pageMode` is undefined — so the form renders as single-page instead of wizard.

**Impact:** Any pre-existing component document with a Wizard root will silently lose its wizard navigation after loading. This is the highest-priority fix.

**Recommended fix:**
1. In `migration.ts`: add `pageMode` to the returned `migratedProps`:
   - Wizard root → `migratedProps.pageMode = 'wizard'`
   - Tabs root → `migratedProps.pageMode = 'tabs'`
2. In `migration.test.ts`: add assertions that `result.migratedProps.pageMode` is set correctly for both Wizard and Tabs migrations.
3. Verify with the example fixtures that already have Wizard roots (e.g., `examples/clinical-intake/intake.component.json` was already migrated to Stack — but any unmigrated fixture would trigger this).

---

### I-02: `MetadataChanges` type mismatches for `pageMode` and `labelPosition` ✅ CONFIRMED + EXPANDED

| | |
|---|---|
| **Severity** | Type mismatch — incorrect type constraints |
| **Files** | `packages/formspec-studio-core/src/helper-types.ts:164-165` |
| **Found by** | formspec-scout |
| **Validated** | CONFIRMED + EXPANDED. Scout found `labelPosition` mismatch at same location. |

**Context:** Two type mismatches in `MetadataChanges`:

1. **`pageMode`** (line 165): Typed as `'tabs' | 'wizard' | 'accordion' | null`. Schema says `'single' | 'wizard' | 'tabs'`. `'accordion'` is invalid; `'single'` is missing.
2. **`labelPosition`** (line 164): Typed as `'top' | 'left' | 'inline' | 'hidden'`. Schema says `'top' | 'start' | 'hidden'`. `'left'` and `'inline'` are not valid schema values; `'start'` is missing.

**Impact:** Studio-core's `setFlow()` helper accepts invalid values (which the schema rejects) and rejects valid ones. Type-level bugs that could cause runtime validation failures.

**Recommended fix:**
- `pageMode`: Change to `'single' | 'wizard' | 'tabs' | null`
- `labelPosition`: Change to `'top' | 'start' | 'hidden' | null`

---

### I-17: `MetadataChanges` missing 5 typed `formPresentation` properties ✅ NEW

| | |
|---|---|
| **Severity** | Type gap — no type safety for valid properties |
| **Files** | `packages/formspec-studio-core/src/helper-types.ts:152-167` |
| **Found by** | formspec-scout (validation pass) |

**Context:** The `_VALID_METADATA_KEYS` set in `project.ts:1610-1614` and `_PRESENTATION_KEYS` accept `showProgress`, `allowSkip`, `defaultTab`, `tabPosition`, and `direction`, but the `MetadataChanges` TypeScript interface does not declare these properties. Callers get no type safety or autocomplete for these properties.

**Recommended fix:** Add to the `MetadataChanges` interface:
```ts
showProgress?: boolean | null;
allowSkip?: boolean | null;
defaultTab?: number | null;
tabPosition?: 'top' | 'bottom' | 'left' | 'right' | null;
direction?: 'ltr' | 'rtl' | 'auto' | null;
```

---

### I-20: `reorderPages` and `movePageToIndex` corrupt tree with interleaved non-Page children ✅ NEW (upgrade of I-12)

| | |
|---|---|
| **Severity** | Bug — tree corruption |
| **Files** | `packages/formspec-core/src/handlers/pages.ts:114-138` |
| **Found by** | formspec-scout (validation pass — upgraded I-12 from test gap to bug) |

**Context:** Both `pages.reorderPages` (lines 114-124) and `pages.movePageToIndex` (lines 127-138) operate on raw `children` array indices. When non-Page children are interleaved (e.g., unassigned bound items), these operations can displace or corrupt non-Page children.

Example: If children are `[Page-A, TextInput(bind=x), Page-B]`, moving Page-A "down" uses `findPageIndex` to get index 0, then swaps with index 1 — which is the TextInput, not Page-B.

**Recommended fix:**
1. Change reorder/move logic to compute adjacent Page indices, skipping non-Page children.
2. Add test with `[Page-A, TextInput(bind=x), Page-B]`, reorder to `[Page-B, Page-A]`, assert TextInput preserved.

---

## P1 — Fix Before Merge (Spec/Schema Consistency)

### I-03: `core-commands.schema.json` has stale Wizard and theme page commands ✅ CONFIRMED + CORRECTED

| | |
|---|---|
| **Severity** | Schema inconsistency |
| **Files** | `schemas/core-commands.schema.json` (lines ~662-694, ~1062) |
| **Found by** | formspec-scout |
| **Validated** | CONFIRMED. Scout corrected 4 handler names in the recommended fix. |

**Context:** The command schema still contains:
- `component.setWizardProperty` (handler was deleted)
- `theme.addPage`, `theme.deletePage`, `theme.reorderPage` (handlers were deleted — pages are now managed by `pages.*` commands)
- None of the 13 `pages.*` handlers appear in the schema

**Impact:** Any tooling that validates commands against this schema will reject the new `pages.*` commands and accept the deleted ones.

**Recommended fix:** Remove the 4 stale command definitions. Add all 13 `pages.*` command definitions (corrected names from actual handler source):

`pages.addPage`, `pages.deletePage`, `pages.setMode`, `pages.reorderPages`, `pages.movePageToIndex`, `pages.setPageProperty`, `pages.assignItem`, `pages.unassignItem`, `pages.autoGenerate`, `pages.setPages`, `pages.reorderRegion`, `pages.renamePage`, `pages.setRegionProperty`

---

### I-04: Component spec prose still references Wizard as active component (~12 normative locations) ✅ CONFIRMED

| | |
|---|---|
| **Severity** | Spec/schema contradiction |
| **Files** | `specs/component/component-spec.md` |
| **Found by** | spec-expert |
| **Validated** | CONFIRMED by both reviewers. All cited line numbers and content verified. Spec-expert notes Appendix A metadata strings (`budget-wizard`, etc.) are cosmetic/informative, not normative — the prose at lines 3142-3144 already correctly describes the new model. |

**Context:** The component schema removed Wizard, but the spec prose still describes it as an active component type. Normative text describes processing requirements for a component that no longer validates. Specific locations:

**S3.4 Nesting Constraints:**
- Line 473: Layout category table lists "Page, Stack, Grid, **Wizard**, Columns, Tabs, Accordion" → remove Wizard
- Line 482: Parenthetical "(e.g., Wizard children MUST be Page components)" → remove or replace example
- Lines 489-490: Rule 3: "**Wizard** children MUST all be `Page` components…" → delete entire rule

**S5.1 Page:**
- Line 744: "When used as children of a Wizard (S5.4), Pages define the wizard steps." → rewrite to reference `formPresentation.pageMode`
- Lines 759-760: "When used inside a Wizard, the Page MUST be shown/hidden according to the Wizard's current step navigation state." → rewrite to use `formPresentation.pageMode: "wizard"`

**S5.4 Wizard (lines 870-924):**
- The entire section is still present with full normative prose, props table, rendering requirements, and JSON example for a component type that no longer exists in the schema.
- → Remove section entirely or replace with a deprecation notice + redirect to `formPresentation.pageMode`

**S12.1 Structural Validation:**
- Line 2987: Check #7: "**Wizard children:** All children of a Wizard are Page components." → remove

**Appendix A (informative — low priority):**
- Lines 3149, 3151, 3153: `name: "budget-wizard"`, `url: ".../wizard"`, description still says "three-step wizard" — cosmetic, but misleading given deprecation.

**Recommended fix:** A single pass through the spec updating all normative locations. The S5.4 section removal is the largest change — it should be replaced with a brief deprecation notice: "The Wizard component type is deprecated. Use `formPresentation.pageMode: 'wizard'` with a `Stack > Page*` tree structure. See Core S4.1.2."

---

### I-05: Component counts stale throughout spec (34→33, 18 Core→17 Core) ✅ CONFIRMED

| | |
|---|---|
| **Severity** | Spec inconsistency |
| **Files** | `specs/component/component-spec.md` |
| **Found by** | spec-expert |
| **Validated** | CONFIRMED by both reviewers at all cited line numbers. |

**Context:** Appendix B was correctly updated to 33 components, but 7 other count references are stale:

| Line | Current | Should be |
|------|---------|-----------|
| 142 | "34 built-in components (18 Core + 16 Progressive)" | "33 built-in components (17 Core + 16 Progressive)" |
| 184 | "18 Core components (S5)" | "17 Core components" |
| 185 | "All 34 components" | "All 33 components" |
| 191 | "all 34 built-in components" | "all 33 built-in components" |
| 717 | Section heading "Core (18)" | "Core (17)" |
| 719 | "18 Core components" | "17 Core components" |
| 3047 | "all 18 Core components (S5)" | "all 17 Core components" |

**Pre-existing note (not this branch):** The component schema has 35 component names (including `SubmitButton` and `ValidationSummary`) while the spec lists 33. This is a pre-existing gap unrelated to the Wizard removal.

**Recommended fix:** Global find-replace in the component spec, changing all instances of "34" → "33" and "18 Core" → "17 Core" in component-count contexts.

---

### I-06: Core spec S4.1.1 missing 5 `formPresentation` properties ✅ CONFIRMED

| | |
|---|---|
| **Severity** | Spec/schema gap |
| **Files** | `specs/core/spec.md` (lines 1891-1915) |
| **Found by** | spec-expert |
| **Validated** | CONFIRMED by spec-expert. Schema types, defaults, and descriptions verified as correct. |

**Context:** The `formPresentation` property table at S4.1.1 lists only 4 properties: `pageMode`, `labelPosition`, `density`, `defaultCurrency`. The schema now has 9:

| Property | In Schema | In Spec | Status |
|----------|-----------|---------|--------|
| `pageMode` | Yes | Yes | OK |
| `labelPosition` | Yes | Yes | OK |
| `density` | Yes | Yes | OK |
| `defaultCurrency` | Yes | Yes | OK |
| `direction` | Yes | No | Pre-existing gap |
| `showProgress` | Yes | No | **New gap** |
| `allowSkip` | Yes | No | **New gap** |
| `defaultTab` | Yes | No | **New gap** |
| `tabPosition` | Yes | No | **New gap** |

**Recommended fix:** Add all 5 missing properties to the S4.1.1 table with descriptions matching the schema.

---

### I-07: Core spec missing S4.1.2 — normative page mode processing requirements ✅ CONFIRMED, NEEDS AMENDMENT

| | |
|---|---|
| **Severity** | Missing normative spec section |
| **Files** | `specs/core/spec.md` |
| **Found by** | spec-expert |
| **Validated** | CONFIRMED, but spec-expert identified the proposed content is **incomplete** and has a **normative tension** that must be resolved. |

**Context:** The design spec (line 107-108) explicitly planned a new S4.1.2 for page mode processing requirements. S4.1.1 says "A conforming processor MAY ignore any or all of these properties" — this advisory framing is incompatible with the MUST-level behavioral requirements that were previously in the Wizard and Tabs component sections.

**Requirements that need a normative home (updated per spec-expert validation):**

Wizard mode (`pageMode: "wizard"`):
- MUST render exactly one Page at a time
- MUST provide Next/Previous navigation
- MUST validate current page before forward navigation unless `allowSkip` is true
- When `showProgress` is `true`, MUST display a progress indicator showing current step and total steps

Tabs mode (`pageMode: "tabs"`):
- MUST render a tab bar with one tab per Page child
- MUST show exactly one Page's content at a time
- MUST allow the user to switch tabs by clicking tab labels
- All Pages MUST remain mounted; tab switching changes visibility, not lifecycle

General:
- When `pageMode` is unsupported: renderers SHOULD fall back to `"single"`
- `showProgress`, `allowSkip` are only meaningful when `pageMode` is `"wizard"`. `defaultTab`, `tabPosition` are only meaningful when `pageMode` is `"tabs"`. Processors MUST ignore inapplicable properties.

**Normative tension to resolve:** The `formPresentation` description says "MUST NOT affect data capture, validation, or submission semantics" and S4.1.1 says "MAY ignore." The wizard validation gate arguably affects validation semantics. Resolution: use a **conditional-MUST pattern**: "A processor that implements `pageMode: 'wizard'` MUST …" — making the section advisory at the feature level but mandatory at the behavior level. Clarify that the page gate is a **navigation constraint** (when errors are surfaced), not a validation change (what constitutes a valid submission).

**Recommended fix:** Write a new S4.1.2 "Page Mode Processing" section using the conditional-MUST pattern, including all 8 MUST-level requirements above.

---

### I-18: `MetadataChanges` missing 5 typed `formPresentation` properties ✅ NEW

(See P0 section — I-17 above. Classified as P0 for type safety, but the missing properties are also a P1 spec-consistency issue.)

---

## P2 — Fix Soon After Merge

### I-08: Dead Wizard checks in FormPreview components ✅ CONFIRMED, PATHS CORRECTED

| | |
|---|---|
| **Severity** | Dead code |
| **Files** | `packages/formspec-studio/src/chat/components/FormPreview.tsx:298`, `packages/formspec-studio/src/chat-v2/components/FormPreviewV2.tsx:259` |
| **Found by** | formspec-scout |
| **Validated** | CONFIRMED. Scout corrected file paths (not in `workspaces/preview/` but in `chat/components/` and `chat-v2/components/`). Note: the `|| node.component === 'Tabs'` branch at same line is still valid — only the Wizard branch is dead. |

**Context:** Both preview components have a branch that checks `if (node.component === 'Wizard')`. Since no component tree can produce a Wizard node after the refactor, this code is unreachable.

**Recommended fix:** Remove only the Wizard branch from both files (keep the Tabs branch).

---

### I-09: Stale comments reference "Wizard/Tabs wrapper" ✅ CONFIRMED, PATH CORRECTED

| | |
|---|---|
| **Severity** | Misleading comments |
| **Files** | `packages/formspec-studio/src/workspaces/editor/EditorCanvas.tsx:106,115` |
| **Found by** | formspec-scout |
| **Validated** | CONFIRMED. Scout corrected path (not `workspaces/canvas/` but `workspaces/editor/`). Line 106: "The reconciler may build a Wizard/Tabs wrapper when theme pages exist." Line 115: "Structural wrapper (Wizard Page node) — unwrap to children." |

**Context:** Comments describe "Wizard/Tabs wrapper" logic that no longer applies. The tree is always `Stack > Page*`.

**Recommended fix:** Update comments to reflect the current model.

---

### I-10: Storybook wizard story uses deprecated Wizard root ✅ CONFIRMED

| | |
|---|---|
| **Severity** | Broken fixture |
| **Files** | `packages/formspec-webcomponent/stories/src/stories.ts:682` |
| **Found by** | formspec-scout |

**Context:** The wizard storybook story creates a component document with `"component": "Wizard"` as the tree root. This will fail schema validation and will not render correctly since `WizardPlugin` was removed from the component registry.

**Recommended fix:** Update to `Stack > Page*` with `formPresentation: { pageMode: 'wizard', showProgress: true }`.

---

### I-11: Tailwind and USWDS wizard adapters naming ✅ CONFIRMED, DOWNGRADED to P3

| | |
|---|---|
| **Severity** | Design note (not dead code) |
| **Files** | `packages/formspec-adapters/src/tailwind/wizard.ts`, `packages/formspec-adapters/src/uswds/wizard.ts` |
| **Found by** | formspec-scout |
| **Validated** | DOWNGRADED. Scout confirmed these are **actively used** by `renderPageModeWizard` in `emit-node.ts:290-302`, which synthesizes a `{ component: 'Wizard' }` object and calls `globalRegistry.resolveAdapterFn('Wizard')`. Not dead code. |

**Context:** The adapters are the active rendering implementation for page-mode wizard. The file names and registration key (`'Wizard'`) are confusing given the schema deprecation, but the code is correct and functional.

**Recommended fix (P3):** Consider renaming/adding comments to clarify these style the page-mode wizard, not a schema-level Wizard component. No functional change needed.

---

### I-12: (UPGRADED to P0 — see I-20 above)

---

### I-13: Mode-specific renderers have no dedicated unit tests ✅ CONFIRMED

| | |
|---|---|
| **Severity** | Test gap |
| **Files** | `packages/formspec-studio/src/workspaces/pages/WizardModeFlow.tsx`, `TabsModeEditor.tsx`, `SingleModeCanvas.tsx` |
| **Found by** | formspec-scout |

**Context:** The PagesTab was split into three mode-specific renderers. PagesTab integration tests cover them indirectly (and pass), but there are no isolated tests for each renderer's specific behavior (e.g., WizardModeFlow's step numbering, TabsModeEditor's ARIA attributes, SingleModeCanvas's preserved-pages notice logic).

**Recommended fix:** Write unit tests for each renderer. Low urgency since the PagesTab integration tests provide reasonable coverage.

---

### I-19: Python README references stale E805 lint code ✅ NEW

| | |
|---|---|
| **Severity** | Stale documentation |
| **Files** | `src/formspec/README.md:193` |
| **Found by** | formspec-scout (validation pass) |

**Context:** The Python package README lists `E805: Wizard children must be Page` as a lint error code. The Rust linter has no Wizard references (E805 was deleted in this branch). The Python README is stale.

**Recommended fix:** Remove the E805 line from the README.

---

## P3 — Future Work

### I-14: `pageMode: 'tabs'` has no rendering implementation in webcomponent ✅ CONFIRMED

| | |
|---|---|
| **Severity** | Feature gap |
| **Files** | `packages/formspec-webcomponent/src/rendering/emit-node.ts:267` |
| **Found by** | formspec-scout |

**Context:** The webcomponent has `isPageModeWizard()` + `renderPageModeWizard()` for wizard detection and rendering. There is no equivalent `isPageModeTabs()` + `renderPageModeTabs()`. When `pageMode` is `'tabs'`, the Stack renders as a plain Stack — tabs behavior does not appear.

**Recommended fix:** Implement `renderPageModeTabs` in the webcomponent, analogous to the wizard path. This synthesizes tabbed navigation around Page children. This is a feature-level effort for a separate branch.

---

### I-15: Playwright E2E tests for three visual modes not written ✅ CONFIRMED

| | |
|---|---|
| **Severity** | Test gap |
| **Files** | `packages/formspec-studio/tests/e2e/playwright/` |
| **Found by** | formspec-scout (confirmed by plan "Remaining Work") |

**Context:** The implementation plan noted E2E browser tests as remaining work. The three PagesTab modes (single canvas, wizard step flow, tabs editor) should have Playwright tests verifying mode switching, DnD, and visual state.

**Recommended fix:** Write E2E tests in a follow-up branch.

---

### I-16: Naming asymmetry between component-level and definition-level properties ✅ CONFIRMED

| | |
|---|---|
| **Severity** | Design note (no action required) |
| **Files** | `schemas/definition.schema.json`, `schemas/component.schema.json` |
| **Found by** | spec-expert |

**Context:** The Tabs component uses `position` for tab placement. The `formPresentation` equivalent is `tabPosition`. This rename is justified (avoids ambiguity at the definition level), but should be documented in the spec to avoid author confusion. Consider a note in the S4.1.2 section when it is written.

---

## Pre-existing Issues (Not Introduced by This Branch)

These were discovered during review but are not regressions:

1. **`formPresentation.direction`** missing from Core spec S4.1.1 — pre-dates this branch.
2. **Component schema has 35 built-in names** (including `SubmitButton` and `ValidationSummary`) but spec Appendix B and cross-spec contract test list 33 — pre-existing spec/schema gap.

---

## Action Plan

| Priority | Issues | Scope | Approach |
|----------|--------|-------|----------|
| **P0** | I-01, I-02, I-17, I-20 | 4 bugs in 3-4 files | Surgical fixes with red-green-refactor |
| **P1** | I-03 through I-07, I-18 | Spec prose + schema + types | Single spec/schema consistency pass |
| **P2** | I-08, I-09, I-10, I-13, I-19 | Dead code + stale refs + tests | Code cleanup pass |
| **P3** | I-11, I-14, I-15, I-16 | Feature work + design notes | Separate branch(es) |
