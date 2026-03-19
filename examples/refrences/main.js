/** @filedesc Entry point for the references example: registers formspec-render and loads forms. */
import 'formspec-webcomponent/formspec-base.css';
import { FormspecRender, globalRegistry } from 'formspec-webcomponent';
import { uswdsAdapter } from 'formspec-adapters';
customElements.define('formspec-render', FormspecRender);

// Register available adapters — examples can opt in via `adapter: 'uswds'`
globalRegistry.registerAdapter(uswdsAdapter);

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const SERVER = `${BASE}/api`;

// ── Example registry ──
// Each entry points to a sibling directory under examples/.
// artifacts lists the JSON files to load (definition is required,
// component and theme are optional).
const EXAMPLES = [
  {
    id: 'grant-application',
    name: 'Federal Grant Application',
    description: 'Multi-page wizard with budget, validation, repeats',
    dir: `${BASE}/examples/grant-application`,
    artifacts: { definition: 'definition.json', component: 'component.json', theme: 'theme.json' },
    css: 'grant-bridge.css',
    server: true,
    mappings: ['mapping.json', 'mapping-csv.json', 'mapping-xml.json'],
    registry: `${BASE}/registries/formspec-common.registry.json`,
    fixtures: [
      { id: 'sample-submission', label: 'Complete Submission', file: 'fixtures/sample-submission.json' },
      { id: 'submission-amended', label: 'Amended', file: 'fixtures/submission-amended.json' },
      { id: 'submission-in-progress', label: 'In Progress', file: 'fixtures/submission-in-progress.json' },
      { id: 'submission-stopped', label: 'Stopped', file: 'fixtures/submission-stopped.json' },
    ],
  },
  {
    id: 'tribal-short',
    name: 'Tribal Annual Report (Short)',
    description: 'Short-form grant report with expenditure tracking',
    dir: `${BASE}/examples/grant-report`,
    artifacts: { definition: 'tribal-short.definition.json', component: 'tribal-short.component.json', theme: 'tribal.theme.json' },
    server: true,
    registry: `${BASE}/registries/formspec-common.registry.json`,
    fixtures: [
      { id: 'short-empty', label: 'Empty', file: 'fixtures/short-empty.response.json' },
      { id: 'short-partial', label: 'Partial', file: 'fixtures/short-partial.response.json' },
      { id: 'short-complete', label: 'Complete', file: 'fixtures/short-complete.response.json' },
    ],
  },
  {
    id: 'tribal-long',
    name: 'Tribal Annual Report (Long)',
    description: 'Detailed report with narratives and service data',
    dir: `${BASE}/examples/grant-report`,
    artifacts: { definition: 'tribal-long.definition.json', component: 'tribal-long.component.json', theme: 'tribal.theme.json' },
    server: true,
    registry: `${BASE}/registries/formspec-common.registry.json`,
    fixtures: [
      { id: 'long-complete', label: 'Complete', file: 'fixtures/long-complete.response.json' },
      { id: 'short-to-long-migrated', label: 'Migrated from Short', file: 'fixtures/short-to-long-migrated.response.json' },
    ],
  },
  {
    id: 'invoice',
    name: 'Invoice (Line Items)',
    description: 'Repeat groups + calculated totals + CSV export mapping',
    dir: `${BASE}/examples/invoice`,
    artifacts: { definition: 'invoice.definition.json', component: 'invoice.component.json', theme: 'invoice.theme.json' },
    server: true,
    registry: `${BASE}/registries/formspec-common.registry.json`,
    fixtures: [
      { id: 'invoice-empty', label: 'Empty', file: 'fixtures/invoice-empty.response.json' },
      { id: 'invoice-single', label: 'Single Item', file: 'fixtures/invoice-single.response.json' },
      { id: 'invoice-multi', label: 'Multiple Items', file: 'fixtures/invoice-multi.response.json' },
      { id: 'invoice-max', label: 'Max Items', file: 'fixtures/invoice-max.response.json' },
    ],
  },
  {
    id: 'clinical-intake',
    name: 'Clinical Intake Survey',
    description: 'Screener routing, instances/pre-population, nested repeats',
    dir: `${BASE}/examples/clinical-intake`,
    artifacts: { definition: 'intake.definition.json', component: 'intake.component.json', theme: 'intake.theme.json' },
    server: true,
    registry: `${BASE}/registries/formspec-common.registry.json`,
    fixtures: [
      { id: 'intake-empty', label: 'Empty', file: 'fixtures/intake-empty.response.json' },
      { id: 'intake-partial', label: 'Partial', file: 'fixtures/intake-partial.response.json' },
      { id: 'intake-complete', label: 'Complete', file: 'fixtures/intake-complete.response.json' },
      { id: 'intake-nested-repeat', label: 'Nested Repeat', file: 'fixtures/intake-nested-repeat.response.json' },
    ],
  },
  {
    id: 'uswds-grant',
    name: 'Community Grant (USWDS Adapter)',
    description: 'USWDS adapter demo — repeats, calculated totals, conditional sections',
    dir: `${BASE}/examples/uswds-grant`,
    artifacts: { definition: 'grant.definition.json', theme: 'grant.theme.json' },
    adapter: 'uswds',
    fixtures: [
      { id: 'uswds-empty', label: 'Empty', file: 'fixtures/empty.response.json' },
      { id: 'uswds-complete', label: 'Complete Submission', file: 'fixtures/complete.response.json' },
    ],
  },
];

// ── DOM refs ──
const exampleListEl = document.getElementById('example-list');
const mainArea = document.getElementById('main-area');
const emptyState = document.getElementById('empty-state');

let activeExampleId = null;
let activeBridgeLink = null;

// ── Restore saved state ──
// Walks a response `data` object and applies values to a fresh engine.
// Must be called right after setDefinition — before the DOM renders —
// so that initial renders pick up the restored values and calculated
// fields recompute from the full dependency graph.
//
// Uses the engine's public `signals` and `repeats` to distinguish
// container groups from leaf values (including complex types like money
// and multi-valued fields like multiChoice arrays).
function applyResponseData(engine, data, prefix = '') {
  for (const [key, value] of Object.entries(data)) {
    const path = prefix ? `${prefix}.${key}` : key;

    // If the engine has a signal for this path, it's a field — set directly
    // (handles primitives, money objects, and multiChoice arrays).
    // Skip computed signals (calculated fields) — they recompute from deps.
    const sig = engine.signals[path];
    if (sig && Object.getOwnPropertyDescriptor(Object.getPrototypeOf(sig), 'value')?.set) {
      engine.setValue(path, value);
    } else if (Array.isArray(value)) {
      // No signal → repeat group: ensure enough instances, then recurse
      const currentCount = engine.repeats[path]?.value ?? 0;
      for (let i = currentCount; i < value.length; i++) {
        engine.addRepeatInstance(path);
      }
      for (let i = 0; i < value.length; i++) {
        if (value[i] != null && typeof value[i] === 'object') {
          applyResponseData(engine, value[i], `${path}[${i}]`);
        }
      }
    } else if (value !== null && typeof value === 'object') {
      // No signal, non-array object → container group, recurse
      applyResponseData(engine, value, path);
    }
    // else: primitive with no signal — skip (not a known field)
  }
}

// ── Build sidebar ──
for (const ex of EXAMPLES) {
  const li = document.createElement('li');
  li.dataset.id = ex.id;
  li.innerHTML = `
    <span class="example-name">${ex.name}</span>
    <span class="example-desc">${ex.description}</span>
  `;
  li.addEventListener('click', () => loadExample(ex));
  exampleListEl.appendChild(li);
}

// ── Load helpers ──
async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json();
}

// ── Load & render an example ──
// fixture: optional { id, label, file } to restore saved state into the form
async function loadExample(ex, fixture = null) {
  // Allow reload when switching fixtures on the same example
  if (activeExampleId === ex.id && !fixture) return;
  activeExampleId = ex.id;

  // Update sidebar
  exampleListEl.querySelectorAll('li').forEach(li => {
    li.classList.toggle('active', li.dataset.id === ex.id);
  });

  // Update URL hash
  window.location.hash = ex.id;

  // Show loading state
  mainArea.innerHTML = `
    <div class="state-message">
      <h2>Loading...</h2>
      <p>${ex.name}</p>
    </div>
  `;

  // Remove previous bridge CSS
  if (activeBridgeLink) {
    activeBridgeLink.remove();
    activeBridgeLink = null;
  }

  try {
    // Load artifacts (+ fixture in parallel if restoring saved state)
    const loads = [loadJSON(`${ex.dir}/${ex.artifacts.definition}`)];
    if (ex.artifacts.component) loads.push(loadJSON(`${ex.dir}/${ex.artifacts.component}`));
    else loads.push(Promise.resolve(null));
    if (ex.artifacts.theme) loads.push(loadJSON(`${ex.dir}/${ex.artifacts.theme}`));
    else loads.push(Promise.resolve(null));
    if (fixture) loads.push(loadJSON(`${ex.dir}/${fixture.file}`));
    else loads.push(Promise.resolve(null));

    const [definition, componentDoc, themeDoc, fixtureResponse] = await Promise.all(loads);

    // Load bridge CSS if specified
    if (ex.css) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${ex.dir}/${ex.css}`;
      document.head.appendChild(link);
      activeBridgeLink = link;
    }

    // Build the form area
    mainArea.innerHTML = '';

    // Info bar
    const info = document.createElement('div');
    info.className = 'example-info';
    info.innerHTML = `
      <h2>${definition.title || ex.name}</h2>
      ${definition.version ? `<span class="info-version">v${definition.version}</span>` : ''}
      ${definition.description ? `<span class="info-desc">${definition.description}</span>` : ''}
    `;
    mainArea.appendChild(info);

    // Form container
    const container = document.createElement('div');
    container.className = 'form-container';

    // Client submit panel (always available; shown in a tab)
    const clientPanel = document.createElement('div');
    clientPanel.className = 'client-response';
    clientPanel.id = 'client-response';
    clientPanel.setAttribute('aria-live', 'polite');
    clientPanel.innerHTML = `
      <h3>Client Submit</h3>
      <div class="client-meta" id="client-meta"></div>
      <p class="client-empty" id="client-empty">No client-side submit yet. Click "Submit (Client)" to generate a response and validation report.</p>
      <details class="client-details" open>
        <summary>Validation Report</summary>
        <pre id="client-validation-pre"></pre>
      </details>
      <details class="client-details">
        <summary>Response JSON</summary>
        <pre id="client-response-pre"></pre>
      </details>
    `;

    // Server response panel (optional; shown in a tab)
    const serverPanel = document.createElement('div');
    serverPanel.className = 'server-response';
    serverPanel.id = 'server-response';
    serverPanel.setAttribute('aria-live', 'polite');
    serverPanel.innerHTML = `
      <h3>Server Response</h3>
      <div class="server-meta" id="server-meta"></div>
      <p class="server-empty" id="server-empty">No server response yet. Submit a valid form to send it to the server.</p>
      <details class="server-details" open>
        <summary>Validation Report</summary>
        <pre id="server-validation-pre"></pre>
      </details>
      <details class="server-details">
        <summary>Mapped Data</summary>
        <pre id="server-mapped-pre"></pre>
      </details>
      <details class="server-details">
        <summary>Diagnostics</summary>
        <pre id="server-diagnostics-pre"></pre>
      </details>
      <pre id="server-response-pre" style="display:none"></pre>
    `;

    // Toolbar actions
    const actions = document.createElement('div');
    actions.className = 'form-actions';

    // Fixture selector (if example has fixtures)
    const fixtureHTML = ex.fixtures?.length
      ? `<select id="fixture-select" class="fixture-select">
           <option value="">Load fixture…</option>
           ${ex.fixtures.map(f => `<option value="${f.id}"${fixture?.id === f.id ? ' selected' : ''}>${f.label}</option>`).join('')}
         </select>`
      : '';

    actions.innerHTML = `
      ${fixtureHTML}
      <button type="button" class="action-btn" id="action-submit">Submit (Client)</button>
      <button type="button" class="action-btn secondary" id="action-reset">Reset</button>
    `;

    const formEl = document.createElement('formspec-render');
    formEl.id = 'form';

    // Tabs
    const tabs = document.createElement('div');
    tabs.className = 'example-tabs';
    tabs.setAttribute('role', 'tablist');

    const tabForm = document.createElement('button');
    tabForm.type = 'button';
    tabForm.className = 'example-tab';
    tabForm.id = 'tab-form';
    tabForm.setAttribute('role', 'tab');
    tabForm.setAttribute('aria-controls', 'panel-form');
    tabForm.textContent = 'Form';

    const tabClient = document.createElement('button');
    tabClient.type = 'button';
    tabClient.className = 'example-tab';
    tabClient.id = 'tab-client';
    tabClient.setAttribute('role', 'tab');
    tabClient.setAttribute('aria-controls', 'panel-client');
    tabClient.textContent = 'Client Submit';

    const tabServer = document.createElement('button');
    tabServer.type = 'button';
    tabServer.className = 'example-tab';
    tabServer.id = 'tab-server';
    tabServer.setAttribute('role', 'tab');
    tabServer.setAttribute('aria-controls', 'panel-server');
    tabServer.textContent = 'Server Response';

    tabs.appendChild(tabForm);
    tabs.appendChild(tabClient);
    if (ex.server) tabs.appendChild(tabServer);

    const panelForm = document.createElement('div');
    panelForm.className = 'example-tabpanel';
    panelForm.id = 'panel-form';
    panelForm.setAttribute('role', 'tabpanel');
    panelForm.setAttribute('aria-labelledby', 'tab-form');

    const panelClient = document.createElement('div');
    panelClient.className = 'example-tabpanel';
    panelClient.id = 'panel-client';
    panelClient.setAttribute('role', 'tabpanel');
    panelClient.setAttribute('aria-labelledby', 'tab-client');

    const panelServer = document.createElement('div');
    panelServer.className = 'example-tabpanel';
    panelServer.id = 'panel-server';
    panelServer.setAttribute('role', 'tabpanel');
    panelServer.setAttribute('aria-labelledby', 'tab-server');

    panelForm.appendChild(formEl);
    panelClient.appendChild(clientPanel);
    panelServer.appendChild(serverPanel);

    function setActiveTab(which) {
      const isForm = which === 'form';
      const isClient = which === 'client';
      const isServer = which === 'server';

      tabForm.setAttribute('aria-selected', String(isForm));
      tabClient.setAttribute('aria-selected', String(isClient));
      if (ex.server) tabServer.setAttribute('aria-selected', String(isServer));

      tabForm.classList.toggle('active', isForm);
      tabClient.classList.toggle('active', isClient);
      if (ex.server) tabServer.classList.toggle('active', isServer);

      panelForm.classList.toggle('active', isForm);
      panelClient.classList.toggle('active', isClient);
      if (ex.server) panelServer.classList.toggle('active', isServer);
    }

    tabForm.addEventListener('click', () => setActiveTab('form'));
    tabClient.addEventListener('click', () => setActiveTab('client'));
    tabServer.addEventListener('click', () => setActiveTab('server'));

    setActiveTab('form');

    actions.querySelector('#action-submit').addEventListener('click', () => {
      // This will touch all fields and update latest submit detail; it will also
      // emit formspec-submit by default, which we use to render panels below.
      formEl.submit({ mode: 'submit', emitEvent: true });
    });

    actions.querySelector('#action-reset').addEventListener('click', () => {
      // Reload the example with no fixture — clean slate.
      activeExampleId = null;
      loadExample(ex);
    });

    // Fixture selector: reload the form with the selected fixture's saved state
    const fixtureSelect = actions.querySelector('#fixture-select');
    if (fixtureSelect) {
      fixtureSelect.addEventListener('change', () => {
        const fixtureId = fixtureSelect.value;
        if (!fixtureId) {
          // "Load fixture…" selected — reset to clean state
          activeExampleId = null;
          loadExample(ex);
          return;
        }
        const selected = ex.fixtures.find(f => f.id === fixtureId);
        if (!selected) return;
        // Full reload with fixture — same as restoring a saved session
        activeExampleId = null;
        loadExample(ex, selected);
      });
    }

    container.appendChild(actions);
    container.appendChild(tabs);
    container.appendChild(panelForm);
    container.appendChild(panelClient);
    if (ex.server) container.appendChild(panelServer);

    mainArea.appendChild(container);

    // Load registry if specified (absolute path — not relative to ex.dir)
    if (ex.registry) {
      try {
        const registryDoc = await loadJSON(ex.registry);
        formEl.registryDocuments = registryDoc;
      } catch (err) {
        console.warn(`Failed to load registry ${ex.registry}:`, err);
      }
    }

    // Activate adapter if the example specifies one, otherwise reset to default
    if (ex.adapter) {
      globalRegistry.setAdapter(ex.adapter);
    } else {
      globalRegistry.setAdapter('default');
    }

    // Set artifacts — this creates the engine and triggers rendering
    formEl.definition = definition;
    if (componentDoc) formEl.componentDocument = componentDoc;
    if (themeDoc) formEl.themeDocument = themeDoc;

    // Restore saved state: apply fixture data to the fresh engine so that
    // reactive signals fire, calculated fields recompute, and relevance
    // cascades (e.g. applicableTopics → expenditure visibility).
    if (fixtureResponse?.data) {
      const engine = formEl.getEngine();
      if (engine) applyResponseData(engine, fixtureResponse.data);
    }

    // Always show the client-side submit detail (response + validationReport).
    // Optionally forward valid responses to the server (grant-application).
    formEl.addEventListener('formspec-submit', async (e) => {
      const submitDetail = e.detail || {};
      const vr = submitDetail.validationReport || {};
      const response = submitDetail.response || {};

      const metaEl = clientPanel.querySelector('#client-meta');
      const emptyEl = clientPanel.querySelector('#client-empty');
      metaEl.textContent = vr.counts
        ? `valid=${!!vr.valid}  errors=${vr.counts.error || 0}  warnings=${vr.counts.warning || 0}`
        : `valid=${!!vr.valid}`;

      if (emptyEl) emptyEl.remove();
      clientPanel.querySelector('#client-validation-pre').textContent = JSON.stringify(vr, null, 2);
      clientPanel.querySelector('#client-response-pre').textContent = JSON.stringify(response, null, 2);
      setActiveTab('client');

      if (!ex.server) return;

      try {
        const res = await fetch(`${SERVER}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(response),
        });
        const result = await res.json();
        const serverEmpty = serverPanel.querySelector('#server-empty');
        if (serverEmpty) serverEmpty.remove();

        // Meta line — same format as client
        const serverMeta = serverPanel.querySelector('#server-meta');
        serverMeta.textContent = result.counts
          ? `valid=${!!result.valid}  errors=${result.counts.error || 0}  warnings=${result.counts.warning || 0}`
          : `valid=${!!result.valid}`;

        // Validation results
        const reportData = { valid: result.valid, results: result.results, counts: result.counts, timestamp: result.timestamp };
        serverPanel.querySelector('#server-validation-pre').textContent = JSON.stringify(reportData, null, 2);

        // Mapped data
        serverPanel.querySelector('#server-mapped-pre').textContent = JSON.stringify(result.mapped, null, 2);

        // Diagnostics
        serverPanel.querySelector('#server-diagnostics-pre').textContent = result.diagnostics?.length
          ? JSON.stringify(result.diagnostics, null, 2)
          : '(none)';

        // Keep the full response in the hidden pre for test access
        serverPanel.querySelector('#server-response-pre').textContent = JSON.stringify(result, null, 2);

        setActiveTab('server');
      } catch (err) {
        const serverEmpty = serverPanel.querySelector('#server-empty');
        if (serverEmpty) serverEmpty.remove();
        serverPanel.querySelector('#server-meta').textContent = 'Error';
        serverPanel.querySelector('#server-validation-pre').textContent = `Error contacting server: ${err.message}`;
        serverPanel.querySelector('#server-response-pre').textContent = '';
        setActiveTab('server');
      }
    });

  } catch (err) {
    mainArea.innerHTML = `
      <div class="state-message">
        <h2>Failed to load</h2>
        <p>${err.message}</p>
      </div>
    `;
    activeExampleId = null;
  }
}

// ── Load from hash on startup ──
function loadFromHash() {
  const hash = window.location.hash.slice(1);
  if (hash) {
    const ex = EXAMPLES.find(e => e.id === hash);
    if (ex) {
      loadExample(ex);
      return;
    }
  }
  // Auto-load first example
  if (EXAMPLES.length > 0) {
    loadExample(EXAMPLES[0]);
  }
}

window.addEventListener('hashchange', loadFromHash);
loadFromHash();
