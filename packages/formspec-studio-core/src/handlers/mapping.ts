/**
 * Mapping command handlers.
 *
 * The Formspec mapping document defines bidirectional transforms between form
 * responses (source) and external data schemas (target). It supports multiple
 * output formats (JSON, XML, CSV) via format-specific adapters.
 *
 * Key concepts:
 *
 *   - **Rules** -- Each rule connects a form field `sourcePath` to an external
 *     `targetPath` with an optional `transform` (preserve, expression, coerce,
 *     valueMap, flatten, nest, etc.). Rules are ordered; order can matter for
 *     priority resolution.
 *   - **Inner rules** -- For array-typed fields, a parent rule can contain
 *     `innerRules` that map individual sub-fields within each array element.
 *   - **Adapters** -- Format-specific serialization configuration (e.g. JSON
 *     pretty-print, XML indentation, CSV delimiters).
 *   - **Target schema** -- Describes the external data format: `format`
 *     (json/xml/csv/x-*), `name`, `url`, `rootElement`, `namespaces`.
 *   - **Defaults** -- Literal key-value pairs written to the target output
 *     before any rules execute.
 *   - **Auto-generation** -- Rules can be auto-generated for all leaf fields
 *     in the definition that lack explicit coverage, producing visible and
 *     editable `preserve` rules (distinct from the runtime `autoMap` flag).
 *
 * All handlers return `{ rebuildComponentTree: false }` because mapping
 * mutations do not alter the definition item tree structure.
 *
 * @module handlers/mapping
 */
import { registerHandler } from '../handler-registry.js';
import { RuntimeMappingEngine, type FormspecItem } from 'formspec-engine';

/**
 * Set or remove a top-level mapping document property.
 *
 * Applicable properties include: `direction`, `autoMap`, `conformanceLevel`,
 * `version`, `definitionRef`, `definitionVersion`. Setting `value` to `null`
 * removes the property.
 *
 * @param payload.property - The top-level property name.
 * @param payload.value - The new value, or `null` to remove.
 */
registerHandler('mapping.setProperty', (state, payload) => {
  const { property, value } = payload as { property: string; value: unknown };
  if (value === null) {
    delete (state.mapping as any)[property];
  } else {
    (state.mapping as any)[property] = value;
  }
  return { rebuildComponentTree: false };
});

/**
 * Set or remove a target schema property.
 *
 * The target schema describes the external data structure this mapping
 * produces. Properties include: `format` (json/xml/csv/x-*), `name`,
 * `url`, `rootElement`, `namespaces`. Setting `value` to `null` removes
 * the property.
 *
 * @param payload.property - The target schema property name.
 * @param payload.value - The new value, or `null` to remove.
 */
registerHandler('mapping.setTargetSchema', (state, payload) => {
  const { property, value } = payload as { property: string; value: unknown };
  if (!state.mapping.targetSchema) state.mapping.targetSchema = {};
  if (value === null) {
    delete state.mapping.targetSchema[property];
  } else {
    state.mapping.targetSchema[property] = value;
  }
  return { rebuildComponentTree: false };
});

/**
 * Append or insert a new transform rule.
 *
 * A rule connects a form field path (source) to an external data path (target)
 * with a transform strategy. The default transform is `"preserve"` (copy the
 * value as-is). Additional rule properties (condition, coerce, valueMap, etc.)
 * can be set after creation via `mapping.setRule`.
 *
 * @param payload.sourcePath - Form field path (e.g. `"personalInfo.firstName"`).
 * @param payload.targetPath - External schema path (e.g. `"first_name"`).
 * @param payload.transform - Transform type. Defaults to `"preserve"`.
 * @param payload.insertIndex - Position to insert at. Omit to append at end.
 */
registerHandler('mapping.addRule', (state, payload) => {
  const p = payload as { sourcePath?: string; targetPath?: string; transform?: string; insertIndex?: number };
  if (!state.mapping.rules) state.mapping.rules = [];

  const rule: any = {};
  if (p.sourcePath !== undefined) rule.sourcePath = p.sourcePath;
  if (p.targetPath !== undefined) rule.targetPath = p.targetPath;
  rule.transform = p.transform ?? 'preserve';

  if (p.insertIndex !== undefined) {
    (state.mapping.rules as any[]).splice(p.insertIndex, 0, rule);
  } else {
    (state.mapping.rules as any[]).push(rule);
  }
  return { rebuildComponentTree: false };
});

/**
 * Update any property on an existing rule.
 *
 * Settable properties include: `sourcePath`, `targetPath`, `transform`,
 * `expression`, `condition`, `coerce`, `valueMap`, `array`, `reverse`,
 * `default`, `priority`, `bidirectional`, `separator`, `description`,
 * `reversePriority`.
 *
 * @param payload.index - Zero-based index of the rule to update.
 * @param payload.property - The rule property name to set.
 * @param payload.value - The new value.
 * @throws Error if no rule exists at the given index.
 */
registerHandler('mapping.setRule', (state, payload) => {
  const { index, property, value } = payload as { index: number; property: string; value: unknown };
  const rules = state.mapping.rules as any[];
  if (!rules?.[index]) throw new Error(`Rule not found at index: ${index}`);
  rules[index][property] = value;
  return { rebuildComponentTree: false };
});

/**
 * Remove a rule by index.
 *
 * @param payload.index - Zero-based index of the rule to remove.
 */
registerHandler('mapping.deleteRule', (state, payload) => {
  const { index } = payload as { index: number };
  if (!state.mapping.rules) return { rebuildComponentTree: false };
  (state.mapping.rules as any[]).splice(index, 1);
  return { rebuildComponentTree: false };
});

/**
 * Swap a rule with its adjacent neighbor.
 *
 * Rule order can matter for priority resolution when multiple rules
 * target the same output path. No-ops silently if the move would go
 * out of bounds.
 *
 * @param payload.index - Zero-based index of the rule to move.
 * @param payload.direction - `"up"` to swap with previous, `"down"` with next.
 */
registerHandler('mapping.reorderRule', (state, payload) => {
  const { index, direction } = payload as { index: number; direction: 'up' | 'down' };
  const rules = state.mapping.rules as any[];
  if (!rules) return { rebuildComponentTree: false };
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= rules.length) return { rebuildComponentTree: false };
  [rules[index], rules[target]] = [rules[target], rules[index]];
  return { rebuildComponentTree: false };
});

/**
 * Set format-specific adapter configuration.
 *
 * Adapters control serialization details for each output format:
 *   - **json**: `pretty`, `sortKeys`, `nullHandling`
 *   - **xml**: `declaration`, `indent`, `cdata`
 *   - **csv**: `delimiter`, `quote`, `header`, `encoding`, `lineEnding`
 *
 * @param payload.format - The adapter format key (e.g. `"json"`, `"xml"`, `"csv"`).
 * @param payload.config - The adapter configuration object.
 */
registerHandler('mapping.setAdapter', (state, payload) => {
  const { format, config } = payload as { format: string; config: unknown };
  if (!(state.mapping as any).adapters) (state.mapping as any).adapters = {};
  (state.mapping as any).adapters[format] = config;
  return { rebuildComponentTree: false };
});

/**
 * Set literal default values written to the target output before rules execute.
 *
 * Replaces the entire defaults object.
 *
 * @param payload.defaults - Key-value pairs to write to target before rule execution.
 */
registerHandler('mapping.setDefaults', (state, payload) => {
  const { defaults } = payload as { defaults: Record<string, unknown> };
  (state.mapping as any).defaults = defaults;
  return { rebuildComponentTree: false };
});

/**
 * Auto-generate `preserve` rules for all leaf fields not already covered.
 *
 * Walks the definition item tree (optionally scoped to a subtree) and creates
 * a `preserve` rule for every field whose `sourcePath` is not already present
 * in an existing rule. Generated rules are marked with `_autoGenerated: true`
 * and assigned a low priority (default -1) so explicit rules take precedence.
 *
 * This is distinct from the runtime `autoMap` flag, which copies unmentioned
 * fields at execution time without persisting rules. Auto-generated rules are
 * visible and editable in the mapping document.
 *
 * @param payload.scopePath - Only generate rules for fields under this path
 *   prefix. Omit to cover all fields.
 * @param payload.priority - Priority for generated rules. Default: -1.
 * @param payload.replace - When true, removes existing auto-generated rules
 *   before regenerating. Default: false.
 */
registerHandler('mapping.autoGenerateRules', (state, payload) => {
  const p = payload as { scopePath?: string; priority?: number; replace?: boolean };
  if (!state.mapping.rules) state.mapping.rules = [];

  const rules = state.mapping.rules as any[];

  if (p.replace) {
    // Remove previously auto-generated rules
    for (let i = rules.length - 1; i >= 0; i--) {
      if (rules[i]['x-autoGenerated']) rules.splice(i, 1);
    }
  }

  // Collect all field paths
  const covered = new Set(rules.map((r: any) => r.sourcePath));
  const fieldPaths: string[] = [];
  const walk = (items: FormspecItem[], prefix: string) => {
    for (const item of items) {
      const path = prefix ? `${prefix}.${item.key}` : item.key;
      if (item.type === 'field') fieldPaths.push(path);
      if (item.children) walk(item.children, path);
    }
  };
  walk(state.definition.items, p.scopePath ?? '');

  for (const path of fieldPaths) {
    if (!covered.has(path)) {
      rules.push({
        sourcePath: path,
        targetPath: path,
        transform: 'preserve',
        priority: p.priority ?? -1,
        'x-autoGenerated': true,
      });
    }
  }

  return { rebuildComponentTree: false };
});

/**
 * Set or remove a document-level `x-` extension property on the mapping.
 *
 * Extension keys MUST be `x-` prefixed. Setting `value` to `null` removes
 * the extension property.
 *
 * @param payload.key - Extension key (must start with `"x-"`).
 * @param payload.value - The extension value, or `null` to remove.
 */
registerHandler('mapping.setExtension', (state, payload) => {
  const { key, value } = payload as { key: string; value: unknown };
  if (value === null) {
    delete (state.mapping as any)[key];
  } else {
    (state.mapping as any)[key] = value;
  }
  return { rebuildComponentTree: false };
});

/**
 * Set or remove an `x-` extension property on a specific rule.
 *
 * Extension keys MUST be `x-` prefixed. Setting `value` to `null` removes
 * the extension property from the rule.
 *
 * @param payload.index - Zero-based index of the rule.
 * @param payload.key - Extension key (must start with `"x-"`).
 * @param payload.value - The extension value, or `null` to remove.
 * @throws Error if no rule exists at the given index.
 */
registerHandler('mapping.setRuleExtension', (state, payload) => {
  const { index, key, value } = payload as { index: number; key: string; value: unknown };
  const rules = state.mapping.rules as any[];
  if (!rules?.[index]) throw new Error(`Rule not found at index: ${index}`);
  if (value === null) {
    delete rules[index][key];
  } else {
    rules[index][key] = value;
  }
  return { rebuildComponentTree: false };
});

/**
 * Add an inner rule within an existing rule's array descriptor.
 *
 * Inner rules map individual sub-fields within array elements. They are
 * used when a parent rule handles an array-typed field and needs per-element
 * field-level transforms. The parent rule must exist; its `innerRules` array
 * is lazily created.
 *
 * @param payload.ruleIndex - Zero-based index of the parent rule.
 * @param payload.sourcePath - Source sub-field path within the array element.
 * @param payload.targetPath - Target sub-field path within the output element.
 * @param payload.transform - Transform type. Defaults to `"preserve"`.
 * @param payload.insertIndex - Position within innerRules. Omit to append.
 * @throws Error if the parent rule does not exist.
 */
registerHandler('mapping.addInnerRule', (state, payload) => {
  const p = payload as {
    ruleIndex: number; sourcePath?: string; targetPath?: string;
    transform?: string; insertIndex?: number;
  };
  const rules = state.mapping.rules as any[];
  if (!rules?.[p.ruleIndex]) throw new Error(`Rule not found at index: ${p.ruleIndex}`);

  const rule = rules[p.ruleIndex];
  if (!rule.innerRules) rule.innerRules = [];

  const inner: any = {};
  if (p.sourcePath !== undefined) inner.sourcePath = p.sourcePath;
  if (p.targetPath !== undefined) inner.targetPath = p.targetPath;
  inner.transform = p.transform ?? 'preserve';

  if (p.insertIndex !== undefined) {
    rule.innerRules.splice(p.insertIndex, 0, inner);
  } else {
    rule.innerRules.push(inner);
  }
  return { rebuildComponentTree: false };
});

/**
 * Update a property on an existing inner rule.
 *
 * @param payload.ruleIndex - Zero-based index of the parent rule.
 * @param payload.innerIndex - Zero-based index of the inner rule.
 * @param payload.property - The inner rule property to update.
 * @param payload.value - The new value.
 * @throws Error if the parent rule or inner rule does not exist.
 */
registerHandler('mapping.setInnerRule', (state, payload) => {
  const { ruleIndex, innerIndex, property, value } = payload as {
    ruleIndex: number; innerIndex: number; property: string; value: unknown;
  };
  const rules = state.mapping.rules as any[];
  if (!rules?.[ruleIndex]?.innerRules?.[innerIndex]) throw new Error('Inner rule not found');
  rules[ruleIndex].innerRules[innerIndex][property] = value;
  return { rebuildComponentTree: false };
});

/**
 * Remove an inner rule from a parent rule's array descriptor.
 *
 * @param payload.ruleIndex - Zero-based index of the parent rule.
 * @param payload.innerIndex - Zero-based index of the inner rule to remove.
 * @throws Error if the parent rule or inner rules array does not exist.
 */
registerHandler('mapping.deleteInnerRule', (state, payload) => {
  const { ruleIndex, innerIndex } = payload as { ruleIndex: number; innerIndex: number };
  const rules = state.mapping.rules as any[];
  if (!rules?.[ruleIndex]?.innerRules) throw new Error('Inner rules not found');
  rules[ruleIndex].innerRules.splice(innerIndex, 1);
  return { rebuildComponentTree: false };
});

/**
 * Swap an inner rule with its adjacent neighbor within the parent rule.
 *
 * No-ops silently if the move would go out of bounds.
 *
 * @param payload.ruleIndex - Zero-based index of the parent rule.
 * @param payload.innerIndex - Zero-based index of the inner rule to move.
 * @param payload.direction - `"up"` to swap with previous, `"down"` with next.
 * @throws Error if the parent rule or inner rules array does not exist.
 */
registerHandler('mapping.reorderInnerRule', (state, payload) => {
  const { ruleIndex, innerIndex, direction } = payload as {
    ruleIndex: number; innerIndex: number; direction: 'up' | 'down';
  };
  const rules = state.mapping.rules as any[];
  if (!rules?.[ruleIndex]?.innerRules) throw new Error('Inner rules not found');
  const inner = rules[ruleIndex].innerRules;
  const target = direction === 'up' ? innerIndex - 1 : innerIndex + 1;
  if (target < 0 || target >= inner.length) return { rebuildComponentTree: false };
  [inner[innerIndex], inner[target]] = [inner[target], inner[innerIndex]];
  return { rebuildComponentTree: false };
});

/**
 * Dry-run the mapping against sample data for development and debugging.
 *
 * Applies `preserve` rules by copying values from source paths to target paths.
 * Returns the transformed output as part of the command result without persisting
 * anything to the mapping document.
 *
 * @param payload.sampleData - Sample form response data to transform.
 * @param payload.direction - `"forward"` (source-to-target) or `"reverse"`.
 *   Currently only forward is implemented.
 * @param payload.ruleIndices - Subset of rule indices to apply. Omit for all.
 * @returns Command result with an additional `output` property containing
 *   the transformed data.
 */
registerHandler('mapping.preview', (state, payload) => {
  const {
    sampleData,
    direction,
    ruleIndices,
  } = payload as { sampleData: Record<string, unknown>; direction?: string; ruleIndices?: number[] };

  const mappingDoc = structuredClone(state.mapping) as any;
  if (Array.isArray(ruleIndices) && Array.isArray(mappingDoc.rules)) {
    mappingDoc.rules = ruleIndices
      .map(index => mappingDoc.rules[index])
      .filter((rule: unknown) => rule !== undefined);
  }

  const runtime = new RuntimeMappingEngine(mappingDoc);
  const result = direction === 'reverse'
    ? runtime.reverse(sampleData)
    : runtime.forward(sampleData);

  return {
    rebuildComponentTree: false,
    output: result.output,
    diagnostics: result.diagnostics,
    appliedRules: result.appliedRules,
    direction: result.direction,
  };
});
