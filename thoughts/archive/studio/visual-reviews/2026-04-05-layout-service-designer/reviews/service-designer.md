# Service designer review — Layout workspace visual pipeline (Phase 4)

**Scope:** Evolutionary proposal (winning per adjudication), plus handoff brief problems **1–6** assessed for **user journey** and **cognitive load** risks the visual pass may have underweighted.

**Sources:** `handoff-brief.md`, `proposals/evolutionary.md`, `adjudication.md`.

---

## 1. User journey impact

The evolutionary proposal **improves** the core layout-authoring journey by aligning chrome with a **three-tier model** (nav muted, page frame structural, stack interior organizational) and by resolving the brief’s **dual “hero” accent** so one surface—primarily **canvas selection**—carries saturation while the stepper moves to **underline + transparent background** (proposal §Visual changes 1). That matches the handoff success criterion of a **single accent hero** and reduces the “where is my attention supposed to be?” friction when moving between **wizard step** and **selected node** (brief §7.1, §3.1).

The **STACK** treatment (smaller caps pill, **solid** border when a child is selected, proposal §2) directly addresses the brief’s **placeholder inside product** symptom (brief §3.2) so authors can **parse nesting** without mistaking the inner region for discardable sketch UI. That supports tasks like “add fields inside this page” and “understand what owns what” without extra clicks.

**Potential journey friction** called out in adjudication but not fully owned by the visual doc: **two-line step labels** (proposal §3, adjudication §Remaining concerns) can **grow the stepper’s vertical footprint**, shrinking how many steps are visible in **horizontal overflow** layouts and increasing **pan/scroll to see steps** behavior on narrow viewports. That is a **time-and-scanning** cost on the “pick the right page, then edit canvas” loop, not only a layout/CSS issue.

**Endorsement (journey):** Net positive for completing layout authoring, provided stepper height and overflow are **capped and tested** so the nav row does not become a second scrolling strip competing with the canvas.

---

## 2. State communication — selection vs navigation

The proposal’s split—**stepper = navigation state**, **canvas = selection / editing locus**—is the right semantic pairing with the brief’s hierarchy direction (brief §5: pick one hero). Demoting the active step from **solid pill** to **text + bottom border** (proposal §1) should make **“which page is loaded for editing”** readable without shouting as loudly as **“which node is selected.”**

**Interaction risks the visual assessment touched lightly:**

- **Coupling perception:** When the stepper is visually quieter, some authors may still need a **redundant cue** that the canvas reflects the **current step’s page** (e.g., first field in view, breadcrumb, or page title in the canvas header). The brief does not require this, but **navigation vs selection** clarity is not only contrast—it is **causal linkage** (“changing step changes what the canvas shows”). If that linkage is already strong in the product, muting the stepper is safe; if not, muting it could feel like **weaker wayfinding**.

- **Assistive technology:** Two “current” concepts (active tab vs selected canvas node) remain in the DOM; the brief mandates meaningful selection for AT (`aria-pressed` on the field group, brief §4). The visual pipeline should be paired with a quick **announcement / roving focus** check so users do not hear two equally weighted “you are here” stories without context.

---

## 3. Cognitive load — disclosure, stepper, add-button hierarchy

**Description & hint disclosure** (brief §1 current state) **reduces** simultaneous density on the card; evolutionary’s **toolbar** changes (12px, subtle footer attach, proposal §4) aim to make the footer feel **part of the card system** rather than a separate “sticker strip” (brief §3.4). That lowers **split-attention** between headline and actions.

**Remaining load factors:**

- **Progressive disclosure stack:** Authors already balance **stepper**, **canvas tree (Items)**, **field disclosure**, and **property popover** (brief §1). Adding **two-line steps** and **second-line keys** (proposal §3) increases **readable tokens per glance**; it trades ellipsis ambiguity for **vertical scanning**. That is appropriate for **recoverability** (brief §5, §7.3) but is not cognitively free.

- **Add-button hierarchy** (proposal §5: **+ Item** filled subtle; **+ Page** and stack split **ghost** in a **ButtonGroup**) aligns with the brief’s “one primary add” direction (brief §5). **Load risk:** authors must **infer affordance strength** from chrome alone; **ghost** actions can be overlooked under time pressure, especially if **+ Page** is a less frequent but **high-impact** action (new page vs new item). The visual assessment noted **competition with the stepper** (brief §3.5); the **interaction** angle is **error class** (“I added the wrong kind of thing”) rather than **salience** alone.

---

## 4. Edge cases — long labels, many fields, narrow viewport, RTL

| Edge case | Proposal coverage (text) | Interaction risks beyond the visual pass |
|-----------|---------------------------|------------------------------------------|
| **Long labels / keys** | Two-line step row; second line or clamp/expand for keys (proposal §3) | **Layout shift** when a key wraps from one to two lines can **move hit targets** under the cursor; **many wrapped keys** in a tall page increase scroll distance between **label** and **toolbar**. |
| **Many fields** | Not explicitly scoped | **Footer/toolbar** on every card scales **vertical rhythm**; inner shadow (proposal §4) helps grouping but does not reduce **repeated chrome** per field. |
| **Narrow viewport** | Brief: truncation, overflow-x (brief §3.3, §5) | **Horizontal stepper + taller two-line tabs** (adjudication) may force **more horizontal scroll** or **fewer visible steps**; authors may **lose overview** of page count. **Touch targets** for ghost adds and stepper tabs need explicit **≥44px** verification (brief §4), not only type size. |
| **RTL** | Brief: “inline-start rails” (brief §1); proposal uses **border-b** on tabs and shared layout tokens | **Logical properties** for rail/start alignment should be verified so selection **does not invert meaning** visually under RTL. Evolutionary does not call this out; it is an **implementation** check, not optional for global Studio. |

---

## 5. Progressive disclosure — wizard stepper vs canvas tree

The product already combines **macro navigation** (wizard steps) with **micro structure** (canvas + Items tree selection, brief §1). Evolutionary **does not collapse** those surfaces; it **clarifies roles** by demoting nav fill (proposal §1). That preserves **power-user** access via the tree while improving canvas-first editing.

**Tension:** The **Items tree** was used when automation could not rely on the drag handle (brief §3.6). Disclosure and popover flows (brief §7.5) mean authors may **expand/collapse** in multiple places. The service-designer view is that **progressive disclosure is healthy** only if **default collapsed state** still leaves **identity** (label, key) scannable and **truncation recoverable** (brief §7.3)—which the proposal explicitly targets for steps and keys (proposal §3).

---

## Handoff problems 1–6 — user journey / cognitive lens

**Did the visual assessment miss interaction risks?** A few **yes, partially**—below, each problem is reframed for **behavior and cognition**, not only pixels.

1. **Dual hero (brief §3.1)** — Visual fix is strong (proposal §1). **Additional risk:** **ambiguous “current place”** for users who rely on **color alone**; **AT** and **high-contrast themes** should be checked so the **underline** active state is not **only** a hue change. **Linkage** between active step and canvas content (see §2) matters for **journey**, not just accent budgeting.

2. **STACK inside selected page (brief §3.2)** — Visual **escalation** helps **spatial understanding**. **Additional risk:** **selection scope**—when the page is selected, **click targets** for “add to stack” vs “select stack” may still confuse; the proposal does not redefine interaction, only chrome. **DnD** and **insert slots** remain high-stakes; shared ADVICE notes droppables must be real, not decorative.

3. **Truncation (brief §3.3)** — Proposal’s **two-line** and **measure** approach improves **recoverability** (proposal §3, adjudication cherry-pick on `title`). **Additional risks:** **layout shift**, **scan time** with many wrapped keys, and **touch**: long-press vs tooltip vs expand affordance must be **discoverable** without devtools (brief §7.3).

4. **Toolbar band vs headline (brief §3.4)** — **12px + attach** (proposal §4) helps **legibility**. **Additional risk:** **motor**—if only **type** grows but **control height** stays small, **touch-primary** users still strain (brief §4). Visual pass should confirm **hit area**, not only font size.

5. **Equal-weight adds (brief §3.5)** — **Primary Item** (proposal §5) reduces **competition with stepper**. **Additional risks:** **wrong-object adds**, **discoverability of + Page** for workflows that start with a new page, and **overflow menu** if future density packs more actions—**mental model** (“what does add mean here?”) should stay aligned with **defaults**.

6. **Drag handle discoverability (brief §3.6)** — **Focus-within full opacity** (proposal §6) helps **keyboard** paths. **Visual assessment underweighted touch:** **focus-within does not mirror touch exploration** the way hover does; **permanent slightly higher baseline opacity** or **visible “grip” affordance** on touch layouts may still be needed. **Items tree** as fallback is good **recovery** but should not be the **only** discoverable reorder path for touch users.

---

## Endorsement or objection

**Endorse evolutionary** for user value: it directly implements the brief’s **single hero**, **deliberate nesting**, **truncation recovery**, and **toolbar legibility** with a coherent story (adjudication verdict; proposal success table). It avoids the **density** proposal’s **icon-only toolbar** learnability risk (adjudication comparative row).

**Objection** is **conditional**, not categorical: ship is **blocked on interaction verification** for (a) **stepper height/overflow** with two-line labels, (b) **touch targets** on ghost secondaries and tabs, (c) **touch reorder** discoverability beyond focus-within, and (d) **RTL / logical alignment** for rails and tab chrome.

---

## Interaction concerns (summary)

- **Stepper growth** vs **narrow viewport** overview (adjudication §3).
- **Touch and AT** parity for **muted nav** and **drag affordance** (brief §3.6, §4).
- **Add hierarchy** and **error classes** (wrong add type), not only visual weight.
- **Layout shift** from multi-line keys and steps.
- **Theme toggle / sibling pills** reintroducing dual-hero language (proposal Bonus findings; adjudication §3).

---

## Suggested modifications

1. **Cap step label lines** (e.g., max 2) and **test overflow-x** with realistic page titles (adjudication §3); add **full string** via `title` or tooltip as conservative cherry-pick (adjudication §2).
2. **Explicit 44px minimum** interactive height for **step tabs** and **add cluster** where Studio is touch-primary (brief §4), even if type is 12px.
3. **Drag handle:** pair **focus-within** with a **touch-visible baseline** (opacity floor) or **always-visible grip** on coarse-pointer media queries; keep **Items tree** as secondary, not primary, reorder discovery.
4. **RTL pass:** verify **inline-start** rail and **tab underline** in RTL without swapping **semantic** “start” of selection.
5. **Post-ship optional:** **copy bind path** micro-affordance (adjudication §2) if two-line keys remain noisy for support and review workflows.

---

*Review produced as Formspec **formspec-service-designer** — Phase 4 narrative. Grounded in the cited handoff, proposal, and adjudication text only; implementation files were not re-audited in this pass.*
