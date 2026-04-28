# Formspec Studio — Visual Design Specification

> **Archived 2026-04-28.** Stale — the amber `#D4A34A` accent and `Plus Jakarta Sans` UI font specified here have been superseded by the current token system in [`packages/formspec-studio/src/index.css`](../../../packages/formspec-studio/src/index.css) (blue `--studio-color-accent: #3759c8`, `Space Grotesk` UI font). `Fraunces` and `JetBrains Mono` did land. Live visual direction follows the user's frontend design hard-rules memory + current CSS tokens, not this doc.

## Audience & Context

Primary users are **federal government employees** — grants program officers, compliance staff, and agency IT teams — who configure forms for public-facing programs. They work in institutional environments with mandated accessibility, often on standard-issue laptops with 1920×1080 displays.

The tool must feel **modern, sharp, and trustworthy** — not consumer-playful, not corporate-bland. Think: the confidence of Bloomberg Terminal meets the clarity of Linear.

---

## Design Direction: "Federal Precision"

A dark professional workspace with controlled warmth. Every element earns its place.

**Tone:** authoritative, precise, modern, warm-not-cold, tool-not-toy

**Inspirations:** Bloomberg Terminal (information density, dark pro-tool UI), Linear (sharp typography, purposeful space), Figma (contextual properties, clean iconography), VS Code (dark editor palette without fatigue)

**Not this:** Not consumer SaaS (no decorative gradients, no rounded-everything). Not brutalist. Not "government ugly" — the point is proving gov tools can look as good as anything.

---

## Color System

### Dark theme (V1)

```
Background hierarchy (darkest → lightest):
  --bg-0: #0E1117          Canvas / deepest background
  --bg-1: #161B22          Panel backgrounds (sidebar, properties)
  --bg-2: #1C2128          Elevated surfaces (cards, dropdowns, inline forms)
  --bg-3: #252C35          Hover states, toggle backgrounds
  --bg-active: #2D3540     Active/pressed states

Text hierarchy:
  --text-0: #E6EDF3        Primary (headings, labels, selected items)
  --text-1: #9BA4AE        Secondary (descriptions, metadata)
  --text-2: #545D68        Tertiary (placeholders, disabled) — decorative only, not for readable text
  --text-3: #353C45        Ghost (hints, decorative)

Primary accent — Warm Amber:
  --accent: #D4A34A        Primary actions, active indicators, focus rings
  --accent-hover: #E0B45C  Hover state
  --accent-dim: #8B6E35    Muted accent (inactive indicators)
  --accent-bg: rgba(212, 163, 74, 0.08)   Selection backgrounds
  --accent-bg-strong: rgba(212, 163, 74, 0.14)  Active tab backgrounds

Semantic:
  --success: #3FB950       Valid, configured, passing
  --warning: #D29922       Caution, draft, info-level diagnostics
  --error:   #DA3633       Errors, blocking, destructive
  --info:    #58A6FF       Informational, links

Borders:
  --border-0: #1B2028      Subtle dividers (between panels)
  --border-1: #262E38      Standard (inputs, cards)
  --border-2: #353D48      Emphasized (hover states)
  --border-focus: #D4A34A  Focus ring (matches accent)
```

### Why amber?

Government tools are drowning in blue. Amber signals "builder tool, not public-facing form" — backstage, not front-of-house. The warmth reduces eye strain in extended dark-UI sessions.

### Light theme

Future. Invert backgrounds to white/gray, keep amber accent, darken text. Not specified for V1.

---

## Typography

### Font stack

```
Display:  'Fraunces', Georgia, serif
  — Variable serif. ONLY for the Studio wordmark and the form title in tree header.

UI:       'Plus Jakarta Sans', system-ui, -apple-system, sans-serif
  — Geometric sans. Weights: 400 (body), 500 (labels), 600 (emphasis), 700 (headings).

Code:     'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace
  — For field keys, FEL expressions, JSON editor, diagnostic paths.
```

### Type scale

Base: 13px / 1.5 line-height. Scale from there:
- **Form title:** ~17px Fraunces Medium
- **Section headings:** ~10.5px uppercase, letter-spaced
- **Tree node labels:** base size, medium weight
- **Data type badges:** ~10px monospace
- **Property labels/inputs:** slightly smaller than base
- **JSON editor:** ~12.5px monospace, 1.6 line-height

### Rules

1. Fraunces is display-only. Never for body text, labels, or inputs.
2. All FEL expressions, field keys, JSON, and paths use monospace. No exceptions.
3. Section headings are always uppercase with letter-spacing.
4. Line-height 1.5 for body text. Tighter (1.2–1.3) for headings only.

---

## Layout

### Four-zone collapsible workspace

```
┌──────────────────────────────────────────────────────────────────┐
│ Topbar                                                            │
├────┬────────────────────┬───────────────────┬────────────────────┤
│ ◆  │  Tree Editor        │  Live Preview     │  Properties       │
│ ◇  │  (structure)        │  (rendered form)  │  + Diagnostics    │
│ ◈  │                     │                   │                   │
│ ⬡  │  ← selection syncs →                   │  ← collapsible →  │
│ ▢  │                     │                   │                   │
│ ▤  │  Guided | JSON      │                   │  Props | Diags    │
└────┴────────────────────┴───────────────────┴────────────────────┘
```

| Zone | Default Width | Background | Collapsible |
|------|--------------|-----------|-------------|
| Sidebar | ~48px (icon-only) | --bg-1 | Expands to ~180px |
| Tree editor | flex (shared) | --bg-0 | No |
| Live preview | flex (shared) | --bg-0 | Swaps to overlay <1280px |
| Properties | ~320px | --bg-1 | Yes, to zero |
| Topbar | 100% × 48px | --bg-1 | No |

**Resizable divider** between tree and preview, default 50/50 split.

### Sidebar

Icon-only by default (~48px). Each artifact tab shows an icon and configured/unconfigured status indicator. Tooltip labels on hover. Click to expand to full labels (~180px).

- **Active tab:** Accent background, accent text, left accent border.
- **Inactive configured:** Success indicator (✓).
- **Inactive unconfigured:** Ghost indicator (—).
- **Hover:** Elevated background.

### Properties panel

Right panel with two tabs: **Properties** and **Diagnostics**.

- Collapsible via toggle button. When collapsed, a small button on the right edge opens it.
- **Properties tab:** Context-sensitive editor for selected tree/preview node.
- **Diagnostics tab:** Normalized validation results with severity count badge.

### Responsive behavior

| Viewport | Behavior |
|----------|----------|
| 1440+px | All four zones visible, comfortable spacing |
| 1280–1439px | All visible. Properties panel starts collapsed |
| 1024–1279px | Preview becomes toggleable overlay or tab |
| <1024px | "Desktop required" message |

---

## Tree Editor

The tree is the primary structural editing surface. Fast, scannable, forgiving.

### Node anatomy

```
┌──────────────────────────────────────────────────────────────────┐
│ [⠿] [▸] ● Label Text                     string  *   ↑  ↓  ×  │
│ grip tog dot label                        badge  bind  actions  │
└──────────────────────────────────────────────────────────────────┘
```

**Default state:** Type dot (color by type), label, data type badge, bind indicators (⚡ relevant, * required, ƒ calculate, ✓ constraint). Grip handle, key text, and action buttons are hidden.

**Hover:** Elevated background. Grip handle, key text (monospace, reduced opacity), and actions fade in.

**Selected:** Accent selection background, left accent border. Key text and actions visible. Properties panel populates.

**Depth:** Indentation per level. Subtle vertical guide lines connect parent-child relationships.

### Node type colors

```
Field:   #D4A34A (amber — primary objects, matches accent)
Group:   #5A8FBB (steel blue — containers, structural)
Display: #706C68 (warm gray — secondary, informational)
```

### Data type badge colors

Muted tones — badges don't compete with labels:

```
string/text:              default (--text-1 on --bg-3)
integer/decimal/number:   #5AAFBB (teal)
boolean:                  #5FAF5F (green)
date/dateTime/time:       #C47AB0 (soft purple)
choice/multiChoice:       #D48A4A (warm orange)
money:                    #5FAF5F (green)
uri:                      #5ABBB0 (teal-cyan)
attachment:               #706C68 (gray)
```

### Smart inline add

Hover between nodes reveals a faint dashed insertion line with "+". Click to open inline creation:

```
  ● Full Name           string  *
  ┌──────────────────────────────────────────────┐
  │ [Phone Number     ] [field ▾]  [↵]  [×]     │
  └──────────────────────────────────────────────┘
  ● Email Address       string
```

- Auto-focused text input for label. Key auto-derived.
- Type dropdown defaults to `field`. Options: field, group, display.
- Enter creates, Escape cancels. New node selected after creation.
- Persistent `+ Add` at the end of each group's children.
- Inline form uses elevated surface background, standard border, subtle shadow.

### Drag-and-drop reorder

- **Grab handle** (⠿ grip) appears on hover, left of toggle arrow.
- **Vertical drag** to reorder within same parent.
- **Drop into group** to reparent — group highlights as valid drop target.
- **Insertion indicator:** Horizontal line in accent color at drop position.
- **Drag appearance:** Reduced opacity, slight elevation shadow.
- **Group drag** moves the group with all children.
- Up/down buttons remain as keyboard-accessible fallback.

### Tree header

Root node at top of tree: form title (display font), metadata (key, version) in monospace. Clickable — selects root, shows form metadata in Properties.

---

## Property Panel

Context-sensitive editor in the Properties tab. Content changes based on selection.

### States

**Nothing selected:** Centered message — "Select an item to edit its properties."

**Field selected:**

```
● Field
─────────────────────────────────────

IDENTITY
Key          [fullName           ]
Label        [Full Name          ]

DATA
Data Type    [string          ▾  ]
Placeholder  [                   ]

BEHAVIOR
Relevant     [                   ]   ← FEL, monospace
Required     [true()             ]   ← FEL, monospace
Read Only    [                   ]
Calculate    [                   ]

VALIDATION
Constraint   [                   ]   ← FEL, monospace
Message      [                   ]
```

**Group selected:** Identity (key, label), Behavior (relevant, readonly), Repeat (min, max).

**Root selected:** Form metadata (url, title, version, description).

**Choice/multiChoice options:**

```
OPTIONS
[opt1     ] [Option 1     ] [×]
[opt2     ] [Option 2     ] [×]
+ Add Option
```

### Form controls

All inputs share a consistent style:
- Elevated surface background, standard border, small radius.
- Focus: accent border color.
- FEL inputs use monospace font.
- Select dropdowns: same style + custom chevron, `appearance: none`.
- Section titles: small uppercase with letter-spacing, tertiary color.

---

## JSON Editor

Full JSON editing mode for any artifact. Toggled via Guided/JSON mode switcher.

```
┌──────────────────────────────────────┐
│  {                                    │
│    "$formspec": "1.0",               │
│    "url": "my-form",                 │
│    ...                               │
│  }                                    │
├──────────────────────────────────────┤
│ [Apply Changes]    ✓ Applied         │
└──────────────────────────────────────┘
```

- Monospace font, 1.6 line-height, panel background.
- Apply button commits changes. Status shows success or parse error.
- **V1 stretch goal:** CodeMirror 6 for syntax highlighting and bracket matching.

---

## Preview Panel

Live-rendered form occupying the right half of the editor area. Uses `<formspec-render>` with the current definition.

- Updates debounced after definition changes.
- Standard formspec-webcomponent rendering.
- Scrollable for long forms.
- **Selection sync:** Clicking a field highlights it and selects the corresponding tree node. Selecting a tree node scrolls preview to that field with a brief accent outline that fades.
- Elevated surface container with small radius.

---

## Diagnostics Panel

Normalized validation results from FormEngine and structural checks. Lives in the Properties panel's second tab.

### Empty state

Centered success checkmark — "No issues found."

### With issues

```
┌──────────────────────────────────────┐
│ 2 errors  1 warning                  │  ← severity count pills
├──────────────────────────────────────┤
│ ● Required field has no value        │
│   basicInfo.fullName                 │
│                                      │
│ ● Missing constraint message         │
│   basicInfo.email                    │
│                                      │
│ ▲ Form URL is "untitled"             │
│   url                                │
└──────────────────────────────────────┘
```

- **Summary bar:** Severity count pills (error: red-tinted, warning: amber-tinted, info: blue-tinted).
- **Rows:** Severity icon + message + path (monospace). Clickable — selects the relevant tree node.
- Severity icons: ● (error), ▲ (warning), ℹ (info) — color + icon, never color alone.

---

## Topbar

```
[⊞] Formspec Studio    │  My Form  · v0.1.0 · draft  │  [↓ Import] [↑ Export]
```

- **Brand:** Icon (amber, 2×2 grid of rounded squares) + "Formspec" (UI font) + "Studio" (display font italic, accent color).
- **Title:** Editable inline. Transparent background, accent border on focus.
- **Version/status:** Secondary text, dot-separated.
- **Buttons:** Import (ghost style), Export (primary/accent style). Both with icon + label.

---

## Empty Tab States

When an optional artifact tab has no data:

```
              ◇

  Component not configured

  Component documents define how
  your form renders.

  [Create from Scratch]  [Import JSON]
```

- Large icon at reduced opacity.
- Heading in display font.
- Brief description in secondary text.
- Two buttons: primary (create) and ghost (import).
- Centered, constrained max-width.

---

## Collapsible Panel Controls

### Properties panel toggle

- When collapsed: small button anchored to the right edge of the workspace, vertically centered. Icon indicates "open panel."
- When expanded: close button in the panel header.
- Transition: panel slides in/out horizontally. Tree and preview area expands to fill.

### Sidebar expand/collapse

- Default icon-only state (~48px) shows artifact icons stacked vertically.
- Click any tab or a dedicated expand control to widen to ~180px showing full labels.
- Click again or click outside to collapse back to icons.

### Tree/preview resizable divider

- Thin vertical bar between tree and preview areas.
- Cursor changes to resize on hover.
- Drag to adjust the split ratio. Double-click to reset to 50/50.
- Layout remembered in localStorage.

---

## Selection Sync Highlight

When selecting across surfaces (tree ↔ preview):

- **Tree → Preview:** The corresponding field in the preview receives a brief accent outline (2px, accent color). The outline fades out over ~1.5s. Preview scrolls the field into view.
- **Preview → Tree:** The corresponding tree node receives selected state immediately. Tree scrolls the node into view.
- Both directions update the Properties panel to show the selected item.

---

## Motion & Animation

### Principles

1. **Motion serves comprehension.** Every animation answers "what just happened?"
2. **Fast.** Nothing exceeds 300ms. Most transitions are 120–200ms.
3. **Ease-out for entrances, ease-in for exits.**
4. **Respect `prefers-reduced-motion`** — disable all animations, use instant transitions.

### Key animations

- **Tree node entrance** (item added): Fade in + slight slide. ~200ms.
- **Hover reveals** (key text, actions, grip handle): Fade in. ~150ms.
- **Toggle arrow rotation** (expand/collapse): Smooth rotation. ~200ms.
- **Inline add form** (gap click): Fade in + slight scale. ~150ms.
- **Drag feedback:** Dragged node at reduced opacity with elevation shadow. Other nodes slide to make room.
- **Tab switches:** Immediate. No transition.
- **Panel collapse/expand:** Horizontal slide. ~200ms.
- **Toast notifications:** Fade in + slide up on show (~250ms). Fade out on dismiss (~300ms). Auto-dismiss after 2.5s.
- **Selection sync highlight:** Accent outline appears instantly, fades out over ~1.5s.

---

## Accessibility

### Requirements (WCAG 2.1 AA)

1. **Contrast:** All readable text meets 4.5:1 against its background. Large text (18px+) meets 3:1.
2. **Focus indicators:** Accent outline on all interactive elements via `:focus-visible`. No focus ring on mouse click.
3. **Keyboard navigation:** All tree operations accessible (Tab, Enter, Arrow keys, Delete). Drag-and-drop has keyboard equivalent (up/down buttons).
4. **Screen reader:** Tree uses `role="tree"` / `role="treeitem"`. Tabs use `role="tablist"` / `role="tab"` / `role="tabpanel"`.
5. **No color-only semantics:** Severity uses icon + color. Node types use dot + badge label.
6. **Reduced motion:** All animations disabled when `prefers-reduced-motion` is set.

### Contrast verification

| Foreground | Background | Ratio | Pass |
|-----------|-----------|-------|------|
| --text-0 (#E6EDF3) | --bg-0 (#0E1117) | 14.2:1 | AAA |
| --text-1 (#9BA4AE) | --bg-0 (#0E1117) | 6.8:1 | AA |
| --text-1 (#9BA4AE) | --bg-1 (#161B22) | 5.5:1 | AA |
| --text-2 (#545D68) | --bg-0 (#0E1117) | 3.1:1 | Decorative only |
| --accent (#D4A34A) | --bg-0 (#0E1117) | 8.2:1 | AAA |
| --bg-0 (#0E1117) | --accent (#D4A34A) | 8.2:1 | AAA (btn text) |
| --error (#DA3633) | --bg-0 (#0E1117) | 5.0:1 | AA |
| --success (#3FB950) | --bg-0 (#0E1117) | 6.7:1 | AA |

---

## Canvas & Chrome

### Editor background

Subtle dot grid pattern on --bg-0 to create workspace texture without distraction. Barely perceptible — signals "design surface" rather than "content page."

### Scrollbars

Thin (~6px), unobtrusive. Track transparent, thumb uses border color, darkens on hover.

---

## Icon System

V1 uses Unicode symbols. Replace with custom SVG set in V2.

| Usage | Symbol |
|-------|--------|
| Field type | ◆ |
| Group type | ▣ |
| Display type | ◉ |
| Expand toggle | ▸ / ▾ (SVG, rotates) |
| Drag handle | ⠿ |
| Move up/down | ↑ / ↓ |
| Delete | × (danger on hover) |
| Error | ● |
| Warning | ▲ |
| Info | ℹ |
| Configured | ✓ (success) |
| Not configured | — (ghost) |
| Import | ↓ + tray (SVG) |
| Export | ↑ + tray (SVG) |

---

## File Structure

```
form-builder/                   Top-level monorepo app
├── index.html          HTML shell, font loading, mount point
├── src/
│   ├── index.tsx       Entry point — renders <App />
│   ├── app.tsx         Root layout: topbar, sidebar, editor, inspector
│   ├── state/          Preact signals for project, selection, diagnostics
│   ├── components/     Preact components (tree, properties, preview, tabs)
│   └── types.ts        App-local TypeScript types
├── styles.css          Global CSS (custom properties, base resets, layout)
├── package.json        Deps: preact, @preact/signals, workspace formspec packages
└── vite.config.ts      JSX transform (preact), workspace aliases
```

Preact + `@preact/signals` for all UI. Shares the same signals primitive as `formspec-engine`, so engine signals drive UI updates directly. `form-builder/` imports formspec packages as workspace dependencies.
