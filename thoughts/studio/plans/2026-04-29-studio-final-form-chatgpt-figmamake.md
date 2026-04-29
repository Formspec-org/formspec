# Plan — Studio final form: ChatGPT for forms + FigmaMake for forms

## Context

`packages/formspec-studio/` is the 1.0 delivery surface for Formspec's "AI authoring + governed agents + verifiable signature ledger" value prop ([`VISION.md`](../../../VISION.md) §III, §VII; [`STACK.md`](../../../STACK.md) Topology). The destination has been written across two canon PRDs:

- [`../2026-04-28-prd-chatgpt-forms-ide.md`](../2026-04-28-prd-chatgpt-forms-ide.md) — single unified surface, chat-first default, mode-not-view layout switches, progressive IDE disclosure
- [`../2026-04-27-prd-unified-authoring-ai-manual-parity.md`](../2026-04-27-prd-unified-authoring-ai-manual-parity.md) — AI and manual edits as peers, one patch envelope, capability parity matrix as delivery backbone
- [`../2026-04-27-manual-ai-capability-parity-matrix.md`](../2026-04-27-manual-ai-capability-parity-matrix.md) — the ranked matrix

ADRs 0082–0087 (chat session lifted, preview companion, chrome rename, ToolContext+selection, studio-ui-tools, mutation provenance) shipped. They are the *foundation*, not the destination. The destination has gaps: `studioView` toggle still bisects the surface; canvas is read-mostly; chat has no Anthropic adapter, no MCP-as-tool-bridge, no streaming, no inline mini-preview; Brand & Style is a token text-input panel; Make-from-prompt has substrate (`FormScaffolder`, `TemplateLibrary`) but no chat-native UX; Publish is a stub; telemetry blocks three open items.

User decisions taken in this session:
- **Surface is chat-first.** Tree + inspector are compact helpers, not the authoring source of truth. The document/canvas is the end state.
- **A first-class Design surface ships**, but uses non-designer language. The word *token* never appears in the UI; "brand colors", "text sizes", "form spacing", "button styles".

Live Studio sanity check (`http://localhost:5173/studio/`, Section 8 starter loaded):
- Current Studio is two products: AI authoring hides the workspace tabs behind "Open manual controls"; manual authoring is a tabbed IDE (`Editor`, `Layout`, `Evidence`, `Mapping`, `Preview`) with side rails.
- Current `Layout` already contains the future Design substrate: color/type/defaults/rules/breakpoints/page mode/page order/layout document/live preview. It should be renamed and deepened into **Design**, not preserved as a separate top-level tab.
- Current `Evidence` and `Mapping` are real workbenches but not primary user intent. They move behind `Advanced`, available from status/inspector/search/context, not the main mode taxonomy.
- Current `Editor` proves the Edit target: structure editing exists, but it is outline-first. Edit mode must move those operations onto the rendered document.

## Product thesis

Studio is a quiet document workbench: the form document is the artifact, chat is the operating rail, and tree/inspector controls are compact instruments. The screen must not read as a dashboard, card grid, or component catalog. It should feel like editing a live governed form, with AI beside the work rather than replacing the work.

Non-technical user frame: describe the form, see it appear, fix the questions, make it look right, test it, publish it. The primary UI names map to those verbs: `Chat`, `Edit`, `Design`, `Preview`, `Publish`. Spec and integration machinery stays reachable but secondary.

Visual thesis: dense, calm, document-first; one accent for action/provenance; strong canvas gravity; restrained chrome.

Interaction thesis:
- Mode switches preserve the same artifact and session state; they change treatment, not destination.
- Canvas manipulation feels direct: select, ask, insert, drag, review.
- AI proposals render as proposed artifact blocks with review controls, not as decorative chat previews.

## Composition contract

The form stays visually present while chat, tools, and review surfaces move around it. AI is an operating rail; the artifact owns the screen.

Surface hierarchy:
- `Chat`: conversation primary; live artifact context secondary. `ProposedArtifactBlock` appears only for pending structural changes.
- `Edit`: rendered form primary; structure tree and field inspector are instruments around selection.
- `Design`: rendered form primary; style/page controls act directly on selected fields, sections, pages, and breakpoints.
- `Preview`: respondent simulation primary; authoring chrome recedes to a floating chat pill and status strip.

Motion contract:
- Mode changes morph shared elements over ~200ms; the canvas never visibly blanks or remounts.
- Rails slide because instruments move around the same document: chat rail, inspector rail, and preview expansion all preserve artifact continuity.
- Proposed changes enter as reviewable artifact blocks with subtle fade/scale; accept/reject resolves in place before the live artifact updates.

Chat surface priority: never show three competing versions of the form. Normal chat shows live canvas context. When `ProposedArtifactBlock` is visible, the live canvas recedes or collapses; the proposal is the review target.

## Threading the Definition ↔ Layout split

Owner concern: Formspec's value comes from decoupling Core (Definition / business logic) from Theme + Components (presentation). A "ChatGPT/FigmaMake" UX risks collapsing that split in the user's mental model. Ratified against the spec by `formspec-specs:spec-expert`. The split is preserved through these structural commitments:

- **Modes ARE the split.** `Chat` = plane-agnostic; `Edit` = Core (Definition); `Design` = Theme + Components + Pages; `Preview` = realized result. (Correction from initial draft: `pages.*` is Theme tier per Theme §6, not a separate plane — Design covers Theme + Component + Pages together.)
- **The command-type prefix is the spec's tier discriminant.** Every patch already carries tier provenance via its command type (`definition.*` / `theme.*` / `component.*` / `pages.*` / `mapping.*`) per `core-commands.schema.json` (112 commands across 15 areas). No spec extension needed; `MutationProvenancePanel` derives plane from `command.area` / type prefix.
- **Studio writes through the right tier — not into `presentation.*` advisory hints.** Canvas operations that the user expects to be durable across surfaces (grid spans, region placement, breakpoints) MUST land in Theme/Component documents, not in Core's advisory `presentation.*` (Core §4.2.5 marks all `presentation` properties advisory; renderers MAY ignore).
- **The canvas adapts visual treatment per mode** to make the split visible without separate canvases — Edit mode strips theme to a structure-focused treatment; Design mode shows full theming; Preview is respondent-realistic.
- **AI mediates the split.** User says "make the SSN field shorter and put it next to date of birth"; the AI routes `shorter` → Theme/Component, `next to` → Core (sibling reorder) or Theme (grid region) per intent; the patch envelope tracks per-operation tier via command type.

This plan states the end-state architecture, the seams it locks, the substrate it reuses, and the architectural-prerequisite DAG (no calendar phasing — `user_profile` rejects phasing as delivery economy).

---

## End-state architecture

```
UnifiedStudio (single surface; replaces studioView toggle)
├── ChatSessionProvider          — persistent across modes (already lifted, ADR 0082)
├── ProjectProvider              — single Project (studio-core) is sole mutation entrypoint
├── SelectionProvider            — selectedPath synced to canvas + tree + ToolContext (ADR 0085 extended)
├── ModeProvider                 — chat | edit | design | preview  (layout switch, never unmount)
├── Header
│   ├── Brand · form title (inline-editable)
│   └── ModeToggle [Chat] [Edit] [Design] [Preview]
├── Surface (mode-dependent layout)
│   ├── chat:    chat thread (center) · composer (bottom-fixed) · live canvas context (right, desktop) · ProposedArtifactBlock only when a structural changeset is pending
│   ├── edit:    Core/Definition authoring — document-first canvas (structure-focused, theme stripped) · tree (compact helper, mirror) · inspector tabs [Field|Layout|Style] (selection-driven slide-in) · chat rail (360px collapsible)
│   ├── design:  Theme + Components + Pages authoring — Modes (Light/Dark/HC) · Brand colors · Text sizes · Form spacing · Button & input styles · Page regions & grid · live preview
│   └── preview: full-screen respondent simulation (full theming) · viewport switcher (desktop/tablet/mobile) · floating chat pill
├── StatusBar
│   ├── default:  Draft · 24 fields · Wizard · Ask AI · ⋯Advanced
│   └── advanced: technical metrics (binds, shapes, evidence, provenance, drift)
└── Telemetry adapter (single provider; emits all studio_* events)
```

## Seams locked

1. **One mutation pipeline, tier-dispatched.** Every write — AI tool call, canvas direct manipulation, tree drag, inspector commit, slash command — flows through `Project` (`packages/formspec-studio-core/src/project*.ts`) and emits a normalized patch envelope tagged `source: ai|manual` plus actor/context (PRD 2026-04-27 F2/F3). The patch's `command.type` prefix (`definition.*` / `theme.*` / `component.*` / `pages.*` / `mapping.*` per `core-commands.schema.json`) is the tier discriminant — `MutationProvenancePanel` derives plane from this without any new spec field. Single review/undo/history. Capability matrix asserts both paths exist for every row.

   **Tier routing rules** (the named seam Studio must own):
   - **Widget swap** is tier-dispatch by Project document presence: Component Document present → `component.setNodeType` (Tier 3, definitive); Theme Document present without Component → `theme.setItemWidgetConfig` (Tier 2); bare Definition → `definition.setItemProperty` writing the advisory `widgetHint` (Tier 1, advisory only — Core §4.2.5.1).
   - **Drag "next to another field"** is tier-ambiguous. Sibling reorder within Definition tree → `definition.reorderItem` (Core). Grid-region placement / column span / page assignment → `pages.assignItem` / `theme.setItemOverride` / `component.setNodeType` (Theme/Component). The `AuthoringOverlay` MUST resolve which the drag intends and route accordingly — never write durable layout intent into Core's advisory `presentation.*`.
   - **Conditional behavior** has two distinct seams that MUST NOT conflate (Component §8.2 anti-pattern): Core `relevant` (data-excluded from Response) vs Component `when` (visual-only hide). The "conditional ?" badge in `AuthoringOverlay` differentiates which mechanism is active; the AI tool dispatch picks the correct seam based on user intent ("hide" vs "skip / not applicable").

2. **MCPToolBridge** (new in `packages/formspec-chat/src/mcp-tool-bridge.ts`). Wraps the 27 tools in `packages/formspec-mcp/src/tools/` as MCP-protocol tool declarations exposed to every chat adapter. Dispatch order: studio-ui-tools (revealField, setRightPanelOpen, switchMode, highlightField, openPreview) intercept first → MCP tool dispatch via in-process server (no network hop; matches `VISION.md` §VI agent-sdk client-boundary rule). Streaming UI rendered as tool-call cards in `ChatMessageList`.

3. **AnthropicAdapter** (new in `packages/formspec-chat/src/anthropic-adapter.ts`). Third peer to `openai-adapter.ts` and `gemini-adapter.ts`; same tool-call shape via MCPToolBridge. Prompt caching enabled per `claude-api` skill defaults. Provider selection lives in existing `provider-config-storage.ts`.

4. **Document-first canvas** (`AuthoringOverlay` over `<formspec-render>`). The Edit-mode canvas reuses `packages/formspec-webcomponent/src/<formspec-render>` (theme-stripped treatment in Edit; full theming in Design and Preview) and layers a tier-aware authoring overlay: inline label edit (P5.6, Core), slash commands on hover/focus, smart `+` insertion lines between siblings (Core sibling order), drag handles (Core reorder OR Theme/Component placement — overlay disambiguates), selection rings, click-to-change-widget popover (tier-dispatched per Seam 1), logic badges (required •, conditional ?, calculated =, validated !, readonly 🔒 — `?` differentiates `relevant` vs `when`). Tree + inspector demote to compact helpers that mirror canvas selection. Inspector slide-in has tabs `[Field | Layout | Style]` corresponding to Core / Theme placement / Theme+Component visual — selecting a field reveals all three planes for that field, separated.

5. **Design surface** (Theme + Component + Pages authoring). Design absorbs today's `Layout` tab: colors, typography, field defaults, field rules, breakpoints, page mode, page order, layout document, and live preview. Built on the existing token registry (`packages/formspec-layout/`) + 5-level cascade resolver (`getPresentationCascade`) — no schema change. User-facing product name is **Design**, not "Layout" or "Design System"; `design-system/` may remain an internal folder name for the implementation module. Design must be canvas-native, not a settings panel: breakpoint-aware canvas, page-region editing, direct style application to selected fields/sections/pages, brand-color swatches, visual type scale controls, spacing controls that update selected regions live, button/input style previews, and before/after feedback for accepted style changes. **Design mode earning test:** if Design can be implemented as a sidebar of sliders without changing the canvas interaction model, it is not a mode. **Vocabulary rule: never use "token", "cascade", "selector", "variant", "hint", "bind", "layout document", or "design system" in user copy.** Spec terms with normative force that surface plain-language equivalents are mapped 1:1 in `design-system/copy.ts` (e.g. `widget` stays "widget"; `formPresentation.pageMode: "wizard"` surfaces as "Wizard"; `shape` (validation shape) surfaces as "evidence" in status bar).

6. **ProposedArtifactBlock** (new; replaces "mini preview" framing). Inline read-only `<formspec-render>` slice over the proposed-state definition; renders as a first-class artifact review block attached to an assistant proposal when a changeset is structural. Chat supplies intent and rationale; the block is the thing being accepted. ~240px max height; `[Accept all] [Review details] [Tweak it]`.

7. **"Ask AI about this" context menu** on every field surface (canvas, tree, preview). Pre-fills composer with structured field context (PRD 2026-04-28 §6.3).

8. **Make-from-prompt** as chat-native, not a separate tab. Empty-state CTA + `/make` slash command route through `packages/formspec-chat/src/scaffolder.ts` + `template-library.ts`.

9. **Publish/share/embed loop.** Status bar Publish becomes operational. Reuses `mintUrlFromName` (already exported), `exportProjectZip` (already exported), and IntakeHandoff schema (`intake-handoff.schema.json`). States: Draft → Review → Published. Embed snippet is `<formspec-render config-url="...">`. **Spec-derived constraint (ratified):** Publish MUST NOT require a Theme or Component Document — IntakeHandoff `definitionRef` pins only `url + version` with no presentation-tier refs (Core §2.1.6.1, §7.5 null-theme rule). A bare Definition is a publishable artifact. Studio surfaces this in the Publish dialog (theme/components are optional enrichments, not gates).

10. **Telemetry adapter** (single provider in `packages/formspec-studio/src/services/telemetry-adapter.ts`). Emits all `studio_*` events from PRD 2026-04-28 §9. Unblocks ADRs 0083 D-5, 0087 D-3, 0087 D-4 simultaneously.

## Critical files

**New:**
- `packages/formspec-studio/src/studio-app/UnifiedStudio.tsx`
- `packages/formspec-studio/src/studio-app/ModeProvider.tsx`
- `packages/formspec-studio/src/components/ModeToggle.tsx`
- `packages/formspec-studio/src/components/ProposedArtifactBlock.tsx`
- `packages/formspec-studio/src/components/AuthoringOverlay.tsx`
- `packages/formspec-studio/src/components/AskAIContextMenu.tsx`
- `packages/formspec-studio/src/workspaces/design-system/` (internal folder; absorbs current `workspaces/layout` + `workspaces/theme` UI into `BrandColorsSection`, `TextSizesSection`, `SpacingSection`, `ButtonStylesSection`, `InputStylesSection`, `PageRegionsSection`, `BreakpointCanvas`, `ModeSwitcher`)
- `packages/formspec-studio/src/services/telemetry-adapter.ts`
- `packages/formspec-chat/src/anthropic-adapter.ts`
- `packages/formspec-chat/src/mcp-tool-bridge.ts`

**Major refactors (deletions and merges, not extensions):**
- `packages/formspec-studio/src/studio-app/StudioApp.tsx` — delete `studioView` branch; render `UnifiedStudio` always
- `packages/formspec-studio/src/onboarding/AssistantWorkspace.tsx` — archive; logic absorbs into `UnifiedStudio` chat mode
- `packages/formspec-studio/src/components/Shell.tsx` — merge into `UnifiedStudio`; mode-aware layout
- `packages/formspec-studio/src/components/Header.tsx` — `ModeToggle` replaces `assistantSurface` prop
- `packages/formspec-studio/src/components/StatusBar.tsx` — plain-language defaults; `advanced` prop reveals technical metrics
- `packages/formspec-studio/src/components/BlueprintSidebar.tsx` — `Advanced ▾` hides Evidence, Mapping, Screener, Calculations, External data, Reusable choices, and Settings by default
- `packages/formspec-studio/src/components/chat/ChatMessageList.tsx` — detect structural changes, mount `ProposedArtifactBlock`
- `packages/formspec-studio/src/components/ChatPanel.tsx` — accept `selectedPath` from context; `surfaceLayout='preview'` floating composer
- `packages/formspec-studio/src/workspaces/layout/LayoutCanvas.tsx` — merge into Design; wrap its live form surface with `AuthoringOverlay`
- `packages/formspec-studio/src/workspaces/preview/FormspecPreviewHost.tsx` — reuse as live companion (chat/edit) + full-screen (preview mode)
- `packages/formspec-studio/src/workspaces/theme/` — replaced by `design-system/` (theme cascade resolver stays; UI replaced)
- `packages/formspec-studio/src/workspaces/evidence/`, `workspaces/mapping/` — demote from top-level tabs into Advanced routes/panels; preserve engines and state
- `packages/formspec-mcp/src/tools/` — add `switchMode`, `highlightField`, `openPreview` to studio-ui-tools taxonomy (ADR 0086 closed taxonomy expansion; needs ADR amendment)
- `packages/formspec-chat/src/openai-adapter.ts`, `gemini-adapter.ts` — refactor to dispatch via `MCPToolBridge`

**Reuse, no change:**
- `packages/formspec-studio-core/src/project*.ts` (51 helpers — full authoring API surface; do not duplicate)
- `packages/formspec-mcp/src/tools/changeset.ts` (changeset bracket / accept / reject — mutation review backbone)
- `packages/formspec-mcp/src/tools/*` (all 27 tools — drive AI authoring through these)
- `packages/formspec-chat/src/scaffolder.ts`, `template-library.ts`, `session-store.ts`, `issue-queue.ts`, `source-trace-manager.ts`
- `packages/formspec-engine/src/fel/` (WASM FEL bindings; never reimplement in TS — `CLAUDE.md` "Logic ownership: Rust/WASM first")
- `packages/formspec-webcomponent/src/<formspec-render>` (render substrate; used in canvas, preview companion, proposed artifact blocks, full-screen preview, embed)
- `packages/formspec-layout/` (token registry, default theme, CSS baseline)
- `packages/formspec-studio/src/hooks/useChatSessionController.ts` (ADR 0082)
- `packages/formspec-studio/src/components/chat/ChangesetReviewSection.tsx` (inline + drawer modes; ADR 0087)
- `packages/formspec-studio/src/components/chat/MutationProvenancePanel.tsx` (ADR 0087)
- `packages/formspec-studio/src/state/useSelection.ts` (selection + reveal signals; ADR 0085, 0086)
- `packages/formspec-studio/src/components/studio-ui-tools.ts` (closed local-tool taxonomy; ADR 0086)
- `packages/formspec-studio/src/utils/exportProjectZip.ts`, `url-mint.ts`

## Architectural-prerequisite DAG

Calendar phasing is rejected (`user_profile`, `operating-mode`). Architectural prerequisites are the only sequencing input.

```
[1] UnifiedStudio + ModeProvider + delete studioView      ─┐
[2] MCPToolBridge + AnthropicAdapter                        ─┼─→ [4] Proposed artifact blocks in chat (needs 1+2)
[3] Telemetry adapter                                        │     "Ask AI about this" menu (needs 1+2)
                                                             │     studio_mode_changed events (needs 1+3)
                                                             │
[A] AuthoringOverlay over <formspec-render>                  ├─→ [B] Slash commands + inline label edit (needs A)
                                                             │     Logic badges (needs A)
                                                             │     Click-to-change-widget popover (needs A)
                                                             │
[C] Design absorbs current Layout + Theme UI shell            ├─→ [D] Color modes wired to cascade (needs C)
                                                             │     Component variants live preview (needs C+A)
                                                             │
[5] Make-from-prompt UX wired through scaffolder ────────────┤
[6] Publish/share/embed loop ────────────────────────────────┤
[7] Advanced demotion: Evidence/Mapping/Screener/etc. ───────┤
[8] Capability parity E2E gate (matrix walker) ──────────────┘
```

Nodes [1]/[2]/[3]/[A]/[C]/[5]/[6]/[7] have no inter-dependencies — they ship in parallel where file scopes are disjoint (per `user_profile` "parallel agent dispatch when file scopes are disjoint"). [4]/[B]/[D]/[8] gate on their predecessors only. No node is "deferred" — each is architecturally ready.

ADR amendments required (one per architectural seam crossed):
- ADR 0086 amendment: closed-taxonomy expansion to include `switchMode`, `highlightField`, `openPreview`
- ADR 0083 follow-up: mock-data strategy for empty/conditionally-hidden preview elements (D-5)
- ADR 0087 follow-up: accept-gate scroll/dismiss + telemetry pair (D-3, D-4) — unblocked by [3]
- New ADR: MCPToolBridge as unified tool-call substrate; chat adapter interface contract
- New ADR: AuthoringOverlay schema (overlay capabilities, selection model, slash command grammar, drag tier-disambiguation)
- New ADR: **Widget-swap tier routing** — which Project document the click-to-change-widget popover writes to (Component > Theme > Core advisory `widgetHint`), based on document presence. Named seam.
- New ADR: **Conditional-behavior badge semantics** — `relevant` vs `when` differentiation in canvas badges and AI tool dispatch (anti-conflation, Component §8.2)
- New ADR: Design surface vocabulary rules (no "token", "cascade", "selector", "variant", "hint", "bind", "layout document", or "design system" in UI copy; spec-term-to-UI-copy map)
- New ADR: Primary-mode taxonomy and Advanced demotion — `Chat`, `Edit`, `Design`, `Preview` are the non-technical authoring loop; Evidence, Mapping, Screener, Calculations, External data, Reusable choices, and Settings are advanced support surfaces.
- Out of scope for the four-mode surface: **Mapping authoring** and **Screener authoring** as primary modes. Both stay in `Advanced ▾` (Mapping is a post-capture integration concern; Screener is a separate document type with isolated evaluation scope per SKILL Critical Rule).

## Verification

End-to-end:
- `npm test` — full Vitest + Playwright suites; baseline 1191+ tests must remain green
- `cargo nextest run -p formspec-eval` — Rust evaluator unchanged
- `npm run check:deps` — package-layering fences (Studio L6 → studio-core L3; chat additions stay within their layer)
- `npm run docs:check` — schema/spec/lint regen consistent

New E2E suites under `packages/formspec-studio/tests/e2e/`:
- `unified-surface.spec.ts` — mode switches preserve chat session, composer text, scroll, selection; no unmount
- `composition-contract.spec.ts` — mode switches do not blank the canvas; proposal blocks suppress competing canvas previews; Evidence/Mapping are reachable through Advanced but absent from primary modes
- `chatgpt-forms-walkthrough.spec.ts` — Make-from-prompt → AI scaffold → ProposedArtifactBlock → Accept → refine via chat → Publish loop
- `canvas-direct-manipulation.spec.ts` — inline label edit, slash command insertion, smart `+` line, click-to-change-widget, drag handles, logic badges
- `design-mode.spec.ts` — switch Light/Dark/HC, change brand color, change text size, change form spacing, change button style, edit page regions/breakpoints on canvas; live artifact reflects each
- `manual-ai-parity.spec.ts` — walks [`../2026-04-27-manual-ai-capability-parity-matrix.md`](../2026-04-27-manual-ai-capability-parity-matrix.md) rows; asserts AI path and manual path land identical patch envelopes (`source` differs, payload identical)
- `ask-ai-context-menu.spec.ts` — right-click on field in canvas/tree/preview pre-fills composer with structured context
- `publish-flow.spec.ts` — Draft → Review → Published; URL minted; embed snippet generated; export ZIP downloadable

Manual smoke (post-merge, before PR close):
1. `npm run dev:studio`
2. Land in chat mode (default). Type *"housing intake form with applicant info, household members, income, review section"*. Confirm AI scaffold streams; `ProposedArtifactBlock` renders; right canvas updates.
3. Switch to Edit. Verify chat session persists, composer text preserved, scroll preserved. Direct-manipulate canvas: inline-edit a label, drop `+` insertion line, swap a widget via popover.
4. Switch to Design. Toggle to Dark mode; change brand color; change text size; change spacing preset; edit page regions/breakpoint layout on the canvas. Verify the live artifact reflects each immediately.
5. Switch to Preview. Fill form as respondent; verify viewport switcher; verify floating chat pill expands.
6. Click Publish. Verify URL mint; verify embed snippet; verify export ZIP.

Compliance:
- `VISION.md` §III.1, §VII (Studio = AI authoring substrate, 1.0 surface) — satisfied
- `VISION.md` §VI (agent-sdk client-boundary, no DEK in adapters) — MCPToolBridge runs in browser, calls provider directly; no plaintext shortcuts
- PRD 2026-04-27 acceptance §12 (no required AI→manual transition; ≥80% matrix capabilities have AI parity; AI/manual share patch/provenance) — capability parity gate enforces
- `operating-mode.md` (no calendar phasing, no stubs, no half-built scaffolding) — every node above is architecturally ready and ships complete
- `user_profile.md` (closed taxonomies, single language per concern, named seams only) — MCPToolBridge is the single tool-call seam; ModeProvider closes the primary surface taxonomy at four modes; Design vocabulary is closed and non-designer
