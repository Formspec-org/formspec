import { RawProject, createRawProject } from './raw-project.js';
import type {
  ProjectOptions,
  ProjectState,
  AnyCommand,
  ChangeListener,
  ProjectBundle,
  Diagnostics,
  ProjectStatistics,
  FieldDependents,
  ExpressionLocation,
  FELParseContext,
  FELParseResult,
} from './types.js';
import type { FormspecItem } from 'formspec-engine';
import {
  HelperError,
  type HelperResult,
  type HelperWarning,
  type FieldProps,
  type GroupProps,
  type BranchPath,
  type ValidationOptions,
} from './helper-types.js';
import { resolveFieldType, resolveWidget, widgetHintFor, isTextareaWidget } from './field-type-aliases.js';

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
      const pages = this.raw.state.theme.pages;
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
    this.raw.batchWithRebuild(phase1, phase2);

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
      this.raw.batchWithRebuild(
        [{ type: 'definition.addItem', payload: addItemPayload }],
        [{ type: 'component.setGroupDisplayMode', payload: { groupKey: key, mode: props.display } }],
      );
    } else {
      // Single dispatch — no component tree dependency
      this.raw.dispatch({ type: 'definition.addItem', payload: addItemPayload });
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

    this.raw.dispatch({ type: 'definition.addItem', payload });

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
    this.raw.dispatch({
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
    this.raw.dispatch({
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
    this.raw.dispatch({
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
    this.raw.dispatch({
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
      throw new HelperError('PATH_NOT_FOUND', `Field "${on}" does not exist`, { path: on });
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
    this.raw.dispatch(commands);

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

    this.raw.dispatch({ type: 'definition.addShape', payload });

    // Read the shape ID from state (addShape appends to shapes array)
    const shapes = (this.raw.state.definition as any).shapes ?? [];
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
    this.raw.dispatch({ type: 'definition.deleteShape', payload: { id: shapeId } });
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
      this.raw.dispatch(commands);
    }

    return {
      summary: `Updated validation '${shapeId}'`,
      action: { helper: 'updateValidation', params: { shapeId, ...changes } },
      affectedPaths: [shapeId],
    };
  }
}

export function createProject(options?: ProjectOptions): Project {
  return new Project(options);
}
