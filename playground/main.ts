import './styles.css';
import { FormspecRender } from '../packages/formspec-webcomponent/src/index';
import { RuntimeMappingEngine, type EngineReplayEvent } from '../packages/formspec-engine/src/index';

import holisticDefinitionV1 from '../tests/e2e/fixtures/kitchen-sink-holistic/definition.v1.json';
import holisticDefinitionV2 from '../tests/e2e/fixtures/kitchen-sink-holistic/definition.v2.json';
import holisticTheme from '../tests/e2e/fixtures/kitchen-sink-holistic/theme.json';
import holisticComponent from '../tests/e2e/fixtures/kitchen-sink-holistic/component.json';
import holisticMapping from '../tests/e2e/fixtures/kitchen-sink-holistic/mapping.json';
import holisticTrace from '../tests/e2e/fixtures/kitchen-sink-holistic/trace.json';

import smokeDefinition from '../tests/e2e/fixtures/kitchen-sink-smoke.definition.json';
import smokeComponent from '../tests/e2e/fixtures/kitchen-sink-smoke.component.json';

type Mode = 'playground' | 'demo';

type FixtureDocs = {
  definition: any;
  theme: any | null;
  component: any | null;
  mapping: any | null;
  trace: EngineReplayEvent[];
  deterministic: {
    now: string;
    locale: string;
    timeZone: string;
    seed: string;
  };
};

type Fixture = {
  id: string;
  label: string;
  description: string;
  docs: FixtureDocs;
  demoAction: (renderer: FormspecRender) => void;
};

type AppState = {
  mode: Mode;
  activeFixtureId: string;
  activeDocs: FixtureDocs;
  lastSubmitted: any | null;
  replayTrace: EngineReplayEvent[];
  replayCursor: number;
  replayLog: Array<{
    index: number;
    event: EngineReplayEvent;
    ok: boolean;
    error?: string;
    output?: any;
  }>;
  mappingResult: any | null;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function normalizeDefinitionForEngine(definition: any): any {
  const normalized = clone(definition);
  if (normalized.optionSets && typeof normalized.optionSets === 'object') {
    for (const [key, value] of Object.entries(normalized.optionSets as Record<string, any>)) {
      if (value && typeof value === 'object' && Array.isArray((value as any).options)) {
        normalized.optionSets[key] = (value as any).options;
      }
    }
  }
  return normalized;
}

function safeSet(renderer: FormspecRender, path: string, value: unknown): void {
  const engine: any = renderer.getEngine();
  if (!engine || !engine.signals || !engine.signals[path]) return;
  engine.setValue(path, value);
}

function addRepeat(renderer: FormspecRender, path: string): void {
  const engine: any = renderer.getEngine();
  if (!engine || !engine.repeats || !engine.repeats[path]) return;
  engine.addRepeatInstance(path);
}

const fixtures: Fixture[] = [
  {
    id: 'holistic-v1',
    label: 'Holistic v1',
    description: 'ADR-0021 fixture bundle (definition v1 + theme + component + mapping + trace)',
    docs: {
      definition: holisticDefinitionV1,
      theme: holisticTheme,
      component: holisticComponent,
      mapping: holisticMapping,
      trace: (holisticTrace as any).events || [],
      deterministic: {
        now: '2026-02-24T12:00:00.000Z',
        locale: 'en-US',
        timeZone: 'UTC',
        seed: 'ks-v1-seed',
      },
    },
    demoAction: (renderer) => {
      safeSet(renderer, 'fullName', 'Demo Operator');
      safeSet(renderer, 'profileMode', 'advanced');
      safeSet(renderer, 'vipEnabled', true);
      safeSet(renderer, 'vipCode', 'DEMO-777');

      safeSet(renderer, 'lineItems[0].lineName', 'Starter Pack');
      safeSet(renderer, 'lineItems[0].lineQty', 2);
      safeSet(renderer, 'lineItems[0].linePrice', 120);

      addRepeat(renderer, 'lineItems');
      safeSet(renderer, 'lineItems[1].lineName', 'Premium Pack');
      safeSet(renderer, 'lineItems[1].lineQty', 1);
      safeSet(renderer, 'lineItems[1].linePrice', 260);

      safeSet(renderer, 'budget', 700);
      safeSet(renderer, 'startDate', '2026-03-01');
      safeSet(renderer, 'endDate', '2026-03-15');
      safeSet(renderer, 'website', 'https://demo.example');
      safeSet(renderer, 'tags', ['new', 'priority']);
    },
  },
  {
    id: 'holistic-v2',
    label: 'Holistic v2',
    description: 'Migration target definition with same presentation docs',
    docs: {
      definition: holisticDefinitionV2,
      theme: holisticTheme,
      component: holisticComponent,
      mapping: holisticMapping,
      trace: [
        { type: 'setValue', path: 'fullName', value: 'Migrated Trace' },
        { type: 'setValue', path: 'profileMode', value: 'advanced' },
        { type: 'setValue', path: 'budget', value: 900 },
        { type: 'getResponse', mode: 'submit' },
      ],
      deterministic: {
        now: '2026-02-24T12:05:00.000Z',
        locale: 'en-US',
        timeZone: 'UTC',
        seed: 'ks-v2-seed',
      },
    },
    demoAction: (renderer) => {
      safeSet(renderer, 'fullName', 'Demo Migrated');
      safeSet(renderer, 'profileMode', 'advanced');
      safeSet(renderer, 'vipEnabled', true);
      safeSet(renderer, 'vipCode', 'MIG-2026');
      safeSet(renderer, 'budget', 900);
      safeSet(renderer, 'website', 'https://migrated.example');
    },
  },
  {
    id: 'smoke',
    label: 'Smoke Fixture',
    description: 'Compact smoke fixture with progressive components',
    docs: {
      definition: smokeDefinition,
      theme: null,
      component: smokeComponent,
      mapping: null,
      trace: [
        { type: 'setValue', path: 'userName', value: 'Smoke User' },
        { type: 'setValue', path: 'showAdvanced', value: true },
        { type: 'setValue', path: 'inventory[0].itemName', value: 'Laptop' },
        { type: 'setValue', path: 'inventory[0].quantity', value: 2 },
        { type: 'setValue', path: 'inventory[0].price', value: 400 },
        { type: 'getResponse', mode: 'submit' },
      ],
      deterministic: {
        now: '2026-02-24T12:10:00.000Z',
        locale: 'en-US',
        timeZone: 'UTC',
        seed: 'smoke-seed',
      },
    },
    demoAction: (renderer) => {
      safeSet(renderer, 'userName', 'Demo User');
      safeSet(renderer, 'showAdvanced', true);
      safeSet(renderer, 'theme', 'hc');
      safeSet(renderer, 'notifications', ['email', 'push']);

      safeSet(renderer, 'inventory[0].itemName', 'Laptop');
      safeSet(renderer, 'inventory[0].price', 499.99);
      safeSet(renderer, 'inventory[0].quantity', 2);
      addRepeat(renderer, 'inventory');
      safeSet(renderer, 'inventory[1].itemName', 'Dock');
      safeSet(renderer, 'inventory[1].price', 89.5);
      safeSet(renderer, 'inventory[1].quantity', 1);

      safeSet(renderer, 'budget', 1300);
      safeSet(renderer, 'startDate', '2026-04-01');
      safeSet(renderer, 'endDate', '2026-04-30');
    },
  },
];

function fixtureById(id: string): Fixture {
  return fixtures.find((fixture) => fixture.id === id) || fixtures[0];
}

function detectMode(): Mode {
  const path = window.location.pathname.toLowerCase();
  if (path === '/') {
    history.replaceState({}, '', '/playground/');
    return 'playground';
  }
  return path.startsWith('/demo') ? 'demo' : 'playground';
}

function modeBasePath(mode: Mode): string {
  const path = window.location.pathname.toLowerCase();
  const folderRoute = path.startsWith('/playground/') || path.startsWith('/demo/');
  return folderRoute ? `/${mode}/` : `/${mode}`;
}

function detectRequestedFixtureId(): string {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('fixture');
  if (!requested) return fixtures[0].id;
  return fixtureById(requested).id;
}

const initialFixture = fixtureById(detectRequestedFixtureId());

const state: AppState = {
  mode: detectMode(),
  activeFixtureId: initialFixture.id,
  activeDocs: clone(initialFixture.docs),
  lastSubmitted: null,
  replayTrace: clone(initialFixture.docs.trace),
  replayCursor: 0,
  replayLog: [],
  mappingResult: null,
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing #app root');
}

app.innerHTML = `
  <div class="shell shell-${state.mode}">
    <header class="topbar">
      <div class="topbar-copy">
        <p class="eyebrow">Formspec Runtime Studio</p>
        <h1>${state.mode === 'demo' ? 'Demo Mode' : 'Playground Mode'}</h1>
        <p>${state.mode === 'demo' ? 'Curated flow over real engine semantics.' : 'Edit docs, replay traces, inspect deterministic artifacts.'}</p>
      </div>
      <nav class="mode-nav">
        <a id="mode-playground-link" href="${modeBasePath('playground')}?fixture=${encodeURIComponent(state.activeFixtureId)}" class="${state.mode === 'playground' ? 'active' : ''}">Playground</a>
        <a id="mode-demo-link" href="${modeBasePath('demo')}?fixture=${encodeURIComponent(state.activeFixtureId)}" class="${state.mode === 'demo' ? 'active' : ''}">Demo</a>
      </nav>
    </header>

    <main class="workspace">
      <section class="panel controls">
        <h2>Scenario</h2>
        <label for="fixture-select">Fixture</label>
        <select id="fixture-select"></select>
        <p id="fixture-description" class="muted"></p>

        <div class="button-row">
          <button id="load-fixture-btn" type="button">Reload Fixture</button>
          <button id="reset-fixture-btn" type="button">Reset</button>
          <button id="run-fixture-script-btn" type="button">Run Fixture Script</button>
        </div>

        <h3>Deterministic Runtime</h3>
        <label for="runtime-now">Fixed Time (ISO)</label>
        <input id="runtime-now" type="text" />
        <label for="runtime-locale">Locale</label>
        <input id="runtime-locale" type="text" />
        <label for="runtime-timezone">Time Zone</label>
        <input id="runtime-timezone" type="text" />
        <label for="runtime-seed">Seed</label>
        <input id="runtime-seed" type="text" />
        <div class="button-row">
          <button id="apply-runtime-btn" type="button">Apply Runtime Context</button>
        </div>

        ${state.mode === 'playground'
          ? `
          <h3>Definition JSON</h3>
          <textarea id="definition-editor" spellcheck="false"></textarea>

          <h3>Theme JSON</h3>
          <textarea id="theme-editor" spellcheck="false"></textarea>

          <h3>Component JSON</h3>
          <textarea id="component-editor" spellcheck="false"></textarea>

          <h3>Mapping JSON</h3>
          <textarea id="mapping-editor" spellcheck="false"></textarea>

          <h3>Replay Trace JSON</h3>
          <textarea id="trace-editor" spellcheck="false"></textarea>

          <h3>Mapping Source JSON</h3>
          <textarea id="mapping-source-editor" spellcheck="false"></textarea>

          <div class="button-row">
            <button id="apply-docs-btn" type="button">Apply Documents</button>
            <button id="run-mapping-forward-btn" type="button">Run Mapping Forward</button>
            <button id="run-mapping-reverse-btn" type="button">Run Mapping Reverse</button>
          </div>
          `
          : `
          <h3>Demo Script</h3>
          <p class="muted">Runs deterministic scripted interactions over the loaded fixture.</p>
          `}
      </section>

      <section class="panel preview">
        <div class="preview-head">
          <h2>Preview</h2>
          <div class="button-row">
            <button id="refresh-artifacts-btn" type="button">Refresh Artifacts</button>
            <button id="submit-form-btn" type="button">Submit Form</button>
          </div>
        </div>

        <div class="replay-controls">
          <button id="load-trace-btn" type="button">Load Trace</button>
          <button id="replay-step-btn" type="button">Step</button>
          <button id="replay-play-btn" type="button">Play</button>
          <button id="replay-pause-btn" type="button">Pause</button>
          <button id="replay-reset-btn" type="button">Reset Replay</button>
        </div>

        <div id="preview-host" class="preview-host"></div>
      </section>

      <section class="panel artifacts">
        <h2>Artifacts</h2>
        <p id="status" class="status">Ready.</p>

        <div class="artifact-head">
          <h3>Validation Report (submit)</h3>
          <div class="artifact-actions">
            <button data-copy-target="validation-report" type="button">Copy</button>
            <button data-export-target="validation-report" data-export-name="validation-report.json" type="button">Export</button>
          </div>
        </div>
        <pre id="validation-report"></pre>

        <div class="artifact-head">
          <h3>Response (submit mode)</h3>
          <div class="artifact-actions">
            <button data-copy-target="response-report" type="button">Copy</button>
            <button data-export-target="response-report" data-export-name="response.json" type="button">Export</button>
          </div>
        </div>
        <pre id="response-report"></pre>

        <div class="artifact-head">
          <h3>Diagnostics Snapshot</h3>
          <div class="artifact-actions">
            <button data-copy-target="diagnostics-report" type="button">Copy</button>
            <button data-export-target="diagnostics-report" data-export-name="diagnostics.json" type="button">Export</button>
          </div>
        </div>
        <pre id="diagnostics-report"></pre>

        <div class="artifact-head">
          <h3>Mapping Output</h3>
          <div class="artifact-actions">
            <button data-copy-target="mapping-output" type="button">Copy</button>
            <button data-export-target="mapping-output" data-export-name="mapping-output.json" type="button">Export</button>
          </div>
        </div>
        <pre id="mapping-output"></pre>

        <div class="artifact-head">
          <h3>Replay Log</h3>
          <div class="artifact-actions">
            <button data-copy-target="replay-log" type="button">Copy</button>
            <button data-export-target="replay-log" data-export-name="replay-log.json" type="button">Export</button>
          </div>
        </div>
        <pre id="replay-log"></pre>

        <h3>Last Submit Event</h3>
        <pre id="last-submit"></pre>
      </section>
    </main>
  </div>
`;

const fixtureSelect = document.querySelector<HTMLSelectElement>('#fixture-select');
const fixtureDescription = document.querySelector<HTMLParagraphElement>('#fixture-description');
const statusEl = document.querySelector<HTMLParagraphElement>('#status');
const validationReportEl = document.querySelector<HTMLPreElement>('#validation-report');
const responseReportEl = document.querySelector<HTMLPreElement>('#response-report');
const diagnosticsReportEl = document.querySelector<HTMLPreElement>('#diagnostics-report');
const mappingOutputEl = document.querySelector<HTMLPreElement>('#mapping-output');
const replayLogEl = document.querySelector<HTMLPreElement>('#replay-log');
const lastSubmitEl = document.querySelector<HTMLPreElement>('#last-submit');
const previewHost = document.querySelector<HTMLDivElement>('#preview-host');

const definitionEditor = document.querySelector<HTMLTextAreaElement>('#definition-editor');
const themeEditor = document.querySelector<HTMLTextAreaElement>('#theme-editor');
const componentEditor = document.querySelector<HTMLTextAreaElement>('#component-editor');
const mappingEditor = document.querySelector<HTMLTextAreaElement>('#mapping-editor');
const traceEditor = document.querySelector<HTMLTextAreaElement>('#trace-editor');
const mappingSourceEditor = document.querySelector<HTMLTextAreaElement>('#mapping-source-editor');

const runtimeNowInput = document.querySelector<HTMLInputElement>('#runtime-now');
const runtimeLocaleInput = document.querySelector<HTMLInputElement>('#runtime-locale');
const runtimeTimeZoneInput = document.querySelector<HTMLInputElement>('#runtime-timezone');
const runtimeSeedInput = document.querySelector<HTMLInputElement>('#runtime-seed');

if (
  !fixtureSelect ||
  !fixtureDescription ||
  !statusEl ||
  !validationReportEl ||
  !responseReportEl ||
  !diagnosticsReportEl ||
  !mappingOutputEl ||
  !replayLogEl ||
  !lastSubmitEl ||
  !previewHost ||
  !runtimeNowInput ||
  !runtimeLocaleInput ||
  !runtimeTimeZoneInput ||
  !runtimeSeedInput
) {
  throw new Error('Missing required playground elements');
}

let renderer: FormspecRender;
let replayInterval: number | null = null;

function setStatus(message: string, type: 'ok' | 'error' | 'info' = 'info'): void {
  statusEl.textContent = message;
  statusEl.dataset.type = type;
}

function parseEditorJSON(id: string, value: string): any | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new Error(`${id} JSON parse error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseTraceFromInput(value: string): EngineReplayEvent[] {
  const parsed = parseEditorJSON('Trace', value);
  if (!parsed) return [];

  const events = Array.isArray(parsed)
    ? parsed
    : (Array.isArray((parsed as any).events) ? (parsed as any).events : null);

  if (!events) {
    throw new Error('Trace must be an array or {"events": [...]}');
  }

  return events as EngineReplayEvent[];
}

function stopReplayTimer(): void {
  if (replayInterval !== null) {
    window.clearInterval(replayInterval);
    replayInterval = null;
  }
}

function mountRenderer(): void {
  previewHost.innerHTML = '';
  if (!customElements.get('formspec-render')) {
    customElements.define('formspec-render', FormspecRender);
  }
  renderer = document.createElement('formspec-render') as FormspecRender;
  previewHost.appendChild(renderer);

  renderer.addEventListener('formspec-submit', (event: Event) => {
    state.lastSubmitted = (event as CustomEvent).detail;
    lastSubmitEl.textContent = pretty(state.lastSubmitted);
    setStatus('Submit event captured', 'ok');
    refreshArtifacts();
  });

  (window as any).renderer = renderer;
}

function loadDocsIntoEditors(docs: FixtureDocs): void {
  if (!definitionEditor || !themeEditor || !componentEditor || !mappingEditor || !traceEditor || !mappingSourceEditor) {
    return;
  }

  definitionEditor.value = pretty(docs.definition);
  themeEditor.value = docs.theme ? pretty(docs.theme) : '';
  componentEditor.value = docs.component ? pretty(docs.component) : '';
  mappingEditor.value = docs.mapping ? pretty(docs.mapping) : '';
  traceEditor.value = pretty(docs.trace);
  mappingSourceEditor.value = '';
}

function loadRuntimeIntoInputs(docs: FixtureDocs): void {
  runtimeNowInput.value = docs.deterministic.now;
  runtimeLocaleInput.value = docs.deterministic.locale;
  runtimeTimeZoneInput.value = docs.deterministic.timeZone;
  runtimeSeedInput.value = docs.deterministic.seed;
}

function applyRuntimeContext(): void {
  const engine: any = renderer.getEngine();
  if (!engine?.setRuntimeContext) return;

  engine.setRuntimeContext({
    now: runtimeNowInput.value.trim() || undefined,
    locale: runtimeLocaleInput.value.trim() || undefined,
    timeZone: runtimeTimeZoneInput.value.trim() || undefined,
    seed: runtimeSeedInput.value.trim() || undefined,
  });
}

function applyDocs(docs: FixtureDocs): void {
  state.activeDocs = {
    definition: clone(docs.definition),
    theme: docs.theme ? clone(docs.theme) : null,
    component: docs.component ? clone(docs.component) : null,
    mapping: docs.mapping ? clone(docs.mapping) : null,
    trace: clone(docs.trace || []),
    deterministic: clone(docs.deterministic),
  };

  renderer.definition = normalizeDefinitionForEngine(state.activeDocs.definition);
  renderer.themeDocument = state.activeDocs.theme;
  renderer.componentDocument = state.activeDocs.component;
  applyRuntimeContext();
  refreshArtifacts();
}

function toSummaryValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.length > 5 ? `array(${value.length})` : value;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    return keys.length > 8 ? `object(${keys.length} keys)` : value;
  }
  return value;
}

function updateReplayLogView(): void {
  replayLogEl.textContent = pretty({
    cursor: state.replayCursor,
    total: state.replayTrace.length,
    entries: state.replayLog,
  });
}

function refreshArtifacts(): void {
  const engine: any = renderer.getEngine();
  if (!engine) {
    validationReportEl.textContent = '{}';
    responseReportEl.textContent = '{}';
    diagnosticsReportEl.textContent = '{}';
    return;
  }

  const validationSubmit = engine.getValidationReport({ mode: 'submit' });
  const responseSubmit = engine.getResponse({ mode: 'submit' });
  const diagnostics = engine.getDiagnosticsSnapshot
    ? engine.getDiagnosticsSnapshot({ mode: 'submit' })
    : { unsupported: 'Engine diagnostics API unavailable' };

  validationReportEl.textContent = pretty(validationSubmit);
  responseReportEl.textContent = pretty(responseSubmit);
  diagnosticsReportEl.textContent = pretty(diagnostics);
  lastSubmitEl.textContent = state.lastSubmitted ? pretty(state.lastSubmitted) : '{}';

  if (mappingSourceEditor && mappingSourceEditor.value.trim().length === 0) {
    mappingSourceEditor.value = pretty(responseSubmit.data || {});
  }
}

function loadFixture(id: string): void {
  stopReplayTimer();

  const fixture = fixtureById(id);
  state.activeFixtureId = fixture.id;
  fixtureSelect.value = fixture.id;
  fixtureDescription.textContent = fixture.description;
  state.replayTrace = clone(fixture.docs.trace || []);
  state.replayCursor = 0;
  state.replayLog = [];
  state.mappingResult = null;

  const url = new URL(window.location.href);
  url.searchParams.set('fixture', fixture.id);
  history.replaceState({}, '', `${url.pathname}?${url.searchParams.toString()}`);

  const playgroundLink = document.querySelector<HTMLAnchorElement>('#mode-playground-link');
  const demoLink = document.querySelector<HTMLAnchorElement>('#mode-demo-link');
  if (playgroundLink) playgroundLink.href = `${modeBasePath('playground')}?fixture=${encodeURIComponent(fixture.id)}`;
  if (demoLink) demoLink.href = `${modeBasePath('demo')}?fixture=${encodeURIComponent(fixture.id)}`;

  const docs = clone(fixture.docs);
  loadDocsIntoEditors(docs);
  loadRuntimeIntoInputs(docs);
  applyDocs(docs);

  mappingOutputEl.textContent = '{}';
  updateReplayLogView();
  setStatus(`Loaded fixture: ${fixture.label}`, 'ok');
}

function runFixtureScript(): void {
  const fixture = fixtureById(state.activeFixtureId);
  fixture.demoAction(renderer);
  const engine: any = renderer.getEngine();
  if (engine?.getResponse && mappingSourceEditor) {
    mappingSourceEditor.value = pretty(engine.getResponse({ mode: 'submit' }).data || {});
  }
  refreshArtifacts();
  setStatus(`Fixture script completed for ${fixture.label}`, 'ok');
}

function getActiveMappingDocument(): any | null {
  if (mappingEditor) {
    return parseEditorJSON('Mapping', mappingEditor.value);
  }
  return state.activeDocs.mapping;
}

function getActiveMappingSource(): any {
  if (mappingSourceEditor) {
    const parsed = parseEditorJSON('Mapping Source', mappingSourceEditor.value);
    if (parsed !== null) return parsed;
  }

  try {
    return JSON.parse(responseReportEl.textContent || '{}').data || {};
  } catch {
    return {};
  }
}

function runMapping(direction: 'forward' | 'reverse'): void {
  try {
    const mappingDoc = getActiveMappingDocument();
    if (!mappingDoc) {
      setStatus('Mapping document is required to run mapping', 'error');
      return;
    }

    const source = getActiveMappingSource();
    const mapping = new RuntimeMappingEngine(mappingDoc);
    const result = direction === 'forward' ? mapping.forward(source) : mapping.reverse(source);

    state.mappingResult = result;
    mappingOutputEl.textContent = pretty(result);
    setStatus(`Mapping ${direction} executed (${result.appliedRules} rules applied)`, 'ok');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
  }
}

function loadTraceFromEditorOrFixture(): void {
  try {
    if (traceEditor) {
      state.replayTrace = parseTraceFromInput(traceEditor.value);
    } else {
      state.replayTrace = clone(state.activeDocs.trace || []);
    }
    state.replayCursor = 0;
    state.replayLog = [];
    updateReplayLogView();
    setStatus(`Loaded replay trace (${state.replayTrace.length} events)`, 'ok');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
  }
}

function stepReplay(): void {
  const engine: any = renderer.getEngine();
  if (!engine?.applyReplayEvent) {
    setStatus('Engine replay API unavailable', 'error');
    return;
  }

  if (state.replayCursor >= state.replayTrace.length) {
    stopReplayTimer();
    setStatus('Replay complete', 'info');
    return;
  }

  const index = state.replayCursor;
  const event = state.replayTrace[index];
  const result = engine.applyReplayEvent(event);

  state.replayLog.push({
    index,
    event,
    ok: !!result?.ok,
    error: result?.error,
    output: toSummaryValue(result?.output),
  });
  state.replayCursor += 1;

  if (event.type === 'getResponse' && result?.output) {
    state.lastSubmitted = result.output;
  }

  updateReplayLogView();
  refreshArtifacts();

  if (!result?.ok) {
    stopReplayTimer();
    setStatus(`Replay error at step ${index + 1}: ${result?.error || 'unknown error'}`, 'error');
    return;
  }

  setStatus(`Replay step ${state.replayCursor}/${state.replayTrace.length}`, 'ok');
}

function playReplay(): void {
  stopReplayTimer();
  replayInterval = window.setInterval(() => {
    if (state.replayCursor >= state.replayTrace.length) {
      stopReplayTimer();
      setStatus('Replay complete', 'info');
      return;
    }
    stepReplay();
  }, 350);
  setStatus('Replay started', 'info');
}

function pauseReplay(): void {
  stopReplayTimer();
  setStatus('Replay paused', 'info');
}

function copyArtifact(targetId: string): void {
  const el = document.querySelector<HTMLPreElement>(`#${targetId}`);
  if (!el) {
    setStatus(`Artifact ${targetId} not found`, 'error');
    return;
  }

  if (!navigator.clipboard?.writeText) {
    setStatus('Clipboard API unavailable in this browser context', 'error');
    return;
  }

  navigator.clipboard
    .writeText(el.textContent || '')
    .then(() => setStatus(`Copied ${targetId}`, 'ok'))
    .catch((error) => setStatus(`Copy failed: ${String(error)}`, 'error'));
}

function exportArtifact(targetId: string, fileName: string): void {
  const el = document.querySelector<HTMLPreElement>(`#${targetId}`);
  if (!el) {
    setStatus(`Artifact ${targetId} not found`, 'error');
    return;
  }

  const blob = new Blob([el.textContent || '{}'], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);

  setStatus(`Exported ${fileName}`, 'ok');
}

function bindArtifactButtons(): void {
  const copyButtons = document.querySelectorAll<HTMLButtonElement>('button[data-copy-target]');
  const exportButtons = document.querySelectorAll<HTMLButtonElement>('button[data-export-target]');

  for (const button of copyButtons) {
    button.addEventListener('click', () => {
      const target = button.dataset.copyTarget;
      if (target) copyArtifact(target);
    });
  }

  for (const button of exportButtons) {
    button.addEventListener('click', () => {
      const target = button.dataset.exportTarget;
      const fileName = button.dataset.exportName || `${target}.json`;
      if (target) exportArtifact(target, fileName);
    });
  }
}

for (const fixture of fixtures) {
  const option = document.createElement('option');
  option.value = fixture.id;
  option.textContent = fixture.label;
  fixtureSelect.appendChild(option);
}

const loadFixtureBtn = document.querySelector<HTMLButtonElement>('#load-fixture-btn');
const resetFixtureBtn = document.querySelector<HTMLButtonElement>('#reset-fixture-btn');
const runFixtureScriptBtn = document.querySelector<HTMLButtonElement>('#run-fixture-script-btn');
const refreshArtifactsBtn = document.querySelector<HTMLButtonElement>('#refresh-artifacts-btn');
const submitFormBtn = document.querySelector<HTMLButtonElement>('#submit-form-btn');
const applyDocsBtn = document.querySelector<HTMLButtonElement>('#apply-docs-btn');
const runMappingForwardBtn = document.querySelector<HTMLButtonElement>('#run-mapping-forward-btn');
const runMappingReverseBtn = document.querySelector<HTMLButtonElement>('#run-mapping-reverse-btn');
const applyRuntimeBtn = document.querySelector<HTMLButtonElement>('#apply-runtime-btn');
const loadTraceBtn = document.querySelector<HTMLButtonElement>('#load-trace-btn');
const replayStepBtn = document.querySelector<HTMLButtonElement>('#replay-step-btn');
const replayPlayBtn = document.querySelector<HTMLButtonElement>('#replay-play-btn');
const replayPauseBtn = document.querySelector<HTMLButtonElement>('#replay-pause-btn');
const replayResetBtn = document.querySelector<HTMLButtonElement>('#replay-reset-btn');

if (loadFixtureBtn) {
  loadFixtureBtn.addEventListener('click', () => loadFixture(fixtureSelect.value));
}

fixtureSelect.addEventListener('change', () => {
  loadFixture(fixtureSelect.value);
});

if (resetFixtureBtn) {
  resetFixtureBtn.addEventListener('click', () => loadFixture(state.activeFixtureId));
}

if (runFixtureScriptBtn) {
  runFixtureScriptBtn.addEventListener('click', () => runFixtureScript());
}

if (refreshArtifactsBtn) {
  refreshArtifactsBtn.addEventListener('click', () => {
    refreshArtifacts();
    setStatus('Artifacts refreshed', 'info');
  });
}

if (submitFormBtn) {
  submitFormBtn.addEventListener('click', () => {
    const submit = renderer.querySelector<HTMLButtonElement>('button.formspec-submit');
    if (!submit) {
      setStatus('Submit button not found in renderer output', 'error');
      return;
    }
    submit.click();
  });
}

if (applyRuntimeBtn) {
  applyRuntimeBtn.addEventListener('click', () => {
    applyRuntimeContext();
    refreshArtifacts();
    setStatus('Runtime context applied', 'ok');
  });
}

if (applyDocsBtn && definitionEditor && themeEditor && componentEditor && mappingEditor && traceEditor) {
  applyDocsBtn.addEventListener('click', () => {
    try {
      const docs: FixtureDocs = {
        definition: parseEditorJSON('Definition', definitionEditor.value),
        theme: parseEditorJSON('Theme', themeEditor.value),
        component: parseEditorJSON('Component', componentEditor.value),
        mapping: parseEditorJSON('Mapping', mappingEditor.value),
        trace: parseTraceFromInput(traceEditor.value),
        deterministic: {
          now: runtimeNowInput.value.trim(),
          locale: runtimeLocaleInput.value.trim(),
          timeZone: runtimeTimeZoneInput.value.trim(),
          seed: runtimeSeedInput.value.trim(),
        },
      };

      if (!docs.definition) {
        setStatus('Definition is required', 'error');
        return;
      }

      applyDocs(docs);
      state.replayTrace = clone(docs.trace);
      state.replayCursor = 0;
      state.replayLog = [];
      updateReplayLogView();
      setStatus('Applied edited documents', 'ok');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), 'error');
    }
  });
}

if (runMappingForwardBtn) {
  runMappingForwardBtn.addEventListener('click', () => runMapping('forward'));
}

if (runMappingReverseBtn) {
  runMappingReverseBtn.addEventListener('click', () => runMapping('reverse'));
}

if (loadTraceBtn) {
  loadTraceBtn.addEventListener('click', () => loadTraceFromEditorOrFixture());
}

if (replayStepBtn) {
  replayStepBtn.addEventListener('click', () => stepReplay());
}

if (replayPlayBtn) {
  replayPlayBtn.addEventListener('click', () => playReplay());
}

if (replayPauseBtn) {
  replayPauseBtn.addEventListener('click', () => pauseReplay());
}

if (replayResetBtn) {
  replayResetBtn.addEventListener('click', () => {
    loadFixture(state.activeFixtureId);
    setStatus('Replay reset to fixture baseline', 'info');
  });
}

mountRenderer();
bindArtifactButtons();
loadFixture(state.activeFixtureId);
