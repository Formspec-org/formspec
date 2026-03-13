# Studio TODO

## bindKeyMap collision risk with duplicate item keys

**Priority**: Medium
**Area**: `src/lib/tree-helpers.ts`, `src/workspaces/editor/EditorCanvas.tsx`

When a field is moved (via `component.moveNode`) into a layout container at a different tree level, the renderer falls back to `bindKeyMap` — a secondary index from item key to definition path — to resolve the field's actual definition path.

This map is keyed by leaf key (e.g., `name`), so if two groups have items with the same key (e.g., `page1.name` and `page2.name`), the first one wins. This works today because paged mode only shows one page at a time, but it will break if:

- Multiple pages are rendered simultaneously (e.g., a "show all pages" view)
- Non-paged definitions have duplicate keys across groups

**Fix**: Store the actual definition path on each component tree node during `_rebuildComponentTree`. The rebuild already knows both the definition structure and tree structure, so it can annotate each bound node with its full defPath. This eliminates the need for the fallback map entirely.
