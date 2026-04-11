# ADR-0022: Playground Strategy (Custom Runtime + Experience Split)

**Status**: Superseded (Implemented, then Removed)  
**Date**: 2026-02-24  
**Updated**: 2026-02-24  
**Authors**: Codex (AI), exedev  
**Deciders**: exedev  
**Depends on**: [ADR-0019: Theme Cascade Implementation and Default Theme](0019-theme-cascade-default-theme.md), [ADR-0020: CSS Integration and Design System Interop](0020-css-integration-and-design-system-interop.md), [ADR-0021: Holistic Kitchen-Sink E2E Conformance Plan](0021-holistic-kitchen-sink-e2e-conformance-plan.md)

---

## 1. Context and Problem Statement

We need a developer-facing playground for Formspec rendering that supports real authoring workflows, not only isolated component screenshots.

The system must support three distinct workflows without collapsing them into one overloaded screen:

- form authoring and submission behavior
- component-tree authoring and visual/layout behavior
- traceability debugging (mapping + replay + deterministic diagnostics)

This is broader than a visual component gallery. Formspec components are behaviorally coupled to the engine and definition semantics, so static prop-driven demos are insufficient for many failure modes.

## 2. Decision Drivers

- **Runtime fidelity**: mirror actual `<formspec-render>` + `FormEngine` behavior.
- **Spec-centric workflow**: edit JSON artifacts, not framework props.
- **Determinism for test reuse**: same scenario should be playable in manual and automated runs.
- **Separation of concerns**: core authoring UX should not be buried under replay/trace tooling.
- **Low integration friction**: we already run Vite and Playwright in-repo.
- **Maintenance cost**: avoid heavy tooling overhead that does not map to Formspec semantics.
- **Future extensibility**: leave room for visual catalog/documentation growth without locking architecture.

## 3. Considered Options

### Option A: Off-the-shelf playground (Storybook web-components)

Use Storybook (`@storybook/web-components-vite`) as the primary playground.

Pros:
- mature UI shell, docs pages, controls, addon ecosystem
- built-in visual review workflows
- fast initial setup for isolated visual stories

Cons:
- Formspec flows are document- and state-machine-driven, not prop-driven; substantial custom glue needed
- complex journeys (wizard/repeat/validation transitions/event replay) are awkward as stories
- risk of maintaining Storybook abstractions plus separate e2e harness abstractions
- adds dependency and upgrade surface area for capabilities we may not use heavily

### Option B: Custom first-party playground (chosen)

Build a dedicated playground route/app using existing Vite stack and our renderer directly.

Pros:
- exact fit for Formspec primitives (definition/theme/component/mapping/response/validation)
- straightforward integration with existing fixtures and Playwright harnesses
- deterministic controls (clock/seed/locale/timezone) can match conformance requirements
- minimal dependency footprint and no framework impedance mismatch

Cons:
- we own the UI shell and tooling UX
- no ready-made addon marketplace
- requires explicit work for docs/discoverability polish

### Option C: Hybrid (custom runtime + Storybook catalog)

Primary custom playground for runtime behavior, optional Storybook later for static component docs.

Pros:
- best of both worlds if we later need design-system-friendly catalogs

Cons:
- two toolchains and two maintenance surfaces
- premature unless catalog needs become concrete

## 4. Decision

Original decision: adopt **Option B** and build a **custom first-party runtime studio** split into three experiences:

- **Form Playground**
- **Component Playground**
- **Form Debugger/Replay**

Storybook (or another off-the-shelf catalog) is deferred and may be added later only if we have a clear need for component-marketing/docs workflows that the custom playground cannot satisfy economically.

Update (same day): the playground application layer was removed from the repository after implementation and review. This ADR remains as a historical record of the approach, tradeoffs, and rollback lessons.

### Reasoning

Formspec’s highest-risk defects are behavioral and cross-document (MIPs, FEL, relevance, submission semantics), not static visual props. A custom playground maps directly to those semantics and can share fixtures and execution patterns with ADR-0021 conformance flows. This gives higher signal per engineering hour than adapting a generic story framework into a stateful form-runtime debugger.

### Capability Placement Rule

If a capability is required for system correctness (not just playground UX), it must live in runtime libraries, not only in the playground app:

- `packages/formspec-engine`: semantic/runtime capabilities (deterministic replay primitives, diagnostics snapshots, mapping runtime logic, comparator policy, execution controls).
- `packages/formspec-webcomponent`: browser/DOM binding of engine capabilities (rendering, events, adapter glue, visibility/state projection).
- `playground/` app: tooling UX only (editors, controls, dashboards, export/copy affordances, guided demo flows).

This prevents semantic drift between playground behavior and production/runtime consumers.

## 5. Decision Details

### 5.1 Experience and Route Boundaries (historical, removed)

The split was route-based while implemented:

| Experience | Primary purpose | Route |
|---|---|---|
| Form Playground | Definition/theme/component authoring and submission behavior | `/playground/` |
| Component Playground | Component-focused authoring using the same runtime semantics | `/playground/components/` |
| Form Debugger/Replay | Traceability workflows (mapping, replay, deterministic diagnostics) | `/playground/debugger/` |
| Demo Mode | Curated fixture execution over the same runtime | `/demo/` |

### 5.2 Capability Allocation (historical, removed)

Core form and component playground surfaces include:

- fixture loading/reset/script execution
- definition/theme/component JSON editing
- live render preview and submit
- response and validation artifacts

Debugger/replay surface adds (and owns):

- deterministic runtime controls (`now`, `locale`, `timeZone`, `seed`)
- mapping editor/source and forward/reverse execution
- replay trace editor and play/pause/step/reset controls
- diagnostics snapshot, mapping output, replay log artifacts

Traceability capabilities are intentionally scoped to debugger/replay to keep authoring playgrounds focused.

### 5.3 Deterministic Runtime (definition)

In this ADR, deterministic runtime means a fixed execution context so identical fixture inputs produce reproducible outputs:

- fixed clock (`now`)
- fixed locale/time zone
- fixed pseudo-random seed
- replayable event trace sequence

This enables reliable manual debugging parity with Playwright and kitchen-sink conformance flows.

### 5.4 First-Class Inputs/Outputs

All experiences are grounded in the same document model.

Inputs:

- Definition document
- Theme document
- Component document
- Optional mapping document (engine-backed when TS runtime mapping is available)
- Scenario event trace

Outputs:

- current response payload
- validation report
- engine state/debug view
- deterministic replay log

## 6. Implementation Plan (Phased)

1. **Phase 0: Runtime Capability Foundations (library-first)** *(implemented)*
   - Add/extend engine APIs for diagnostics snapshots and deterministic replay controls.
   - Keep semantic logic in `formspec-engine`; expose browser integration points through `formspec-webcomponent`.
   - Avoid implementing semantic-only logic exclusively in `playground/`.

2. **Phase 1: Shell + Fixture Loader** *(implemented, then removed)*
   - Add a dedicated playground entry (Vite route/app).
   - Load fixture bundles from `tests/e2e/fixtures/*`.
   - Render through `<formspec-render>` with hot reload.

3. **Phase 2: Experience Split (Form / Component / Debugger)** *(implemented, then removed)*
   - Separate core authoring experiences from debugger/replay.
   - Route debugger-specific controls and artifacts only to `/playground/debugger/`.
   - Keep `/playground/` and `/playground/components/` focused on authoring + submit workflows.

4. **Phase 3: Inspector + Artifact Panels** *(implemented, then removed)*
   - Add panels for response JSON, validation report JSON, engine diagnostics.
   - Add one-click copy/export for artifacts.
   - Support mapping document input and mapped output view when runtime mapping API is available.

5. **Phase 4: Scenario Replay** *(implemented, then removed)*
   - Add deterministic replay controls (play/pause/step/reset).
   - Support fixed clock/locale/timezone mode for reproducible runs.
   - Drive replay from event-trace documents, not ad-hoc button scripts.

6. **Phase 5: Test Convergence** *(implemented, then removed)*
   - Ensure Playwright can drive the playground directly for selected conformance checks.
   - Reuse scenario fixtures between manual playground and e2e tests.
   - Assert route-level split invariants (debugger controls absent from form playground routes).

7. **Phase 6: Optional Catalog Evaluation (Deferred)**
   - Reassess Storybook (or equivalent) only if static component documentation needs become a bottleneck.

## 7. Consequences

### Positive

- Higher fidelity debugging for spec-level behavior.
- Lower cognitive load per workflow due to explicit experience split.
- Tighter loop between authoring, runtime diagnosis, and e2e verification.
- Lower dependency and upgrade burden.
- Better alignment with JSON-centric Formspec workflows.
- Clear ownership boundaries reduce duplication and prevent playground-only semantics.
- Runtime/library APIs added for determinism, diagnostics, and mapping remain reusable even without a playground UI.

### Negative / Tradeoffs

- We must build and maintain playground UX ourselves.
- Documentation polish features come later unless prioritized.
- No immediate access to off-the-shelf visual addon ecosystem.
- Library-first capability placement adds up-front API design work before UI iteration.
- Fast UI iteration without long-lived product ownership introduced churn and eventual rollback cost.

## 8. Non-Goals

- Replacing the conformance suite with playground tests.
- Building a public-facing design system showcase in this phase.
- Supporting every external framework integration pattern on day one.

## 9. Revisit Triggers

Re-open this ADR if any of the following occur:

- Team needs a public component catalog with rich docs and design review workflows.
- Custom playground maintenance cost exceeds expected value.
- Off-the-shelf tooling materially improves support for stateful JSON-driven form runtimes.
- A slim, single-purpose debugger (not a combined authoring studio) can be scoped and owned.

## 10. Lessons Learned From Removal

- Keep runtime correctness features in libraries first (`formspec-engine`, `formspec-webcomponent`); those survive UI churn.
- Do not combine authoring, component exploration, and replay/traceability into one product unless there is clear ongoing ownership.
- Deterministic replay value is highest in automated conformance and fixture-driven tests; manual UI tooling is optional.
- Route-level experience splitting improved clarity but did not justify maintaining a full standalone playground app in this cycle.
- For future tooling, ship a minimal vertical slice behind test coverage before investing in broad UX shell work.

## 11. References

- `packages/formspec-engine/` (runtime semantics + deterministic/control APIs)
- `packages/formspec-webcomponent/` (`<formspec-render>` runtime)
- `tests/e2e/fixtures/` (scenario fixtures)
- `tests/e2e/playwright/` (automation harness and runtime assertions)
- `schemas/definition.schema.json`
- `schemas/theme.schema.json`
- `schemas/component.schema.json`
- `schemas/mapping.schema.json`
- `schemas/response.schema.json`
- `schemas/validationReport.schema.json`
- `schemas/registry.schema.json`
- `schemas/changelog.schema.json`
- `specs/component/component-spec.llm.md`
- `specs/theme/theme-spec.llm.md`
- `specs/mapping/mapping-spec.llm.md`
- `specs/core/response-spec.llm.md`
- `specs/core/validation-report-spec.llm.md`
- `specs/registry/extension-registry.llm.md`
- `specs/registry/changelog-spec.llm.md`
- `specs/core/spec.llm.md`
