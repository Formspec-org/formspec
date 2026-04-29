# ADR 0061 Sidecar: Implementation Tasks

This sidecar tracks the implementation work proposed by [ADR 0061](./0061-current-state-authoring-runtime.md).

The goal is not to preserve the current implementation. The goal is to tighten `formspec-studio-core` around the runtime boundary it already wants to be.

## Exit Criteria

- built-in command wiring is explicit rather than import-driven
- public `ProjectState` is durable authoring data, not a mix of state and caches
- `Project` keeps its public API but is internally split into smaller runtime subsystems
- `batch()` and middleware semantics are intentional and tested
- registry initialization and runtime indexing are clearly separated

## Principles

- [x] Start each slice with one failing test that proves the current weakness
- [x] Work in repeated red-green increments, not one red followed by a large implementation pass
- [x] After the first green, add the next missing behavior as a new failing test, then make that pass, and repeat until the slice is covered
- [x] Treat TDD here as `red -> green -> red -> green -> ...` until each newly added high-level behavior has failed at least once before it ships
- [x] At a high level, every new function or materially changed runtime behavior should have had a red test at some point during implementation
- [x] Make the smallest change that fixes the current red before moving to the next behavior
- [x] Run the package test suite after each slice
- [x] Prefer deleting the old mechanism over layering abstractions on top of it
- [x] Document architectural decisions inline where the code changes, especially around handler wiring, state/runtime boundaries, and command execution semantics
- [x] Prefer short code comments and type/doc comments that explain invariants and ownership boundaries over leaving intent implicit
- [x] Be explicit only where the target shape is intentionally decided; when a real design choice remains open, record the choice to be made instead of inventing false certainty
- [x] Treat this as effectively greenfield architecture work: if a current shape is wrong, replace it rather than preserving it for compatibility
- [x] Do not let fear of downstream breakage freeze cleanup work; the main downstream consumer is still pre-release and can be refactored alongside this package when needed

## How To Use This Sidecar

- Treat each slice as an implementation brief, not a brainstorming prompt
- If a slice has a `Target End State` section, implement that shape directly unless a test or hard constraint proves it wrong
- If a slice has a `Decision Required` section, make one deliberate choice, document it inline, and update this file or the ADR rather than improvising silently
- Do not interpret “start with one failing test” as permission to stop adding failing tests once the first behavior is green
- Do not preserve a bad seam just because another pre-release package currently depends on it
- Do not preserve transitional abstractions once the new shape is in place
- Prefer changing fewer files with a cleaner end state over spreading compatibility shims across the package

## Slice 1: Make Built-in Command Wiring Explicit

### Goal

Remove module-load side effects from command registration.

### Target End State

- A built-in command table exists as plain module data or explicit factory output
- `Project` gets built-in handlers through explicit construction-time wiring
- steady-state command execution does not depend on top-level `registerHandler()` side effects
- command type strings and payload schemas stay unchanged

### Files Likely Involved

- [project.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/project.ts)
- [handler-registry.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/handler-registry.ts)
- [handlers.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/handlers.ts)
- [src/handlers/*](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/handlers)
- package tests that cover dispatch behavior

### Non-goals

- Do not rename command types
- Do not change command payload shapes
- Do not keep global registration alive behind a wrapper unless a test proves a temporary bridge is unavoidable
- Do not add a second registration mechanism alongside the first as a permanent compromise

### Tasks

- [x] Add a built-in command table module that exports the default command handlers as plain data
- [x] Change `Project` construction to receive built-in handlers explicitly instead of importing a self-registering aggregate
- [x] Remove the module-global registration map from the steady-state path
- [x] Keep command type strings unchanged
- [x] Add inline documentation in the new command table and `Project` wiring that explains why handler lookup is explicit and why import-time registration was removed
- [x] Keep all existing command tests passing without changing command payload shapes
- [x] Add a test proving that two `Project` instances do not share mutable handler registration state
- [x] Add a test proving that missing command handlers fail deterministically without relying on import order

### Done When

- [x] `Project` no longer depends on import-time registration side effects
- [x] built-in command lookup is explicit in code and easy to trace
- [x] there is one obvious place to inspect the built-in command catalog
- [x] deleting the old global registration path would not break steady-state execution

## Slice 2: Separate Durable State from Runtime Indexes

### Goal

Make public state more strictly JSON-native.

### Target End State

- `ProjectState` reads as durable authoring data
- runtime-only indexes and caches are private implementation details
- public queries still behave the same from a consumer point of view

### Files Likely Involved

- [types.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/types.ts)
- [project.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/project.ts)
- registry-related handler/query code
- tests covering state shape, registry behavior, and queries

### Non-goals

- Do not remove useful runtime indexes if they materially help query performance
- Do not push caches into consumer-managed code
- Do not redefine durable authoring data just to make the type graph smaller

### Decision Required

- Decide whether loaded registry documents themselves are part of durable project context or only project initialization context
- Decide whether any non-JSON-native structure still needs to appear in public state; if yes, document exactly why and treat it as an exception, not the default

### Tasks

- [x] Inventory every non-JSON-native structure currently exposed through `ProjectState`
- [x] Decide which registry data is durable authoring context and which pieces are runtime-only indexes
- [x] Move runtime-only lookup structures behind private fields or internal services
- [x] Keep public queries working without exposing those internals
- [x] Add inline documentation on any internal cache/index structure that remains, including why it is runtime-only and not part of the public state contract
- [x] Add a test that `project.state` is safe to `structuredClone`
- [x] Add a test that exported/project-seeded state does not require reconstructing hidden maps from the public shape

### Done When

- [x] `ProjectState` reads like durable authoring data rather than runtime internals
- [x] lookup acceleration still exists where needed, but no longer defines the public state contract
- [x] a reader can tell which data can be persisted and which data is reconstructed at runtime

## Slice 3: Split `Project` Internally Without Breaking the Public API

### Goal

Keep `Project` as the public boundary while reducing implementation sprawl.

### Target End State

- `Project` remains the public facade
- command execution, history/logging, normalization, and query/analysis support are no longer all implemented inline in one large class body
- subsystem ownership is visible from file/module boundaries and inline docs

### Files Likely Involved

- [project.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/project.ts)
- new private runtime modules under `src/` or a new `src/runtime/` area
- tests covering public API behavior

### Non-goals

- Do not split the public API into multiple consumer-facing manager objects
- Do not introduce abstraction layers that only forward calls without clarifying ownership
- Do not create a subsystem boundary unless it has a crisp responsibility

### Decision Required

- Choose whether private runtime subsystems should be separate modules, private collaborators, or both
- Choose names that describe ownership clearly; avoid generic names like `utils` or `manager`

### Tasks

- [x] Identify the current `Project` responsibilities and group them into runtime subsystems
- [x] Extract command execution into a private runtime helper or module
- [x] Extract history/logging into a private runtime helper or module
- [x] Extract normalization into a private runtime helper or module
- [x] Extract diagnostics/analysis composition into a private runtime helper or module where it simplifies `Project`
- [x] Extract registry indexing/query support into a private runtime helper or module if Slice 2 makes that natural
- [x] Keep the public `Project` surface unchanged unless a change is clearly worth the break
- [x] Add inline module/class documentation that states each subsystem's ownership clearly so responsibilities do not drift back into `Project`
- [x] Add or update tests only at the public API level unless a private helper becomes complex enough to justify direct unit coverage

### Done When

- [x] `Project` remains the public facade
- [x] the implementation no longer depends on one class owning every behavior directly
- [x] a new contributor can locate command execution, normalization, and history logic without reading the entire `Project` file

## Slice 4: Define Command Execution Semantics Deliberately

### Goal

Remove ambiguity around middleware and batch behavior.

### Target End State

- `dispatch()` semantics are explicit
- `batch()` semantics are explicit
- middleware behavior is intentional rather than accidental
- logging, notification, undo/redo, and failure behavior are tested against that contract

### Files Likely Involved

- [project.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/project.ts)
- related public type docs in [types.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/types.ts)
- batch/history/notification tests

### Non-goals

- Do not keep ambiguous semantics because multiple behaviors seem defensible
- Do not make `batch()` behavior differ from `dispatch()` in surprising ways without documenting why
- Do not add middleware hooks that exist only for theoretical future use

### Decision Required

- Decide whether middleware applies inside `batch()`
- Decide what log shape `batch()` produces
- Decide whether a failing command inside `batch()` aborts the whole batch atomically or can partially commit; if it is atomic, tests must prove it

### Tasks

- [x] Decide whether middleware applies to all command execution paths or only `dispatch()`
- [x] If middleware should apply to `batch()`, implement and test that behavior
- [x] If middleware should not apply to `batch()`, document and test that contract explicitly
- [x] Decide whether command logs should record batch as a synthetic wrapper event, expanded commands, or both
- [x] Add inline documentation near `dispatch()` and `batch()` describing the chosen semantics and why they differ or match
- [x] Add tests for logging, notifications, and history behavior under `batch()`
- [x] Add tests for failure behavior inside `batch()` so atomicity is explicit

### Done When

- [x] `dispatch()` and `batch()` semantics are intentional, documented, and covered by tests
- [x] there is no important execution behavior that still depends on reading implementation details to discover

## Slice 5: Clean Up Registry Loading and Initialization

### Goal

Treat registries as reference data with a clear loading seam.

### Target End State

- project creation and runtime registry loading follow one coherent model
- durable reference data and runtime lookup acceleration are clearly separated
- queries behave the same regardless of whether registries were seeded or loaded later

### Files Likely Involved

- [project.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/project.ts)
- registry-related handlers
- public registry-related types in [types.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/types.ts)
- tests covering creation-time and command-time loading paths

### Non-goals

- Do not turn registries into authored artifacts
- Do not special-case seeded registries and runtime-loaded registries if consumers cannot justify the difference
- Do not leave two inconsistent registry-loading paths in place

### Decision Required

- Decide the durable shape for loaded registry context, if any
- Decide what normalization, if any, happens at load time versus query time

### Tasks

- [x] Make registry seeding at project creation work consistently
- [x] Define whether seeded registries are stored exactly as loaded documents, normalized documents, or another durable form
- [x] Move registry lookup indexes behind internal runtime code if they are still public after Slice 2
- [x] Add inline documentation at registry load/index boundaries describing what is durable reference data versus runtime acceleration
- [x] Make registry-loading tests cover both seeded and command-loaded paths
- [x] Add a test proving seeded registries and runtime-loaded registries behave the same from the query surface

### Done When

- [x] registry initialization is unsurprising
- [x] reference data and runtime indexes are clearly separated
- [x] seeded and command-loaded registries are behaviorally aligned from the consumer view

## Slice 6: Tighten Runtime Contracts in Docs and Types

### Goal

Make the intended boundary obvious in code and documentation.

### Target End State

- important runtime boundaries are understandable from source alone
- type comments describe ownership and invariants accurately
- README/API docs match the implementation that now exists

### Files Likely Involved

- [README.md](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/README.md)
- [types.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/types.ts)
- [project.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/project.ts)
- any new runtime modules introduced in earlier slices

### Non-goals

- Do not move architectural meaning entirely into docs while leaving the source opaque
- Do not add long comments that restate obvious code
- Do not leave stale comments in place because “the code is correct now”

### Tasks

- [x] Update type comments to distinguish durable state from internal runtime machinery
- [x] Update README/API docs to describe the explicit handler model once Slice 1 lands
- [x] Document the `batch()` and middleware contract once Slice 4 lands
- [x] Remove stale comments that still describe import-time registration or mixed state/caching as the intended design
- [x] Add a brief architecture section that names the internal runtime subsystems after Slice 3 lands
- [x] Verify that the important architecture is understandable from the source files themselves without needing the ADR open beside them

### Done When

- [x] docs match the runtime we actually want to maintain
- [x] a reader can understand the important architecture from code comments, type docs, and module boundaries without having the ADR open

## Suggested Order

- [x] Slice 1 first
- [x] Slice 2 second
- [x] Slice 4 third if it blocks runtime semantics work, otherwise after Slice 3
- [x] Slice 3 once handler and state boundaries are cleaner
- [x] Slice 5 after the state/runtime split is in place
- [x] Slice 6 throughout, with a final cleanup pass at the end

## Out of Scope

- [x] changing command names or payload schemas without a separate reason
- [x] adding collaboration protocol features
- [x] adding UI state to core
- [x] splitting the package by artifact
- [x] turning runtime cleanup into a broad engine/studio unification project
