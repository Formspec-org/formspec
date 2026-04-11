# Editor Workspace Visual Design — Adjudication

**Date:** 2026-03-31
**Adjudicator:** Formspec Visual Designer
**Proposals reviewed:** Conservative, Evolutionary, Density

---

## Method

All three proposals and the handoff brief were read in full before any scoring began. The adjudication applies the Visual Domino Method in compressed form: visualize the proposed rendering, trace the domino chains, verify each success criterion, then deliver a single verdict.

---

## Comparative Analysis

### Success Criterion Scores

| Criterion | Conservative | Evolutionary | Density |
|-----------|-------------|-------------|---------|
| **SC1: Label first, unambiguous hierarchy** | PASS — label at 16px semibold above 12px mono key. Hierarchy swap is clean. | PASS — identical label/key treatment (16px above 12px), adds `mt-2` baseline alignment that gives key better spatial separation. | PARTIAL — label is first at 16px, but key placement "on same line with separator" (the inline connector dot) is ambiguous. Inline adjacency blurs the weight difference that stacking creates. |
| **SC2: Selection unambiguous at arm's length** | PASS — `border-accent/50 bg-accent/[0.09] shadow-[0_8px_24px_rgba(59,130,246,0.18)]`. All three signals (border, bg, shadow) are present and calibrated. | PASS — `border-accent/50 bg-accent/[0.09] shadow-[0_8px_20px_rgba(37,99,235,0.18)]`. Functionally identical to Conservative; shadow opacity is marginally different (0.18 each). | PARTIAL — Same opacity values but proposes `border-radius: var(--radius-DEFAULT)` (4px) on item rows instead of the existing `rounded-[18px]`. This is a structural change to card geometry that violates the constraint requiring preservation of existing radius conventions (`rounded-[10px]` for buttons; field cards use `rounded-[18px]`). Also uses `color-mix()` which requires Tailwind v4 CSS-native color mixing — this may not be available in the current build setup. |
| **SC3: Empty categories invite interaction** | PASS — "Add…" with plus SVG icon at `text-accent/40`, brightens to `text-accent/60` on hover, ring added. Matches the `supportingText` pattern already in the file. Persistent when selected. | PASS — `CategoryCell` component renders "Add [category]…" italic with `ring-1 ring-empty` persistent when `showAffordance`. Ring is always visible (not just hover) — this is marginally stronger than Conservative. Empty state text uses `.text-empty` utility. | PASS — "Add X..." italic placeholder with hover ring. Wraps each category cell in a full bordered `rounded-[3px]` container even in default state, which adds persistent borders to all categories. This is a density trade-off: visually noisier at rest, clearer affordance shape. |
| **SC4: Canvas begins immediately after app header** | PASS — removes sticky band, moves toggle into DefinitionTreeEditor card header alongside title. Toggle receives `activeEditorView`/`onViewChange` as props passed from Shell. | PASS — same structural move. Explicit about prop threading: `DefinitionTreeEditor` receives `activeEditorView`, `onEditorViewChange`, `manageCount`. Adds `interface DefinitionTreeEditorProps` — cleaner API definition. Also explicitly shows the conditional render (`{onEditorViewChange && <BuildManageToggle />}`) which is safer than assuming the prop is always present. | PASS — same structural intent. However, adds an "Active selection" badge pill next to the toggle in the titlebar header when `selectedSummary` exists. This badge introduces new UI chrome that wasn't in the original design and wasn't specified in the brief — out-of-scope addition. |
| **SC5: Form Health panel doesn't distract** | PASS (with a caveat) — notes that the current amber implementation is "already correct" and verifies it. Correctly identifies no change needed. However, the brief specifically references a "6 errors" badge in `text-error` red that the proposal acknowledges may or may not exist. The proposal's verification is conditional: "if a count badge exists, change it." This is incomplete — it doesn't confirm the badge's actual state. | PASS (same caveat) — also observes amber is already correct and calls the problem "a red herring in the brief." This is an honest assessment, but like Conservative it doesn't resolve the question of whether any `text-error` badges actually exist in the response document section. Neither proposal goes far enough to trace the actual DOM. | PASS — same conclusion as the other two. All proposals agree on amber. None definitively resolves whether there are additional red badges outside the already-amber issue cards. |

---

### Addresses All Problems

| | Conservative | Evolutionary | Density |
|---|---|---|---|
| P1: Sticky toggle | Addressed | Addressed | Addressed |
| P2: Key/label hierarchy | Addressed | Addressed | Addressed (partially — inline layout) |
| P3: Selected state | Addressed | Addressed | Addressed (border-radius violation) |
| P4: Empty affordance | Addressed | Addressed | Addressed |
| P5: Master card shadow | Addressed (0_4px_16px) | Addressed (0_4px_16px) | Addressed (removed entirely) |
| P6: Form Health badges | Addressed (conditionally) | Addressed (conditionally) | Addressed (conditionally) |
| P7: Manage gradient | Addressed | Addressed | Addressed |
| P8: Typography scale | Addressed (self-corrects after P2) | Addressed (formal token system) | Addressed (formal 4-level scale) |
| **Problems fully addressed** | 7.5 / 8 | 7.5 / 8 | 6.5 / 8 |

---

### Respects All Constraints

| Constraint | Conservative | Evolutionary | Density |
|------------|-------------|-------------|---------|
| Tier 1 editing only | Yes | Yes | Yes |
| Separate key/label affordance paths | Yes | Yes | Yes — but key edit path is now a button wrapping an EditMark, changing the click mechanism |
| Display items visually distinct | Yes | Yes | Mentioned but not explicitly addressed |
| Category semantic groupings preserved | Yes | Yes | Yes |
| `focus-visible:ring-2 focus-visible:ring-accent/35` | Yes | Yes | Yes |
| ARIA attributes preserved | Yes | Yes | Ambiguous — key edit button adds a new `button` wrapper with `aria-label="Edit key"` which is fine, but the structural change may affect existing test IDs |
| WCAG AA compliance | Yes — contrast ratios checked | Yes — uses `.text-empty` at ink/35 italic which is below AA at 11px, but this is acceptable for decorative placeholder text | Ambiguous — `color-mix()` syntax in CSS is used for state tokens but the `/ 0.15` operator is not standard CSS `color-mix()` syntax; it appears to be pseudo-code |
| `compactLayout` at ≤1024px | Yes — explicitly addressed | Yes — explicitly addressed | Mentioned but changes to item row padding (`py-2.5`) and category cell padding could break the stacked mobile layout |
| Touch targets ≥44px | Yes | Yes — notes `min-h-[44px]` for category cells as future work | Ambiguous — reduces row padding `py-4` → `py-2.5` which may reduce touch targets below 44px on mobile |
| Accent color / logic color / green / fonts preserved | Yes | Yes | Yes |
| `rounded-[10px]` radius convention | Yes | Yes | NO — proposes `border-radius: var(--radius-DEFAULT)` (4px) on item rows, overriding the `rounded-[18px]` convention |
| Design system elements preserved | Yes | Yes | Partial — introduces `color-mix()` CSS functions that may not align with the Tailwind token approach |
| **Constraints respected** | All | All | 2 violations |

---

### Design Coherence

| | Conservative | Evolutionary | Density |
|---|---|---|---|
| Score | 4/5 | 5/5 | 3/5 |
| Notes | Coherent throughout. One weakness: the inline SVG plus icon in the category affordance is a micro-component that introduces SVG markup inline in what is otherwise a className-based system. A minor inconsistency. Also the typography "self-corrects" framing for P8 is slightly hand-wavy — it works, but leaves no artifact to maintain. | Most coherent of the three. The CategoryCell extraction creates a reusable pattern. The type-scale tokens in index.css create a maintainable artifact. The interaction state tokens in index.css make the selection state system explicit and extensible. The prop API for DefinitionTreeEditor is clean. The bonus findings section correctly defers future work without including it in scope. | The density-first direction imposes an IDE aesthetic that conflicts with the brief's explicit "comfortable density" intent. The "zero visual waste" principle produces row height reduction (py-2.5 from py-4) that undercuts the spacing guidance in Section 5. The "grid-like surface" aesthetic removes the rounded card language that is core to the design system. This is a coherent direction, but it is the wrong direction for this tool. |

---

### Implementation Feasibility

| | Conservative | Evolutionary | Density |
|---|---|---|---|
| Score | 4/5 | 5/5 | 2/5 |
| Notes | Clean, safe changes. One minor concern: the inline SVG icon approach for the category affordance is not a pattern used elsewhere in the codebase — it adds a dep on inline SVG where a Lucide or similar icon import would be more consistent. Otherwise all changes are straightforward. | Clean, safe, and well-phased. The CategoryCell extraction is the right move — it creates a stable pattern that can absorb future category changes without touching SummaryColumn. The three-phase implementation order (Layout → Tokens → Components) correctly sequences risk. Token changes in index.css are additive and don't break existing Tailwind JIT scanning. | The `color-mix()` CSS syntax as written (`var(--color-accent, #2563eb) / 0.15`) is not valid standard CSS and will not work in any browser. It appears to be pseudo-code notation mixed with CSS. This is a substantive implementation defect. The border-radius change to 4px is a functional regression against the existing design system. The density reduction (`py-2.5`) will require retesting mobile layout. These are not polish issues — they're blockers. |

---

## The Verdict

### Winner: Evolutionary

The Evolutionary proposal is the winner. It is the only proposal that:

1. Solves all eight problems through the first domino (not symptoms)
2. Respects every design constraint without violations
3. Creates reusable artifacts (CategoryCell, type scale tokens, state tokens) that make the system more maintainable after the fix
4. Has a clean, executable three-phase implementation plan with no implementation defects
5. Is honest about what is already correct (Problem 6: amber is already right) rather than proposing changes for their own sake

The Conservative proposal is technically correct — all its changes are sound — but it leaves two gaps: the typography "self-corrects" assertion for Problem 8 produces no token artifact, and the inline SVG approach for Problem 4 is inconsistent with the codebase's icon patterns. These are minor, not blocking.

The Density proposal has two hard violations (border-radius convention, `color-mix()` syntax defects) and one directional violation (reducing row padding against the brief's explicit spacing intent). It cannot be recommended.

---

### Cherry-Picks from Losing Proposals

**From Conservative, cherry-pick:** Nothing additional. Conservative's solutions are all present in or equivalent to Evolutionary's solutions. The one divergence — Conservative's inline SVG icon for the category "Add…" affordance — should NOT be cherry-picked. Evolutionary's plain italic text placeholder without an icon is cleaner: it avoids inline SVG, avoids an icon dependency, and the visual weight difference (italic, dimmed text vs. bold filled text) is sufficient to communicate the empty/interactive state without a redundant plus glyph. Icons in text content at 14px get lost or feel noisy.

**From Density, cherry-pick ONE element:** The phase-structured implementation checklist (Phase 1 through Phase 5 with explicit items) is better organized than Evolutionary's three-phase ordering. Specifically: Density correctly identifies that typography and selection state changes should be tested separately before being combined. Cherry-pick the pattern of verifying WCAG AA after each phase rather than only at the end.

---

### Remaining Concerns with the Winner

**Concern 1: Problem 6 is unresolved by proxy**

Both the Conservative and Evolutionary proposals note that `FormHealthPanel.tsx` "already uses amber" and declare the problem solved by observation. But the handoff brief explicitly references a "6 errors" badge in `text-error` red in the response document section — a separate section from the issue cards. Neither proposal traces this to the actual DOM or code. The adjudicated winner should add an explicit verification step: grep `FormHealthPanel.tsx` for `text-error` and `text-red` to confirm whether any red badges exist outside the already-amber issue cards. If they exist, change them to `text-amber-600`. If not, the concern is truly closed. Do not declare it closed by assumption.

**Concern 2: CategoryCell empty state ring is always visible**

Evolutionary's `CategoryCell` renders `ring-1 ring-empty` whenever `showAffordance` is true — that is, whenever the field is selected and the value is empty. This means on a freshly selected field with four empty categories, all four cells simultaneously show a blue ring. This is mildly noisy at first glance: the user sees four blue rings instead of just "the field is selected." Compare to Conservative's approach where the ring only appears on hover. The preferable behavior: show the italic "Add [category]…" placeholder text persistently (which is correct — it communicates interactivity through text), but apply the ring only on hover. This reduces ambient noise on initial selection while preserving discoverability.

**Fix:** In CategoryCell, change `showAffordance ? 'ring-1 ring-empty' : ''` to `showAffordance ? 'hover:ring-1 hover:ring-empty' : ''`. The italic text placeholder already communicates the state; the ring is a hover refinement.

**Concern 3: DefinitionTreeEditor prop API needs a decision**

The Evolutionary proposal correctly introduces `DefinitionTreeEditorProps` to thread the toggle into the component. However, it uses optional props with defaults (`activeEditorView = 'build'`) and a conditional render (`{onEditorViewChange && <BuildManageToggle />}`). This means if Shell.tsx fails to pass the props, the toggle silently disappears. The prop should not be optional — if the toggle is now inside the card header, it should always be there. Make `activeEditorView` and `onEditorViewChange` required props, or hoist the state into DefinitionTreeEditor itself if it owns the view state. The current optional approach creates a silent failure mode.

---

### Implementation Priority

Ordered by visual impact — highest first:

1. **Problem 1: Remove sticky toggle band and move into DefinitionTreeEditor header** (Shell.tsx, DefinitionTreeEditor.tsx) — highest visual impact, frees 48px, changes the first thing the eye sees when opening the editor

2. **Problem 2: Swap label/key hierarchy in ItemRowContent.tsx** — second highest impact; this is the core cognitive mismatch. Every field card in the editor is wrong until this is fixed.

3. **Problem 3: Update selected-state tokens in ItemRow.tsx** — three class value changes. High impact relative to effort: the arm's-length test goes from fail to pass.

4. **Problem 5: Reduce master card shadow in DefinitionTreeEditor.tsx** — one value change, reduces the visual noise that competes with field card elevation.

5. **Problem 4: Create CategoryCell.tsx; update SummaryColumn** — creates the empty-state affordance pattern. Apply the ring-on-hover-only correction from Concern 2 above.

6. **Problem 8: Add type scale tokens to index.css** — additive, low-risk, creates the maintainable artifact. Should happen alongside (not after) Problems 2 and 4 since those components will reference the new tokens.

7. **Problem 7: Extend warm gradient to Manage view in Shell.tsx** — one condition change, quick.

8. **Problem 6: Verify FormHealthPanel for remaining text-error usages** — grep before touching; only change if red badges actually exist outside the already-correct amber issue cards.

---

## Implementation Notes for Engineering

- **Do not use `color-mix()` in CSS** for state tokens unless you confirm the build target supports it. The current Tailwind opacity modifier syntax (`bg-accent/[0.09]`, `border-accent/50`) is correct and cross-browser. Stick to Tailwind opacity modifiers throughout.
- **CategoryCell should import from a project icon library** (Lucide React or whatever the studio uses), not define inline SVG, if an icon is desired. Per the adjudication above: prefer the plain italic text approach (no icon) in the category affordance.
- **Test the DefinitionTreeEditor toggle placement on mobile (≤1024px compactLayout).** The sticky band currently stacks above the scrollable canvas; moving the toggle into the card header may affect how it appears in the three-column mobile stack. The toggle must remain reachable without scrolling.
- **Run WCAG contrast checks after each phase**, not only at the end. Specifically: `text-ink/68` (key color in Evolutionary) at 12px → approximately #747474 on white = 4.7:1, which passes AA. `.text-empty` at ink/35 italic is intentionally below AA — this is acceptable for placeholder/hint text that is not essential for understanding content, but document this exception explicitly.
- **Type scale tokens**: Register in `index.css` under `@theme inline` (not bare `:root`) to ensure Tailwind's JIT scanner picks them up as CSS custom properties for use in `text-[var(--font-size-label)]` patterns. Verify the Tailwind config supports arbitrary CSS variable usage in class names.
