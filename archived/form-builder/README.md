# ⚠️ ARCHIVED: Formspec Studio v2 (`form-builder`)

**This package is archived and no longer maintained.** It has been superseded by the React 19-based `packages/formspec-studio/` implementation.

For active development, use [`packages/formspec-studio/`](../../packages/formspec-studio/) instead.

This code is preserved in git history for reference only. Do not use for new work.

---

## Historical Documentation

Formspec Studio v2 was a document-first authoring app for Formspec artifacts.
It provides a live editing surface, contextual inspector, diagnostics, and preview while keeping Definition, Component, Theme, and Mapping artifacts synchronized.

## Quick Start

From the monorepo root:

```bash
npm install
npm run start:studio
```

`start:studio` builds required workspace packages and starts the Studio dev server.

If you only need the Studio package loop:

```bash
npm run dev --workspace=form-builder
```

## Key Features

- Document-first form surface with inline editing and slash-command insertion.
- Contextual inspector for fields, groups, display blocks, and form-level settings.
- Visual logic builders with visual-to-FEL toggle.
- Live diagnostics combining JSON-schema (Ajv) and `FormEngine` validation.
- Isolated live preview via `<formspec-render>` iframe sync.
- Structure tree with selection sync and drag reorder.
- Form rules (shapes), variables, mapping editor + round-trip test, extensions browser, version panel, sub-form import, and JSON editor.

## Keyboard Shortcuts

- `Cmd/Ctrl + K`: Open command palette.
- `Cmd/Ctrl + \\`: Toggle structure panel.
- `Cmd/Ctrl + Shift + J`: Open JSON editor.
- `/` (on form surface): Open slash insertion menu.
- `Esc`: Close command palette / slash menu context.

## Architecture Summary

`form-builder` uses a single project signal as the source of truth.

- `src/state/project.ts`: Project model and initial artifact creation.
- `src/state/mutations.ts`: Atomic mutations (add/move/rename/set bind/presentation/import/export/etc.).
- `src/state/wiring.ts`: Cross-artifact coordination (path rewrites, component tree rebuilds).
- `src/state/derived.ts`: Derived diagnostics + dependency metadata.
- `src/components/Shell.tsx`: Main layout (toolbar, structure, surface, inspector, diagnostics, preview/json overlays).

High-level data flow:

1. UI actions call mutation helpers.
2. Mutations update `ProjectState` and keep artifacts aligned.
3. Derived signals recompute diagnostics and supporting metadata.
4. Preview iframe receives synced definition/component/theme snapshots.

## Common Workflows

### Build a Form

1. Click `+ Add first field` or press `/` on the form surface.
2. Choose a template (field/group/display) from slash commands.
3. Edit label/description inline.
4. Select an item to edit advanced properties in the inspector.

### Add Logic and Validation

1. Select a field.
2. Use `Logic` and `Validation` sections in the inspector.
3. Start in visual builders and switch to FEL when needed.
4. Use logic badges on field blocks to jump directly to relevant sections.

### Style and Responsive Tuning

1. Open form-level inspector (`selection = null`) via toolbar `Brand`.
2. Update tokens, selector rules, and form presentation controls.
3. Use breakpoint bar + responsive overrides in field appearance controls.

### Validate and Preview

1. Check the diagnostics bar for error/warning/info counts.
2. Expand diagnostics and navigate directly to affected items.
3. Toggle preview or split view to test rendered behavior in real time.

### Import / Export

1. Open form-level `Import / Export` section.
2. Export individual artifacts or a Studio bundle/template JSON.
3. Import from pasted JSON or a local `.json` file.
4. Save reusable templates to browser local storage.

## Developer Commands

From repo root:

```bash
# Studio dev
npm run start:studio

# Studio tests
npm run test:studio:unit
npm run test:studio:integration
npm run test:studio:e2e

# Studio API docs
npm run docs:api:studio
```

From `form-builder/`:

```bash
npm run dev
npm run build
npm run test
npm run test:unit
npm run test:integration
npm run docs:api
```

Generated docs:

- HTML API docs: `docs/api/form-builder/`
- LLM API doc: `form-builder/API.llm.md`

## Known Limitations

- Persistence is browser-local/in-memory; there is no backend project storage or collaboration layer.
- Template saves use `localStorage` (key: `formspec.studio.templates.v1`) in the current browser profile.
- Import/export currently handles JSON payloads; ZIP packaging is not implemented.
- The JSON editor pane supports Definition/Component/Theme tabs only (not Mapping).
- Preview sync currently includes Definition/Component/Theme artifacts only.
- Registry URL loading depends on browser fetch/network/CORS behavior.
- Visual logic builders round-trip supported FEL patterns; complex expressions stay in raw FEL mode.

## Related Docs

- Studio API reference: [API.llm.md](./API.llm.md)
- Product requirements: [`thoughts/PRD-v2.md`](../thoughts/PRD-v2.md)
- Studio documentation plan: [`thoughts/formspec-studio/2026-03-05-studio-documentation-plan.md`](../thoughts/formspec-studio/2026-03-05-studio-documentation-plan.md)
