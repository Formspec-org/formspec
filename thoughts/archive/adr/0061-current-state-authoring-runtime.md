# ADR 0061: Tighten `formspec-studio-core` Around a Headless Authoring Runtime

## Status

Implemented — all 10 architectural changes and 6 implementation slices complete. `builtinHandlers` frozen static map, JSON-native state (`Record<string, unknown>`), `RawProject` decomposed (682 lines from 2,346), `CommandPipeline` extracted, batch/middleware unified, registry loading seam (`indexRegistryPayload`). See sidecar for per-slice evidence.

## Date

2026-03-11

## Context

`formspec-studio-core` already behaves like a standalone authoring runtime. It has its own data model, command protocol, lifecycle, query surface, diagnostics, history, and export behavior.

That is good directionally, but the package still carries several implementation choices that are weaker than the runtime boundary it is trying to establish.

The package is attempting to serve multiple long-term consumers:

- visual editors
- CLI tools
- import/export pipelines
- codemods and migrations
- LLM/agent workflows
- tests and fixtures

Those consumers share one need: they must edit a bundle of related Formspec artifacts while preserving cross-artifact consistency.

The core authoring bundle currently includes:

- `definition`
- `component`
- `theme`
- `mapping`
- loaded extension registries
- versioning state

The package already excludes consumer-specific UI state such as selection, panels, viewport state, and local presentation behavior. That boundary should be kept.

## Problem

The current package direction is mostly right, but four parts of the design should be tightened if `formspec-studio-core` is going to be the long-term authoring core for editors, CLI tools, agents, and automation:

1. the package boundary is command-oriented, but command registration is global and import-driven
2. the runtime state is mostly JSON-native, but some derived indexing structures leak into the public model
3. the `Project` class owns the right lifecycle, but it risks becoming the only place every concern accumulates
4. the package presents itself as the canonical runtime, but the contract between protocol, durable state, and internal caches is not yet explicit enough

## Decision

We will keep the current direction, but tighten the architecture around it.

`formspec-studio-core` should remain the canonical headless authoring runtime for Formspec artifact bundles, and we should make the following changes to support that position.

## Proposed Changes

### 1. Keep `Project` as the public boundary

We should keep the current `Project`-based runtime model instead of flattening the package into exported mutation helpers.

Consumers should continue to work through:

- `dispatch(command)`
- `batch(commands)`
- `undo()` / `redo()`
- `onChange(listener)`
- query helpers
- diagnostics and export helpers

#### Why

This is already the strongest part of the package. It gives every consumer the same atomic editing model, the same history semantics, and the same cross-artifact lifecycle. Reverting to a helper-library model would make downstream tools rebuild the same machinery differently.

### 2. Keep commands as the primary mutation contract

All durable edits are expressed as serializable command objects with stable `type` strings and payloads.

This command protocol should remain the main integration boundary for:

- replay
- logging and auditing
- scripting
- transport between processes
- LLM/agent generation
- future collaboration layers

Method calls exist to execute commands, but commands should remain the durable data contract.

#### Why

This is the part of the design that scales best to non-UI consumers. It also gives the package a protocol surface that can be validated, logged, replayed, and eventually versioned.

### 3. Keep lifecycle ownership in core, not in adapters

The package owns the full mutation lifecycle:

1. clone current state
2. apply a command handler to the clone
3. rebuild derived component structure when required
4. normalize cross-artifact invariants
5. update history and command log
6. notify listeners

These behaviors should stay in core. A consumer should not have to reimplement normalization, tree rebuild, or history semantics just to author Formspec bundles correctly.

#### Why

Cross-artifact synchronization is part of authoring correctness. If consumers own it, the package stops being the authoring core and becomes just a command runner.

### 4. Keep consumer UI state out of core

The package should continue to own:

- artifact editing
- cross-artifact synchronization
- query helpers
- expression analysis
- diagnostics
- versioning and publishing behavior
- extension-registry loading as reference data

The package should continue not to own:

- selection
- inspector state
- preview width
- mobile layout state
- component-framework bindings

#### Why

This is the cleanest boundary between authoring semantics and interface behavior. It keeps the runtime usable from a browser, a CLI, a test, or an agent without dragging in consumer state that has no shared meaning.

### 5. Make public state more strictly JSON-native

We should treat `ProjectState` as durable authoring data and move derived indexes and lookup accelerators out of the public state model wherever practical.

That means:

- keep serialized artifacts and versioning data in `ProjectState`
- keep loaded registry source documents in `ProjectState` only if they are part of the durable authoring context
- move maps, catalogs, and other lookup-oriented indexes behind internal runtime fields or explicit query services
- avoid exposing internal cache shapes as part of the stable author-facing state contract

#### Why

The package is trying to be command-driven and serializable. Public state should reinforce that. If public state contains runtime indexing details, the package sends mixed signals about what is durable, what is portable, and what can be persisted or diffed.

### 6. Replace the global self-registering handler registry with an explicit built-in command table

We should remove import-time self-registration as the long-term handler model.

Instead:

- built-in handlers should live in a static command table or registry object
- `Project` should receive that built-in table explicitly
- future custom handlers or command packs should be passed in through explicit construction options rather than module-global mutation

This does not require making command extension a first-class public feature immediately. It does require stopping the architecture from depending on hidden global registration.

#### Why

The current global registry works, but it is the weakest part of the design:

- it introduces module-level mutable state
- it relies on import side effects
- it makes isolation harder
- it complicates testing and future extensibility
- it weakens the claim that each `Project` instance is fully independent

An explicit built-in command table is simpler and more honest.

### 7. Split `Project` internally into small runtime subsystems without changing the public API

We should keep the public `Project` API, but internally separate concerns such as:

- command execution
- history/logging
- normalization
- diagnostics/analysis
- query helpers
- extension registry indexing

That can happen with private modules or private collaborators. It does not require a public API breakup.

#### Why

`Project` is the right public abstraction, but it should not become the only implementation container for every behavior. Internal subsystem boundaries will make the runtime easier to evolve without turning the class into a monolith.

### 8. Define `batch()` and middleware semantics more strictly

We should decide and document whether middleware is policy over all command execution or only over single-command dispatch.

If middleware is meant to enforce policy, authorization, logging, or command transformation, then `batch()` should not bypass it.

If `batch()` is intentionally lower-level, that should be explicit and stable, not incidental.

#### Why

Right now this is the sort of behavior that is easy to leave undefined until it becomes a real bug. Since the package wants to be the long-term authoring runtime, command execution semantics need to be intentional.

### 9. Treat registries as reference data with a cleaner loading seam

We should make registry loading and initialization consistent:

- support explicit registry seeding at project creation
- keep registry documents as reference data, not authored artifacts
- build any indexes needed for lookup internally
- avoid mixing “registry documents as durable context” with “runtime catalogs as state”

#### Why

Registries matter to authoring, but they are not authored by this runtime. Treating them clearly as reference data will keep the package boundary coherent and make initialization behavior less surprising.

### 10. Keep diagnostics and queries on-demand

Derived information is pulled when needed rather than maintained as framework-specific reactive state.

This should continue to keep the package:

- framework-agnostic
- easier to use in scripts and tests
- deterministic per call
- free to support multiple consumer reactivity models

#### Why

This is still the right tradeoff. The package should not grow its own reactive graph just to support consumer convenience.

## Rationale

### Why keep the runtime model

A pure mutation library is a good extraction technique, but it is a weaker long-term product boundary.

For the package we are actually building, a runtime is better because it centralizes the things every serious consumer needs anyway:

- atomic edits
- consistent normalization
- command logging
- undo/redo
- subscription hooks
- analysis and diagnostics

If those concerns live outside the package, every consumer rebuilds them differently and authoring semantics drift.

### Why prefer explicit runtime structure over hidden globals

The package wants to be multi-instance and framework-agnostic. Hidden global registration works against that. The cleaner shape is:

- explicit durable state
- explicit command protocol
- explicit built-in runtime wiring
- internal caches that are not confused with user-owned state

That shape is easier to embed, test, and extend.

### Why commands instead of ad hoc methods

Commands are more verbose than direct methods, but they scale better for:

- remote execution
- persistence
- schema validation
- discoverability
- changelogging
- machine generation

This is especially important for CLI and LLM-driven workflows, where "edits as data" are more valuable than a convenience-oriented OO surface.

### Why keep multiple artifacts together

In practice, `definition`, `component`, `theme`, and `mapping` are not independent editing domains. Renames, deletions, imports, publishes, and validations span artifact boundaries.

A single runtime that owns the full bundle is simpler and safer than several artifact-specific editors with external orchestration glue.

### Why keep UI state out

UI state is consumer-specific and unstable across products. Putting it in core would pollute the runtime with concerns that have no meaning for CLI tools, tests, or agents.

## Consequences

### Positive

- `formspec-studio-core` keeps a clear identity as the authoring runtime for Formspec bundles.
- Consumers can share one mutation and analysis model without sharing a UI framework.
- Commands remain a durable protocol that can be logged, replayed, and generated.
- Cross-artifact rules stay enforced in one place.
- The package becomes easier to isolate and extend once handler wiring is explicit.
- The boundary between durable data and runtime caches becomes clearer.

### Negative

- The package is heavier than a small library of pure helpers.
- The runtime still requires discipline to prevent `Project` from becoming a "god object".
- Command schemas and handlers must be maintained carefully because they now represent a protocol, not just local implementation details.
- Moving away from global registration will require touching command wiring across the package.
- Tightening the public state boundary may require small API breaks before the package is widely adopted.

### Migration cost we accept

- We will have to rewrite handler wiring rather than layering abstractions on top of the current registry.
- We may need to move some currently public state shapes behind internal runtime fields.
- We may need a short migration window while command execution and middleware semantics are clarified.

## Rejected Alternatives

### 1. Keep `formspec-studio-core` as only an extracted mutation library

Rejected because it undershoots what consumers actually need. It would force each downstream tool to rebuild lifecycle, history, normalization, and diagnostics around the same low-level functions.

### 2. Keep the current implementation exactly as-is

Rejected because the current implementation already shows where the long-term architecture is weaker than the intended boundary, especially around handler registration, public state purity, and internal subsystem structure.

### 3. Make another consumer package the primary runtime and keep this package as a helper

Rejected because it would keep the authoring model coupled to one UI product and one reactivity system.

### 4. Split editing by artifact into separate packages

Rejected because the hardest and most important authoring behaviors are cross-artifact. Splitting too early would move complexity into orchestration code and weaken correctness.

## Implementation Notes

This ADR proposes architectural cleanup, not a preservation plan for every current implementation detail.

The preferred implementation order is:

1. make built-in handler wiring explicit
2. separate durable state from internal indexes/caches
3. split internal `Project` responsibilities into smaller private subsystems
4. define batch and middleware semantics deliberately
5. keep the public runtime boundary stable while those internals are cleaned up

## Review Trigger

Revisit this ADR if any of the following become true:

- custom command sets need per-project isolation
- collaboration or remote execution requires stricter protocol/version guarantees
- public `ProjectState` drifts away from JSON-native authoring data
- `Project` becomes too large to evolve coherently without internal subsystem boundaries
