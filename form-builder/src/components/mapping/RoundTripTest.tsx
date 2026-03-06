import { useMemo, useState } from 'preact/hooks';
import { RuntimeMappingEngine } from 'formspec-engine';
import type { FormspecMappingDocument, MappingRule } from '../../state/project';

interface RoundTripTestProps {
  mapping: FormspecMappingDocument;
}

interface RoundTripRun {
  forwardOutput: unknown;
  reverseOutput: unknown;
  diagnostics: string[];
  diffs: string[];
}

export function RoundTripTest(props: RoundTripTestProps) {
  const [sourceText, setSourceText] = useState('{\n  "example": "value"\n}');
  const [parseError, setParseError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<RoundTripRun | null>(null);

  const engineInput = useMemo(() => toRuntimeMappingDocument(props.mapping), [props.mapping]);

  return (
    <div class="mapping-roundtrip" data-testid="mapping-roundtrip">
      <p class="mapping-roundtrip__title">Round-trip test</p>
      <p class="inspector-hint">Paste sample JSON, run forward then reverse, and inspect differences.</p>

      <label class="inspector-control">
        <span class="inspector-control__label">Sample source JSON</span>
        <textarea
          class="inspector-input inspector-input--fel"
          data-testid="mapping-roundtrip-source-input"
          value={sourceText}
          onInput={(event) => {
            setSourceText((event.currentTarget as HTMLTextAreaElement).value);
          }}
        />
      </label>

      <div class="mapping-roundtrip__actions">
        <label class="mapping-roundtrip__file-label" for="mapping-roundtrip-file-input">
          Upload JSON file
        </label>
        <input
          id="mapping-roundtrip-file-input"
          class="mapping-roundtrip__file-input"
          data-testid="mapping-roundtrip-file-input"
          type="file"
          accept="application/json,.json"
          onChange={async (event) => {
            const files = (event.currentTarget as HTMLInputElement).files;
            const file = files?.[0];
            if (!file) {
              return;
            }

            try {
              const text = await file.text();
              setSourceText(text);
              setParseError(null);
            } catch {
              setParseError('Unable to read uploaded file.');
            }
          }}
        />

        <button
          type="button"
          class="mapping-roundtrip__run"
          data-testid="mapping-roundtrip-run-button"
          onClick={() => {
            try {
              const source = JSON.parse(sourceText) as unknown;
              const runtimeEngine = new RuntimeMappingEngine(engineInput);
              const forward = runtimeEngine.forward(source);
              const reverse = runtimeEngine.reverse(forward.output);
              const diagnostics = [
                ...forward.diagnostics.map((entry) => `forward: ${entry}`),
                ...reverse.diagnostics.map((entry) => `reverse: ${entry}`)
              ];

              setParseError(null);
              setRunResult({
                forwardOutput: forward.output,
                reverseOutput: reverse.output,
                diagnostics,
                diffs: collectJsonDiffs(source, reverse.output)
              });
            } catch {
              setRunResult(null);
              setParseError('Source payload must be valid JSON.');
            }
          }}
        >
          Run round-trip
        </button>
      </div>

      {parseError ? (
        <p class="mapping-roundtrip__error" data-testid="mapping-roundtrip-error">
          {parseError}
        </p>
      ) : null}

      {runResult ? (
        <div class="mapping-roundtrip__results" data-testid="mapping-roundtrip-results">
          <p class="mapping-roundtrip__diff-summary" data-testid="mapping-roundtrip-diff-summary">
            {runResult.diffs.length === 0 ? 'Round-trip matched input payload.' : `${runResult.diffs.length} differences detected.`}
          </p>

          {runResult.diffs.length > 0 ? (
            <ul class="mapping-roundtrip__diff-list" data-testid="mapping-roundtrip-diff-list">
              {runResult.diffs.map((entry, index) => (
                <li key={`${entry}-${index}`}>{entry}</li>
              ))}
            </ul>
          ) : null}

          {runResult.diagnostics.length > 0 ? (
            <ul class="mapping-roundtrip__diagnostics" data-testid="mapping-roundtrip-diagnostics">
              {runResult.diagnostics.map((diagnostic, index) => (
                <li key={`${diagnostic}-${index}`}>{diagnostic}</li>
              ))}
            </ul>
          ) : (
            <p class="inspector-hint">No runtime mapping diagnostics.</p>
          )}

          <div class="mapping-roundtrip__json-panels">
            <div>
              <p class="mapping-roundtrip__panel-label">Forward output</p>
              <pre data-testid="mapping-roundtrip-forward-output">{formatOutput(runResult.forwardOutput)}</pre>
            </div>

            <div>
              <p class="mapping-roundtrip__panel-label">Reverse output</p>
              <pre data-testid="mapping-roundtrip-reverse-output">{formatOutput(runResult.reverseOutput)}</pre>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function toRuntimeMappingDocument(mapping: FormspecMappingDocument): Record<string, unknown> {
  const runtimeRules = (mapping.rules ?? []).map((rule) => toRuntimeRule(rule));

  return {
    defaults: mapping.defaults,
    direction: mapping.direction,
    rules: runtimeRules
  };
}

function toRuntimeRule(rule: MappingRule): Record<string, unknown> {
  const runtimeRule: Record<string, unknown> = {
    ...rule,
    transform: rule.transform
  };

  if (rule.valueMap && typeof rule.valueMap === 'object') {
    const valueMap = rule.valueMap as Record<string, unknown>;
    if (valueMap.forward && typeof valueMap.forward === 'object' && !Array.isArray(valueMap.forward)) {
      runtimeRule.valueMap = valueMap.forward;
    }
  }

  if (rule.coerce && typeof rule.coerce === 'object' && !Array.isArray(rule.coerce)) {
    const coerce = rule.coerce as Record<string, unknown>;
    if (typeof coerce.to === 'string' && coerce.to.trim().length > 0) {
      runtimeRule.coerce = coerce.to.trim();
    } else if (typeof coerce.type === 'string' && coerce.type.trim().length > 0) {
      runtimeRule.coerce = coerce.type.trim();
    }
  }

  return runtimeRule;
}

function collectJsonDiffs(expected: unknown, actual: unknown): string[] {
  const differences: string[] = [];
  walkDiff(expected, actual, '$', differences);
  return differences;
}

function walkDiff(expected: unknown, actual: unknown, path: string, differences: string[]): void {
  if (Object.is(expected, actual)) {
    return;
  }

  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) {
      differences.push(`${path}: array length ${expected.length} != ${actual.length}`);
    }

    const nextLength = Math.max(expected.length, actual.length);
    for (let index = 0; index < nextLength; index += 1) {
      walkDiff(expected[index], actual[index], `${path}[${index}]`, differences);
    }
    return;
  }

  if (isPlainObject(expected) && isPlainObject(actual)) {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    for (const key of [...keys].sort((left, right) => left.localeCompare(right))) {
      walkDiff(
        (expected as Record<string, unknown>)[key],
        (actual as Record<string, unknown>)[key],
        `${path}.${key}`,
        differences
      );
    }
    return;
  }

  differences.push(`${path}: ${formatScalar(expected)} -> ${formatScalar(actual)}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function formatScalar(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatOutput(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
