# 2026-04-29 Legacy/Compat Triage

## Scope

High-confidence compatibility surfaces from the finish plan:

- WOS:
  - `work-spec/studio/src/services/KernelToDesigner.ts`
  - `work-spec/crates/wos-authoring/src/raw.rs`
  - `work-spec/crates/wos-conformance/src/engine.rs`
  - `work-spec/crates/wos-runtime/src/companion.rs`
  - `work-spec/crates/wos-lint/src/rules/tier2.rs`
- Packages (high-confidence compat paths):
  - `packages/formspec-studio/src/components/chat/chat-thread-repository.ts`
  - `packages/formspec-react/src/screener/use-screener.ts`
  - `packages/formspec-layout/src/responsive.ts`
  - `packages/formspec-studio-core/src/layout-context-operations.ts`
- Packages (strict-behavior surfaces, explicit-stance wave 2026-04-29):
  - `packages/formspec-core/src/handlers/project.ts`
  - `packages/formspec-core/src/raw-project.ts`
  - `packages/formspec-types/src/widget-vocabulary.ts`
  - `packages/formspec-layout/src/theme-resolver.ts`
  - `packages/formspec-webcomponent/src/adapters/default/file-upload.ts`
  - `packages/formspec-react/src/defaults/fields/default-field.tsx`

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

### Packages strict-behavior stances (wave 2026-04-29)

All six files below are **KEEP** — they implement intentional strict behavior, not legacy debt. No compat shims warranted.

5. **`handlers/project.ts` — KEEP (handler pattern, any-typed payload by design)**
   - Command handlers use `any` for payload; payload types are enforced at the dispatch boundary in `RawProject._execute`. This is the correct seam; tightening handler signatures would require a generic overload cascade with no user value.

6. **`raw-project.ts` — KEEP (complete, correctly typed public surface)**
   - All public APIs on `RawProject` / `createRawProject` are fully typed. Internal `any` casts are confined to state-mutation paths where the command pipeline provides the type contract. No compat concern.

7. **`widget-vocabulary.ts` — KEEP (strict null return is spec-correct)**
   - `widgetTokenToComponent` returns `null` for unrecognized tokens. This is intentional: callers fall back to the `COMPATIBILITY_MATRIX` default for the item's `dataType`. Returning a default widget silently would hide authoring errors.

8. **`theme-resolver.ts` — KEEP (spec §7 warning + null return is correct)**
   - `resolveWidget` emits `console.warn` and returns `null` when the preferred widget and entire fallback chain are unavailable. Spec §7 requires this diagnostic. Caller handles null by using the dataType default.

9. **`file-upload.ts` (webcomponent) — KEEP (`formspec-file-drop-zone--active` is canonical)**
   - The drag-active modifier class is consistent across the WC adapter and the React adapter (`default-field.tsx`). No rename in flight; CSS themes should target this class.

10. **`default-field.tsx` — KEEP (CSS class parity with WC adapter confirmed)**
    - `FileUploadControl` uses `formspec-file-drop-zone--active` via React `isDragOver` state — identical modifier to the WC adapter. No divergence.

## Closure notes

- This triage records explicit keep-vs-sunset outcomes for all high-confidence paths in scope, including the wave 2 strict-behavior stances above.
- COMPLETE.md WS-083 wording verified 2026-04-29: `require_role` free function is absent from `wos-server/src` (`grep` clean); COMPLETE.md claim that it was removed during legacy cleanup is accurate. No doc-truth mismatch.
