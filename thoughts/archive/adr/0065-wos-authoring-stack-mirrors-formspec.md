# ADR 0065: WOS Authoring Stack Mirrors Formspec

**Status:** Implemented — all 4 crates shipped with 1:1 Formspec layering. `wos-authoring` (25+ intent helpers, `WosProject` facade), `wos-mcp` (22 tools, dual-entry dispatch), `wos-synth-core` (synthesis loop + `Prompter` trait), `wos-synth-cli` (binary wiring). Minor: `McpToolContext` wiring and `wos-synth-spike` vestige remain.
**Date:** 2026-04-17
**Scope:** `work-spec/` submodule — crate architecture for authoring and AI integration
**Related:** [ADR 0064 (WOS granularity + AI-native positioning)](./0064-wos-granularity-and-ai-native-positioning.md), [ADR 0063 (Release trains by tier)](./0063-release-trains-by-tier.md)

## Context

The WOS submodule currently has four Rust crates: `wos-core` (model types, parser, AST), `wos-lint` (linter, 91 rules), `wos-conformance` (T3 runner, 6 rules), and `wos-runtime` (execution engine). These correspond to Formspec's foundational layers (types / engine).

Two AI-native deliverables are in scope per [ADR 0064](./0064-wos-granularity-and-ai-native-positioning.md) and resolved open-questions Q1:

1. A reference LLM-authoring harness (benchmarkable demonstration of Claim A).
2. Interactive agent-driven authoring (MCP tool surface for Claude Desktop / Cline users).

An initial plan scaffolded both deliverables as a single monolithic crate (`wos-synth`) gated by a `--features synth` Cargo feature. Architectural review on 2026-04-17 flagged two problems:

1. **Dependency inversion violation.** The authoring loop (business logic) was compile-time-coupled to a specific LLM provider (Anthropic SDK). A `--features` flag separates at compilation, not at crate boundaries — the right seam for DIP is across crate boundaries.

2. **Missing intermediate layers.** Parent Formspec's authoring stack has five layers above foundational types: `formspec-core` (state + commands + undo/redo), `formspec-studio-core` (intent-driven helpers), `formspec-mcp` (tool adapter, dual entry: stdio + in-process dispatch), `formspec-chat` (conversation loop). WOS's initial plan collapsed three of those layers (studio-core + mcp + chat) into one crate.

Formspec's layering is load-bearing for extensibility: each layer has a single responsibility, and each is independently consumable. `formspec-mcp` can be used without `formspec-chat`. `formspec-chat`'s `ToolContext` is host-injected — Studio can provide a local in-process tool surface; another host could provide a remote one. Similar flexibility is absent from the WOS monolithic plan.

## Decision

**The pressures enumerated in the following section ("WOS-specific pressures justifying each layer") are the load-bearing justification. The Formspec mirror is a reference pattern; the WOS pressures are the reason.**

### D-1. WOS adopts Formspec's layering verbatim for authoring / AI-native crates

The mapping:

| Formspec | WOS | Responsibility |
|---|---|---|
| `formspec-core` | `wos-core` (existing, minor growth needed) | Model types + low-level parser/serializer. Future: command pipeline + undo/redo if needed. |
| `formspec-studio-core` | `wos-authoring` (new) | Intent-driven authoring helpers: `add_state`, `add_transition`, `add_actor`, etc. Composes over `wos-core`. ≥25 helpers across lifecycle / actors / governance / AI. |
| `formspec-mcp` | `wos-mcp` (new) | Thin MCP adapter wrapping `wos-authoring` helpers as tool handlers. Dual entry: MCP stdio server (for external agents) + `dispatch()` in-process function (for internal consumers). |
| `formspec-chat` | `wos-synth-core` (rescoped) | Authoring loop orchestrator. Owns the `Prompter` trait (LLM provider abstraction) and `ToolContext` trait (how the loop invokes tools). |

### D-2. `wos-synth-core` splits along DIP boundaries into four crates

The monolithic scaffold at commit `2815e4d` is reshaped into:

| Crate | Role |
|---|---|
| `wos-synth-core` | Loop + `Prompter` trait + `ToolContext` trait + prompt templates. Pure business logic; no network, no LLM client, no runtime async executor in the default dep graph. |
| `wos-synth-anthropic` | Concrete `Prompter` via `anthropic-sdk`. Unconditional dep on LLM client. Separate crate, not a feature flag. |
| `wos-synth-mock` | Deterministic `Prompter` for tests / benchmarking. |
| `wos-synth-cli` | Binary wiring one `Prompter` + one `ToolContext`. Default binding: `wos-synth-anthropic` + `wos-mcp::dispatch`. |

### D-3. `ToolContext` is the seam between authoring loop and tool handlers

`wos-synth-core` never directly imports `wos-lint`, `wos-conformance`, or `wos-authoring`. It depends only on the `ToolContext` trait it defines. Production wiring in `wos-synth-cli` injects a `ToolContext` implementation backed by `wos-mcp::dispatch`. An optional stopgap implementation in `wos-synth-core/src/tool_context/direct.rs` wraps `wos-lint` + `wos-conformance` directly for the transition period before `wos-mcp` lands.

### D-4. `wos-mcp` serves both in-process and out-of-process callers

Mirrors `packages/formspec-mcp/src/dispatch.ts` which is explicitly documented as "in-process tool dispatch — call MCP tool handlers directly without network transport." The same Rust module exposes both. `wos-synth-core` talks to `wos-mcp` via in-process `dispatch()`; Claude Desktop talks to it via stdio JSON-RPC-2.0.

## WOS-specific pressures justifying each layer

This section is the direct answer to conceptual review Finding 3 (2026-04-17): the ADR's decision rationale must name the WOS-specific pressures that independently produce each layer, not rely on Formspec structural analogy alone.

### wos-core (existing)

**WOS pressure:** WOS documents must be parsed, validated, and serialized. This is uncontroversial — a model-types and parser layer exists in every specification-driven system. The existing `wos-core` crate covers this need without further justification.

### wos-authoring (new)

Four concrete WOS pressures produce this layer independently of any Formspec analogy:

1. **Atomic multi-command batches.** An LLM emitting "add state X + add transition X→Y + set Y terminal" via `wos-mcp` needs the sequence to roll back on mid-sequence validation failure. Without `wos-authoring`, every `wos-mcp` tool handler would have to manage its own transaction semantics — duplicated logic across 22+ tools. `wos-authoring` is the single place that owns atomicity.

2. **Undo/redo over batches.** `wos-bench` benchmarks N authoring attempts per problem. Between attempts, the harness must roll back to a clean state cheaply. Undo over a recorded command log is faster than re-parsing from disk and avoids round-tripping through the filesystem on every retry. This pressure is internal to `wos-bench` and has no Formspec equivalent (Formspec's undo exists for human Studio users; WOS's exists for benchmark reset).

3. **Intent-level helpers for LLM callers.** 28+ helpers like `add_rights_impacting_decision` compose 4–6 primitives each. An LLM makes one tool call instead of six sequential calls, each of which could fail and require recovery. This reduces the prompt-context surface for error handling and shrinks the validation-failure surface from six independent failure points to one. Without this layer, the composition logic would be duplicated across individual `wos-mcp` tool handlers.

4. **Forward-compatibility with a future wos-studio.** WOS may gain a visual editor (not in scope now, plausible later). `wos-authoring` is the layer that editor would consume. Building it now means that when a visual editor arrives, `wos-mcp` tool handlers do not need to be rewritten — the editor calls the same helpers. This pressure is speculative; pressures 1–3 above are concrete and sufficient on their own. If pressures 1–3 evaporate, re-evaluate whether the layer is still justified.

### wos-mcp (new)

Three concrete WOS pressures produce this layer:

1. **External agent authoring.** Claude Desktop, Cline, and any MCP-client agent needs a tool surface to mutate WOS documents. `wos-core`, `wos-lint`, and `wos-conformance` are Rust libraries with no protocol boundary. Someone must own protocol translation from MCP JSON-RPC-2.0 into Rust function calls. `wos-mcp` owns that translation and nothing else.

2. **Shared handler implementations between in-process and out-of-process callers.** `wos-synth-core`'s loop needs the same tool-call surface that external agents get. If `wos-mcp` handler implementations lived in `wos-synth-core`, external Claude Desktop sessions would get subtly different behavior from in-process benchmark runs. One crate owning handler implementations prevents that drift.

3. **Tool-catalog schema publication.** Vendors writing MCP clients need a stable, published schema catalog of what WOS tools offer. Owning that catalog in `wos-mcp` gives the publication a single home and decouples catalog updates from loop-logic changes.

### wos-synth-core (new, reshaped from monolithic wos-synth)

Three concrete WOS pressures produce this layer:

1. **Benchmarkable Claim A.** Q1 committed to Claim A (LLMs author WOS documents via schemas) being a falsifiable, reproducible metric. That requires a headless, batch-orientable authoring loop — something an interactive external agent (Claude Desktop) does not provide. `wos-synth-core` is that loop: it can be driven programmatically by `wos-bench` without a human in the seat.

2. **Provider-agnostic loop.** Vendors wanting to embed WOS authoring in their products need to ship their own LLM client (Anthropic, OpenAI, llama.cpp, self-hosted). If the loop crate unconditionally pulled in one provider's SDK, those vendors would either accept an unwanted transitive dependency or fork the loop. The `Prompter` trait seam lets them supply their own provider by implementing one trait.

3. **Offline and air-gapped deployments.** Some government and regulated users require the authoring loop to be available without HTTP clients in the dependency graph. Feature flags do not fully prevent this — dependency resolution still pulls transitive deps even for unused features. Crate boundaries do prevent it: `wos-synth-core` has no LLM client dep; only `wos-synth-anthropic` does.

### wos-synth-{anthropic,mock,cli} (new siblings)

Two concrete WOS pressures produce the split into sibling crates rather than a single binary:

1. **Pluggable providers without feature-flag explosion.** Multiple providers, each a separate crate, each implementing the `Prompter` trait. Adding a new provider is approximately 100 lines of code; removing one breaks only downstream binaries that explicitly named it. A feature-flag approach requires every downstream binary to opt out of providers it does not want; a crate-per-provider approach makes each provider opt-in by construction.

2. **CI speed and determinism.** `wos-synth-mock` lets `wos-bench` run in CI without API keys and with deterministic, zero-latency responses. Without a mock provider crate, CI either makes real LLM API calls (non-deterministic, costly, blocked by network policy) or skips benchmark runs entirely. Neither is acceptable for the "benchmark runs on every PR" goal.

### Summary

Each of the four new crates (`wos-authoring`, `wos-mcp`, `wos-synth-core`, `wos-synth-*`) is justified by at least one concrete, currently-active WOS pressure — not by Formspec analogy alone. The Formspec mirror is a reference pattern that shapes the mental model and lets contributors transfer muscle memory; it is not the causal justification. If the WOS pressures enumerated above evaporate (for example, Claim A is reversed, or no external-agent demand materializes), each affected crate should be re-scoped or folded, regardless of what Formspec does.

## Consequences

### Positive

- Each layer independently consumable. A vendor embedding WOS authoring into their product can use `wos-authoring` directly without pulling in MCP or LLM client. A user authoring via Claude Desktop doesn't need Rust-side LLM client code at all. A benchmark harness uses `wos-synth-mock` with no network.
- DIP is honored at crate boundaries, not feature flags. The loop crate stays pure and build-fast for tests. Provider churn (Anthropic SDK updates, new providers) doesn't cascade through the loop.
- Mirrors parent-repo mental model. Contributors familiar with `formspec-chat` / `formspec-mcp` / `formspec-studio-core` map onto WOS crates 1:1. Muscle memory transfers.
- Unblocks a future `wos-openai` / `wos-llamacpp` provider crate per [open-questions Q2](../../work-spec/thoughts/archive/reviews/2026-04-16-architecture-review-open-questions.md#q2-should-wos-synth-live-in-work-spec-or-a-sibling-repo) extraction trigger — each is ~100 LOC implementing `Prompter`.

### Negative

- More crates (four above foundational, up from one planned). More `Cargo.toml` churn during releases. Mitigated by Changesets `fixed` groups per `wos-synth-*` per ADR 0063 step 1.
- `wos-authoring` is genuinely new work not in the original plan (~2 engineer-weeks). Budget expanded accordingly.
- The scaffolded monolithic `crates/wos-synth/` at commit `2815e4d` is now either reshaped (code moves across crate boundaries) or renamed (`wos-synth` becomes `wos-synth-core`, feature flag removed, provider deps extracted to `wos-synth-anthropic`). Either path is ≤1 hour of work since the scaffold is ~200 LOC.

### Neutral

- Open-questions Q6 ("is synth and benchmark one project or two?") was resolved as "two crates sharing primitives." Under D-2, `wos-bench` depends on `wos-synth-core` + one provider (typically `wos-synth-mock` for CI or `wos-synth-anthropic` for real runs). The two-crate framing holds; the split just adds granularity around providers.

## Alternatives Considered

1. **Keep the monolithic `wos-synth` with `--features synth`.** Rejected per D-1's DIP argument. Feature flags are not dependency inversion; they're compile-time selection.

2. **Put `wos-mcp` tools directly over `wos-core`, skip `wos-authoring`.** Rejected because `wos-mcp`'s 20+ tool handlers would each need to re-implement intent-to-primitives translation, duplicating ~25 helpers' worth of logic across the tool surface. Formspec explicitly avoided this: studio-core exists because MCP tools needed somewhere to call. Same answer here.

3. **Extend `wos-core` with the authoring helpers, merge `wos-authoring` into `wos-core`.** Rejected because `wos-core` is the ratified model-types layer; mixing it with intent-driven authoring helpers violates the "layer = single responsibility" pattern the decision is anchored in.

4. **Fold `wos-mcp` and `wos-synth-core` into a single crate (since both are authoring interfaces).** Rejected because their consumers differ fundamentally: `wos-mcp` serves external agents via stdio; `wos-synth-core` hosts an in-process loop driving an LLM via Rust code. Different async models, different dep graphs, different release cadence. Formspec separates them for the same reason.

## References

- Open questions Q1, Q2, Q6 — [resolved 2026-04-17](../../work-spec/thoughts/archive/reviews/2026-04-16-architecture-review-open-questions.md).
- Plans affected: `work-spec/thoughts/plans/2026-04-16-wos-synth-crate.md` (rewritten), `work-spec/thoughts/plans/2026-04-17-wos-authoring-crate.md` (new), `work-spec/thoughts/plans/2026-04-17-wos-mcp-crate.md` (new).
- Formspec prior art (verbatim layer mapping target):
  - `packages/formspec-core/README.md` — `RawProject` + IProjectCore + commands + pipeline.
  - `packages/formspec-studio-core/README.md` — `Project` class + authoring helpers over IProjectCore.
  - `packages/formspec-mcp/src/dispatch.ts` — dual-entry dispatch pattern.
  - `packages/formspec-chat/README.md` — conversation loop + AIAdapter + ToolContext.
