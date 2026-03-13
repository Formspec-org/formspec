# The Inquest — Technical Addendum

**Version:** 1.0  
**Status:** Draft  
**Date:** March 13, 2026  
**Parent Document:** `0004-the-inquest-prd.md`  
**Target Package:** `packages/formspec-studio/`

---

## 1. Purpose

This document turns the Inquest PRD into an implementation contract. The PRD defines product shape, UX, and positioning. This addendum defines the technical boundaries required to build it without accidental coupling to the main Studio shell.

The core constraint is:

- Inquest can live in the same package as Studio.
- Inquest must remain independent at the app-shell level.
- Reusable feature modules must be mountable by either Inquest or Studio.

This document is the source of truth for package layout, module boundaries, handoff mechanics, provider integration, template manifests, persistence, and verification.

---

## 2. Scope

This addendum covers:

- Browser entry surfaces and package organization
- Dependency boundaries
- Reusable module contracts
- Studio handoff payload and application flow
- Template manifest shape
- Provider adapter contract
- Session persistence
- Test and acceptance criteria

This addendum does not define:

- Final visual design details beyond architectural constraints
- Final copywriting or prompt wording
- Expanded template library content
- Server-side AI proxy behavior

---

## 3. Packaging Strategy

Inquest should ship from the existing `formspec-studio` package for v1. A new package is not required.

The implementation must still expose two independent browser entry surfaces:

1. `Studio` entry surface
2. `Inquest` entry surface

These can be delivered in either of two ways:

1. One Vite package/build with distinct route roots, such as `/studio/*` and `/inquest/*`
2. One Vite package with multiple HTML/app entry points

Either is acceptable. The non-negotiable requirement is that the Inquest app shell is not imported into the Studio app shell and Studio is not imported into the Inquest app shell.

### 3.1 Import Direction

Dependency direction must be one-way:

1. `app-shell` may depend on `features`
2. `features` may depend on `shared`
3. `shared` may depend on `formspec-studio-core` and low-level utilities
4. `features` must not depend on `app-shell`
5. `studio-app` must not depend on `inquest-app`
6. `inquest-app` must not depend on `studio-app`

This rule matters more than package count. "Same package" is fine. Cross-shell imports are not.

### 3.2 Recommended Source Layout

Recommended additive layout inside `packages/formspec-studio/src/`:

```text
src/
  studio-app/
    main.tsx
    routes/
    shell/
  inquest-app/
    main.tsx
    routes/
    shell/
    theme/
    state/
  features/
    template-gallery/
    input-inventory/
    upload-intake/
    analysis-report/
    proposal-viewer/
    refine-workspace/
    source-trace/
    guided-prompts/
    handoff/
    provider-setup/
  shared/
    authoring/
    commands/
    diagnostics/
    theme/
    transport/
    templates/
    providers/
    persistence/
```

Existing `components/`, `workspaces/`, `state/`, and `lib/` code can be extracted incrementally. This document does not require a full Studio refactor before Inquest work begins.

---

## 4. Module Boundaries

### 4.1 App Shell Responsibilities

`inquest-app/` owns:

- Top-level routing
- Session bootstrap and resume
- Inquest-specific navigation and chrome
- Inquest visual theme tokens
- Provider key lifecycle UI
- Launching Studio handoff

`studio-app/` owns:

- Studio routing and shell
- New project launch surfaces
- Embedded use of reusable feature modules
- Receiving and applying handoff bundles

### 4.2 Shared Feature Modules

The following modules must be reusable by both products:

- `template-gallery`
- `analysis-report`
- `proposal-viewer`
- `source-trace`
- `guided-prompts`

The following modules are Inquest-first but still should be written for reuse where practical:

- `input-inventory`
- `upload-intake`
- `refine-workspace`
- `handoff`
- `provider-setup`

### 4.3 Contract Shape

Reusable modules must accept serializable inputs and explicit callbacks. Avoid hidden singleton state, global shell context, or direct browser-route assumptions.

Preferred shape:

```ts
type TemplateGalleryProps = {
  templates: InquestTemplate[];
  selectedTemplateId?: string;
  mode: 'inquest' | 'studio';
  onSelect(templateId: string): void;
  onPreview?(templateId: string): void;
};
```

```ts
type ProposalViewerProps = {
  proposal: InquestProposal;
  inputs: InquestInputSummary[];
  onAccept(): void;
  onRefine(): void;
  onBack(): void;
};
```

```ts
type GuidedPromptsProps = {
  prompts: GuidedPrompt[];
  onDismiss(promptId: string): void;
  onApply(promptId: string, action: PromptAction): void;
};
```

The exact prop names can change. The architectural rule cannot.

---

## 5. Shared Authoring Layer

`formspec-studio-core` remains the canonical mutation/runtime layer.

Inquest must not create a parallel authoring model. It should build on:

- `Project.dispatch()`
- Studio command payloads
- existing path and query helpers
- existing diagnostics and normalization utilities

When Inquest generates or edits structure, it should do so through the same command language Studio already understands. This is what makes handoff reliable and undoable.

---

## 6. Handoff Contract

### 6.1 Goals

The handoff mechanism must:

- support brand new Studio projects
- support merge/import-subform mode
- preserve enough context to rebuild provenance
- be serializable and versioned
- validate before Studio applies mutations

### 6.2 Payload Shape

Minimum payload contract:

```ts
type InquestHandoffPayloadV1 = {
  version: 1;
  mode: 'new-project' | 'import-subform';
  handoffId: string;
  target?: {
    projectId?: string;
    groupPath?: string;
  };
  commandBundle: StudioCommand[];
  scaffold: {
    definition: unknown;
    component?: unknown;
  };
  inquest: {
    sessionId: string;
    templateId?: string;
    inputs: InquestInputSummary[];
    analysisSummary: InquestAnalysisSummary;
    proposalSummary: InquestProposalSummary;
  };
  createdAt: string;
};
```

The command bundle is the primary application mechanism. The scaffold snapshot exists for validation, recovery, and debugging.

### 6.3 Transport

Recommended v1 transport:

1. Inquest writes the payload into browser storage under a generated `handoffId`
2. Inquest navigates to Studio with that `handoffId`
3. Studio loads and validates the payload
4. Studio replays the command bundle
5. Studio stores `x-inquest` provenance in project metadata
6. Studio clears the handoff token after success

Recommended navigation shape:

```text
/studio?h=<handoffId>
```

The transport layer should live under `shared/transport/` so both shells use the same handoff code.

### 6.4 Validation and Failure Rules

Studio must validate before applying:

- payload version
- target mode
- command schema validity
- duplicate-key conflicts for merge mode
- target path existence for merge mode

Failure behavior:

1. do not partially apply commands silently
2. surface a readable error summary
3. keep the handoff payload available for retry
4. allow the user to return to Inquest with the same session

### 6.5 Merge Mode

For `import-subform` mode:

- Inquest receives existing item keys and target context before generation
- Studio revalidates collisions on receipt
- if target path is missing, Studio refuses application and preserves the payload

---

## 7. Template Manifest

Templates are a shared product asset, not Inquest-only configuration.

### 7.1 Template Shape

Minimum template manifest:

```ts
type InquestTemplate = {
  id: string;
  version: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  starterPrompts: string[];
  seedAnalysis: {
    sections: SeedSection[];
    fields: SeedField[];
    rules: SeedRule[];
    repeats?: SeedRepeat[];
  };
  seedScaffold?: {
    definition?: unknown;
    component?: unknown;
  };
  sourceNotes?: string[];
};
```

### 7.2 Authoring Rule

Templates should seed analysis first, not bypass analysis entirely. Direct scaffold seeds are allowed for acceleration, but the user should still land in the same analysis/proposal pipeline.

### 7.3 Storage

Recommended v1 storage:

- checked-in JSON or TS manifests under `shared/templates/`
- local thumbnail/metadata assets
- optional future registry loading, not required for v1

### 7.4 Validation

Template validation must check:

- required metadata fields
- duplicate template IDs
- structurally valid seed analysis
- valid scaffold shape when present

---

## 8. Provider Adapter Contract

The provider layer must be replaceable without touching feature modules.

### 8.1 Interface

```ts
type InquestProviderAdapter = {
  id: string;
  label: string;
  capabilities: {
    chat: boolean;
    images: boolean;
    pdf: boolean;
    structuredOutput: boolean;
    streaming: boolean;
  };
  testConnection(input: ProviderConnectionInput): Promise<ConnectionResult>;
  runAnalysis(input: InquestModelInput): Promise<InquestAnalysisResult>;
  runProposal(input: InquestModelInput): Promise<InquestProposalResult>;
  runEdit(input: InquestModelInput): Promise<InquestEditResult>;
};
```

Feature modules should not know vendor-specific payload shape. Only the adapter should.

### 8.2 Key Handling

Non-negotiable rules:

- keys are never sent to our backend in v1
- default storage is in-memory for the active session
- persistent browser storage is opt-in via "remember this key on this browser"
- stored keys must remain namespaced by provider

### 8.3 Provider Setup Module

`provider-setup` can remain Inquest-first in v1, but must still expose neutral events:

- `onProviderSelected`
- `onConnectionTested`
- `onCredentialsCleared`

That keeps future Studio reuse possible without pulling in Inquest shell assumptions.

---

## 9. Persistence Model

### 9.1 Session Artifacts

Recommended storage split:

- `IndexedDB` for session data, uploads, analysis artifacts, proposal artifacts, and handoff payloads
- `localStorage` only for lightweight UI preferences and optional remembered provider metadata
- in-memory state for active editing session

### 9.2 Autosave

Session persistence must happen:

- after each input mutation
- after each successful analysis/proposal generation
- after each refine mutation batch

The user should never lose the session because the browser tab refreshes.

### 9.3 Resume Contract

When reopening an Inquest session, the app must restore:

- selected template
- uploaded files and extracted summaries
- conversation state
- analysis state
- proposal state
- refine state
- pending handoff payload, if one exists

---

## 10. Testing Strategy

### 10.1 Boundary Tests

Add tests that fail if:

- `features/` imports from `inquest-app/`
- `features/` imports from `studio-app/`
- `studio-app/` imports from `inquest-app/`
- `inquest-app/` imports from `studio-app/`

This can be implemented with a lightweight Vitest dependency-boundary test if no lint rule exists yet.

### 10.2 Module Tests

Feature modules should have focused tests around:

- render from serialized props
- emitted callbacks/events
- no shell-specific assumptions

### 10.3 Integration Tests

Add integration coverage for:

- template selection to analysis input state
- proposal acceptance to refine workspace state
- handoff payload generation
- Studio receipt and replay of handoff payload

### 10.4 E2E Flows

Required E2E coverage:

1. direct Inquest entry → template select → refine → open in Studio
2. Studio new project → launch shared template gallery → Inquest flow → Studio handoff
3. existing Studio project → merge mode handoff
4. resume interrupted Inquest session

---

## 11. Acceptance Criteria

The implementation is not done until the following are true:

1. Inquest runs as a separate browser surface from Studio, even if both ship from the same package.
2. The template gallery can mount in both Inquest and Studio without importing either app shell.
3. Proposal viewer can mount in both Inquest and Studio without importing either app shell.
4. Inquest feature modules communicate through serializable props/events and command/result contracts.
5. Inquest handoff into Studio works for both `new-project` and `import-subform` modes.
6. Studio preserves `x-inquest` provenance after successful handoff.
7. Refreshing or reopening the browser restores the previous Inquest session.
8. Provider key handling never requires a backend proxy in v1.
9. Import-boundary tests prevent shell coupling regressions.

---

## 12. Deferred Items

These are explicitly deferred past this addendum:

- multi-user Inquest sessions
- cloud-synced Inquest history
- hosted key vault behavior
- server-side document preprocessing
- template registry/network fetch

---

## 13. Recommended Next Step

Before implementation begins, write one short follow-on plan that maps this addendum to concrete files in `packages/formspec-studio/src/`, including:

- initial folder creation
- first shared module to extract (`template-gallery`)
- first handoff transport slice
- first dependency-boundary test

That plan should be execution-oriented and small enough to implement in red-green slices.

