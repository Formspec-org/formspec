# Review: Changes Since `e81e62a77cb808ea0bf62da23a1eb920bb5f128e`

## Scope

Reviewed the full diff from `e81e62a77cb808ea0bf62da23a1eb920bb5f128e` through `HEAD`, with emphasis on:

- `packages/formspec-mcp`
- `packages/formspec-studio-core`
- `packages/formspec-studio`

## Verdict

`REQUEST CHANGES`

## Patch Summary

- The patch expands the MCP surface for behavior and theme authoring.
- The patch adds substantial Studio layout/theme UI work: inline resize handles, property popovers, theme override popovers, FEL navigation, and layout/theme mode handoff.
- Several of the new code paths are not wired correctly, and two public MCP actions were replaced with `NOT_IMPLEMENTED` stubs while still being advertised by the server schema.

## Findings

### 1. Public MCP action removed: `formspec_behavior_expanded.set_bind_property`

`packages/formspec-mcp/src/tools/behavior-expanded.ts:39-45` now throws `NOT_IMPLEMENTED` for `set_bind_property`.

Why this is a blocker:

- `packages/formspec-mcp/src/create-server.ts:760-789` still exposes `set_bind_property` in the public `formspec_behavior_expanded` tool.
- `packages/formspec-mcp/tests/behavior-expanded.test.ts:15-68` expects successful bind updates and clearing behavior.
- The handler computes an update payload and then immediately aborts before any mutation occurs.

### 2. Public MCP action removed: `formspec_theme.add_selector`

`packages/formspec-mcp/src/tools/theme.ts:53-55` now throws `NOT_IMPLEMENTED` for `add_selector`.

Why this is a blocker:

- `packages/formspec-mcp/src/create-server.ts:640-661` still exposes `add_selector` in `formspec_theme`.
- `packages/formspec-mcp/tests/theme.test.ts:110-167` expects selector creation and listing to work.
- The tool now advertises a capability it cannot execute.

### 3. Layout-to-Theme mode handoff queries the wrong DOM attribute

`packages/formspec-studio/src/workspaces/layout/LayoutCanvas.tsx:343-353` looks for `[data-bind="..."]`, but layout nodes render `data-layout-bind` in:

- `packages/formspec-studio/src/workspaces/layout/FieldBlock.tsx:163-167`
- `packages/formspec-studio/src/workspaces/layout/LayoutContainer.tsx:213-220`

Result:

- switching from Layout mode to Theme mode will not find the selected element
- the scroll/anchor logic in `handleModeChange` never runs

### 4. Theme-properties handoff does not seed popover position

`packages/formspec-studio/src/workspaces/layout/PropertyPopover.tsx:293-304` switches to theme mode and selects the item, but never sets `themePopoverPosition`.

Why this matters:

- `packages/formspec-studio/src/workspaces/layout/LayoutModeContext.tsx:28-29` initializes the position to `{ x: 0, y: 0 }`
- `packages/formspec-studio/src/workspaces/layout/LayoutCanvas.tsx:496-504` uses that position directly for `ThemeOverridePopover`
- the existing Theme-mode click path in `LayoutCanvas.tsx:361-364` already shows the intended pattern: select key and position together

### 5. Column-span stepper double-writes when `onSetColumnSpan` exists

`packages/formspec-studio/src/workspaces/layout/InlineToolbar.tsx:408-409` uses:

- `onSetColumnSpan?.(...) ?? onSetStyle?.(...)`

Because the callback returns `void`, the nullish fallback still fires.

Why this is wrong:

- `packages/formspec-studio/src/workspaces/layout/render-tree.tsx:246-249` passes both `onSetColumnSpan` and `onSetStyle` for fields in a grid
- each click therefore writes `gridColumn` twice through two different paths

### 6. Editable theme properties are still stale and partially misclassified

`packages/formspec-studio-core/src/layout-helpers.ts:270-346` now returns typed descriptors, but:

- it only resolves `componentFor(itemKey)` when `itemType === 'field'`
- group and display items fall through with an empty component name
- the comment-driven item-type filtering is therefore not actually enforced for those items

Coverage gap:

- `packages/formspec-studio-core/tests/layout-helpers.test.ts:260-280` still expects the old string-array API
- the test will fail until it is updated to the new descriptor shape

### 7. Style removal for layout nodes is not well-anchored

`packages/formspec-studio-core/src/layout-helpers.ts:145-165` removes a style by reading the current node through `project.componentFor(lookupKey)` and then writing back with `setLayoutNodeProp`.

Why this is risky:

- `Project.componentFor` is documented as `componentFor(fieldKey: string)` in `packages/formspec-studio-core/src/project.ts:129`
- the layout canvas passes layout-node refs into this helper via `packages/formspec-studio/src/workspaces/layout/LayoutCanvas.tsx:73-77`
- there is no direct test for removing a style from a layout node

## Test Coverage Notes

- `packages/formspec-mcp/tests/behavior-expanded.test.ts` will fail on the current implementation.
- `packages/formspec-mcp/tests/theme.test.ts` will fail on the current implementation.
- `packages/formspec-studio-core/tests/layout-helpers.test.ts` is stale relative to the new return type.
- `packages/formspec-studio/tests/workspaces/layout/property-popover.test.tsx` still constructs `anchorRef.current = null`, which no longer matches the component’s `open && position` render guard.
- There is no test covering the `Theme properties →` button path or the layout-to-theme anchor query.

## Conclusion

The patch moves the Studio UI forward, but it also introduces two hard regressions in public MCP tools and several correctness issues in the layout/theme authoring flow. The public surface and the UI handoff paths both need follow-up before this is safe to merge.
