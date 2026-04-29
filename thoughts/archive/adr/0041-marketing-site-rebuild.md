# ADR 0041: Marketing Site Rebuild — Implementation Plan

**Date**: 2026-03-15
**Status:** Superseded — single-file `site/index.html` approach replaced by a full Astro site (`site/` workspace) with 6 pages, 13 blog posts, componentized architecture, Tailwind CSS, and light theme. Messaging strategy reversed (now AI-forward, not anti-AI-headline as this ADR argued). Old `site/index.html` (3009 lines) coexists but is no longer maintained.
**Branch**: `marketing`
**File**: `site/index.html` (single-file rebuild, inline CSS/JS)
**Working directory**: `/Users/mikewolfd/Work/formspec/.claude/worktrees/marketing/`

## Background

The current site leads with "AI-powered smart forms" messaging that misrepresents Formspec's value. User interviews (grants PM, developer, compliance lead) plus distribution-focused review confirmed: AI as a headline hurts credibility, the real differentiators are buried, and the page doesn't know its audience.

This plan was developed through a structured debate between a senior product advisor, a distribution-first growth advisor, and a design architect. A final audience-reality-check shifted the information hierarchy from spec-first to outcome-first: the government PM who lands on this page doesn't care about JSON — they care about building complex forms for free that work where their staff are.

## Core Positioning

**The buying sequence**: Problem recognition → Solution discovery → Trust verification → Technical evaluation. The page follows this order. Outcomes above the fold, architecture below it. The spec is the moat, not the billboard.

**AI positioning**: AI is a consequence of good architecture, not a promise. "ChatGPT for forms" lives on the page as a subtle aside — confident enough to name the comparison, grounded enough to redirect to the real value. The full AI thesis belongs in a blog post (see `thoughts/adr/0042-launch-blog-posts.md`).

**Audience**: Civic tech — government agencies, nonprofits, tribal nations. Three buyer personas in order of who lands on the page first:
1. **Program managers** — googled "free grant form builder." Need to see outcomes in 3 seconds.
2. **IT / compliance evaluators** — sent the link by a PM. Need lock-in, security, and maintainability answers.
3. **Developers** — found the GitHub or got forwarded. Need docs, schema, and code. They'll scroll.

## Page Flow (9 sections)

### Visual Rhythm

```
Hero ████████      (peak 1)
Demo ██████████    (peak 2 — highest)
Strip ██           (valley — visual coda to demo)
Personas ████      (rising)
Lock-in ███        (dip)
Developer ██████   (peak 3)
CTA ████           (resolution)
Footer █           (silence)
```

**Section spacing varies by weight** — not a uniform 100px everywhere:

| Section | Top padding | Bottom padding | Notes |
|---------|------------|----------------|-------|
| Hero | — | 0 | Demo is visually continuous with hero |
| Demo | 0 | 120px | Generous — it's the centerpiece |
| Strip | 48px | 48px | Tight coupling to demo (visual coda) |
| Personas | 100px | 100px | Full breathing room |
| Lock-in | 80px | 80px | Shorter — intentionally brief |
| Developer | 100px | 100px | Full breathing room |
| CTA | 120px | 120px | Generous — resolution moment |

Alternate `--bg` and `--bg2` backgrounds between sections. The strip shares the demo's background treatment.

---

### 1. Nav

- Logo: formspec + dot
- Links: `Demo` | `Who it's for` | `Developers` | `GitHub`
- CTA button: "View on GitHub"
- Mobile: hamburger toggle — full-screen overlay with `backdrop-filter: blur(16px)`, links stacked vertically, 48px min tap targets

### 2. Hero — outcomes first

The PM who googled "free grant application form builder" needs to recognize their problem in 3 seconds. Technical details come later.

**Headline**: `Build complex forms that work anywhere. Even offline.`

Outcome-first. Names the capability (complex forms), the differentiator (anywhere/offline), and implies the pain (current tools can't). **Plain white text, no gradient.**

**Subtitle**: `Free, open-source form engine for grant applications, field inspections, compliance reporting, and intake workflows — designed for high-stakes, low-connectivity environments.`

Names the actual work. A grants PM reads this and goes "that's literally my job." Longer than one line is fine here because every word is doing work — it's not filler, it's targeting.

**CTAs**:
- Primary: "See it working" (anchor to demo)
- Secondary: "Read the spec" (anchor to spec/GitHub)

**Tagline strip**: `Works offline · Free forever (MIT license) · No vendor lock-in`

Reordered: lead with the capability they care about most. "MIT license" means nothing to a PM; "Free forever" means everything when their budget got cut. Parenthetical gives the IT evaluator the detail they need.

**Hero note** (small text, `--text-dimmer`, below the tagline strip): `Some people call it ChatGPT for forms. We just made the spec clean enough that it works.`

A whisper, not a shout. Plants the AI meme for visitors who resonate with it. Redirects to the spec for visitors who'd be skeptical. The full "ChatGPT for forms" story is a blog post, not a landing page pitch.

**Deliberately dropped from hero**:
- "JSON" in the headline — step 4 language for a step 1 visitor
- AI "why now" sentence — categorizes you as an AI product
- Founding story — belongs in a blog post (see `0002-launch-blog-posts.md`)

### 3. Live Demo — THE centerpiece

The demo is the page. Everything else is context around it. 80% of implementation time goes here.

#### Layout

**Desktop (1024px+)**: Full-width section below the hero. The form is the star — JSON is the proof.

```
+---------------------------------------------------+
|  [Grant Application] [Field Survey]        LIVE    |
+---------------------------+-----------------------+
|                           |  {                    |
|  Organization name        |    "title": "Grant..  |
|  [Sunrise Community Fund] |    "items": [         |
|                           |      {                |
|  Organization type        |        "id": "org.."  |
|  [Nonprofit (501c3)   v]  |      }                |
|                           |    ]                  |
|  EIN                      |  }                    |
|  [12-3456789         ]    |                       |
|                           |                       |
+---------------------------+-----------------------+
|  ▸ Show output  ·  Machine-readable by default    |
+---------------------------------------------------+
```

**Form on the left (60%), JSON on the right (40%).** The PM sees a working form. The developer sees the definition driving it. The JSON pane has a subtle header: `Definition` — no jargon, no "JSON source." If a PM glances at it, they see structured text. If a developer looks, they see the spec in action.

**Unified header bar** spans both panes — preset switcher, badge, and window dots. Badge text: `Powered by a single form definition`

(Not "runs from a single JSON file" — "form definition" is outcome language, "JSON file" is implementation language.)

**JSON pane scrolls independently** — `max-height: 680px` with `overflow-y: auto`. Subtle scrollbar: thin, accent-colored thumb on dark track.

**Tablet (768–1023px)**: Still side-by-side but 65/35 split (form dominant).

**Mobile (<768px)**: Tabbed view (`Form` | `Definition` | `Output`). **Form tab active by default** — the PM on their phone sees a working form, not code.

#### Interactions

**Keep all current interactions**:
- Conditional fields (org type → EIN/tribal enrollment)
- Calculated monthly budget (auto-computed from amount ÷ months)
- Repeatable team members (add/remove rows)
- Warning validation (>36 months flagged, not blocked)

**Auto-populate on load**: The demo starts with data already filled in — "Sunrise Community Fund", Nonprofit (501c3) selected, EIN "12-3456789", amount $25,000, duration 12 months, monthly budget showing "$2,083.33/mo", one team member "Jane Smith / PI". The first 3 seconds demonstrate intelligence, not ask for input.

#### Preset Switcher

Pill-shaped buttons in the header bar, left-aligned. NOT a dropdown. Active preset gets accent fill, others get ghost treatment. When switched, cross-fade (not hard-cut) while form reconstructs.

- Preset 1: Grant Application (conditional fields, calculated budget, team members)
- Preset 2: Field Survey / Annual Report (repeatable sections, offline-capable, warning validation)
- Only ship presets that work flawlessly end-to-end

#### Output Panel

Collapsible panel **below** both panes. Collapsed by default with a "Show output ›" toggle + chevron.

Tabs: `Response` | `Validation Report`

Label: `Machine-readable by default`

#### Definition Highlighting (v1-achievable)

When a form field receives focus, highlight the corresponding lines in the definition pane. Hard-code line-range mappings for the 2 demo presets.

```css
.json-line.highlight {
  background: rgba(124, 106, 247, 0.08);
  border-left: 2px solid var(--accent);
}
```

### 4. "Why it's different" strip — consequences, not capabilities

**Visual treatment**: Visual coda to the demo, not a new section. 48px gap from demo, shared `--bg2` background. **Pure typography — no icons, no cards, no borders.** Three `<p>` tags, centered, key phrases in `<strong>`.

```css
.consequence {
  font-size: clamp(1rem, 1.6vw, 1.2rem);
  color: var(--text-dim);
  line-height: 2.4;
  max-width: 720px;
  margin: 0 auto;
  padding: 12px 0;
}
.consequence strong {
  color: var(--text);
  font-weight: 600;
}
```

Optional: subtle 1px horizontal rules between statements for rhythm.

**Line 1**: `Your applicants can't submit invalid budgets — even on a plane.`
Same rules, everywhere — browser, server, mobile, offline.

**Line 2**: `Flag a $50,000 travel budget without blocking the submission. Your reviewer sees the warning. Your applicant keeps moving.`
Warning vs error severity — most form tools only have pass/fail.

**Line 3**: `Submit once. Get the data in every format your systems need. No re-entry. No export macros.`
Mapping engine — but don't name file formats here. The PM doesn't think in JSON/CSV/XML; they think in "I need to get this into our system."

A full-width horizontal rule with generous whitespace (80px) separates this strip from the persona section below.

### 5. "Who it's for"

Three persona cards. One viewport max. Pain-first, then features. Each card leads with a sentence the persona would actually say.

**"When the form IS the process"** — opening body copy sentence inside this section.

**"I manage a grant program"**
- "I need applicants to fill out complex forms that enforce our rules — and I need the data in three different formats for three different systems."
- Calculated fields, conditional sections, required-field enforcement — all built into the form definition. No backend glue.
- Collect once, output everywhere. Format transformation is built in.
- Version-locked: mid-cycle rule changes never invalidate submitted responses.

**"I run field operations"**
- "My staff collect data in places with no cell signal. I need the forms to work offline and validate on sync."
- Same form, same rules, no internet required.
- Warnings flag unusual values without blocking submission. Only hard errors stop the form.
- Data syncs when connectivity returns — nothing lost.

**"I'm evaluating this for my agency"**
- "I need to know we can own this, maintain it, and it won't disappear when a vendor pivots."
- Open source, MIT licensed. Your form definitions are portable files, not API calls.
- Dual implementations (TypeScript + Python) — server-side re-validation is built in.
- Static linter catches definition errors before deployment, not after.

**Responsive**: Desktop 3-column grid. Tablet 2-up. Mobile: horizontal snap-scroll with peek (85vw cards, 20px of next card visible). Preserves "one viewport max" on small screens.

**Skip link**: At the bottom, a single line in `--text-dimmer`: "Developer? Jump to the code." — graceful off-ramp.

### 6. "No lock-in. By design."

Short section. Vendor lock-in is a top-3 procurement blocker for civic tech. A compliance lead needs concrete points to paste into a procurement justification memo.

**Use tier-3 heading.**

**Visual treatment**: Left accent-bar list. No icons, no cards, no grid.

```css
.lockin-point {
  padding: 16px 0 16px 24px;
  border-left: 2px solid var(--border-bright);
  margin-bottom: 16px;
  transition: border-color 0.3s;
}
.lockin-point:hover {
  border-left-color: var(--accent);
}
```

- "Your form definitions are portable files you own — not assets locked inside a vendor platform. Move them anywhere."
- "Behavior and presentation are separated. Change how a form looks without touching what it validates. Switch renderers without rewriting rules."
- "Every definition is validated before it runs. The linter catches problems in the definition, not in production."

Rewritten to avoid jargon: no "JSON Schema," no "open specification" — those details are in the developer section. This section speaks to the evaluator who needs assurance, not architecture.

### 7. "For developers"

This section wins or loses the developer audience. **Make this section visually heavier** than personas/lock-in to create a second peak in the page rhythm.

**Lead**: `An open JSON specification with TypeScript and Python implementations. Here's what you get.`

Straightforward. Developers don't need to be sold — they need to evaluate.

**What you get** (two groups):

*The Specification*
- JSON-native form definitions validated by JSON Schema
- FEL (Formspec Expression Language) — deterministic, side-effect-free expressions for calculations, conditions, and validation
- Static linter catches definition errors before runtime

*The Implementations*
- TypeScript form engine (reactive signals, framework-agnostic, browser or Node)
- Python evaluator (server-side re-validation, same rules, same results)
- `<formspec-render>` web component (drop a tag, get a form)
- Mapping engine (output transformation to any format)

**Code tabs**: Python / TypeScript / HTML — show the shortest path from "I found this page" to "I have a working form." 10-line definition + 3-line invocation. Fix Python example to match real API.

Code tab details:
- **Line numbers** in `--text-dimmer`, left gutter.
- **Font size** 0.85rem (up from 0.78rem).
- **"Copy" button** — ghost-styled, appears on hover. Changes to "Copied ✓" for 2s. Most important developer conversion micro-interaction.

**Honest scope** (quiet line between this section and CTA):
`Formspec is the form engine — data, logic, validation, rendering. Hosting, auth, workflows — that's your stack.`

**Tech pills**: `TypeScript` · `Python` · `Web Components` · `JSON Schema` · `MIT License`

### 8. CTA

**Use tier-3 heading.**

`Open source. Start building.`

CTAs:
- Primary: "Read the spec"
- Secondary: "View on GitHub"

**Visual callback to hero**: Inverted ambient glow rising from below (bookend to the hero glow above).

```css
.cta-section::before {
  content: '';
  position: absolute;
  bottom: 0; left: 50%;
  transform: translateX(-50%);
  width: 60vw; height: 40vh;
  background: radial-gradient(ellipse at bottom, rgba(124,106,247,0.1) 0%, transparent 70%);
  pointer-events: none;
}
```

### 9. Footer

```
formspec
Open source, under active development · MIT License
Spec · Examples · GitHub
```

- License explicit
- Consider "Built by [names/org]" — civic tech evaluators want to know who's behind it
- No newsletter signup unless there's a newsletter
- No social links unless you post

---

## Typography

### Heading Hierarchy (3 tiers)

| Tier | Usage | Size | Weight |
|------|-------|------|--------|
| 1 | Hero only | `clamp(2.4rem, 4.5vw, 3.6rem)` | 800 |
| 2 | Primary sections (Demo, Personas, Developer) | `clamp(1.8rem, 3vw, 2.6rem)` | 800 |
| 3 | Resolution sections (Lock-in, CTA) | `clamp(1.4rem, 2.2vw, 1.9rem)` | 700 |

### Body Text

One size for all body copy: `1.0625rem` (17px). **Line-height**: `1.7` — dark backgrounds need more leading.

---

## Color System

| Color | Meaning | Usage |
|-------|---------|-------|
| Purple `#7c6af7` | Interactive | Buttons, links on hover, active tabs, focus rings |
| Light purple `#a78bfa` | Spec/code artifacts | Syntax highlighting, code tab text, eyebrow badges, tech pills |
| Green `#34d399` | Success/working | Output panel, computed fields, offline callout |
| Amber `#fbbf24` | Warnings only | Duration warnings, high-spend flags — never decorative |

- Hero h1: **plain white**, no gradient
- `computed-tag` on monthly budget: purple → **green**
- Ambient glow: consider shifting color on scroll (purple → faint green → purple)

---

## Responsive Strategy (3 breakpoints)

### Desktop (1024px+)
- Side-by-side demo (60/40, form dominant)
- 3-column persona cards
- Full nav with links

### Tablet (768–1023px)
- Demo side-by-side (65/35 split)
- 2-up persona cards
- Hamburger nav

### Mobile (<768px)
- Demo tabbed (Form tab active by default)
- Persona cards: horizontal snap-scroll (85vw cards with peek)
- Consequences strip: left-aligned, not centered
- Code tabs: full width, smaller font
- Hero: single column, reduced heading size

### Mobile Nav
Full-screen overlay with `backdrop-filter: blur(16px)`. Links stacked vertically, 48px minimum tap targets. CTA prominent at bottom.

---

## Technical Fixes

- All external URLs → placeholder anchors with `<!-- TODO: update when production domain is set -->`
- Python code example: match real API (not `DefinitionEvaluator`)
- Mobile nav: hamburger toggle with full-screen overlay
- Grain overlay: z-index `1000` → `1`, opacity `0.4` → `0.25`
- Demo: auto-populate initial data on load

---

## Deliberately Omitted (and why)

- **"JSON" above the fold** — step 4 language for a step 1 visitor. JSON lives in the demo's definition pane and the developer section.
- **AI as a headline** — categorizes you as an AI product. "ChatGPT for forms" is a subtle hero note, not the pitch.
- **Founding story** — moved to blog post (`0002-launch-blog-posts.md`).
- **XForms prior art** — moved to blog post. The ~7 people who care will find the GitHub.
- **"AI-legible by design" as feature bullet** — tautology. Moved to blog post as part of the AI architecture thesis.
- **Social proof / case studies** — pre-release, no real users.
- **"One definition. Every surface." as standalone section** — portability absorbed into demo + lock-in section.
- **Separate examples grid** — examples are switchable demo presets.
- **File format names in non-developer sections** — PMs don't think in JSON/CSV/XML. They think in "get the data where it needs to go."
- **Section 508 / accessibility claims** — don't claim until audited.
- **Bundle size** — add when known.
- **Pricing / hosted option** — doesn't exist.

---

## Verification Checklist

- [ ] All 9 sections render
- [ ] Hero reads as outcome-first: a PM recognizes their problem in 3 seconds
- [ ] Hero headline: no "JSON", no jargon, no AI headline
- [ ] "ChatGPT for forms" hero note present but subtle (small text, dimmed)
- [ ] Demo: form on left (dominant), definition on right
- [ ] Demo: auto-populated with data on load
- [ ] Demo: JSON pane scrolls independently
- [ ] Demo: definition highlighting on field focus
- [ ] Demo: preset pill switcher works, 2 examples
- [ ] Demo: mobile shows Form tab by default
- [ ] Consequences strip: pure typography, no icons/cards
- [ ] Persona cards: pain-first, real job titles, no jargon
- [ ] Lock-in section: outcome language (no "JSON Schema" or "open specification")
- [ ] Developer section: full technical depth (JSON Schema, FEL, dual implementations)
- [ ] Code tabs: line numbers, 0.85rem font, copy button
- [ ] Visual rhythm: varied section spacing
- [ ] Heading hierarchy: 3 tiers
- [ ] Color discipline: purple=interactive, green=working, amber=warnings
- [ ] Mobile responsive: hamburger, grids collapse, demo tabs
- [ ] Grain overlay z-index=1, opacity=0.25
- [ ] All links use placeholder anchors
- [ ] No broken links, no placeholder example cards

---

## Implementation Priority

1. **Demo** — side-by-side (form dominant), independent JSON scroll, pre-populated data, preset switcher, definition highlighting
2. **Hero** — outcome-first headline, subtitle naming real work, ChatGPT note, reordered tagline strip
3. **Consequences strip** — pure typography
4. **Mobile** — hamburger nav, demo tab treatment, responsive breakpoints
5. **Persona cards** — pain-first, real job titles, snap-scroll mobile
6. **Developer section** — code tabs with copy button, honest scope, tech inventory
7. **Lock-in section** — accent-bar list, outcome language, tier-3 heading
8. **Color discipline** — purple=interactive, green=working, enforce everywhere
9. **Typography tiers** — 3-level heading hierarchy
10. **CTA** — inverted glow bookend, tier-3 heading
11. **Footer** — minimal, license explicit

---

## Provenance

**Rounds 1–3**: Senior product advisor vs. distribution-first advisor. Three rounds of adversarial debate resolved 7 tensions across section count, hero copy, demo layout, CTA language, lock-in treatment, examples strategy, and section naming.

**Design review**: Layout architect added visual rhythm (peak-valley-peak), 3-tier typography, enforced color semantics, concrete CSS for key components, promoted definition highlighting to v1.

**Audience reality-check**: Final pass shifted information hierarchy from spec-first to outcome-first. The government PM is the first domino — if they bounce, IT never evaluates, and the developer never sees the repo. Technical depth moves below the fold. The spec is the moat, not the billboard.

Content moved to blog post proposals: founding story, XForms prior art, "ChatGPT for forms" deep dive, AI architecture thesis, detailed spec walkthrough. See `thoughts/adr/0042-launch-blog-posts.md`.
