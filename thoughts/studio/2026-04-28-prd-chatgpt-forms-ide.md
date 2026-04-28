# PRD: ChatGPT for Forms — A Non-Technical IDE Surface

| Field | Value |
| --- | --- |
| **Status** | Draft |
| **Product** | Formspec Studio (`packages/formspec-studio`) |
| **Related** | [Studio first-run onboarding PRD](./2026-04-25-prd-studio-first-run-onboarding.md), [Unified Authoring PRD](./2026-04-27-prd-unified-authoring-ai-manual-parity.md), [Studio unified feature matrix](./2026-04-26-studio-unified-feature-matrix.md) |

---

## 1. Summary

Ship a **single unified surface** where the default mode is a **ChatGPT-like conversational form author** (chat owns the center, the form renders live beside it), and the **IDE chrome** (structure tree, field inspectors, status bar jargon) is **progressively disclosed** — never the default, never blocking, never unmounting. Non-technical users should complete end-to-end form authoring without encountering "workspace," "tab," or "blueprint." Technical users can toggle into IDE depth without losing chat context or conversation history.

This PRD supersedes the `AssistantWorkspace` → `Shell` view split. The surface is one `UnifiedStudio` component. Mode is `chat` (default) | `edit` | `preview`. Mode changes layout, never unmounts.

---

## 2. Problem and Opportunity

### 2.1 Problem

- **Two-view fracture.** `AssistantWorkspace` (full-screen chat) and `Shell` (tabbed IDE) are separate React trees. Crossing the boundary (`studioView` toggle) unmounts chat state, thread history, and composer context. The user lands in a foreign room.
- **IDE chrome is hostile to non-technical authors.** Status bar shows `BINDS`, `SHAPES`, `EVIDENCE 0/0`, `PROVENANCE 0`, `LAYOUT DRIFT 0`. Blueprint sidebar exposes Variables, Data Sources, Option Sets, Mappings — concepts that assume technical fluency.
- **Invisible artifacts.** When AI generates a form in chat, the user accepts a changeset but cannot see what the form looks like without switching to Preview tab. The artifact (the form) is invisible at the moment of creation.
- **"Open manual controls" is wrong framing.** The primary CTA sounds like a flight deck. Non-technical users do not self-identify as wanting "manual controls." They want "see what I built" or "tweak this field."
- **Chat in workspace mode is a second-class citizen.** The docked 360px rail cannot render inline changeset review. Users must expand to overlay (`primaryAssistantOpen`) to review AI proposals — a mode switch inside a mode switch.

### 2.2 Opportunity

- **One room, two windows.** Chat is the default window. Edit and Preview are the other windows — same room, same conversation, same form. Never unmount, never lose context.
- **Live preview as conversational witness.** The form renders in real time as the AI edits. The user sees the artifact being shaped, not just described.
- **Progressive disclosure.** Default view is chat + preview. IDE depth (structure tree detail, field inspectors, technical metrics) is one toggle away, not the starting state.
- **Non-technical confidence.** Users who can text-message should be able to author a form. Technical chrome (binds, shapes, drift) is expert-only, behind an `Advanced` gate.

---

## 3. Goals and Non-Goals

### 3.1 Goals

| ID | Goal | What "done" means |
|---|---|---|
| **G1** | Single surface, never unmount | `UnifiedStudio` replaces `AssistantWorkspace` + `Shell`. Chat session persists across mode switches (`chat` → `edit` → `preview`). No `studioView` state. |
| **G2** | ChatGPT-like default | Composer is bottom-fixed, thread scrolls center, AI responses include inline form previews. User describes intent; AI proposes changes; user accepts/rejects inline. |
| **G3** | Live preview companion | Resizable right panel renders `FormspecPreviewHost` from `project.definition`, updating on every changeset accept. Default open in chat mode. Collapsible. |
| **G4** | Progressive IDE disclosure | Default chrome: structure tree (simplified), field count, status badge. Technical sections (Variables, Data Sources, Mappings, Option Sets) behind `Advanced ▾`. Status bar shows `Draft · 24 fields · Wizard` — not `BINDS`, `SHAPES`, `PROVENANCE`. |
| **G5** | Contextual selection sync | Selecting a field in structure tree or preview pushes `selectedPath` into `ToolContext`. AI knows what the user is looking at: "I see you have 'Full Legal Name' selected." |
| **G6** | Inline changeset review in all modes | `ChangesetReviewSection` renders inside docked rail (360px), overlay, and chat-primary layouts. No mode required to review AI proposals. |
| **G7** | Chat-driven workspace navigation | Slash commands (`/preview`, `/layout`, `/evidence`) and AI tools (`switchWorkspaceTab`) let the conversation navigate the surface. |
| **G8** | "Ask AI about this" from any field | Right-click or inline button on any field in structure tree or preview pre-fills composer with field context. |

### 3.2 Non-Goals

| ID | Non-Goal | Why |
|---|---|---|
| **NG1** | Remove manual IDE | Technical users still need full IDE depth. This PRD hides it by default, never deletes it. |
| **NG2** | Replace `ChatPanel` component | Reuse existing `ChatPanel` with layout props. Do not rewrite the conversation engine. |
| **NG3** | New runtime or respondent app | Form-filling behavior changes only indirectly through authored artifacts. |
| **NG4** | Auto-run agent | User confirmation and review remain required per unified-authoring policy. |
| **NG5** | Mobile-first redesign | Responsive behavior inherits existing breakpoints. Focus is on desktop default experience. |

---

## 4. Personas

| Persona | Technical fluency | Primary need | How this PRD serves them |
|---|---|---|---|
| **Program Officer** | Low. Can use Word, not Excel formulas. | Turn a policy document into a form quickly, with AI help. | Chat-first surface, natural language intent, live preview shows the form taking shape. |
| **Form Designer** | Medium. Knows what fields mean, not how they bind. | Iterate form structure, validation, layout with precision. | Toggle into `edit` mode for inline field editing. Chat stays open as co-pilot. |
| **Integration Engineer** | High. Needs mappings, data sources, JSON export. | Full IDE depth for advanced configuration. | `Advanced ▾` exposes Variables, Data Sources, Mappings, Option Sets. Status bar shows technical metrics. |

---

## 5. Product Model

### 5.1 Surface Modes

`UnifiedStudio` has three modes. Mode is a layout switch, never a view unmount.

| Mode | Default? | Layout | Primary content | Secondary panel | Use case |
|---|---|---|---|---|---|
| `chat` | Yes | Chat thread center, preview right (collapsible), composer bottom-fixed | `ChatPanel` with inline `ChangesetReviewSection` | Live form preview from `FormspecPreviewHost` | Default authoring. Describe → see → accept → iterate. |
| `edit` | No | Structure tree left, inline field editor center, chat rail right (360px, collapsible) | `DefinitionTreeEditor` + inline field properties | Docked `ChatPanel` (`surfaceLayout='rail'`) | Direct manipulation. Chat stays available as co-pilot. |
| `preview` | No | Full-screen `FormspecPreviewHost`, floating composer overlay | Live form test | Floating chat composer (collapsed to pill, expands on click) | Test the form as a respondent would see it. |

### 5.2 Mode Transitions

Transitions preserve chat session, thread history, and composer state.

```
chat → edit:  slide structure tree in from left, preview collapses to preview button
edit → chat:  slide structure tree out, preview expands from right
chat → preview: canvas expands to full screen, composer becomes floating pill
preview → chat: canvas shrinks to right panel, composer re-docks bottom
```

No `studioView` toggle. No `AssistantWorkspace` unmount. No `Shell` re-mount.

### 5.3 Chat Session Persistence

The chat session object (`ChatSession` from `@formspec-org/chat`) lives in a provider above `UnifiedStudio`. Mode changes pass the same `project` reference. `ChatPanel` receives `project` and `session` props; it does not own session lifecycle.

This fixes the current fracture where `AssistantWorkspace` and `Shell` each instantiate separate `ChatPanel` components with separate repositories.

### 5.4 Simplified Chrome (Default)

**Header:**
- Left: `The Stack` brand + form title (click to edit inline, not a dialog)
- Center: Mode toggle `[Chat] [Edit] [Preview]` (active mode highlighted)
- Right: `Search` · `Undo`/`Redo` · `Assistant` menu (new chat, history, settings)

**Left sidebar (chat mode):**
- Structure tree only. Groups and fields. Click to select, drag to reorder.
- `Advanced ▾` accordion: Variables, Data Sources, Option Sets, Mappings (collapsed by default, click to expand)

**Status bar:**
- `Draft` badge (click to change status: Draft → Review → Published)
- `24 fields` (click to open structure tree)
- `Wizard mode` (click to change: Single / Wizard / Tabs)
- `Ask AI` button (pre-fills composer with context)
- Technical metrics (`BINDS`, `SHAPES`, `EVIDENCE`, `PROVENANCE`, `DRIFT`) hidden behind `⋯` menu

**Right panel (chat mode):**
- Live form preview. Collapsible via `⌄` chevron. Resizable drag handle.

### 5.5 Full IDE Chrome (Advanced Toggle)

When user clicks `Advanced ▾` or toggles `Show technical chrome` in settings:

- Status bar expands to show all metrics
- Left sidebar shows all blueprint sections
- Field inspectors show raw JSON, mapping rules, data source bindings
- Form Health panel becomes permanently visible (not just on error)

---

## 6. Key Interactions

### 6.1 Default Onboarding Flow (Non-Technical User)

1. User lands on `UnifiedStudio` in `chat` mode.
2. Blank project is already created (no "create project" step).
3. Chat composer shows placeholder: *"Describe the form you need — audience, sections, required fields, validation — or upload a source document."*
4. Left sidebar shows structure tree: empty. Start rail buttons (starter templates, blank, import) appear inline above the tree.
5. User types: *"I need a housing intake form with applicant info, household members, income, and a review section."*
6. AI responds with proposed structure. Inline mini-preview renders in the chat message: *"I added 4 groups, 18 fields. [See preview →]"*
7. User clicks `[See preview →]` — right panel expands to show the form.
8. User says: *"Add a field for prior housing voucher status in the applicant section."*
9. AI proposes delta. `ChangesetReviewSection` renders inline in chat. User clicks `Accept`.
10. Right panel updates. User is satisfied. Clicks `Publish` in status bar.

### 6.2 Technical User Flow

1. User lands on `UnifiedStudio` in `chat` mode.
2. Toggles `Advanced` in settings. Status bar shows full metrics. Left sidebar shows all sections.
3. User switches to `edit` mode. Structure tree + inline field editor dominate.
4. Chat rail stays docked right. User right-clicks a field → `Ask AI: "Add validation to this field"`.
5. Composer pre-fills with field context. AI proposes regex constraint. User accepts inline.
6. User switches to `preview` mode. Tests form as respondent. Finds issue.
7. Floating chat pill expands. User types: *"The SSN field label is confusing."*
8. AI proposes label change. User accepts. Returns to `edit` mode to verify.

### 6.3 "Ask AI About This" Context Menu

Available on any field in structure tree and any field in preview:

- `Explain this field`
- `Add validation`
- `Change label or hint`
- `Move to another group`
- `Remove this field`
- `Make this field conditional on...`

Clicking any option pre-fills the composer with structured context:
```
Field: "Full Legal Name" (path: applicant.name)
Type: text
Current: required=true, hint="Enter full legal name"
Request: Add validation
```

---

## 7. Technical Architecture

### 7.1 Component Restructure

```
StudioApp.tsx
  └── UnifiedStudio (replaces AssistantWorkspace + Shell)
      ├── ModeProvider (chat | edit | preview)
      ├── ChatSessionProvider (persistent session above modes)
      ├── Header
      │   └── ModeToggle [Chat] [Edit] [Preview]
      ├── LeftSidebar
      │   ├── StartRail (collapsible after first action)
      │   ├── StructureTree (always visible, simplified by default)
      │   └── AdvancedAccordion (collapsed by default)
      ├── CenterCanvas (mode-dependent)
      │   ├── chat: ChatPanel (primary, inline changeset review)
      │   ├── edit: DefinitionTreeEditor + inline field editor
      │   └── preview: FormspecPreviewHost (full-screen)
      ├── RightPanel (chat/edit mode)
      │   └── LivePreview (FormspecPreviewHost, collapsible)
      ├── ComposerBand (bottom-fixed in chat/edit)
      │   └── ChatPanel composer (or floating pill in preview)
      └── StatusBar
          ├── Default: Draft badge, field count, mode, Ask AI
          └── Advanced: full metrics, binds, shapes, evidence, provenance, drift
```

### 7.2 File Changes

| File | Action | Notes |
|---|---|---|
| `src/studio-app/StudioApp.tsx` | Refactor | Delete `studioView` toggle. Always render `UnifiedStudio`. |
| `src/onboarding/AssistantWorkspace.tsx` | Archive | Logic migrates into `UnifiedStudio`. Start rail becomes inline component. |
| `src/components/Shell.tsx` | Refactor | Merge with `AssistantWorkspace`. Add mode-aware layout. Preserve `ChatPanel` mount. |
| `src/components/ChatPanel.tsx` | Extend | Accept `selectedPath` from context. Add `surfaceLayout='preview'` for floating composer. |
| `src/components/AssistantEntryMenu.tsx` | Refactor | Replace "AI authoring surface" with "Expand composer". Remove workspace/assistant dichotomy. |
| `src/components/Header.tsx` | Extend | Add `ModeToggle`. Remove `assistantSurface` prop (mode replaces it). |
| `src/components/StatusBar.tsx` | Extend | Add `advanced` prop to show/hide technical metrics. |
| `src/components/BlueprintSidebar.tsx` | Extend | Add `advanced` prop to show/hide technical sections. |
| `src/components/chat/ChatMessageList.tsx` | Extend | Detect structural changes in assistant messages. Render `MiniFormPreview` inline. |
| `src/workspaces/preview/FormspecPreviewHost.tsx` | Reuse | Mount as live preview companion in chat/edit modes. |
| New: `src/studio-app/UnifiedStudio.tsx` | Create | Main surface component. Mode provider, layout orchestration. |
| New: `src/components/ModeToggle.tsx` | Create | `[Chat] [Edit] [Preview]` tab bar. |
| New: `src/components/MiniFormPreview.tsx` | Create | Condensed read-only form snippet for inline chat rendering. |

### 7.3 State Model

```typescript
interface UnifiedStudioState {
  mode: 'chat' | 'edit' | 'preview';
  showPreview: boolean;        // right panel collapsed?
  showAdvanced: boolean;       // IDE chrome visible?
  selectedPath: string | null; // synced into ToolContext
  chatSession: ChatSession;    // persistent across modes
}
```

Mode changes preserve:
- `chatSession` (thread, messages, composer text)
- `project` reference (definition, diagnostics, undo/redo)
- `selectedPath` (what the user is looking at)
- `showPreview` (user's preference for companion panel)

### 7.4 ToolContext Extension

Current `ToolContext` in `ChatPanel.tsx` (~line 300):

```typescript
interface ToolContext {
  tools: ToolDeclaration[];
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  getProjectSnapshot(): { definition: FormDefinition };
}
```

Extended:

```typescript
interface ToolContext {
  tools: ToolDeclaration[];
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  getProjectSnapshot(): { definition: FormDefinition };
  getWorkspaceContext(): {
    mode: 'chat' | 'edit' | 'preview';
    activeTab: string;        // Editor, Layout, Evidence, etc.
    selectedPath: string | null;
    viewport: 'desktop' | 'tablet' | 'mobile';
  };
}
```

New MCP tools:
- `switchWorkspaceTab(tab: string)` — AI switches user to Layout, Evidence, etc.
- `highlightField(path: string)` — AI scrolls structure tree to a field.
- `openPreview()` — AI opens right preview panel.

---

## 8. UI Specifications

### 8.1 Mode Toggle

- Three buttons: `Chat` · `Edit` · `Preview`
- Active mode: filled accent background, white text
- Inactive modes: transparent, muted text, hover shows subtle background
- Transition: 150ms fade-in on mode change

### 8.2 Chat Mode Layout

```
┌──────────────────────────────────────────────────────────┐
│ Brand · [Chat] [Edit] [Preview] · Search · Undo · AI    │
├──────────┬──────────────────────────┬─────────────────┤
│          │                          │  Live Preview   │
│  Start   │    Chat Thread           │  (collapsible)  │
│  Rail    │    ┌──────────────────┐  │                 │
│          │    │ AI: I added...   │  │  [Form renders  │
│  Structure│    │ [inline preview] │  │   here]        │
│  Tree    │    └──────────────────┘  │                 │
│          │                          │                 │
│          │    [Changeset review]    │                 │
│          │                          │                 │
├──────────┴──────────────────────────┴─────────────────┤
│  [Upload] [Describe what you need...] [Send]        │
├──────────────────────────────────────────────────────────┤
│  Draft · 24 fields · Wizard · Ask AI · [⋯ Advanced]   │
└──────────────────────────────────────────────────────────┘
```

### 8.3 Edit Mode Layout

```
┌──────────────────────────────────────────────────────────┐
│ Brand · [Chat] [Edit] [Preview] · Search · Undo · AI    │
├──────────┬──────────────────────────┬───────────────────┤
│          │                          │  Chat Rail        │
│  Structure│    Inline Field Editor   │  (360px,          │
│  Tree    │    [selected field       │   collapsible)    │
│          │     properties]            │                   │
│          │                          │  [Thread]         │
│          │    [Full structure       │  [Composer]       │
│          │     canvas]                │                   │
├──────────┴──────────────────────────┴───────────────────┤
│  Draft · 24 fields · Wizard · Ask AI · [⋯ Advanced]    │
└──────────────────────────────────────────────────────────┘
```

### 8.4 Preview Mode Layout

```
┌──────────────────────────────────────────────────────────┐
│ Brand · [Chat] [Edit] [Preview] · Search · Undo · AI    │
├──────────────────────────────────────────────────────────┤
│                                                        │
│              Full-Screen Form Preview                  │
│                                                        │
│  [Fill as respondent would]                             │
│                                                        │
│                                                        │
├──────────────────────────────────────────────────────────┤
│  Floating chat pill (bottom-right)                     │
│  [💬] → expands to mini composer overlay               │
└──────────────────────────────────────────────────────────┘
```

### 8.5 Status Bar Simplification

**Default:**
```
The Stack  FORMSPEC 1.0    [DRAFT]  📋 24 fields  🧙 Wizard  💬 Ask AI
```

**Advanced (toggle):**
```
... 24 fields  🧙 Wizard  💲 USD  📐 Comfortable  🔗 15 binds  ◯ 3 shapes
⚠ EVIDENCE 0/0  🔷 PROVENANCE 0  ◆ LAYOUT DRIFT 0  💬 Ask AI
```

### 8.6 Inline Mini Preview in Chat Messages

When assistant message includes structural changes, render a condensed `MiniFormPreview` inside the message bubble:

- Height: ~200px max
- Shows only affected groups/fields (not full form)
- Read-only, no interaction
- Labeled: *"Preview of changes"*
- Action buttons below: `[Accept all]` `[Review details]` `[Tweak it]`

---

## 9. Telemetry Events

| Event | Trigger | Payload |
|---|---|---|
| `studio_mode_changed` | Mode toggle | `from`, `to`, `fieldCount`, `hasActiveChangeset` |
| `studio_preview_toggled` | Expand/collapse right panel | `visible`, `mode` |
| `studio_advanced_toggled` | Show/hide technical chrome | `visible`, `mode` |
| `studio_ask_ai_context_menu` | Right-click → Ask AI | `action`, `fieldPath` |
| `studio_inline_preview_accepted` | Click Accept in mini preview | `changesetId`, `groupCount` |
| `studio_composer_prefilled` | Context menu pre-fills composer | `source`, `fieldPath` |
| `studio_floating_composer_expanded` | Preview mode chat pill click | `fieldCount` |

---

## 10. Open Questions

1. **Mobile mode behavior.** Does `preview` mode on mobile become a full-screen stack (push navigation) or an overlay? Current `Shell` uses compact layout with bottom sheets.
2. **Keyboard shortcuts for mode switching.** `Cmd+1/2/3` for Chat/Edit/Preview? Or `Cmd+Shift+P` opens mode palette?
3. **Chat thread persistence scope.** Should threads be per-project (today's behavior) or per-user across projects? Affects `chatThreadRepository` keying.
4. **Mini preview rendering cost.** `MiniFormPreview` re-renders on every message. Does it need virtualization or throttling for large forms?
5. **Evidence tab in chat mode.** Does `/evidence` switch to `edit` mode + Evidence tab, or does evidence become a chat-native surface (upload → inline review)?

---

## 11. Sequencing

| Phase | Scope | Files touched | Est. effort |
|---|---|---|---|
| **P1 — Foundation** | Create `UnifiedStudio.tsx`, delete `studioView`, wire mode provider + persistent chat session | `StudioApp.tsx`, `UnifiedStudio.tsx`, `useShellPanels.ts` | 2 days |
| **P2 — Chat mode** | Chat-primary layout with collapsible preview companion, simplified chrome | `Shell.tsx`, `ChatPanel.tsx`, `StatusBar.tsx`, `BlueprintSidebar.tsx` | 3 days |
| **P3 — Edit mode** | Structure tree + inline editor + docked chat rail, preserve session | `WorkspaceContent.tsx`, `DefinitionTreeEditor`, `ChatPanel.tsx` | 2 days |
| **P4 — Preview mode** | Full-screen preview + floating composer pill | `PreviewTab.tsx`, `FormspecPreviewHost.tsx` | 1 day |
| **P5 — Context sync** | `selectedPath` in `ToolContext`, MCP tools for tab switching, contextual Ask AI | `ChatPanel.tsx`, `ToolContext` types, MCP registry | 2 days |
| **P6 — Inline previews** | `MiniFormPreview` component, message detection for structural changes | `ChatMessageList.tsx`, `MiniFormPreview.tsx` | 2 days |
| **P7 — Polish** | Mode transitions (CSS), mobile responsive, keyboard shortcuts, telemetry | All surface files | 2 days |

**Total: ~14 days.** Parallelizable: P3 and P4 can run together. P5 and P6 can run together after P2.

---

## 12. Related Documents

- [Studio first-run onboarding PRD](./2026-04-25-prd-studio-first-run-onboarding.md) — onboarding flow and assistant-first landing
- [Unified Authoring PRD](./2026-04-27-prd-unified-authoring-ai-manual-parity.md) — AI + Manual parity, patch lifecycle
- [Studio unified feature matrix](./2026-04-26-studio-unified-feature-matrix.md) — ranked feature matrix (Field provenance, Layout documents, Evidence graph, Patch lifecycle)
- [Formspec Studio PRD (archived)](../archive/studio/2026-03-05-product-requirements-v2.md) — core Studio v2 vision (superseded by ADRs 0082–0087)
