# 2026-04-29 Legacy/Compat Triage

## Scope

High-confidence compatibility surfaces from the finish plan:

- WOS:
  - `wos-spec/studio/src/services/KernelToDesigner.ts`
  - `wos-spec/crates/wos-authoring/src/raw.rs`
  - `wos-spec/crates/wos-conformance/src/engine.rs`
  - `wos-spec/crates/wos-runtime/src/companion.rs`
  - `wos-spec/crates/wos-lint/src/rules/tier2.rs`
- Packages:
  - `packages/formspec-studio/src/components/chat/chat-thread-repository.ts`
  - `packages/formspec-react/src/screener/use-screener.ts`
  - `packages/formspec-layout/src/responsive.ts`
  - `packages/formspec-studio-core/src/layout-context-operations.ts`

`P3-11` remains explicitly deferred and is out of this decision record.

## Decisions

### WOS compatibility paths

1. **`KernelToDesigner.ts` — KEEP (retained compatibility contract)**
   - Keeps old string `trigger` payloads round-trippable while canonical shape is typed `event`.
   - Removal precondition: prove no persisted designer graphs rely on string trigger decoding.
   - Risk if removed now: medium (older graph rehydration can break).

2. **`wos-authoring/src/raw.rs` — KEEP for now (sunset candidate later)**
   - `AddTransition` still accepts legacy string `event` and maps to typed `TransitionEvent`.
   - Sunset precondition: all authoring command producers emit only `event_typed`.
   - Risk if removed now: medium (command compatibility break).

3. **`wos-conformance/src/engine.rs` — KEEP (fixture/runtime bridge)**
   - Embedded-block extraction preserves downstream expectations for fixture companion docs.
   - Sunset precondition: conformance fixture corpus fully canonicalized with no interior-shape dependence.
   - Risk if removed now: medium (widespread conformance regressions).

4. **`wos-runtime/src/companion.rs` — KEEP (load-bearing runtime compatibility)**
   - Companion shape detection still supports migrated fixture routing semantics.
   - Sunset precondition: enforce canonical companion embedding and remove interior-shape consumption.
   - Risk if removed now: medium-high (policy evaluation drift).

5. **`wos-lint/src/rules/tier2.rs` (`iter_agents`) — SUNSET CANDIDATE**
   - Currently supports both array and legacy object `agents` forms.
   - Recommended follow-up wave:
     - emit/track diagnostics on legacy object form,
     - migrate fixtures/docs to array-only,
     - then remove object-form branch.
   - Risk if removed now: medium-high (lint behavior change across fixtures).

### Packages compatibility paths

1. **`chat-thread-repository.ts` — KEEP (resilience + storage compatibility)**
   - Enveloped session payload decoding and unknown payload preservation are intentional safety behavior.
   - Minor cleanup candidate: remove stale no-op comment in `clearAllLocalChatThreadScopes`.
   - Risk if removed now: medium (stored sessions can become unreadable).

2. **`use-screener.ts` — PARTIAL SUNSET CANDIDATE**
   - Keep route-type heuristic fallback and metadata/extensions normalization for now.
   - Sunset candidate portions:
     - `item.type` alias fallback to `item.dataType`,
     - `item.choices` alias fallback to `item.options`.
   - Sunset precondition: all authored screener docs validated to canonical fields.
   - Risk if removed now: medium.

3. **`responsive.ts` — KEEP (intentional behavior)**
   - Single-breakpoint merge fallback is a valid runtime behavior when numeric breakpoints are absent.
   - Not legacy debt by itself; retain unless spec/product forbids non-numeric maps.
   - Risk if removed now: low-medium (responsive regressions).

4. **`layout-context-operations.ts` (`selectionKeyFromNodeRef`) — KEEP for now, low-priority sunset candidate**
   - Legacy/test bridge when `layoutTargetKeys` is not populated.
   - Sunset precondition: all call sites always pass `layoutTargetKeys`.
   - Risk if removed now: low-medium (context menu selection edge cases/tests).

## Closure notes

- This triage records explicit keep-vs-sunset outcomes for all high-confidence paths in scope.
- The immediate doc-truth mismatch remains in `wos-spec/crates/wos-server/COMPLETE.md` for WS-083 wording, handled in the same closure wave.
