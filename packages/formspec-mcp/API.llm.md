# @formspec/mcp — API Reference

*Auto-generated from TypeScript declarations — do not hand-edit.*

Model Context Protocol server for AI-driven Formspec form authoring. Exposes form creation, editing, preview, and validation as MCP tools.

## `READ_ONLY: {
    readonly readOnlyHint: true;
    readonly destructiveHint: false;
    readonly idempotentHint: true;
    readonly openWorldHint: false;
}`

@filedesc Reusable MCP tool annotation presets (read-only, destructive, etc.).

## `NON_DESTRUCTIVE: {
    readonly readOnlyHint: false;
    readonly destructiveHint: false;
    readonly idempotentHint: false;
    readonly openWorldHint: false;
}`

## `DESTRUCTIVE: {
    readonly readOnlyHint: false;
    readonly destructiveHint: true;
    readonly idempotentHint: false;
    readonly openWorldHint: false;
}`

## `FILESYSTEM_IO: {
    readonly readOnlyHint: false;
    readonly destructiveHint: false;
    readonly idempotentHint: true;
    readonly openWorldHint: true;
}`

## `executeBatch(items: BatchItem[], fn: (item: BatchItem, index: number) => HelperResult): BatchResult`

Execute a batch of items, calling `fn` for each.
Catches errors per-item so one failure doesn't abort the rest.

#### interface `BatchItemResult`

Per-item result

- **index**: `number`
- **success**: `boolean`
- **summary?**: `string`
- **error?**: `{
        code: string;
        message: string;
        detail?: Record<string, unknown>;
    }`

#### interface `BatchResult`

Aggregate batch response

- **results**: `BatchItemResult[]`
- **succeeded**: `number`
- **failed**: `number`

#### type `BatchItem`

A single item in a batch — shape varies per tool

```ts
type BatchItem = Record<string, unknown>;
```

## `createFormspecServer(registry: ProjectRegistry): McpServer`

Create an McpServer with browser-safe authoring tools registered.

Excludes filesystem-dependent tools (open, save, draft, load).
Includes: guide, create (inline), undo/redo (inline), all structure/behavior/flow/
style/data/screener/query/fel tools.

Does NOT connect any transport or set up shutdown hooks.

## `createToolDispatch(registry: ProjectRegistry, projectId: string): ToolDispatch`

Creates an in-process tool dispatcher for the given project.
Calls MCP tool handler functions directly — no transport, no serialization.

#### interface `ToolCallResult`

Result of a tool call.

- **content**: `string`
- **isError**: `boolean`

#### interface `ToolDeclaration`

Tool declaration for AI consumption.

- **name**: `string`
- **description**: `string`
- **inputSchema**: `Record<string, unknown>`

#### interface `ToolDispatch`

- **declarations** (`ToolDeclaration[]`): Tool declarations for AI adapter tool lists.

##### `call(name: string, args: Record<string, unknown>): ToolCallResult`

Call a tool by name with arguments. Returns the MCP response as a string.

## `formatToolError(code: string, message: string, detail?: Record<string, unknown>): ToolError`

## `errorResponse(error: ToolError): {
    isError: true;
    content: {
        type: "text";
        text: string;
    }[];
    structuredContent: Record<string, unknown>;
}`

MCP error response shape with structuredContent

## `successResponse(result: unknown): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

MCP success response shape

## `wrapHelperCall(fn: () => HelperResult): ReturnType<typeof successResponse> | ReturnType<typeof errorResponse>`

Wraps a Project helper call with uniform error handling.
Catches HelperError → maps to ToolError wire format.
Catches any other Error → maps to COMMAND_FAILED.

## `wrapBatchCall(items: BatchItem[], fn: (item: BatchItem, index: number) => HelperResult): ReturnType<typeof successResponse> | ReturnType<typeof errorResponse>`

Wraps a batch operation into an MCP response.
Uses successResponse when all succeed, marks isError when ALL fail.
Partial success returns a normal response with the failure details inside.

#### type `ToolError`

```ts
type ToolError = {
    code: string;
    message: string;
    detail?: Record<string, unknown>;
} & Record<string, unknown>;
```

## `server: import("@modelcontextprotocol/sdk/server/mcp.js").McpServer`

@filedesc MCPB entry point — exports a configured McpServer for Claude Desktop's built-in Node.js runner.

Unlike server.ts (which connects its own StdioServerTransport), this module
exports the server so the host environment can connect its own transport.

#### interface `DraftState`

- **definition?**: `unknown`
- **component?**: `unknown`
- **theme?**: `unknown`
- **errors**: `Map<string, SchemaValidationError[]>`

#### interface `ProjectEntry`

- **id**: `string`
- **project**: `Project | null`
- **draft**: `DraftState | null`
- **sourcePath?**: `string`

#### class `ProjectRegistry`

##### `newProject(): string`

##### `getEntry(id: string): ProjectEntry`

##### `getProject(id: string): Project`

##### `getDraft(id: string): DraftState`

##### `transitionToAuthoring(id: string, project: Project): void`

##### `registerOpen(path: string, project: Project): string`

##### `close(id: string): void`

##### `listAll(): ProjectEntry[]`

##### `authoringProjects(): Array<{
        id: string;
        project: Project;
        sourcePath?: string;
    }>`

## `initSchemas(schemasDir: string): SchemaValidator`

Loads schemas from disk and creates the validator singleton.
Call once at startup. Throws (fatal) if any schema file is missing.

## `getValidator(): SchemaValidator`

## `initSchemaTexts(schemasDir: string): void`

## `getSchemaText(name: 'definition' | 'component' | 'theme'): string`

## `main(): Promise<void>`

## `handleAudit(registry: ProjectRegistry, projectId: string, params: AuditParams): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

#### interface `ItemClassification`

- **path**: `string`
- **type**: `'field' | 'group' | 'display'`
- **dataType?**: `string`
- **hasBind**: `boolean`
- **hasShape**: `boolean`
- **hasExtension**: `boolean`

#### interface `AuditParams`

- **action**: `AuditAction`
- **target?**: `string`

#### type `AuditAction`

```ts
type AuditAction = 'classify_items' | 'bind_summary' | 'cross_document' | 'accessibility';
```

## `handleBehaviorExpanded(registry: ProjectRegistry, projectId: string, params: BehaviorExpandedParams): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

#### interface `BehaviorExpandedParams`

- **action**: `BehaviorExpandedAction`
- **target**: `string`
- **property?**: `string`
- **value?**: `string | null`
- **composition?**: `'and' | 'or' | 'not' | 'xone'`
- **rules?**: `Array<{
        constraint: string;
        message: string;
    }>`
- **shapeId?**: `string`
- **changes?**: `{
        rule?: string;
        message?: string;
        timing?: 'continuous' | 'submit' | 'demand';
        severity?: 'error' | 'warning' | 'info';
        code?: string;
        activeWhen?: string;
    }`

#### type `BehaviorExpandedAction`

```ts
type BehaviorExpandedAction = 'set_bind_property' | 'set_shape_composition' | 'update_validation';
```

## `handleBehavior(registry: ProjectRegistry, projectId: string, params: BehaviorParams | {
    items: BatchItem[];
}): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

#### interface `BehaviorParams`

- **action**: `BehaviorAction`
- **target**: `string`
- **condition?**: `string`
- **expression?**: `string`
- **rule?**: `string`
- **message?**: `string`
- **options?**: `ValidationOptions`

#### type `BehaviorAction`

```ts
type BehaviorAction = 'show_when' | 'readonly_when' | 'require' | 'calculate' | 'add_rule' | 'remove_rule';
```

## `handleDraft(registry: ProjectRegistry, projectId: string, type: ArtifactType, json: unknown): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

Submit a raw JSON artifact for schema validation during bootstrap.
type: 'definition' | 'component' | 'theme'

## `handleLoad(registry: ProjectRegistry, projectId: string): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

Auto-validates all drafts, then transitions to authoring phase.
Returns validation errors instead of transitioning if any exist.

#### type `ArtifactType`

```ts
type ArtifactType = 'definition' | 'component' | 'theme';
```

## `handleChangelog(registry: ProjectRegistry, projectId: string, params: ChangelogParams): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

#### interface `ChangelogParams`

- **action**: `ChangelogAction`
- **fromVersion?**: `string`

#### type `ChangelogAction`

```ts
type ChangelogAction = 'list_changes' | 'diff_from_baseline';
```

## `handleChangesetOpen(registry: ProjectRegistry, projectId: string): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

Handle formspec_changeset_open: start a new changeset.

## `handleChangesetClose(registry: ProjectRegistry, projectId: string, label: string): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

Handle formspec_changeset_close: seal the changeset and compute dependency groups.

## `handleChangesetList(registry: ProjectRegistry, projectId: string): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

Handle formspec_changeset_list: list changesets with status and summaries.

## `handleChangesetAccept(registry: ProjectRegistry, projectId: string, groupIndices?: number[]): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

Handle formspec_changeset_accept: accept a pending changeset.

## `handleChangesetReject(registry: ProjectRegistry, projectId: string, groupIndices?: number[]): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

Handle formspec_changeset_reject: reject a pending changeset.

## `withChangesetBracket(project: Project, toolName: string, fn: () => T): T`

Wraps a mutation tool handler to auto-bracket with beginEntry/endEntry
when a changeset is open. This ensures all MCP tool mutations are
properly tracked in the changeset's AI entries.

When no changeset is open, the handler executes directly.

## `bracketMutation(registry: ProjectRegistry, projectId: string, toolName: string, fn: () => T): T`

Convenience wrapper for MCP tool registrations.

Resolves the project from the registry and wraps `fn` with changeset
brackets. If the project cannot be resolved (wrong phase, not found),
`fn` is called directly — its own error handling produces the
appropriate MCP error response.

## `handleComponent(registry: ProjectRegistry, projectId: string, params: ComponentParams): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

#### interface `NodeRef`

- **bind?**: `string`
- **nodeId?**: `string`

#### interface `ComponentParams`

- **action**: `ComponentAction`
- **parent?**: `NodeRef`
- **component?**: `string`
- **bind?**: `string`
- **props?**: `Record<string, unknown>`
- **node?**: `NodeRef`
- **property?**: `string`
- **value?**: `unknown`

#### type `ComponentAction`

```ts
type ComponentAction = 'list_nodes' | 'set_node_property' | 'add_node' | 'remove_node';
```

## `handleComposition(registry: ProjectRegistry, projectId: string, params: CompositionParams): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

#### interface `CompositionParams`

- **action**: `CompositionAction`
- **path?**: `string`
- **ref?**: `string`
- **keyPrefix?**: `string`

#### type `CompositionAction`

```ts
type CompositionAction = 'add_ref' | 'remove_ref' | 'list_refs';
```

## `handleData(registry: ProjectRegistry, projectId: string, params: DataParams): {
    isError: true;
    content: {
        type: "text";
        text: string;
    }[];
    structuredContent: Record<string, unknown>;
} | {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

#### interface `DataParams`

- **resource**: `DataResource`
- **action**: `DataAction`
- **name**: `string`
- **options?**: `ChoiceOption[]`
- **expression?**: `string`
- **scope?**: `string`
- **props?**: `InstanceProps`
- **changes?**: `Partial<InstanceProps>`
- **new_name?**: `string`

#### type `DataResource`

```ts
type DataResource = 'choices' | 'variable' | 'instance';
```

#### type `DataAction`

```ts
type DataAction = 'add' | 'update' | 'remove' | 'rename';
```

## `handleFel(registry: ProjectRegistry, projectId: string, params: FelParams): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

## `handleFelTrace(registry: ProjectRegistry, projectId: string, params: FelTraceParams): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

Evaluate a FEL expression and return a structured trace of evaluation steps.

The trace is identical in shape to what Rust `fel_core::evaluate_with_trace`
produces — each step carries a PascalCase `kind` tag (`FieldResolved`,
`FunctionCalled`, `BinaryOp`, `IfBranch`, `ShortCircuit`) plus per-kind payload.
Intended for LLM / error-explainer surfaces.

#### interface `FelParams`

- **action**: `FelAction`
- **path?**: `string`
- **expression?**: `string`
- **context_path?**: `string`

#### interface `FelTraceParams`

- **expression**: `string`
- **fields?**: `Record<string, unknown>`

#### type `FelAction`

```ts
type FelAction = 'context' | 'functions' | 'check' | 'validate' | 'autocomplete' | 'humanize';
```

## `handleFlow(registry: ProjectRegistry, projectId: string, params: FlowParams): {
    isError: true;
    content: {
        type: "text";
        text: string;
    }[];
    structuredContent: Record<string, unknown>;
} | {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

#### interface `FlowParams`

- **action**: `FlowAction`
- **mode?**: `'single' | 'wizard' | 'tabs'`
- **props?**: `FlowProps`
- **on?**: `string`
- **paths?**: `BranchPath[]`
- **otherwise?**: `string | string[]`

#### type `FlowAction`

```ts
type FlowAction = 'set_mode' | 'branch';
```

## `handleGuide(registry: ProjectRegistry, mode: 'new' | 'modify', projectId?: string, context?: string): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

## `handleCreate(registry: ProjectRegistry): ReturnType<typeof successResponse> | ReturnType<typeof errorResponse>`

## `handleOpen(registry: ProjectRegistry, path: string): ReturnType<typeof successResponse> | ReturnType<typeof errorResponse>`

## `handleSave(registry: ProjectRegistry, projectId: string, path?: string): ReturnType<typeof successResponse> | ReturnType<typeof errorResponse>`

## `handleList(registry: ProjectRegistry, includeAutosaved?: boolean, autosaveDir?: string): ReturnType<typeof successResponse>`

## `handlePublish(registry: ProjectRegistry, projectId: string, version: string, summary?: string, path?: string): ReturnType<typeof successResponse> | ReturnType<typeof errorResponse>`

## `handleUndo(registry: ProjectRegistry, projectId: string): ReturnType<typeof successResponse> | ReturnType<typeof errorResponse>`

## `handleRedo(registry: ProjectRegistry, projectId: string): ReturnType<typeof successResponse> | ReturnType<typeof errorResponse>`

## `handleLocale(registry: ProjectRegistry, projectId: string, params: LocaleParams): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

#### interface `LocaleParams`

- **action**: `LocaleAction`
- **locale_id?**: `string`
- **key?**: `string`
- **value?**: `string`
- **property?**: `string`

#### type `LocaleAction`

```ts
type LocaleAction = 'set_string' | 'remove_string' | 'list_strings' | 'set_form_string' | 'list_form_strings';
```

## `handleMappingExpanded(registry: ProjectRegistry, projectId: string, params: MappingParams): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

#### interface `MappingParams`

- **action**: `MappingAction`
- **mappingId?**: `string`
- **sourcePath?**: `string`
- **targetPath?**: `string`
- **transform?**: `string`
- **insertIndex?**: `number`
- **ruleIndex?**: `number`
- **scopePath?**: `string`
- **replace?**: `boolean`

#### type `MappingAction`

```ts
type MappingAction = 'add_mapping' | 'remove_mapping' | 'list_mappings' | 'auto_map';
```

## `handleMigration(registry: ProjectRegistry, projectId: string, params: MigrationParams): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

#### interface `MigrationParams`

- **action**: `MigrationAction`
- **fromVersion?**: `string`
- **description?**: `string`
- **source?**: `string`
- **target?**: `string | null`
- **transform?**: `string`
- **expression?**: `string`
- **insertIndex?**: `number`
- **ruleIndex?**: `number`

#### type `MigrationAction`

```ts
type MigrationAction = 'add_rule' | 'remove_rule' | 'list_rules';
```

## `handleOntology(registry: ProjectRegistry, projectId: string, params: OntologyParams): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

#### interface `OntologyParams`

- **action**: `OntologyAction`
- **path?**: `string`
- **concept?**: `string`
- **vocabulary?**: `string`

#### type `OntologyAction`

```ts
type OntologyAction = 'bind_concept' | 'remove_concept' | 'list_concepts' | 'set_vocabulary';
```

## `handleLayout(registry: ProjectRegistry, projectId: string, targets: string | string[], arrangement: LayoutArrangement): {
    isError: true;
    content: {
        type: "text";
        text: string;
    }[];
    structuredContent: Record<string, unknown>;
} | {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

## `handleStyle(registry: ProjectRegistry, projectId: string, path: string, properties: Record<string, unknown>): {
    isError: true;
    content: {
        type: "text";
        text: string;
    }[];
    structuredContent: Record<string, unknown>;
} | {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

## `handleStyleAll(registry: ProjectRegistry, projectId: string, properties: Record<string, unknown>, target: 'form' | {
    type: 'group' | 'field' | 'display';
} | {
    dataType: string;
}): {
    isError: true;
    content: {
        type: "text";
        text: string;
    }[];
    structuredContent: Record<string, unknown>;
} | {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

#### interface `PublishParams`

- **action**: `PublishAction`
- **version?**: `string`
- **status?**: `LifecycleStatus`

#### type `PublishAction`

```ts
type PublishAction = 'set_version' | 'set_status' | 'validate_transition' | 'get_version_info';
```

#### type `LifecycleStatus`

```ts
type LifecycleStatus = 'draft' | 'active' | 'retired';
```

## `handleDescribe(registry: ProjectRegistry, projectId: string, mode: 'structure' | 'audit' | 'shapes', target?: string): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

## `handleSearch(registry: ProjectRegistry, projectId: string, filter: Partial<ItemFilter>): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

## `handleTrace(registry: ProjectRegistry, projectId: string, mode: 'trace' | 'changelog', params: {
    expression_or_field?: string;
    from_version?: string;
}): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

## `handlePreview(registry: ProjectRegistry, projectId: string, mode: 'preview' | 'validate' | 'sample_data' | 'normalize', params: {
    scenario?: Record<string, unknown>;
    response?: Record<string, unknown>;
}): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

## `handleReference(registry: ProjectRegistry, projectId: string, params: ReferenceParams): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

#### interface `ReferenceParams`

- **action**: `ReferenceAction`
- **field_path?**: `string`
- **uri?**: `string`
- **type?**: `string`
- **description?**: `string`

#### type `ReferenceAction`

```ts
type ReferenceAction = 'add_reference' | 'remove_reference' | 'list_references';
```

## `handleResponse(registry: ProjectRegistry, projectId: string, params: ResponseParams): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

## `clearTestResponsesForProject(projectId: string): void`

Clear test responses for a project (call on close). Exported for testing.

#### interface `ResponseParams`

- **action**: `ResponseAction`
- **field?**: `string`
- **value?**: `unknown`
- **response?**: `Record<string, unknown>`

#### type `ResponseAction`

```ts
type ResponseAction = 'set_test_response' | 'get_test_response' | 'clear_test_responses' | 'validate_response';
```

## `handleScreener(registry: ProjectRegistry, projectId: string, params: ScreenerParams): {
    isError: true;
    content: {
        type: "text";
        text: string;
    }[];
    structuredContent: Record<string, unknown>;
} | {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

#### interface `ScreenerParams`

- **action**: `ScreenerAction`
- **url?**: `string`
- **title?**: `string`
- **key?**: `string`
- **label?**: `string`
- **type?**: `string`
- **props?**: `FieldProps`
- **phase_id?**: `string`
- **strategy?**: `string`
- **config?**: `Record<string, unknown>`
- **route_index?**: `number`
- **condition?**: `string`
- **target?**: `string`
- **message?**: `string`
- **score?**: `string`
- **threshold?**: `number`
- **override?**: `boolean`
- **terminal?**: `boolean`
- **changes?**: `Record<string, unknown>`
- **direction?**: `'up' | 'down'`
- **insert_index?**: `number`
- **availability_from?**: `string | null`
- **availability_until?**: `string | null`
- **result_validity?**: `string | null`

#### type `ScreenerAction`

## `handleStructureBatch(registry: ProjectRegistry, projectId: string, params: {
    action: string;
    paths: string[];
    groupPath?: string;
    groupLabel?: string;
}): {
    isError: true;
    content: {
        type: "text";
        text: string;
    }[];
    structuredContent: Record<string, unknown>;
} | {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

## `handleField(registry: ProjectRegistry, projectId: string, params: {
    path: string;
    label: string;
    type: string;
    props?: FieldProps;
    parentPath?: string;
}): ReturnType<typeof wrapHelperCall>`

## `handleContent(registry: ProjectRegistry, projectId: string, params: {
    path: string;
    body: string;
    kind?: string;
    props?: ContentProps;
    parentPath?: string;
}): ReturnType<typeof wrapHelperCall>`

## `handleGroup(registry: ProjectRegistry, projectId: string, params: {
    path: string;
    label: string;
    props?: GroupProps & {
        repeat?: RepeatProps;
    };
    parentPath?: string;
}): ReturnType<typeof wrapHelperCall>`

## `handleSubmitButton(registry: ProjectRegistry, projectId: string, label?: string, pageId?: string): {
    isError: true;
    content: {
        type: "text";
        text: string;
    }[];
    structuredContent: Record<string, unknown>;
} | {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

## `handlePage(registry: ProjectRegistry, projectId: string, action: 'add' | 'remove' | 'move' | 'list', params: {
    title?: string;
    description?: string;
    page_id?: string;
    direction?: 'up' | 'down';
}): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

## `handlePlace(registry: ProjectRegistry, projectId: string, params: {
    action: 'place' | 'unplace';
    target: string;
    page_id: string;
    options?: PlacementOptions;
}): ReturnType<typeof wrapHelperCall>`

## `handleUpdate(registry: ProjectRegistry, projectId: string, target: 'item' | 'metadata', params: {
    path?: string;
    changes?: ItemChanges | MetadataChanges;
    items?: Array<{
        path: string;
        changes: ItemChanges;
    }>;
}): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

## `editMissingAction(): {
    isError: true;
    content: {
        type: "text";
        text: string;
    }[];
    structuredContent: Record<string, unknown>;
}`

Error response when action is missing in non-batch edit mode

## `handleEdit(registry: ProjectRegistry, projectId: string, action: EditAction, params: EditParams): ReturnType<typeof wrapHelperCall>`

#### interface `EditParams`

- **path**: `string`
- **target_path?**: `string`
- **index?**: `number`
- **new_key?**: `string`
- **deep?**: `boolean`
- **position?**: `MovePosition`

#### type `EditAction`

```ts
type EditAction = 'remove' | 'move' | 'rename' | 'copy';
```

#### type `MovePosition`

```ts
type MovePosition = 'inside' | 'after' | 'before';
```

#### interface `StyleParams`

- **action**: `StyleAction`
- **target?**: `string | string[]`
- **arrangement?**: `LayoutArrangement`
- **path?**: `string`
- **properties?**: `Record<string, unknown>`
- **target_type?**: `string`
- **target_data_type?**: `string`

#### type `StyleAction`

```ts
type StyleAction = 'layout' | 'style' | 'style_all';
```

## `handleTheme(registry: ProjectRegistry, projectId: string, params: ThemeParams): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

#### interface `ThemeParams`

- **action**: `ThemeAction`
- **key?**: `string`
- **value?**: `unknown`
- **property?**: `string`
- **itemKey?**: `string`
- **match?**: `unknown`
- **apply?**: `unknown`

#### type `ThemeAction`

## `handleWidget(registry: ProjectRegistry, projectId: string, params: WidgetParams): {
    structuredContent?: Record<string, unknown> | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}`

#### interface `WidgetParams`

- **action**: `WidgetAction`
- **dataType?**: `string`

#### type `WidgetAction`

```ts
type WidgetAction = 'list_widgets' | 'compatible' | 'field_types';
```

