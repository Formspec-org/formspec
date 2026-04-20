# Formspec Studio — Design Exploration Brief

**Date:** 2026-04-20
**Status:** Exploratory design brief — multiple directions welcome
**Audience:** Designer producing exploratory concepts for Formspec Studio

---

## 1. How to use this document

This brief explains what Formspec Studio is, who uses it, what it has to do for them, and what about it can't change. It is deliberately **not** a list of screens to design. The goal of this engagement is to produce several **exploratory design directions** — different ways the same product could look, feel, and work — not to refine a single answer.

Read the brief, form your own opinions, and propose directions that you think fit. If two of your directions disagree with each other, good. If one of them disagrees with what's described here, tell us why — the brief captures our current thinking, not a contract.

A version of Studio already exists; §8 describes it at a product level. Treat that as a reference for *what* the product does, not as a template for *how* it should be designed. Starting from zero is encouraged.

---

## 2. What Formspec is

Formspec is a way to define complex forms as portable, version-controlled documents — not to build them in a specific tool or run them on a specific service. It's aimed at the kind of forms where getting the behavior right is most of the work: tax returns, grant applications, clinical intake, insurance claims, regulatory filings, inspection checklists. Not contact forms, not surveys.

A Formspec form knows its own rules. Conditional sections, calculations, cross-field validation, different output formats for different downstream systems, translations for different audiences, offline use when there's no connectivity — all of it is described inside the form itself. The same form definition can render on a web page, in a phone app, on a tablet at a remote clinic, and on a server re-checking the answers after submission. The rules behave identically everywhere.

Formspec is a specification and a set of open-source tools, not a hosted service. The forms people create with it are their own — they can move them, version them, hand them to other systems, keep them forever.

---

## 3. What Studio is

Studio is where someone sits down to build a Formspec form. It's the authoring environment — the tool someone opens when they have a blank page and a job to do, and closes when they have a working form they can ship. The people who will eventually fill out the form never see Studio.

Studio has one job with two halves.

**Direct manipulation.** The author can build and modify the form by working on it directly — adding fields, writing rules, arranging pages, adjusting how it looks, defining how the answers map to their downstream systems.

**Conversation with an AI.** The author can also build and modify the form by talking to an AI that understands the form and can make the same kinds of changes the author would make. Anything the AI does is something the author could have done themselves; everything is reviewable and reversible.

Neither half is a side-panel on the other. Both are first-class. The short internal pitch is **"ChatGPT for forms"** — describe what you need, see the system produce a first draft, refine it in conversation or by hand, walk away with a working form. Take the frame seriously, but not literally. Whether conversation dominates the interface, shares it equally with direct manipulation, or lives alongside it, is genuinely open — different exploration directions can try different answers.

One thing the design can truthfully promise: the AI cannot break the form. It works through the same controlled set of operations a human does, and the system won't accept structurally invalid changes from anyone, human or AI.

---

## 4. Design philosophy

Formspec was designed to be simple enough for a person to create a small form by hand and rich enough for an AI to compose an arbitrarily large and intricate form. A grant budget form might be a few dozen lines of plain, readable description. A 300-field tax return with conditional sections, cascading calculations, and multi-format output is the same shape — just more of it. The underlying specification doesn't get heavier as the form gets harder. Studio's job is to give authors access to that full range of power without it feeling overwhelming at any point on the curve.

Formspec keeps several concerns separate on purpose — what the form collects, how it looks, how it's laid out, how its data flows to downstream systems, what languages it speaks. That separation is valuable; the author shouldn't have to feel it as four or five different tools. The *benefits* should come through as natural product moments — swap the look without changing the logic; reuse the same data model in two different layouts; send the same answers to three different downstream systems by adjusting one thing. The *mechanics* of keeping those concerns separate should be invisible.

The underlying form definition is just structured text — portable, versionable, readable, editable outside Studio if someone wants to. The author never has to touch it. Export is available; a "view source" affordance is reasonable for transparency. Neither needs to be prominent, and the primary user should never be expected to open the raw form to get their job done.

---

## 5. Who uses Studio

The person you are designing for is a **non-technical program manager or analyst** — the person who today files tickets with IT to get a form built, or spends months going back and forth with developers. They know their domain cold: grants, eligibility, clinical intake, inspections, compliance, benefits, licensing, underwriting. They do not write code. They do not read schemas. They will not hand-edit structured text to get a form out the door.

They *can*, however, read and write simple formulas the way someone writes them in Excel or Google Sheets. The form's logic — "show this section if income is over $50,000", "the total is the sum of personnel, travel, and equipment", "flag this as a warning if the budget is over $500,000" — is written in an Excel-like formula language. Most of the time the AI will write the formula and the author will read it and maybe tweak a number or a comparison; for the occasional case the AI gets wrong, the author can edit the formula directly. Treat the formula language the way you'd treat a spreadsheet formula — something the user can read and adjust, not something scary.

Typical settings:

- **Government program staff** — benefits, permitting, tax, licensing. Compliance-sensitive, often required to meet accessibility standards.
- **Nonprofit and grant operations** — applications, reports, submissions. Small teams; one person often wearing many hats.
- **Clinical and health intake** — patient questionnaires, screening, referrals. Coded medical vocabularies matter.
- **Insurance and financial services** — claims, applications, underwriting. Calculation correctness and audit trails matter.
- **Field inspection and compliance** — safety checklists, site surveys. The forms they produce must work offline.

Shared traits to design for:

- They're accountable for the form being correct. A calculation error is their problem.
- They iterate constantly. Rules change mid-cycle. Wording gets tweaked. Sections come and go.
- They don't read docs. They expect the tool to teach them by being legible.
- They're used to forms being a second-class citizen in every tool they have. A tool that treats this work seriously will surprise them.

A secondary user is the developer or engineer who will help integrate the finished form into a larger system. They're not blocked by the design — they can export and work with the files in their own tools — but the screen is not for them. When a design choice trades clarity for the program manager against convenience for the engineer, the program manager wins.

---

## 6. What the author needs to be able to do

A list of things the product has to support, in verbs. How these are grouped, surfaced, or sequenced is the design.

**Start a form.** From nothing. From a conversation with the AI. From a built-in template (things like a housing intake, a grant application, a patient intake form). From an uploaded document — someone drops in a PDF, a Word doc, or a screenshot of an existing form, and the AI tries to turn it into a starting draft. From pasting in an existing form someone else made.

**Shape what the form collects.** Add, remove, rename, reorder, and move the parts of the form. The building blocks are fields (a place where a respondent enters a value), groups (a way to nest fields into sections), and content (headings, paragraphs, banners, dividers — visible but not collected). Fields come in common kinds — text, number, yes/no, date, a choice from a list, multiple choices from a list, money, email, phone, file upload, signature, rating, slider, and so on. Sections can be marked as repeatable with a minimum and maximum (think "household members" or "line items").

**Set up reusable building blocks.** Named lists of options (used in several places across the form, edited in one place). Named formulas (so a value computed once can be referenced from multiple places). External data sources (so a form can reference a list that lives somewhere outside the form).

**Express logic.** The author writes rules that say things like: "this field is required if the respondent selected 'yes' above", "this section is hidden unless they're applying for grant type A", "the total is the sum of these three line items", "warn if the budget exceeds $500,000 but don't block submission". There are two kinds: rules that attach to a single field (is this required? should it be hidden? should it be computed from other fields? is its value valid?) and rules that span the whole form (does the budget balance? does the start date come before the end date?). Cross-form rules also have a *severity* — is this a blocking error, a warning, or a note — and can fire continuously as the respondent types or only when they try to submit. The AI writes most of these rules; the author reads them and adjusts.

**Organize the respondent's journey.** Break a long form into pages. Multi-page forms can be wizards (one page at a time, next / back), tabs (free movement between pages), or a single long page. Authors can also set up an **upfront screener** — a quick set of questions at the start that routes the respondent into a different branch of the form based on their answers.

**Shape how the form looks.** Global choices — colors, type, spacing, density, label position. Overrides for specific kinds of fields or specific fields. Responsive behavior for mobile, tablet, and desktop. A theme is swappable without touching the form's logic or data model.

**Shape how the form is laid out.** Where each field sits on the page, how fields cluster into cards or columns, what widget is used for a given field (a dropdown vs. a radio group vs. a segmented control, for example). This is visual arrangement, separate from what the form collects.

**Shape where the answers go.** When a form is submitted, the answers usually need to feed one or more downstream systems — an API expecting JSON, a legacy system expecting XML, a spreadsheet expecting CSV. The author sets up how each field in the form maps to each downstream format, previews the result, and adjusts. The same submission can feed multiple downstream formats without the author re-entering anything.

**Preview and test.** See the form as a respondent would see it — on a phone, a tablet, a desktop. Fill it in with sample answers and watch the conditional logic, calculations, and validation react in real time. Inspect which rules are firing and why. Feed a saved response in and check whether it would pass validation.

**Converse with the AI.** Two moments:
- *When the form is empty or very early*, the AI interviews the author, asks what they're trying to build, and produces a first draft to work from.
- *Once a form exists*, the author can ask the AI to change it — "add an email field with validation", "split the address into street, city, state, zip", "make the budget section only appear for large grants". The AI makes the changes, shows what it did, and the author can accept, reject, or modify.
The two moments may be one surface or two, one mode or many. That's a design question.

**Review what the AI did.** When the AI proposes changes, the author needs to see what's changing before committing to it — a clear before/after, grouped into a coherent unit the author can accept or reject as a whole. After the changes are accepted, they're undoable like any other edit.

**See problems that need attention.** Contradictions between rules, low-confidence choices the AI made, missing configuration, references to things that don't exist, rules that can never fire — these surface as a reviewable queue with severities. The author can resolve an issue, defer it, or reopen one they resolved.

**Undo and redo.** Every change — whether the author made it or the AI made it — is reversible. The author can walk back any number of steps.

**Save, leave, come back.** Authors close tabs, walk away, crash their browser, and come back the next day. Their work is still there, the conversation with the AI is still there, and they can pick up where they left off. Authors can also have several forms in flight, list them, and switch between them.

**Export and hand off.** At any point, the author can export the form as a set of files to hand to a developer, save to a shared drive, or check into version control.

**Work at real form sizes.** Real forms are often 50–300 fields with dozens of rules, several pages, and multiple repeatable sections. Finding a specific field, filtering to the rules that apply to a given field, searching across the whole form — these stop being nice-to-haves once the form gets past about 30 fields.

**Set form-level metadata.** Title, description, version, status, page mode, density. There are also specialized sidecar documents — translations into other languages, citations to regulations, semantic tagging that ties fields to standard medical or legal concepts — that only certain kinds of authors (multilingual forms, regulated forms, clinical forms) will ever touch. Whether and how those surface in Studio is a scope question worth flagging.

---

## 7. What can't change

A few things about the product are load-bearing — the design can express them in any form, but it can't work around them.

**The author works in concepts, not code.** Program managers don't write code or read raw form files. The design cannot require them to.

**The form's logic is Excel-like formulas.** The author will occasionally read and tweak them, mostly with the AI's help. The design needs a place for formulas — writing, reading, debugging — that feels like editing a spreadsheet formula, not like editing code.

**The AI is always reviewable and reversible.** Anything the AI does has to be visible, understandable, and undoable. The design has to answer: when the AI does something, how does the author see it, evaluate it, and keep or roll it back?

**There are two kinds of rules and the difference matters.** Rules that attach to a single field ("is this required?", "what's the computed value?") and rules that span the form ("does the budget balance?", "is the start date before the end date?") are structurally different — the cross-form ones also have severities and timing. The design should make the distinction legible or the author will conflate them.

**Several concerns are separate on purpose.** The form's data model, its visual theme, its layout, and its downstream output are different things. Changing one doesn't and shouldn't change the others. The design can hide that separation from the author's attention, but the *benefits* (swap the theme, reuse the data model, re-target the output) should come through as natural moments in the product.

**Preview is real.** What the author sees in preview is exactly what a respondent will see — same logic, same calculations, same validation. The design can lean on this truthfully.

**The form must work at 200+ fields.** Not 20. The design should anticipate real forms, which means search, filter, scoping, and navigation at scale matter early.

**Accessibility is first-class.** Government, nonprofit, and clinical audiences often require accessibility conformance. Studio itself should meet accessibility standards, and Studio should help authors produce forms that meet them (for example, by surfacing when a field is missing a label).

**Authors walk away and come back.** Sessions persist. Both the form in progress and the conversation with the AI should still be there the next morning, in another tab, or after a crash.

---

## 8. Today's Studio, at a product level

A brief description of what the current version of Studio does, so you know what exists to react to. You'll be given access to a running instance to look at. Use it to understand the capability surface; do not use it as a layout proposal.

- The workspace is organized around a set of **tabs** — one for the form's structure, one for its logic, one for reference data (options, formulas, external sources), one for the visual layout, one for the theme, one for the downstream output mapping, and one for preview.
- There is a **sidebar** on one side that lets the author jump between views of the form — its structure, its variables, its options, its settings, and so on — with counts showing how many of each thing exist.
- There is a **properties panel** on the other side that changes based on whatever is currently selected.
- There is a **header** with the tab switcher, undo/redo, import/export, and a search palette.
- **Two separate AI surfaces** exist today — one embedded in the editor (for refining an existing form) and one standalone (for starting a form from a conversation). A single unified conversational experience would be welcome.
- **Preview** has a viewport switcher, a place to feed in sample answers, and a diagnostics panel that shows which rules are firing.
- An **issue queue** shows problems the AI or the system has flagged.

That's one answer to what's described in this brief. The exercise is to explore different answers.

---

## 9. Questions a good exploration answers

Any direction you propose should have a point of view on these. You don't need to answer all of them in words — your design should answer them by the way it's put together.

1. What does a first-time author see in the first ten seconds, and what does the product look like it is for?
2. How does an author go from "I need a form" to "I have a first draft"?
3. How does conversation relate to direct manipulation — and what does it feel like when the author switches between them mid-task?
4. When the AI does something, how does the author see what changed and decide whether to keep it?
5. Where do the form's rules live, and how does the author not get lost in them at 40+ rules?
6. When and where does the author see the form-as-respondent? Is preview a mode, a companion, an overlay, or something else?
7. How do the benefits of separation of concerns (swap the theme, reuse the data model, retarget the output) show up as natural moments in the product?
8. How does search and navigation work at 200 fields?
9. What does a broken form look like — a rule that can never fire, a reference to a field that doesn't exist, a failed import?
10. What does the product look like three months into the life of a real form, when the author is maintaining it rather than building it?

---

## 10. The real tension

Studio has to do two things at once.

It has to be a tool a program manager uses for hours at a stretch to build and maintain a correct, complex, high-stakes form. That's craft work — restrained, legible, forgiving, designed for the ninety-eighth minute of use, not the first.

It *also* has to be the most visible surface of the Formspec project — the thing someone sees in a screenshot or a short demo before they decide whether any of this is worth their attention. That means the design has to look, at a single glance, like something meaningfully different from the form builders it competes with. Because it is.

These two pressures reinforce each other when they can (a tool that's a pleasure to use for hours is also a tool that demos well) and pull apart when they can't (flourishes that look great in a hero shot get in the way at hour six; depth takes a walkthrough to appreciate). The brief is to hold both. A direction that only serves the program manager will be competent and invisible. A direction that only serves the screenshot will be beautiful and unusable.

---

## 11. What we're asking for

**Multiple exploratory directions**, not one refined design. Ideally three to five distinct directions that take genuinely different positions on the open questions — different relationships between conversation and direct manipulation, different answers to where preview lives, different takes on how the author navigates a large form, different visual languages. Pick directions that you think have merit; the goal is to widen the space of what Studio could be before we narrow.

For each direction, enough to evaluate it — a high-level description of the point of view, a few key flows (empty state, scaffolding-by-conversation, direct editing, review of an AI change, preview), and one "hero" frame that captures the direction's visual and conceptual identity. Fidelity and polish should be high enough to read the direction clearly; you don't need to mock every screen.

Use real form content in your mockups — not lorem ipsum. We'll provide one or two canonical example forms you can work from.

If you have strong opinions about what's wrong with the brief itself, say so. This is the first version.

---

## 12. What you'll be given

- This brief.
- A short written overview of the Formspec project (the "what and why" at a higher level than this brief goes into).
- Access to a running instance of today's Studio to look at.
- One or two canonical example forms (form content, as you'd see it on paper) to use in your mockups.
- Formspec brand assets — logo, typography, palette — if they exist. If they don't or are incomplete, you're welcome to propose.
- Access to subject-matter experts to answer questions as they come up, either synchronously or in writing.

You do not need, and will not be given, access to the Formspec source code or internal documentation. This brief contains everything about the product you need to design against; if something is missing, ask.





