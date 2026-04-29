/** @filedesc Output Blueprint panel — live response document with editable data, type tags, and inline validation. */
import { useState, useCallback, useMemo } from 'react';
import { createFormEngine } from '@formspec-org/engine';
import { sampleFieldValue } from '@formspec-org/studio-core';
import { useDefinition } from '../../state/useDefinition';
import { useOptionalSelection } from '../../state/useSelection';
import type { FormItem, FormDefinition, ValidationResult } from '@formspec-org/types';

type ValueMap = Record<string, string>;
type ValidationMap = Record<string, ValidationResult[]>;

function initialValues(items: FormItem[], prefix = ''): ValueMap {
  const map: ValueMap = {};
  for (const item of items) {
    if (item.type === 'display') continue;
    const path = prefix ? `${prefix}.${item.key}` : item.key;
    if (item.type === 'group') {
      if (item.children) {
        const childPrefix = item.repeatable ? `${path}[0]` : path;
        Object.assign(map, initialValues(item.children, childPrefix));
      }
    } else {
      const val = sampleFieldValue(item.key, item.dataType, {
        firstOptionValue: item.options?.[0]?.value,
        secondOptionValue: item.options?.[1]?.value,
      });
      map[path] = typeof val === 'object' ? JSON.stringify(val) : String(val);
    }
  }
  return map;
}

function addRepeatInstances(engine: ReturnType<typeof createFormEngine>, items: FormItem[], prefix = '') {
  for (const item of items) {
    if (item.type === 'display') continue;
    const path = prefix ? `${prefix}.${item.key}` : item.key;
    if (item.type === 'group' && item.repeatable) {
      engine.addRepeatInstance(path);
      if (item.children) addRepeatInstances(engine, item.children, `${path}[0]`);
    } else if (item.type === 'group' && item.children) {
      addRepeatInstances(engine, item.children, path);
    }
  }
}

/**
 * `getValidationReport()` paths use 1-based repeat indices (FEL convention via `toFelIndexedPath`).
 * Value map keys and `setValue` use 0-based indices — remap so inline errors match editable field paths.
 */
function validationReportPathToDataPath(reportPath: string): string {
  return reportPath.replace(/\[(\d+)\]/g, (_m, n) => `[${Number(n) - 1}]`);
}

/** Report paths may omit ancestor groups (e.g. `members[0].mName` vs value key `hh.members[0].mName`). */
function valueKeysMatchingReportPath(valueKeys: string[], normalizedReportPath: string): string[] {
  return valueKeys.filter(
    (vk) => vk === normalizedReportPath || vk.endsWith(`.${normalizedReportPath}`),
  );
}

function runValidation(definition: FormDefinition, values: ValueMap): { map: ValidationMap; results: ValidationResult[] } {
  try {
    const engine = createFormEngine({ ...definition });
    addRepeatInstances(engine, definition.items ?? []);
    for (const [path, raw] of Object.entries(values)) {
      let parsed: unknown = raw;
      if (raw === 'true') parsed = true;
      else if (raw === 'false') parsed = false;
      else if (raw !== '' && !isNaN(Number(raw))) parsed = Number(raw);
      engine.setValue(path, parsed);
    }
    const report = engine.getValidationReport();
    const map: ValidationMap = {};
    const results: ValidationResult[] = [];
    const valueKeys = Object.keys(values);
    for (const r of report.results ?? []) {
      const normalized = validationReportPathToDataPath(r.path);
      const keysForMap = valueKeysMatchingReportPath(valueKeys, normalized);
      const storeUnder = keysForMap.length > 0 ? keysForMap : [normalized];
      const primaryPath = keysForMap[0] ?? normalized;
      const v: ValidationResult = {
        $formspecValidationResult: '1.0',
        path: primaryPath,
        severity: r.severity,
        message: r.message,
        constraintKind: r.constraintKind,
        code: r.code,
        source: r.source,
        sourceId: r.sourceId,
      };
      for (const path of storeUnder) {
        (map[path] ??= []).push(v);
      }
      results.push(v);
    }
    return { map, results };
  } catch {
    return { map: {}, results: [] };
  }
}

function typeTag(item: FormItem): string {
  if (item.type === 'group') return item.repeatable ? 'array' : 'object';
  return item.dataType ?? 'string';
}

// --- Shared rendering helpers ---

function JsonKey({ name, bold }: { name: string; bold?: boolean }) {
  return <span className={`text-orange-600 dark:text-orange-400 shrink-0 ${bold ? 'font-bold' : ''}`}>"{name}"</span>;
}

function JsonStr({ value }: { value: string }) {
  return <span className="text-green-700 dark:text-green-400">"{value}"</span>;
}

function JsonLit({ value }: { value: string }) {
  return <span className="text-blue-600 dark:text-blue-400">{value}</span>;
}

function Comma({ show }: { show: boolean }) {
  return show ? <span className="text-muted">,</span> : null;
}

function StaticField({ name, value, isString, isLast, muted }: { name: string; value: string; isString?: boolean; isLast?: boolean; muted?: boolean }) {
  return (
    <div className={muted ? 'opacity-50' : ''}>
      <JsonKey name={name} />
      <span className="text-muted">: </span>
      {isString ? <JsonStr value={value} /> : <JsonLit value={value} />}
      <Comma show={!isLast} />
    </div>
  );
}

// --- Data field node ---

interface DataNodeProps {
  item: FormItem;
  path: string;
  isSelected: boolean;
  onSelect: (path: string, type: string) => void;
  isLast: boolean;
  values: ValueMap;
  validations: ValidationMap;
  onValueChange: (path: string, value: string) => void;
  readonlyBindPaths: Set<string>;
}

function isFieldReadonly(fullPath: string, bindPaths: Set<string>): boolean {
  for (const bp of bindPaths) {
    if (fullPath === bp || fullPath.endsWith(`.${bp}`)) return true;
  }
  return false;
}

function DataNode({ item, path, isSelected, onSelect, isLast, values, validations, onValueChange, readonlyBindPaths }: DataNodeProps) {
  const isGroup = item.type === 'group';
  if (item.type === 'display') return null;

  const fieldValidations = validations[path];
  const hasError = fieldValidations?.some((v) => v.severity === 'error');
  const tag = typeTag(item);
  const isReadonly = isFieldReadonly(path, readonlyBindPaths);

  return (
    <div className="font-mono text-[11px] leading-[1.7]">
      <div
        className={`group flex items-center gap-1 py-px px-1 rounded transition-colors cursor-pointer ${isSelected ? 'bg-accent/10' : 'hover:bg-subtle/50'} ${hasError ? 'bg-error/5' : ''}`}
        onClick={(e) => { e.stopPropagation(); onSelect(path, item.type); }}
      >
        <JsonKey name={item.key} />
        <span className="text-muted shrink-0">:</span>
        {isGroup ? (
          <span className="text-muted shrink-0">{item.repeatable ? ' [{' : ' {'}</span>
        ) : isReadonly ? (
          <>
            <input
              type="text"
              disabled
              value={values[path] ?? ''}
              className={`min-w-0 flex-1 bg-transparent text-blue-600 dark:text-blue-400 outline-none opacity-60 px-0.5 ${hasError ? 'text-error' : ''}`}
            />
            <Comma show={!isLast} />
          </>
        ) : (
          <>
            <input
              type="text"
              value={values[path] ?? ''}
              onChange={(e) => { e.stopPropagation(); onValueChange(path, e.target.value); }}
              onClick={(e) => e.stopPropagation()}
              className={`min-w-0 flex-1 bg-transparent text-blue-600 dark:text-blue-400 outline-none border-b border-transparent hover:border-border/50 focus:border-accent/50 px-0.5 ${hasError ? 'text-error' : ''}`}
            />
            <Comma show={!isLast} />
          </>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5 shrink-0">
          <span className="inline-flex items-center px-1.5 rounded bg-subtle text-[9px] font-bold uppercase tracking-tight text-muted/80 border border-border/50">{tag}</span>
          {item.required && <span className="text-[9px] font-bold text-error/70 uppercase tracking-tighter">*req</span>}
        </span>
      </div>

      {fieldValidations?.map((v, i) => (
        <div key={i} className={`ml-6 text-[10px] leading-tight py-0.5 ${v.severity === 'error' ? 'text-error' : v.severity === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-muted'}`}>
          {v.severity === 'error' ? '✕ ' : v.severity === 'warning' ? '⚠ ' : 'i '}{v.message}
        </div>
      ))}

      {isGroup && item.children && (
        <>
          <div className="ml-3 pl-2 border-l border-border/40 space-y-0">
            {item.children.filter((c: FormItem) => c.type !== 'display').map((child: FormItem, i: number, arr: FormItem[]) => {
              const childPrefix = item.repeatable ? `${path}[0]` : path;
              return (
                <DataNode
                  key={child.key}
                  item={child}
                  path={`${childPrefix}.${child.key}`}
                  isSelected={false}
                  onSelect={onSelect}
                  isLast={i === arr.length - 1}
                  values={values}
                  validations={validations}
                  onValueChange={onValueChange}
                  readonlyBindPaths={readonlyBindPaths}
                />
              );
            })}
          </div>
          <div className="px-1">
            <span className="text-muted">{item.repeatable ? '}]' : '}'}</span>
            <Comma show={!isLast} />
          </div>
        </>
      )}
    </div>
  );
}

// --- Validation result node ---

function ValidationResultNode({ result, isLast }: { result: ValidationResult; isLast: boolean }) {
  const severityColor = result.severity === 'error'
    ? 'text-error'
    : result.severity === 'warning'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-muted';

  return (
    <div className="font-mono text-[11px] leading-[1.7]">
      <div className="text-muted px-1">{'{'}</div>
      <div className="ml-3 pl-2 border-l border-border/40">
        <StaticField name="$formspecValidationResult" value="1.0" isString />
        <StaticField name="path" value={result.path} isString />
        <div>
          <JsonKey name="severity" />
          <span className="text-muted">: </span>
          <span className={severityColor}>"{result.severity}"</span>
          <Comma show />
        </div>
        <StaticField name="constraintKind" value={result.constraintKind} isString />
        <StaticField name="message" value={result.message} isString isLast={!result.code} />
        {result.code && <StaticField name="code" value={result.code} isString isLast />}
      </div>
      <div className="px-1">
        <span className="text-muted">{'}'}</span>
        <Comma show={!isLast} />
      </div>
    </div>
  );
}

export function OutputBlueprint() {
  const definition = useDefinition();
  const selection = useOptionalSelection();
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const items = useMemo(
    () => (definition?.items ?? []).filter((i: FormItem) => i.type !== 'display'),
    [definition?.items],
  );
  const [values, setValues] = useState<ValueMap>(() => initialValues(definition?.items ?? []));

  const readonlyBindPaths = useMemo(() => {
    const paths = new Set<string>();
    for (const bind of definition?.binds ?? []) {
      if (bind.calculate || bind.readonly === 'true') {
        paths.add(bind.path);
      }
    }
    return paths;
  }, [definition?.binds]);

  const { map: validations, results: validationResults } = useMemo(
    () => runValidation(definition, values),
    [definition, values],
  );

  const errorCount = useMemo(
    () => validationResults.filter((v) => v.severity === 'error').length,
    [validationResults],
  );

  const selectPath = useCallback((path: string, type: string) => {
    setLocalSelected(path);
    selection?.select(path, type);
  }, [selection]);

  const onValueChange = useCallback((path: string, value: string) => {
    setValues((prev) => ({ ...prev, [path]: value }));
  }, []);

  const now = new Date().toISOString();
  const status = errorCount > 0 ? 'in-progress' : 'completed';
  const defUrl = definition?.url || 'https://example.com/form';
  const defVersion = definition?.version || '1.0.0';

  return (
    <div className="space-y-2" data-testid="output-blueprint">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-muted/60 text-[10px] tracking-wider uppercase font-sans font-bold">Response Document</div>
        {errorCount > 0 ? (
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">{errorCount} error{errorCount > 1 ? 's' : ''}</span>
        ) : (
          <span className="text-[10px] font-medium text-green-600 dark:text-green-400">Valid</span>
        )}
      </div>

      {/* Full response document */}
      <div className="font-mono text-[11px] leading-[1.7]">
        <div className="text-muted">{'{'}</div>
        <div className="ml-3 pl-2 border-l border-border/40">

          {/* Envelope */}
          <StaticField name="$formspecResponse" value="1.0" isString muted />
          <StaticField name="definitionUrl" value={defUrl} isString muted />
          <StaticField name="definitionVersion" value={defVersion} isString muted />
          <div className={errorCount > 0 ? '' : 'opacity-50'}>
            <JsonKey name="status" />
            <span className="text-muted">: </span>
            <span className={errorCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}>"{status}"</span>
            <Comma show />
          </div>

          {/* Data */}
          <div className="mt-1">
            <div className="px-1"><JsonKey name="data" bold /><span className="text-muted">: {'{'}</span></div>
            <div className="ml-3 pl-2 border-l border-accent/20 py-0.5">
              {items.length === 0 ? (
                <div className="text-muted/40 italic text-[10px]">// No fields defined yet</div>
              ) : (
                items.map((item: FormItem, i: number) => (
                  <DataNode
                    key={item.key}
                    item={item}
                    path={item.key}
                    isSelected={(selection?.primaryKey ?? localSelected) === item.key}
                    onSelect={selectPath}
                    isLast={i === items.length - 1}
                    values={values}
                    validations={validations}
                    onValueChange={onValueChange}
                    readonlyBindPaths={readonlyBindPaths}
                  />
                ))
              )}
            </div>
            <div className="px-1"><span className="text-muted">{'}'}</span><Comma show /></div>
          </div>

          {/* Authored */}
          <StaticField name="authored" value={now} isString muted />

          {/* Validation results */}
          <div className="mt-1">
            <div className="px-1">
              <JsonKey name="validationResults" bold />
              <span className="text-muted">: {validationResults.length === 0 ? '[]' : '['}</span>
            </div>
            {validationResults.length > 0 && (
              <>
                <div className="ml-3 pl-2 border-l border-error/20 py-0.5 space-y-0">
                  {validationResults.map((r, i) => (
                    <ValidationResultNode key={`${r.path}-${i}`} result={r} isLast={i === validationResults.length - 1} />
                  ))}
                </div>
                <div className="px-1"><span className="text-muted">]</span></div>
              </>
            )}
          </div>

        </div>
        <div className="text-muted">{'}'}</div>
      </div>
    </div>
  );
}
