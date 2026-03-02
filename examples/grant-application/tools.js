/**
 * Form Intelligence Dashboard — tools.js
 *
 * Vanilla JS controller for the 5-tab developer tools page.
 * Each tab talks to the Python backend at SERVER_URL.
 */

const SERVER = 'http://localhost:8000';

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

// Pre-populate with a real grant-app formula
const EVAL_EXAMPLES = {
  budget: {
    expression: "money(sum($budget.lineItems[*].subtotal), 'USD')",
    data: {
      budget: {
        lineItems: [
          { category: "Personnel", subtotal: { amount: "75000", currency: "USD" } },
          { category: "Equipment", subtotal: { amount: "25000", currency: "USD" } },
          { category: "Travel", subtotal: { amount: "8500", currency: "USD" } }
        ]
      }
    }
  },
  date: {
    expression: "dateAdd(today(), 6, 'months')",
    data: {}
  },
  text: {
    expression: "upper('community health partners')",
    data: {}
  },
  conditional: {
    expression: "if $score >= 80 then 'pass' else 'fail'",
    data: { score: 85 }
  }
};

// Set initial "Budget Total" example on load
function setEvalExample(name) {
  const example = EVAL_EXAMPLES[name];
  if (!example) return;
  document.getElementById('eval-expression').value = example.expression;
  document.getElementById('eval-data').value = JSON.stringify(example.data, null, 2);
}
setEvalExample('budget');

// Wire up example buttons
document.querySelectorAll('.eval-example-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    setEvalExample(btn.dataset.example);
    hideError('eval-error');
    hideResult('eval-result');
  });
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

document.querySelectorAll('.export-card button[data-format]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const format = btn.dataset.format;
    hideError('export-error');
    hideResult('export-result');

    const sampleData = {
      applicantInfo: { orgName: 'Community Health Partners', ein: '47-1234567' },
      projectNarrative: { abstract: 'Sample project abstract.' },
    };

    try {
      const res = await fetch(`${SERVER}/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: sampleData }),
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
});

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

      // Create a modified "new" version with a meaningful diff so users
      // see an interesting comparison result when they click "Compare Versions".
      // Only auto-modify when the definition has real content (items present).
      const newDef = JSON.parse(oldText);
      if (newDef.items && newDef.items.length > 0) {
        newDef.version = '1.1.0';
        newDef.items.push({
          key: 'diversityStatement',
          type: 'field',
          dataType: 'string',
          label: 'Diversity, Equity & Inclusion Statement',
          hint: 'Describe how your project promotes diversity, equity, and inclusion.'
        });
      }
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
      for (const c of body.changes) {
        const li = document.createElement('li');
        li.className = 'change-item';
        li.innerHTML = `<span class="change-type change-type-${c.type}">${c.type}</span>` +
          `<strong>${c.path || c.key || ''}</strong> &mdash; ${c.description || ''}` +
          (c.impact ? ` <span class="badge badge-${c.impact === 'breaking' ? 'major' : 'patch'}">${c.impact}</span>` : '');
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
    card.innerHTML = `
      <h4>${entry.name}</h4>
      <div class="registry-meta">
        <span class="badge badge-${entry.status || 'draft'}">${entry.status || 'unknown'}</span>
        <span class="badge" style="background:var(--color-neutral-100);color:var(--color-neutral-700)">${entry.category || 'unknown'}</span>
        <span style="font-size:0.75rem;color:var(--color-neutral-700)">v${entry.version || '?'}</span>
      </div>
      <p>${entry.description || ''}</p>
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

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d) => d.id).distance(80))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide(30));

  const link = svg.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('class', 'edge')
    .attr('marker-end', 'url(#arrow)');

  const nodeGroup = svg.append('g')
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
      svg.selectAll('g').attr('transform', e.transform);
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
