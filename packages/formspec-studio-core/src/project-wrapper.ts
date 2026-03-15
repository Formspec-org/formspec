import { RawProject } from './raw-project.js';
import type {
  ProjectOptions,
  AnyCommand,
} from './types.js';
import {
  HelperError,
  type HelperResult,
  type HelperWarning,
  type FieldProps,
  type GroupProps,
  type BranchPath,
  type ValidationOptions,
  type RepeatProps,
  type ChoiceOption,
  type FlowProps,
  type PlacementOptions,
  type LayoutArrangement,
  type InstanceProps,
  type ItemChanges,
  type MetadataChanges,
} from './helper-types.js';
import { resolveFieldType, resolveWidget, widgetHintFor, isTextareaWidget } from './field-type-aliases.js';
import { rewriteFELReferences } from 'formspec-engine';

/**
 * Behavior-driven interface for form authoring.
 * Extends RawProject, adding form-author-friendly methods.
 * All authoring methods return HelperResult.
 */
export class Project extends RawProject {
  /** Backwards-compatible self-reference (composition → inheritance migration). */
  get raw(): this { return this; }

  /** Simple edit distance for fuzzy path matching. */
  private static _editDistance(a: string, b: string): number {
    if (a === b) return 0;
    const la = a.length, lb = b.length;
    if (la === 0) return lb;
    if (lb === 0) return la;
    const dp: number[][] = Array.from({ length: la + 1 }, () => Array(lb + 1).fill(0));
    for (let i = 0; i <= la; i++) dp[i][0] = i;
    for (let j = 0; j <= lb; j++) dp[0][j] = j;
    for (let i = 1; i <= la; i++) {
      for (let j = 1; j <= lb; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[la][lb];
  }

  /** Find field paths similar to the given (nonexistent) path. */
  private _findSimilarPaths(path: string, maxDistance = 3): string[] {
    const allPaths = this.fieldPaths();
    // Also include group paths
    const allItems = this.state.definition.items;
    const collectPaths = (items: any[], prefix?: string): string[] => {
      const result: string[] = [];
      for (const item of items) {
        const fullPath = prefix ? `${prefix}.${item.key}` : item.key;
        result.push(fullPath);
        if (item.children?.length) {
          result.push(...collectPaths(item.children, fullPath));
        }
      }
      return result;
    };
    const allKnownPaths = [...new Set([...allPaths, ...collectPaths(allItems)])];

    return allKnownPaths
      .map(p => ({ path: p, dist: Project._editDistance(path.toLowerCase(), p.toLowerCase()) }))
      .filter(({ dist }) => dist <= maxDistance && dist > 0)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5)
      .map(({ path }) => path);
  }

  /** Throw PATH_NOT_FOUND with similarPaths detail. */
  private _throwPathNotFound(path: string): never {
    const similarPaths = this._findSimilarPaths(path);
    throw new HelperError('PATH_NOT_FOUND', `Item not found at path "${path}"`, {
      path,
      ...(similarPaths.length > 0 ? { similarPaths } : {}),
    });
  }

  // ── Authoring methods ──

  /**
   * Add a data collection field.
   * Resolves type alias → { dataType, defaultWidget } via the Field Type Alias Table.
   * Widget in props resolved via the Widget Alias Table before dispatch.
   */
  addField(path: string, label: string, type: string, props?: FieldProps): HelperResult {
    // Pre-validation
    const resolved = resolveFieldType(type);
    let resolvedWidget = resolved.defaultWidget;
    let widgetAlias: string | undefined;

    if (props?.widget) {
      resolvedWidget = resolveWidget(props.widget);
      widgetAlias = props.widget;
    }

    if (props?.choices && props?.choicesFrom) {
      throw new HelperError('INVALID_PROPS', 'Cannot set both choices and choicesFrom', {
        choices: props.choices,
        choicesFrom: props.choicesFrom,
      });
    }

    if (props?.page) {
      const pages = this.state.theme.pages;
      const pageExists = pages?.some((p: any) => p.id === props.page);
      if (!pageExists) {
        throw new HelperError('PAGE_NOT_FOUND', `Page "${props.page}" does not exist`, {
          pageId: props.page,
        });
      }
    }

    // Parse path: last segment = key, preceding = parentPath
    let parentPath = props?.parentPath;
    let key: string;
    if (parentPath) {
      key = path;
    } else {
      const segments = path.split('.');
      key = segments.pop()!;
      parentPath = segments.length > 0 ? segments.join('.') : undefined;
    }

    // Compute the full path for bind operations
    const fullPath = parentPath ? `${parentPath}.${key}` : key;

    // Build phase1: definition.addItem
    const addItemPayload: Record<string, unknown> = {
      type: 'field',
      key,
      label,
      dataType: resolved.dataType,
    };
    if (parentPath) addItemPayload.parentPath = parentPath;
    if (props?.insertIndex !== undefined) addItemPayload.insertIndex = props.insertIndex;

    const phase1: AnyCommand[] = [
      { type: 'definition.addItem', payload: addItemPayload },
    ];

    // Build phase2: component + binds + properties
    const phase2: AnyCommand[] = [
      { type: 'component.setFieldWidget', payload: { fieldKey: key, widget: resolvedWidget } },
    ];

    // textarea needs extra widgetHint
    if (widgetAlias && isTextareaWidget(widgetAlias)) {
      phase2.push({
        type: 'component.setNodeProperty',
        payload: { node: { bind: key }, property: 'widgetHint', value: 'textarea' },
      });
    }

    // Widget hint on definition for round-trip
    const hint = widgetAlias ? widgetHintFor(widgetAlias) : widgetHintFor(resolvedWidget);
    if (hint) {
      phase2.push({
        type: 'definition.setItemProperty',
        payload: { path: fullPath, property: 'presentation.widgetHint', value: hint },
      });
    }

    // Required
    if (props?.required) {
      phase2.push({
        type: 'definition.setBind',
        payload: { path: fullPath, properties: { required: 'true' } },
      });
    }

    // Readonly
    if (props?.readonly) {
      phase2.push({
        type: 'definition.setBind',
        payload: { path: fullPath, properties: { readonly: 'true' } },
      });
    }

    // Semantic type constraint (email, phone)
    if (resolved.constraintExpr) {
      // Rewrite the expression to use the actual field path
      const constraintExpr = resolved.constraintExpr.replace(
        /matches\(\w+,/,
        `matches(${fullPath},`,
      );
      phase2.push({
        type: 'definition.setBind',
        payload: { path: fullPath, properties: { constraint: constraintExpr } },
      });
    }

    // Initial value
    if (props?.initialValue !== undefined && props?.initialValue !== null) {
      phase2.push({
        type: 'definition.setItemProperty',
        payload: { path: fullPath, property: 'initialValue', value: props.initialValue },
      });
    }

    // Inline choices
    if (props?.choices) {
      phase2.push({
        type: 'definition.setItemProperty',
        payload: { path: fullPath, property: 'options', value: props.choices },
      });
    }

    // Named option set
    if (props?.choicesFrom) {
      phase2.push({
        type: 'definition.setItemProperty',
        payload: { path: fullPath, property: 'optionSet', value: props.choicesFrom },
      });
    }

    // Page assignment
    if (props?.page) {
      phase2.push({
        type: 'pages.assignItem',
        payload: { pageId: props.page, key },
      });
    }

    // Item properties
    if (props?.hint) {
      addItemPayload.hint = props.hint;
    }
    if (props?.description) {
      addItemPayload.description = props.description;
    }
    if (props?.placeholder) {
      addItemPayload.placeholder = props.placeholder;
    }
    if (props?.ariaLabel) {
      addItemPayload.ariaLabel = props.ariaLabel;
    }

    // Dispatch
    this.batchWithRebuild(phase1, phase2);

    return {
      summary: `Added field '${key}' (${type}) to ${parentPath ? `'${parentPath}'` : 'root'}`,
      action: { helper: 'addField', params: { path: fullPath, label, type } },
      affectedPaths: [fullPath],
    };
  }

  /** Add a group/section container. */
  addGroup(path: string, label: string, props?: GroupProps): HelperResult {
    const segments = path.split('.');
    const key = segments.pop()!;
    const parentPath = segments.length > 0 ? segments.join('.') : undefined;
    const fullPath = parentPath ? `${parentPath}.${key}` : key;

    const addItemPayload: Record<string, unknown> = {
      type: 'group',
      key,
      label,
    };
    if (parentPath) addItemPayload.parentPath = parentPath;

    if (props?.display) {
      // Two-phase: addItem triggers rebuild, then setGroupDisplayMode on rebuilt tree
      this.batchWithRebuild(
        [{ type: 'definition.addItem', payload: addItemPayload }],
        [{ type: 'component.setGroupDisplayMode', payload: { groupKey: key, mode: props.display } }],
      );
    } else {
      // Single dispatch — no component tree dependency
      this.dispatch({ type: 'definition.addItem', payload: addItemPayload });
    }

    return {
      summary: `Added group '${key}' to ${parentPath ? `'${parentPath}'` : 'root'}`,
      action: { helper: 'addGroup', params: { path: fullPath, label, display: props?.display } },
      affectedPaths: [fullPath],
    };
  }

  /** Add display content — non-data element. */
  addContent(
    path: string,
    body: string,
    kind?: 'heading' | 'instructions' | 'paragraph' | 'alert' | 'banner' | 'divider',
  ): HelperResult {
    // Kind → widgetHint mapping
    const kindToHint: Record<string, string> = {
      heading: 'heading',
      instructions: 'paragraph',
      paragraph: 'paragraph',
      alert: 'banner',
      banner: 'banner',
      divider: 'divider',
    };
    const widgetHint = kindToHint[kind ?? 'paragraph'] ?? 'paragraph';

    const segments = path.split('.');
    const key = segments.pop()!;
    const parentPath = segments.length > 0 ? segments.join('.') : undefined;
    const fullPath = parentPath ? `${parentPath}.${key}` : key;

    const payload: Record<string, unknown> = {
      type: 'display',
      key,
      label: body,
      presentation: { widgetHint },
    };
    if (parentPath) payload.parentPath = parentPath;

    this.dispatch({ type: 'definition.addItem', payload });

    return {
      summary: `Added ${kind ?? 'paragraph'} content '${key}'`,
      action: { helper: 'addContent', params: { path: fullPath, body, kind } },
      affectedPaths: [fullPath],
    };
  }

  // ── Bind Helpers ──

  /** Validate a FEL expression string, throwing INVALID_FEL if it fails to parse. */
  private _validateFEL(expression: string): void {
    const result = this.parseFEL(expression);
    if (!result.valid) {
      throw new HelperError('INVALID_FEL', `Invalid FEL expression: ${expression}`, {
        expression,
        parseError: result.errors[0] ? {
          message: result.errors[0].message,
          offset: (result.errors[0] as any).offset,
          errorType: (result.errors[0] as any).errorType,
        } : undefined,
      });
    }
  }

  /** Conditional visibility — dispatches definition.setBind { relevant: condition } */
  showWhen(target: string, condition: string): HelperResult {
    this._validateFEL(condition);
    this.dispatch({
      type: 'definition.setBind',
      payload: { path: target, properties: { relevant: condition } },
    });
    return {
      summary: `Set '${target}' visible when: ${condition}`,
      action: { helper: 'showWhen', params: { target, condition } },
      affectedPaths: [target],
    };
  }

  /** Readonly condition — dispatches definition.setBind { readonly: condition } */
  readonlyWhen(target: string, condition: string): HelperResult {
    this._validateFEL(condition);
    this.dispatch({
      type: 'definition.setBind',
      payload: { path: target, properties: { readonly: condition } },
    });
    return {
      summary: `Set '${target}' readonly when: ${condition}`,
      action: { helper: 'readonlyWhen', params: { target, condition } },
      affectedPaths: [target],
    };
  }

  /** Required rule — dispatches definition.setBind { required: condition ?? 'true()' } */
  require(target: string, condition?: string): HelperResult {
    const expr = condition ?? 'true';
    this._validateFEL(expr);
    this.dispatch({
      type: 'definition.setBind',
      payload: { path: target, properties: { required: expr } },
    });
    return {
      summary: `Set '${target}' required${condition ? ` when: ${condition}` : ''}`,
      action: { helper: 'require', params: { target, condition } },
      affectedPaths: [target],
    };
  }

  /** Calculated value — dispatches definition.setBind { calculate: expression } */
  calculate(target: string, expression: string): HelperResult {
    this._validateFEL(expression);
    this.dispatch({
      type: 'definition.setBind',
      payload: { path: target, properties: { calculate: expression } },
    });
    return {
      summary: `Set '${target}' calculated as: ${expression}`,
      action: { helper: 'calculate', params: { target, expression } },
      affectedPaths: [target],
    };
  }

  // ── Branch ──

  /** Build a FEL expression for a single branch arm. */
  private _branchExpr(on: string, when: string | number | boolean, mode: 'equals' | 'contains'): string {
    if (mode === 'contains') {
      return typeof when === 'string' ? `selected(${on}, '${when}')` : `selected(${on}, ${when})`;
    }
    // equals mode
    if (typeof when === 'string') return `${on} = '${when}'`;
    if (typeof when === 'boolean') return `${on} = ${when}`;
    return `${on} = ${when}`;
  }

  /**
   * Branching — show different fields based on an answer.
   * Auto-detects mode for multiChoice fields (uses selected() not equals).
   */
  branch(on: string, paths: BranchPath[], otherwise?: string | string[]): HelperResult {
    // Pre-validate: on field must exist
    const onItem = this.itemAt(on);
    if (!onItem) {
      this._throwPathNotFound(on);
    }

    // Auto-detect mode based on on-field dataType
    const isMultiChoice = onItem.dataType === 'multiChoice';
    const defaultMode = isMultiChoice ? 'contains' as const : 'equals' as const;

    const warnings: HelperWarning[] = [];
    const allExprs: string[] = [];
    const commands: AnyCommand[] = [];

    for (const arm of paths) {
      const mode = arm.mode ?? defaultMode;
      const expr = this._branchExpr(on, arm.when, mode);
      allExprs.push(expr);

      const targets = Array.isArray(arm.show) ? arm.show : [arm.show];
      for (const target of targets) {
        // Check for existing relevant bind → warning
        const existingBind = this.bindFor(target);
        if (existingBind?.relevant) {
          warnings.push({
            code: 'RELEVANT_OVERWRITTEN',
            message: `Existing relevant expression on "${target}" was replaced`,
            detail: { path: target, previousExpression: existingBind.relevant },
          });
        }

        commands.push({
          type: 'definition.setBind',
          payload: { path: target, properties: { relevant: expr } },
        });
      }
    }

    // Otherwise arm
    if (otherwise) {
      const otherwiseTargets = Array.isArray(otherwise) ? otherwise : [otherwise];
      const negatedExpr = allExprs.length === 1
        ? `not(${allExprs[0]})`
        : `not(${allExprs.join(' or ')})`;

      for (const target of otherwiseTargets) {
        const existingBind = this.bindFor(target);
        if (existingBind?.relevant) {
          warnings.push({
            code: 'RELEVANT_OVERWRITTEN',
            message: `Existing relevant expression on "${target}" was replaced`,
            detail: { path: target, previousExpression: existingBind.relevant },
          });
        }
        commands.push({
          type: 'definition.setBind',
          payload: { path: target, properties: { relevant: negatedExpr } },
        });
      }
    }

    // Dispatch all setBind commands atomically
    this.dispatch(commands);

    const affectedPaths = commands.map(c => (c.payload as any).path);
    return {
      summary: `Branch on '${on}' with ${paths.length} arm(s)`,
      action: { helper: 'branch', params: { on, paths: paths.length, otherwise: !!otherwise } },
      affectedPaths,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // ── Validation Helpers ──

  /** Cross-field validation — adds a shape rule. */
  addValidation(
    target: string,
    rule: string,
    message: string,
    options?: ValidationOptions,
  ): HelperResult {
    this._validateFEL(rule);
    if (options?.activeWhen) {
      this._validateFEL(options.activeWhen);
    }

    const payload: Record<string, unknown> = {
      target,
      constraint: rule,
      message,
    };
    if (options?.timing) payload.timing = options.timing;
    if (options?.severity) payload.severity = options.severity;
    if (options?.code) payload.code = options.code;
    if (options?.activeWhen) payload.activeWhen = options.activeWhen;

    this.dispatch({ type: 'definition.addShape', payload });

    // Read the shape ID from state (addShape appends to shapes array)
    const shapes = (this.state.definition as any).shapes ?? [];
    const createdId = shapes[shapes.length - 1]?.id as string;

    return {
      summary: `Added validation on '${target}': ${message}`,
      action: { helper: 'addValidation', params: { target, rule, message } },
      affectedPaths: [createdId],
      createdId,
    };
  }

  /** Remove a validation shape by ID. */
  removeValidation(shapeId: string): HelperResult {
    this.dispatch({ type: 'definition.deleteShape', payload: { id: shapeId } });
    return {
      summary: `Removed validation '${shapeId}'`,
      action: { helper: 'removeValidation', params: { shapeId } },
      affectedPaths: [shapeId],
    };
  }

  /** Update a validation shape's rule, message, or options. */
  updateValidation(
    shapeId: string,
    changes: {
      rule?: string;
      message?: string;
      timing?: 'continuous' | 'submit' | 'demand';
      severity?: 'error' | 'warning' | 'info';
      code?: string;
      activeWhen?: string;
    },
  ): HelperResult {
    if (changes.rule) this._validateFEL(changes.rule);
    if (changes.activeWhen) this._validateFEL(changes.activeWhen);

    const commands: AnyCommand[] = [];

    // rule → dispatches as 'constraint' (shape schema property)
    if (changes.rule !== undefined) {
      commands.push({
        type: 'definition.setShapeProperty',
        payload: { id: shapeId, property: 'constraint', value: changes.rule },
      });
    }
    if (changes.message !== undefined) {
      commands.push({
        type: 'definition.setShapeProperty',
        payload: { id: shapeId, property: 'message', value: changes.message },
      });
    }
    if (changes.timing !== undefined) {
      commands.push({
        type: 'definition.setShapeProperty',
        payload: { id: shapeId, property: 'timing', value: changes.timing },
      });
    }
    if (changes.severity !== undefined) {
      commands.push({
        type: 'definition.setShapeProperty',
        payload: { id: shapeId, property: 'severity', value: changes.severity },
      });
    }
    if (changes.code !== undefined) {
      commands.push({
        type: 'definition.setShapeProperty',
        payload: { id: shapeId, property: 'code', value: changes.code },
      });
    }
    if (changes.activeWhen !== undefined) {
      commands.push({
        type: 'definition.setShapeProperty',
        payload: { id: shapeId, property: 'activeWhen', value: changes.activeWhen },
      });
    }

    if (commands.length > 0) {
      this.dispatch(commands);
    }

    return {
      summary: `Updated validation '${shapeId}'`,
      action: { helper: 'updateValidation', params: { shapeId, ...changes } },
      affectedPaths: [shapeId],
    };
  }

  // ── Structural Helpers ──

  /**
   * Remove item — full reference cleanup before delete.
   * Collects ALL dependents BEFORE mutations, then dispatches cleanup + delete atomically.
   */
  removeItem(path: string): HelperResult {
    const item = this.itemAt(path);
    if (!item) {
      this._throwPathNotFound(path);
    }

    // Step 1: Collect dependent set upfront
    const deps = this.fieldDependents(path);

    // Also collect for descendants if item is a group
    const descendantDeps: typeof deps[] = [];
    if (item.children?.length) {
      const collectDescendantPaths = (children: any[], parentPath: string) => {
        for (const child of children) {
          const childPath = `${parentPath}.${child.key}`;
          descendantDeps.push(this.fieldDependents(childPath));
          if (child.children?.length) {
            collectDescendantPaths(child.children, childPath);
          }
        }
      };
      collectDescendantPaths(item.children, path);
    }

    // Step 2: Build cleanup commands
    const commands: AnyCommand[] = [];

    const processBindDeps = (depSet: typeof deps) => {
      // Clean up bind properties on OTHER items that reference the deleted path
      // FieldDependents.binds: { path: string; property: string }[]
      for (const bind of depSet.binds) {
        if (bind.path === path) continue; // Skip the deleted item's own binds
        commands.push({
          type: 'definition.setBind',
          payload: { path: bind.path, properties: { [bind.property]: null } },
        });
      }

      // Clean up shapes referencing the deleted path
      // FieldDependents.shapes: { id: string; property: string }[]
      for (const shape of depSet.shapes) {
        commands.push({
          type: 'definition.deleteShape',
          payload: { id: shape.id },
        });
      }

      // Clean up variables referencing the deleted path
      // FieldDependents.variables: string[]
      for (const varName of depSet.variables) {
        commands.push({
          type: 'definition.deleteVariable',
          payload: { name: varName },
        });
      }

      // Clean up mapping rules (delete in descending index order)
      // FieldDependents.mappingRules: number[]
      if (depSet.mappingRules?.length) {
        const sortedIndices = [...depSet.mappingRules].sort((a, b) => b - a);
        for (const idx of sortedIndices) {
          commands.push({
            type: 'mapping.deleteRule',
            payload: { index: idx },
          });
        }
      }
    };

    processBindDeps(deps);
    for (const dDeps of descendantDeps) {
      processBindDeps(dDeps);
    }

    // Step 3: Add the deleteItem command
    commands.push({
      type: 'definition.deleteItem',
      payload: { path },
    });

    // Dispatch atomically
    this.dispatch(commands);

    return {
      summary: `Removed item '${path}'`,
      action: { helper: 'removeItem', params: { path } },
      affectedPaths: [path],
    };
  }

  // ── Update Item ──

  /** Valid keys for updateItem. */
  private static readonly _VALID_UPDATE_KEYS = new Set([
    'label', 'hint', 'description', 'placeholder', 'ariaLabel',
    'options', 'choicesFrom', 'currency', 'precision', 'initialValue', 'prePopulate',
    'dataType', 'required', 'constraint', 'constraintMessage', 'calculate',
    'relevant', 'readonly', 'default', 'repeatable', 'minRepeat', 'maxRepeat',
    'widget', 'style', 'page',
  ]);

  /** Properties that route to definition.setItemProperty. */
  private static readonly _ITEM_PROPERTY_KEYS = new Set([
    'label', 'hint', 'description', 'placeholder', 'ariaLabel',
    'options', 'initialValue', 'prePopulate',
    'repeatable', 'minRepeat', 'maxRepeat',
    'currency', 'precision',
  ]);

  /** Properties that route to definition.setBind. */
  private static readonly _BIND_KEYS = new Set([
    'required', 'constraint', 'constraintMessage', 'calculate',
    'relevant', 'readonly', 'default',
  ]);

  /** Update any property of an existing item — fan-out helper. */
  updateItem(path: string, changes: ItemChanges): HelperResult {
    // Pre-validate: path must exist
    if (!this.itemAt(path)) {
      this._throwPathNotFound(path);
    }

    // Check for unknown keys
    for (const key of Object.keys(changes)) {
      if (!Project._VALID_UPDATE_KEYS.has(key)) {
        throw new HelperError('INVALID_KEY', `Unknown updateItem key "${key}"`, {
          invalidKey: key,
          validKeys: [...Project._VALID_UPDATE_KEYS],
        });
      }
    }

    const commands: AnyCommand[] = [];
    const leafKey = path.split('.').pop()!;

    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) continue;

      // Item property routing
      if (Project._ITEM_PROPERTY_KEYS.has(key)) {
        const property = key === 'choicesFrom' ? 'optionSet' : key;
        commands.push({
          type: 'definition.setItemProperty',
          payload: { path, property, value },
        });
        continue;
      }

      // choicesFrom special routing
      if (key === 'choicesFrom') {
        commands.push({
          type: 'definition.setItemProperty',
          payload: { path, property: 'optionSet', value },
        });
        continue;
      }

      // options special routing
      if (key === 'options') {
        commands.push({
          type: 'definition.setItemProperty',
          payload: { path, property: 'options', value },
        });
        continue;
      }

      // Bind property routing
      if (Project._BIND_KEYS.has(key)) {
        let bindValue: unknown;
        if (key === 'required' || key === 'readonly') {
          if (value === true) bindValue = 'true';
          else if (value === false) bindValue = null; // null-deletion
          else bindValue = value; // string FEL passthrough
        } else {
          bindValue = value;
        }
        commands.push({
          type: 'definition.setBind',
          payload: { path, properties: { [key]: bindValue } },
        });
        continue;
      }

      // dataType routing
      if (key === 'dataType') {
        commands.push({
          type: 'definition.setFieldDataType',
          payload: { path, dataType: value },
        });
        continue;
      }

      // widget routing — TWO dispatches
      if (key === 'widget') {
        const resolvedWidget = resolveWidget(value as string);
        const hint = widgetHintFor(value as string);

        // 1. component.setFieldWidget (may fail if node absent — emit warning)
        try {
          commands.push({
            type: 'component.setFieldWidget',
            payload: { fieldKey: leafKey, widget: resolvedWidget },
          });
        } catch {
          // Will be handled as warning
        }

        // 2. definition.setItemProperty for widgetHint (REQUIRED for round-trip)
        commands.push({
          type: 'definition.setItemProperty',
          payload: { path, property: 'presentation.widgetHint', value: hint ?? null },
        });
        continue;
      }

      // style routing → theme.setItemOverride (uses leaf key)
      if (key === 'style') {
        const styleProps = value as Record<string, unknown>;
        for (const [prop, val] of Object.entries(styleProps)) {
          commands.push({
            type: 'theme.setItemOverride',
            payload: { itemKey: leafKey, property: prop, value: val },
          });
        }
        continue;
      }

      // page routing
      if (key === 'page') {
        commands.push({
          type: 'pages.assignItem',
          payload: { pageId: value, key: leafKey },
        });
        continue;
      }
    }

    if (commands.length > 0) {
      this.dispatch(commands);
    }

    return {
      summary: `Updated item '${path}'`,
      action: { helper: 'updateItem', params: { path, changes } },
      affectedPaths: [path],
    };
  }
  // ── Move / Rename / Reorder ──

  /** Move item to a new parent or position. */
  moveItem(path: string, targetParentPath?: string, targetIndex?: number): HelperResult {
    this.dispatch({
      type: 'definition.moveItem',
      payload: { sourcePath: path, targetParentPath, targetIndex },
    });
    // Compute new path
    const leafKey = path.split('.').pop()!;
    const newPath = targetParentPath ? `${targetParentPath}.${leafKey}` : leafKey;
    return {
      summary: `Moved '${path}' to '${newPath}'`,
      action: { helper: 'moveItem', params: { path, targetParentPath, targetIndex } },
      affectedPaths: [newPath],
    };
  }

  /** Rename item — FEL reference rewriting handled inside the handler. */
  renameItem(path: string, newKey: string): HelperResult {
    this.dispatch({
      type: 'definition.renameItem',
      payload: { path, newKey },
    });
    // Compute new full path
    const segments = path.split('.');
    segments.pop();
    const newPath = segments.length > 0 ? `${segments.join('.')}.${newKey}` : newKey;
    return {
      summary: `Renamed '${path}' to '${newPath}'`,
      action: { helper: 'renameItem', params: { path, newKey } },
      affectedPaths: [newPath],
    };
  }

  /** Reorder item within its parent (swap with neighbor). */
  reorderItem(path: string, direction: 'up' | 'down'): HelperResult {
    this.dispatch({
      type: 'definition.reorderItem',
      payload: { path, direction },
    });
    return {
      summary: `Reordered '${path}' ${direction}`,
      action: { helper: 'reorderItem', params: { path, direction } },
      affectedPaths: [path],
    };
  }

  // ── Metadata ──

  /** Valid keys for setMetadata. */
  private static readonly _VALID_METADATA_KEYS = new Set([
    'title', 'name', 'description', 'url', 'version', 'status', 'date',
    'versionAlgorithm', 'nonRelevantBehavior', 'derivedFrom',
    'density', 'labelPosition', 'pageMode', 'defaultCurrency',
  ]);

  /** Keys that route to definition.setFormPresentation. */
  private static readonly _PRESENTATION_KEYS = new Set([
    'density', 'labelPosition', 'pageMode', 'defaultCurrency',
  ]);

  /** Form-level metadata setter. */
  setMetadata(changes: MetadataChanges): HelperResult {
    // Validate keys
    for (const key of Object.keys(changes)) {
      if (!Project._VALID_METADATA_KEYS.has(key)) {
        throw new HelperError('INVALID_KEY', `Unknown metadata key "${key}"`, {
          invalidKey: key,
          validKeys: [...Project._VALID_METADATA_KEYS],
        });
      }
    }

    const commands: AnyCommand[] = [];
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) continue;

      if (key === 'title') {
        commands.push({ type: 'definition.setFormTitle', payload: { title: value } });
      } else if (Project._PRESENTATION_KEYS.has(key)) {
        commands.push({ type: 'definition.setFormPresentation', payload: { property: key, value } });
      } else {
        commands.push({ type: 'definition.setDefinitionProperty', payload: { property: key, value } });
      }
    }

    if (commands.length > 0) {
      this.dispatch(commands);
    }

    return {
      summary: `Updated form metadata`,
      action: { helper: 'setMetadata', params: { changes } },
      affectedPaths: [],
    };
  }

  // ── Choices ──

  /** Define a reusable named option set. */
  defineChoices(name: string, options: ChoiceOption[]): HelperResult {
    this.dispatch({
      type: 'definition.setOptionSet',
      payload: { name, options },
    });
    return {
      summary: `Defined option set '${name}' with ${options.length} choices`,
      action: { helper: 'defineChoices', params: { name, optionCount: options.length } },
      affectedPaths: [],
    };
  }

  // ── Repeatable ──

  /** Make a group repeatable with optional cardinality constraints. */
  makeRepeatable(target: string, props?: RepeatProps): HelperResult {
    // Pre-validate: target must be a group
    const item = this.itemAt(target);
    if (!item) {
      this._throwPathNotFound(target);
    }
    if (item.type !== 'group') {
      throw new HelperError('INVALID_TARGET_TYPE', `makeRepeatable requires a group, got "${item.type}"`, {
        path: target,
        actualType: item.type,
      });
    }

    const leafKey = target.split('.').pop()!;
    const commands: AnyCommand[] = [
      { type: 'definition.setItemProperty', payload: { path: target, property: 'repeatable', value: true } },
    ];

    if (props?.min !== undefined) {
      commands.push({ type: 'definition.setItemProperty', payload: { path: target, property: 'minRepeat', value: props.min } });
    }
    if (props?.max !== undefined) {
      commands.push({ type: 'definition.setItemProperty', payload: { path: target, property: 'maxRepeat', value: props.max } });
    }

    // Component tree: toggle repeat mode
    commands.push({ type: 'component.setGroupRepeatable', payload: { groupKey: leafKey, repeatable: true } });

    // Optional labels on the component node
    if (props?.addLabel) {
      commands.push({
        type: 'component.setNodeProperty',
        payload: { node: { bind: leafKey }, property: 'addLabel', value: props.addLabel },
      });
    }
    if (props?.removeLabel) {
      commands.push({
        type: 'component.setNodeProperty',
        payload: { node: { bind: leafKey }, property: 'removeLabel', value: props.removeLabel },
      });
    }

    this.dispatch(commands);

    return {
      summary: `Made group '${target}' repeatable`,
      action: { helper: 'makeRepeatable', params: { target, ...props } },
      affectedPaths: [],
    };
  }

  // ── Copy Item ──

  /** Copy a field or group — inserts clone immediately after original. */
  copyItem(path: string, deep?: boolean): HelperResult {
    const item = this.itemAt(path);
    if (!item) {
      this._throwPathNotFound(path);
    }

    if (!deep) {
      // Shallow copy — just duplicate the definition item
      const results = this.dispatch({
        type: 'definition.duplicateItem',
        payload: { path },
      });
      const insertedPath = (results as any)?.insertedPath ?? `${path}_copy`;

      // Collect warnings about omitted binds/shapes
      const warnings: HelperWarning[] = [];
      const binds = (this.state.definition as any).binds ?? [];
      const shapes = (this.state.definition as any).shapes ?? [];

      // Find binds targeting the original path (these are NOT copied by duplicateItem)
      const matchingBinds = binds.filter((b: any) =>
        b.path === path || b.path?.startsWith(`${path}.`),
      );
      if (matchingBinds.length > 0) {
        const props = matchingBinds.flatMap((b: any) =>
          Object.keys(b).filter(k => k !== 'path'),
        );
        warnings.push({
          code: 'BINDS_NOT_COPIED',
          message: `${matchingBinds.length} bind(s) not copied`,
          detail: { count: matchingBinds.length, properties: [...new Set(props)] },
        });
      }

      // Find shapes targeting the original path
      const matchingShapes = shapes.filter((s: any) =>
        s.target === path || s.target?.startsWith(`${path}.`),
      );
      if (matchingShapes.length > 0) {
        warnings.push({
          code: 'SHAPES_NOT_COPIED',
          message: `${matchingShapes.length} shape(s) not copied`,
          detail: { count: matchingShapes.length },
        });
      }

      return {
        summary: `Copied '${path}' (shallow)`,
        action: { helper: 'copyItem', params: { path, deep: false } },
        affectedPaths: [insertedPath],
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    // Deep copy — duplicate + rewrite FEL references in binds/shapes
    const phase1: AnyCommand[] = [
      { type: 'definition.duplicateItem', payload: { path } },
    ];

    // We need batchWithRebuild: phase1 duplicates, phase2 copies binds with rewritten FEL
    // Collect bind/shape data before dispatch
    const binds = (this.state.definition as any).binds ?? [];
    const shapes = (this.state.definition as any).shapes ?? [];

    // Find binds targeting this path or descendants
    const matchingBinds = binds.filter((b: any) =>
      b.path === path || b.path?.startsWith(`${path}.`),
    );

    // Find shapes targeting this path or descendants
    const matchingShapes = shapes.filter((s: any) =>
      s.target === path || s.target?.startsWith(`${path}.`),
    );

    const results = this.batchWithRebuild(phase1, (() => {
      // After phase1, the duplicated item's path should be available
      // Read the inserted path from state — it's the item right after the original
      const items = this.state.definition.items;
      let insertedPath: string | undefined;

      // Find the copy — it should have a key ending in _copy
      const findCopy = (itemList: any[], parentPath?: string): string | undefined => {
        for (const it of itemList) {
          const fullP = parentPath ? `${parentPath}.${it.key}` : it.key;
          if (it.key.endsWith('_copy') || it.key === `${path.split('.').pop()}_copy`) {
            if (!parentPath && !path.includes('.')) return fullP;
            if (parentPath === path.split('.').slice(0, -1).join('.')) return fullP;
          }
          if (it.children?.length) {
            const found = findCopy(it.children, fullP);
            if (found) return found;
          }
        }
        return undefined;
      };
      insertedPath = findCopy(items);
      if (!insertedPath) {
        // Fallback: assume _copy suffix
        const leafKey = path.split('.').pop()!;
        const parentSegments = path.split('.').slice(0, -1);
        insertedPath = parentSegments.length > 0
          ? `${parentSegments.join('.')}.${leafKey}_copy`
          : `${leafKey}_copy`;
      }

      const newPath = insertedPath;
      const phase2: AnyCommand[] = [];

      const rewritePath = (p: string): string => {
        if (p === path) return newPath;
        if (p.startsWith(`${path}.`)) return newPath + p.slice(path.length);
        return p;
      };

      const rewriteFEL = (expr: string | undefined): string | undefined => {
        if (!expr) return expr;
        try {
          return rewriteFELReferences(expr, {
            rewriteFieldPath: (p: string) => {
              if (p === path || p.startsWith(`${path}.`)) {
                return rewritePath(p);
              }
              return p;
            },
          });
        } catch {
          return expr;
        }
      };

      // Copy binds with rewritten paths and FEL
      for (const bind of matchingBinds) {
        const newBindPath = rewritePath(bind.path);
        const rewrittenProps: Record<string, unknown> = {};
        for (const [prop, val] of Object.entries(bind)) {
          if (prop === 'path') continue;
          if (typeof val === 'string') {
            rewrittenProps[prop] = rewriteFEL(val) ?? val;
          } else {
            rewrittenProps[prop] = val;
          }
        }
        if (Object.keys(rewrittenProps).length > 0) {
          phase2.push({
            type: 'definition.setBind',
            payload: { path: newBindPath, properties: rewrittenProps },
          });
        }
      }

      // Copy shapes with rewritten targets and FEL
      for (const shape of matchingShapes) {
        const payload: Record<string, unknown> = {
          target: rewritePath(shape.target),
          constraint: rewriteFEL(shape.constraint) ?? shape.constraint,
          message: shape.message,
        };
        if (shape.timing) payload.timing = shape.timing;
        if (shape.severity) payload.severity = shape.severity;
        if (shape.code) payload.code = shape.code;
        if (shape.activeWhen) payload.activeWhen = rewriteFEL(shape.activeWhen);
        if (shape.context) {
          payload.context = shape.context.map((c: any) => ({
            ...c,
            expression: rewriteFEL(c.expression),
          }));
        }
        phase2.push({ type: 'definition.addShape', payload });
      }

      return phase2;
    })());

    // Find the new item path
    const leafKey = path.split('.').pop()!;
    const parentSegments = path.split('.').slice(0, -1);
    const newPath = parentSegments.length > 0
      ? `${parentSegments.join('.')}.${leafKey}_copy`
      : `${leafKey}_copy`;

    return {
      summary: `Copied '${path}' (deep)`,
      action: { helper: 'copyItem', params: { path, deep: true } },
      affectedPaths: [newPath],
    };
  }

  // ── Wrap Items In Group ──

  /** Wrap existing items in a new group container. */
  wrapItemsInGroup(paths: string[], label?: string): HelperResult {
    // Pre-validation
    for (const p of paths) {
      if (!this.itemAt(p)) {
        this._throwPathNotFound(p);
      }
    }

    // Descendant deduplication
    const pruned = paths.filter(p =>
      !paths.some(other => other !== p && p.startsWith(`${other}.`)),
    );

    // Generate group key
    const groupKey = `group_${Date.now()}`;
    const groupLabel = label ?? 'Group';

    // Find first item's position for the new group
    const firstPath = pruned[0];
    const firstSegments = firstPath.split('.');
    const firstItemKey = firstSegments.pop()!;
    const parentPath = firstSegments.length > 0 ? firstSegments.join('.') : undefined;

    // Find insertIndex of first item
    const parentItems = parentPath
      ? this.itemAt(parentPath)?.children ?? []
      : this.state.definition.items;
    const insertIndex = parentItems.findIndex((i: any) => i.key === firstItemKey);

    const addPayload: Record<string, unknown> = {
      type: 'group', key: groupKey, label: groupLabel,
    };
    if (parentPath) addPayload.parentPath = parentPath;
    if (insertIndex >= 0) addPayload.insertIndex = insertIndex;

    const groupPath = parentPath ? `${parentPath}.${groupKey}` : groupKey;

    const phase2 = pruned.map((p, i) => ({
      type: 'definition.moveItem' as const,
      payload: { sourcePath: p, targetParentPath: groupPath, targetIndex: i },
    }));

    this.batchWithRebuild(
      [{ type: 'definition.addItem', payload: addPayload }],
      phase2,
    );

    const movedPaths = pruned.map(p => {
      const leaf = p.split('.').pop()!;
      return `${groupPath}.${leaf}`;
    });

    return {
      summary: `Wrapped ${pruned.length} item(s) in group '${groupKey}'`,
      action: { helper: 'wrapItemsInGroup', params: { paths: pruned, label: groupLabel } },
      affectedPaths: [groupPath, ...movedPaths],
    };
  }

  // ── Wrap In Layout Component ──

  /** Wrap an item node in a layout component. */
  wrapInLayoutComponent(path: string, component: 'Card' | 'Stack' | 'Collapsible'): HelperResult {
    if (!this.itemAt(path)) {
      this._throwPathNotFound(path);
    }

    const leafKey = path.split('.').pop()!;
    const result = this.dispatch({
      type: 'component.wrapNode',
      payload: { node: { bind: leafKey }, wrapper: { component } },
    });
    const nodeId = (result as any)?.nodeRef?.nodeId;

    return {
      summary: `Wrapped '${path}' in ${component}`,
      action: { helper: 'wrapInLayoutComponent', params: { path, component } },
      affectedPaths: [nodeId ?? path],
      createdId: nodeId,
    };
  }

  // ── Batch Operations ──

  /** Batch delete multiple items atomically. */
  batchDeleteItems(paths: string[]): HelperResult {
    // Descendant deduplication
    const pruned = paths.filter(p =>
      !paths.some(other => other !== p && p.startsWith(`${other}.`)),
    );
    // Sort deepest-first
    const sorted = [...pruned].sort((a, b) => b.split('.').length - a.split('.').length);

    this.dispatch(
      sorted.map(p => ({ type: 'definition.deleteItem' as const, payload: { path: p } })),
    );

    return {
      summary: `Deleted ${sorted.length} item(s)`,
      action: { helper: 'batchDeleteItems', params: { paths: sorted } },
      affectedPaths: sorted,
    };
  }

  /** Batch duplicate multiple items atomically. */
  batchDuplicateItems(paths: string[]): HelperResult {
    // Descendant deduplication
    const pruned = paths.filter(p =>
      !paths.some(other => other !== p && p.startsWith(`${other}.`)),
    );

    const results = this.dispatch(
      pruned.map(p => ({ type: 'definition.duplicateItem' as const, payload: { path: p } })),
    );

    // Extract inserted paths from results
    const affectedPaths = (Array.isArray(results) ? results : [results]).map(
      (r: any, i) => r?.insertedPath ?? `${pruned[i]}_copy`,
    );

    return {
      summary: `Duplicated ${pruned.length} item(s)`,
      action: { helper: 'batchDuplicateItems', params: { paths: pruned } },
      affectedPaths,
    };
  }

  // ── Submit Button ──

  /** Add a submit button. */
  addSubmitButton(label?: string, pageId?: string): HelperResult {
    const commands: AnyCommand[] = [
      {
        type: 'component.addNode',
        payload: {
          parent: { nodeId: 'root' },
          component: 'SubmitButton',
          props: { label: label ?? 'Submit' },
        },
      },
    ];

    if (pageId) {
      commands.push({
        type: 'pages.assignItem',
        payload: { pageId, key: 'submit' },
      });
    }

    this.dispatch(commands);

    return {
      summary: `Added submit button`,
      action: { helper: 'addSubmitButton', params: { label, pageId } },
      affectedPaths: [],
    };
  }

  // ── Page Helpers ──

  /** Add a theme-tier page. */
  addPage(title: string, description?: string): HelperResult {
    const payload: Record<string, unknown> = { title };
    if (description) payload.description = description;

    this.dispatch({ type: 'pages.addPage', payload });

    // Read new page ID from state
    const pages = this.state.theme.pages ?? [];
    const newPage = pages[pages.length - 1];
    const pageId = (newPage as any)?.id as string;

    return {
      summary: `Added page '${title}'`,
      action: { helper: 'addPage', params: { title, description } },
      affectedPaths: [pageId],
      createdId: pageId,
    };
  }

  /** Add a wizard section (definition-tier group). */
  addWizardPage(label: string): HelperResult {
    // Generate a key from label
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `step_${Date.now()}`;

    this.dispatch({
      type: 'definition.addItem',
      payload: { type: 'group', key, label },
    });

    // Set wizard mode if not already
    const pageMode = (this.state.definition as any).formPresentation?.pageMode;
    if (pageMode !== 'wizard') {
      this.dispatch({
        type: 'definition.setFormPresentation',
        payload: { property: 'pageMode', value: 'wizard' },
      });
    }

    return {
      summary: `Added wizard page '${label}'`,
      action: { helper: 'addWizardPage', params: { label } },
      affectedPaths: [key],
      createdId: key,
    };
  }

  /** Remove a page. */
  removePage(pageId: string): HelperResult {
    this.dispatch({ type: 'pages.deletePage', payload: { id: pageId } });
    return {
      summary: `Removed page '${pageId}'`,
      action: { helper: 'removePage', params: { pageId } },
      affectedPaths: [pageId],
    };
  }

  /** Reorder a page. */
  reorderPage(pageId: string, direction: 'up' | 'down'): HelperResult {
    this.dispatch({ type: 'pages.reorderPages', payload: { id: pageId, direction } });
    return {
      summary: `Reordered page '${pageId}' ${direction}`,
      action: { helper: 'reorderPage', params: { pageId, direction } },
      affectedPaths: [pageId],
    };
  }

  /** Update a page's title or description. */
  updatePage(pageId: string, changes: { title?: string; description?: string }): HelperResult {
    const commands: AnyCommand[] = [];
    for (const [prop, val] of Object.entries(changes)) {
      if (val !== undefined) {
        commands.push({
          type: 'pages.setPageProperty',
          payload: { id: pageId, property: prop, value: val },
        });
      }
    }
    if (commands.length > 0) this.dispatch(commands);

    return {
      summary: `Updated page '${pageId}'`,
      action: { helper: 'updatePage', params: { pageId, ...changes } },
      affectedPaths: [pageId],
    };
  }

  /** Assign an item to a page. */
  placeOnPage(target: string, pageId: string, options?: PlacementOptions): HelperResult {
    const leafKey = target.split('.').pop()!;
    const payload: Record<string, unknown> = { pageId, key: leafKey };
    if (options?.span) payload.span = options.span;

    this.dispatch({ type: 'pages.assignItem', payload });

    return {
      summary: `Placed '${target}' on page '${pageId}'`,
      action: { helper: 'placeOnPage', params: { target, pageId } },
      affectedPaths: [target],
    };
  }

  /** Remove item from page assignment. */
  unplaceFromPage(target: string, pageId: string): HelperResult {
    const leafKey = target.split('.').pop()!;
    this.dispatch({ type: 'pages.unassignItem', payload: { pageId, key: leafKey } });

    return {
      summary: `Removed '${target}' from page '${pageId}'`,
      action: { helper: 'unplaceFromPage', params: { target, pageId } },
      affectedPaths: [target],
    };
  }

  /** Set flow mode. */
  setFlow(mode: 'single' | 'wizard' | 'tabs', props?: FlowProps): HelperResult {
    const commands: AnyCommand[] = [
      { type: 'pages.setMode', payload: { mode } },
    ];

    if (props?.showProgress !== undefined) {
      commands.push({
        type: 'component.setWizardProperty',
        payload: { property: 'showProgress', value: props.showProgress },
      });
    }
    if (props?.allowSkip !== undefined) {
      commands.push({
        type: 'component.setWizardProperty',
        payload: { property: 'allowSkip', value: props.allowSkip },
      });
    }

    this.dispatch(commands);

    return {
      summary: `Set flow mode to '${mode}'`,
      action: { helper: 'setFlow', params: { mode, ...props } },
      affectedPaths: [],
    };
  }

  // ── Layout Helpers ──

  /** Layout arrangement → component mapping. */
  private static readonly _LAYOUT_MAP: Record<LayoutArrangement, { component: string; props?: Record<string, unknown> }> = {
    'columns-2': { component: 'Grid', props: { columns: 2 } },
    'columns-3': { component: 'Grid', props: { columns: 3 } },
    'columns-4': { component: 'Grid', props: { columns: 4 } },
    'card': { component: 'Card' },
    'sidebar': { component: 'Panel', props: { position: 'left' } },
    'inline': { component: 'Stack', props: { direction: 'horizontal' } },
  };

  /** Apply spatial layout to targets. */
  applyLayout(targets: string | string[], arrangement: LayoutArrangement): HelperResult {
    const targetArray = Array.isArray(targets) ? targets : [targets];
    const layout = Project._LAYOUT_MAP[arrangement];

    // Create layout container
    const addPayload: Record<string, unknown> = {
      parent: { nodeId: 'root' },
      component: layout.component,
    };
    if (layout.props) addPayload.props = layout.props;

    const commands: AnyCommand[] = [
      { type: 'component.addNode', payload: addPayload },
    ];

    // Move each target into the layout container (deferred — need nodeRef from first command)
    // Since we can't get the nodeRef mid-batch, we dispatch the addNode first, then moveNode
    this.dispatch(commands[0]);

    // Now find the created node — it should be the last child of root
    const tree = this.state.component?.tree;
    const rootChildren = (tree as any)?.children ?? [];
    const lastChild = rootChildren[rootChildren.length - 1];
    const containerRef = lastChild?.nodeId
      ? { nodeId: lastChild.nodeId }
      : lastChild?.bind
        ? { bind: lastChild.bind }
        : { nodeId: 'root' };

    // Move targets into container
    const moveCommands: AnyCommand[] = targetArray.map((t, i) => ({
      type: 'component.moveNode' as const,
      payload: {
        source: { bind: t.split('.').pop()! },
        targetParent: containerRef,
        targetIndex: i,
      },
    }));

    if (moveCommands.length > 0) {
      this.dispatch(moveCommands);
    }

    return {
      summary: `Applied ${arrangement} layout to ${targetArray.length} item(s)`,
      action: { helper: 'applyLayout', params: { targets: targetArray, arrangement } },
      affectedPaths: targetArray,
    };
  }

  /** Apply style overrides to a specific field. */
  applyStyle(path: string, properties: Record<string, unknown>): HelperResult {
    const leafKey = path.split('.').pop()!;
    const commands: AnyCommand[] = [];

    for (const [prop, val] of Object.entries(properties)) {
      commands.push({
        type: 'theme.setItemOverride',
        payload: { itemKey: leafKey, property: prop, value: val },
      });
    }

    if (commands.length > 0) {
      this.dispatch(commands);
    }

    return {
      summary: `Applied style to '${path}'`,
      action: { helper: 'applyStyle', params: { path, properties } },
      affectedPaths: [path],
    };
  }

  /** Apply style to form-level defaults or type selectors. */
  applyStyleAll(
    target: 'form' | { type: 'group' | 'field' | 'display' } | { dataType: string },
    properties: Record<string, unknown>,
  ): HelperResult {
    const commands: AnyCommand[] = [];

    if (target === 'form') {
      for (const [prop, val] of Object.entries(properties)) {
        if (prop === 'density') {
          commands.push({
            type: 'definition.setFormPresentation',
            payload: { property: 'density', value: val },
          });
        } else {
          commands.push({
            type: 'theme.setDefaults',
            payload: { property: prop, value: val },
          });
        }
      }
    } else {
      // Selector-based: { type: ... } or { dataType: ... }
      for (const [prop, val] of Object.entries(properties)) {
        commands.push({
          type: 'theme.addSelector',
          payload: { ...target, property: prop, value: val },
        });
      }
    }

    if (commands.length > 0) {
      this.dispatch(commands);
    }

    return {
      summary: `Applied style to ${typeof target === 'string' ? target : JSON.stringify(target)}`,
      action: { helper: 'applyStyleAll', params: { target, properties } },
      affectedPaths: [],
    };
  }

  // ── Variable Helpers ──

  /** Add a named FEL variable. */
  addVariable(name: string, expression: string, scope?: string): HelperResult {
    this._validateFEL(expression);
    const payload: Record<string, unknown> = { name, expression };
    if (scope) payload.scope = scope;

    this.dispatch({ type: 'definition.addVariable', payload });

    return {
      summary: `Added variable '${name}'`,
      action: { helper: 'addVariable', params: { name, expression, scope } },
      affectedPaths: [],
    };
  }

  /** Update a variable's expression. */
  updateVariable(name: string, expression: string): HelperResult {
    this._validateFEL(expression);
    this.dispatch({
      type: 'definition.setVariable',
      payload: { name, property: 'expression', value: expression },
    });

    return {
      summary: `Updated variable '${name}'`,
      action: { helper: 'updateVariable', params: { name, expression } },
      affectedPaths: [],
    };
  }

  /** Remove a variable — warns about dangling references. */
  removeVariable(name: string): HelperResult {
    // Scan for dangling references before deletion
    const warnings: HelperWarning[] = [];
    const allExprs = this.allExpressions();
    const varRef = `$${name}`;
    const danglingPaths: string[] = [];

    for (const exprLoc of allExprs) {
      if (typeof exprLoc.expression === 'string' && exprLoc.expression.includes(varRef)) {
        danglingPaths.push(exprLoc.path ?? exprLoc.id ?? 'unknown');
      }
    }

    if (danglingPaths.length > 0) {
      warnings.push({
        code: 'DANGLING_REFERENCES',
        message: `${danglingPaths.length} expression(s) still reference $${name}`,
        detail: { referenceCount: danglingPaths.length, paths: danglingPaths },
      });
    }

    this.dispatch({ type: 'definition.deleteVariable', payload: { name } });

    return {
      summary: `Removed variable '${name}'`,
      action: { helper: 'removeVariable', params: { name } },
      affectedPaths: [],
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /** Rename a variable — Future Work, handler not implemented. */
  renameVariable(name: string, newName: string): HelperResult {
    // definition.renameVariable is Future Work — delegate to handler and let it throw if missing
    this.dispatch({
      type: 'definition.renameVariable',
      payload: { name, newName },
    });

    return {
      summary: `Renamed variable '${name}' to '${newName}'`,
      action: { helper: 'renameVariable', params: { name, newName } },
      affectedPaths: [],
    };
  }

  // ── Instance Helpers ──

  /** Add a named external data source. */
  addInstance(name: string, props: InstanceProps): HelperResult {
    this.dispatch({
      type: 'definition.addInstance',
      payload: { name, ...props },
    });

    return {
      summary: `Added instance '${name}'`,
      action: { helper: 'addInstance', params: { name, ...props } },
      affectedPaths: [],
    };
  }

  /** Update instance properties. */
  updateInstance(name: string, changes: Partial<InstanceProps>): HelperResult {
    const commands: AnyCommand[] = [];
    for (const [prop, val] of Object.entries(changes)) {
      if (val !== undefined) {
        commands.push({
          type: 'definition.setInstance',
          payload: { name, property: prop, value: val },
        });
      }
    }
    if (commands.length > 0) this.dispatch(commands);

    return {
      summary: `Updated instance '${name}'`,
      action: { helper: 'updateInstance', params: { name, changes } },
      affectedPaths: [],
    };
  }

  /** Rename an instance — rewrites FEL references. */
  renameInstance(name: string, newName: string): HelperResult {
    this.dispatch({
      type: 'definition.renameInstance',
      payload: { name, newName },
    });

    return {
      summary: `Renamed instance '${name}' to '${newName}'`,
      action: { helper: 'renameInstance', params: { name, newName } },
      affectedPaths: [],
    };
  }

  /** Remove an instance. */
  removeInstance(name: string): HelperResult {
    // Scan for dangling references
    const warnings: HelperWarning[] = [];
    const allExprs = this.allExpressions();
    const ref = `@instance('${name}')`;
    const danglingPaths: string[] = [];

    for (const exprLoc of allExprs) {
      if (typeof exprLoc.expression === 'string' && exprLoc.expression.includes(ref)) {
        danglingPaths.push(exprLoc.path ?? exprLoc.id ?? 'unknown');
      }
    }

    if (danglingPaths.length > 0) {
      warnings.push({
        code: 'DANGLING_REFERENCES',
        message: `${danglingPaths.length} expression(s) still reference @instance('${name}')`,
        detail: { referenceCount: danglingPaths.length, paths: danglingPaths },
      });
    }

    this.dispatch({ type: 'definition.deleteInstance', payload: { name } });

    return {
      summary: `Removed instance '${name}'`,
      action: { helper: 'removeInstance', params: { name } },
      affectedPaths: [],
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // ── Screener Helpers ──

  /** Enable/disable screener. */
  setScreener(enabled: boolean): HelperResult {
    this.dispatch({ type: 'definition.setScreener', payload: { enabled } });

    return {
      summary: `Screener ${enabled ? 'enabled' : 'disabled'}`,
      action: { helper: 'setScreener', params: { enabled } },
      affectedPaths: [],
    };
  }

  /** Add a screener question. */
  addScreenField(key: string, label: string, type: string, props?: FieldProps): HelperResult {
    const resolved = resolveFieldType(type);
    this.dispatch({
      type: 'definition.addScreenerItem',
      payload: { type: 'field', key, label, dataType: resolved.dataType },
    });

    return {
      summary: `Added screener field '${key}'`,
      action: { helper: 'addScreenField', params: { key, label, type } },
      affectedPaths: [key],
    };
  }

  /** Remove a screener question. */
  removeScreenField(key: string): HelperResult {
    this.dispatch({ type: 'definition.deleteScreenerItem', payload: { key } });

    return {
      summary: `Removed screener field '${key}'`,
      action: { helper: 'removeScreenField', params: { key } },
      affectedPaths: [key],
    };
  }

  /** Add a screener routing rule. */
  addScreenRoute(condition: string, target: string, label?: string): HelperResult {
    this._validateFEL(condition);
    const payload: Record<string, unknown> = { condition, target };
    if (label) payload.label = label;

    this.dispatch({ type: 'definition.addRoute', payload });

    return {
      summary: `Added screen route to '${target}'`,
      action: { helper: 'addScreenRoute', params: { condition, target, label } },
      affectedPaths: [],
    };
  }

  /** Update a screener route. */
  updateScreenRoute(
    routeIndex: number,
    changes: { condition?: string; target?: string; label?: string },
  ): HelperResult {
    if (changes.condition) this._validateFEL(changes.condition);

    const commands: AnyCommand[] = [];
    for (const [prop, val] of Object.entries(changes)) {
      if (val !== undefined) {
        commands.push({
          type: 'definition.setRouteProperty',
          payload: { index: routeIndex, property: prop, value: val },
        });
      }
    }
    if (commands.length > 0) this.dispatch(commands);

    return {
      summary: `Updated screen route ${routeIndex}`,
      action: { helper: 'updateScreenRoute', params: { routeIndex, ...changes } },
      affectedPaths: [],
    };
  }

  /** Reorder a screener route. */
  reorderScreenRoute(routeIndex: number, direction: 'up' | 'down'): HelperResult {
    this.dispatch({
      type: 'definition.reorderRoute',
      payload: { index: routeIndex, direction },
    });

    return {
      summary: `Reordered screen route ${routeIndex} ${direction}`,
      action: { helper: 'reorderScreenRoute', params: { routeIndex, direction } },
      affectedPaths: [],
    };
  }

  /** Remove a screener route. */
  removeScreenRoute(routeIndex: number): HelperResult {
    this.dispatch({ type: 'definition.deleteRoute', payload: { index: routeIndex } });

    return {
      summary: `Removed screen route ${routeIndex}`,
      action: { helper: 'removeScreenRoute', params: { routeIndex } },
      affectedPaths: [],
    };
  }
}

export function createProject(options?: ProjectOptions): Project {
  return new Project(options);
}
