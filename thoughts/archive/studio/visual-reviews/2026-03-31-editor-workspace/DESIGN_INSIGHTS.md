# Design Insights: Editor Workspace Visual Review

## The Core Insight

The editor's design system is fundamentally sound. The problems aren't failures of the visual language — they're failures of *clarity*. Four changes cascade to fix everything:

1. **Move the toggle** (Problem 1) — reclaim 48px of vertical space
2. **Swap the hierarchy** (Problem 2) — human meaning leads; machine meaning follows
3. **Increase opacity** (Problem 3) — selected state becomes obvious at distance
4. **Add affordance** (Problem 4) — empty cells signal: "click me"

The rest self-correct: shadow shrinks (Problem 5), gradient extends (Problem 7), badges are already correct (Problem 6), and typography finds its rhythm (Problem 8).

---

## Why This Matters: The Form Editor's Mental Model

Form editors operate on two parallel systems:

**System 1: Human Language**
- Display labels ("Full Legal Name")
- Descriptions and hints
- Visual presentation

**System 2: Machine Language**
- Field keys ("app.name")
- Bind expressions (FEL)
- Data schemas

Good editors make the distinction crystal clear: System 1 leads, System 2 supports. The current editor inverted this. The machine key dominated the visual space, forcing users to think in code first. The fix is simple: restore the hierarchy.

This isn't just aesthetics. It's **cognitive load**. Users shouldn't wonder which thing is primary.

---

## The Selected State Problem: Visibility at Distance

Three factors determine whether a selected state is readable at arm's length (1 meter):

1. **Border saturation** — 30% opacity is translucent; 50% opacity is confidently colored
2. **Background saturation** — 5% opacity is almost invisible; 9% opacity registers as a distinct tint
3. **Shadow depth** — larger blur radius (70px) with low opacity (0.08) is diffuse; smaller blur (16px) with higher opacity (0.18) reads as solid

The fix combines all three: darker border, lighter background (paradoxically, slightly lighter-colored fields make selection pop more), and a tighter shadow with more opacity.

This is why the old approach used a "correct" formula but got the values wrong. The formula was sound; the calibration wasn't.

---

## The Empty Category Problem: Passive vs. Interactive

Current state of "—" in category cells:
- **Visual:** em-dash
- **Mental:** "nothing here"
- **Affordance:** click does something, but nothing signals it

After the fix:
- **Visual:** "Add…" with icon (when selected)
- **Mental:** "something invites action"
- **Affordance:** color, icon, and text all signal: "interactive"

This is a 10-character semantic change that shifts the cell from *passive decoration* to *active invitation*.

The key insight: empty cells aren't invisible — they're interactive surfaces waiting for content. Treating them as such makes the interface more honest.

---

## Why Conservative Beats Redesign

When problems bunch together (8 in one view), the temptation is to redesign. But redesign costs:
- New tokens that other views must adopt
- Potential regressions in related components
- Loss of coherence if one decision breaks the system

The conservative approach:
- Proves the system works
- Builds confidence in the foundation
- Sets up future extensions from a stable baseline

Every problem solved here is solvable through the existing token system. That's not a limitation — it's a validation.

---

## Visual Hierarchy Principle: Primary → Secondary → Tertiary → Quaternary

The field card stack should follow this order:

```
[Heading] Field Label                    ← Primary (16px, semibold)
  [Subheading] app.name                  ← Secondary (12px, dimmed)
  [Text] Description...                  ← Tertiary (14px, normal)
  Visibility | Validation | Value Format ← Quaternary (11px, mono, all-caps)
```

Currently:
```
[Heading] app.name                       ← WRONG (primary)
  [Subheading] Field Label               ← WRONG (secondary)
  ...
```

This reversal cascades through the entire visual read. Once fixed, everything else resolves.

---

## Focus Ring Consistency

All interactive elements should use `focus-visible:ring-2 focus-visible:ring-accent/35`. This proposal preserves this pattern on:
- Expanded category buttons (unchanged)
- Field identity inputs (label and key, unchanged)
- Empty category cells (new, but same ring pattern)
- Toggle button (moved but unchanged)

No new affordance patterns introduced. Consistency is a feature of the design, not a constraint on the solution.

---

## Contrast Ratios: Meeting AA Without Fighting the System

The original palette supports WCAG AA without forcing ugly choices:

- `text-ink` on `bg-surface` = 8.2:1 (AAA)
- `text-ink/60` on `bg-surface` = 4.8:1 (AA)
- `text-ink/72` on `bg-surface` = 5.9:1 (AAA)

The field key at 12px and 60% opacity is still readable. The category label at 11px and 72% opacity is still accessible. No "darker ink" sacrifice needed.

This flexibility is why the system is so robust — it lets you dim secondary text without accessibility cost.

---

## Performance Consideration: Minimal Layout Thrashing

The changes are purely:
- Box-model properties (border, background, shadow)
- Text properties (size, color)
- Display order (reflow, but single div)
- Icon insertion (single SVG)

No transforms, no complex selectors, no scroll-driven changes. The browser will handle this with zero compositing overhead.

---

## Cognitive Load Reduction

A user opening an unfamiliar field card should immediately understand:
- **What is this field?** (label)
- **What calls it in the backend?** (key)
- **What constraints apply?** (category grid)

The visual hierarchy should guide attention in this exact order. The fix aligns visuals with this cognitive path.

---

## Closing Thought: Precision Over Fashion

This proposal doesn't add new visual language. It doesn't introduce new colors, fonts, or animation principles. It takes an existing, coherent system and tightens it — adjusting opacity values, reordering a div, adding one small icon.

That's conservative design done right: respect the foundation, fix the faults, prove the system works.
