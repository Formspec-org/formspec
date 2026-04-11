# Editor Row Vision

**Date:** 2026-03-27  
**Status:** Draft  
**Scope:** `packages/formspec-studio/` Editor workspace only

## Vision

The Editor should stop feeling like a tree on the left and a real editor on the right. The row itself should become the primary editing surface.

That means each row needs to do three jobs well:

1. identify the item clearly
2. expose the most important current configuration without hiding it in the sidebar
3. advertise what is missing and addable without forcing a trip into a properties panel

The goal is not to turn every row into a full inspector. The goal is to make the structure view truthful, legible, and useful enough that the right sidebar becomes secondary rather than mandatory.

## Why Replace The Current Pattern

The existing editor still carries too much separation between structure and detail:

- the tree shows that an item exists, but not enough of what it is
- the properties sidebar holds too much of the actual meaning
- rows have historically wasted horizontal space while hiding important state
- older users pay the price first because the current metadata treatment is small and low-contrast

If the form author has to click every row just to discover what is configured, the editor is not doing enough work.

## Product Thesis

The Editor should feel like an annotated outline, not a schema tree plus inspector.

- groups are section landmarks
- fields are readable editorial rows
- the row shows both what exists and what can be added
- common edits happen inline
- complex edits move to a lighter secondary surface

This is still a tree editor, not a spreadsheet and not a canvas.

## Visual Thesis

The row design should be flatter, denser, and more typographically confident than the current implementation.

- larger type floor for labels and metadata
- stronger contrast in light mode
- fewer boxes and fewer soft surfaces
- group dividers that feel architectural, not decorative
- one contiguous row band instead of disconnected islands

The editor should read more like a document outline with embedded facts than a pile of cards.

## Structure Model

### Group Headers

Groups should look like section dividers, not just expandable rows.

- stronger label and key treatment than child rows
- restrained vertical rule or accent bar
- clear collapse control with a large hit target
- inline add affordance on the right
- summary line when useful: repeatable, child count, notable behaviors

Groups need enough presence that the author can scan the form as a hierarchy before reading any field details.

### Field Rows

Each field row should have three bands:

1. identity
   - label
   - key
   - type
2. facts
   - current high-signal configuration
3. state and actions
   - behavior pills
   - add-missing actions
   - row actions

This keeps the row informative without becoming a second properties panel.

## What Always Shows In The Row

Every row should show the item identity first:

- label
- key
- item kind / data type

Then it should show the highest-signal configured facts, capped to a small set:

- description
- hint
- initial value
- prefix / suffix
- currency / precision
- semantic type
- option count
- pre-populate source
- active bind summaries such as required, relevant, readonly, calculate, constraint

The row should not try to show every possible property all the time. It should show the most meaningful configured facts and keep the rest behind expansion or secondary editing surfaces.

## What Must Be Addable From The Row

If a property is optional and absent, the row should advertise that absence with an add affordance.

Baseline addable properties:

- `+ Add description`
- `+ Add hint`
- `+ Add behavior`

Secondary addable properties, depending on field type:

- `+ Add initial value`
- `+ Add semantic type`
- `+ Add prefix`
- `+ Add suffix`
- `+ Add options`
- `+ Add pre-populate`

The rule is simple: if the author can reasonably expect to add something from the properties panel without leaving the row context, the row should make that possibility visible.

## Inline Editing Model

Inline editing should be narrow and intentional.

### Good Inline Edits

- label
- key
- description
- hint
- initial value
- prefix / suffix
- simple constraint message text
- repeatable toggle and repeat limits for groups

### Quick-Edit Popover Edits

- required / relevant / readonly toggles and simple expressions
- calculate expression
- constraint expression
- pre-populate source
- choice list editing

### Still Better In A Secondary Surface

- long FEL expressions
- complex option management
- anything with multiple coupled controls
- advanced field configuration with dense validation rules

The row should make common edits fast, but it should not collapse into a crowded form builder inside each line item.

## Selection Model

Selection should be visually unified across the sidebar, center editor, and any secondary panel.

- selecting a row highlights the corresponding sidebar item
- selecting an item in another group updates the active group in the sidebar
- selected rows gain a stronger active band, not just a faint outline
- the inspector, if present, mirrors the same identity treatment and path

The user should never have to wonder which item is the current editing target.

## Sidebar Relationship

The sidebar should support navigation, not carry hidden truth.

The row-driven editor reduces the sidebar to:

- group navigation
- scoped child navigation
- structural add entry points

The sidebar should not be the place where the author discovers meaning that the row itself is hiding.

## What Replaces The Properties Sidebar

The properties sidebar should shrink from “the only place to understand the item” into a secondary detail surface.

The new order of operations should be:

1. scan and understand from the row
2. make common changes inline
3. open a secondary panel only for advanced or dense edits

This could still be a right rail, but it should no longer be required for ordinary authoring.

## Accessibility And Readability Requirements

This editor has to work for older users and keyboard users, not just designers looking at a mock.

- row label text should not drop below a comfortable reading size
- metadata text should stay readable in light mode
- focus indicators must be singular, visible, and not visually conflicting
- icon-only controls need accessible names
- inline edit states must preserve keyboard order and visible focus
- expandable groups must expose correct expanded state
- destructive actions need explicit confirmation

Color contrast in the row system should be treated as a first-class requirement, especially in white mode.

## Non-Goals

This vision does not try to:

- turn Editor into Layout
- expose every advanced property inline
- remove all secondary editing surfaces
- make the tree responsible for visual page layout

The Editor remains a Tier 1 definition editor. The row system just makes that editing model much more honest and direct.

## Implementation Direction

The replacement should happen in phases:

1. finalize the row contract in the unwired demo
2. port the row structure into the real Editor tree
3. move high-frequency properties into inline editing or quick-add
4. reduce the right rail to advanced editing
5. test desktop, mobile, keyboard, and high-density cases

The first production milestone is not “delete the sidebar.” It is “make the rows sufficient for normal editing.”

## Open Questions

- Which exact facts are always visible before the row becomes too dense?
- When does a row expand versus opening a popover?
- How many inline editors can be open at once?
- Should the mobile editor keep the same row model with stacked edits, or use a dedicated detail sheet?
- Should groups expose repeat configuration directly in the header, or only on selection?

## Bottom Line

The Editor should become a readable, editable outline of the form itself.

Authors should be able to understand most of the form by looking at the tree, make the common changes without leaving the row, and only reach for a secondary panel when the edit is genuinely complex. That is the bar for replacing the current sidebar-heavy model.
