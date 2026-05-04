# Platform repository architecture — chore plan

**Status:** Chore (executable). Not an ADR; no architectural decisions opened.
**Date:** 2026-05-01.
**Scope:** Repo hygiene across the Formspec org — meta-repo identity, WOS server relocation, duplicate-submodule removal, CI/`make test` alignment. Implements existing VISION leans; opens no new forks.

---

## 1. Why this is a chore, not an ADR

VISION already settles the architectural questions this work touches:

- **Per-layer release identity.** `VISION.md` Workflow Depth § release shape: *"Per-layer tags are the technical release lean. Formspec, WOS, and Trellis do not mature as one repository with one release train."* Repo hygiene that strengthens per-layer identity is implementation, not decision.
- **Center / adapter separation.** `VISION.md` Part B Evidence: *"Center and adapter stay separate."* `wos-server` is adapter machinery (composition root, ports, storage adapters per `wos-spec/crates/wos-server/VISION.md`); WOS spec is center semantics. Moving the server cluster out of the spec repo is this lean applied at the repo boundary.
- **`DurableRuntime` seam, Restate as default reference adapter.** `VISION.md` Durable Runtime. `wos-server-runtime-restate` exists *because* of this commitment. Co-locating it with other server adapters in `flowspec-server` is consistent.

What this chore does **not** do: open polyrepo, change byte authority, change release identity, or modify any cross-layer contract. The `../crates/fel-core` path coupling stays — `wos-spec` is honestly a workspace member of the Formspec checkout, and per-layer tags work fine inside that topology. If `fel-core` independent publication later becomes load-bearing (e.g., external WOS contributors blocked, second-implementation guard requires standalone build), that is a separate ADR with its own forcing function.

---

## 2. Diagnosis (verified evidence)

### 2.1 One Git root, several products

| Area | Location | Release identity |
|------|----------|-------------------|
| Formspec core | `specs/`, `schemas/`, `crates/`, `packages/`, `src/`, `tests/` | Cargo workspace, npm Changesets, PyPI |
| WOS | `wos-spec/` submodule, separate Cargo workspace | Per-layer tags |
| Trellis | `trellis/` submodule | Per-layer tags |
| Reference server | `wos-spec/crates/wos-server*` (9 crates) | Ships with WOS workspace today |
| Plugin | `.claude-plugin/` | Marketplace / local install |
| Hosting | `site/`, `functions/`, Firebase | Product ops |

### 2.2 Workspace coupling (intentional, not a bug)

`wos-spec/Cargo.toml:42` declares `fel-core = { path = "../crates/fel-core" }`. `wos-spec` assumes checkout layout `repo_root/wos-spec` adjacent to `repo_root/crates/fel-core`. **Submodule is a sync boundary, not a dependency boundary.** That is fine and stays. Per-layer tags work because tags are independent of repo topology.

### 2.3 CI vs `make test` drift

Root `.github/workflows/ci.yml` does not invoke `test-wos-spec` / `test-trellis`. Root `Makefile` `test:` target does (`Makefile`: `test: test-unit test-python test-rust test-scripts test-e2e test-studio-e2e test-wos-spec test-trellis`). Two greens exist. Decision: **CI expands to match `make test`.** A faster developer inner loop becomes a separate `make test-fast` target if friction warrants.

### 2.4 Plugin path coupling

Skills and agents embed repo-relative paths (`specs/...`, `wos-spec/...`). Moves break the plugin without regeneration. Out of scope for this chore — addressed separately if/when path rot bites in practice.

### 2.5 `formspec-internal` wrong-tree, wrong-org hazard

`formspec-internal/.gitmodules`:
```
[submodule "packages/formspec"]
    path = packages/formspec
    url = https://github.com/focusconsulting/formspec.git
```

This is not a duplicate of canonical `Formspec-org/formspec` — it is a **third-party fork remote** (`focusconsulting/formspec`). Wrong-tree hazard compounded by wrong-org hazard. Delete now; do not preserve under any rename.

---

## 3. Chore items

Each item is independently executable. Ordering reflects dependency, not phasing — anything with no upstream dependency can land in any order.

### 3.1 Delete stale `focusconsulting/formspec` submodule

In `formspec-internal`:
- `git rm packages/formspec`
- Remove the submodule entry from `formspec-internal/.gitmodules`
- Verify nothing in `formspec-internal` imports from `packages/formspec`
- Commit

No upstream dependency. Highest urgency item — it actively misleads any agent or engineer who finds it.

### 3.2 Move `wos-server*` cluster → `flowspec-server`

**Source:** `wos-spec/crates/wos-server*` (9 crates):
`wos-server`, `wos-server-ports`, `wos-server-sqlite`, `wos-server-postgres`, `wos-server-auth-jwt`, `wos-server-auth-mock`, `wos-server-runtime-local`, `wos-server-runtime-restate`, `wos-server-audit-postgres`.

**Target:** `flowspec-server/` (already a submodule of root, currently a husk containing only `STACK.md`).

**Stays in `wos-spec`:** `wos-core`, `wos-runtime`, `wos-lint`, `wos-export`, `wos-conformance`, `wos-formspec-binding`, agents, specs, studio.

**Mechanics:**
- `git mv` server crates from `wos-spec/crates/` to `flowspec-server/crates/`
- Drop moved crates from `wos-spec/Cargo.toml` `members`
- Add them to `flowspec-server/Cargo.toml` workspace
- `flowspec-server` deps on `wos-*` and `fel-core` use `path = "../wos-spec/crates/..."` and `path = "../crates/fel-core"` during this chore — same workspace-member topology `wos-spec` already uses; no new coupling story
- Move integration tests with the server crates; conformance/library tests stay in `wos-spec`
- Update root `Makefile`: add `build-flowspec-server`, `test-flowspec-server` analogous to existing wos/trellis targets
- Update `wos-spec` docs that reference "run the reference server" to point at `flowspec-server`

### 3.3 Rename `formspec-internal` → `formspec-workspace`

Naming: **`formspec-workspace`**, not `formspec-platform`. "Platform" is buyer-facing language already owned by `STACK.md`; the meta-repo is a developer workspace, not a product surface. Honest naming prevents the term collision.

**Mechanics:**
- GitHub repo rename (rely on GitHub URL redirects; verify CI dispatch URLs in any consumer pipelines)
- Update root `.gitmodules` `formspec-internal` entry
- Update any tracked links in `thoughts/`, `docs/`, READMEs (run `npm run docs:check` after)
- After 3.1 lands: meta-repo contains submodules, bootstrap scripts, private deploy notes — no canonical Formspec copy, no fork remote

### 3.4 Expand CI to match `make test`

Add `test-wos-spec` and `test-trellis` jobs to `.github/workflows/ci.yml`, gated on submodule init. Single definition of green: `make test` from a clean checkout.

If submodule test runtime makes the main CI lane uncomfortably slow, split into a parallel matrix job rather than narrowing the green bar.

---

## 4. Out of scope (named so they don't drift in)

- **`fel-core` independent publication.** Not opened. `wos-spec` and `flowspec-server` continue to consume `fel-core` via workspace-member `../` paths. Reopen as an ADR if a forcing function appears (external WOS contributor blocked, stranger-test guard needs standalone build, etc.).
- **Polyrepo end state.** Not a goal. The submodule layout *is* the topology; per-layer tags handle release identity inside it.
- **Directory banding inside public `formspec`** (e.g., `formspec/`, `modules/`, `plugins/`). Not pursued; current layout is functional.
- **Plugin path generation pipeline.** Out of scope. Path-coupled skills are tolerated until move-rot becomes operational friction.
- **`formspec-platform` as the meta-repo name.** Rejected (term collides with public stack framing in `STACK.md`).

---

## 5. Risk register (decision-specific)

| Risk | Mitigation |
|------|------------|
| GitHub repo rename breaks consumer CI dispatch URLs that don't follow redirects | Audit org repos and partner pipelines for hardcoded `formspec-internal` URLs before rename |
| `wos-server*` move breaks `wos-spec` consumers that depend on the server crates by path | Grep across the org for `wos-spec/crates/wos-server` paths; the `wos-server*` cluster is not a published library, so external impact should be near zero |
| Stale fork submodule (`focusconsulting/formspec`) referenced by an unknown private clone | Acceptable; the deletion is in `formspec-internal` history and reversible if anyone surfaces a need |
| CI runtime grows when submodule jobs are added | Parallel matrix; do not narrow the green bar |
| Submodule SHAs in root checkout point at pre-move `wos-spec` after 3.2 | Bump submodule SHA in the same commit that lands the move on the `wos-spec` side |

---

## 6. References

- `wos-spec/Cargo.toml:42` — `fel-core` workspace path coupling.
- Root `.gitmodules` — `wos-spec`, `trellis`, `formspec-internal`, `flowspec-server`.
- `formspec-internal/.gitmodules` — stale `focusconsulting/formspec` submodule.
- Root `Makefile` — `build`, `test`, `build-wos-spec`, `test-wos-spec`, `build-trellis`, `test-trellis` targets.
- `wos-spec/crates/wos-server/VISION.md` — server composition / adapters.
- `VISION.md` Part B (center/adapter, durable runtime) and Workflow Depth § release shape (per-layer tags).
- `thoughts/specs/2026-04-22-platform-decisioning-forks-and-options.md` — platform decision register; this chore opens no entries in it.
