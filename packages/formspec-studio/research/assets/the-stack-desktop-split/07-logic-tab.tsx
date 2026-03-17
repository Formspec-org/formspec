/** @filedesc Research prototype: Logic tab visualising bind rules with FEL dependency extraction. */
// LOGIC TAB
// Split from the-stack-desktop.tsx — prototype, imports not wired.
import { useState, useCallback } from "react";

function LogicTab({ sel, onSel }) {
  const [filter, setFilter] = useState("all");
  const [expandedBinds, setExpandedBinds] = useState({});

  const bindTypes = ["all", "required", "relevant", "calculate", "constraint", "readonly"];
  const bindColor = { required: co.ac, relevant: co.lo, calculate: co.gr, constraint: co.am, readonly: co.mu };

  // Enrich binds with item labels
  const enriched = DEF.binds.map(b => {
    const tail = b.path.replace(/\[\*\]/g, "").split(".").pop();
    const item = ALL.find(i => i.key === tail);
    return { ...b, _item: item, _label: item?.label || b.path, _key: tail };
  });

  const filtered = filter === "all" ? enriched : enriched.filter(b => b[filter]);

  // Dependency extraction (simple — find $field refs in expressions)
  const extractDeps = (expr) => {
    if (!expr) return [];
    const matches = expr.match(/\$[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
    return [...new Set(matches.map(m => m.replace("$", "")))].filter(k => k && ALL.some(i => i.key === k));
  };
  const extractVarDeps = (expr) => {
    if (!expr) return [];
    const matches = expr.match(/@[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
    return [...new Set(matches.map(m => m.replace("@", "")))].filter(n => DEF.variables.some(v => v.name === n));
  };

  // Count by type
  const counts = {};
  bindTypes.forEach(t => {
    if (t === "all") counts[t] = enriched.length;
    else counts[t] = enriched.filter(b => b[t]).length;
  });

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 28px 80px" }}>
      {/* Header */}
      <div style={{ padding: "14px 0 6px" }}>
        <div style={{ ...U, fontSize: 16, fontWeight: 600, letterSpacing: -0.4 }}>Logic Configuration</div>
        <div style={{ ...M, fontSize: 9.5, color: co.mu, marginTop: 2 }}>
          {DEF.binds.length} binds · {DEF.shapes.length} shapes · {DEF.variables.length} variables
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 4, padding: "8px 0 12px", flexWrap: "wrap" }}>
        {bindTypes.map(t => (
          <button key={t} onClick={() => setFilter(t)} style={{
            ...M, fontSize: 9.5, padding: "4px 10px", borderRadius: 4, cursor: "pointer",
            border: `1px solid ${filter === t ? (bindColor[t] || co.ac) + "40" : co.bd}`,
            background: filter === t ? `${bindColor[t] || co.ac}08` : "transparent",
            color: filter === t ? (bindColor[t] || co.ac) : co.mu,
            fontWeight: filter === t ? 600 : 400, textTransform: "capitalize",
          }}>
            {t} <span style={{ opacity: 0.6 }}>({counts[t]})</span>
          </button>
        ))}
      </div>

      {/* Variables section */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...M, fontSize: 9, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", color: co.mu, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
          <span>Computed Variables</span>
          <div style={{ flex: 1, height: 1, background: co.bd }} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DEF.variables.map((v, i) => {
            const deps = extractDeps(v.expression);
            const isSel = sel === `v:${v.name}`;
            return (
              <div key={i} onClick={() => onSel(`v:${v.name}`)} style={{
                flex: "1 1 200px", maxWidth: 280,
                border: `1px solid ${isSel ? co.gr : co.bd}`, borderRadius: 4,
                borderLeft: `3px solid ${co.gr}`, padding: "8px 10px",
                cursor: "pointer", background: isSel ? `${co.gr}06` : co.srf,
                transition: "border-color 0.12s",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                  <span style={{ ...M, fontSize: 11, fontWeight: 600, color: co.grT }}>@{v.name}</span>
                  <Pill color={co.mu} sm>scope: {v.scope}</Pill>
                </div>
                <div style={{ ...M, fontSize: 9.5, color: co.mu, padding: "3px 6px", background: co.su, borderRadius: 3, marginBottom: 4, overflowX: "auto", whiteSpace: "nowrap" }}>
                  {v.expression}
                </div>
                {deps.length > 0 && (
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                    <span style={{ ...M, fontSize: 8, color: co.mu }}>deps:</span>
                    {deps.map(d => <Pill key={d} color={co.ac} sm>${d}</Pill>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Binds list */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...M, fontSize: 9, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", color: co.mu, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
          <span>Behavior Binds ({filtered.length})</span>
          <div style={{ flex: 1, height: 1, background: co.bd }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {filtered.map((b, i) => {
            const isExp = expandedBinds[i];
            const allExprs = [b.required && "required", b.relevant && "relevant", b.calculate && "calculate", b.constraint && "constraint", b.readonly && "readonly"].filter(Boolean);
            const deps = [...new Set([...extractDeps(b.required), ...extractDeps(b.relevant), ...extractDeps(b.calculate), ...extractDeps(b.constraint)])];
            const varDeps = [...new Set([...extractVarDeps(b.calculate), ...extractVarDeps(b.constraint), ...extractVarDeps(b.required)])];
            const hasOverrides = b.whitespace || b.excludedValue || b.nonRelevantBehavior || b.disabledDisplay || b.default != null;

            return (
              <div key={i} onClick={() => onSel(b._key)}
                style={{
                  background: co.srf, border: `1px solid ${sel === b._key ? co.ac : co.bd}`,
                  borderRadius: 4, overflow: "hidden", cursor: "pointer",
                  transition: "border-color 0.12s",
                }}>
                {/* Header row */}
                <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", gap: 8 }}>
                  <div onClick={e => { e.stopPropagation(); setExpandedBinds(p => ({ ...p, [i]: !p[i] })); }}
                    style={{ fontSize: 7, color: co.mu, cursor: "pointer", transform: isExp ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0, padding: "2px" }}>▶</div>

                  {/* Path & label */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                      <span style={{ ...U, fontSize: 13, fontWeight: 500 }}>{b._label}</span>
                      <span style={{ ...M, fontSize: 9, color: co.mu }}>{b.path}</span>
                    </div>
                    <div style={{ display: "flex", gap: 3, marginTop: 3, flexWrap: "wrap" }}>
                      {allExprs.map(t => <Pill key={t} color={bindColor[t]} sm>{t}</Pill>)}
                      {hasOverrides && <Pill color={co.mu} sm>overrides</Pill>}
                    </div>
                  </div>

                  {/* Dependency count */}
                  {(deps.length > 0 || varDeps.length > 0) && (
                    <div style={{ ...M, fontSize: 8.5, color: co.mu, textAlign: "right", flexShrink: 0 }}>
                      {deps.length > 0 && <div>{deps.length} field dep{deps.length > 1 ? "s" : ""}</div>}
                      {varDeps.length > 0 && <div style={{ color: co.grT }}>{varDeps.length} var ref{varDeps.length > 1 ? "s" : ""}</div>}
                    </div>
                  )}
                </div>

                {/* Quick preview of primary expression */}
                {!isExp && (
                  <div style={{ padding: "0 12px 8px 30px", ...M, fontSize: 9, color: co.mu }}>
                    {b.calculate && <span style={{ color: co.grT }}>ƒ {b.calculate.length > 50 ? b.calculate.substring(0, 47) + "…" : b.calculate}</span>}
                    {!b.calculate && b.relevant && <span style={{ color: co.loT }}>◈ {humanize(b.relevant)}</span>}
                    {!b.calculate && !b.relevant && b.constraint && <span style={{ color: co.amT }}>⚡ {humanize(b.constraint)}</span>}
                  </div>
                )}

                {/* Expanded detail */}
                {isExp && (
                  <div style={{ borderTop: `1px solid ${co.bd}`, padding: "10px 12px 10px 30px" }}>
                    {b.required && <BindCard type="required" label="Required" human={humanize(b.required)} raw={b.required} />}
                    {b.relevant && <BindCard type="relevant" label="Visible When" human={humanize(b.relevant)} raw={b.relevant} />}
                    {b.calculate && <BindCard type="calculate" label="Calculated" human="Auto-computed from dependencies" raw={b.calculate} />}
                    {b.constraint && <BindCard type="constraint" label="Constraint" human={humanize(b.constraint)} raw={b.constraint} message={b.constraintMessage} />}
                    {b.readonly && <BindCard type="readonly" label="Read-only" human={humanize(b.readonly)} raw={b.readonly} />}

                    {hasOverrides && (
                      <div style={{ border: `1px solid ${co.bd}`, borderRadius: 4, padding: "6px 8px", marginBottom: 4 }}>
                        <div style={{ ...M, fontSize: 8, color: co.mu, fontWeight: 600, letterSpacing: 1, marginBottom: 3 }}>BIND OVERRIDES</div>
                        {b.whitespace && b.whitespace !== "preserve" && <Row label="whitespace" value={b.whitespace} />}
                        {b.excludedValue && <Row label="excludedValue" value={b.excludedValue} />}
                        {b.nonRelevantBehavior && <Row label="nonRelevantBehavior" value={b.nonRelevantBehavior} />}
                        {b.disabledDisplay && <Row label="disabledDisplay" value={b.disabledDisplay} />}
                        {b.default != null && <Row label="default" value={JSON.stringify(b.default)} />}
                      </div>
                    )}

                    {/* Dependency graph */}
                    {(deps.length > 0 || varDeps.length > 0) && (
                      <div style={{ border: `1px solid ${co.bd}`, borderRadius: 4, padding: "6px 8px", marginTop: 2 }}>
                        <div style={{ ...M, fontSize: 8, color: co.mu, fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>DEPENDENCIES</div>
                        {deps.length > 0 && <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 3 }}>
                          <span style={{ ...M, fontSize: 8, color: co.mu }}>fields:</span>
                          {deps.map(d => {
                            const di = ALL.find(x => x.key === d);
                            return <Pill key={d} color={co.ac} sm>${d}{di ? ` (${di.label})` : ""}</Pill>;
                          })}
                        </div>}
                        {varDeps.length > 0 && <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                          <span style={{ ...M, fontSize: 8, color: co.mu }}>vars:</span>
                          {varDeps.map(v => <Pill key={v} color={co.gr} sm>@{v}</Pill>)}
                        </div>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Shapes section */}
      <div>
        <div style={{ ...M, fontSize: 9, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", color: co.mu, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
          <span>Validation Shapes ({DEF.shapes.length})</span>
          <div style={{ flex: 1, height: 1, background: co.bd }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {DEF.shapes.map((sh, i) => {
            const deps = extractDeps(sh.constraint || "");
            const targetItem = ALL.find(x => x.key === sh.target);
            return (
              <div key={i} style={{
                background: co.srf, border: `1px solid ${co.bd}`, borderRadius: 4,
                borderLeft: `3px solid ${sh.severity === "error" ? co.er : co.am}`,
                padding: "10px 14px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                  <Pill color={sh.severity === "error" ? co.er : co.am} sm>{sh.severity}</Pill>
                  <span style={{ ...M, fontSize: 10, fontWeight: 600 }}>{sh.code}</span>
                  <span style={{ ...M, fontSize: 9, color: co.mu }}>→ {sh.target === "#" ? "(form-level)" : `${sh.target}${targetItem ? ` (${targetItem.label})` : ""}`}</span>
                </div>
                <div style={{ ...U, fontSize: 11.5, color: co.ink, lineHeight: 1.4, marginBottom: 6 }}>{sh.message}</div>

                {/* Constraint expression */}
                {sh.constraint && (
                  <div style={{ marginBottom: 4 }}>
                    <div style={{ ...M, fontSize: 8, color: co.mu, marginBottom: 2 }}>CONSTRAINT</div>
                    <div style={{ ...U, fontSize: 11, marginBottom: 2 }}>{humanize(sh.constraint)}</div>
                    <div style={{ ...M, fontSize: 9, color: co.mu, padding: "2px 6px", background: co.su, borderRadius: 2 }}>{sh.constraint}</div>
                  </div>
                )}

                {/* Composition operators */}
                {sh.and && <div style={{ marginBottom: 4 }}>
                  <div style={{ ...M, fontSize: 8, color: co.mu, marginBottom: 2 }}>AND (all must pass)</div>
                  {sh.and.map((expr, j) => <div key={j} style={{ ...M, fontSize: 9.5, color: co.loT, padding: "2px 6px", background: co.loB, borderRadius: 2, marginBottom: 2 }}>{expr}</div>)}
                </div>}
                {sh.or && <div style={{ marginBottom: 4 }}>
                  <div style={{ ...M, fontSize: 8, color: co.mu, marginBottom: 2 }}>OR (at least one must pass)</div>
                  {sh.or.map((expr, j) => <div key={j} style={{ ...M, fontSize: 9.5, color: co.loT, padding: "2px 6px", background: co.loB, borderRadius: 2, marginBottom: 2 }}>{expr}</div>)}
                </div>}

                {/* Metadata row */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                  {sh.activeWhen && <div style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ ...M, fontSize: 8, color: co.lo }}>active:</span><span style={{ ...M, fontSize: 9, color: co.loT }}>{humanize(sh.activeWhen)}</span></div>}
                  {sh.timing && <Pill color={sh.timing === "submit" ? co.am : co.mu} sm>timing: {sh.timing}</Pill>}
                  {sh.context && <Pill color={co.mu} sm>context: {Object.keys(sh.context).length} keys</Pill>}
                </div>

                {deps.length > 0 && <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 4 }}>
                  <span style={{ ...M, fontSize: 8, color: co.mu }}>reads:</span>
                  {deps.map(d => <Pill key={d} color={co.ac} sm>${d}</Pill>)}
                </div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add buttons */}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button style={{ flex: 1, padding: "10px 0", border: `1px dashed ${co.bd}`, borderRadius: 4, background: "transparent", ...M, fontSize: 10.5, color: co.mu, cursor: "pointer" }}
          onMouseOver={e => e.currentTarget.style.borderColor = co.ac} onMouseOut={e => e.currentTarget.style.borderColor = co.bd}>
          + Add Bind
        </button>
        <button style={{ flex: 1, padding: "10px 0", border: `1px dashed ${co.bd}`, borderRadius: 4, background: "transparent", ...M, fontSize: 10.5, color: co.mu, cursor: "pointer" }}
          onMouseOver={e => e.currentTarget.style.borderColor = co.am} onMouseOut={e => e.currentTarget.style.borderColor = co.bd}>
          + Add Shape
        </button>
      </div>
    </div>
  );
}


