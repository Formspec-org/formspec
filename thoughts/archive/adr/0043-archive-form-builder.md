# ADR 0043: Archive form-builder and Clean Up References

**Date:** 2026-03-11
**Status:** Approved
**Scope:** Remove form-builder from active development workspace and archive it for historical reference.

---

## Problem Statement

The `form-builder/` directory (Preact-based Formspec Studio v2) has been superseded by the new React 19-based `packages/formspec-studio/` greenfield implementation. The old package clutters the monorepo workspace, creates confusion about which Studio is active, and adds maintenance burden. We need to clean it up while preserving the code in version history.

---

## Decision

Archive `form-builder/` by:
1. Moving the directory to `archived/form-builder/`
2. Removing all references from active development (workspace definitions, npm scripts, CI/CD, documentation)
3. Adding a deprecation notice to its README
4. Removing any dependencies on it from the monorepo

---

## Implementation

### Phase 1: Discover All References
Scan the codebase for references to form-builder in:
- Root `package.json` (workspace definitions, scripts like `start:studio`, `test:studio:*`)
- `npm` workspace configuration
- CI/CD pipelines (`.github/workflows/`, if any)
- Documentation (root README, ADRs, architecture guides)
- TypeScript/JavaScript imports
- Build/tooling configs (Vite, TypeDoc configs)

### Phase 2: Remove References
- Delete form-builder from `package.json` workspaces array
- Remove npm scripts that start/test form-builder (e.g., `start:studio`, `test:studio:unit`, `test:studio:integration`, `test:studio:e2e`)
- Remove form-builder entries from CI/CD configs
- Remove form-builder links from documentation
- Remove any `form-builder` dependencies from other packages

### Phase 3: Archive Directory
- Create `archived/` directory in monorepo root (if it doesn't exist)
- Move `form-builder/` → `archived/form-builder/`
- Update the archived package's README with a deprecation notice:
  - Note that it's no longer maintained
  - Point users to `packages/formspec-studio/` as the active replacement
  - Explain it's preserved in git history for reference

### Phase 4: Verify
- Confirm `npm install` works
- Confirm monorepo builds without form-builder references
- Verify formspec-studio can still be developed/tested independently
- Spot-check documentation points to the right package

---

## Trade-offs

| Approach | Pros | Cons |
|----------|------|------|
| **Archive to `archived/`** (chosen) | Removes clutter, preserves history, clear intent, easy to unhide if needed | Takes a few minutes to move/update docs |
| **Delete completely** | Maximum cleanup | Loses access to code without git archaeology; risky if anyone references it |
| **Keep in place, mark deprecated** | Minimal changes | Continues to confuse workspace, no signal to developers that it's inactive |

---

## Success Criteria

- ✅ `form-builder/` removed from root monorepo
- ✅ All npm workspace references updated
- ✅ All npm scripts migrated or removed
- ✅ Documentation updated to reflect single active Studio
- ✅ `npm install` and build succeed
- ✅ `archived/form-builder/README.md` contains deprecation notice
- ✅ Git history preserved (code still accessible via `git log`)

---

## References

- Current form-builder: `/Users/mikewolfd/Work/formspec/form-builder/`
- Active replacement: `/Users/mikewolfd/Work/formspec/packages/formspec-studio/`
- Related PRD: `thoughts/PRD-v2.md`
- Studio documentation plan: `thoughts/formspec-studio/2026-03-05-studio-documentation-plan.md`
