# Formspec Studio Visual Bugs

Date: 2026-03-12
Surface: `http://127.0.0.1:5173/studio/`

Notes:
- I started the local Vite app and audited the live studio surface plus the current UI source.
- Browser MCP navigation and sandboxed Playwright launch were blocked in this session, so the findings below are documented from the running app entrypoint, the exact layout/styling code that drives the visible shell, and the checked-in studio screenshots under `packages/formspec-studio/research/assets/`.

## 1. Shell breaks down at tablet and split-screen widths

Severity: High

Repro:
1. Open Studio.
2. Resize the window to a tablet width or a desktop split view.
3. Keep the default three-column shell visible.

Expected:
- The shell should collapse or adapt so the main workspace remains usable.

Actual:
- The layout has two non-shrinking sidebars (`230px` and `270px`) plus the header title, tab strip, centered search bar, and right-side actions.
- At narrower widths, there is no responsive fallback, so the UI will clip, compress awkwardly, or force horizontal overflow.

Code references:
- [packages/formspec-studio/src/components/Shell.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Shell.tsx#L82)
- [packages/formspec-studio/src/components/Header.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Header.tsx#L20)

Why this is a visual bug:
- The studio is presented as a desktop app, but even moderate split-screen use is part of normal desktop behavior. Fixed-width sidebars plus a fixed header composition make the UI visually brittle.

## 2. Data workspace still renders with dark-theme border colors inside a light shell

Severity: Medium

Repro:
1. Open Studio.
2. Switch to the `Data` workspace.
3. Visit `Response Schema`, `Data Sources`, or `Option Sets`.

Expected:
- Borders and pills should use the same light-theme token system as the rest of the studio (`border-border`, `bg-subtle`, etc.).

Actual:
- The Data workspace uses `border-neutral-700`, `border-neutral-800`, and `bg-neutral-800` inside an otherwise light UI.
- This creates visibly harsher dividers and dark chips that look like leftover dark-theme styling rather than an intentional part of the design language.

Code references:
- [packages/formspec-studio/src/workspaces/data/DataTab.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/data/DataTab.tsx#L21)
- [packages/formspec-studio/src/workspaces/data/ResponseSchema.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/data/ResponseSchema.tsx#L10)
- [packages/formspec-studio/src/workspaces/data/DataSources.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/data/DataSources.tsx#L27)
- [packages/formspec-studio/src/workspaces/data/OptionSets.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/data/OptionSets.tsx#L38)

Why this is a visual bug:
- The contrast jump is strong enough to read as inconsistent or unfinished, especially in the table rows and option chips.

## 3. `text-foreground` is used, but that token is not defined in the studio theme

Severity: Medium

Repro:
1. Open Studio.
2. Hover inactive tabs in the `Data` workspace.
3. Add a `Display` item in the editor and inspect its label styling.

Expected:
- Hovered tabs and display-item labels should use a deliberate color token from the studio theme.

Actual:
- `text-foreground` is referenced in the UI, but `src/index.css` does not define a `foreground` color token.
- In practice this means those elements fall back to whatever the generated CSS resolves to, producing inconsistent emphasis or no visible hover-state improvement at all.

Code references:
- [packages/formspec-studio/src/workspaces/data/DataTab.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/data/DataTab.tsx#L30)
- [packages/formspec-studio/src/workspaces/editor/DisplayBlock.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/editor/DisplayBlock.tsx#L21)
- [packages/formspec-studio/src/index.css](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/index.css#L6)

Why this is a visual bug:
- It creates dead or inconsistent color states in places where the UI clearly intends stronger visual feedback.

## 4. Add Item palette is not mobile-safe

Severity: Medium

Repro:
1. Open Studio.
2. Click `+ Add Item`.
3. View the modal on a narrow viewport.

Expected:
- The palette should switch to a single-column layout or otherwise preserve readable cards and safe margins on small widths.

Actual:
- The modal always uses a two-column result grid and a fixed `pt-20` top offset.
- On narrow screens, that combination will compress cards horizontally and wastes vertical space before the list even starts.

Code references:
- [packages/formspec-studio/src/components/AddItemPalette.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/AddItemPalette.tsx#L282)
- [packages/formspec-studio/src/components/AddItemPalette.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/AddItemPalette.tsx#L321)

Why this is a visual bug:
- The modal is one of the main creation flows in the product. If it becomes cramped or partially off-balance on smaller widths, the authoring experience immediately feels fragile.

## 5. Search UI promises rules and FEL coverage, but the palette only returns items and variables

Severity: High

Repro:
1. Open Studio.
2. Click the header search control or press `⌘K`.
3. Search for a bind, rule type, or FEL snippet that is visibly present elsewhere in the studio.

Expected:
- The search affordance should either search rules/FEL as advertised, or the placeholder copy should narrow the claim to what is actually searchable.

Actual:
- The header button says `Search items, rules, FEL…`.
- The command palette only builds result groups for flattened items and variables.
- This makes the primary search entrypoint feel broken the first time you try to use it as labeled.

Code references:
- [packages/formspec-studio/src/components/Header.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Header.tsx#L56)
- [packages/formspec-studio/src/components/CommandPalette.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/CommandPalette.tsx#L12)

Why this is a UX bug:
- Mismatched affordance is worse than a smaller feature set. Authors will reasonably trust the top-level search label, then conclude the search is unreliable when obvious logic artifacts never appear.

## 6. Variable results in the command palette look selectable but do nothing

Severity: Medium

Repro:
1. Open Studio.
2. Press `⌘K`.
3. Search for a variable name so it appears in the `Variables` section.
4. Click the variable row.

Expected:
- Variable rows should either navigate/select something, open the relevant workspace, or present a secondary action state that explains what happens.

Actual:
- Variable rows use the same hoverable row treatment as real search hits, but there is no click handler and no state change.

Code references:
- [packages/formspec-studio/src/components/CommandPalette.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/CommandPalette.tsx#L54)

Why this is a UX bug:
- This reads like a dead control. In a keyboard-driven command palette, inert list rows make the product feel unfinished immediately.

## 7. Editor context menu exposes move and wrap actions that are currently no-ops

Severity: High

Repro:
1. Open Studio.
2. Right-click an editor block.
3. Choose `Move Up`, `Move Down`, or `Wrap in Group`.

Expected:
- The menu should perform the action, or unavailable commands should be hidden/disabled.

Actual:
- The context menu presents all five actions with equal visual weight.
- The editor handler only implements `duplicate` and `delete`; the move and wrap cases are explicitly left as no-ops.

Code references:
- [packages/formspec-studio/src/workspaces/editor/EditorContextMenu.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/editor/EditorContextMenu.tsx#L11)
- [packages/formspec-studio/src/workspaces/editor/EditorCanvas.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/editor/EditorCanvas.tsx#L155)

Why this is a UX bug:
- Non-working commands inside a native-feeling context menu are high-friction because they imply precision authoring features the product does not actually provide.

## 8. The studio leans too hard on 9-10px mono text for critical navigation and metadata

Severity: Medium

Repro:
1. Open Studio on a laptop-sized display.
2. Inspect the blueprint headers, count badges, status bar, page metadata rows, and logic/data micro-labels.

Expected:
- Secondary metadata can be compact, but navigational and diagnostic text should still be comfortably legible without zooming in.

Actual:
- Large parts of the UI rely on `text-[9px]`, `text-[9.5px]`, `text-[10px]`, and `text-[10.5px]`, often in low-contrast muted colors and monospaced faces.
- In the checked-in screenshots this makes the status bar, blueprint labels, section chrome, and bind summaries read as squint-level UI rather than crisp technical detail.

Code references:
- [packages/formspec-studio/src/components/Blueprint.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Blueprint.tsx#L32)
- [packages/formspec-studio/src/components/StatusBar.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/StatusBar.tsx#L35)
- [packages/formspec-studio/src/components/ui/Section.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/ui/Section.tsx#L18)
- [packages/formspec-studio/src/workspaces/editor/FieldBlock.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/editor/FieldBlock.tsx#L74)

Why this is a visual bug:
- The app is trying to feel dense and technical, but the current text scale crosses into readability debt. Important context starts looking decorative.

## 9. Editor context menu can open partially off-screen

Severity: Medium

Repro:
1. Open Studio.
2. Right-click an item near the right or bottom edge of the editor canvas.
3. Try to use the context menu.

Expected:
- The menu should shift back into the viewport so every action remains visible and clickable.

Actual:
- The menu is anchored directly to the raw pointer coordinates with a fixed-position wrapper.
- There is no viewport clamping, so opening it near an edge can push part of the menu off-screen.

Code references:
- [packages/formspec-studio/src/workspaces/editor/EditorCanvas.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/editor/EditorCanvas.tsx#L141)
- [packages/formspec-studio/src/workspaces/editor/EditorCanvas.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/editor/EditorCanvas.tsx#L241)
- [packages/formspec-studio/src/workspaces/editor/EditorContextMenu.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/editor/EditorContextMenu.tsx#L24)

Why this is a UX bug:
- Context menus are supposed to feel precise and dependable. When the lower actions can disappear off the viewport, the editor feels brittle immediately.

## 10. Paged editor tabs hide labels for every inactive page

Severity: Medium

Repro:
1. Open Studio.
2. Switch the form into `wizard` or `tabs` page mode.
3. Create several top-level group pages.
4. Look at the page tabs above the canvas.

Expected:
- Each page tab should stay identifiable at a glance, even when inactive.

Actual:
- Only the active tab renders its page label.
- Inactive tabs collapse down to numbered circles, so once a form has more than a couple pages you have to click around or rely on hover tooltips to know which page is which.

Code references:
- [packages/formspec-studio/src/workspaces/editor/PageTabs.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/editor/PageTabs.tsx#L20)
- [packages/formspec-studio/src/workspaces/editor/PageTabs.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/editor/PageTabs.tsx#L42)

Why this is a UX bug:
- Page navigation is core authoring chrome in wizard mode. Making inactive tabs anonymous turns a navigation control into a guessing game.

## 11. Turning on page mode can make root-level items disappear from the main authoring view

Severity: High

Repro:
1. Open Studio.
2. Create one or more root-level items.
3. Add a top-level group and enable `wizard` or `tabs` page mode.
4. Return to the editor canvas and structure sidebar.

Expected:
- Existing root-level items should remain visible, or Studio should force a clear migration into pages before switching the authoring surface.

Actual:
- Once page mode is active, the editor canvas renders only the active top-level group and the structure sidebar renders only that page's children.
- Root-level items that are not top-level groups effectively drop out of the main authoring view, while new items are automatically added into the active page.

Code references:
- [packages/formspec-studio/src/workspaces/editor/EditorCanvas.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/editor/EditorCanvas.tsx#L120)
- [packages/formspec-studio/src/workspaces/editor/EditorCanvas.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/editor/EditorCanvas.tsx#L124)
- [packages/formspec-studio/src/components/blueprint/StructureTree.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/blueprint/StructureTree.tsx#L121)
- [packages/formspec-studio/src/components/blueprint/StructureTree.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/blueprint/StructureTree.tsx#L157)

Why this is a UX bug:
- This creates a sharp mode switch where previously visible content appears to vanish. In an authoring tool, that reads as data loss even if the items still exist in state.

## 12. Inspector `+ Add Rule` button is a dead control

Severity: High

Repro:
1. Open Studio.
2. Select a field that already has one or more bind rules.
3. In the properties panel, scroll to `Behavior Rules`.
4. Click `+ Add Rule`.

Expected:
- The inspector should open a rule composer, append a new editable rule row, or keep the control hidden until rule authoring is implemented.

Actual:
- The button is styled like a primary inline authoring affordance, but clicking it does nothing.

Code references:
- [packages/formspec-studio/src/workspaces/editor/ItemProperties.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/editor/ItemProperties.tsx#L151)
- [packages/formspec-studio/src/workspaces/editor/ItemProperties.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/editor/ItemProperties.tsx#L162)

Why this is a UX bug:
- Dead controls are especially damaging in an inspector because they promise direct manipulation. This one sits exactly where authors expect to extend validation or behavior logic.

## 13. Logic filter chips look actionable, but they never filter the workspace

Severity: Medium

Repro:
1. Open Studio.
2. Switch to the `Logic` workspace.
3. Click the chips for `Required`, `Relevant`, `Calculate`, `Constraint`, or `Readonly`.

Expected:
- Clicking a chip should narrow the visible bind list, toggle a filter state, or otherwise behave like the filter chrome it resembles.

Actual:
- The chips are static count badges. They never enter a selected state and the bind list below remains unchanged.

Code references:
- [packages/formspec-studio/src/workspaces/logic/LogicTab.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/logic/LogicTab.tsx#L35)
- [packages/formspec-studio/src/workspaces/logic/FilterBar.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/logic/FilterBar.tsx#L25)
- [packages/formspec-studio/src/components/ui/Pill.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/ui/Pill.tsx#L13)

Why this is a UX bug:
- A strip called `FilterBar` full of colored pills reads as interactive filtering UI. When nothing responds, the workspace feels misleading and unfinished.

## 14. Blueprint never shows a component-tree count, even when the tree exists

Severity: Low

Repro:
1. Open Studio with the default seeded project.
2. In the blueprint sidebar, inspect the `Component Tree` row.
3. Open the `Component Tree` section itself.

Expected:
- If a component tree is present, the blueprint row should show a non-zero count or some other populated indicator consistent with the other sidebar sections.

Actual:
- The `Component Tree` row never gets a count badge because its count function is hardcoded to `0`, even though the section can render a non-empty tree.

Code references:
- [packages/formspec-studio/src/components/Blueprint.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Blueprint.tsx#L14)
- [packages/formspec-studio/src/components/blueprint/ComponentTree.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/blueprint/ComponentTree.tsx#L61)

Why this is a UX bug:
- The sidebar uses counts as a scan tool. Leaving one populated section permanently count-less makes the information scent inconsistent.

## 15. Delete/backspace can remove the selected item from the wrong workspace

Severity: High

Repro:
1. Open Studio.
2. Select an item in the editor.
3. Switch to `Logic`, `Data`, `Theme`, or `Mapping`.
4. Press `Delete` or `Backspace` while focus is not inside a text input.

Expected:
- Destructive item deletion should be scoped to an editor-focused context, or Studio should require a more explicit delete action once you have moved into another workspace.

Actual:
- The shell listens for delete/backspace globally and dispatches `definition.deleteItem` whenever there is still a selected item.
- That means an item selected earlier in the editor can be removed while you are working elsewhere.

Code references:
- [packages/formspec-studio/src/components/Shell.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Shell.tsx#L58)
- [packages/formspec-studio/src/components/Shell.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Shell.tsx#L69)
- [packages/formspec-studio/src/lib/keyboard.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/lib/keyboard.ts#L52)

Why this is a UX bug:
- Global destructive shortcuts are easy to trigger accidentally. In a multi-workspace authoring tool, deleting hidden editor state from a different tab feels arbitrary and unsafe.

## 16. Workspace sub-tabs and preview mode reset every time you leave the workspace

Severity: Medium

Repro:
1. Open Studio.
2. Switch the `Data` workspace to `Option Sets` or `Test Response`.
3. Move to another top-level workspace like `Logic` or `Preview`.
4. Return to `Data`.

Expected:
- Studio should remember the last sub-tab or mode you were working in until you explicitly change it.

Actual:
- The workspace reopens on its default sub-tab every time.
- The same reset pattern applies to `Theme`, `Mapping`, and `Preview` (`form` mode / `desktop` viewport), because each workspace keeps its own local `useState` defaults and gets unmounted when you switch top-level tabs.

Code references:
- [packages/formspec-studio/src/components/Shell.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Shell.tsx#L83)
- [packages/formspec-studio/src/workspaces/data/DataTab.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/data/DataTab.tsx#L15)
- [packages/formspec-studio/src/workspaces/theme/ThemeTab.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/theme/ThemeTab.tsx#L29)
- [packages/formspec-studio/src/workspaces/mapping/MappingTab.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/mapping/MappingTab.tsx#L23)
- [packages/formspec-studio/src/workspaces/preview/PreviewTab.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/workspaces/preview/PreviewTab.tsx#L15)

Why this is a UX bug:
- It breaks task continuity. Authors bounce between editor, logic, data, and preview constantly; having each workspace forget where you were makes the app feel stateless and forces repetitive re-navigation.

## 17. The `⌘K` command palette is mouse-driven despite advertising keyboard search

Severity: High

Repro:
1. Open Studio.
2. Press `⌘K`.
3. Type a query that returns one or more results.
4. Press `ArrowDown`, `ArrowUp`, or `Enter`.

Expected:
- The palette should support keyboard-first navigation with a highlighted active row and Enter-to-open behavior.

Actual:
- The palette only supports typing into the input and clicking rows with the mouse.
- There is no active-result state, no arrow-key handling, and no Enter action for the filtered results.

Code references:
- [packages/formspec-studio/src/components/Header.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Header.tsx#L56)
- [packages/formspec-studio/src/components/CommandPalette.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/CommandPalette.tsx#L12)
- [packages/formspec-studio/src/components/CommandPalette.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/CommandPalette.tsx#L53)

Why this is a UX bug:
- `⌘K` implies a command-first, keyboard-efficient workflow. Shipping it as a text filter plus mouse list breaks the core interaction model users expect from that affordance.

## 18. Import clears undo history with no warning or recovery cue

Severity: High

Repro:
1. Open Studio and make a few edits.
2. Click `Import`.
3. Paste a valid artifact JSON and click `Load`.
4. Try to recover prior work with `Undo`.

Expected:
- If import is going to wipe the undo stack, the dialog should warn about that explicitly or require a more deliberate confirmation.

Actual:
- The dialog presents import as a routine `Load` action with no warning about destructive side effects.
- Under the hood it dispatches `project.import`, and that handler clears history immediately.

Code references:
- [packages/formspec-studio/src/components/ImportDialog.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/ImportDialog.tsx#L77)
- [packages/formspec-studio-core/src/handlers/project.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/handlers/project.ts#L44)

Why this is a UX bug:
- Import is a common exploratory action in an authoring tool. Clearing recovery history without warning turns a normal workflow into a high-risk action and makes the editor feel unsafe.

## 19. Command palette reopens with the previous search still applied

Severity: Medium

Repro:
1. Open Studio.
2. Press `⌘K`.
3. Type a narrow query so the result list is filtered.
4. Close the palette by clicking the backdrop or choosing a result.
5. Open `⌘K` again.

Expected:
- The palette should reopen in a clean state with an empty query and the full searchable set visible.

Actual:
- The previous search string is kept in component state, so the palette reopens already filtered to the last query.

Code references:
- [packages/formspec-studio/src/components/CommandPalette.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/CommandPalette.tsx#L11)
- [packages/formspec-studio/src/components/CommandPalette.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/CommandPalette.tsx#L14)
- [packages/formspec-studio/src/components/Shell.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Shell.tsx#L55)

Why this is a UX bug:
- Command palettes are short-lived navigation tools. Reopening into a stale filter makes the search feel sticky and confusing, especially when the result set looks mysteriously incomplete.

## 20. Import dialog reopens with stale JSON, artifact type, and parse errors

Severity: Medium

Repro:
1. Open Studio.
2. Click `Import`.
3. Switch to a non-default artifact type, paste JSON, or trigger a parse error with invalid JSON.
4. Close the dialog with `Cancel` or by clicking the backdrop.
5. Open `Import` again.

Expected:
- The dialog should reopen cleanly on the default artifact type with an empty textarea and no previous error state.

Actual:
- The previously selected artifact type, pasted JSON, and parse error all remain in local state across closes and reopens.

Code references:
- [packages/formspec-studio/src/components/ImportDialog.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/ImportDialog.tsx#L11)
- [packages/formspec-studio/src/components/ImportDialog.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/ImportDialog.tsx#L13)
- [packages/formspec-studio/src/components/ImportDialog.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/ImportDialog.tsx#L88)
- [packages/formspec-studio/src/components/Shell.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Shell.tsx#L56)

Why this is a UX bug:
- Import is a transactional action. Keeping old payloads and error states around after the dialog is dismissed makes each new import attempt feel contaminated by the last one.

## 21. `Escape` dismisses the command palette but not the import dialog

Severity: Medium

Repro:
1. Open Studio.
2. Click `Import`.
3. Press `Escape`.

Expected:
- The import dialog should close, matching standard modal behavior and the way `Escape` already dismisses the command palette.

Actual:
- `Escape` is handled globally by the shell, but it only closes the command palette and clears selection state.
- The import dialog has no local `Escape` handler, so the modal stays open.

Code references:
- [packages/formspec-studio/src/components/Shell.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Shell.tsx#L62)
- [packages/formspec-studio/src/components/Shell.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/Shell.tsx#L73)
- [packages/formspec-studio/src/components/ImportDialog.tsx](/Users/mikewolfd/Work/formspec/packages/formspec-studio/src/components/ImportDialog.tsx#L19)

Why this is a UX bug:
- Modal dismissal behavior should be predictable. When one overlay responds to `Escape` and the other ignores it, the product feels inconsistent and less polished.

## 22. Inspector KEY input shows stale value when switching between fields

Severity: High

Repro:
1. Open Studio in the Editor.
2. Click any field — note the KEY value in the Properties inspector (e.g. `name` for Full Legal Name).
3. Click a different field — SSN, Marital Status, or any other field.

Expected:
- The KEY input should update to reflect the selected field's actual key (`ssn`, `marital`, etc.).

Actual:
- The KEY input always displays the key of the first field that was selected in the session.
- Confirmed live: selecting SSN (key `ssn`), Marital Status (key `marital`), and Members.Name (key `mName`) all left the KEY input showing `name` — the key of the first selection (Full Legal Name).
- The Properties title and DATATYPE row update correctly; only the KEY text input is stuck.

Code references:
- `packages/formspec-studio/src/workspaces/editor/ItemProperties.tsx` — the KEY `<input>` value binding

Why this is a UX bug:
- The KEY field is the primary identity control in the inspector. If it silently shows the wrong value, an author trusting that field to read or edit a key will operate on stale data — or worse, inadvertently rename the wrong key.

## 23. Preview doesn't render String, Integer, Date, or Choice fields

Severity: Critical

Repro:
1. Open Studio with a form that contains String, Integer, Date, and Choice fields.
2. Switch to the Preview workspace and view the Form tab.
3. Observe which fields appear in the rendered form.

Expected:
- All field types should render in the preview so authors can see an accurate representation of the complete form.

Actual:
- The `<formspec-render>` webcomponent silently drops String (Text), Integer, Date, and Choice fields — they are completely absent from the DOM, not just visually hidden.
- Only Boolean (toggle), Money, Display text, and File Upload fields render.
- Live DOM inspection of the default "Section 8 HCV" form confirms:
  - **Applicant Information page**: 0 of 5 fields rendered (name/String, dob/Date, ssn/String, marital/Choice, priorApp/Boolean all absent)
  - **Household page**: `hhSize` (Integer) absent; only two Boolean toggles render
  - **Income & Assets page**: `incSrc` (Choice), `empName` (String) absent

Code references:
- `packages/formspec-webcomponent/src/` — component registry for field renderers

Why this is a critical bug:
- The preview is the primary "does this form work?" tool. When common field types are invisible, authors have no way to validate layout, label copy, or conditional logic for the bulk of their form. The preview gives a false picture of the final output.

## 24. Studio has Import but no Export — no way to get work out

Severity: High

Repro:
1. Open Studio.
2. Build or modify a form.
3. Try to export/copy/save the resulting JSON definition.

Expected:
- There should be a visible Export (or Copy JSON) action that lets the author retrieve the finished form definition.

Actual:
- The header only contains an "Import" button.
- The Import dialog is labelled "Paste JSON to load a formspec artifact" — it is strictly an inbound action.
- The avatar/profile icon in the top right opens no menu.
- There is no Export, Copy, Download, or Share option anywhere in the UI.

Why this is a UX bug:
- Import without Export is a one-way trap. Authors who build or iterate on a form in the Studio have no visible path to extract their work. This makes the studio feel like a viewer, not a true authoring tool, until Export is added.

## 25. Renaming a field KEY breaks the inspector selection — shows "Item not found"

Severity: High

Repro:
1. Open Studio in the Editor.
2. Select any field — e.g., Full Legal Name (key `name`).
3. In the Properties inspector, edit the KEY input and commit (Tab or click away).

Expected:
- The inspector should re-anchor to the renamed item and continue showing its properties.

Actual:
- The inspector resolves items by path (e.g., `app.name`). When the key changes, that path no longer exists, so the inspector shows "Item not found: app.name" and becomes blank.
- The canvas and status bar update correctly; only the inspector loses track.

Code references:
- `packages/formspec-studio/src/workspaces/editor/ItemProperties.tsx:57` — `flat.find((f) => f.path === selectedKey)` searches by the old path
- `packages/formspec-studio/src/workspaces/editor/ItemProperties.tsx:123` — `defaultValue={currentKey}` is uncontrolled, so the input also never refreshes when fields switch

Why this is a UX bug:
- KEY is the primary authoring action in the inspector. After every key rename, the inspector goes blank, forcing a re-click just to get the panel back. It also means the `defaultValue` bug (Bug #22) and the lost-selection bug are the same root cause: the inspector tracks identity by path string rather than by a stable item reference.

## 26. New item added via palette is not auto-selected in the inspector

Severity: Medium

Repro:
1. Open Studio in the Editor.
2. Select a field on page 1 (e.g., Marital Status).
3. Navigate to a different wizard page (e.g., page 6 / New Page).
4. Click `+ Add Item` and confirm a field type (e.g., Text).

Expected:
- After insertion, the new field should become the active selection and the inspector should display its properties.

Actual:
- The new field is added to the canvas but is not selected.
- The inspector keeps showing the previously selected field from the old page ("Marital Status", key `marital`) even though that field is not on the current page.

Code references:
- `packages/formspec-studio/src/workspaces/editor/AddItemPalette.tsx` — `onConfirm` dispatches `definition.addItem` but does not dispatch `selection.select` for the new item's path

Why this is a UX bug:
- After every add action, authors expect the new item to be ready to configure. Instead they must click it manually — and the stale inspector for a field from a different page looks like a ghost.

## 27. Settings panel is entirely read-only — no way to edit form metadata

Severity: High

Repro:
1. Open Studio and click `Settings` in the Blueprint sidebar.
2. Look at the Definition Metadata rows: URL, VERSION, STATUS, NAME, TITLE.
3. Try clicking on any value to edit it.

Expected:
- Core form metadata (at minimum the title, status, and version) should be editable from the settings panel.

Actual:
- Every row is a read-only display. Clicking on values like "Section 8 HCV — Inta..." or "2025.1.0" does nothing.
- There is no edit button, inline input, or other authoring affordance anywhere in the settings section.

Code references:
- `packages/formspec-studio/src/components/blueprint/Settings.tsx` (or equivalent) — all rows are static `<span>` / `PropertyRow` displays with no edit handlers

Why this is a UX bug:
- The form title and status are the first things a new author would want to set. Hiding them as read-only metadata suggests the studio considers the form a viewed artifact, not something being authored.

## 28. Settings TITLE value is truncated with no hover or tooltip to see the full string

Severity: Low

Repro:
1. Open Studio and click `Settings` in the Blueprint sidebar.
2. Look at the TITLE row.

Expected:
- The full title should be readable, either in the row itself or via a tooltip on hover.

Actual:
- The TITLE value is truncated to "Section 8 HCV — Inta..." with no tooltip or expand affordance.
- Other rows (URL) are also truncated with no recovery.

Code references:
- `packages/formspec-studio/src/components/blueprint/Settings.tsx` — row values use `truncate` without a `title` attribute

Why this is a visual bug:
- This is the one place in the UI where authors check form-level metadata. Truncated, unreadable values in a sidebar that is already fixed-width make it worse than useless for longer identifiers.

## 29. All Theme workspace tabs show empty state with no creation affordance

Severity: High

Repro:
1. Open Studio and switch to the `Theme` workspace.
2. Visit every sub-tab: Tokens, Defaults, Selectors, Item Overrides, Page Layouts, Breakpoints.

Expected:
- Each tab should provide a way to add at least one entry, or clearly communicate that theme authoring is not yet implemented.

Actual:
- Every tab shows only "No [X] defined" with empty whitespace below.
- There is no `+ Add Token`, `+ Add Selector`, or similar affordance anywhere.
- The workspace looks like a placeholder stub, not an authoring surface.

Code references:
- `packages/formspec-studio/src/workspaces/theme/` — all sub-tab components render an empty-state message with no create action

Why this is a UX bug:
- The Theme workspace has six distinct sub-tabs, which signals a substantial authoring surface. Shipping all six as empty stubs without even a disabled "create" button creates confusion about whether theme authoring is missing by design or is simply unfinished.

## 30. Variables in the blueprint sidebar look like links but are inert

Severity: Low

Repro:
1. Open Studio.
2. In the Blueprint sidebar, click `Variables`.
3. Click any variable row such as `@totalHHInc`.

Expected:
- Clicking a variable should navigate to the Logic workspace and highlight that variable, or open an editing surface for it.

Actual:
- Nothing happens. The variable rows render with blue link-style text and appear actionable, but have no click handler.

Code references:
- `packages/formspec-studio/src/components/blueprint/Variables.tsx` — variable rows are `<div>` or `<span>` with blue color classes but no `onClick`

Why this is a UX bug:
- Blue monospace text in a sidebar reads universally as a navigable link. When clicking it does nothing, the visual language is misleading and trust in other sidebar links is eroded.

## 31. Escape does not close the Mapping workspace "Direction" picker

Severity: Medium

Repro:
1. Open Studio and switch to the `Mapping` workspace.
2. In the `Config` tab, click the `unset` direction value.
3. A field/item picker modal opens.
4. Press `Escape`.

Expected:
- The picker should close, consistent with how `Escape` works on the command palette.

Actual:
- `Escape` does not close the picker. The overlay remains open and blocks all underlying workspace tabs.
- The only way to close it is to click outside the modal area.

Code references:
- `packages/formspec-studio/src/workspaces/mapping/` — the item picker modal has no `keydown` Escape handler

Why this is a UX bug:
- This is the third modal surface that ignores `Escape` (after the Import dialog and the command palette stale state). It reinforces a pattern of inconsistent keyboard dismissal across the studio.

## 32. Inspector Behavior Rules section never appears — bind paths don't match flat item paths

Severity: High

Repro:
1. Open Studio in the Editor.
2. Select any field that has binds (e.g., Date of Birth, SSN, Household Size).
3. Observe the Properties inspector — look for a "Behavior Rules" section.

Expected:
- The inspector should show a "Behavior Rules" section with the field's bind expressions (required, constraint, calculate, etc.) when binds exist.

Actual:
- The Behavior Rules section never appears for any field in the default example form.
- Root cause: `arrayBindsFor` matches on full dot-paths (e.g., `"app.dob"`, `"hh.hhSize"`) built by `flatItems`, but the example definition stores bind paths as bare relative keys (`"dob"`, `"hhSize"`). The path lookup always returns an empty object, so `Object.keys(binds).length > 0` is always false.

Code references:
- `packages/formspec-studio/src/workspaces/editor/ItemProperties.tsx:92–95` — bind resolution
- `packages/formspec-studio/src/lib/field-helpers.ts:43–57` — `arrayBindsFor` path matching
- `packages/formspec-studio/src/lib/field-helpers.ts:16–25` — `flatItems` dot-path construction

Why this is a UX bug:
- The entire Behavior Rules section — and the associated `+ Add Rule` button (Bug #12) — are dead code for every real-world definition. An author looking for a field's required/constraint logic has no way to see it in the inspector. The Logic workspace is the only place to find it, and there is no cross-reference.

## 33. Response Schema shows repeatable groups as type "object" instead of "array"

Severity: Medium

Repro:
1. Open Studio and switch to the `Data` workspace.
2. Look at the `Response Schema` tab.
3. Find the `members` row.

Expected:
- The `members` group (which is `repeatable: true`) should be represented as type `array` or similar, signaling it produces multiple instances in the response.

Actual:
- `members` is displayed as type `"object"`, the same as non-repeatable groups like `app` and `hh`.
- This misrepresents the actual response data structure, where `members` produces a JSON array.

Why this is a UX bug:
- The Response Schema is the primary tool for understanding what the form submission looks like. Showing an array field as a plain object misleads authors and downstream integrators who rely on this view to define their API contracts.

## 34. Response Schema label column values look like links but clicking them does nothing

Severity: Low

Repro:
1. Open Studio, switch to the `Data` workspace → `Response Schema`.
2. Click any value in the `Label` column (e.g., "Full Legal Name", "Date of Birth").

Expected:
- Clicking a field label should navigate to that field in the Editor, or open its inspector, or otherwise indicate it is interactive.

Actual:
- All label values in the Response Schema table render with blue/colored text that visually reads as clickable links.
- Clicking them does nothing — no navigation, no selection change, no feedback.

Why this is a UX bug:
- The blue link styling creates a false affordance. Authors naturally try to click field labels expecting jump-to-field behavior (common in data schema viewers). The lack of any response erodes trust in the table's interactivity.

## 35. Data Sources tab is an empty stub with no creation affordance

Severity: Medium

Repro:
1. Open Studio and switch to the `Data` workspace.
2. Click the `Data Sources` tab.

Expected:
- The tab should provide a way to add or reference data sources, or clearly communicate that the feature is planned.

Actual:
- The tab shows only "No data sources defined." with no `+ Add Data Source` button or any other authoring affordance.
- Identical empty-stub pattern to Bug #29 (Theme tabs) and Bug #36 (Test Response).

Why this is a UX bug:
- Three separate workspace tabs share the same inert empty-state pattern. Without at least a disabled or placeholder creation button, it is impossible to tell whether this is unimplemented or whether data sources genuinely cannot be defined from the Studio.

## 36. Test Response tab is a raw placeholder ("future implementation")

Severity: Medium

Repro:
1. Open Studio and switch to the `Data` workspace.
2. Click the `Test Response` tab.

Expected:
- A test-response editor/viewer, or at minimum a coming-soon message that reads as intentional product copy.

Actual:
- The tab body reads verbatim: `Test Response — future implementation.`
- This is an in-code placeholder string exposed directly to users.

Why this is a UX bug:
- Shipping a developer-facing stub string as user-visible copy looks unfinished and undermines confidence in the product.

## 37. Screener "Disabled" badge is inert — no way to enable the screener

Severity: Medium

Repro:
1. Open Studio and click `Screener` in the Blueprint sidebar.
2. Observe the "Disabled" badge in the Screener section.
3. Click the badge or anywhere in the Screener section.

Expected:
- Clicking "Disabled" should toggle the screener to enabled, or open a creation/configuration flow.

Actual:
- The badge is a static `<div>` with no click handler. Nothing happens when clicked.
- There is no "Enable Screener", "Create Screener", or any other affordance to create or configure a screener.

Why this is a UX bug:
- A section labeled "Screener" that can only ever say "Disabled" with no path to change that state looks either broken or intentionally locked. Neither is a good experience.

## 38. Preview renders wizard-mode form as a flat scrollable page — no wizard navigation

Severity: High

Repro:
1. Open Studio with a form that has `pageMode: "wizard"` and multiple pages.
2. Switch to the `Preview` workspace → `Form` tab.

Expected:
- The preview should render the form in wizard mode: showing one page at a time with Next / Previous buttons and a step indicator.

Actual:
- All wizard pages (Applicant Information, Household, Income & Assets, Housing, Review & Submit) are stacked vertically in a single scrollable view.
- There are no Next / Previous navigation buttons, no step indicator, and no page-level header.
- The preview gives no sense of what the multi-step wizard experience actually feels like for end users.

Why this is a UX bug:
- Wizard mode is one of the most common form layouts. Showing it as a flat document defeats the primary purpose of the preview — helping authors validate the form experience before publishing.

## 39. Preview JSON view is read-only with no copy button

Severity: Low

Repro:
1. Open Studio → `Preview` workspace → `Json` tab → `Definition` sub-tab.
2. Try to copy the form definition JSON.

Expected:
- The JSON view should have a "Copy to clipboard" button so authors can easily extract the definition.

Actual:
- The JSON is rendered as a plain `<pre>/<code>` block with no copy affordance.
- Authors must manually select all text and copy, which is tedious for large definitions and easily misses leading/trailing whitespace.

Why this is a UX bug:
- The JSON view is currently the only way to see the complete form definition (since there is no Export button — see Bug #24). Making the extraction require manual text selection is needlessly friction-heavy.

## 40. Inspector DUPLICATE and DELETE buttons appear in non-Editor workspaces

Severity: Medium

Repro:
1. Open Studio in the Editor and select any field (e.g., Full Legal Name).
2. Switch to `Data`, `Logic`, `Theme`, `Mapping`, or `Preview` workspace.
3. Observe the inspector panel on the right.

Expected:
- The inspector should either be hidden or show read-only context when you are not in the Editor. At minimum, destructive actions like DELETE should not be clickable from non-editor workspaces.

Actual:
- The inspector retains the previously selected field from the Editor, including the `DUPLICATE` and `DELETE` buttons.
- Clicking `DELETE` from the Data or Preview workspace will delete the item from the form definition — the same behavior as Bug #15 (global delete shortcut) but surfaced through a visible button.

Code references:
- `packages/formspec-studio/src/components/Shell.tsx` — inspector panel is always mounted regardless of active workspace

Why this is a UX bug:
- Destructive buttons in passive viewing workspaces create an accidental-deletion trap. An author reviewing field schema or previewing the form has no reason to expect the Delete button to be live.

## 41. Desktop and Tablet Preview viewports produce identical widths

Severity: Medium

Repro:
1. Navigate to the `Preview` workspace.
2. Note the form container width with `Desktop` selected.
3. Click `Tablet`.

Expected:
- The form should render at a narrower, tablet-appropriate width (e.g., ~768 px).

Actual:
- Both Desktop and Tablet buttons produce a 714 px form container width — identical dimensions. Only `Mobile` actually changes the preview (to ~341 px).
- The `Tablet` button shows `[active]` state but causes no visual change.

Code references:
- `packages/formspec-studio/src/workspaces/PreviewWorkspace.tsx` — viewport button logic

Why this is a UI bug:
- Tablet is a common development target. A viewport toggle that silently produces the same result as Desktop gives false confidence that the form has been tested at a tablet breakpoint.

## 42. "Wrap in Group" context menu action is a no-op

Severity: High

Repro:
1. In the Editor, right-click any field (e.g., Full Legal Name).
2. Click `Wrap in Group`.

Expected:
- The field is wrapped in a new group container. Field count stays the same but a group is added, or field moves inside a newly created group.

Actual:
- Nothing changes. Field count, structure, and order are unaffected.
- The action appears in the menu and is clickable but does nothing.

Why this is a UX bug:
- "Wrap in Group" is a first-class authoring operation. Showing it as a functioning affordance while it silently does nothing is a lie to the user and will cause confusion.

## 43. "Move Down" context menu action is a no-op

Severity: High

Repro:
1. In the Editor, right-click a field (e.g., Full Legal Name, which is the first field on the page).
2. Click `Move Down`.

Expected:
- The field moves one position down — Full Legal Name should appear after Date of Birth.

Actual:
- The field order is unchanged. This extends the known Bug #7 (Move Up is a no-op) — Move Down is also broken.

Code references:
- `packages/formspec-studio/src/components/ContextMenu.tsx` — Move Up / Move Down handlers

Why this is a UX bug:
- Move Up and Move Down are both dead. The entire "reorder via context menu" feature is non-functional.

## 44. Wizard page tabs cannot be renamed

Severity: Medium

Repro:
1. In the Editor, double-click the `Applicant Information` page tab.
2. Alternatively, right-click the tab and look for a Rename option.

Expected:
- Double-click opens an inline text editor on the tab label, or right-click shows a context menu with a Rename option.

Actual:
- Double-click navigates to the page (same as single click). No inline edit opens.
- Right-click on a page tab shows no context menu at all.

Why this is a UX bug:
- Pages in wizard forms almost always need custom names. There is no affordance to rename them, leaving authors with no way to change "New Page" to anything meaningful.

## 45. Clicking a field in Blueprint Structure doesn't scroll or highlight in the editor canvas

Severity: Medium

Repro:
1. Open Blueprint → Structure.
2. Scroll to page 2 in the editor.
3. Click `Full Legal Name` in the Structure panel (a page 1 field).

Expected:
- The editor navigates to page 1 and highlights/focuses the clicked field, making it easy to find in the canvas.

Actual:
- The inspector shows the selected field's properties correctly, but the editor canvas does not scroll to or highlight the field.
- If the user is on a different page in the editor, the field is invisible in the canvas.

Why this is a UX bug:
- Blueprint Structure is a navigation tool. Clicking an item should locate it in the authoring canvas, not just populate the inspector.

## 46. Mapping Config "Direction" badge is not interactive

Severity: High

Repro:
1. Navigate to `Mapping` workspace.
2. The Config tab is active, showing `Direction: unset`.
3. Click the `unset` badge.

Expected:
- A picker opens allowing you to select `outbound`, `inbound`, or `bidirectional`.

Actual:
- The `unset` badge has `cursor: auto` and no click handler. Nothing happens.
- The Mapping `Preview` tab independently shows `Direction: outbound` while Config says `unset`. The two are inconsistent.
- There is no other affordance to change the Direction setting.

Why this is a UX bug:
- The Config tab's only editable field is the Direction, and it is not editable. The entire Config tab is functionally useless.

## 47. Blueprint section collapse toggle arrow (▶) never changes state

Severity: Low

Repro:
1. In the Blueprint sidebar (any section — Structure, Variables, Option Sets, etc.), click the section's `▶` button to collapse it.
2. Observe the arrow symbol after the section collapses.

Expected:
- The arrow rotates to `▼` (or equivalent) when the section is expanded, and back to `▶` when collapsed.

Actual:
- The arrow stays `▶` regardless of whether the section is expanded or collapsed. No visual feedback indicates the current state.

Why this is a UI bug:
- Standard convention for collapsible sections is to rotate or change the arrow to reflect open/closed state. A frozen `▶` is ambiguous and forces users to test by clicking.

## 48. Option Set cards in Data workspace are read-only with no edit affordance

Severity: High

Repro:
1. Navigate to `Data` workspace → `Option Sets` tab.
2. Click on an option set card (e.g., `incSrc`).

Expected:
- Clicking the card selects it in the inspector, or opens an inline editor, or shows an edit button to modify the options list.

Actual:
- Clicking the card has no effect. The inspector stays on the previously selected form field.
- The card shows the options (Employment, Self-Employment, Social Security, Other) as read-only text with no way to add, remove, or rename options.
- Right-clicking the card shows no context menu.

Why this is a UX bug:
- Option Sets are part of the core form schema. Authors need to edit them. The Data workspace shows option sets but provides no path to modify them.

## 49. Logic workspace Bind rows don't select in inspector

Severity: Medium

Repro:
1. Navigate to `Logic` workspace.
2. Click on any bind row (e.g., `name [required]`).

Expected:
- The bind is selected and shown in the inspector, allowing the user to edit the bind expression.

Actual:
- Clicking a bind row has no effect. The inspector retains whatever field was previously selected.
- The bind row has no hover or click cursor change to indicate it is interactive.

Why this is a UX bug:
- Logic authors need to edit bind rules. There is no way to inspect or edit a bind from the Logic workspace. The FEL expression is visible but read-only.

## 50. Logic workspace Shapes section shows inconsistent detail

Severity: Low

Repro:
1. Navigate to `Logic` workspace, scroll to the Shapes section.
2. Observe the three shapes: `inc-lim`, `ast-req`, `hh-match`.

Expected:
- All shape entries should show the same level of detail (severity, key, and FEL expression).

Actual:
- `inc-lim` shows: severity (error), key, and FEL expression (`moneyAmount($annInc)<=@incLimit`).
- `ast-req` and `hh-match` show only: severity and key — no FEL expression.
- The display is inconsistent across the three shape entries.

Why this is a UI bug:
- Authors need to see the FEL expression for every shape to understand and audit the form's validation rules. Partial display creates gaps.

## 51. Form canvas header metadata (URL, version, mode, currency) is not interactive

Severity: Low

Repro:
1. In the Editor, look at the form header row: `https://agency.gov/forms/s8-intake · v2025.1.0 · wizard · USD`.
2. Click on any of these values.

Expected:
- Clicking a metadata value could open the Settings panel with that field focused, or at minimum show a tooltip with the full value.

Actual:
- All metadata values have `cursor: auto` and no interaction. Clicking anywhere in the row does nothing.
- The URL span in particular looks like it might be a hyperlink but has no `text-decoration` and no click handler.

Why this is a UX bug:
- The header row advertises form metadata but provides no path to edit it. A shortcut to Settings (or a direct inline edit) would reduce friction.

## 52. Repeatable group inspector shows no cardinality settings

Severity: Medium

Repro:
1. In the Editor, click the `Members ⟳ 0–12` repeatable group header.
2. Observe the inspector panel.

Expected:
- The inspector shows Key, Type, min/max cardinality (0, 12), and any other repeat-group properties so they can be edited.

Actual:
- The inspector shows only Key (with the known stale-value bug #22) and Type = `group`.
- There are no controls for min/max cardinality, group label, or any other repeat-specific property.

Why this is a UX bug:
- Repeat cardinality is a core authoring concern. Authors who need to change the `0–12` min/max have no way to do it through the inspector.

## 53. Choice field inspector has no options/choices editing section

Severity: High

Repro:
1. Open Studio, Editor tab.
2. Click on "Marital Status" (a Choice field) or add a new Single Choice field.
3. Inspect the Properties panel.

Expected:
- The inspector should show a "Choices" or "Options" section listing the available choices and allowing the author to add/edit/remove options.

Actual:
- The inspector shows only IDENTITY (Key, Type, DataType=●Choice). There is no section for viewing or editing what the choices are.
- Adding a new "Single Choice" field via the Add Item palette produces a field with key "select11" and no options defined — and there is no way to add options afterward.

Why this is a UX bug:
- Choice fields are useless without defined options. Authors have no way to configure the options/choices from within the Studio.

## 54. Option Set chips have near-zero contrast (dark text on dark background)

Severity: High

Repro:
1. Open Studio → Data → Option Sets tab.
2. Look at the option chips inside each option set card (e.g., "Employment", "Self-Employment", "Spouse").

Expected:
- Chips should have legible text — typically light text on a colored/dark background.

Actual:
- All chips use Tailwind class `bg-neutral-800` which resolves to `oklch(0.269 0 0)` (very dark near-black gray).
- Text color is `rgb(15, 23, 42)` which is `slate-900` (very dark navy — nearly black).
- Dark text on a dark background produces a near-1:1 contrast ratio — chips are essentially invisible.

Code references:
- `packages/formspec-studio/src/workspaces/data/DataTab.tsx` — option chip `<span className="text-xs bg-neutral-800 rounded px-2 py-0.5">`

Why this is a visual bug:
- WCAG requires at least 4.5:1 contrast for normal text. This is ~1:1. All option set labels are unreadable.

## 55. FEL Reference panel — clicking a function name does nothing

Severity: Medium

Repro:
1. Open Studio → Logic workspace.
2. Click the "?" (FEL Reference) button next to any bind row.
3. Expand a category (e.g., AGGREGATE) to reveal function entries.
4. Click a function name (e.g., "sum").

Expected:
- Clicking a function should copy its signature to the clipboard, or insert it into an expression editor, or show a detail panel with parameters and examples.

Actual:
- Clicking a function dismisses the FEL Reference panel entirely with no visible effect, no feedback, and no insertion.

Why this is a UX bug:
- The panel looks like an interactive reference. Its only affordance is the category expand buttons; individual function entries appear as text but have zero interaction.

## 56. No drag-to-reorder for field cards — no drag handles

Severity: High

Repro:
1. Open Studio → Editor tab.
2. Hover over any field card in the canvas.
3. Try to drag it to a new position.

Expected:
- Fields should have visible drag handles on hover and support drag-to-reorder within a page or group.

Actual:
- No drag handles appear on hover. `[draggable]` attribute is absent from all field cards. Dragging does nothing.
- The only reorder mechanism (context menu "Move Up"/"Move Down") is also a no-op (see bugs #7 and #43).
- Fields cannot be reordered at all.

Why this is a UX bug:
- Reordering is a fundamental form-building operation. The studio has no working reorder affordance.

## 57. Inspector has no Label field — field display names cannot be edited

Severity: High

Repro:
1. Open Studio → Editor tab.
2. Select any field (e.g., "Full Legal Name").
3. Inspect the Properties panel.

Expected:
- The inspector should show a "Label" or "Title" field with the human-readable display name (e.g., "Full Legal Name") editable inline.

Actual:
- The inspector only shows Key (identifier), Type (field), and DataType. There is no Label/Title property editable or visible.
- The only way to rename a field's display label is to edit the raw JSON and re-import it.

Code references:
- `packages/formspec-studio/src/workspaces/editor/ItemProperties.tsx` — inspector renders only Identity, optional Field Config, Behavior Rules, and Validation Shapes sections. No label field.

Why this is a UX bug:
- Label is the most important user-facing property of a form field. Its absence from the inspector is a critical authoring gap.

## 58. App logo ("The Stack") does nothing when clicked

Severity: Low

Repro:
1. Open Studio.
2. Click the "The Stack" logo/title in the top-left corner of the header.

Expected:
- Navigate to a dashboard or home screen, open a new form dialog, or show a menu.

Actual:
- Nothing happens. The element is not interactive.

Why this is a UX bug:
- Users expect a logo click to navigate home or show a top-level menu. The affordance (visible text/logo) implies interactivity.

## 59. Avatar icon in header does nothing when clicked

Severity: Low

Repro:
1. Open Studio.
2. Click the circular avatar/user icon in the top-right of the header.

Expected:
- Open a user menu with profile settings, preferences, or a sign-out option.

Actual:
- Nothing happens. The icon is not interactive.

Why this is a UX bug:
- A circular icon in the top-right header corner universally implies a user menu. The affordance is completely broken.

## 60. FEL expressions in Logic workspace are completely read-only

Severity: High

Repro:
1. Open Studio → Logic workspace.
2. Click (or double-click) any variable expression (e.g., `sum($members[*].mInc)`), bind expression, or shape expression.

Expected:
- Clicking or double-clicking an expression should open an inline editor or a dedicated expression editor panel.

Actual:
- No editor opens. Single-click, double-click, and Tab into the area all produce no editable state.
- The Logic workspace is a read-only display of the form's logic — no authoring is possible.

Why this is a UX bug:
- The Logic workspace's primary purpose should be to author and edit logic rules. A read-only Logic workspace is a fundamental authoring gap.

## 61. Context menu appears on right-click in empty canvas area (no field target)

Severity: Medium

Repro:
1. Open Studio → Editor tab.
2. Right-click on the empty canvas area below all field cards (no field under the cursor).

Expected:
- No context menu, or a canvas-level context menu with options like "Paste here" or "Add Item".

Actual:
- The field context menu (Duplicate, Delete, Move Up, Move Down, Wrap in Group) appears with no clear target field.
- The inspector simultaneously shows "Select an item to inspect".
- The context menu actions operate on an ambiguous "last known" item rather than a clearly targeted one.

Why this is a UX bug:
- Context menus without a clear target are confusing and risk destructive accidental operations.

## 62. Tab key moves focus to inspector instead of navigating between canvas fields

Severity: Low

Repro:
1. Open Studio → Editor tab.
2. Click a field card (e.g., "Full Legal Name") to select it.
3. Press Tab.

Expected:
- Tab should either navigate to the next field in the canvas or move focus into the field's inline editor.

Actual:
- Tab moves focus directly to the KEY input in the Properties inspector panel, bypassing any canvas navigation.
- There is no way to navigate between field cards using the keyboard.

Why this is a UX bug:
- Keyboard navigation in a form builder should move through the form's logical structure. Tab-to-inspector is unexpected and breaks standard navigation patterns.

## 63. New field key uses auto-generated index name with no prompt for a meaningful key

Severity: Medium

Repro:
1. Open Studio → Editor tab.
2. Click "+ Add Item" and select "Single Choice".

Expected:
- A prompt or inline rename should appear so the author can immediately give the field a meaningful key.
- Or, the new field should be auto-selected in the inspector with the KEY input focused.

Actual:
- The field is added with an auto-generated key like `select11` (type name + sequential index).
- The inspector is NOT auto-focused on the new field (Bug #24), so the author must click the field, then click the KEY input, then type a new key.
- The label is literally "Single Choice" — the palette display name — not a meaningful default.

Why this is a UX bug:
- Authors must immediately perform 3+ additional clicks to give a new field a usable key, with no guidance that this is required.

## 64. Import dialog is missing `role="dialog"` and `aria-modal` ARIA attributes

Severity: Medium

Repro:
1. Click "Import" in the top-right header.
2. Inspect the rendered modal element in DevTools.

Expected:
- The dialog container has `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing to the dialog heading.

Actual:
- The element identified by `data-testid="import-dialog"` has no `role`, no `aria-modal`, and no `aria-labelledby`.
- The modal is invisible to screen readers and assistive technologies. It also does not appear in the ARIA tree's `dialog` role list.

Code references:
- `packages/formspec-studio/src/components/ImportDialog.tsx` — modal container element

Why this is an accessibility bug:
- Dialogs without `role="dialog"` are not announced to screen-reader users. The user cannot tell a modal has appeared, and focus management assumptions for modals break.

## 65. Import dialog "Load" button stays enabled when JSON is syntactically invalid

Severity: Medium

Repro:
1. Click "Import".
2. Paste invalid JSON (e.g., `{ INVALID JSON }`).
3. Observe the "Load" button.

Expected:
- The Load button should be disabled (grayed out) while the pasted JSON fails to parse.
- Error feedback should appear immediately on input, not only after clicking Load.

Actual:
- The Load button remains fully enabled regardless of JSON validity.
- The parse error message only appears *after* the author clicks Load, not inline as they type.
- Authors can trigger the full load/replace action with clearly broken input.

Code references:
- `packages/formspec-studio/src/components/ImportDialog.tsx` — Load button enabled state

Why this is a UX bug:
- Disabled states on submit buttons are a standard signal that input is invalid. An always-enabled Load button forces authors to learn the hard way (failed load) rather than seeing inline validation.

## 66. Mapping workspace Config tab "Configuration ▶" section cannot be expanded or collapsed

Severity: Low

Repro:
1. Navigate to Mapping workspace → Config tab.
2. Click the "Configuration ▶" section header button.

Expected:
- The section collapses (hiding the Direction row) or expands to show additional configuration fields.

Actual:
- The ▶ button has `cursor-pointer` but clicking it produces no state change. The section neither collapses nor expands.
- The same issue affects the "Adapter ▶" button in the Adapter tab.

Code references:
- `packages/formspec-studio/src/workspaces/mapping/MappingWorkspace.tsx` — section toggle handler

Why this is a UX bug:
- Collapse/expand controls that do nothing give false affordance.

## 67. Footer status bar URL is a `<div>` element, not a hyperlink

Severity: Low

Repro:
1. Look at the bottom status bar in the Studio.
2. The URL `https://agency.gov/forms/s8-intake` is displayed in the bottom-right.
3. Try to click it or inspect it.

Expected:
- The URL opens the form URL in a new tab, or at minimum has a `title` tooltip showing the full URL.

Actual:
- The URL renders as a `<div>` with `cursor: auto` and no `href`. It is not a link.
- No tooltip is shown for long URLs.

Code references:
- `packages/formspec-studio/src/components/Footer.tsx` — URL display element

Why this is a UX bug:
- A raw URL string in a UI always implies it is a link. Rendering it as a non-interactive div breaks user expectation and provides no interactive affordance.

## 68. Preview form view has NO Submit button — form cannot be submitted

Severity: High

Repro:
1. Navigate to Preview workspace → "form" view.
2. Fill in some fields.
3. Try to find a Submit or Save button at the bottom of the form.

Expected:
- A "Submit" button (or equivalent action button) appears at the bottom of the last section or after all sections.

Actual:
- The form renders all sections with field inputs but there is no Submit, Save, or Send button anywhere.
- Reaching the "Review & Submit" section shows only a disclaimer paragraph and a certification checkbox — but no submission action.
- The form is literally unsubmittable from the preview.

Why this is a UX bug:
- The Preview workspace should demonstrate how the form behaves end-to-end, including submission. Without a Submit button, authors cannot test the full form experience.

## 69. Preview computed/calculate field does not recalculate when source field changes

Severity: High

Repro:
1. Navigate to Preview workspace → "form" view.
2. Enter a value in "Gross Annual Income" (e.g., 60000).
3. Tab or click away to trigger change.
4. Observe "Adjusted Income" (a calculated field).

Expected:
- "Adjusted Income" updates based on the formula that references Gross Annual Income and deductions.

Actual:
- "Adjusted Income" stays empty after entering Gross Annual Income.
- The reactive calculation engine either is not connected to the form preview, or the preview is using static rendering.

Why this is a UX bug:
- A form preview that doesn't reflect live calculations gives authors a false picture of how the form actually behaves. Calculated fields are a key feature to validate in preview.

## 70. Preview repeatable group: adding a member instance provides no Remove button

Severity: High

Repro:
1. Navigate to Preview workspace → "form" view.
2. Scroll to "Household" section.
3. Click "Add Members" to add a member instance.
4. Look for a way to remove the added member.

Expected:
- Each added member instance shows a Remove/Delete (×) button allowing the author or user to remove it.

Actual:
- After clicking "Add Members", a member form (Name, Relationship, Monthly Income) appears.
- There is no Remove button, minus icon, or any affordance to delete the added member.
- Clicking "Add Members" multiple times stacks instances with no way to remove any of them.

Why this is a UX bug:
- Repeatable groups require add AND remove affordances. An add-only repeatable group in the preview misrepresents the form's behavior and makes preview testing impossible for that section.

## 71. Preview JSON view: Component and Theme sub-tabs show only a stub document

Severity: Medium

Repro:
1. Navigate to Preview workspace → "json" view.
2. Click "Component" sub-tab.
3. Click "Theme" sub-tab.

Expected:
- The Component tab shows the full component document JSON for the current form.
- The Theme tab shows the active theme JSON.

Actual:
- Both tabs show only `{ "targetDefinition": { "url": "https://agency.gov/forms/s8-intake" } }` — a two-line stub pointing at the definition URL.
- The Mapping sub-tab shows completely empty content (`{}`).
- Only the "Definition" sub-tab shows real content.

Why this is a UX bug:
- The JSON view is intended to let authors inspect the full artifact set. Three of four sub-tabs show useless or empty content.

## 72. No "New Form" or "Create Form" affordance in Studio

Severity: High

Repro:
1. Open Studio.
2. Look for a way to create a blank new form (not import an existing one).
3. Check the header, the logo click area, any menus, and the Blueprint sidebar.

Expected:
- Some affordance (e.g., a "New" button, a logo click menu, a welcome screen) lets the author start from scratch.

Actual:
- There is no "New", "Create", or "Blank Form" button anywhere in the Studio.
- The only way to replace the current form is to Import JSON.
- Starting completely fresh requires importing an empty or minimal JSON definition.

Why this is a UX bug:
- A form builder without a "New Form" action is a fundamental authoring gap. First-time users have no path to start with a blank slate.
