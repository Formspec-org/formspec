# Formspec Studio Iteration History

## 2026-03-12 - Ralph Wiggum Loop - Iteration 1

What I tried:
- Read the existing notes in [visual_bugs.md](/Users/mikewolfd/Work/formspec/thoughts/formspec-studio/visual_bugs.md) to avoid duplicating the first pass.
- Confirmed the correct working folder is `thoughts/formspec-studio/`. There was no existing `history.md` in that directory.
- Started the local Studio dev server with `npm run dev --workspace=formspec-studio -- --host 127.0.0.1 --port 5173`.
- Verified Vite came up on `http://127.0.0.1:5173/studio/`.
- Tried the built-in browser MCP against both `http://localhost:5173/studio/` and `http://127.0.0.1:5173/studio/`. In this session, each navigation attempt was cancelled before the page opened.
- Tried shell-driven Playwright against the running Studio app as a fallback. Chromium, WebKit, and Firefox launches all failed under sandbox/browser-process restrictions on this machine.
- Continued the pass by inspecting the live Studio codepaths that drive the running app and documented additional UI/UX issues that are directly implied by those flows.

Browser/tooling blockers seen this iteration:
- Browser MCP snapshot worked only on `about:blank`; navigation to the Studio URL was cancelled externally.
- Shell Playwright `chromium.launch()` failed with a Mach port permission error.
- Shell Playwright `webkit.launch()` aborted during startup.
- Shell Playwright `firefox.launch()` failed to start cleanly in this sandbox.

New findings added this iteration:
- Editor context menu can render off-screen near viewport edges.
- Paged editor tabs hide labels for inactive pages.
- Enabling page mode can make existing root-level items disappear from the main authoring surfaces.

## 2026-03-12 - Ralph Wiggum Loop - Iteration 2

What I tried:
- Read the existing notes in [visual_bugs.md](/Users/mikewolfd/Work/formspec/thoughts/formspec-studio/visual_bugs.md) and [history.md](/Users/mikewolfd/Work/formspec/thoughts/formspec-studio/history.md) first so this pass stayed additive.
- Confirmed the local Studio dev server was still listening on port `5173`.
- Tried the Playwright MCP browser again against `http://127.0.0.1:5173/studio/`, including direct navigation, tab listing, browser install, and code-driven `page.goto()`. In this session, every real page-open attempt was cancelled before navigation completed.
- Fell back to the checked-in Studio screenshots under `packages/formspec-studio/research/assets/` and compared those visuals against the current shell/workspace source.
- Used the existing React/Vitest studio test harness and source modules to trace concrete authoring flows in the editor, logic workspace, blueprint sidebar, and global keyboard handling.

Browser/tooling blockers seen this iteration:
- Playwright MCP could return a snapshot for `about:blank`, but every attempt to open the local Studio URL was cancelled externally.
- Shell Playwright Chromium launch still failed under the same macOS sandbox Mach-port permission error, so a real browser automation pass was not possible from the terminal.

New findings added this iteration:
- The properties inspector exposes a `+ Add Rule` button that is fully styled as an authoring control but has no behavior.
- The Logic workspace `FilterBar` presents filter-like chips that never change state or filter the content below.
- The blueprint sidebar never shows a count for `Component Tree` because the count is hardcoded to zero.
- Delete/backspace remains globally destructive across workspaces, so an item selected in the editor can be deleted while working in another tab.

## 2026-03-12 - Ralph Wiggum Loop - Iteration 6 (live browser — this pass)

What I tried:
- Read [visual_bugs.md](/Users/mikewolfd/Work/formspec/thoughts/formspec-studio/visual_bugs.md) and [history.md](/Users/mikewolfd/Work/formspec/thoughts/formspec-studio/history.md) first to stay additive (found bugs 1–63 already documented across 5 previous iterations).
- Connected to the already-running dev-browser MCP server (headless Chromium, port 9222), navigated to `http://localhost:5173/studio/` and confirmed the Section 8 HCV form loaded.
- Explored **Preview workspace** in depth: confirmed "Applicant Information" group renders heading with NO fields; confirmed form has no Submit button; confirmed computed "Adjusted Income" doesn't update when Gross Annual Income is entered; tested "Add Members" in repeatable group (works but no Remove button); tested JSON view sub-tabs (Component/Theme show only stubs; Mapping shows empty).
- Tested **Import dialog** end-to-end: confirmed missing `role="dialog"` ARIA; Load button stays enabled with invalid JSON; successful import does replace the form correctly.
- Imported a minimal test form `{ "$formspec": "1.0", "title": "My Test Form", ... }` and explored the empty-state experience: correct "No pages defined" empty state; wizard page add works; orphaned items (items without a page) are invisible after a page is added.
- Explored **Mapping workspace** all 4 tabs: Config (Configuration ▶ button is a no-op, Direction unset unclickable), Rules (empty, no Add button), Adapter (no affordance), Preview (shows "Direction: outbound" while Config shows "unset").
- Checked **Blueprint sidebar** all sections: Settings (confirmed read-only), Component Tree (shows "No component tree"), Theme (no content), Variables (shows expressions but inert), Screener ("Disabled"), Migrations ("No migrations defined").
- Checked **footer URL** — confirmed it's a `<div>` not an `<a>` element.
- Confirmed **no "New Form" option** anywhere in the Studio.
- Tested **desktop/tablet viewports** (Desktop=748px, Tablet=748px, Mobile=375px) — identical widths for desktop and tablet confirmed (same as bug #41).

Browser tools used:
- dev-browser MCP (already running port 9222), Playwright screenshots, ARIA snapshots via `getAISnapshot()`, `selectSnapshotRef()`, DOM `evaluate()`.

New findings added this iteration (bugs 64–72):
- Import dialog missing `role="dialog"` and `aria-modal` (accessibility).
- Import Load button stays enabled with invalid JSON.
- Mapping Config "Configuration ▶" section button is a no-op.
- Footer URL is a `<div>` not a link.
- Preview form has no Submit button.
- Preview computed fields don't recalculate.
- Preview repeatable group: no Remove button on added members.
- Preview JSON Component and Theme sub-tabs show only stubs; Mapping sub-tab is empty.
- No "New Form" or "Create Form" affordance in Studio.

## 2026-03-12 - Ralph Wiggum Loop - Iteration 6 (old entry — placeholder written before browser access)

What I tried:
- Read [visual_bugs.md](/Users/mikewolfd/Work/formspec/thoughts/formspec-studio/visual_bugs.md) and [history.md](/Users/mikewolfd/Work/formspec/thoughts/formspec-studio/history.md) first to stay additive (found bugs 1–24 already documented).
- Successfully connected to the already-running dev-browser MCP server (headless Chromium, page "studio" already open).
- Navigated to `http://localhost:5173/studio/` and got a live screenshot confirming the app was loaded.
- Explored: field selection → inspector (noted only IDENTITY section with KEY/TYPE/DATATYPE visible), key rename via inspector input (found inspector loses selection after rename), undo/redo (both work correctly), form title click (not editable from canvas), Variables section (inert link-style rows), Screener (shows "Disabled"), Migrations (shows "No migrations defined"), Settings (read-only metadata, TITLE truncated), double-clicking field label (no inline edit), Logic workspace (filter chips, FEL Reference panel with function categories), Theme workspace (all 6 sub-tabs empty with no create affordance), Mapping workspace Config tab (Direction "unset" button, Escape doesn't close the resulting picker), Add Item palette (keyboard navigation works as advertised, Enter adds item, but new item is NOT auto-selected in inspector).
- Read `ItemProperties.tsx` source and confirmed root cause of Bug #22: `defaultValue={currentKey}` (uncontrolled React input) — input never updates when field selection changes.
- Also confirmed that `selectedKey` resolves by path string, so a key rename breaks inspector resolution ("Item not found: app.name").

Browser tools used:
- dev-browser MCP (already running), Playwright screenshots, ARIA snapshots, `page.evaluate()`, element ref interactions.

New findings added this iteration (bugs 25–31):
- Inspector shows "Item not found: [old path]" after KEY rename (root cause: uncontrolled `defaultValue` + path-based resolution).
- After adding a new item via Add Item palette, inspector does NOT auto-select the new item.
- Settings panel is entirely read-only — no form metadata (title, URL, version, status) is editable.
- Settings TITLE value is truncated with no tooltip.
- All 6 Theme workspace sub-tabs show empty state with no way to add anything.
- Variables in blueprint sidebar are inert (look like blue links but have no click handler).
- Escape does not close the Mapping "Direction" item picker (third modal to ignore Escape).

## 2026-03-12 - Ralph Wiggum Loop - Iteration 3 (new browser session)

What I tried:
- Read [visual_bugs.md](/Users/mikewolfd/Work/formspec/thoughts/formspec-studio/visual_bugs.md) and [history.md](/Users/mikewolfd/Work/formspec/thoughts/formspec-studio/history.md) first (found bugs 1–31 already documented from prior sessions).
- Confirmed the dev-browser MCP server was already running (port 9222) with a "studio" page open.
- Navigated to `http://localhost:5173/studio/` and confirmed the Studio loaded with the Section 8 HCV form.
- Explored: Logic workspace (FEL Reference panel, SHAPES section — shapes are read-only, no inspect-on-click), Editor Household page (repeatable Members group, inspector path mismatch), adding a new wizard page (+), Screener section (inert badge), Data workspace (Response Schema, Data Sources, Option Sets, Test Response), Preview workspace (Form view — flat render, JSON view with sub-tabs).
- Also tested: DUPLICATE button behavior (works but doesn't auto-select duplicate), Undo/Redo (works correctly), FEL Reference panel (Escape closes it), key rename vs cross-field inspector stale state, bind path mismatch root cause in ItemProperties source.

Browser tools used:
- dev-browser MCP (already running), Playwright screenshots, ARIA snapshots via `getAISnapshot()`, `selectSnapshotRef()`, `page.evaluate()`.

New findings added this iteration (bugs 32–40):
- Inspector Behavior Rules section NEVER renders — `arrayBindsFor` uses full dot-paths but fixture binds use relative paths (path mismatch).
- Response Schema shows repeatable group `members` as type "object" instead of "array".
- Response Schema label values look like links but are inert.
- Data Sources tab is an empty stub with no create affordance.
- Test Response tab shows raw "future implementation." placeholder string.
- Screener "Disabled" badge is inert — no way to enable a screener.
- Preview renders wizard-mode form as a flat single-scroll page with no Next/Previous wizard navigation.
- Preview JSON view has no copy-to-clipboard button.
- Inspector DUPLICATE/DELETE buttons remain active in non-Editor workspaces (Data, Logic, Preview, etc.).

## 2026-03-12 - Ralph Wiggum Loop - Iteration 5 (this pass)

What I tried:
- Read [visual_bugs.md](/Users/mikewolfd/Work/formspec/thoughts/formspec-studio/visual_bugs.md) and [history.md](/Users/mikewolfd/Work/formspec/thoughts/formspec-studio/history.md) first (found bugs 1–52 already documented).
- Connected to the already-running dev-browser MCP server (headless Chromium, port 9222) and navigated to `http://localhost:5173/studio/`.
- Explored: inspector panel for Choice type fields, Add Item palette full type catalog (Text, Integer, Decimal, Money, Single Choice, Multiple Choice, Yes/No, Date, Date & Time, File Upload, Barcode, Location, Group, Repeatable Group, Display), added a Single Choice field and checked inspector, Blueprint Mappings section, Logic workspace FEL Reference panel (clicking functions), Logic workspace expressions editability, Option Sets tab (contrast of chips), Data workspace type "attachment", drag-to-reorder capability, multi-select (Shift+click), logo/avatar clickability, Household page (Members group, cardinality badge), right-click on empty canvas, Tab key navigation, command palette re-open state (confirmed bug #15 still present).

Browser tools used this iteration:
- dev-browser MCP server (already running port 9222), Playwright screenshots, ARIA snapshots, `page.evaluate()` for style checks, `client.selectSnapshotRef()` for clicking specific elements.

New findings added this iteration (bugs 53–63):
- Choice field inspector shows no options/choices section (High).
- Option set chips: dark text on dark background (near-zero WCAG contrast) — bg-neutral-800 + slate-900 text (High).
- FEL Reference panel function entries: clicking a function does nothing (no insert, no copy, just closes panel) (Medium).
- No drag handles on field cards — fields cannot be reordered at all (High).
- Inspector has no Label field — field display names are not editable (High).
- App logo ("The Stack") does nothing when clicked (Low).
- Avatar icon in header does nothing when clicked (Low).
- Logic workspace expressions are completely read-only — no authoring possible (High).
- Context menu appears on right-click in empty canvas area with no clear field target (Medium).
- Tab key navigates to inspector input instead of between canvas fields (Low).
- New field auto-generates key like "select11" with no prompt and no auto-focus to rename (Medium).

## 2026-03-12 - Ralph Wiggum Loop - Iteration 5 (archived — this was the PREVIOUS iteration 5 entry)

What I tried:
- Read [visual_bugs.md](/Users/mikewolfd/Work/formspec/thoughts/formspec-studio/visual_bugs.md) and [history.md](/Users/mikewolfd/Work/formspec/thoughts/formspec-studio/history.md) first to stay additive.
- Successfully launched the dev-browser MCP server (headless Chromium) and navigated to `http://localhost:5173/studio/`.
- For the first time in this loop, actual live browser interaction was possible: screenshots, DOM inspection, keyboard events, and ARIA snapshots all worked.
- Explored: Editor (pages 1-2, field selection, inspector, right-click context menu), Logic workspace (filter chips, binds list, shapes section), Data workspace (all 4 sub-tabs: Response Schema, Data Sources, Option Sets, Test Response), Theme workspace (6 sub-tabs: Tokens through Breakpoints), Preview workspace (Form/Json toggle, Desktop/Tablet/Mobile viewports, DOM inspection of formspec-render), Mapping workspace (Config, Rules palette), command palette (⌘K search + keyboard nav), Add Item palette (keyboard nav + type browsing), Blueprint sidebar (Component Tree, Screener, Settings, Migrations), Import dialog (escape test).

Browser tools used this iteration:
- dev-browser MCP server (`./server.sh --headless`), Playwright Chromium in headless mode, page screenshots, DOM `evaluate()`, ARIA snapshots via `getAISnapshot()`, `selectSnapshotRef()`.

New findings added this iteration:
- Inspector KEY input is stuck showing the value of the first field selected; it never updates when switching between fields (SSN, Marital Status, Members.Name all showed "name").
- Preview webcomponent (`<formspec-render>`) silently omits String, Integer, Date, and Choice fields — confirmed by DOM inspection showing 0 children in the Applicant Information group and missing `hhSize`, `incSrc`, `empName` across other pages. Only Boolean, Money, Display, and File fields render.
- Studio has Import but no Export — the avatar icon opens nothing, the Import dialog is inbound-only, and there is no Copy/Download/Export affordance anywhere.

Additional observations (confirmed existing bugs live):
- Bug #10: inactive page tabs only show numbers, confirmed in both page tab ARIA and screenshots.
- Bug #13: Logic filter chips confirmed static — clicking "required (13)" produced no change.
- Bug #17: ⌘K palette confirmed mouse-only — ArrowDown produced no visual row selection.
- Bug #21: Escape confirmed NOT dismissing Import dialog — `dialogVisible` returned `true` after Escape.
- Bug #7: context menu "Move Up" is a no-op — confirmed via click with no field order change.

## 2026-03-12 - Ralph Wiggum Loop - Iteration 4 (archived — written before browser access)

What I tried:
- Read the current [visual_bugs.md](/Users/mikewolfd/Work/formspec/thoughts/formspec-studio/visual_bugs.md) and [history.md](/Users/mikewolfd/Work/formspec/thoughts/formspec-studio/history.md) first so this pass stayed additive.
- Tried the Playwright MCP browser again against `http://127.0.0.1:5173/studio/`. Navigation was cancelled before the page opened, so I used the live Studio component/test surface instead of inventing behavior.
- Traced the command palette, import dialog, and shell-level keyboard handling that ship in the mounted app to look for modal/search regressions a real user would hit repeatedly.
- Ran targeted Studio component tests with `npm run --workspace=formspec-studio test -- --run tests/components/command-palette.test.tsx tests/components/import-dialog.test.tsx` to verify the surrounding UI surface is still green while documenting the gaps.

Browser/tooling blockers seen this iteration:
- Playwright MCP navigation to the local Studio URL was still cancelled externally before a page snapshot could be captured.
- Because the browser surface could not be opened through MCP, this pass relied on the current React components and tests that drive the same user flows.

New findings added this iteration:
- The `⌘K` command palette reopens with the previous search still applied.
- The import dialog reopens with stale artifact type, JSON content, and parse errors.
- `Escape` closes the command palette but does not dismiss the import dialog.

## 2026-03-12 - Ralph Wiggum Loop - Iteration 4 (live browser — this pass)

What I tried:
- Read [visual_bugs.md](/Users/mikewolfd/Work/formspec/thoughts/formspec-studio/visual_bugs.md) and [history.md](/Users/mikewolfd/Work/formspec/thoughts/formspec-studio/history.md) first (found bugs 1–40 already documented from prior sessions).
- Connected to the already-running dev-browser MCP server (headless Chromium, port 9222) and confirmed the Studio page was open.
- Navigated to `http://localhost:5173/studio/` and got a live screenshot confirming the Section 8 HCV form loaded.
- Systematically explored areas not previously tested in depth: Blueprint sidebar (Theme, Component Tree, Option Sets, Mappings, Variables), Mapping workspace (all 4 sub-tabs: Config, Rules, Adapter, Preview), Theme workspace (all 6 sub-tabs), Preview workspace (Desktop/Tablet/Mobile viewport buttons), Editor context menu (Move Down, Wrap in Group), repeatable group inspector, page tab rename, Blueprint Structure click-to-navigate.

Browser tools used:
- dev-browser MCP server (already running port 9222), Playwright ARIA snapshots via `getAISnapshot()`, `selectSnapshotRef()`, `page.evaluate()` for cursor/style checks, `page.mouse.click()` for right-click context menus, `page.$()` and `page.getByText()` for DOM-driven interaction.

New findings added this iteration (bugs 41–52):
- Desktop and Tablet Preview viewports produce identical widths (714 px); only Mobile actually changes.
- "Wrap in Group" context menu is a no-op — clicking it does nothing.
- "Move Down" context menu is a no-op (extends known Bug #7 for Move Up).
- Wizard page tabs cannot be renamed — double-click and right-click both do nothing.
- Blueprint Structure click doesn't scroll/highlight the field in the editor canvas.
- Mapping Config "Direction: unset" badge is not clickable; no way to set the direction.
- Blueprint section collapse/expand toggle ▶ arrow never changes state.
- Option Set cards in Data workspace are read-only; no edit affordance.
- Logic workspace Bind rows don't select in inspector when clicked.
- Logic workspace Shapes section is inconsistent — only first shape shows FEL expression.
- Form canvas header metadata (URL, version, wizard, USD) is not interactive.
- Repeatable group inspector shows no cardinality (min/max) settings.
