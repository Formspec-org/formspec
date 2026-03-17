# Phase 3: Independent Sanity Check

**Date:** 2026-03-17
**Reviewer model:** opus (no codebase access)

## Key Pushback

### S1 (multichoice flattening) — Better design needed
- Caller-provided `repeatGroupPaths: Set<string>` is fragile. What if someone adds a call site and forgets?
- **Better:** Pass the definition (or type-lookup function) and check item type directly. The data model already knows which items are multichoice vs repeat groups. Use it at the point of flattening.

### S2 (path resolution) — Define the contract, don't strip prefixes
- Prefix stripping is dangerous. `address.address_line1` with `parentPath="address"` could mangle.
- **Better:** Clarify API contract: path is always relative when parentPath is provided. Don't guess.

### S3 (bind path validation) — Should live in core, not studio-core
- If path validation only exists in studio-core, anyone using core directly can still create phantom binds.
- **Move to core handlers.** Studio-core should be convenience, not a correctness layer.

### S5 (overwrite warnings) — Skip
- Warning fatigue. Users calling `require()` twice on the same target intend to overwrite.
- Document precedence instead.

### SCH1 (Route message) — Defer significantly
- High cascade cost (schema → types → core → studio-core → MCP) for a speculative feature.

### C4 (screener stats) — Defer
- No clear consumer. Does anyone use these numbers?

### S4 (circular variables) — Do it properly or don't bother
- Self-reference check alone is a half-measure. Indirect cycles (`x→y→x`) not caught.
- Either implement full cycle detection or skip.

## Systemic Patterns Identified

### Pattern A: Two representations of the same thing
C3 (authored vs effective component), S1 (multichoice vs repeat arrays), S2 (absolute vs relative paths). **Missing principle:** every data has one canonical representation; transformation at a defined boundary.

### Pattern B: Validation in the wrong layer
S3, S4 are correctness invariants proposed for studio-core. Should be in core handlers — anyone using core directly bypasses studio-core validation.

### Pattern C: Discoverability via documentation vs design
E2, M3 — patching ambiguous APIs with descriptions. Short-term fine; medium-term, audit functions users get wrong.

## Risk Assessment

| Fix | Risk | Verdict |
|-----|------|---------|
| E1 (null semantics) | Low | **Ship immediately** |
| C1 (variables in parse result) | Low | **Ship immediately** |
| C3 (export component tree) | Low | **Ship immediately** (grep for other readers first) |
| M1 (remove_rule) | Low | Ship |
| S1 (multichoice flatten) | High → Medium with better design | **Ship with type-lookup approach** |
| S2 (path resolution) | Medium | Ship carefully, define contract |
| E2 (catalog metadata) | Medium | Ship (prerequisite for C2) |
| C2 (function validation) | Medium | Ship after E2 |
| S3 (path validation) | Medium | Consider moving to core |
| S4 (circular vars) | Medium | Do properly or skip |
| S5 (overwrite warnings) | Low | **Skip** |
| C4 (screener stats) | Low | Defer |
| M2 (changelog) | Low | Defer |
| M3 (descriptions) | Low | Opportunistic |
| SCH1 (Route message) | Medium | **Defer significantly** |

## Top 3 If Limited

1. **E1** — One-line spec compliance fix. Zero risk. 10 minutes.
2. **S1** — Highest user impact (2 bugs, 3 personas). Use type-aware approach.
3. **C3** — Export producing wrong output is data-loss-adjacent. One-line fix.
