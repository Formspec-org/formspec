# 2026-03-22 Large File Breakup Review

## Scope

This review covers `rs`, `ts`, `js`, and `py` files longer than 500 lines, excluding:

- `archived/`
- test files and test directories
- generated files under `*/generated/*`
- files under `examples/`

The target list was produced with:

```bash
scripts/find-large-code-files.sh 500
```

Script:

- [scripts/find-large-code-files.sh](/Users/mikewolfd/Work/formspec/scripts/find-large-code-files.sh)

## In-Scope Files

```text
3664  crates/formspec-eval/src/lib.rs
3122  packages/formspec-studio-core/src/project.ts
3027  packages/formspec-engine/src/index.ts
2641  crates/formspec-py/src/lib.rs
2591  crates/formspec-wasm/src/lib.rs
2065  crates/formspec-core/src/runtime_mapping.rs
1715  crates/fel-core/src/evaluator.rs
1615  crates/formspec-eval/src/recalculate.rs
1522  crates/formspec-lint/src/pass_theme.rs
1461  crates/formspec-eval/src/revalidate.rs
1256  crates/formspec-core/src/registry_client.rs
1248  crates/formspec-lint/src/pass_component.rs
1143  crates/formspec-core/src/assembler.rs
1087  crates/fel-core/src/parser.rs
956   packages/formspec-layout/src/planner.ts
955   src/formspec/validate.py
955   crates/formspec-core/src/fel_analysis.rs
917   crates/formspec-lint/src/lib.rs
901   crates/formspec-eval/src/rebuild.rs
896   crates/formspec-lint/src/references.rs
868   packages/formspec-webcomponent/stories/src/stories.ts
818   crates/formspec-lint/src/expressions.rs
760   crates/formspec-core/src/fel_rewrite_exact.rs
719   crates/formspec-core/src/changelog.rs
701   packages/formspec-core/src/handlers/definition-items.ts
673   packages/formspec-core/src/types.ts
626   crates/fel-core/src/extensions.rs
608   crates/formspec-core/src/schema_validator.rs
582   packages/formspec-webcomponent/src/components/layout.ts
574   crates/formspec-lint/src/schema_validation.rs
555   packages/formspec-chat/src/chat-session.ts
544   crates/formspec-lint/src/extensions.rs
529   crates/formspec-eval/src/types.rs
527   crates/fel-core/src/lexer.rs
524   crates/fel-core/src/environment.rs
521   packages/formspec-mcp/src/create-server.ts
515   src/formspec/_rust.py
```

## Recommendations

### [crates/formspec-eval/src/lib.rs](/Users/mikewolfd/Work/formspec/crates/formspec-eval/src/lib.rs)

- Split into `src/pipeline.rs` and `src/runtime_seed.rs`.
- Move the giant inline test block into `tests/integration/*`.
- Keep `lib.rs` as a thin facade and re-export surface.

### [packages/formspec-studio-core/src/project.ts](/Users/mikewolfd/Work/formspec/packages/formspec-studio-core/src/project.ts)

- Split into `project-shared.ts`, `project-definition.ts`, `project-rules.ts`, `project-pages.ts`, `project-presentation.ts`, and `project-interop.ts`.
- Keep `project.ts` as the public `Project` facade.

### [packages/formspec-engine/src/index.ts](/Users/mikewolfd/Work/formspec/packages/formspec-engine/src/index.ts)

- Split into `src/fel/fel-api.ts`, `src/mapping/RuntimeMappingEngine.ts`, `src/assembly/assembleDefinition.ts`, and `src/engine/{FormEngine,init,evaluation}.ts`.
- Keep `src/index.ts` as a compatibility barrel.

### [crates/formspec-py/src/lib.rs](/Users/mikewolfd/Work/formspec/crates/formspec-py/src/lib.rs)

- Split into `convert.rs`, `fel.rs`, `document.rs`, `registry.rs`, and `mapping.rs`.
- Reduce `lib.rs` to module wiring and PyO3 registration.

### [crates/formspec-wasm/src/lib.rs](/Users/mikewolfd/Work/formspec/crates/formspec-wasm/src/lib.rs)

- Split into `fel.rs`, `document.rs`, `evaluate.rs`, `definition.rs`, `mapping.rs`, and `registry.rs`.
- Keep `lib.rs` to `wasm_bindgen` exports and wiring.

### [crates/formspec-core/src/runtime_mapping.rs](/Users/mikewolfd/Work/formspec/crates/formspec-core/src/runtime_mapping.rs)

- Split into `runtime_mapping/{types,path,fel,transforms,engine,document,tests}.rs`.
- Move the inline test suite out first.

### [crates/fel-core/src/evaluator.rs](/Users/mikewolfd/Work/formspec/crates/fel-core/src/evaluator.rs)

- Split into `evaluator/{environment,paths,operators,functions/{mod,scalar,domain}}.rs`.
- Keep shared state on `Evaluator`; do not invent new service abstractions.

### [crates/formspec-eval/src/recalculate.rs](/Users/mikewolfd/Work/formspec/crates/formspec-eval/src/recalculate.rs)

- Split into `recalculate/{variables,repeats,binds,calculate}.rs`.
- Keep `mod.rs` as the orchestrator.

### [crates/formspec-lint/src/pass_theme.rs](/Users/mikewolfd/Work/formspec/crates/formspec-lint/src/pass_theme.rs)

- Split into `pass_theme/{tokens,token_refs,pages,definition_links,tests}.rs`.
- Use rule-family boundaries, not generic helper buckets.

### [crates/formspec-eval/src/revalidate.rs](/Users/mikewolfd/Work/formspec/crates/formspec-eval/src/revalidate.rs)

- Split into `revalidate/{items,extensions,shapes,env,scope}.rs`.
- Centralize `env.data` mutation before moving validator logic.

### [crates/formspec-core/src/registry_client.rs](/Users/mikewolfd/Work/formspec/crates/formspec-core/src/registry_client.rs)

- Split into `registry_client/{model,parse,query,validation,version,discovery}.rs`.
- Keep parsing responsible for maintaining `entries` and `by_name` invariants.

### [crates/formspec-lint/src/pass_component.rs](/Users/mikewolfd/Work/formspec/crates/formspec-lint/src/pass_component.rs)

- Split into `pass_component/{catalog,field_lookup,custom_components,walker,rules,tests}.rs`.
- Pull rule bodies out of `walk_node` before deeper decomposition.

### [crates/formspec-core/src/assembler.rs](/Users/mikewolfd/Work/formspec/crates/formspec-core/src/assembler.rs)

- Split into `assembler/{refs,traversal,imports,rewrite,path_ops}.rs`.
- Keep rewrite semantics centralized around `FelRewriteMap`.

### [crates/fel-core/src/parser.rs](/Users/mikewolfd/Work/formspec/crates/fel-core/src/parser.rs)

- Split into `parser/{control_flow,operators,primary,references,tests}.rs`.
- Prefer multiple `impl Parser` blocks over new parser abstractions.

### [packages/formspec-layout/src/planner.ts](/Users/mikewolfd/Work/formspec/packages/formspec-layout/src/planner.ts)

- Split into `planner/{component-planner,definition-planner,page-mode,theme-pages,path-lookup,node-utils}.ts`.
- Extract page-mode policy early; it is the most duplicated and fragile area.

### [src/formspec/validate.py](/Users/mikewolfd/Work/formspec/src/formspec/validate.py)

- Split into `validation/{models,discovery,passes/{linting,runtime,analysis},reporting}.py`.
- Keep `validate.py` as the public facade and CLI entrypoint.

### [crates/formspec-core/src/fel_analysis.rs](/Users/mikewolfd/Work/formspec/crates/formspec-core/src/fel_analysis.rs)

- Split into `fel_analysis/{types,path_codec,analyze,targets,rewrite}.rs`.
- Centralize field-path string encoding before moving walkers.

### [crates/formspec-lint/src/lib.rs](/Users/mikewolfd/Work/formspec/crates/formspec-lint/src/lib.rs)

- Split into `pipeline.rs`, `pipeline_definition.rs`, and `pipeline_finalize.rs`.
- Move tests out of `lib.rs` and keep `lib.rs` as a thin facade.

### [crates/formspec-eval/src/rebuild.rs](/Users/mikewolfd/Work/formspec/crates/formspec-eval/src/rebuild.rs)

- Split into `rebuild/{definition,binds,repeats,wildcards,initial_values}.rs`.
- Consolidate shared bind-application logic before moving callers.

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

### [packages/formspec-webcomponent/src/components/layout.ts](/Users/mikewolfd/Work/formspec/packages/formspec-webcomponent/src/components/layout.ts)

- Split into `layout/primitives.ts`, `layout/accordion.ts`, and `overlay/{positioning,modal,popover}.ts`.
- Preserve focus return, `Escape`, and `aria-expanded` behavior during extraction.

### [crates/formspec-lint/src/schema_validation.rs](/Users/mikewolfd/Work/formspec/crates/formspec-lint/src/schema_validation.rs)

- Split into `schema_validation/{schemas,diagnostics,component_schema,component_nodes,tests}.rs`.
- Keep the current shallow-envelope plus per-node validation algorithm intact.

### [packages/formspec-chat/src/chat-session.ts](/Users/mikewolfd/Work/formspec/packages/formspec-chat/src/chat-session.ts)

- Split into `chat-session-{state,bootstrap,conversation,bridge,persistence,autofix}.ts`.
- Make shared mutable session state explicit instead of spreading direct field mutation.

### [crates/formspec-lint/src/extensions.rs](/Users/mikewolfd/Work/formspec/crates/formspec-lint/src/extensions.rs)

- Split into `extensions/{registry,traversal,rules,tests}.rs`.
- Centralize traversal and path formatting before moving policy.

### [crates/formspec-eval/src/types.rs](/Users/mikewolfd/Work/formspec/crates/formspec-eval/src/types.rs)

- Split into `types/{item_tree,evaluation,definition,extensions,modes,paths}.rs`.
- Keep `src/types/mod.rs` as the stable re-export layer.

### [crates/fel-core/src/lexer.rs](/Users/mikewolfd/Work/formspec/crates/fel-core/src/lexer.rs)

- Split into `lexer/{token,cursor,trivia,literals,identifiers,tests}.rs`.
- Keep `next_token()` responsible for dispatch policy.

### [crates/fel-core/src/environment.rs](/Users/mikewolfd/Work/formspec/crates/fel-core/src/environment.rs)

- Split into `environment/{model,lookup,repeat,context,tests}.rs`.
- Keep the trait impl centralized and delegate to helpers.

### [packages/formspec-mcp/src/create-server.ts](/Users/mikewolfd/Work/formspec/packages/formspec-mcp/src/create-server.ts)

- Split into `tool-schemas.ts` plus `register-{bootstrap,structure,authoring,query}-tools.ts`.
- Leave `create-server.ts` as the composition root.

### [src/formspec/_rust.py](/Users/mikewolfd/Work/formspec/src/formspec/_rust.py)

- Split into `_rust/{bridge,models,codec,fel,documents,artifacts}.py`.
- Keep `formspec._rust` as a compatibility facade while imports migrate.

## Notes

- Generated files and files under `examples/` were explicitly excluded after the initial pass.
- Reviews were produced by parallel `gpt-5.4` low subagents, one file at a time, reading each target file in full before proposing a split.
