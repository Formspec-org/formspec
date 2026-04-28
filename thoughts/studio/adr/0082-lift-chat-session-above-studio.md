# ADR 0082: Lift ChatSession Above StudioApp

**Status:** Proposed
**Date:** 2026-04-28
**Scope:** `formspec-studio` (L6) — assistant session ownership, `StudioApp` view branching, `ChatPanel` consumer surface
**Related:** [PRD §5.3 Chat Session Persistence](../studio/2026-04-28-prd-chatgpt-forms-ide.md#53-chat-session-persistence) — this ADR carves out the foundational decision; sibling decompositions [ADR 0083–0087]; [ADR 0036 (extract `formspec-studio-core`)](./0036-extract-formspec-studio-core-package.md) — same lift-state-up pattern, different package boundary; [ADR 0061 (headless authoring runtime) §6](./0061-current-state-authoring-runtime.md) — prior art for dependency-injected construction over inside-built I/O adapters, applied here one layer up

## Context

`ChatPanel` constructs everything load-bearing for an assistant session inside `useMemo([project])`: the on-disk `ChatThreadRepository` (`packages/formspec-studio/src/components/ChatPanel.tsx:277`), the on-disk `VersionRepository` (line 280), and the `ToolContext` + `ProjectRegistry` + `createToolDispatch` triple (lines 297–314). Two surfaces mount `ChatPanel`: `Shell` (`packages/formspec-studio/src/components/Shell.tsx:428`) and `AssistantWorkspace` (`packages/formspec-studio/src/onboarding/AssistantWorkspace.tsx:758`). Each call site builds its *own* per-mount `createLocalChatThreadRepository()` (`Shell.tsx:51`, `AssistantWorkspace.tsx:187`) and `createLocalVersionRepository()` (`Shell.tsx:52`, `AssistantWorkspace.tsx:188`).

`StudioApp` toggles between the two surfaces via a `studioView: 'assistant' | 'workspace'` enum (`packages/formspec-studio/src/studio-app/StudioApp.tsx:72`, branched at line 132). The toggle unmounts one tree and mounts the other — composer text, scroll position, in-flight requests, `activeSessionId`, and `compareBaseId/TargetId` all reset. A second toggle stack inside `Shell` (`useShellPanels.{showChatPanel, primaryAssistantOpen}` at `useShellPanels.ts:13–19`, plus the `OPEN_ASSISTANT_WORKSPACE_EVENT` cross-context bus at `StudioWorkspaceViewContext.tsx:5`) compounds the fracture: opening the rail vs the overlay vs the onboarding workspace yields three distinct `ChatSession` instances backed by three distinct repositories writing to the same scope.

Repositories converge on disk (same `deriveChatProjectScope(project)`); in-memory state does not. Threads created in `AssistantWorkspace` do not appear in `Shell` until reload.

## Decision

### D-1. Extract `useChatSessionController({ project })`

A single hook owns: `ChatSession` instantiation (today `ChatPanel.tsx:316–325`), `ToolContext` factory + `ProjectRegistry` + `createToolDispatch` (today lines 297–314), thread-list state, `activeSessionId`, `compareBaseId/TargetId`, adapter selection from `getSavedProviderConfig()`, and the persist/restore lifecycle (`persistSession`, `switchToSession`, `startNewSession`, `deleteSession`, `clearSessions` — currently `ChatPanel.tsx:347–398`). Returns `{ session, messages, sendMessage, threads, activeSessionId, compareIds, sendCommand, ... }`. Repositories are dependency-injected, not constructed inside.

### D-2. Mount the provider above view branching

`StudioApp` becomes the controller's mount point — above the `studioView` branch at `StudioApp.tsx:132`. Both `AssistantWorkspace` and `Shell` consume the controller via context. `ChatPanel` becomes a presentational consumer that receives controller outputs as props and emits user intents as callbacks. Mode/layout changes do not unmount the session.

### D-3. Delete the dual-toggle stack

Resolved by a single invariant — the session is always available; layout decides where it renders:

- `studioView` enum and its setters (`StudioApp.tsx:72–76`, 89, 125).
- `StudioWorkspaceViewContext` and `OPEN_ASSISTANT_WORKSPACE_EVENT` (`StudioWorkspaceViewContext.tsx`).
- `useShellPanels.{showChatPanel, primaryAssistantOpen, chatPrompt, setChatPrompt}` (`useShellPanels.ts:13–19`, 27–29) and the `formspec:ai-action` listener at lines 42–53.

The header's `assistantMenu` (`Shell.tsx:227–252`) collapses to "where does the assistant render right now" — consumer of the controller, not owner of session lifecycle.

### D-4. Construct repositories once at the provider

`ChatThreadRepository` and `VersionRepository` are instantiated at the provider, not per-mount. This converges the two on-disk-shared, in-memory-divergent stores currently created at `Shell.tsx:51–52` and `AssistantWorkspace.tsx:187–188`. `ChatPanel`'s repository fallbacks at `ChatPanel.tsx:277–280` become injection points only — the `??` defaults are removed.

## Consequences

- Mode/layout switches preserve composer text, scroll position, `activeSessionId`, `compareBaseId/TargetId`, and active changeset review — no remount of `ChatSession`.
- `ChatPanel` (currently 1,478 lines) loses session ownership; the controller hook becomes the testable unit. Presentational shell shrinks to render + composer + review surface.
- Behavior-preserving for the user; foundation for sibling ADRs 0083–0087.
- Layer-clean: changes confined to L6 (`formspec-studio`); no cross-package contract changes.
- The controller hook is **L6-resident**. It carries session-UI state (`compareBaseId/TargetId`, `activeSessionId`, thread-list) that ADR 0061 §4 explicitly excludes from the headless `formspec-studio-core` runtime. Migration into `studio-core` is out of scope for this ADR and would require its own normative review.

## Kill criteria

- One complete extraction attempt fails to compile green Vitest + Playwright suites — surface the hidden coupling before pressing on. Likely cause: `ChatPanel` UI state entangled with session lifecycle (e.g., `initNotice`, `readyToScaffold`, scaffold/refinement `initializingRef`) in ways the hook boundary cannot honor without a wider refactor. If this fires, audit each state field for reactive contamination before re-attempting (the 0036 §15–28 pattern).
- Post-lift, threads or composer state still reset on a `studioView` swap or a `Shell` rail/overlay toggle — the abstraction missed a state owner. Root-cause before declaring done; do not paper over with effect-level rehydration.
