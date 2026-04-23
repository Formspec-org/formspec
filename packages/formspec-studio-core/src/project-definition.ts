/** @filedesc Definition authoring helpers for Formspec Studio. */
import type { AnyCommand, FormItem } from '@formspec-org/core';
import type { ProjectInternals } from './project-internals.js';
import {
  HelperError,
  type HelperResult,
  type HelperWarning,
  type FieldProps,
  type GroupProps,
  type ContentProps,
  type BranchPath,
  type ValidationOptions,
  type ItemChanges,
  type MetadataChanges,
  type ChoiceOption,
  type RepeatProps,
} from './helper-types.js';
import { resolvePath } from './lib/object-utils.js';
import { resolveFieldType, resolveWidget, widgetHintFor } from './field-type-aliases.js';
import type { ResolvedFieldType } from './field-type-aliases.js';
import { sanitizeIdentifier } from './authoring-helpers.js';
import { findKeyInItems, pageChildren } from './tree-utils.js';
import { requireItemPath, throwPathNotFound } from './project-path-helpers.js';
import { buildRepeatScopeRewriter } from './lib/fel-rewriter.js';
import {
  getWidgetConstraintProps,
  isWidgetManagedConstraint,
  widgetConstraintToFEL,
  type WidgetConstraintSpec,
  type NumericConstraintValues,
  type DateConstraintValues,
  type WidgetConstraintState,
} from './widget-constraints.js';
import { rewriteFELReferences } from '@formspec-org/engine/fel-tools';
import type { CompNode } from './layout-helpers.js';

export function felConstraintFromPattern(pattern: string): string {
  const escaped = pattern.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `matches($, '${escaped}')`;
}


/** Get the root component tree children from the effective component tree. */
function _getRootChildren(project: ProjectInternals): CompNode[] {
  const tree = project.core.state.component?.tree as CompNode | undefined;
  return tree?.children ?? [];
}

/** Internal: Get all top-level page nodes. */
export function _getPageNodes(project: ProjectInternals): CompNode[] {
  return _getRootChildren(project).filter(n => n.component === 'Page');
}

/** Internal: Find a page node by ID. Throws if not found. */
export function _findPageNode(project: ProjectInternals, pageId: string): CompNode {
  const page = _getPageNodes(project).find(n => n.nodeId === pageId);
  if (!page) throw new HelperError('PAGE_NOT_FOUND', `Page not found: ${pageId}`);
  return page;
}

/** Internal: Find the group path assigned to a page. */
export function _resolvePageGroup(project: ProjectInternals, pageId?: string): string | undefined {
  if (!pageId) return undefined;
  const page = _findPageNode(project, pageId);
  return page.definitionItemPath ?? undefined;
}

/** Internal: Get all bound children of a page node. */
export function _pageBoundChildren(project: ProjectInternals, page: CompNode): CompNode[] {
  return pageChildren(page).filter(n => !!n.bind || (!!n.nodeId && !n._layout));
}

/** Internal: Calculate the insertion index for a page during reordering. */
export function _pageInsertIndex(project: ProjectInternals, targetIndex: number, movingPageId: string): number {
  const children = _getRootChildren(project);
  const fromIndex = children.findIndex((n) => n.component === 'Page' && n.nodeId === movingPageId);
  if (fromIndex === -1) throw new HelperError('PAGE_NOT_FOUND', `Page not found: ${movingPageId}`);

  const pageIndices = children
    .map((child, index) => (child.component === 'Page' ? index : -1))
    .filter(index => index !== -1);

  const currentPagePos = pageIndices.indexOf(fromIndex);
  const clampedPagePos = Math.max(0, Math.min(targetIndex, pageIndices.length - 1));
  if (currentPagePos === clampedPagePos) return fromIndex;

  const updatedPageIndices = pageIndices
    .filter(index => index !== fromIndex)
    .map(index => (index > fromIndex ? index - 1 : index));

  if (clampedPagePos >= updatedPageIndices.length) {
    return updatedPageIndices.length > 0
      ? updatedPageIndices[updatedPageIndices.length - 1] + 1
      : Math.max(0, children.length - 1);
  }

  return updatedPageIndices[clampedPagePos];
}

/** Internal: Generate a unique key for a layout item. */
export function _uniqueLayoutItemKey(project: ProjectInternals, label: string, parentPath?: string, explicitKey?: string): string {
    const base = sanitizeIdentifier((explicitKey ?? label).toLowerCase()) || 'item';
    let candidate = base;
    let suffix = 2;
    const fullPath = (key: string) => (parentPath ? `${parentPath}.${key}` : key);
    while (project.core.itemAt(fullPath(candidate))) {
      candidate = `${base}_${suffix++}`;
    }
    return candidate;
  }

/**
   * Ensure `leafKey` is unique across the entire item tree.
   * The Rust linter catches this as E200; this surfaces the error at authoring time.
   */
function _assertGlobalKeyUniqueness(project: ProjectInternals, leafKey: string): void {
    const items = project.core.state.definition.items ?? [];
    const existingPath = findKeyInItems(items, leafKey, '');
    if (existingPath !== null) {
      throw new HelperError(
        'DUPLICATE_KEY',
        `Duplicate item key '${leafKey}' — keys must be unique across the entire form. Consider using a prefixed key like 'parentGroup_${leafKey}' instead.`,
        { key: leafKey, existingPath },
      );
    }
  }

/** Internal: Resolve an authoring field type alias to a canonical DataType. */
export function _resolveAuthoringFieldType(project: ProjectInternals, type: string): {
    resolved: ResolvedFieldType;
    extensionName?: string;
    combinedConstraintExpr?: string;
  } {
    const ext = project.core.resolveExtension(type) as Record<string, unknown> | undefined;
    if (ext && ext.category === 'dataType' && typeof ext.baseType === 'string') {
      const resolved = resolveFieldType(ext.baseType);
      const constraints = ext.constraints as { pattern?: string } | undefined;
      let fromRegistry: string | undefined;
      if (constraints?.pattern && typeof constraints.pattern === 'string') {
        fromRegistry = felConstraintFromPattern(constraints.pattern);
      }
      return {
        resolved,
        extensionName: type,
        combinedConstraintExpr: fromRegistry ?? resolved.constraintExpr,
      };
    }
    const resolved = resolveFieldType(type);
    return { resolved, combinedConstraintExpr: resolved.constraintExpr };
  }

  // ── Authoring methods ──

  /**
   * Add a data collection field.
   * Resolves type alias → { dataType, defaultWidget } via the Field Type Alias Table.
   * Widget in props resolved via the Widget Alias Table before dispatch.
   */
export function addField(project: ProjectInternals, path: string, label: string, type: string, props?: FieldProps): HelperResult {
    // Pre-validation
    const { resolved, extensionName, combinedConstraintExpr } = _resolveAuthoringFieldType(project, type);
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
      const pageExists = _getPageNodes(project).some((n) => n.nodeId === props.page);
      if (!pageExists) {
        throw new HelperError('PAGE_NOT_FOUND', `Page "${props.page}" does not exist`, {
          pageId: props.page,
        });
      }
    }

    // Auto-resolve page to parentPath when not already nested
    let baseParent = props?.parentPath;
    if (!baseParent && props?.page && !path.includes('.')) {
      baseParent = _resolvePageGroup(project, props.page);
    }

    const { key, parentPath, fullPath } = resolvePath(path, baseParent);

    // Check for duplicate full path
    if (project.core.itemAt(fullPath)) {
      throw new HelperError('DUPLICATE_KEY', `An item with key "${fullPath}" already exists`, {
        path: fullPath,
      });
    }
    // Check for global leaf key uniqueness (Rust linter E200)
    _assertGlobalKeyUniqueness(project, key);

    // Build phase1: definition.addItem
    const addItemPayload: Record<string, unknown> = {
      type: 'field',
      key,
      label,
      dataType: resolved.dataType,
    };
    if (extensionName) {
      addItemPayload.extensions = { [extensionName]: true };
    }
    if (parentPath) addItemPayload.parentPath = parentPath;
    if (props?.insertIndex !== undefined) addItemPayload.insertIndex = props.insertIndex;

    const phase1: AnyCommand[] = [
      { type: 'definition.addItem', payload: addItemPayload },
    ];

    // Build phase2: component + binds + properties
    const phase2: AnyCommand[] = [
      { type: 'component.setFieldWidget', payload: { fieldKey: key, widget: resolvedWidget } },
    ];

    // textarea needs extra widgetHint on the component node
    if ((widgetAlias && widgetAlias === 'textarea') || (!widgetAlias && resolved.defaultWidgetHint === 'textarea')) {
      phase2.push({
        type: 'component.setNodeProperty',
        payload: { node: { bind: key }, property: 'widgetHint', value: 'textarea' },
      });
    }

    // Widget hint on definition for round-trip
    const hint = widgetAlias
      ? widgetHintFor(widgetAlias)
      : (resolved.defaultWidgetHint ?? widgetHintFor(resolvedWidget));
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

    // Semantic type constraint (built-in aliases or registry pattern)
    if (combinedConstraintExpr) {
      phase2.push({
        type: 'definition.setBind',
        payload: { path: fullPath, properties: { constraint: combinedConstraintExpr } },
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
        type: 'component.moveNode',
        payload: {
          source: { bind: key },
          targetParent: { nodeId: props.page },
        },
      });
    }

    // Item properties
    if (props?.hint) {
      addItemPayload.hint = props.hint;
    }
    if (props?.description) {
      addItemPayload.description = props.description;
    }
    // H1: placeholder → theme widgetConfig
    if (props?.placeholder) {
      phase2.push({
        type: 'theme.setItemWidgetConfig',
        payload: { itemKey: key, property: 'placeholder', value: props.placeholder },
      });
    }
    // H2: ariaLabel → theme accessibility
    if (props?.ariaLabel) {
      phase2.push({
        type: 'theme.setItemAccessibility',
        payload: { itemKey: key, property: 'description', value: props.ariaLabel },
      });
    }

    // Dispatch
    project.core.batchWithRebuild(phase1, phase2);

    return {
      summary: `Added field '${label}' (${type}) at path "${fullPath}"`,
      action: { helper: 'addField', params: { path: fullPath, label, type } },
      affectedPaths: [fullPath],
    };
  }

  /** Add a group/section container. */
export function addGroup(project: ProjectInternals, path: string, label: string, props?: GroupProps): HelperResult {
    // Page validation
    if (props?.page) {
      const pageExists = _getPageNodes(project).some((n) => n.nodeId === props.page);
      if (!pageExists) {
        throw new HelperError('PAGE_NOT_FOUND', `Page "${props.page}" does not exist`, {
          pageId: props.page,
        });
      }
    }

    // Auto-resolve page to parentPath when not already nested
    let baseParent = props?.parentPath;
    if (!baseParent && props?.page && !path.includes('.')) {
      baseParent = _resolvePageGroup(project, props.page);
    }

    const { key, parentPath, fullPath } = resolvePath(path, baseParent);

    if (project.core.itemAt(fullPath)) {
      throw new HelperError('DUPLICATE_KEY', `An item with key "${fullPath}" already exists`, {
        path: fullPath,
      });
    }
    _assertGlobalKeyUniqueness(project, key);

    const addItemPayload: Record<string, unknown> = {
      type: 'group',
      key,
      label,
    };
    if (parentPath) addItemPayload.parentPath = parentPath;
    if (props?.insertIndex !== undefined) addItemPayload.insertIndex = props.insertIndex;

    // addGroup creates only the definition group (response structure).
    // Page placement is a separate layout action on the component tree.
    if (props?.display) {
      // Two-phase: addItem triggers rebuild, then setGroupDisplayMode on rebuilt tree
      project.core.batchWithRebuild(
        [{ type: 'definition.addItem', payload: addItemPayload }],
        [{ type: 'component.setGroupDisplayMode', payload: { groupKey: key, mode: props.display } }],
      );
    } else {
      // Single dispatch — no component tree dependency
      project.core.dispatch({ type: 'definition.addItem', payload: addItemPayload });
    }

    return {
      summary: `Added group '${label}' at path "${fullPath}"`,
      action: { helper: 'addGroup', params: { path: fullPath, label, display: props?.display } },
      affectedPaths: [fullPath],
    };
  }

/** Add display content — non-data element. */
export function addContent(
    project: ProjectInternals,
    path: string,
    body: string,
    kind?: 'heading' | 'instructions' | 'paragraph' | 'alert' | 'banner' | 'divider',
    props?: ContentProps,
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

    if (props?.page) {
      const pageExists = _getPageNodes(project).some((n) => n.nodeId === props.page);
      if (!pageExists) {
        throw new HelperError('PAGE_NOT_FOUND', `Page "${props.page}" does not exist`, {
          pageId: props.page,
        });
      }
    }

    // Auto-resolve page to parentPath when not already nested
    let baseParent = props?.parentPath;
    if (!baseParent && props?.page && !path.includes('.')) {
      baseParent = _resolvePageGroup(project, props.page);
    }

    const { key, parentPath, fullPath } = resolvePath(path, baseParent);

    if (project.core.itemAt(fullPath)) {
      throw new HelperError('DUPLICATE_KEY', `An item with key "${fullPath}" already exists`, {
        path: fullPath,
      });
    }
    _assertGlobalKeyUniqueness(project, key);

    const payload: Record<string, unknown> = {
      type: 'display',
      key,
      label: body,
      presentation: { widgetHint },
    };
    if (parentPath) payload.parentPath = parentPath;
    if (props?.insertIndex !== undefined) payload.insertIndex = props.insertIndex;

    project.core.dispatch({ type: 'definition.addItem', payload });

    return {
      summary: `Added ${kind ?? 'paragraph'} content at path "${fullPath}"`,
      action: { helper: 'addContent', params: { path: fullPath, body, kind } },
      affectedPaths: [fullPath],
    };
  }

  // ── Bind Helpers ──

/**
   * Validate a FEL expression string, throwing INVALID_FEL if it fails to parse
   * or contains unknown functions or references (semantic pre-validation).
   *
   * @param expression The FEL string to validate.
   * @param contextPath Optional path to resolve relative references against.
   */
/** Internal: Validate a FEL expression and throw HelperError on failure. */
export function _validateFEL(project: ProjectInternals, expression: string, contextPath?: string): void {
    const result = project.core.parseFEL(expression, contextPath ? { targetPath: contextPath } : undefined);

    if (!result.valid) {
      const error = result.errors[0];
      throw new HelperError('INVALID_FEL', `Invalid FEL expression: ${error?.message || expression}`, {
        expression,
        parseError: error ? { message: error.message, code: error.code } : undefined,
      });
    }

    // Semantic arity/function checks (warnings promoted to errors for helpers)
    const unknownFn = result.warnings?.find(w => w.code === 'FEL_UNKNOWN_FUNCTION');
    if (unknownFn) {
      throw new HelperError('INVALID_FEL', `Invalid FEL expression: ${unknownFn.message}`, {
        expression,
        parseError: { message: unknownFn.message, code: unknownFn.code },
      });
    }
  }

/**
   * Normalize a shape target path by inserting `[*]` after any repeatable group
   * segments. Template paths like `expenses.receipt` become `expenses[*].receipt`
   * when `expenses` is a repeatable group.
   *
   * Skips special targets (`*`, `#`) and paths that already contain wildcards
   * at the correct positions.
   */
function _normalizeShapeTarget(project: ProjectInternals, target: string): string {
    // Special targets — pass through
    if (target === '*' || target === '#') return target;

    // Split on dots but preserve existing [*] suffixes
    const segments = target.split('.');
    const normalized: string[] = [];
    let lookupPath = '';

    for (const segment of segments) {
      // If segment already has [*], keep it as-is
      if (segment.endsWith('[*]')) {
        normalized.push(segment);
        lookupPath += (lookupPath ? '.' : '') + segment.replace('[*]', '');
        continue;
      }

      normalized.push(segment);
      lookupPath += (lookupPath ? '.' : '') + segment;

      // Check if this segment is a repeatable group
      const item = project.core.itemAt(lookupPath);
      if (item?.type === 'group' && item.repeatable) {
        // Append [*] to the last segment we just pushed
        normalized[normalized.length - 1] = segment + '[*]';
      }
    }

    return normalized.join('.');
  }

  /** Conditional visibility — dispatches definition.setBind { relevant: condition } */
export function showWhen(project: ProjectInternals, target: string, condition: string): HelperResult {
    requireItemPath(project.core,target);
    _validateFEL(project, condition, target);
    project.core.dispatch({
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
export function readonlyWhen(project: ProjectInternals, target: string, condition: string): HelperResult {
    requireItemPath(project.core,target);
    _validateFEL(project, condition, target);
    project.core.dispatch({
      type: 'definition.setBind',
      payload: { path: target, properties: { readonly: condition } },
    });
    return {
      summary: `Set '${target}' readonly when: ${condition}`,
      action: { helper: 'readonlyWhen', params: { target, condition } },
      affectedPaths: [target],
    };
  }

  /** Required rule — dispatches definition.setBind { required: condition ?? 'true' } */
export function require(project: ProjectInternals, target: string, condition?: string): HelperResult {
    requireItemPath(project.core,target);
    const expr = condition ?? 'true';
    _validateFEL(project, expr, target);
    project.core.dispatch({
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
export function calculate(project: ProjectInternals, target: string, expression: string): HelperResult {
    requireItemPath(project.core,target);
    _validateFEL(project, expression, target);
    project.core.dispatch({
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
function _branchExpr(project: ProjectInternals, on: string, when: string | number | boolean | undefined, mode: 'equals' | 'contains' | 'condition', condition?: string): string {
    if (mode === 'condition') {
      if (!condition) {
        throw new HelperError('INVALID_PROPS', 'Branch arm with mode "condition" requires a "condition" property', {});
      }
      // Pass the 'on' path as context for reference validation (e.g. self-references)
      _validateFEL(project, condition, on);
      return condition;
    }
    if (mode === 'contains') {
      return typeof when === 'string' ? `selected(${on}, '${when}')` : `selected(${on}, ${when})`;
    }
    // equals mode
    if (typeof when === 'string') return `${on} = '${when}'`;
    if (typeof when === 'boolean') return `${on} = ${when}`;
    return `${on} = ${when}`;
  }

  /**
   * Branching — show different fields based on an answer or variable.
   * Auto-detects mode for multiChoice fields (uses selected() not equals).
   * Supports variables: pass `@varName` or a bare name that matches a variable.
   */
export function branch(project: ProjectInternals, on: string, paths: BranchPath[], otherwise?: string | string[]): HelperResult {
    // Detect variable reference: explicit @prefix or bare name matching a variable
    let felRef = on;
    let defaultMode: 'equals' | 'contains' = 'equals';

    const isExplicitVariable = on.startsWith('@');
    const varName = isExplicitVariable ? on.slice(1) : on;
    const knownVariables = project.core.variableNames();
    const isVariable = isExplicitVariable || (!project.core.itemAt(on) && knownVariables.includes(on));

    if (isVariable) {
      if (!knownVariables.includes(varName)) {
        throw new HelperError('VARIABLE_NOT_FOUND', `Variable "${varName}" not found`, {
          name: varName,
          validVariables: knownVariables,
        });
      }
      felRef = `@${varName}`;
    } else {
      // Pre-validate: on field must exist
      const onItem = project.core.itemAt(on);
      if (!onItem) {
        throwPathNotFound(project.core,on);
      }
      // Auto-detect mode based on on-field dataType
      const isMultiChoice = onItem.dataType === 'multiChoice';
      defaultMode = isMultiChoice ? 'contains' : 'equals';
    }

    const warnings: HelperWarning[] = [];
    const allExprs: string[] = [];
    const affectedPaths: string[] = [];

    // Accumulate expressions per target — multiple arms can target the same field
    const targetExprs = new Map<string, string[]>();

    for (const arm of paths) {
      const mode = arm.mode ?? defaultMode;
      const expr = _branchExpr(project, felRef, arm.when, mode, arm.condition);
      allExprs.push(expr);

      const targets = Array.isArray(arm.show) ? arm.show : [arm.show];
      for (const target of targets) {
        if (!targetExprs.has(target)) {
          targetExprs.set(target, []);
        }
        targetExprs.get(target)!.push(expr);
      }
    }

    // Otherwise arm
    if (otherwise) {
      const otherwiseTargets = Array.isArray(otherwise) ? otherwise : [otherwise];
      const negatedExpr = allExprs.length === 1
        ? `not(${allExprs[0]})`
        : `not(${allExprs.join(' or ')})`;

      for (const target of otherwiseTargets) {
        if (!targetExprs.has(target)) {
          targetExprs.set(target, []);
        }
        targetExprs.get(target)!.push(negatedExpr);
      }
    }

    // Emit one setBind per target with OR'd expression
    const commands: AnyCommand[] = [];
    for (const [target, exprs] of targetExprs) {
      const existingBind = project.core.bindFor(target);
      if (existingBind?.relevant) {
        warnings.push({
          code: 'RELEVANT_OVERWRITTEN',
          message: `Existing relevant expression on "${target}" was replaced`,
          detail: { path: target, previousExpression: existingBind.relevant },
        });
      }

      const combined = exprs.length === 1 ? exprs[0] : exprs.join(' or ');
      commands.push({
        type: 'definition.setBind',
        payload: { path: target, properties: { relevant: combined } },
      });
      affectedPaths.push(target);
    }

    // Dispatch all setBind commands atomically
    project.core.dispatch(commands);
    return {
      summary: `Branch on '${on}' with ${paths.length} arm(s)`,
      action: { helper: 'branch', params: { on, paths: paths.length, otherwise: !!otherwise } },
      affectedPaths,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // ── Validation Helpers ──

/** Cross-field validation — adds a shape rule. */
  export function addValidation(
    project: ProjectInternals,
    target: string,
    rule: string,
    message: string,
    options?: ValidationOptions,
  ): HelperResult {
    // Validate target path exists (skip form-wide wildcards and repeat wildcards)
    if (target !== '*' && target !== '#' && !target.includes('[*]')) {
      requireItemPath(project.core,target);
    }

    _validateFEL(project, rule, target);
    if (options?.activeWhen) {
      _validateFEL(project, options.activeWhen, target);
    }

    const normalizedTarget = _normalizeShapeTarget(project, target);

    // When _normalizeShapeTarget inserted [*], rewrite authored FEL to
    // row-scoped canonical form per the spec (Decision 1 in phase4 follow-up).
    const targetWasNormalized = normalizedTarget !== target;
    let canonicalRule = rule;
    let canonicalMessage = message;
    let canonicalActiveWhen = options?.activeWhen;

    if (targetWasNormalized) {
      const rewriter = buildRepeatScopeRewriter(target);
      canonicalRule = rewriter.rewriteExpression(rule);
      canonicalMessage = rewriter.rewriteMessage(message);
      if (canonicalActiveWhen) {
        canonicalActiveWhen = rewriter.rewriteExpression(canonicalActiveWhen);
      }
    }

    const payload: Record<string, unknown> = {
      target: normalizedTarget,
      constraint: canonicalRule,
      message: canonicalMessage,
    };
    if (options?.timing) payload.timing = options.timing;
    if (options?.severity) payload.severity = options.severity;
    if (options?.code) payload.code = options.code;
    if (canonicalActiveWhen) payload.activeWhen = canonicalActiveWhen;

    // Advisory warning: field already has a bind-level constraint
    const warnings: HelperWarning[] = [];
    if (target !== '*' && target !== '#' && !target.includes('[*]')) {
      const existingBind = project.core.bindFor(target);
      if (existingBind?.constraint) {
        warnings.push({
          code: 'DUPLICATE_VALIDATION',
          message: `Field "${target}" already has a bind-level constraint — shape rule adds a second validation layer`,
          detail: { path: target, existingConstraint: existingBind.constraint },
        });
      }
    }

    project.core.dispatch({ type: 'definition.addShape', payload });

    // Read the shape ID from state (addShape appends to shapes array)
    const shapes = project.core.state.definition.shapes ?? [];
    const createdId = shapes[shapes.length - 1]?.id;

    return {
      summary: `Added validation on '${target}': ${message}`,
      action: { helper: 'addValidation', params: { target, rule, message } },
      affectedPaths: [createdId],
      createdId,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Remove validation from a target — handles both shape IDs and field paths.
   * When target matches a shape ID: deletes the shape.
   * When target matches a field path: clears bind constraint + constraintMessage,
   * and removes any shapes targeting that path.
   * Tries both lookups so MCP callers don't need to know which mechanism was used.
   */
export function removeValidation(project: ProjectInternals, target: string): HelperResult {
    const commands: AnyCommand[] = [];
    const affectedPaths: string[] = [];

    // Try shape ID lookup
    const shapes = project.core.state.definition.shapes ?? [];
    const shapeById = shapes.find(s => s.id === target);
    if (shapeById) {
      commands.push({ type: 'definition.deleteShape', payload: { id: target } });
      affectedPaths.push(target);
    }

    // Try field path lookup — clear bind constraint and remove shapes targeting this path
    const item = project.core.itemAt(target);
    if (item) {
      const bind = project.core.bindFor(target);
      if (bind?.constraint || bind?.constraintMessage) {
        commands.push({
          type: 'definition.setBind',
          payload: { path: target, properties: { constraint: null, constraintMessage: null } },
        });
        affectedPaths.push(target);
      }
      // Normalize target so the comparison matches shapes stored with [*] wildcards.
      // addValidation normalizes targets via _normalizeShapeTarget before storing,
      // so we must apply the same normalization when searching for removal.
      const normalizedTarget = _normalizeShapeTarget(project, target);
      const deletedShapeIds = new Set(
        shapeById ? [target] : [],
      );
      for (const shape of shapes) {
        const shapeTarget = shape.target;
        const shapeId = shape.id;
        if (deletedShapeIds.has(shapeId)) continue;
        if (shapeTarget === target || shapeTarget === normalizedTarget) {
          commands.push({ type: 'definition.deleteShape', payload: { id: shapeId } });
          affectedPaths.push(shapeId);
          deletedShapeIds.add(shapeId);
        }
      }
    }

    if (commands.length === 0) {
      throw new HelperError(
        'VALIDATION_NOT_FOUND',
        `No validation found for target "${target}"`,
        { target },
      );
    }

    project.core.dispatch(commands);

    return {
      summary: `Removed validation '${target}'`,
      action: { helper: 'removeValidation', params: { target } },
      affectedPaths,
    };
  }

/** Update a validation shape's rule, message, or options. */
export function updateValidation(
    project: ProjectInternals,
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
    const shape = (project.core.state.definition.shapes ?? []).find(s => s.id === shapeId);
    const target = shape?.target;

    if (changes.rule) _validateFEL(project, changes.rule, target);
    if (changes.activeWhen) _validateFEL(project, changes.activeWhen, target);

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
      project.core.dispatch(commands);
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
export function removeItem(project: ProjectInternals, path: string): HelperResult {
    const item = project.core.itemAt(path);
    if (!item) {
      throwPathNotFound(project.core,path);
    }

    // Step 1: Collect dependent set upfront
    const deps = project.core.fieldDependents(path);

    // Also collect for descendants if item is a group
    const descendantDeps: typeof deps[] = [];
    if (item.children?.length) {
      const collectDescendantPaths = (children: FormItem[], parentPath: string) => {
        for (const child of children) {
          const childPath = `${parentPath}.${child.key}`;
          descendantDeps.push(project.core.fieldDependents(childPath));
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

      // Clean up mapping rules (delete in descending index order per mapping)
      // FieldDependents.mappingRules: string[] format "mappingId:index"
      if (depSet.mappingRules?.length) {
        // Group by mappingId, then delete in descending index order within each
        const byMapping = new Map<string, number[]>();
        for (const ref of depSet.mappingRules) {
          const colonAt = ref.lastIndexOf(':');
          const mappingId = colonAt >= 0 ? ref.slice(0, colonAt) : 'default';
          const index = colonAt >= 0 ? parseInt(ref.slice(colonAt + 1), 10) : parseInt(ref, 10);
          if (!isNaN(index)) {
            const arr = byMapping.get(mappingId) ?? [];
            arr.push(index);
            byMapping.set(mappingId, arr);
          }
        }
        for (const [mappingId, indices] of byMapping) {
          const sortedIndices = indices.sort((a, b) => b - a);
          for (const idx of sortedIndices) {
            commands.push({
              type: 'mapping.deleteRule',
              payload: { mappingId, index: idx },
            });
          }
        }
      }

      // Clean up screener routes (delete in descending index order within each phase)
      if (depSet.screenerRoutes?.length) {
        const sorted = [...depSet.screenerRoutes].sort((a, b) =>
          a.phaseId === b.phaseId ? b.routeIndex - a.routeIndex : a.phaseId.localeCompare(b.phaseId)
        );
        for (const { phaseId, routeIndex } of sorted) {
          commands.push({
            type: 'screener.deleteRoute',
            payload: { phaseId, index: routeIndex },
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
    project.core.dispatch(commands);

    return {
      summary: `Removed item '${path}'`,
      action: { helper: 'removeItem', params: { path } },
      affectedPaths: [path],
    };
  }

  // ── Update Item ──

  /** Valid keys for updateItem. */
const _VALID_UPDATE_KEYS = new Set([
    'label', 'hint', 'description', 'placeholder', 'ariaLabel',
    'options', 'choicesFrom', 'currency', 'precision', 'initialValue', 'prePopulate',
    'dataType', 'required', 'constraint', 'constraintMessage', 'calculate',
    'relevant', 'readonly', 'default', 'repeatable', 'minRepeat', 'maxRepeat',
    'widget', 'style', 'page',
    'prefix', 'suffix', 'semanticType',
  ]);

  /** Properties that route to definition.setItemProperty. */
const _ITEM_PROPERTY_KEYS = new Set([
    'label', 'hint', 'description',
    'options', 'choicesFrom', 'initialValue', 'prePopulate',
    'repeatable', 'minRepeat', 'maxRepeat',
    'currency', 'precision',
    'prefix', 'suffix', 'semanticType',
  ]);

  /** Properties that route to definition.setBind. */
const _BIND_KEYS = new Set([
    'required', 'constraint', 'constraintMessage', 'calculate',
    'relevant', 'readonly', 'default',
  ]);

  /** Update any property of an existing item — fan-out helper. */
export function updateItem(project: ProjectInternals, path: string, changes: ItemChanges): HelperResult {
    // Pre-validate: path must exist
    if (!project.core.itemAt(path)) {
      throwPathNotFound(project.core,path);
    }

    // Check for unknown keys
    for (const key of Object.keys(changes)) {
      if (!_VALID_UPDATE_KEYS.has(key)) {
        throw new HelperError('INVALID_KEY', `Unknown updateItem key "${key}"`, {
          invalidKey: key,
          validKeys: [..._VALID_UPDATE_KEYS],
        });
      }
    }

    const commands: AnyCommand[] = [];
    const leafKey = path.split('.').pop()!;
    const warnings: HelperWarning[] = [];

    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) continue;

      // Item property routing
      if (_ITEM_PROPERTY_KEYS.has(key)) {
        const property = key === 'choicesFrom' ? 'optionSet' : key;
        commands.push({
          type: 'definition.setItemProperty',
          payload: { path, property, value },
        });
        continue;
      }

      // Bind property routing
      if (_BIND_KEYS.has(key)) {
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
        type FieldDataType = NonNullable<import('@formspec-org/types').FormItem['dataType']>;
        commands.push({
          type: 'definition.setFieldDataType',
          payload: { path, dataType: value as FieldDataType },
        });
        continue;
      }

      // widget routing — definition widgetHint + component widget in same batch
      if (key === 'widget') {
        const resolvedWidget = resolveWidget(value as string);
        const hint = widgetHintFor(value as string);

        // definition.setItemProperty for widgetHint (REQUIRED for round-trip)
        commands.push({
          type: 'definition.setItemProperty',
          payload: { path, property: 'presentation.widgetHint', value: hint ?? null },
        });

        // component.setFieldWidget now returns nodeNotFound instead of throwing
        commands.push({
          type: 'component.setFieldWidget',
          payload: { fieldKey: leafKey, widget: resolvedWidget },
        });
        continue;
      }

      // style routing → theme.setItemStyle (CSS in style sub-object)
      if (key === 'style') {
        const styleProps = value as Record<string, unknown>;
        for (const [prop, val] of Object.entries(styleProps)) {
          commands.push({
            type: 'theme.setItemStyle',
            payload: { itemKey: leafKey, property: prop, value: val },
          });
        }
        continue;
      }

      // placeholder → theme widgetConfig
      if (key === 'placeholder') {
        commands.push({
          type: 'theme.setItemWidgetConfig',
          payload: { itemKey: leafKey, property: 'placeholder', value },
        });
        continue;
      }

      // ariaLabel → theme accessibility
      if (key === 'ariaLabel') {
        commands.push({
          type: 'theme.setItemAccessibility',
          payload: { itemKey: leafKey, property: 'description', value },
        });
        continue;
      }

      // page routing
      if (key === 'page') {
        commands.push({
          type: 'component.moveNode',
          payload: {
            source: { bind: leafKey },
            targetParent: { nodeId: value as string },
          },
        });
        continue;
      }
    }

    if (commands.length > 0) {
      const results = project.core.dispatch(commands);
      // Check for nodeNotFound from component.setFieldWidget (non-throwing)
      for (const result of results) {
        if (result.nodeNotFound) {
          warnings.push({
            code: 'COMPONENT_NODE_NOT_FOUND',
            message: `No component node bound to field '${leafKey}'; widgetHint set on definition only`,
          });
        }
      }
    }

    return {
      summary: `Updated item '${path}'`,
      action: { helper: 'updateItem', params: { path, changes } },
      affectedPaths: [path],
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  }

  /** Set or clear a custom extension payload on a definition item. */
export function setItemExtension(project: ProjectInternals, path: string, extension: string, value: unknown): HelperResult {
    project.core.dispatch({
      type: 'definition.setItemExtension',
      payload: { path, extension, value },
    });
    return {
      summary: value === null
        ? `Cleared item extension '${extension}' on '${path}'`
        : `Set item extension '${extension}' on '${path}'`,
      action: { helper: 'setItemExtension', params: { path, extension, value } },
      affectedPaths: [path],
    };
  }

/**
   * Set widget constraint properties (min, max, step, minDate, maxDate) on a field.
   * Updates both the component tree node AND generates a corresponding bind constraint.
   * If the existing bind constraint is not widget-managed (custom FEL), it is preserved.
   * Pass empty values to clear individual constraints.
   */
  export function setWidgetConstraints(
    project: ProjectInternals,
    path: string,
    values: Partial<NumericConstraintValues> | Partial<DateConstraintValues>,
  ): HelperResult {
    if (!project.core.itemAt(path)) {
      throwPathNotFound(project.core,path);
    }

    const leafKey = path.split('.').pop()!;
    const compNode = project.core.componentFor(leafKey);
    const component = compNode?.component as string | undefined;
    const constraintProps = getWidgetConstraintProps(component ?? '');
    if (constraintProps.length === 0) {
      return {
        summary: `Skipped widget constraints on '${path}' (no constraint widget)`,
        action: { helper: 'setWidgetConstraints', params: { path, values } },
        affectedPaths: [path],
      };
    }

    const isDateWidget = constraintProps.some(p => p.type === 'date');
    const commands: AnyCommand[] = [];

    const bind = project.core.bindFor(path);
    const existingConstraint = bind?.constraint as string | undefined;
    const hasCustomConstraint = !!existingConstraint && !isWidgetManagedConstraint(existingConstraint);

    if (isDateWidget) {
      const dateIn = values as Partial<DateConstraintValues>;
      const min = dateIn.min !== undefined ? dateIn.min : (compNode?.minDate as string | undefined);
      const max = dateIn.max !== undefined ? dateIn.max : (compNode?.maxDate as string | undefined);

      if (dateIn.min !== undefined) {
        commands.push({
          type: 'component.setNodeProperty',
          payload: { node: { bind: leafKey }, property: 'minDate', value: dateIn.min || null },
        });
      }
      if (dateIn.max !== undefined) {
        commands.push({
          type: 'component.setNodeProperty',
          payload: { node: { bind: leafKey }, property: 'maxDate', value: dateIn.max || null },
        });
      }
      if (!hasCustomConstraint) {
        const dateValues: DateConstraintValues = {
          ...(min ? { min } : {}),
          ...(max ? { max } : {}),
        };
        const spec: WidgetConstraintSpec = { type: 'date', values: dateValues };
        const fel = widgetConstraintToFEL(spec);
        commands.push({
          type: 'definition.setBind',
          payload: { path, properties: { constraint: fel ?? null } },
        });
      }
    } else {
      const numIn = values as Partial<NumericConstraintValues>;
      const min = numIn.min !== undefined ? numIn.min : (compNode?.min as number | undefined);
      const max = numIn.max !== undefined ? numIn.max : (compNode?.max as number | undefined);

      if (numIn.min !== undefined) {
        commands.push({
          type: 'component.setNodeProperty',
          payload: { node: { bind: leafKey }, property: 'min', value: numIn.min ?? null },
        });
      }
      if (numIn.max !== undefined) {
        commands.push({
          type: 'component.setNodeProperty',
          payload: { node: { bind: leafKey }, property: 'max', value: numIn.max ?? null },
        });
      }
      if (numIn.step !== undefined) {
        commands.push({
          type: 'component.setNodeProperty',
          payload: { node: { bind: leafKey }, property: 'step', value: numIn.step ?? null },
        });
      }
      if (!hasCustomConstraint) {
        const numValues: NumericConstraintValues = {
          ...(min != null ? { min } : {}),
          ...(max != null ? { max } : {}),
        };
        const spec: WidgetConstraintSpec = { type: 'numeric', values: numValues };
        const fel = widgetConstraintToFEL(spec);
        commands.push({
          type: 'definition.setBind',
          payload: { path, properties: { constraint: fel ?? null } },
        });
      }
    }

    if (commands.length > 0) {
      project.core.dispatch(commands);
    }

    return {
      summary: `Set widget constraints on '${path}'`,
      action: { helper: 'setWidgetConstraints', params: { path, values } },
      affectedPaths: [path],
    };
  }

  /**
   * Read current widget constraint values for a field from its component node.
   * Returns the component-level min/max/step (or minDate/maxDate) and whether
   * the bind constraint is widget-managed or custom.
   */
export function getWidgetConstraints(project: ProjectInternals, path: string): WidgetConstraintState {
    const leafKey = path.split('.').pop()!;
    const compNode = project.core.componentFor(leafKey);
    const component = (compNode?.component as string) ?? null;
    const constraintProps = getWidgetConstraintProps(component ?? '');
    if (constraintProps.length === 0) {
      return {
        type: 'none',
        numericValues: {},
        dateValues: {},
        isManaged: false,
        hasCustomConstraint: false,
        component,
      };
    }

    const isDateWidget = constraintProps.some(p => p.type === 'date');
    const numericValues: NumericConstraintValues = {};
    const dateValues: DateConstraintValues = {};

    if (isDateWidget) {
      if (compNode?.minDate != null) dateValues.min = String(compNode.minDate);
      if (compNode?.maxDate != null) dateValues.max = String(compNode.maxDate);
    } else {
      if (compNode?.min != null) numericValues.min = Number(compNode.min);
      if (compNode?.max != null) numericValues.max = Number(compNode.max);
      if (compNode?.step != null) numericValues.step = Number(compNode.step);
    }

    const bind = project.core.bindFor(path);
    const existingConstraint = bind?.constraint as string | undefined;
    const hasCustomConstraint = !!existingConstraint && !isWidgetManagedConstraint(existingConstraint);
    const isManaged = !!existingConstraint && isWidgetManagedConstraint(existingConstraint);

    return {
      type: isDateWidget ? 'date' : 'numeric',
      numericValues,
      dateValues,
      isManaged,
      hasCustomConstraint,
      component,
    };
  }
  // ── Move / Rename / Reorder ──

  /** Move item to a new parent or position. */
export function moveItem(project: ProjectInternals, path: string, targetParentPath?: string, targetIndex?: number): HelperResult {
    project.core.dispatch({
      type: 'definition.moveItem',
      payload: { sourcePath: path, targetParentPath, targetIndex },
    });
    // Compute new path
    const leafKey = path.split('.').pop()!;
    const newPath = targetParentPath ? `${targetParentPath}.${leafKey}` : leafKey;
    // Build descriptive summary — when path == newPath it's a reorder, not a cross-parent move
    const parentLabel = targetParentPath ? `'${targetParentPath}'` : 'root';
    const indexLabel = targetIndex !== undefined ? ` at index ${targetIndex}` : '';
    const summary = path === newPath
      ? `Moved '${path}' to ${parentLabel}${indexLabel}`
      : `Moved '${path}' to '${newPath}'${indexLabel}`;
    return {
      summary,
      action: { helper: 'moveItem', params: { path, targetParentPath, targetIndex } },
      affectedPaths: [newPath],
    };
  }

  /** Rename item — FEL reference rewriting handled inside the handler. */
export function renameItem(project: ProjectInternals, path: string, newKey: string): HelperResult {
    project.core.dispatch({
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
export function reorderItem(project: ProjectInternals, path: string, direction: 'up' | 'down'): HelperResult {
    project.core.dispatch({
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
const _VALID_METADATA_KEYS = new Set([
    'title', 'name', 'description', 'url', 'version', 'status', 'date',
    'versionAlgorithm', 'nonRelevantBehavior', 'derivedFrom',
    'density', 'labelPosition', 'pageMode', 'defaultCurrency',
    'showProgress', 'allowSkip', 'defaultTab', 'tabPosition', 'direction',
  ]);

  /** Keys that route to definition.setFormPresentation. */
const _PRESENTATION_KEYS = new Set([
    'density', 'labelPosition', 'pageMode', 'defaultCurrency',
    'showProgress', 'allowSkip', 'defaultTab', 'tabPosition', 'direction',
  ]);

  /** Form-level metadata setter. */
export function setMetadata(project: ProjectInternals, changes: MetadataChanges): HelperResult {
    // Validate keys
    for (const key of Object.keys(changes)) {
      if (!_VALID_METADATA_KEYS.has(key)) {
        throw new HelperError('INVALID_KEY', `Unknown metadata key "${key}"`, {
          invalidKey: key,
          validKeys: [..._VALID_METADATA_KEYS],
        });
      }
    }

    const commands: AnyCommand[] = [];
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) continue;

      if (key === 'title') {
        commands.push({ type: 'definition.setFormTitle', payload: { title: value } });
      } else if (_PRESENTATION_KEYS.has(key)) {
        commands.push({ type: 'definition.setFormPresentation', payload: { property: key, value } });
      } else {
        commands.push({ type: 'definition.setDefinitionProperty', payload: { property: key, value } });
      }
    }

    if (commands.length > 0) {
      project.core.dispatch(commands);
    }

    return {
      summary: `Updated form metadata`,
      action: { helper: 'setMetadata', params: { changes } },
      affectedPaths: [],
    };
  }

  // ── Choices ──

  /** Define a reusable named option set. */
export function defineChoices(project: ProjectInternals, name: string, options: ChoiceOption[]): HelperResult {
    project.core.dispatch({
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
export function makeRepeatable(project: ProjectInternals, target: string, props?: RepeatProps): HelperResult {
    // Pre-validate: target must be a group
    const item = project.core.itemAt(target);
    if (!item) {
      throwPathNotFound(project.core,target);
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

    project.core.dispatch(commands);

    return {
      summary: `Made group '${target}' repeatable`,
      action: { helper: 'makeRepeatable', params: { target, ...props } },
      affectedPaths: [],
    };
  }

  /** Set the display mode for a repeatable group — 'stack' (default) or 'table' (DataTable). */
export function setGroupDisplayMode(project: ProjectInternals, groupKey: string, mode: 'stack' | 'table'): HelperResult {
    const leafKey = groupKey.split('.').pop()!;
    project.core.dispatch({
      type: 'component.setGroupDisplayMode',
      payload: { groupKey: leafKey, mode },
    });
    return {
      summary: `Set group '${groupKey}' display mode to '${mode}'`,
      action: { helper: 'setGroupDisplayMode', params: { groupKey, mode } },
      affectedPaths: [groupKey],
    };
  }

  // ── Copy Item ──

  /** Copy a field or group. If targetPath is provided, places the clone under that group. */
export function copyItem(project: ProjectInternals, path: string, deep?: boolean, targetPath?: string): HelperResult {
    const item = project.core.itemAt(path);
    if (!item) {
      throwPathNotFound(project.core,path);
    }

    // Validate targetPath if provided
    if (targetPath !== undefined) {
      const targetItem = project.core.itemAt(targetPath);
      if (!targetItem) {
        throw new HelperError('PATH_NOT_FOUND', `Target path not found: ${targetPath}`);
      }
    }

    const sourceParent = path.includes('.') ? path.slice(0, path.lastIndexOf('.')) : undefined;
    const needsMove = targetPath !== undefined && targetPath !== sourceParent;
    const leafKey = path.split('.').pop()!;
    const cloneKey = _predictCloneKey(project, path);
    const clonePath = sourceParent ? `${sourceParent}.${cloneKey}` : cloneKey;

    // When moving to a different parent, use original key if no collision in target
    const finalKey = needsMove && !_hasKeyInGroup(project, targetPath!, leafKey) ? leafKey : cloneKey;
    const finalPath = needsMove ? `${targetPath}.${finalKey}` : clonePath;

    if (!deep) {
      // Shallow copy — duplicate, then optionally move to target
      const commands: AnyCommand[] = [
        { type: 'definition.duplicateItem', payload: { path } },
      ];

      if (needsMove) {
        commands.push({
          type: 'definition.moveItem',
          payload: { sourcePath: clonePath, targetParentPath: targetPath },
        });
        if (finalKey !== cloneKey) {
          commands.push({
            type: 'definition.renameItem',
            payload: { path: `${targetPath}.${cloneKey}`, newKey: finalKey },
          });
        }
      }

      project.core.dispatch(commands);

      // Collect warnings about omitted binds/shapes
      const warnings: HelperWarning[] = [];
      const binds = project.core.state.definition.binds ?? [];
      const shapes = project.core.state.definition.shapes ?? [];

      const matchingBinds = binds.filter(b =>
        b.path === path || b.path?.startsWith(`${path}.`),
      );
      if (matchingBinds.length > 0) {
        const props = matchingBinds.flatMap(b =>
          Object.keys(b).filter(k => k !== 'path'),
        );
        warnings.push({
          code: 'BINDS_NOT_COPIED',
          message: `${matchingBinds.length} bind(s) not copied`,
          detail: { count: matchingBinds.length, properties: [...new Set(props)] },
        });
      }

      const matchingShapes = shapes.filter(s =>
        s.target === path || s.target?.startsWith(`${path}.`),
      );
      if (matchingShapes.length > 0) {
        warnings.push({
          code: 'SHAPES_NOT_COPIED',
          message: `${matchingShapes.length} shape(s) not copied`,
          detail: { count: matchingShapes.length },
        });
      }

      const dest = needsMove ? ` to '${targetPath}'` : '';
      return {
        summary: `Copied '${path}' (shallow)${dest}`,
        action: { helper: 'copyItem', params: { path, deep: false, ...(targetPath !== undefined ? { targetPath } : {}) } },
        affectedPaths: [finalPath],
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    // Deep copy — duplicate + rewrite FEL references in binds/shapes, then optionally move
    const phase1: AnyCommand[] = [
      { type: 'definition.duplicateItem', payload: { path } },
    ];

    // Collect bind/shape data before dispatch
    const binds = project.core.state.definition.binds ?? [];
    const shapes = project.core.state.definition.shapes ?? [];

    const matchingBinds = binds.filter(b =>
      b.path === path || b.path?.startsWith(`${path}.`),
    );

    const matchingShapes = shapes.filter(s =>
      s.target === path || s.target?.startsWith(`${path}.`),
    );

    project.core.batchWithRebuild(phase1, (() => {
      const phase2: AnyCommand[] = [];

      // Rewrite paths to the final destination (accounts for eventual move+rename)
      const rewritePath = (p: string): string => {
        if (p === path) return finalPath;
        if (p.startsWith(`${path}.`)) return finalPath + p.slice(path.length);
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
          const rewrittenContext: Record<string, string> = {};
          for (const [key, expr] of Object.entries(shape.context)) {
            const s = typeof expr === 'string' ? expr : undefined;
            rewrittenContext[key] = rewriteFEL(s) ?? s ?? '';
          }
          payload.context = rewrittenContext;
        }
        phase2.push({ type: 'definition.addShape', payload });
      }

      // If relocating, add move + rename commands after FEL rewriting
      if (needsMove) {
        phase2.push({
          type: 'definition.moveItem',
          payload: { sourcePath: clonePath, targetParentPath: targetPath },
        });
        if (finalKey !== cloneKey) {
          phase2.push({
            type: 'definition.renameItem',
            payload: { path: `${targetPath}.${cloneKey}`, newKey: finalKey },
          });
        }
      }

      return phase2;
    })());

    const dest = needsMove ? ` to '${targetPath}'` : '';
    return {
      summary: `Copied '${path}' (deep)${dest}`,
      action: { helper: 'copyItem', params: { path, deep: true, ...(targetPath !== undefined ? { targetPath } : {}) } },
      affectedPaths: [finalPath],
    };
  }

  /** Predict the clone key that duplicateItem will generate. */
/** Build a unique key for a clone (e.g. "item_clone"). */
function _predictCloneKey(project: ProjectInternals, path: string): string {
    const leafKey = path.split('.').pop()!;
    const parentPath = path.includes('.') ? path.slice(0, path.lastIndexOf('.')) : undefined;
    const parentItem = parentPath ? project.core.itemAt(parentPath) : undefined;
    const siblings: FormItem[] = parentPath
      ? parentItem?.children ?? []
      : project.core.state.definition.items;
    const existingKeys = new Set(siblings.map(s => s.key));

    // Replicate uniqueKey logic from definition-items.ts
    if (!existingKeys.has(leafKey)) return leafKey;
    let suffix = 1;
    while (existingKeys.has(`${leafKey}_${suffix}`)) suffix++;
    return `${leafKey}_${suffix}`;
  }

  /** Check if a group already contains a child with the given key. */
/** Check if a key exists within a specific group. */
function _hasKeyInGroup(project: ProjectInternals, groupPath: string, key: string): boolean {
    const groupItem = project.core.itemAt(groupPath);
    if (!groupItem?.children) return false;
    return groupItem.children.some(c => c.key === key);
  }

  // ── Wrap Items In Group ──

  /**
   * Wrap existing items in a new group container.
   * When groupPath is provided, uses it as the group key (must not already exist).
   * When omitted, auto-generates a unique key.
   */
export function wrapItemsInGroup(project: ProjectInternals, paths: string[], groupPathOrLabel?: string, groupLabel?: string): HelperResult {
    // Pre-validation
    for (const p of paths) {
      if (!project.core.itemAt(p)) {
        throwPathNotFound(project.core,p);
      }
    }

    // Descendant deduplication
    const pruned = paths.filter(p =>
      !paths.some(other => other !== p && p.startsWith(`${other}.`)),
    );

    // Determine groupKey and label from arguments
    let explicitGroupPath: string | undefined;
    let label: string;
    if (groupLabel !== undefined) {
      // Called as wrapItemsInGroup(paths, groupPath, groupLabel)
      explicitGroupPath = groupPathOrLabel;
      label = groupLabel;
    } else {
      // Called as wrapItemsInGroup(paths, label?)
      label = groupPathOrLabel ?? 'Group';
    }

    // When an explicit group path is given, pre-validate it
    if (explicitGroupPath !== undefined) {
      if (project.core.itemAt(explicitGroupPath)) {
        throw new HelperError('DUPLICATE_KEY', `An item with key "${explicitGroupPath}" already exists`, {
          path: explicitGroupPath,
        });
      }
    }

    const groupKey = explicitGroupPath ?? `group_${Date.now()}`;

    // Find first item's position for the new group
    const firstPath = pruned[0];
    const firstSegments = firstPath.split('.');
    const firstItemKey = firstSegments.pop()!;
    const parentPath = firstSegments.length > 0 ? firstSegments.join('.') : undefined;

    // Find insertIndex of first item
    const parentItems = parentPath
      ? project.core.itemAt(parentPath)?.children ?? []
      : project.core.state.definition.items;
    const insertIndex = parentItems.findIndex(i => i.key === firstItemKey);

    const addPayload: Record<string, unknown> = {
      type: 'group', key: groupKey, label,
    };
    if (parentPath) addPayload.parentPath = parentPath;
    if (insertIndex >= 0) addPayload.insertIndex = insertIndex;

    const resolvedGroupPath = parentPath ? `${parentPath}.${groupKey}` : groupKey;

    const phase2 = pruned.map((p, i) => ({
      type: 'definition.moveItem' as const,
      payload: { sourcePath: p, targetParentPath: resolvedGroupPath, targetIndex: i },
    }));

    project.core.batchWithRebuild(
      [{ type: 'definition.addItem', payload: addPayload }],
      phase2,
    );

    const movedPaths = pruned.map(p => {
      const leaf = p.split('.').pop()!;
      return `${resolvedGroupPath}.${leaf}`;
    });

    return {
      summary: `Wrapped ${pruned.length} item(s) in group '${groupKey}'`,
      action: { helper: 'wrapItemsInGroup', params: { paths: pruned, groupPath: resolvedGroupPath, label } },
      affectedPaths: [resolvedGroupPath, ...movedPaths],
    };
  }

  // ── Wrap In Layout Component ──

  /** Wrap an item node in a layout component. */
export function wrapInLayoutComponent(project: ProjectInternals, path: string, component: 'Card' | 'Stack' | 'Collapsible'): HelperResult {
    if (!project.core.itemAt(path)) {
      throwPathNotFound(project.core,path);
    }

    const leafKey = path.split('.').pop()!;
    const result = project.core.dispatch({
      type: 'component.wrapNode',
      payload: { node: { bind: leafKey }, wrapper: { component } },
    });
    const nodeId = result?.nodeRef?.nodeId;

    return {
      summary: `Wrapped '${path}' in ${component}`,
      action: { helper: 'wrapInLayoutComponent', params: { path, component } },
      affectedPaths: [nodeId ?? path],
      createdId: nodeId,
    };
  }

  // ── Batch Operations ──

  /**
   * Batch delete multiple items atomically. Pre-validates all paths exist,
   * collects cleanup commands for dependent binds/shapes/variables, then
   * dispatches everything in a single atomic operation.
   */
export function batchDeleteItems(project: ProjectInternals, paths: string[]): HelperResult {
    if (paths.length === 0) {
      return {
        summary: 'No items to delete',
        action: { helper: 'batchDeleteItems', params: { paths } },
        affectedPaths: [],
      };
    }

    // Pre-validate: all paths must exist
    for (const p of paths) {
      if (!project.core.itemAt(p)) {
        throwPathNotFound(project.core,p);
      }
    }

    // Descendant deduplication
    const pruned = paths.filter(p =>
      !paths.some(other => other !== p && p.startsWith(`${other}.`)),
    );
    // Sort deepest-first so child deletions don't invalidate parent paths
    const sorted = [...pruned].sort((a, b) => b.split('.').length - a.split('.').length);

    project.core.dispatch(
      sorted.map(p => ({ type: 'definition.deleteItem' as const, payload: { path: p } })),
    );

    return {
      summary: `Deleted ${sorted.length} item(s)`,
      action: { helper: 'batchDeleteItems', params: { paths: sorted } },
      affectedPaths: sorted,
    };
  }

  /**
   * Batch duplicate multiple items using copyItem for full bind/shape handling.
   */
export function batchDuplicateItems(project: ProjectInternals, paths: string[]): HelperResult {
    if (paths.length === 0) {
      return {
        summary: 'No items to duplicate',
        action: { helper: 'batchDuplicateItems', params: { paths } },
        affectedPaths: [],
      };
    }

    // Descendant deduplication
    const pruned = paths.filter(p =>
      !paths.some(other => other !== p && p.startsWith(`${other}.`)),
    );

    const affectedPaths: string[] = [];
    for (const p of pruned) {
      const result = copyItem(project, p);
      affectedPaths.push(...result.affectedPaths);
    }

    return {
      summary: `Duplicated ${pruned.length} item(s)`,
      action: { helper: 'batchDuplicateItems', params: { paths: pruned } },
      affectedPaths,
    };
  }

  // ── Option Set Helpers ──

  /** Update a property on an option set. */
  export function updateOptionSet(project: ProjectInternals, name: string, property: string, value: unknown): HelperResult {
    project.core.dispatch({
      type: 'definition.setOptionSetProperty',
      payload: { name, property, value },
    });
    return {
      summary: `Updated option set '${name}' property '${property}'`,
      action: { helper: 'updateOptionSet', params: { name, property, value } },
      affectedPaths: [],
    };
  }

  /** Delete an option set by name. */
  export function deleteOptionSet(project: ProjectInternals, name: string): HelperResult {
    project.core.dispatch({
      type: 'definition.deleteOptionSet',
      payload: { name },
    });
    return {
      summary: `Deleted option set '${name}'`,
      action: { helper: 'deleteOptionSet', params: { name } },
      affectedPaths: [],
    };
  }


