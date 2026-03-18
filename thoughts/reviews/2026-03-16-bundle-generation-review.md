# Multi-Agent Code Review: ProjectBundle Generation

**Date**: 2026-03-16
**Feature**: Auto-generate ComponentDocument, ThemeDocument, MappingDocument from chat scaffold
**Branch**: `studiofixes`
**Reviewers**: 5 parallel agents (code quality, architecture, refactoring, test coverage, plan adherence)

---

## Verdict

**Plan executed correctly and completely.** All 5 planned files modified, all test scenarios covered, design decision (bundle in ChatSession, not adapter) followed precisely. Implementation is minimal (~33 new lines in chat-session.ts). 744 tests pass, zero regressions.

---

## Architecture: Sound

| Question | Finding |
|----------|---------|
| Is ChatSession the right place? | **Yes.** Adapter owns definition (creative LLM work), ChatSession owns bundle assembly (deterministic). |
| Dependency direction clean? | **Yes.** Strict downward acyclic: studio → chat → core → types. |
| `project.component` vs `export().component`? | **Correct.** `export()` returns authored tree (null for new). `project.component` merges generated tree. |
| Eager vs lazy rebuild? | **Eager is fine.** Build cost is negligible vs AI call latency. `getBundle()` returns cached result. |
| Serialization correct? | **Functionally yes, but redundant** — definition stored twice (standalone + inside bundle). See recommendations. |

---

## Issues Found

### Critical (1)

**Hardcoded API key in `main-chat.tsx`** — `GEMINI_API_KEY` is in source, committed to git, and will be in production builds via `chat.html` entry point. Move to `import.meta.env.VITE_GEMINI_DEV_KEY` with `.env.local`.

### High Priority (3)

1. **`buildBundle` has no error guard** — If `createRawProject` throws (degenerate definition from AI), it propagates as unhandled rejection. Wrap in try/catch, return definition-only fallback with error issue. *(Test Coverage agent)*

2. **Serialization redundancy creates consistency hazard** — `toState()` stores both `definition` and `bundle` (which contains definition). A bug could produce divergent state. **Recommendation**: Don't serialize bundle. Reconstruct from definition in `fromState()` via `buildBundle()`. Eliminates the entire class of sync bugs. *(Architecture + Scout agents agreed)*

3. **`ProjectBundle` re-export from formspec-chat is wrong module** — Consumers should import `ProjectBundle` from `formspec-core` (the canonical source), not through formspec-chat. Remove re-export. *(Scout agent)*

### Medium Priority (5)

4. **`exportJSON` name is misleading** — Returns a `FormDefinition` object, not JSON. Rename to `exportDefinition` or deprecate in favor of `getDefinition()` null-check. *(Scout agent)*

5. **Component tree tests are shallow** — Every test checks `tree !== null` but none verify the tree has nodes matching the definition's items. Would pass even if `buildBundle` used `export()` directly (null tree). Add structure assertions. *(Test Coverage agent)*

6. **`fromState` backward compat untested** — The `?? null` guard for legacy sessions without `bundle` field has no regression test. *(Test Coverage agent)*

7. **`shallowEqual` in `form-scaffolder.ts` over-reports diffs** — Choice fields with `options` arrays always show as "modified" because `===` on arrays returns false. Use deep equality or `JSON.stringify`. *(Scout agent)*

8. **Duplicated code across adapters** — `flattenItemKeys`, `makeDraftDefinition` (definition envelope), and `scaffoldFromTemplate` are identical in GeminiAdapter and MockAdapter. Extract shared. *(Scout agent)*

### Low Priority (4)

9. **`GeminiAdapter.isAvailable()` always returns true** — Interface says "check credentials". At minimum verify API key format. *(Scout agent)*

10. **`TemplateLibrary` class is over-abstracted** — Two methods wrapping a constant array. Two instances created. Flatten to exported functions. *(Scout agent)*

11. **`AppliedScaffold` type alias is dead code** — Exported from `form-scaffolder.ts`, imported by nobody. Delete. *(Scout agent)*

12. **`FormPreview` never consumes `state.bundle`** — Bundle flows through context but no UI component reads it yet. Expected (future step) but worth documenting. *(Test Coverage agent)*

---

## Test Gaps (Prioritized)

| Priority | Gap | Suggested Test |
|----------|-----|----------------|
| High | `createRawProject` throws on degenerate definition | Broken adapter → session handles gracefully |
| High | Legacy `fromState` without `bundle` key | Pass state without bundle field → `getBundle()` returns null |
| High | Full JSON round-trip preserves tree content | `store.save()` → `store.load()` → tree deep-equals original |
| Medium | `startFromTemplate` twice → bundle coherent with 2nd | Assert `bundle.definition.title` matches second template |
| Medium | Component tree has nodes for items | Check `tree.children.length > 0` |
| Medium | Bundle reactivity in ChatContext after refine | Context updates `has-bundle` after `sendMessage` |
| Low | FEL-bearing definitions (grant-application) | Explicit assertion that FEL expressions don't break bundle |

---

## Recommendations (Ranked)

1. **Move API key to env var** — Security fix, do immediately
2. **Don't serialize bundle** — Reconstruct in `fromState()`. Smaller storage, no sync bugs
3. **Guard `buildBundle` with try/catch** — Graceful fallback for degenerate definitions
4. **Extract `buildBundle` as module-level function** — Zero instance state, independently testable
5. **Remove `ProjectBundle` re-export** — Import from canonical source (`formspec-core`)
6. **Extract shared adapter code** — `flattenItemKeys`, definition envelope, template scaffold
7. **Add tree structure test assertions** — Verify nodes match items, not just `!== null`
