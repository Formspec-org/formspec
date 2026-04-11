# Studio-Core Helpers Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a behavior-driven interface layer to `formspec-studio-core` that wraps raw command dispatch into form-author-friendly methods (addField, removeItem, branch, etc.) per the studio-core helpers design spec.

**Architecture:** Current `Project` class becomes `RawProject` (the command-dispatch core). A new `Project` class wraps `RawProject` via composition, exposing it as `.raw` and adding ~40 authoring methods that return `HelperResult`. All authoring methods live directly on the `Project` class in `project-wrapper.ts` (renamed to `project.ts` at cutover). Evaluation helpers (`previewForm`, `validateResponse`) live in a separate module to keep `formspec-engine` dependency opt-in.

**Tech Stack:** TypeScript, Vitest, formspec-engine (for FEL parsing, rewriteFELReferences, FormEngine)

**Spec:** `docs/superpowers/specs/2026-03-14-formspec-studio-core-helpers.md`

**Spec note — composition vs inheritance:** The spec contradicts itself. The Architecture section (line 77) says "wraps RawProject via composition and exposes it as project.raw", the shape overview (lines 81-103) shows `readonly raw: RawProject`, and all method implementations use `this.raw.dispatch()`. Line 457 says `extends RawProject`. We follow the composition design because: (a) it's the majority of the spec, (b) all method bodies reference `this.raw`, and (c) the shape overview is the detailed normative contract.

---

## File Structure

All new code goes in new files. Existing files are untouched until cutover.

```
packages/formspec-studio-core/src/
  raw-project.ts          ← NEW — copy of existing project.ts, class renamed Project→RawProject,
                            factory renamed createProject→createRawProject,
                            + batchWithRebuild() + clearRedo() + dispatch(AnyCommand[]) overload
  project-wrapper.ts      ← NEW — Project class wrapping RawProject + ALL authoring methods
                            (renamed to project.ts at cutover)
  helper-types.ts         ← NEW — HelperResult, HelperError, HelperWarning, FieldProps, GroupProps, etc.
  field-type-aliases.ts   ← NEW — Field Type Alias Table + Widget Alias Table lookups
  evaluation-helpers.ts   ← NEW — previewForm, validateResponse (imports FormEngine)

packages/formspec-studio-core/tests/
  raw-project.test.ts           ← NEW — batchWithRebuild, clearRedo, dispatch([]) atomicity
  project-methods.test.ts       ← NEW — ALL authoring method tests (per spec)
  evaluation-helpers.test.ts    ← NEW — previewForm, validateResponse
```

**Dependency order:** Tasks are ordered so each builds on the previous. `helper-types.ts` and `field-type-aliases.ts` come first (no deps), then `raw-project.ts` (depends on existing project.ts), then `project-wrapper.ts` (depends on raw-project.ts + helper-types.ts), then authoring methods are added incrementally to `project-wrapper.ts` and tested via `project-methods.test.ts`.

---

## Chunk 1: Foundation — RawProject, Types, Alias Tables

### Task 1: Create helper-types.ts with HelperResult, HelperError, HelperWarning, and all interface types

**Files:**
- Create: `packages/formspec-studio-core/src/helper-types.ts`
- Test: `packages/formspec-studio-core/tests/raw-project.test.ts` (HelperError tests at top)

- [ ] **Step 1: Write failing tests for HelperError**

```typescript
// tests/raw-project.test.ts — start with HelperError tests, RawProject tests added in Task 3
import { describe, it, expect } from 'vitest';
import { HelperError } from '../src/helper-types.js';

describe('HelperError', () => {
  it('is an instance of Error', () => {
    const err = new HelperError('PATH_NOT_FOUND', 'Item not found at path "foo"');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HelperError);
  });

  it('exposes code, message, and detail', () => {
    const err = new HelperError('INVALID_TYPE', 'Unknown type "xyz"', { validTypes: ['text', 'integer'] });
    expect(err.code).toBe('INVALID_TYPE');
    expect(err.message).toBe('Unknown type "xyz"');
    expect(err.detail).toEqual({ validTypes: ['text', 'integer'] });
    expect(err.name).toBe('HelperError');
  });

  it('works in try/catch with instanceof', () => {
    try {
      throw new HelperError('TEST_CODE', 'test message');
    } catch (e) {
      expect(e instanceof HelperError).toBe(true);
      if (e instanceof HelperError) {
        expect(e.code).toBe('TEST_CODE');
      }
    }
  });

  it('detail defaults to undefined when not provided', () => {
    const err = new HelperError('SOME_CODE', 'msg');
    expect(err.detail).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/formspec-studio-core && npx vitest run tests/raw-project.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement HelperError and all types**

```typescript
// src/helper-types.ts

/** Structured warning — prefer over prose strings for programmatic consumers */
export interface HelperWarning {
  code: string;
  message: string;
  detail?: object;
}

/** Return type for all helper methods */
export interface HelperResult {
  summary: string;
  action: {
    helper: string;
    params: Record<string, unknown>;
  };
  affectedPaths: string[];
  createdId?: string;
  warnings?: HelperWarning[];
}

/** Thrown by helpers when pre-validation fails */
export class HelperError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly detail?: object,
  ) {
    super(message);
    this.name = 'HelperError';
  }
}

/** Choice option for inline options or defineChoices */
export interface ChoiceOption {
  value: string;
  label: string;
}

/** Field properties for addField / addScreenField */
export interface FieldProps {
  placeholder?: string;
  hint?: string;
  description?: string;
  ariaLabel?: string;
  choices?: ChoiceOption[];
  choicesFrom?: string;
  widget?: string;
  page?: string;
  required?: boolean;
  readonly?: boolean;
  initialValue?: unknown;
  insertIndex?: number;
  parentPath?: string;
}

/** Group properties */
export interface GroupProps {
  collapsible?: boolean;
  display?: 'stack' | 'dataTable';
}

/** Repeat group configuration */
export interface RepeatProps {
  min?: number;
  max?: number;
  addLabel?: string;
  removeLabel?: string;
}

/** Branch path — one arm of a conditional branch */
export interface BranchPath {
  when: string | number | boolean;
  show: string | string[];
  mode?: 'equals' | 'contains';
}

/** Layout arrangement for applyLayout */
export type LayoutArrangement = 'columns-2' | 'columns-3' | 'columns-4' | 'card' | 'sidebar' | 'inline';

/** Placement options for placeOnPage */
export interface PlacementOptions {
  span?: number;
}

/** Flow configuration */
export interface FlowProps {
  showProgress?: boolean;
  allowSkip?: boolean;
}

/** Validation options for addValidation */
export interface ValidationOptions {
  timing?: 'continuous' | 'submit' | 'demand';
  severity?: 'error' | 'warning' | 'info';
  code?: string;
  activeWhen?: string;
}

/** Named external data source (secondary instance) */
export interface InstanceProps {
  source?: string;
  data?: unknown;
  schema?: object;
  static?: boolean;
  readonly?: boolean;
  description?: string;
}

/** Changes for updateItem — each key routes to a different handler */
export interface ItemChanges {
  label?: string;
  hint?: string;
  description?: string;
  placeholder?: string;
  ariaLabel?: string;
  options?: ChoiceOption[];
  choicesFrom?: string;
  currency?: string;
  precision?: number;
  initialValue?: unknown;
  prePopulate?: unknown;
  dataType?: string;
  required?: boolean | string;
  constraint?: string;
  constraintMessage?: string;
  calculate?: string;
  relevant?: string;
  readonly?: boolean | string;
  default?: string;
  repeatable?: boolean;
  minRepeat?: number;
  maxRepeat?: number;
  widget?: string;
  style?: Record<string, unknown>;
  page?: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/formspec-studio-core && npx vitest run tests/raw-project.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-studio-core/src/helper-types.ts packages/formspec-studio-core/tests/raw-project.test.ts
git commit -m "feat: add HelperResult, HelperError, and helper interface types"
```

---

### Task 2: Create field-type-aliases.ts with type and widget resolution

**Files:**
- Create: `packages/formspec-studio-core/src/field-type-aliases.ts`
- Test: Add to `packages/formspec-studio-core/tests/raw-project.test.ts`

- [ ] **Step 1: Write failing tests for type alias resolution**

Add to `tests/raw-project.test.ts`:

```typescript
import { resolveFieldType, resolveWidget, widgetHintFor } from '../src/field-type-aliases.js';

describe('resolveFieldType', () => {
  it('resolves "text" to dataType "text" and widget "TextInput"', () => {
    const result = resolveFieldType('text');
    expect(result.dataType).toBe('text');
    expect(result.defaultWidget).toBe('TextInput');
  });

  it('resolves "email" to dataType "string" with constraint', () => {
    const result = resolveFieldType('email');
    expect(result.dataType).toBe('string');
    expect(result.defaultWidget).toBe('TextInput');
    expect(result.constraintExpr).toMatch(/matches.*email/);
  });

  it('resolves "phone" to dataType "string" with constraint', () => {
    const result = resolveFieldType('phone');
    expect(result.dataType).toBe('string');
    expect(result.constraintExpr).toBeDefined();
  });

  it('resolves all 24 alias keys (22 unique types with case variants) without throwing', () => {
    const aliases = [
      'text', 'string', 'integer', 'decimal', 'number', 'boolean',
      'date', 'datetime', 'dateTime', 'time', 'url', 'uri',
      'file', 'attachment', 'signature', 'choice', 'multichoice', 'multiChoice',
      'currency', 'money', 'rating', 'slider', 'email', 'phone',
    ];
    for (const alias of aliases) {
      expect(() => resolveFieldType(alias)).not.toThrow();
    }
  });

  it('throws INVALID_TYPE for unknown type', () => {
    try {
      resolveFieldType('banana');
      expect.fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HelperError);
      expect((e as HelperError).code).toBe('INVALID_TYPE');
      expect((e as HelperError).detail).toHaveProperty('validTypes');
    }
  });
});

describe('resolveWidget', () => {
  it('resolves "radio" to "RadioGroup"', () => {
    expect(resolveWidget('radio')).toBe('RadioGroup');
  });

  it('resolves "textarea" to "TextInput"', () => {
    expect(resolveWidget('textarea')).toBe('TextInput');
  });

  it('passes through raw component names like "RadioGroup"', () => {
    expect(resolveWidget('RadioGroup')).toBe('RadioGroup');
  });

  it('throws INVALID_WIDGET for unknown widget', () => {
    try {
      resolveWidget('banana');
      expect.fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HelperError);
      expect((e as HelperError).code).toBe('INVALID_WIDGET');
    }
  });
});

describe('widgetHintFor', () => {
  it('returns alias string for most aliases', () => {
    expect(widgetHintFor('radio')).toBe('radio');
    expect(widgetHintFor('slider')).toBe('slider');
  });

  it('returns undefined for "text" alias (no widgetHint)', () => {
    expect(widgetHintFor('text')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/formspec-studio-core && npx vitest run tests/raw-project.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement field-type-aliases.ts**

Implementation must match the spec's Field Type Alias Table (lines 389-414) and Widget Alias Table (lines 426-443) exactly. Key details:
- `FIELD_TYPE_MAP`: 24 entries mapping aliases → `{ dataType, defaultWidget, constraintExpr? }`
- `WIDGET_ALIAS_MAP`: 12 entries mapping aliases → component names
- `RAW_COMPONENT_NAMES`: Set of valid raw component names (passthrough)
- `widgetHintFor()`: Returns alias string as hint, except `'text'` → undefined
- `isTextareaWidget()`: Returns true for `'textarea'` alias (triggers extra widgetHint dispatch)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/formspec-studio-core && npx vitest run tests/raw-project.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-studio-core/src/field-type-aliases.ts
git commit -m "feat: add field type alias and widget alias resolution tables"
```

---

### Task 3: Create RawProject with batchWithRebuild, clearRedo, and dispatch(AnyCommand[])

Copy existing `project.ts` → `raw-project.ts`. Rename class `Project` → `RawProject`, factory `createProject` → `createRawProject`. Add three new primitives.

**Files:**
- Create: `packages/formspec-studio-core/src/raw-project.ts` (copy + rename + additions)
- Test: Add to `packages/formspec-studio-core/tests/raw-project.test.ts`

- [ ] **Step 1: Write failing tests for new primitives**

Add to `tests/raw-project.test.ts`:

```typescript
import { RawProject, createRawProject } from '../src/raw-project.js';

describe('RawProject', () => {
  it('is exported as RawProject class', () => {
    const raw = createRawProject();
    expect(raw).toBeInstanceOf(RawProject);
  });

  describe('dispatch with array (atomic multi-command)', () => {
    it('executes multiple commands atomically with single undo entry', () => {
      const raw = createRawProject();
      raw.dispatch([
        { type: 'definition.addItem', payload: { type: 'field', key: 'a' } },
        { type: 'definition.addItem', payload: { type: 'field', key: 'b' } },
      ]);
      expect(raw.state.definition.items).toHaveLength(2);
      raw.undo();
      expect(raw.state.definition.items).toHaveLength(0);
    });

    it('rolls back all commands if any throws — no partial commit', () => {
      const raw = createRawProject();
      raw.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'existing', label: 'Original' } });

      expect(() => raw.dispatch([
        // cmd1: modify existing item (would succeed alone)
        { type: 'definition.setItemProperty', payload: { path: 'existing', property: 'label', value: 'Modified' } },
        // cmd2: delete nonexistent (throws)
        { type: 'definition.deleteItem', payload: { path: 'nonexistent' } },
      ])).toThrow();

      // State fully unchanged — cmd1's property change also rolled back
      expect(raw.state.definition.items).toHaveLength(1);
      expect(raw.state.definition.items[0].key).toBe('existing');
      expect(raw.state.definition.items[0].label).toBe('Original');
    });

    it('runs middleware once for array dispatch', () => {
      let callCount = 0;
      const raw = createRawProject({
        middleware: [(_state, _cmd, next) => {
          callCount++;
          return next(_cmd);
        }],
      });
      raw.dispatch([
        { type: 'definition.addItem', payload: { type: 'field', key: 'a' } },
        { type: 'definition.addItem', payload: { type: 'field', key: 'b' } },
      ]);
      expect(callCount).toBe(1);
    });

    it('notifies listeners once for array dispatch', () => {
      let notifyCount = 0;
      const raw = createRawProject();
      raw.onChange(() => { notifyCount++; });
      raw.dispatch([
        { type: 'definition.addItem', payload: { type: 'field', key: 'a' } },
        { type: 'definition.addItem', payload: { type: 'field', key: 'b' } },
      ]);
      expect(notifyCount).toBe(1);
    });
  });

  describe('batchWithRebuild', () => {
    it('executes phase1, rebuilds component tree, then executes phase2', () => {
      const raw = createRawProject();
      const results = raw.batchWithRebuild(
        [{ type: 'definition.addItem', payload: { type: 'field', key: 'email', label: 'Email' } }],
        [{ type: 'component.setFieldWidget', payload: { fieldKey: 'email', widget: 'TextInput' } }],
      );
      expect(results).toHaveLength(2);
      expect(raw.state.definition.items).toHaveLength(1);
    });

    it('produces a single undo entry', () => {
      const raw = createRawProject();
      raw.batchWithRebuild(
        [{ type: 'definition.addItem', payload: { type: 'field', key: 'f1' } }],
        [{ type: 'component.setFieldWidget', payload: { fieldKey: 'f1', widget: 'TextInput' } }],
      );
      raw.undo();
      expect(raw.state.definition.items).toHaveLength(0);
    });

    it('mid-phase rebuild is unconditional (always rebuilds between phases)', () => {
      const raw = createRawProject();
      // Phase2 depends on the component tree node created by phase1's addItem
      // If rebuild is skipped, setFieldWidget would fail or no-op
      raw.batchWithRebuild(
        [{ type: 'definition.addItem', payload: { type: 'field', key: 'test', label: 'Test' } }],
        [{ type: 'component.setFieldWidget', payload: { fieldKey: 'test', widget: 'Select' } }],
      );
      // If we get here without throwing, the rebuild happened
      expect(raw.state.definition.items).toHaveLength(1);
    });
  });

  describe('clearRedo', () => {
    it('clears the redo stack', () => {
      const raw = createRawProject();
      raw.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'f' } });
      raw.undo();
      expect(raw.canRedo).toBe(true);
      raw.clearRedo();
      expect(raw.canRedo).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/formspec-studio-core && npx vitest run tests/raw-project.test.ts`
Expected: FAIL — cannot import RawProject

- [ ] **Step 3: Create raw-project.ts**

Copy `src/project.ts` → `src/raw-project.ts`. Make these changes:

1. **Rename:** class `Project` → `RawProject`, factory `createProject` → `createRawProject`
2. **Overload `dispatch()`** to accept `AnyCommand | AnyCommand[]`:
   - If array: clone state, execute all commands on clone, rollback if any throws (clone discarded on throw), single undo entry, middleware runs once on compound command, single listener notification
   - If single: existing behavior unchanged
3. **Add `batchWithRebuild(phase1, phase2)`:**
   - Clone state
   - Execute phase1 commands on clone
   - **Unconditional** component tree rebuild on clone (no `hasAuthoredComponentTree` guard — the whole point is that phase2 needs the rebuilt tree)
   - Execute phase2 commands on rebuilt clone
   - Single undo entry, middleware runs once, single notification
4. **Add `clearRedo()`:** `this._redoStack.length = 0`

Key implementation for `batchWithRebuild` — the mid-phase rebuild must be unconditional:
```typescript
batchWithRebuild(phase1: AnyCommand[], phase2: AnyCommand[]): CommandResult[] {
  const snapshot = this._state;
  const clone = structuredClone(this._state);
  const results: CommandResult[] = [];

  // Phase 1
  for (const cmd of phase1) {
    const handler = getHandler(cmd.type);
    results.push(handler(clone, cmd.payload));
  }

  // UNCONDITIONAL mid-batch rebuild on clone
  const saved = this._state;
  this._state = clone;
  this._rebuildComponentTree();
  this._state = saved;

  // Phase 2 (operates on rebuilt tree)
  for (const cmd of phase2) {
    const handler = getHandler(cmd.type);
    results.push(handler(clone, cmd.payload));
  }

  this._pushHistory(snapshot);
  const compoundCmd = { type: 'batchWithRebuild', payload: { phase1, phase2 } };
  this._log.push({ command: compoundCmd, timestamp: Date.now() });
  this._state = clone;

  // Final post-batch rebuild + normalize (standard post-dispatch)
  if (results.some(r => r.rebuildComponentTree) && !hasAuthoredComponentTree(this._state.component)) {
    this._rebuildComponentTree();
  }
  this._normalize();
  this._notify(compoundCmd, { rebuildComponentTree: true }, 'batch');
  return results;
}
```

Note: `_rebuildComponentTree()` is currently private. To call it from `batchWithRebuild` on the clone, the method needs to operate on `this._state` — so we temporarily swap `this._state` to the clone, rebuild, then swap back. This is the simplest approach without refactoring `_rebuildComponentTree` to accept a state parameter.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/formspec-studio-core && npx vitest run tests/raw-project.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-studio-core/src/raw-project.ts
git commit -m "feat: create RawProject with batchWithRebuild, clearRedo, and dispatch([]) primitives"
```

---

### Task 4: Create Project wrapper class (skeleton with proxied methods)

**Files:**
- Create: `packages/formspec-studio-core/src/project-wrapper.ts`
- Test: Add smoke tests to `tests/raw-project.test.ts`

- [ ] **Step 1: Write failing smoke tests**

Add to `tests/raw-project.test.ts`:

```typescript
import { Project, createProject } from '../src/project-wrapper.js';

describe('Project wrapper', () => {
  it('wraps RawProject and proxies state', () => {
    const project = createProject();
    expect(project.raw).toBeDefined();
    expect(project.state).toBe(project.raw.state);
    expect(project.fieldPaths()).toEqual([]);
  });

  it('proxies undo/redo', () => {
    const project = createProject();
    project.raw.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'f' } });
    expect(project.fieldPaths()).toContain('f');
    project.undo();
    expect(project.fieldPaths()).not.toContain('f');
    project.redo();
    expect(project.fieldPaths()).toContain('f');
  });

  it('proxies onChange subscription', () => {
    const project = createProject();
    let notified = false;
    project.onChange(() => { notified = true; });
    project.raw.dispatch({ type: 'definition.addItem', payload: { type: 'field', key: 'f' } });
    expect(notified).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/formspec-studio-core && npx vitest run tests/raw-project.test.ts`
Expected: FAIL — cannot import from project-wrapper.js

- [ ] **Step 3: Create Project wrapper skeleton**

```typescript
// src/project-wrapper.ts
import { RawProject, createRawProject } from './raw-project.js';
import type {
  ProjectOptions, ProjectState, ChangeListener, ProjectBundle,
  Diagnostics, ProjectStatistics, FieldDependents, ExpressionLocation,
  FELParseContext, FELParseResult, FELReferenceSet,
} from './types.js';
import type { FormspecItem } from 'formspec-engine';

/**
 * Behavior-driven interface for form authoring.
 * Wraps RawProject via composition, adding form-author-friendly methods.
 * All authoring methods return HelperResult.
 */
export class Project {
  readonly raw: RawProject;

  constructor(options?: ProjectOptions) {
    this.raw = createRawProject(options);
  }

  // ── Proxied from raw (read / subscribe / export) ──

  get state(): Readonly<ProjectState> { return this.raw.state; }
  get definition() { return this.raw.definition; }
  get component() { return this.raw.component; }
  get theme() { return this.raw.theme; }
  get mapping() { return this.raw.mapping; }

  fieldPaths(): string[] { return this.raw.fieldPaths(); }
  itemAt(path: string): FormspecItem | undefined { return this.raw.itemAt(path); }
  diagnose(): Diagnostics { return this.raw.diagnose(); }
  statistics(): ProjectStatistics { return this.raw.statistics(); }
  bindFor(path: string) { return this.raw.bindFor(path); }
  componentFor(fieldKey: string) { return this.raw.componentFor(fieldKey); }
  parseFEL(expression: string, context?: FELParseContext): FELParseResult {
    return this.raw.parseFEL(expression, context);
  }
  fieldDependents(path: string): FieldDependents { return this.raw.fieldDependents(path); }
  allExpressions(): ExpressionLocation[] { return this.raw.allExpressions(); }
  variableNames(): string[] { return this.raw.variableNames(); }
  instanceNames(): string[] { return this.raw.instanceNames(); }

  undo(): boolean { return this.raw.undo(); }
  redo(): boolean { return this.raw.redo(); }
  get canUndo(): boolean { return this.raw.canUndo; }
  get canRedo(): boolean { return this.raw.canRedo; }

  onChange(listener: ChangeListener): () => void { return this.raw.onChange(listener); }
  export(): ProjectBundle { return this.raw.export(); }

  // ── Authoring methods ──
  // Added incrementally in Tasks 5+ below.
  // All methods live directly on this class — no separate helper modules.
}

export function createProject(options?: ProjectOptions): Project {
  return new Project(options);
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/formspec-studio-core && npx vitest run tests/raw-project.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-studio-core/src/project-wrapper.ts
git commit -m "feat: add Project wrapper class with proxied query and history methods"
```

---

## Chunk 2: Core Authoring Methods — addField, addGroup, addContent

### Task 5: Implement addField

**Files:**
- Modify: `packages/formspec-studio-core/src/project-wrapper.ts` (add addField method)
- Test: `packages/formspec-studio-core/tests/project-methods.test.ts` (create file, start with addField)

- [ ] **Step 1: Write failing tests for addField**

```typescript
// tests/project-methods.test.ts
import { describe, it, expect } from 'vitest';
import { createProject } from '../src/project-wrapper.js';
import { HelperError } from '../src/helper-types.js';

describe('addField', () => {
  it('adds a text field to the definition', () => {
    const project = createProject();
    const result = project.addField('name', 'Full Name', 'text');
    expect(result.affectedPaths).toEqual(['name']);
    expect(result.action.helper).toBe('addField');
    expect(project.fieldPaths()).toContain('name');
    const item = project.itemAt('name');
    expect(item?.label).toBe('Full Name');
    expect(item?.dataType).toBe('text');
  });

  it('dispatches type "field" not the dataType string', () => {
    const project = createProject();
    project.addField('amount', 'Amount', 'decimal');
    const item = project.itemAt('amount');
    expect(item?.type).toBe('field');
    expect(item?.dataType).toBe('decimal');
  });

  it('resolves email alias with constraint bind', () => {
    const project = createProject();
    project.addField('email', 'Email', 'email');
    const bind = project.bindFor('email');
    expect(bind?.constraint).toMatch(/matches/);
  });

  it('sets required bind when props.required is true', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text', { required: true });
    const bind = project.bindFor('name');
    expect(bind?.required).toBe('true()');
  });

  it('sets readonly bind when props.readonly is true', () => {
    const project = createProject();
    project.addField('ro', 'Read Only', 'text', { readonly: true });
    const bind = project.bindFor('ro');
    expect(bind?.readonly).toBe('true()');
  });

  it('sets initialValue via setItemProperty', () => {
    const project = createProject();
    project.addField('qty', 'Quantity', 'integer', { initialValue: 1 });
    const item = project.itemAt('qty');
    expect(item?.initialValue).toBe(1);
  });

  it('throws INVALID_TYPE for unknown type (pre-validation)', () => {
    const project = createProject();
    expect(() => project.addField('f', 'F', 'banana')).toThrow(HelperError);
    try { project.addField('f', 'F', 'banana'); } catch (e) {
      expect((e as HelperError).code).toBe('INVALID_TYPE');
    }
    // No field should have been created
    expect(project.fieldPaths()).not.toContain('f');
  });

  it('throws PAGE_NOT_FOUND for nonexistent page (pre-validation)', () => {
    const project = createProject();
    expect(() => project.addField('f', 'F', 'text', { page: 'nonexistent' })).toThrow(HelperError);
    try { project.addField('f', 'F', 'text', { page: 'nonexistent' }); } catch (e) {
      expect((e as HelperError).code).toBe('PAGE_NOT_FOUND');
    }
    expect(project.fieldPaths()).not.toContain('f');
  });

  it('is a single undo entry (field + binds undone together)', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text', { required: true });
    expect(project.fieldPaths()).toContain('name');
    expect(project.bindFor('name')?.required).toBe('true()');
    project.undo();
    expect(project.fieldPaths()).not.toContain('name');
    expect(project.bindFor('name')).toBeUndefined();
  });

  it('adds nested field via dot-path', () => {
    const project = createProject();
    project.raw.dispatch({ type: 'definition.addItem', payload: { type: 'group', key: 'contact' } });
    project.addField('contact.email', 'Email', 'email');
    expect(project.fieldPaths()).toContain('contact.email');
  });

  it('adds field with explicit parentPath in props', () => {
    const project = createProject();
    project.raw.dispatch({ type: 'definition.addItem', payload: { type: 'group', key: 'contact' } });
    project.addField('phone', 'Phone', 'phone', { parentPath: 'contact' });
    expect(project.fieldPaths()).toContain('contact.phone');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/formspec-studio-core && npx vitest run tests/project-methods.test.ts`
Expected: FAIL — addField is not a function

- [ ] **Step 3: Implement addField on Project class**

Add `addField()` method to `project-wrapper.ts`. The method:

1. Pre-validate: resolve type alias → INVALID_TYPE, resolve widget if provided → INVALID_WIDGET, check page exists → PAGE_NOT_FOUND, check choices/choicesFrom mutual exclusion → INVALID_PROPS
2. Parse path: split on `.` — last segment = key, preceding segments = parentPath (unless `props.parentPath` overrides)
3. Build phase1 command: `definition.addItem { key, type: 'field', dataType, label, parentPath?, insertIndex? }`
   - Also add `hint`, `description`, `placeholder`, `ariaLabel` if provided in props
4. Build phase2 commands:
   - `component.setFieldWidget { fieldKey: key, widget: resolvedWidget }`
   - If textarea: `component.setNodeProperty { node: { bind: key }, property: 'widgetHint', value: 'textarea' }`
   - If required: `definition.setBind { path, properties: { required: 'true()' } }`
   - If readonly: `definition.setBind { path, properties: { readonly: 'true()' } }`
   - If constraintExpr (email/phone): `definition.setBind { path, properties: { constraint: expr } }`
   - If initialValue: `definition.setItemProperty { path, property: 'initialValue', value }`
   - If page: `pages.assignItem { pageId: page, key }`
   - If choices: `definition.setItemProperty { path, property: 'options', value: choices }`
   - If choicesFrom: `definition.setItemProperty { path, property: 'optionSet', value: choicesFrom }`
5. Call `this.raw.batchWithRebuild(phase1, phase2)`
6. Return `HelperResult { summary, action: { helper: 'addField', params }, affectedPaths: [path] }`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/formspec-studio-core && npx vitest run tests/project-methods.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-studio-core/src/project-wrapper.ts packages/formspec-studio-core/tests/project-methods.test.ts
git commit -m "feat: implement addField with type/widget alias resolution and props"
```

---

### Task 6: Implement addGroup and addContent

**Files:**
- Modify: `packages/formspec-studio-core/src/project-wrapper.ts`
- Test: Add to `packages/formspec-studio-core/tests/project-methods.test.ts`

- [ ] **Step 1: Write failing tests for addGroup**

```typescript
describe('addGroup', () => {
  it('adds a group to the definition', () => {
    const project = createProject();
    const result = project.addGroup('contact', 'Contact Information');
    expect(result.affectedPaths).toEqual(['contact']);
    const item = project.itemAt('contact');
    expect(item?.type).toBe('group');
    expect(item?.label).toBe('Contact Information');
  });

  it('with display mode uses batchWithRebuild and single undo entry', () => {
    const project = createProject();
    project.addGroup('items', 'Items', { display: 'dataTable' });
    project.undo();
    expect(project.itemAt('items')).toBeUndefined();
  });

  it('without display mode uses single dispatch', () => {
    const project = createProject();
    project.addGroup('section', 'Section');
    expect(project.itemAt('section')?.type).toBe('group');
  });
});
```

- [ ] **Step 2: Write failing tests for addContent**

```typescript
describe('addContent', () => {
  it('adds display content with default kind (paragraph)', () => {
    const project = createProject();
    const result = project.addContent('intro', 'Welcome to the form');
    expect(result.affectedPaths).toEqual(['intro']);
    const item = project.itemAt('intro');
    expect(item?.type).toBe('display');
    expect(item?.label).toBe('Welcome to the form');
    expect((item as any)?.presentation?.widgetHint).toBe('paragraph');
  });

  it('adds heading content', () => {
    const project = createProject();
    project.addContent('title', 'Form Title', 'heading');
    expect((project.itemAt('title') as any)?.presentation?.widgetHint).toBe('heading');
  });

  it('maps "instructions" to "paragraph" widgetHint', () => {
    const project = createProject();
    project.addContent('instr', 'Instructions here', 'instructions');
    expect((project.itemAt('instr') as any)?.presentation?.widgetHint).toBe('paragraph');
  });

  it('maps "alert" to "banner" widgetHint', () => {
    const project = createProject();
    project.addContent('warn', 'Warning!', 'alert');
    expect((project.itemAt('warn') as any)?.presentation?.widgetHint).toBe('banner');
  });

  it('maps "banner" to "banner" widgetHint', () => {
    const project = createProject();
    project.addContent('b', 'Banner', 'banner');
    expect((project.itemAt('b') as any)?.presentation?.widgetHint).toBe('banner');
  });

  it('adds divider content', () => {
    const project = createProject();
    project.addContent('div', '', 'divider');
    expect((project.itemAt('div') as any)?.presentation?.widgetHint).toBe('divider');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/formspec-studio-core && npx vitest run tests/project-methods.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement addGroup and addContent on Project**

`addGroup`:
- Without display: single `this.raw.dispatch({ type: 'definition.addItem', payload: { key, type: 'group', label, parentPath?, insertIndex? } })`
- With display: `this.raw.batchWithRebuild(phase1: [addItem], phase2: [component.setGroupDisplayMode { node: { bind: key }, mode: display }])`

`addContent`:
- Kind → widgetHint mapping: `heading` → `heading`, `instructions` | `paragraph` → `paragraph`, `divider` → `divider`, `alert` | `banner` → `banner`, default (no kind) → `paragraph`
- Single dispatch: `definition.addItem { key, type: 'display', label: body, presentation: { widgetHint: mappedHint } }`

- [ ] **Step 5: Run tests to verify they pass**
- [ ] **Step 6: Commit**

```bash
git commit -m "feat: implement addGroup and addContent helpers"
```

---

## Chunk 3: Bind Helpers and Validation

### Task 7: Implement showWhen, readonlyWhen, require, calculate

**Files:**
- Modify: `packages/formspec-studio-core/src/project-wrapper.ts`
- Test: Add to `packages/formspec-studio-core/tests/project-methods.test.ts`

- [ ] **Step 1: Write failing tests**

Test coverage:
1. `showWhen` dispatches `definition.setBind { path: target, properties: { relevant: condition } }`
2. `readonlyWhen` dispatches `definition.setBind { path: target, properties: { readonly: condition } }`
3. `require` with no condition → `setBind { properties: { required: 'true()' } }`
4. `require` with condition → `setBind { properties: { required: condition } }`
5. `calculate` dispatches `setBind { properties: { calculate: expression } }`
6. All four validate FEL expression → `INVALID_FEL` on bad expression
7. `PATH_NOT_FOUND` on nonexistent target

- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Implement**

Each method: pre-validate target exists (→ PATH_NOT_FOUND), parse FEL expression via `this.parseFEL()` (→ INVALID_FEL if invalid), dispatch `definition.setBind`, return HelperResult.

- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat: implement showWhen, readonlyWhen, require, calculate bind helpers"
```

---

### Task 8: Implement branch

**Files:**
- Modify: `packages/formspec-studio-core/src/project-wrapper.ts`
- Test: Add to `packages/formspec-studio-core/tests/project-methods.test.ts`

- [ ] **Step 1: Write failing tests for branch**

Test coverage:
1. Basic branch with choice field — sets relevant expressions on target paths
2. multiChoice auto-detection: uses `selected(on, when)` not `contains()`
3. `otherwise` arm constructs `not(on = 'a' or on = 'b')`
4. `otherwise` visible when field unset (empty string matches no equality branch)
5. Boolean when values: `on = true()` / `on = false()`
6. Number when values: `on = 42`
7. String when values: `on = 'value'`
8. `PATH_NOT_FOUND` when `on` field doesn't exist
9. `RELEVANT_OVERWRITTEN` warning when target already has relevant bind
10. Branch across multiple show targets per path
11. FEL validation of generated expressions

- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Implement branch**

Key implementation details:
- Auto-detect mode: look up on-field's dataType. If `multiChoice`, default mode = `'contains'` (→ `selected(on, when)`). Otherwise `'equals'`.
- Build FEL expressions per mode:
  - `equals`: string → `on = 'value'`, number → `on = 42`, boolean → `on = true()` / `on = false()`
  - `contains`: `selected(on, when)`
- For `otherwise`: `not(expr1 or expr2 or ...)`
- Check for existing relevant binds → emit `RELEVANT_OVERWRITTEN` warning
- Dispatch multiple `definition.setBind { relevant }` calls via `this.raw.dispatch([...])`

- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat: implement branch helper with multiChoice auto-detection"
```

---

### Task 9: Implement addValidation, removeValidation, updateValidation

**Files:**
- Modify: `packages/formspec-studio-core/src/project-wrapper.ts`
- Test: Add to `packages/formspec-studio-core/tests/project-methods.test.ts`

- [ ] **Step 1: Write failing tests**

Test coverage:
1. `addValidation` dispatches `definition.addShape` with correct mapping: rule → constraint
2. `createdId` = shape ID, `affectedPaths[0]` = shape ID
3. `INVALID_FEL` on bad rule expression
4. `removeValidation` dispatches `definition.deleteShape { id }`
5. `updateValidation` dispatches `definition.setShapeProperty` per changed key
6. `updateValidation`: `changes.rule` dispatches as `{ property: 'constraint', value }` (not 'rule')
7. `removeValidation` doesn't affect adjacent shapes

- [ ] **Step 2–5: Red/green/commit cycle**

```bash
git commit -m "feat: implement addValidation, removeValidation, updateValidation"
```

---

## Chunk 4: Structural Operations

### Task 10: Implement removeItem with full reference cleanup

**Files:**
- Modify: `packages/formspec-studio-core/src/project-wrapper.ts`
- Test: Add to `packages/formspec-studio-core/tests/project-methods.test.ts`

This is the most complex helper. Algorithm per spec:
1. Collect full dependent set BEFORE any mutations (`fieldDependents` for target + all descendants)
2. Classify dependents: bind properties on OTHER items, shapes, variables, mapping rules, screener routes
3. Dispatch ALL cleanups + deleteItem as single atomic `this.raw.dispatch([...])`

- [ ] **Step 1: Write failing tests**

Test coverage:
1. Basic removeItem — item deleted
2. removeItem on field with bind entries — binds cleaned up by deleteItem handler
3. removeItem on field referenced by another field's calculate — that calculate bind null-deleted
4. removeItem on field referenced by a shape rule — shape deleted
5. removeItem on group — recursive cleanup of all descendants' references
6. Single undo entry — undo restores item AND all cleaned-up references
7. Atomic: if deleteItem throws, all cleanups also rolled back
8. PATH_NOT_FOUND for nonexistent path
9. removeItem on field referenced in mapping rule — `mapping.deleteRule` dispatched (if handler exists)
10. Multiple mapping rules: deleted in descending index order (no index shift corruption)
11. removeItem on field referenced in screener route — `definition.deleteRoute` dispatched

- [ ] **Step 2–5: Red/green/commit cycle**

```bash
git commit -m "feat: implement removeItem with full FEL reference cleanup"
```

---

### Task 11: Implement updateItem

**Files:**
- Modify: `packages/formspec-studio-core/src/project-wrapper.ts`
- Test: Add to `packages/formspec-studio-core/tests/project-methods.test.ts`

- [ ] **Step 1: Write failing tests**

Test coverage per spec routing table:
1. `label`, `hint`, `description`, `placeholder`, `ariaLabel` → `definition.setItemProperty`
2. `options`, `choicesFrom` (→ property: `'optionSet'`) → `definition.setItemProperty`
3. `initialValue`, `prePopulate` → `definition.setItemProperty` (NOT setBind!)
4. `dataType` → `definition.setFieldDataType`
5. `required: true` → `setBind { required: 'true()' }` (boolean coercion)
6. `required: false` → `setBind { required: null }` (null-deletion)
7. `required: 'age > 18'` → `setBind { required: 'age > 18' }` (FEL passthrough)
8. `readonly`: same pattern as required
9. `constraint`, `constraintMessage`, `calculate`, `relevant`, `default` → `setBind`
10. `repeatable`, `minRepeat`, `maxRepeat` → `setItemProperty`
11. `widget` → BOTH `component.setFieldWidget` AND `definition.setItemProperty(presentation.widgetHint)`
12. `widget` with absent component node → `COMPONENT_NODE_NOT_FOUND` warning, widgetHint still set
13. `style` → `theme.setItemOverride` (uses leaf key)
14. `page` → `pages.assignItem`
15. Unknown key → `INVALID_KEY` with `detail.validKeys`
16. PATH_NOT_FOUND for nonexistent path

- [ ] **Step 2–5: Red/green/commit cycle**

```bash
git commit -m "feat: implement updateItem with full routing table"
```

---

### Task 12: Implement moveItem, renameItem, reorderItem, wrapItemsInGroup, batchDeleteItems, batchDuplicateItems

**Files:**
- Modify: `packages/formspec-studio-core/src/project-wrapper.ts`
- Test: Add to `packages/formspec-studio-core/tests/project-methods.test.ts`

- [ ] **Step 1: Write failing tests**

Test coverage:
1. `moveItem` dispatches `definition.moveItem { sourcePath, targetParentPath, targetIndex }`
2. `renameItem` — `affectedPaths[0]` = new full path for root and nested items
3. `reorderItem('contact.email', 'up')` — swaps with previous sibling
4. `reorderItem` — no-op if already at boundary (first/last)
5. `wrapItemsInGroup` — single item: group at correct position, item moved in
6. `wrapItemsInGroup` — multi: all items moved, descendant deduplication
7. `wrapItemsInGroup` — `PATH_NOT_FOUND` for missing path
8. `batchDeleteItems` — ancestor deduplication, deepest-first ordering, single undo entry
9. `batchDuplicateItems` — ancestor deduplication, affectedPaths contains all new paths

- [ ] **Step 2–5: Red/green/commit cycle**

```bash
git commit -m "feat: implement structural helpers (move, rename, reorder, wrap, batch)"
```

---

### Task 13: Implement copyItem (shallow and deep)

**Files:**
- Modify: `packages/formspec-studio-core/src/project-wrapper.ts`
- Test: Add to `packages/formspec-studio-core/tests/project-methods.test.ts`

- [ ] **Step 1: Write failing tests**

Test coverage:
1. `copyItem(path)` shallow — `definition.duplicateItem` dispatched, `affectedPaths[0]` = new path
2. Shallow copy warnings: `BINDS_NOT_COPIED`, `SHAPES_NOT_COPIED` with counts
3. `copyItem(path, true)` deep — binds copied with rewritten paths
4. Deep copy — shapes copied with rewritten target and rule
5. Deep copy — FEL rewriting uses `rewriteFELReferences`; self-references rewritten
6. Deep copy — shape IDs are new auto-generated IDs
7. Deep copy — batchWithRebuild atomicity: single undo entry

- [ ] **Step 2–5: Red/green/commit cycle**

```bash
git commit -m "feat: implement copyItem with shallow and deep modes"
```

---

## Chunk 5: Pages, Layout, Metadata

### Task 14: Implement page helpers

**Files:**
- Modify: `packages/formspec-studio-core/src/project-wrapper.ts`
- Test: Add to `packages/formspec-studio-core/tests/project-methods.test.ts`

- [ ] **Step 1: Write failing tests**

Test coverage:
1. `addPage` → `pages.addPage`, `createdId` = page ID from `state.theme.pages`
2. `addWizardPage` → `definition.addItem` group + sets `pageMode` to `'wizard'` if not already paged
3. `addWizardPage` when already wizard → no pageMode dispatch
4. `removePage` → `pages.deletePage`
5. `reorderPage` — no-op at boundary; correct swap
6. `updatePage` → `pages.setPageProperty` per key
7. `placeOnPage` → `pages.assignItem` with leaf key
8. `unplaceFromPage` → `pages.unassignItem`
9. `setFlow` → `pages.setMode` + `component.setWizardProperty` per `FlowProps` key
10. `addPage` vs `addWizardPage` — different handler chains, independent

- [ ] **Step 2–5: Red/green/commit cycle**

```bash
git commit -m "feat: implement page helpers (addPage, addWizardPage, removePage, setFlow, etc.)"
```

---

### Task 15: Implement layout helpers

**Files:**
- Modify: `packages/formspec-studio-core/src/project-wrapper.ts`
- Test: Add to `packages/formspec-studio-core/tests/project-methods.test.ts`

- [ ] **Step 1: Write failing tests**

Test coverage:
1. `applyLayout('columns-2')` → `Grid { columns: 2 }` + component.moveNode per target
2. `applyStyle` → `theme.setItemOverride` per property (uses leaf key, not full path)
3. `applyStyle` emits `AMBIGUOUS_ITEM_KEY` warning when leaf key shared
4. `applyStyleAll('form', props)` → `theme.setDefaults` per property
5. `applyStyleAll({ type: 'field' }, props)` → `theme.addSelector` per property
6. `wrapInLayoutComponent` → `component.wrapNode`, `createdId` = wrapper node ID

- [ ] **Step 2–5: Red/green/commit cycle**

```bash
git commit -m "feat: implement layout helpers (applyLayout, applyStyle, wrapInLayoutComponent)"
```

---

### Task 16: Implement metadata helpers

**Files:**
- Modify: `packages/formspec-studio-core/src/project-wrapper.ts`
- Test: Add to `packages/formspec-studio-core/tests/project-methods.test.ts`

- [ ] **Step 1: Write failing tests**

Test coverage:
1. `setMetadata({ title })` → `definition.setFormTitle`
2. `setMetadata({ name, description, url })` → `definition.setDefinitionProperty`
3. `setMetadata({ density, labelPosition, pageMode })` → `definition.setFormPresentation`
4. `setMetadata({ submitMode: 'auto' })` → `INVALID_KEY` at runtime
5. `setMetadata({ language: 'en' })` → `INVALID_KEY` at runtime
6. `makeRepeatable` on a group → `definition.setItemProperty` + `component.setGroupRepeatable` + addLabel/removeLabel
7. `makeRepeatable` on a field → `INVALID_TARGET_TYPE`
8. `defineChoices` → `definition.setOptionSet`
9. `addSubmitButton()` → `component.addNode` with `parent: { nodeId: 'root' }`
10. `addSubmitButton` with pageId → also `pages.assignItem`

- [ ] **Step 2–5: Red/green/commit cycle**

```bash
git commit -m "feat: implement metadata helpers (setMetadata, makeRepeatable, defineChoices, addSubmitButton)"
```

---

## Chunk 6: Variables, Instances, Screener

### Task 17: Implement variable helpers

**Files:**
- Modify: `packages/formspec-studio-core/src/project-wrapper.ts`
- Test: Add to `packages/formspec-studio-core/tests/project-methods.test.ts`

- [ ] **Step 1: Write failing tests**

Test coverage:
1. `addVariable` → `definition.addVariable { name, expression, scope? }`
2. `updateVariable` → `definition.setVariable { name, property: 'expression', value }`
3. `removeVariable` → `definition.deleteVariable` + `DANGLING_REFERENCES` warning with paths
4. `renameVariable` → `definition.renameVariable` (verify handler exists; if not, skip with note)

- [ ] **Step 2–5: Red/green/commit cycle**

```bash
git commit -m "feat: implement variable helpers"
```

---

### Task 18: Implement instance helpers

**Files:**
- Modify: `packages/formspec-studio-core/src/project-wrapper.ts`
- Test: Add to `packages/formspec-studio-core/tests/project-methods.test.ts`

- [ ] **Step 1: Write failing tests**

Test coverage:
1. `addInstance` → `definition.addInstance { name, ...props }`
2. `updateInstance` → `definition.setInstance { name, property, value }` per key
3. `renameInstance` → `definition.renameInstance { name, newName }`
4. `removeInstance` → `definition.deleteInstance` + `DANGLING_REFERENCES` warning

- [ ] **Step 2–5: Red/green/commit cycle**

```bash
git commit -m "feat: implement instance helpers"
```

---

### Task 19: Implement screener helpers

**Files:**
- Modify: `packages/formspec-studio-core/src/project-wrapper.ts`
- Test: Add to `packages/formspec-studio-core/tests/project-methods.test.ts`

- [ ] **Step 1: Write failing tests**

Test coverage:
1. `setScreener` → `definition.setScreener`
2. `addScreenField` → `definition.addScreenerItem` + optional `definition.setScreenerBind`
3. `removeScreenField` → `definition.deleteScreenerItem`
4. `addScreenRoute` → `definition.addRoute`
5. `updateScreenRoute` → `definition.setRouteProperty` per key
6. `reorderScreenRoute` → `definition.reorderRoute`
7. `removeScreenRoute` → `definition.deleteRoute`
8. `removeScreenRoute` on last route → `ROUTE_MIN_COUNT`

- [ ] **Step 2–5: Red/green/commit cycle**

```bash
git commit -m "feat: implement screener helpers"
```

---

## Chunk 7: Evaluation Helpers and Final Integration

### Task 20: Implement evaluation-helpers.ts

**Files:**
- Create: `packages/formspec-studio-core/src/evaluation-helpers.ts`
- Test: `packages/formspec-studio-core/tests/evaluation-helpers.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/evaluation-helpers.test.ts
import { describe, it, expect } from 'vitest';
import { createProject } from '../src/project-wrapper.js';
import { previewForm, validateResponse } from '../src/evaluation-helpers.js';

describe('previewForm', () => {
  it('returns visible fields for a simple form', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.addField('age', 'Age', 'integer');
    const preview = previewForm(project);
    expect(preview.visibleFields).toContain('name');
    expect(preview.visibleFields).toContain('age');
    expect(preview.hiddenFields).toEqual([]);
  });

  it('reflects scenario values', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    const preview = previewForm(project, { name: 'Alice' });
    expect(preview.currentValues.name).toBe('Alice');
  });

  it('shows conditionally hidden fields', () => {
    const project = createProject();
    project.addField('show_extra', 'Show Extra?', 'boolean');
    project.addField('extra', 'Extra Field', 'text');
    project.showWhen('extra', 'show_extra = true()');
    const preview = previewForm(project, { show_extra: false });
    expect(preview.hiddenFields.map(h => h.path)).toContain('extra');
  });
});

describe('validateResponse', () => {
  it('returns valid report for complete response', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    const report = validateResponse(project, { name: 'Alice' });
    expect(report.valid).toBe(true);
    expect(report.counts.error).toBe(0);
  });

  it('returns invalid report for missing required field', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text', { required: true });
    const report = validateResponse(project, {});
    expect(report.valid).toBe(false);
    expect(report.counts.error).toBeGreaterThan(0);
  });

  it('returns report with proper structure', () => {
    const project = createProject();
    project.addField('f', 'F', 'text');
    const report = validateResponse(project, {});
    expect(report).toHaveProperty('valid');
    expect(report).toHaveProperty('counts');
    expect(report).toHaveProperty('results');
    expect(report.counts).toHaveProperty('error');
    expect(report.counts).toHaveProperty('warning');
    expect(report.counts).toHaveProperty('info');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Implement**

`previewForm(project, scenario?)`:
1. Export definition: `project.export().definition`
2. Create FormEngine: `new FormEngine(definition)`
3. Replay scenario values: `engine.setValue(path, value)` per entry
4. Collect visible/hidden fields from `engine.relevantSignals`
5. Collect current values from `engine.signals`
6. Collect required fields from `engine.requiredSignals`
7. Build return object

`validateResponse(project, response)`:
1. Export definition: `project.export().definition`
2. Create FormEngine: `new FormEngine(definition)`
3. Set values from response
4. Call `engine.getValidationReport({ mode: 'submit' })`
5. Return the report

- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat: implement previewForm and validateResponse evaluation helpers"
```

---

### Task 21: Cutover — replace existing project.ts and update exports

This is the final integration step. All tests must pass before this.

**Files:**
- Delete: `packages/formspec-studio-core/src/project.ts` (old Project class)
- Rename: `packages/formspec-studio-core/src/project-wrapper.ts` → `packages/formspec-studio-core/src/project.ts`
- Modify: `packages/formspec-studio-core/src/index.ts` (update exports)
- Modify: Test imports in `tests/project-methods.test.ts` and `tests/evaluation-helpers.test.ts`
- Modify: Test imports in `tests/raw-project.test.ts`

- [ ] **Step 1: Verify all new tests pass**

Run: `cd packages/formspec-studio-core && npx vitest run tests/raw-project.test.ts tests/project-methods.test.ts tests/evaluation-helpers.test.ts`
Expected: ALL PASS

- [ ] **Step 2: Perform cutover**

1. Delete old `project.ts`
2. Rename `project-wrapper.ts` → `project.ts`
3. Update all test imports: `'../src/project-wrapper.js'` → `'../src/index.js'`
4. Update `index.ts` exports:
   ```typescript
   export { Project, createProject } from './project.js';
   export { RawProject, createRawProject } from './raw-project.js';
   export { HelperError, type HelperResult, type HelperWarning, type FieldProps, ... } from './helper-types.js';
   export { previewForm, validateResponse } from './evaluation-helpers.js';
   export { resolveItemLocation } from './handlers/helpers.js';
   ```

- [ ] **Step 3: Run full test suite (old + new)**

Run: `cd packages/formspec-studio-core && npx vitest run`
Expected: ALL PASS — old tests still pass because old `Project` is now `RawProject`, and new `Project` wraps it. Old test imports from `./index.js` which re-exports `Project` from the new file — the API surface is compatible (new Project proxies all RawProject query methods).

Note: Old tests that use `createProject()` will get the new `Project` wrapper. Since `Project` proxies all read methods and `dispatch` is accessed via `project.raw.dispatch()`, old tests that call `project.dispatch()` directly will fail. Fix: update old tests to use `project.raw.dispatch()` OR `createRawProject()`.

- [ ] **Step 4: Build**

Run: `cd packages/formspec-studio-core && npm run build`
Expected: Clean build

- [ ] **Step 5: Commit**

```bash
git add -A packages/formspec-studio-core/
git commit -m "feat: cutover to new Project class wrapping RawProject — all helpers live"
```

---

## Execution Notes

- **Test command:** `cd packages/formspec-studio-core && npx vitest run tests/<file>.test.ts`
- **Build command:** `cd packages/formspec-studio-core && npm run build`
- **Full suite:** `cd packages/formspec-studio-core && npx vitest run`
- **Spec reference:** `docs/superpowers/specs/2026-03-14-formspec-studio-core-helpers.md`
- **TDD is mandatory:** Every step starts with a failing test. No implementation before RED.
- **Behavioral tests only:** Assert what the form looks like after the operation, not what commands were dispatched.
- **New files only:** Do not modify existing source files until Task 21 cutover.
- **All authoring methods on Project:** No separate helper modules — methods live directly on the Project class in `project-wrapper.ts`.
