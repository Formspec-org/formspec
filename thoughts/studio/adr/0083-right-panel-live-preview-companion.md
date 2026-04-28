# ADR 0083: Right-Panel Live Preview Companion

**Status:** Proposed
**Date:** 2026-04-28
**Scope:** `formspec-studio` shell layout; `FormspecPreviewHost` mounting strategy; chat ↔ preview selection bridge
**Related:** [ADR 0082 (lift `ChatSession` — prerequisite)](./0082-lift-chat-session-above-studio.md); [ADR 0055 (semantic workspace consolidation)](./0055-studio-semantic-workspace-consolidation.md) — prior art for collapsing top-level mode enums into named layout regions; [PRD: ChatGPT Forms IDE §5.1, §5.2, §8.2](../studio/2026-04-28-prd-chatgpt-forms-ide.md)

## Context

The PRD framed live preview as one of three top-level *modes* (`chat | edit | preview`), with the `preview` mode reserved for a full-screen respondent test. That framing pushes us to (a) duplicate render surfaces — preview-in-rail plus preview-as-mode plus inline-in-message previews — and (b) treat layout state as a discrete mode rather than independent panel toggles. Three concurrent renderers of the same form cost reactive overhead, complicate selection sync, and force the user through a mode switch to do what is mechanically a panel resize.

`FormspecPreviewHost` (`packages/formspec-studio/src/workspaces/preview/FormspecPreviewHost.tsx:162`) already accepts being mounted as a non-fullscreen companion: it takes a `width` prop and `layoutHighlightFieldPath` (line 76) for cross-panel field highlighting, and it already runs as a right-rail companion on the Layout tab (`Shell.tsx:373-414`). The seam exists; the PRD prose just hadn't picked it up.

## Decision

### D-1. Single host, mounted as a collapsible right-panel companion

`FormspecPreviewHost` mounts once inside `Shell` and once inside `AssistantWorkspace` (`packages/formspec-studio/src/onboarding/AssistantWorkspace.tsx`) — same component, same instance per shell, persists across composer/sidebar layout shifts. Visibility is a single `showPreview` boolean persisted per user (existing `useShellPanels` pattern); ADR 0086 references this signal name. Mounting reuses the existing right-rail container shape established for the Layout tab at `Shell.tsx:373-414` (today the host is wrapped in `LayoutLivePreviewSection` at the same seam — same container, one wrapper hop).

### D-2. The right panel is a layout choice, not a mode

There is no `preview` mode toggle. There is no full-screen takeover. To "test the form as a respondent," the user collapses the left sidebar and maximizes the right panel — same component, different region weights. The shell exposes layout knobs (sidebar visible? preview visible? composer prominent?) that compose; it does not expose a mode enum.

### D-3. `ChangesetReviewSection` renders inline in the chat thread, regardless of layout

`ChangesetReviewSection` (`packages/formspec-studio/src/components/chat/ChangesetReviewSection.tsx`) wraps `ChangesetReview`, a diagnostics list, and a merge message — designed for thread width, not a 360px rail. It MUST collapse at narrow widths to a compact `Accept · Reject · View →` affordance that opens a drawer carrying the full review. The full review is never required to fit a rail. This keeps the review surface where the user already reads — the message thread — while letting the rail width float.

### D-4. Bidirectional selection sync drives `layoutHighlightFieldPath`

`selectedPath` (the committed selection from the structure tree, not scroll/hover) drives `FormspecPreviewHost`'s `layoutHighlightFieldPath` prop. The reverse direction — clicking a `data-name` field in the live preview — pushes back into selection. This is a **new bridge**: today `<formspec-render>` does not emit field-selected events into React (only the Layout authoring overlay at `packages/formspec-studio/src/workspaces/layout/ThemeAuthoringOverlay.tsx:5` does, and it is a wrapper, not the webcomponent). Bridge implementation: a delegated click handler on the host's `data-name` matches, dispatched to `useSelection`. One mechanism, both directions.

### D-5. Mock-data strategy for empty / conditionally-hidden elements

Render with type-appropriate placeholders so the user sees structure, not blank shells. Sourcing order: `example` value in the definition first; otherwise generate from field type. Conditionally-hidden elements render in a dimmed "would appear when …" state so the user can see the conditional surface without satisfying the predicate. Live preview becomes a witness to the entire form shape, not just the currently-active branch.

## Consequences

- Three concurrent renderings of the same form collapse to one. No inline preview inside chat message bubbles; no separate full-screen preview surface.
- The `Chat | Edit | Preview` mode toggle is unnecessary. Layout knobs (sidebar visible? preview visible? composer prominent?) replace it. The PRD §5.1/§5.2/§8.2 mode framing folds into panel-toggle prose.
- Preserves the "live preview as conversational witness" goal from PRD §2.2 at the cost of one component instance, not three.
- `ChangesetReviewSection` carries one new responsibility: a width-aware compact mode + drawer. The compact-mode contract is testable without a real rail (CSS container query + Vitest snapshot).

## Kill criteria

- **Telemetry:** if `studio_preview_toggled` shows users collapse the preview panel >50% within their first session, the companion-preview thesis is dead. The right panel should not be default-on; reopen whether preview belongs in the shell at all or behind a `Test →` action.
- **Review-surface fit:** if `ChangesetReviewSection` cannot render usefully at any rail width without spawning a drawer (i.e., the compact mode is so degraded that users always expand the drawer), the inline-in-chat assumption is broken — re-open the review-surface decision and consider moving review out of the thread entirely.
