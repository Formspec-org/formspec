# The Inquest — Technical Addendum

**Version:** 1.1  
**Status:** Draft  
**Date:** March 13, 2026  
**Parent Document:** `0004-the-inquest-prd.md`  
**Target Package:** `packages/formspec-studio/`

---

## 1. Purpose

This document turns the Inquest PRD into an implementation contract. The PRD defines product shape, UX, and positioning. This addendum defines the technical boundaries required to build it without accidental coupling to the main Studio shell.

The core constraints are:

- Inquest can live in the same package as Studio.
- Inquest must remain independent at the app-shell level.
- Reusable feature modules must be mountable by either Inquest or Studio.
- Provider integrations must normalize into shared contracts.
- Session persistence is local-only in v1.

This document is the source of truth for package layout, module boundaries, handoff mechanics, provider integration, normalized AI contracts, persistence, and verification rules.

---

## 2. Scope

This addendum covers:

- browser entry surfaces and package organization
- dependency boundaries
- reusable module contracts
- provider adapter contracts
- normalized AI output contracts
- Studio handoff payload and application flow
- local persistence and resume
- verification modes and issue gating
- tests and acceptance criteria

This addendum does not define:

- final visual design details beyond architectural constraints
- final copywriting or prompt wording
- expanded template library content
- server-side AI proxy behavior
- cloud sync or team collaboration

---

## 3. Packaging Strategy

Inquest should ship from the existing `formspec-studio` package for v1. A new package is not required.

The implementation must still expose two independent browser entry surfaces:

1. `Studio`
2. `Inquest`

These can be delivered in either of two ways:

1. one Vite build with distinct route roots such as `/studio/*` and `/inquest/*`
2. one Vite package with multiple HTML/app entry points

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
    recent-sessions/
    template-gallery/
    upload-intake/
    input-inventory/
    review-workspace/
    behavior-preview/
    source-trace/
    issue-queue/
    refine-workspace/
    handoff/
    provider-setup/
  shared/
    authoring/
    commands/
    diagnostics/
    providers/
    persistence/
    templates/
    transport/
    contracts/
```

Existing `components/`, `workspaces/`, `state/`, and `lib/` code can be extracted incrementally. This document does not require a full Studio refactor before Inquest work begins.

---

## 4. Module Boundaries

### 4.1 App Shell Responsibilities

`inquest-app/` owns:

- top-level routing
- recent-session listing
- session bootstrap and resume
- Inquest-specific navigation and chrome
- Inquest visual theme tokens
- provider key lifecycle UI
- launching Studio handoff

`studio-app/` owns:

- Studio routing and shell
- new-project launch surfaces
- optional embedded use of reusable Inquest feature modules
- receiving and applying handoff bundles
- exposing the "Reopen Inquest" affordance when possible

### 4.2 Shared Feature Modules

The following modules must be reusable by both products:

- `template-gallery`
- `review-workspace`
- `behavior-preview`
- `source-trace`
- `issue-queue`

The following modules are Inquest-first but still should be written for reuse where practical:

- `recent-sessions`
- `upload-intake`
- `input-inventory`
- `refine-workspace`
- `handoff`
- `provider-setup`

### 4.3 Contract Shape

Reusable modules must accept serializable inputs and explicit callbacks. Avoid hidden singleton state, global shell context, or direct browser-route assumptions.

Preferred shapes:

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
type ReviewWorkspaceProps = {
  analysis: AnalysisV1;
  proposal?: ProposalV1;
  issues: InquestIssue[];
  workflowMode: InquestWorkflowMode;
  onChange(patch: ReviewPatch): void;
  onGenerate(): void;
};
```

```ts
type BehaviorPreviewProps = {
  definition: unknown;
  scenario: PreviewScenario;
  onScenarioChange(scenario: PreviewScenario): void;
};
```

```ts
type IssueQueueProps = {
  issues: InquestIssue[];
  onResolve(issueId: string): void;
  onDefer(issueId: string): void;
  onFocus(issueId: string): void;
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

The Inquest must also respect actual Definition semantics rather than hand-waving them in the UI. Behavior preview and issue gating must reflect:

- `relevant`
- `required`
- `readonly`
- `constraint`
- shape severity and timing
- screener bind scope and route order
- `nonRelevantBehavior`
- `excludedValue`
- `default`

---

## 6. Handoff Contract

### 6.1 Goals

The handoff mechanism must:

- support brand new Studio projects
- support merge/import-subform mode
- preserve enough context to rebuild provenance
- remain serializable and versioned
- validate before Studio applies mutations
- distinguish clearly between replay-into-new-project and import-into-existing-project semantics

### 6.2 Payload Shape

Minimum payload contract:

```ts
type InquestWorkflowMode = 'draft-fast' | 'verify-carefully';

type InquestHandoffPayloadV1 = {
  version: 1;
  mode: 'new-project' | 'import-subform';
  handoffId: string;
  target?: {
    projectId?: string;
    groupPath?: string;
    keyPrefix?: string;
  };
  commandBundle: StudioCommand[];
  scaffold: {
    definition: unknown;
    component?: unknown;
  };
  inquest: {
    sessionId: string;
    templateId?: string;
    workflowMode: InquestWorkflowMode;
    providerId?: string;
    inputs: InquestInputSummary[];
    analysisSummary: InquestAnalysisSummary;
    proposalSummary: InquestProposalSummary;
    issues: InquestIssueSummary[];
  };
  createdAt: string;
};
```

### 6.3 Application Semantics

For `new-project` mode:

- `commandBundle` is the primary application mechanism
- Studio creates a fresh project and replays the bundle

For `import-subform` mode:

- `scaffold.definition` must be a standalone importable Definition snapshot for the generated subtree
- Studio uses `project.importSubform` with `target.groupPath` and optional `keyPrefix`
- `commandBundle` may contain safe follow-up commands only
- unsupported root-level constructs must be surfaced before application, not silently ignored

Examples of unsupported or conditionally supported merge behavior in v1:

- whole-form screener replacement
- root metadata rewrites
- root page-mode rewrites
- follow-up commands that assume a host structure that does not exist after import

### 6.4 Transport

Recommended v1 transport:

1. Inquest writes the payload into browser storage under a generated `handoffId`
2. Inquest navigates to Studio with that `handoffId`
3. Studio loads and validates the payload
4. Studio applies the payload according to mode
5. Studio stores `x-inquest` provenance in project metadata
6. Studio clears the one-time handoff token after success

Recommended navigation shape:

```text
/studio?h=<handoffId>
```

The transport layer should live under `shared/transport/` so both shells use the same handoff code.

### 6.5 Validation and Failure Rules

Studio must validate before applying:

- payload version
- target mode
- command schema validity
- structural validity of `scaffold.definition`
- duplicate-key conflicts for merge mode
- target path existence for merge mode
- follow-up command compatibility for merge mode

Failure behavior:

1. do not partially apply commands silently
2. surface a readable error summary
3. keep the handoff payload available for retry
4. allow the user to return to Inquest with the same session when local state still exists

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
    routes?: SeedRoute[];
  };
  seedScaffold?: {
    definition?: unknown;
    component?: unknown;
  };
  sourceNotes?: string[];
};
```

### 7.2 Authoring Rule

Templates should seed analysis first, not bypass review entirely. Direct scaffold seeds are allowed for acceleration, but the user should still land in the same review pipeline.

### 7.3 Storage

Recommended v1 storage:

- checked-in JSON or TS manifests under `shared/templates/`
- local thumbnail/metadata assets
- optional future registry loading, not required for v1

---

## 8. Provider Adapter Contract

The provider layer must be replaceable without touching feature modules.

### 8.1 Supported Providers

V1 providers:

- Gemini
- OpenAI
- Anthropic (Claude)

Gemini may be recommended in onboarding copy because key acquisition is simple, but it must not receive special-case application logic.

### 8.2 Normalized Output Contracts

Provider-specific responses must normalize into shared internal contracts:

```ts
type AnalysisV1 = {
  requirements: unknown;
  issues: InquestIssue[];
  trace: TraceMapV1;
};

type ProposalV1 = {
  definition: unknown;
  component?: unknown;
  issues: InquestIssue[];
  trace: TraceMapV1;
};

type CommandPatchV1 = {
  commands: StudioCommand[];
  issues: InquestIssue[];
  trace?: TraceMapV1;
};

type TraceMapV1 = Record<string, InquestTraceRef[]>;
```

These shapes can evolve, but the rule is fixed: feature modules consume normalized contracts, never vendor-native envelopes.

### 8.3 Adapter Interface

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
  runAnalysis(input: InquestModelInput): Promise<AnalysisV1>;
  runProposal(input: InquestModelInput): Promise<ProposalV1>;
  runEdit(input: InquestModelInput): Promise<CommandPatchV1>;
};
```

### 8.4 Key Handling

Non-negotiable rules:

- keys are never sent to our backend in v1
- keys are never included in analytics
- keys are never included in handoff payloads
- keys are never included in `x-inquest` project metadata
- remembered keys must remain namespaced by provider
- persistent key storage is opt-in only

### 8.5 Provider Setup Module

`provider-setup` can remain Inquest-first in v1, but must still expose neutral events:

- `onProviderSelected`
- `onConnectionTested`
- `onCredentialsCleared`

---

## 9. Persistence Model

### 9.1 Local-Only Boundary

Inquest persistence is local-only in v1.

- no cloud sync
- no server-side draft history
- no cross-device resume
- no shared sessions

The UI must explicitly say: "Saved on this browser only."

### 9.2 Storage Split

Recommended storage split:

- `IndexedDB` for session data, uploads, extracted artifacts, proposal artifacts, refine state, handoff payloads, and optional remembered credentials
- `localStorage` only for lightweight UI preferences, recent-session index, and provider selection metadata
- in-memory state for the active editing session

### 9.3 Project Metadata Boundary

Project metadata may store `x-inquest` provenance summaries only.

Allowed in `x-inquest`:

- template id
- provider id
- workflow mode
- summarized inputs
- summarized review/proposal decisions
- issue summaries
- trace references

Never persisted to project metadata:

- raw API keys
- raw uploads
- raw full transcript
- local-only draft state

### 9.4 Autosave

Session persistence must happen:

- after each input mutation
- after each successful analysis or proposal generation
- after each refine mutation batch
- after issue resolution or deferral changes

The user should never lose the session because the browser tab refreshes.

### 9.5 Resume Contract

When reopening an Inquest session on the same browser, the app must restore:

- selected template
- uploaded files and extracted summaries
- conversation state
- workflow mode
- analysis state
- proposal state
- issue queue state
- refine state
- pending handoff payload, if one exists

---

## 10. Verification Model

### 10.1 Workflow Modes

V1 requires two workflow modes:

- `draft-fast`
- `verify-carefully`

This mode must be stored in session state and included in handoff provenance.

### 10.2 Blocking Rules

Always blocking:

- structurally invalid Definition output
- invalid commands
- unrepairable FEL or schema violations
- invalid merge target or unsupported import payload

Additional `verify-carefully` blockers:

- unresolved contradictions
- unresolved low-confidence logic affecting requiredness, relevance, calculation, constraint behavior, screener routing, or response shape
- unsupported logic with material impact on respondent flow or eligibility

`draft-fast` behavior:

- same issues are surfaced
- structurally valid output may still hand off
- unresolved issues must be acknowledged

### 10.3 Behavior Preview Contract

The behavior preview must execute against real Definition semantics, not synthetic prose. At minimum it must show:

- relevant/hidden state
- required/readonly state
- validation outcomes
- screener route outcome when applicable
- response shape changes driven by `nonRelevantBehavior`

---

## 11. Testing Strategy

### 11.1 Boundary Tests

Add tests that fail if:

- `features/` imports from `inquest-app/`
- `features/` imports from `studio-app/`
- `studio-app/` imports from `inquest-app/`
- `inquest-app/` imports from `studio-app/`

### 11.2 Module Tests

Feature modules should have focused tests around:

- render from serialized props
- emitted callbacks/events
- no shell-specific assumptions
- accessible issue and confidence presentation

### 11.3 Integration Tests

Add integration coverage for:

- template selection to analysis input state
- provider normalization into `AnalysisV1`, `ProposalV1`, and `CommandPatchV1`
- behavior preview driven by actual Definition semantics
- issue gating for `draft-fast` vs `verify-carefully`
- handoff payload generation
- Studio receipt and replay of handoff payload

### 11.4 E2E Flows

Required E2E coverage:

1. direct Inquest entry -> template select -> review -> refine -> open in Studio
2. Studio new project -> launch Inquest -> handoff to Studio
3. existing Studio project -> import-subform handoff
4. resume interrupted Inquest session on the same browser
5. handoff blocked in `verify-carefully` mode until required issues are resolved

---

## 12. Acceptance Criteria

The implementation is not done until the following are true:

1. Inquest runs as a separate browser surface from Studio, even if both ship from the same package.
2. Shared modules mount without importing either app shell.
3. Gemini, OpenAI, and Anthropic (Claude) are supported through the same normalized contracts.
4. Provider key handling never requires a backend proxy in v1.
5. Provider keys are never written into analytics, handoff payloads, or project metadata.
6. Inquest handoff into Studio works for both `new-project` and `import-subform` modes.
7. Studio preserves `x-inquest` provenance after successful handoff.
8. Refreshing or reopening the browser restores the previous Inquest session on the same browser.
9. The UI explicitly communicates that drafts are saved on this browser only.
10. Verification mode rules are enforced consistently.
11. Import-boundary tests prevent shell-coupling regressions.

---

## 13. Deferred Items

These are explicitly deferred past this addendum:

- multi-user Inquest sessions
- cloud-synced Inquest history
- hosted key vault behavior
- server-side document preprocessing
- template registry/network fetch
- cross-device resume

---

## 14. Recommended Next Step

Before implementation begins, write one short follow-on plan that maps this addendum to concrete files in `packages/formspec-studio/src/`, including:

- initial folder creation
- first shared module to extract
- first normalized provider contract
- first handoff transport slice
- first dependency-boundary test

That plan should be execution-oriented and small enough to implement in red-green slices.
