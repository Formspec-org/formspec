/**
 * Form Intelligence Dashboard — tools.js
 *
 * Vanilla JS controller for the 5-tab developer tools page.
 * Each tab talks to the Python backend at SERVER_URL.
 */

const SERVER = '/api';

// ── Tab switching ──
const tabs = document.querySelectorAll('.tools-tab');
const panels = document.querySelectorAll('.tools-panel');

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    panels.forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    const panelId = `panel-${tab.dataset.tab}`;
    document.getElementById(panelId)?.classList.add('active');

    // Auto-load data for tabs that need it
    if (tab.dataset.tab === 'registry') loadRegistry();
    if (tab.dataset.tab === 'dependencies') loadDependencies();
  });
});

// ── Helpers ──
function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideError(id) {
  document.getElementById(id)?.classList.add('hidden');
}
function showResult(id) {
  document.getElementById(id)?.classList.remove('hidden');
}
function hideResult(id) {
  document.getElementById(id)?.classList.add('hidden');
}

// ── 1. Expression Tester ──

// Pre-populate with working FEL examples across every category
const EVAL_EXAMPLES = {
  sum: {
    label: 'sum()',
    expression: "sum($budget.lineItems[*].amount)",
    data: { budget: { lineItems: [{ amount: 75000 }, { amount: 25000 }, { amount: 8500 }] } }
  },
  avg: {
    label: 'avg()',
    expression: "avg($grades)",
    data: { grades: [88, 92, 76, 95] }
  },
  count: {
    label: 'count()',
    expression: "count($applicants)",
    data: { applicants: ["Alice", "Bob", "Carol", "Dave"] }
  },
  round: {
    label: 'round()',
    expression: "round(3.14159, 2)",
    data: {}
  },
  power: {
    label: 'power()',
    expression: "power(2, 10)",
    data: {}
  },
  abs: {
    label: 'abs()',
    expression: "abs($balance)",
    data: { balance: -4200 }
  },
  upper: {
    label: 'upper()',
    expression: "upper('community health partners')",
    data: {}
  },
  replace: {
    label: 'replace()',
    expression: "replace('FY2025-Q1 Report', 'Q1', 'Q2')",
    data: {}
  },
  contains: {
    label: 'contains()',
    expression: "contains($title, 'grant')",
    data: { title: "Federal grant application" }
  },
  length: {
    label: 'length()',
    expression: "length($description)",
    data: { description: "Improving rural healthcare access in underserved communities" }
  },
  dateAdd: {
    label: 'dateAdd()',
    expression: "dateAdd(today(), 6, 'months')",
    data: {}
  },
  dateDiff: {
    label: 'dateDiff()',
    expression: "dateDiff($start, $end, 'days')",
    data: { start: "2026-01-15", end: "2026-06-30" }
  },
  year: {
    label: 'year()',
    expression: "year(today())",
    data: {}
  },
  conditional: {
    label: 'if/then/else',
    expression: "if $score >= 80 then 'Approved' else 'Needs Review'",
    data: { score: 85 }
  },
  coalesce: {
    label: 'coalesce()',
    expression: "coalesce($nickname, $fullName, 'Anonymous')",
    data: { nickname: null, fullName: "Jane Doe" }
  },
  typeOf: {
    label: 'typeOf()',
    expression: "typeOf($amount)",
    data: { amount: 50000 }
  },
  cast: {
    label: 'number()',
    expression: "number('42.5') * 2",
    data: {}
  },
  empty: {
    label: 'empty()',
    expression: "empty($notes)",
    data: { notes: "" }
  },
};

// Build example buttons dynamically
const examplesContainer = document.getElementById('eval-examples');
for (const [key, ex] of Object.entries(EVAL_EXAMPLES)) {
  const btn = document.createElement('button');
  btn.className = 'btn btn-outline eval-example-btn';
  btn.dataset.example = key;
  btn.style.cssText = 'font-size:11px;padding:3px 10px;font-family:"SF Mono","Fira Code",monospace';
  btn.textContent = ex.label;
  examplesContainer.appendChild(btn);
}

function setEvalExample(name) {
  const example = EVAL_EXAMPLES[name];
  if (!example) return;
  document.getElementById('eval-expression').value = example.expression;
  document.getElementById('eval-data').value = Object.keys(example.data).length
    ? JSON.stringify(example.data, null, 2) : '';
  // highlight active button
  examplesContainer.querySelectorAll('.eval-example-btn').forEach((b) => {
    b.classList.toggle('active-example', b.dataset.example === name);
  });
}
setEvalExample('sum');

// Wire up example buttons
examplesContainer.addEventListener('click', (e) => {
  const btn = e.target.closest('.eval-example-btn');
  if (!btn) return;
  setEvalExample(btn.dataset.example);
  hideError('eval-error');
  hideResult('eval-result');
});

document.getElementById('btn-evaluate')?.addEventListener('click', async () => {
  const expression = document.getElementById('eval-expression').value.trim();
  const dataStr = document.getElementById('eval-data').value.trim();
  hideError('eval-error');
  hideResult('eval-result');

  let data = {};
  try {
    data = JSON.parse(dataStr || '{}');
  } catch {
    showError('eval-error', 'Invalid JSON in Sample Data field.');
    return;
  }

  try {
    const res = await fetch(`${SERVER}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expression, data }),
    });
    const body = await res.json();
    if (!res.ok) {
      showError('eval-error', body?.detail?.error || body?.detail || 'Evaluation failed.');
      return;
    }
    document.getElementById('eval-result-value').textContent =
      body.value === null ? 'null' : JSON.stringify(body.value);
    const typeEl = document.getElementById('eval-result-type');
    typeEl.textContent = body.type;
    typeEl.className = `badge badge-${body.type}`;
    const diagEl = document.getElementById('eval-result-diagnostics');
    diagEl.innerHTML = body.diagnostics.length
      ? body.diagnostics.map((d) => `<div style="color:var(--color-warning);font-size:0.85rem">${d}</div>`).join('')
      : '';
    showResult('eval-result');
  } catch (e) {
    showError('eval-error', `Cannot reach server: ${e.message}. Is the server running on ${SERVER}?`);
  }
});

// ── 2. Export ──
let lastExportData = null;
let lastExportFormat = '';

const EXPORT_SAMPLE_DATA = {
  applicantInfo: {
    orgName: 'Community Health Partners',
    ein: '47-1234567',
    orgType: 'nonprofit',
    contactName: 'Jane Doe',
    contactEmail: 'jane@chp.org',
    contactPhone: '555-123-4567',
  },
  projectNarrative: {
    abstract: 'Improving rural healthcare access in underserved communities through mobile clinics.',
    projectTitle: 'Rural Mobile Health Initiative',
  },
  budget: {
    totalDirect: 95000,
    totalIndirect: 13500,
    lineItems: [
      { category: 'Personnel', amount: 75000 },
      { category: 'Equipment', amount: 12000 },
      { category: 'Travel', amount: 8000 },
    ],
  },
};

const MAPPING_FILES = {
  json: { file: 'mapping.json', label: 'JSON', desc: 'Native format for web APIs and modern integrations.' },
  csv:  { file: 'mapping-csv.json', label: 'CSV', desc: 'Spreadsheet-friendly format for Excel and databases.' },
  xml:  { file: 'mapping-xml.json', label: 'XML', desc: 'Structured markup for federal grant portals (Grants.gov).' },
};

// Pre-fill the input data textarea
document.getElementById('export-input-data').value = JSON.stringify(EXPORT_SAMPLE_DATA, null, 2);

// Load mapping docs and build cards
async function initExportCards() {
  const cardsEl = document.getElementById('export-cards');

  for (const [fmt, info] of Object.entries(MAPPING_FILES)) {
    let mappingDoc = null;
    try {
      const res = await fetch(`./${info.file}`);
      if (res.ok) mappingDoc = await res.json();
    } catch { /* static file not reachable */ }

    const card = document.createElement('div');
    card.className = 'export-card';

    let metaHtml = '';
    let rulesHtml = '';

    if (mappingDoc) {
      const target = mappingDoc.targetSchema || {};
      metaHtml = `<div class="mapping-meta">
        <span class="badge badge-stable">v${mappingDoc.version || '?'}</span>
        <span class="badge" style="background:var(--color-neutral-100);color:var(--color-neutral-700)">${mappingDoc.direction || 'forward'}</span>
        <span class="badge" style="background:var(--color-neutral-100);color:var(--color-neutral-700)">${mappingDoc.conformanceLevel || '?'}</span>
      </div>`;

      if (target.name) {
        metaHtml += `<div style="font-size:0.78rem;color:var(--color-neutral-700);margin-bottom:8px">
          <strong>Target:</strong> ${target.name}
        </div>`;
      }

      const rules = mappingDoc.rules || [];
      if (rules.length) {
        const ruleRows = rules.map((r) => `
          <div class="mapping-rule">
            <span class="mapping-rule-source" title="${r.sourcePath || ''}">${r.sourcePath || '?'}</span>
            <span class="mapping-rule-arrow">\u2192</span>
            <span class="mapping-rule-target" title="${r.targetPath || ''}">${r.targetPath || '?'}</span>
            <span class="mapping-rule-transform">${r.transform || '?'}</span>
          </div>
        `).join('');
        rulesHtml = `<div class="mapping-rules">${ruleRows}</div>`;
      }
    }

    card.innerHTML = `
      <h4>${info.label}</h4>
      <p>${info.desc}</p>
      ${metaHtml}
      ${rulesHtml}
      <button class="btn btn-primary" data-format="${fmt}">Export ${info.label}</button>
    `;
    cardsEl.appendChild(card);
  }

  // Wire up export buttons (delegated)
  cardsEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-format]');
    if (!btn) return;
    const format = btn.dataset.format;
    hideError('export-error');
    hideResult('export-result');

    let data;
    try {
      data = JSON.parse(document.getElementById('export-input-data').value);
    } catch {
      showError('export-error', 'Invalid JSON in Input Data field.');
      return;
    }

    try {
      const res = await fetch(`${SERVER}/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showError('export-error', err.detail || `Export failed (${res.status}).`);
        return;
      }
      const text = await res.text();
      lastExportData = text;
      lastExportFormat = format;

      document.getElementById('export-result-format').textContent =
        `${format.toUpperCase()} Output`;
      document.getElementById('export-result-content').textContent =
        text.length > 5000 ? text.slice(0, 5000) + '\n\n... (truncated)' : text;
      showResult('export-result');
    } catch (e) {
      showError('export-error', `Cannot reach server: ${e.message}`);
    }
  });
}
initExportCards();

document.getElementById('btn-export-download')?.addEventListener('click', () => {
  if (!lastExportData) return;
  const mimeMap = { json: 'application/json', csv: 'text/csv', xml: 'application/xml' };
  const blob = new Blob([lastExportData], { type: mimeMap[lastExportFormat] || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `grant-application.${lastExportFormat}`;
  a.click();
  URL.revokeObjectURL(url);
});

// ── 3. Changelog ──
async function loadDefinitionForChangelog() {
  try {
    const res = await fetch(`${SERVER}/definition`);
    if (res.ok) {
      const defn = await res.json();
      const oldText = JSON.stringify(defn, null, 2);
      document.getElementById('changelog-old').value = oldText;

      // Build a heavily modified "new" version that exercises every change
      // category the changelog engine supports: items (add/remove/modify),
      // binds (new required, changed constraint), shapes (add/remove),
      // optionSets (add/modify), metadata, and screener.
      const newDef = JSON.parse(oldText);
      newDef.version = '2.0.0';
      newDef.title = (newDef.title || 'Grant Application') + ' — Revised';
      newDef.description = 'Updated grant application with enhanced equity requirements and streamlined budget.';

      if (newDef.items && newDef.items.length > 0) {
        // Add new fields
        newDef.items.push(
          { key: 'diversityStatement', type: 'field', dataType: 'string', label: 'Diversity, Equity & Inclusion Statement', hint: 'Describe how your project promotes DEI.' },
          { key: 'environmentalImpact', type: 'field', dataType: 'string', label: 'Environmental Impact Assessment' },
        );
        // Remove an existing item (take the last real field before our additions)
        const removeIdx = newDef.items.findIndex((it) => it.key === 'certifications' || it.key === 'signatoryName');
        if (removeIdx >= 0) newDef.items.splice(removeIdx, 1);
        // Modify an item's dataType (breaking change)
        const budgetField = newDef.items.find((it) => it.key === 'requestedAmount' || it.key === 'totalBudget');
        if (budgetField) { budgetField.dataType = 'integer'; budgetField.label = (budgetField.label || '') + ' (whole dollars only)'; }
        // Modify a label only (cosmetic change)
        const abstractField = newDef.items.find((it) => it.key === 'abstract' || it.key === 'projectAbstract');
        if (abstractField) abstractField.label = 'Executive Summary';
      }

      // Add a new required bind (breaking)
      if (!newDef.binds) newDef.binds = [];
      newDef.binds.push(
        { path: 'diversityStatement', required: true, constraint: 'length(.) >= 100', constraintMsg: 'Must be at least 100 characters.' },
        { path: 'environmentalImpact', required: false, relevant: "$requestedAmount > 50000" },
      );
      // Modify an existing bind's constraint
      const existingBind = newDef.binds.find((b) => b.path === 'abstract' || b.path === 'projectAbstract' || b.path === 'projectNarrative.abstract');
      if (existingBind) existingBind.constraint = "length(.) >= 200 and length(.) <= 5000";

      // Add/modify shapes
      if (!newDef.shapes) newDef.shapes = [];
      newDef.shapes.push({ name: 'equity-completeness', rule: "present($diversityStatement) and length($diversityStatement) >= 100", severity: 'error', message: 'DEI statement is required and must be substantive.' });
      // Remove a shape if one exists
      if (newDef.shapes.length > 1) newDef.shapes.splice(0, 1);

      // Add a new optionSet
      if (!newDef.optionSets) newDef.optionSets = {};
      newDef.optionSets['impactLevel'] = [
        { value: 'low', label: 'Low Impact' },
        { value: 'medium', label: 'Medium Impact' },
        { value: 'high', label: 'High Impact' },
        { value: 'transformative', label: 'Transformative' },
      ];

      // Add a screener
      newDef.screener = { rule: "$applicantInfo.orgType != 'forprofit'", message: 'For-profit organizations are not eligible for this grant.' };

      document.getElementById('changelog-new').value = JSON.stringify(newDef, null, 2);
    }
  } catch { /* server not running, user can paste manually */ }
}
loadDefinitionForChangelog();

document.getElementById('btn-changelog')?.addEventListener('click', async () => {
  hideError('changelog-error');
  hideResult('changelog-result');

  let oldDef, newDef;
  try {
    oldDef = JSON.parse(document.getElementById('changelog-old').value);
    newDef = JSON.parse(document.getElementById('changelog-new').value);
  } catch {
    showError('changelog-error', 'Invalid JSON. Both fields must contain valid JSON.');
    return;
  }

  try {
    const res = await fetch(`${SERVER}/changelog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ old: oldDef, new: newDef }),
    });
    const body = await res.json();
    if (!res.ok) {
      showError('changelog-error', body.detail || 'Comparison failed.');
      return;
    }

    const impactEl = document.getElementById('changelog-impact');
    impactEl.textContent = body.semverImpact;
    impactEl.className = `badge badge-${body.semverImpact}`;

    document.getElementById('changelog-versions').textContent =
      `${body.fromVersion || '?'} → ${body.toVersion || '?'}`;

    const changesList = document.getElementById('changelog-changes');
    changesList.innerHTML = '';
    if (!body.changes || body.changes.length === 0) {
      changesList.innerHTML = '<li class="change-item" style="color:var(--color-neutral-700)">No changes detected.</li>';
    } else {
      const impactBadge = (impact) => {
        const cls = impact === 'breaking' ? 'major' : impact === 'compatible' ? 'minor' : 'patch';
        return `<span class="badge badge-${cls}">${impact}</span>`;
      };
      for (const c of body.changes) {
        const li = document.createElement('li');
        li.className = 'change-item';

        // Auto-generate a description from the change data
        let desc = c.description || '';
        if (!desc) {
          if (c.type === 'added') desc = `New ${c.target} added`;
          else if (c.type === 'removed') desc = `${c.target} removed`;
          else if (c.type === 'modified') desc = `${c.target} updated`;
          // Add detail for specific cases
          if (c.after?.dataType && c.before?.dataType && c.after.dataType !== c.before.dataType) {
            desc += ` — dataType changed from "${c.before.dataType}" to "${c.after.dataType}"`;
          } else if (c.after?.label && c.before?.label && c.after.label !== c.before.label) {
            desc += ` — label: "${c.before.label}" → "${c.after.label}"`;
          } else if (c.after?.required && !c.before?.required) {
            desc += ' — now required';
          } else if (c.after?.constraint && c.after.constraint !== c.before?.constraint) {
            desc += ` — constraint updated`;
          }
        }

        li.innerHTML =
          `<span class="change-type change-type-${c.type}">${c.type}</span>` +
          `<span class="badge" style="background:var(--color-neutral-100);color:var(--color-neutral-700);font-size:0.68rem;margin-right:6px">${c.target}</span>` +
          `<strong style="font-family:'SF Mono','Fira Code',monospace;font-size:0.82rem">${c.path || c.key || ''}</strong>` +
          `<span style="color:var(--color-neutral-700);margin:0 6px">&mdash;</span>` +
          `<span style="flex:1">${desc}</span> ` +
          (c.impact ? impactBadge(c.impact) : '');

        li.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:4px';
        changesList.appendChild(li);
      }
    }
    showResult('changelog-result');
  } catch (e) {
    showError('changelog-error', `Cannot reach server: ${e.message}`);
  }
});

// ── 4. Registry ──
let registryLoaded = false;

async function loadRegistry() {
  if (registryLoaded) return;
  const cardsEl = document.getElementById('registry-cards');
  hideError('registry-error');

  try {
    const res = await fetch(`${SERVER}/registry`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    renderRegistryCards(body.entries);
    registryLoaded = true;
  } catch (e) {
    showError('registry-error', `Cannot load extensions: ${e.message}`);
  }
}

function renderRegistryCards(entries) {
  const cardsEl = document.getElementById('registry-cards');
  cardsEl.innerHTML = '';
  if (!entries || entries.length === 0) {
    cardsEl.innerHTML = '<p style="color:var(--color-neutral-700)">No extensions found.</p>';
    return;
  }
  for (const entry of entries) {
    const card = document.createElement('div');
    card.className = 'registry-card';
    card.dataset.category = entry.category || '';
    card.dataset.status = entry.status || '';

    // Build detail sections
    const details = [];

    if (entry.baseType) {
      details.push(`<div class="registry-detail"><span class="registry-detail-label">Base type</span> <code>${entry.baseType}</code></div>`);
    }
    if (entry.constraints) {
      const parts = Object.entries(entry.constraints).map(([k, v]) => `<code>${k}: ${v}</code>`);
      details.push(`<div class="registry-detail"><span class="registry-detail-label">Constraints</span> ${parts.join(', ')}</div>`);
    }
    if (entry.parameters?.length) {
      const params = entry.parameters.map((p) =>
        `<span class="dep-chip">${p.name}: ${p.type}</span>`
      ).join('');
      details.push(`<div class="registry-detail"><span class="registry-detail-label">Parameters</span> ${params}</div>`);
    }
    if (entry.returns) {
      details.push(`<div class="registry-detail"><span class="registry-detail-label">Returns</span> <code>${entry.returns}</code></div>`);
    }
    if (entry.members?.length) {
      const chips = entry.members.map((m) => `<span class="dep-chip">${m}</span>`).join('');
      details.push(`<div class="registry-detail"><span class="registry-detail-label">Members</span> ${chips}</div>`);
    }
    if (entry.license) {
      details.push(`<div class="registry-detail"><span class="registry-detail-label">License</span> ${entry.license}</div>`);
    }
    if (entry.compatibility?.formspecVersion) {
      details.push(`<div class="registry-detail"><span class="registry-detail-label">Compatibility</span> <code>formspec ${entry.compatibility.formspecVersion}</code></div>`);
    }
    if (entry.deprecationNotice) {
      details.push(`<div class="registry-deprecation">${entry.deprecationNotice}</div>`);
    }

    card.innerHTML = `
      <h4>${entry.name}</h4>
      <div class="registry-meta">
        <span class="badge badge-${entry.status || 'draft'}">${entry.status || 'unknown'}</span>
        <span class="badge" style="background:var(--color-neutral-100);color:var(--color-neutral-700)">${entry.category || 'unknown'}</span>
        <span style="font-size:0.75rem;color:var(--color-neutral-700)">v${entry.version || '?'}</span>
      </div>
      <p>${entry.description || ''}</p>
      ${details.length ? '<div class="registry-details">' + details.join('') + '</div>' : ''}
    `;
    cardsEl.appendChild(card);
  }
}

document.getElementById('btn-registry-filter')?.addEventListener('click', async () => {
  const category = document.getElementById('registry-category').value;
  const status = document.getElementById('registry-status').value;
  hideError('registry-error');

  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (status) params.set('status', status);

  try {
    const res = await fetch(`${SERVER}/registry?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    renderRegistryCards(body.entries);
  } catch (e) {
    showError('registry-error', `Filter failed: ${e.message}`);
  }
});

// ── 5. Dependencies (d3-force graph) ──
let depsLoaded = false;
let depsData = null;

async function loadDependencies() {
  if (depsLoaded) return;
  hideError('deps-error');

  try {
    const res = await fetch(`${SERVER}/dependencies`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    depsData = await res.json();
    depsLoaded = true;
    renderDependencyGraph(depsData);
  } catch (e) {
    showError('deps-error', `Cannot load dependencies: ${e.message}`);
  }
}

async function renderDependencyGraph(data) {
  // Build nodes and links from the dependency data
  const nodeSet = new Set();
  const links = [];

  for (const [field, info] of Object.entries(data)) {
    // Use just the last segment for display
    const fieldShort = field.split('.').pop().replace(/\[.*\]/, '');
    nodeSet.add(fieldShort);
    for (const dep of info.depends_on) {
      const depShort = dep.split('.').pop().replace(/\[.*\]/, '');
      nodeSet.add(depShort);
      links.push({ source: depShort, target: fieldShort, fullSource: dep, fullTarget: field });
    }
  }

  const calculatedFields = new Set(Object.keys(data).map(k => k.split('.').pop().replace(/\[.*\]/, '')));
  const nodes = Array.from(nodeSet).map((id) => ({
    id,
    calculated: calculatedFields.has(id),
  }));

  // Try to load d3, fall back to a simple list
  try {
    const d3 = await import('https://cdn.jsdelivr.net/npm/d3@7/+esm');
    renderD3Graph(d3, nodes, links, data);
  } catch {
    renderFallbackList(data);
  }
}

function renderD3Graph(d3, nodes, links, rawData) {
  const container = document.getElementById('deps-graph');
  const svg = d3.select('#deps-svg');
  svg.selectAll('*').remove();

  const width = container.clientWidth || 700;
  const height = 400;
  svg.attr('viewBox', `0 0 ${width} ${height}`);

  // Arrowhead marker
  svg.append('defs').append('marker')
    .attr('id', 'arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 20)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('class', 'edge-arrow');

  const world = svg.append('g').attr('class', 'zoom-layer');

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d) => d.id).distance(80))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide(30));

  const link = world.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('class', 'edge')
    .attr('marker-end', 'url(#arrow)');

  const nodeGroup = world.append('g')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('class', 'graph-node')
    .style('cursor', 'pointer')
    .call(d3.drag()
      .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
    );

  nodeGroup.append('circle')
    .attr('r', 14)
    .attr('class', (d) => d.calculated ? 'node-calculated' : 'node-input')
    .attr('stroke-width', 2);

  nodeGroup.append('text')
    .attr('class', 'node-label')
    .attr('dy', -20)
    .attr('text-anchor', 'middle')
    .text((d) => d.id);

  // Click handler for details
  nodeGroup.on('click', (event, d) => {
    showNodeDetail(d.id, rawData);
  });

  simulation.on('tick', () => {
    link
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y);
    nodeGroup.attr('transform', (d) => `translate(${d.x},${d.y})`);
  });

  // Zoom
  const zoom = d3.zoom()
    .scaleExtent([0.3, 3])
    .on('zoom', (e) => {
      world.attr('transform', e.transform);
    });
  svg.call(zoom);
}

function showNodeDetail(nodeId, rawData) {
  document.getElementById('deps-placeholder')?.classList.add('hidden');
  const content = document.getElementById('deps-detail-content');
  content.classList.remove('hidden');
  document.getElementById('deps-detail-field').textContent = nodeId;

  // Find matching entries
  const matches = Object.entries(rawData).filter(([key]) => {
    const short = key.split('.').pop().replace(/\[.*\]/, '');
    return short === nodeId;
  });

  const exprSection = document.getElementById('deps-detail-expr-section');
  const depsSection = document.getElementById('deps-detail-deps-section');

  if (matches.length > 0) {
    const [, info] = matches[0];
    document.getElementById('deps-detail-expr').textContent = info.expression;
    exprSection.style.display = '';

    const depsEl = document.getElementById('deps-detail-deps');
    depsEl.innerHTML = info.depends_on.map((d) =>
      `<span class="dep-chip">${d}</span>`
    ).join('');
    depsSection.style.display = '';
  } else {
    exprSection.style.display = 'none';
    depsSection.style.display = 'none';
  }
}

function renderFallbackList(data) {
  const container = document.getElementById('deps-graph');
  container.innerHTML = '<div style="padding:16px">';
  let html = '<h4 style="margin-bottom:12px">Field Dependencies</h4>';
  for (const [field, info] of Object.entries(data)) {
    html += `<div style="margin-bottom:12px;padding:8px;border:1px solid var(--color-neutral-200);border-radius:4px">`;
    html += `<strong>${field}</strong><br>`;
    html += `<code style="font-size:0.8rem;color:var(--color-neutral-700)">${info.expression}</code><br>`;
    html += info.depends_on.map((d) => `<span class="dep-chip">${d}</span>`).join('');
    html += `</div>`;
  }
  container.innerHTML = html + '</div>';
}
