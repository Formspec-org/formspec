# 2026-03-22 Large File Breakup Review

## Current Status

This note supersedes the earlier version from the same date. The repo changed after the first pass, so the target set and recommendations were refreshed against the current workspace.

Completed since the first pass:

- `crates/formspec-eval` was split into focused modules and test files.
- `crates/formspec-py/src/lib.rs` was split into `convert`, `fel`, `document`, `registry`, `changelog`, `mapping`, and `native_tests`.
- `crates/formspec-wasm/src/lib.rs` was split into focused modules plus `wasm_tests`.
- `crates/formspec-core/src/runtime_mapping.rs` was split into `runtime_mapping/*`.
- `crates/formspec-core/src/registry_client.rs` was split into `registry_client/*`.
- `packages/formspec-engine/src/index.ts` was reduced to a thin barrel; the remaining engine hotspots moved to `src/engine/FormEngine.ts` and `src/engine/helpers.ts`.

## Scope

The current scan covers `rs`, `ts`, `js`, and `py` files longer than 500 lines, excluding:

- `archived/`
- test directories and common test file patterns
- generated files under `*/generated/*`
- files under `*/wasm-pkg/*`
- files under `examples/`

Command:

```bash
scripts/find-large-code-files.sh 500
```

Script:

- [scripts/find-large-code-files.sh](/Users/mikewolfd/Work/formspec/scripts/find-large-code-files.sh)

## Current In-Scope Files

```text
3122  packages/formspec-studio-core/src/project.ts
1747  crates/fel-core/src/evaluator.rs
1512  crates/formspec-lint/src/pass_theme.rs
1240  crates/formspec-lint/src/pass_component.rs
1134  packages/formspec-engine/src/engine/FormEngine.ts
1128  crates/formspec-core/src/assembler.rs
1092  crates/fel-core/src/parser.rs
1062  crates/formspec-core/src/fel_analysis.rs
956   packages/formspec-layout/src/planner.ts
955   src/formspec/validate.py
928   crates/formspec-lint/src/lib.rs
884   crates/formspec-lint/src/references.rs
868   packages/formspec-webcomponent/stories/src/stories.ts
822   crates/formspec-lint/src/expressions.rs
818   packages/formspec-engine/src/engine/helpers.ts
769   crates/formspec-core/src/fel_rewrite_exact.rs
745   crates/formspec-core/src/changelog.rs
701   packages/formspec-core/src/handlers/definition-items.ts
673   packages/formspec-core/src/types.ts
658   crates/fel-core/src/extensions.rs
621   crates/formspec-core/src/schema_validator.rs
603   crates/formspec-lint/src/schema_validation.rs
582   packages/formspec-webcomponent/src/components/layout.ts
577   crates/formspec-core/src/extension_analysis.rs
555   packages/formspec-chat/src/chat-session.ts
542   crates/fel-core/src/lexer.rs
540   src/formspec/_rust.py
536   crates/fel-core/src/environment.rs
532   crates/formspec-lint/src/extensions.rs
521   packages/formspec-mcp/src/create-server.ts
518   packages/formspec-engine/src/wasm-bridge.ts
504   crates/fel-core/src/types.rs
```

## Recommendations

### [packages/formspec-studio-core/src/project.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/project.ts)

- Split into `project-shared.ts`, `project-definition.ts`, `project-rules.ts`, `project-pages.ts`, `project-presentation.ts`, and `project-interop.ts`.
- Keep `project.ts` as the public `Project` facade.

### [packages/formspec-engine/src/engine/FormEngine.ts](/Users/mikewolfd/Work/formspec/packages/formspec-engine/src/engine/FormEngine.ts)

- Keep shrinking it toward a true facade over the modules that already exist: `definition-setup.ts`, `response-assembly.ts`, `reactive-patches.ts`, `repeat-ops.ts`, `wasm-fel.ts`, and `init.ts`.
- The remaining seam is method ownership: move response/report building, runtime replay/snapshot logic, and any remaining evaluation/setup orchestration out of the class body into domain modules, then leave `FormEngine.ts` with constructor wiring and the public API surface.

### [packages/formspec-engine/src/engine/helpers.ts](/Users/mikewolfd/Work/formspec/packages/formspec-engine/src/engine/helpers.ts)

- Split by helper domain instead of keeping one utility grab bag.
- Recommended modules: `coercion.ts` for value/data-type coercion, `paths.ts` for path and nested-value helpers, `repeats.ts` for repeat snapshots/aliases, `fel-paths.ts` for FEL-relative rewrite helpers, and `runtime.ts` for validation/result conversion plus `now` handling.
- Keep `helpers.ts` as a temporary barrel only if import churn would otherwise be too high.

### [crates/fel-core/src/evaluator.rs](/Users/mikewolfd/Work/formspec/crates/fel-core/src/evaluator.rs)

- Split into `evaluator/{environment,paths,operators,functions/{mod,scalar,domain}}.rs`.
- Keep shared state on `Evaluator`; do not invent new service abstractions.

### [crates/formspec-lint/src/pass_theme.rs](/Users/mikewolfd/Work/formspec/crates/formspec-lint/src/pass_theme.rs)

- Split into `pass_theme/{tokens,token_refs,pages,definition_links,tests}.rs`.
- Use rule-family boundaries, not generic helper buckets.

### [crates/formspec-core/src/assembler.rs](/Users/mikewolfd/Work/formspec/crates/formspec-core/src/assembler.rs)

- Split into `assembler/{refs,traversal,imports,rewrite,path_ops}.rs`.
- Keep rewrite semantics centralized around `FelRewriteMap`.

### [crates/formspec-lint/src/pass_component.rs](/Users/mikewolfd/Work/formspec/crates/formspec-lint/src/pass_component.rs)

- Split into `pass_component/{catalog,field_lookup,custom_components,walker,rules,tests}.rs`.
- Pull rule bodies out of `walk_node` before deeper decomposition.

### [crates/fel-core/src/parser.rs](/Users/mikewolfd/Work/formspec/crates/fel-core/src/parser.rs)

- Split into `parser/{control_flow,operators,primary,references,tests}.rs`.
- Prefer multiple `impl Parser` blocks over new parser abstractions.

### [crates/formspec-core/src/fel_analysis.rs](/Users/mikewolfd/Work/formspec/crates/formspec-core/src/fel_analysis.rs)

- Split into `fel_analysis/{types,path_codec,analyze,targets,rewrite}.rs`.
- Centralize field-path string encoding before moving walkers.

### [packages/formspec-layout/src/planner.ts](/Users/mikewolfd/Work/formspec/packages/formspec-layout/src/planner.ts)

- Split into `planner/{component-planner,definition-planner,page-mode,theme-pages,path-lookup,node-utils}.ts`.
- Extract page-mode policy early; it is the most duplicated and fragile area.

### [src/formspec/validate.py](/Users/mikewolfd/Work/formspec/src/formspec/validate.py)

- Split into `validation/{models,discovery,passes/{linting,runtime,analysis},reporting}.py`.
- Keep `validate.py` as the public facade and CLI entrypoint.

### [crates/formspec-lint/src/lib.rs](/Users/mikewolfd/Work/formspec/crates/formspec-lint/src/lib.rs)

- Split into `pipeline.rs`, `pipeline_definition.rs`, and `pipeline_finalize.rs`.
- Move tests out of `lib.rs` and keep `lib.rs` as a thin facade.

### [crates/formspec-lint/src/references.rs](/Users/mikewolfd/Work/formspec/crates/formspec-lint/src/references.rs)

- Split into `references/{binds,shapes,option_sets,path_resolution,tests}.rs`.
- Make path resolution the shared API for binds and shapes.

### [packages/formspec-webcomponent/stories/src/stories.ts](/Users/mikewolfd/Work/formspec/packages/formspec-webcomponent/stories/src/stories.ts)

- Split into `story-support.ts` plus `layout.stories.ts`, `input.stories.ts`, `display.stories.ts`, `interactive.stories.ts`, and `special.stories.ts`.
- Keep `stories.ts` as the thin index.

### [crates/formspec-lint/src/expressions.rs](/Users/mikewolfd/Work/formspec/crates/formspec-lint/src/expressions.rs)

- Split into `expressions/{model,parse,binds,shapes,variables,screener}.rs`.
- Keep `try_parse` and E400 emission in one shared place.

### [crates/formspec-core/src/fel_rewrite_exact.rs](/Users/mikewolfd/Work/formspec/crates/formspec-core/src/fel_rewrite_exact.rs)

- Split into `fel_rewrite_exact/{template,parser,rewrite_handlers,text}.rs`.
- Keep the precedence parser together; do not over-split by operator level.

### [crates/formspec-core/src/changelog.rs](/Users/mikewolfd/Work/formspec/crates/formspec-core/src/changelog.rs)

- Split into `changelog/{types,items,binds,collections,top_level}.rs`.
- Preserve change ordering exactly during extraction.

### [packages/formspec-core/src/handlers/definition-items.ts](/Users/mikewolfd/Work/formspec/packages/formspec-core/src/handlers/definition-items.ts)

- Split into `definition-item-{tree,factory,references,artifact-sync,rules}.ts`.
- Reduce `definition-items.ts` to handler orchestration.

### [packages/formspec-core/src/types.ts](/Users/mikewolfd/Work/formspec/packages/formspec-core/src/types.ts)

- Split into `schema-types.ts`, `project-state.ts`, `command-types.ts`, `query-types.ts`, `fel-types.ts`, `diagnostic-types.ts`, and `versioning-types.ts`.
- Keep `types.ts` as a compatibility barrel.

### [crates/fel-core/src/extensions.rs](/Users/mikewolfd/Work/formspec/crates/fel-core/src/extensions.rs)

- Split into `extensions/{catalog/{mod,core,domain},error,registry,tests}.rs`.
- Isolate the large built-in catalog from the small runtime registry logic.

### [crates/formspec-core/src/schema_validator.rs](/Users/mikewolfd/Work/formspec/crates/formspec-core/src/schema_validator.rs)

- Split into `schema_validator/{document_type,types,dispatch,component_plan,paths}.rs`.
- Keep document taxonomy as a single source of truth.

### [crates/formspec-lint/src/schema_validation.rs](/Users/mikewolfd/Work/formspec/crates/formspec-lint/src/schema_validation.rs)

- Split into `schema_validation/{schemas,diagnostics,component_schema,component_nodes,tests}.rs`.
- Keep the current shallow-envelope plus per-node validation algorithm intact.

### [packages/formspec-webcomponent/src/components/layout.ts](/Users/mikewolfd/Work/formspec/packages/formspec-webcomponent/src/components/layout.ts)

- Split into `layout/primitives.ts`, `layout/accordion.ts`, and `overlay/{positioning,modal,popover}.ts`.
- Preserve focus return, `Escape`, and `aria-expanded` behavior during extraction.

### [crates/formspec-core/src/extension_analysis.rs](/Users/mikewolfd/Work/formspec/crates/formspec-core/src/extension_analysis.rs)

- Split into `extension_analysis/{issues,contracts,validator,json_items,registry_bridge}.rs`.
- Keep `mod.rs` as the stable public facade; consider moving the shared contracts to a neutral module rather than leaving them under `extension_analysis`.

### [packages/formspec-chat/src/chat-session.ts](/Users/mikewolfd/Work/formspec/packages/formspec-chat/src/chat-session.ts)

- Split into `chat-session-{state,bootstrap,conversation,bridge,persistence,autofix}.ts`.
- Make shared mutable session state explicit instead of spreading direct field mutation.

### [crates/fel-core/src/lexer.rs](/Users/mikewolfd/Work/formspec/crates/fel-core/src/lexer.rs)

- Split into `lexer/{token,cursor,trivia,literals,identifiers,tests}.rs`.
- Keep `next_token()` responsible for dispatch policy.

### [crates/fel-core/src/environment.rs](/Users/mikewolfd/Work/formspec/crates/fel-core/src/environment.rs)

- Split into `environment/{model,lookup,repeat,context,tests}.rs`.
- Keep the trait impl centralized and delegate to helpers.

### [crates/formspec-lint/src/extensions.rs](/Users/mikewolfd/Work/formspec/crates/formspec-lint/src/extensions.rs)

- Split into `extensions/{registry,traversal,rules,tests}.rs`.
- Centralize traversal and path formatting before moving policy.

### [packages/formspec-mcp/src/create-server.ts](/Users/mikewolfd/Work/formspec/packages/formspec-mcp/src/create-server.ts)

- Split into `tool-schemas.ts` plus `register-{bootstrap,structure,authoring,query}-tools.ts`.
- Leave `create-server.ts` as the composition root.

### [packages/formspec-engine/src/wasm-bridge.ts](/Users/mikewolfd/Work/formspec/packages/formspec-engine/src/wasm-bridge.ts)

- Split into `wasm/{runtime,invoke,fel,document,definition,mapping-registry}.ts`.
- Keep `wasm-bridge.ts` as a top-level compatibility barrel over the new modules.

### [src/formspec/_rust.py](/Users/mikewolfd/Work/formspec/src/formspec/_rust.py)

- Split into `_rust/{bridge,models,codec,fel,documents,artifacts}.py`.
- Keep `formspec._rust` as a compatibility facade while imports migrate.

### [crates/fel-core/src/types.rs](/Users/mikewolfd/Work/formspec/crates/fel-core/src/types.rs)

- Split into `types/{value,date,calendar,parse,display}.rs` with `types/mod.rs` re-exporting the public surface.
- Keep `FelValue` as the top-level owner of cross-type composition and keep date/calendar parsing independent of the runtime value layer.

## Notes

- Generated/example results from the earlier pass were intentionally dropped after the scope was tightened.
- Reviews were produced by parallel `gpt-5.4` low subagents reading each target file in full before proposing a split.
