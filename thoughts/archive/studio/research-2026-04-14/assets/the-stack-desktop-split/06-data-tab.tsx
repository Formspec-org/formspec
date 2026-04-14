/** @filedesc Research prototype: Data tab showing response schema, data sources, and option sets. */
// DATA TAB
// Split from the-stack-desktop.tsx — prototype, imports not wired.
import { useState, useCallback } from "react";

function DataTab({ sel, onSel }) {
  const [sub, setSub] = useState("schema");
  const [mockData, setMockData] = useState(() => {
    const d = {};
    ALL.filter(i => i.type === "field").forEach(i => {
      if (i.dataType === "string" || i.dataType === "text") d[i.key] = "";
      else if (i.dataType === "integer") d[i.key] = i.initialValue ?? null;
      else if (i.dataType === "boolean") d[i.key] = i.initialValue ?? null;
      else if (i.dataType === "date") d[i.key] = null;
      else if (i.dataType === "money") d[i.key] = { amount: null, currency: i.currency || DEF.formPresentation.defaultCurrency };
      else if (i.dataType === "choice") d[i.key] = null;
      else if (i.dataType === "attachment") d[i.key] = null;
      else d[i.key] = null;
    });
    return d;
  });

  const subs = [
    { id: "schema", label: "Response Schema" },
    { id: "sources", label: "Data Sources" },
    { id: "options", label: "Option Sets" },
    { id: "mock", label: "Test Response" },
  ];

  // Build schema tree from items
  function buildSchema(items, depth = 0) {
    return items.map(item => {
      if (item.type === "display") return null;
      const binds = bindsFor(item.key);
      const isCalc = binds.some(b => b.calculate);
      const isReq = binds.some(b => b.required);
      const hasRel = binds.some(b => b.relevant);

      let jsonType = "null";
      if (item.type === "group") jsonType = item.repeatable ? "array<object>" : "object";
      else if (item.dataType === "string" || item.dataType === "text" || item.dataType === "choice" || item.dataType === "date" || item.dataType === "dateTime" || item.dataType === "time" || item.dataType === "uri") jsonType = "string";
      else if (item.dataType === "integer") jsonType = "integer";
      else if (item.dataType === "decimal") jsonType = "number";
      else if (item.dataType === "boolean") jsonType = "boolean";
      else if (item.dataType === "money") jsonType = "{amount, currency}";
      else if (item.dataType === "attachment") jsonType = "{contentType, url}";
      else if (item.dataType === "multiChoice") jsonType = "string[]";

      return (
        <div key={item.key}>
          <div onClick={() => onSel(item.key)} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 8px", paddingLeft: 8 + depth * 18,
            cursor: "pointer", borderRadius: 3,
            background: sel === item.key ? `${co.ac}08` : "transparent",
            borderLeft: sel === item.key ? `2px solid ${co.ac}` : "2px solid transparent",
          }}>
            <span style={{ ...M, fontSize: 10.5, fontWeight: 500, color: co.ac, minWidth: 100 }}>{item.key}</span>
            <span style={{ ...M, fontSize: 9.5, color: co.mu, minWidth: 90 }}>{jsonType}</span>
            <span style={{ ...U, fontSize: 10.5, color: co.ink, flex: 1 }}>{item.label}</span>
            <div style={{ display: "flex", gap: 2 }}>
              {isReq && <Pill color={co.ac} sm>req</Pill>}
              {isCalc && <Pill color={co.gr} sm>calc</Pill>}
              {hasRel && <Pill color={co.lo} sm>cond</Pill>}
            </div>
          </div>
          {item.type === "group" && item.children && buildSchema(item.children, depth + 1)}
        </div>
      );
    }).filter(Boolean);
  }

  // Instance usage scan
  function findInstanceUsages(name) {
    const refs = [];
    DEF.binds.forEach(b => {
      const expr = [b.calculate, b.required, b.relevant, b.constraint].filter(Boolean).join(" ");
      if (expr.includes(`@instance('${name}')`) || expr.includes(`@${name}`)) refs.push({ path: b.path, expr });
    });
    DEF.variables.forEach(v => {
      if (v.expression.includes(`@instance('${name}')`)) refs.push({ path: `@${v.name}`, expr: v.expression });
    });
    return refs;
  }

  // OptionSet usage scan
  function findOptSetUsages(name) {
    return ALL.filter(i => i.optionSet === name).map(i => ({ key: i.key, label: i.label }));
  }

  // Mock data input handler
  const setMock = (key, val) => setMockData(p => ({ ...p, [key]: val }));

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "0 28px 80px" }}>
      <div style={{ padding: "14px 0 6px" }}>
        <div style={{ ...U, fontSize: 16, fontWeight: 600, letterSpacing: -0.4 }}>Data</div>
        <div style={{ ...M, fontSize: 9.5, color: co.mu, marginTop: 2 }}>
          Response shape, external sources, option catalogs, and test data
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${co.bd}`, marginBottom: 12 }}>
        {subs.map(s => (
          <button key={s.id} onClick={() => setSub(s.id)} style={{
            ...U, fontSize: 11.5, padding: "8px 14px", cursor: "pointer",
            fontWeight: sub === s.id ? 600 : 400,
            color: sub === s.id ? co.ac : co.mu,
            background: "transparent", border: "none",
            borderBottom: sub === s.id ? `2px solid ${co.ac}` : "2px solid transparent",
          }}>{s.label}</button>
        ))}
      </div>

      {/* ── RESPONSE SCHEMA ── */}
      {sub === "schema" && <>
        <div style={{ ...U, fontSize: 11.5, color: co.mu, marginBottom: 10, lineHeight: 1.5 }}>
          The JSON structure produced when this form is submitted. Shaped by the item tree — fields produce values, groups produce objects, repeatable groups produce arrays.
        </div>
        <div style={{ border: `1px solid ${co.bd}`, borderRadius: 4, overflow: "hidden", background: co.srf }}>
          {/* Table header */}
          <div style={{ display: "flex", padding: "6px 8px", background: co.su, borderBottom: `1px solid ${co.bd}`, gap: 6 }}>
            <span style={{ ...M, fontSize: 8.5, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: co.mu, minWidth: 100 }}>Key</span>
            <span style={{ ...M, fontSize: 8.5, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: co.mu, minWidth: 90 }}>JSON Type</span>
            <span style={{ ...M, fontSize: 8.5, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: co.mu, flex: 1 }}>Label</span>
            <span style={{ ...M, fontSize: 8.5, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: co.mu }}>Flags</span>
          </div>
          {buildSchema(DEF.items)}
        </div>

        {/* Non-relevant behavior note */}
        <div style={{ marginTop: 10, padding: "8px 12px", background: `${co.lo}06`, border: `1px solid ${co.lo}18`, borderRadius: 4 }}>
          <div style={{ ...M, fontSize: 8.5, color: co.lo, fontWeight: 600, letterSpacing: 1, marginBottom: 2 }}>NON-RELEVANT BEHAVIOR</div>
          <div style={{ ...U, fontSize: 11, color: co.ink, lineHeight: 1.4 }}>
            Default: <strong>{DEF.nonRelevantBehavior}</strong> — non-relevant fields are {DEF.nonRelevantBehavior === "remove" ? "excluded from the response" : DEF.nonRelevantBehavior === "empty" ? "retained but set to null" : "retained with current values"}.
            Per-bind overrides may apply.
          </div>
        </div>
      </>}

      {/* ── DATA SOURCES ── */}
      {sub === "sources" && <>
        <div style={{ ...U, fontSize: 11.5, color: co.mu, marginBottom: 10, lineHeight: 1.5 }}>
          Secondary data sources available to FEL expressions via <span style={{ ...M, fontSize: 10 }}>@instance('name')</span>. Provides lookups, prior-year data, and reference tables.
        </div>
        {Object.entries(DEF.instances).map(([name, inst]) => {
          const usages = findInstanceUsages(name);
          return (
            <div key={name} onClick={() => onSel(`i:${name}`)} style={{
              border: `1px solid ${sel === `i:${name}` ? co.ac : co.bd}`, borderRadius: 4,
              borderLeft: `3px solid ${co.ac}`, padding: "12px 14px", marginBottom: 8,
              background: co.srf, cursor: "pointer", transition: "border-color 0.12s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ ...M, fontSize: 12, fontWeight: 600, color: co.ac }}>@instance('{name}')</span>
                {inst.static && <Pill color={co.gr} sm>static</Pill>}
                <Pill color={co.mu} sm>{inst.readonly !== false ? "readonly" : "writable"}</Pill>
              </div>

              {inst.description && <div style={{ ...U, fontSize: 11.5, color: co.mu, marginBottom: 6 }}>{inst.description}</div>}

              {inst.source && <div style={{ marginBottom: 6 }}>
                <div style={{ ...M, fontSize: 8, color: co.mu, marginBottom: 2 }}>SOURCE URL</div>
                <div style={{ ...M, fontSize: 10, padding: "4px 8px", background: co.su, borderRadius: 3, border: `1px solid ${co.bd}`, wordBreak: "break-all" }}>{inst.source}</div>
              </div>}

              {inst.schema && <div style={{ marginBottom: 6 }}>
                <div style={{ ...M, fontSize: 8, color: co.mu, marginBottom: 3 }}>SCHEMA</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {Object.entries(inst.schema).map(([k, v]) => (
                    <div key={k} style={{ ...M, fontSize: 9.5, padding: "2px 8px", border: `1px solid ${co.bd}`, borderRadius: 3, background: co.su }}>
                      <span style={{ color: co.ink }}>{k}</span><span style={{ color: co.mu }}> : {v}</span>
                    </div>
                  ))}
                </div>
              </div>}

              {inst.data && <div style={{ marginBottom: 6 }}>
                <div style={{ ...M, fontSize: 8, color: co.mu, marginBottom: 2 }}>FALLBACK DATA</div>
                <div style={{ ...M, fontSize: 9.5, padding: "4px 8px", background: co.su, borderRadius: 3, whiteSpace: "pre-wrap" }}>{JSON.stringify(inst.data, null, 2)}</div>
              </div>}

              {usages.length > 0 && <div>
                <div style={{ ...M, fontSize: 8, color: co.mu, marginBottom: 3 }}>REFERENCED BY ({usages.length})</div>
                {usages.map((u, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0", ...M, fontSize: 9.5 }}>
                    <span style={{ color: co.ac, minWidth: 80 }}>{u.path}</span>
                    <span style={{ color: co.mu, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.expr.length > 50 ? u.expr.substring(0, 47) + "…" : u.expr}</span>
                  </div>
                ))}
              </div>}
            </div>
          );
        })}
      </>}

      {/* ── OPTION SETS ── */}
      {sub === "options" && <>
        <div style={{ ...U, fontSize: 11.5, color: co.mu, marginBottom: 10, lineHeight: 1.5 }}>
          Named, reusable option lists for choice and multiChoice fields. Referenced by <span style={{ ...M, fontSize: 10 }}>optionSet</span> on field items.
        </div>
        {Object.entries(DEF.optionSets).map(([name, os]) => {
          const usages = findOptSetUsages(name);
          return (
            <div key={name} onClick={() => onSel(`o:${name}`)} style={{
              border: `1px solid ${sel === `o:${name}` ? co.ac : co.bd}`, borderRadius: 4,
              padding: "12px 14px", marginBottom: 8, background: co.srf,
              cursor: "pointer", transition: "border-color 0.12s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ ...U, fontSize: 13, fontWeight: 600 }}>{name}</span>
                {os.source ? <Pill color={co.ac} sm>external</Pill> : <Pill color={co.mu} sm>{os.options?.length} options</Pill>}
              </div>

              {os.source && <div style={{ marginBottom: 6 }}>
                <div style={{ ...M, fontSize: 8, color: co.mu, marginBottom: 2 }}>EXTERNAL SOURCE</div>
                <div style={{ ...M, fontSize: 10, padding: "4px 8px", background: co.su, borderRadius: 3, border: `1px solid ${co.bd}` }}>{os.source}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                  <div><span style={{ ...M, fontSize: 8, color: co.mu }}>valueField: </span><span style={{ ...M, fontSize: 9, color: co.ac }}>{os.valueField}</span></div>
                  <div><span style={{ ...M, fontSize: 8, color: co.mu }}>labelField: </span><span style={{ ...M, fontSize: 9, color: co.ac }}>{os.labelField}</span></div>
                </div>
              </div>}

              {os.options && <div style={{ marginBottom: 6 }}>
                <div style={{ border: `1px solid ${co.bd}`, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ display: "flex", padding: "4px 8px", background: co.su, borderBottom: `1px solid ${co.bd}` }}>
                    <span style={{ ...M, fontSize: 8, fontWeight: 600, color: co.mu, flex: 1 }}>LABEL</span>
                    <span style={{ ...M, fontSize: 8, fontWeight: 600, color: co.mu, minWidth: 80 }}>VALUE</span>
                  </div>
                  {os.options.map((o, i) => (
                    <div key={i} style={{ display: "flex", padding: "4px 8px", borderBottom: i < os.options.length - 1 ? `1px solid ${co.bd}` : "none" }}>
                      <span style={{ ...U, fontSize: 11.5, flex: 1 }}>{o.label}</span>
                      <span style={{ ...M, fontSize: 10, color: co.mu, minWidth: 80 }}>{o.value}</span>
                    </div>
                  ))}
                </div>
                <button style={{ width: "100%", padding: "7px 0", border: `1px dashed ${co.bd}`, borderRadius: 4, background: "transparent", ...M, fontSize: 10, color: co.mu, cursor: "pointer", marginTop: 4 }}>+ Add Option</button>
              </div>}

              {usages.length > 0 && <div>
                <div style={{ ...M, fontSize: 8, color: co.mu, marginBottom: 3 }}>USED BY ({usages.length} field{usages.length > 1 ? "s" : ""})</div>
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                  {usages.map(u => <Pill key={u.key} color={co.ac} sm>{u.label} ({u.key})</Pill>)}
                </div>
              </div>}
            </div>
          );
        })}
        <button style={{ width: "100%", padding: "10px 0", border: `1px dashed ${co.bd}`, borderRadius: 4, background: "transparent", ...M, fontSize: 10.5, color: co.mu, cursor: "pointer", marginTop: 4 }}
          onMouseOver={e => e.currentTarget.style.borderColor = co.ac} onMouseOut={e => e.currentTarget.style.borderColor = co.bd}>
          + Add Option Set
        </button>
      </>}

      {/* ── TEST RESPONSE ── */}
      {sub === "mock" && <>
        <div style={{ ...U, fontSize: 11.5, color: co.mu, marginBottom: 10, lineHeight: 1.5 }}>
          Enter sample values to preview the response JSON. Calculated fields update based on dependencies. Conditional fields reflect relevance.
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          {/* Input column */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...M, fontSize: 8.5, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", color: co.mu, marginBottom: 6 }}>
              Field Inputs
            </div>
            {ALL.filter(i => i.type === "field").map(item => {
              const d = DT[item.dataType] || { l: "?", i: "?", c: co.mu };
              const b = bindsFor(item.key);
              const isCalc = b.some(x => x.calculate);
              const hasRel = b.some(x => x.relevant);
              const val = mockData[item.key];

              return (
                <div key={item.key} onClick={() => onSel(item.key)} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 8px", marginBottom: 2, borderRadius: 4,
                  background: sel === item.key ? `${co.ac}06` : "transparent",
                  border: `1px solid ${sel === item.key ? co.ac + "30" : "transparent"}`,
                  cursor: "pointer", opacity: hasRel ? 0.7 : 1,
                }}>
                  <span style={{ ...M, fontSize: 9, color: d.c, width: 16, textAlign: "center" }}>{d.i}</span>
                  <span style={{ ...U, fontSize: 11, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>

                  {isCalc ? (
                    <span style={{ ...M, fontSize: 9, color: co.gr, padding: "2px 6px", background: co.grB, borderRadius: 3 }}>ƒx auto</span>
                  ) : item.dataType === "boolean" ? (
                    <div onClick={e => { e.stopPropagation(); setMock(item.key, val === true ? false : val === false ? null : true); }}
                      style={{ ...M, fontSize: 9, padding: "2px 8px", borderRadius: 3, cursor: "pointer", border: `1px solid ${co.bd}`, background: val === true ? `${co.gr}10` : val === false ? `${co.er}08` : co.su, color: val === true ? co.gr : val === false ? co.er : co.mu }}>
                      {val === true ? "true" : val === false ? "false" : "null"}
                    </div>
                  ) : item.dataType === "choice" ? (
                    <select value={val || ""} onClick={e => e.stopPropagation()} onChange={e => setMock(item.key, e.target.value || null)}
                      style={{ ...M, fontSize: 9, padding: "2px 6px", borderRadius: 3, border: `1px solid ${co.bd}`, background: co.su, color: co.ink, maxWidth: 120 }}>
                      <option value="">—</option>
                      {(item.options || DEF.optionSets[item.optionSet]?.options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : item.dataType === "attachment" ? (
                    <span style={{ ...M, fontSize: 9, color: co.mu }}>file</span>
                  ) : (
                    <input value={val?.amount != null ? val.amount : (val ?? "")}
                      onClick={e => e.stopPropagation()}
                      onChange={e => {
                        const v = e.target.value;
                        if (item.dataType === "money") setMock(item.key, { amount: v === "" ? null : Number(v), currency: item.currency || "USD" });
                        else if (item.dataType === "integer") setMock(item.key, v === "" ? null : parseInt(v));
                        else setMock(item.key, v === "" ? null : v);
                      }}
                      placeholder={item.dataType === "money" ? "0.00" : item.dataType === "integer" ? "0" : "…"}
                      style={{ ...M, fontSize: 9, padding: "2px 6px", borderRadius: 3, border: `1px solid ${co.bd}`, background: co.su, color: co.ink, width: 100, textAlign: "right" }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* JSON preview column */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...M, fontSize: 8.5, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", color: co.mu, marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>Response JSON</span>
              <button onClick={() => {
                const el = document.createElement("textarea");
                el.value = JSON.stringify(buildMockResponse(), null, 2);
                document.body.appendChild(el); el.select(); document.execCommand("copy"); document.body.removeChild(el);
              }} style={{ ...M, fontSize: 8, padding: "2px 8px", border: `1px solid ${co.bd}`, borderRadius: 3, background: "transparent", cursor: "pointer", color: co.ac }}>Copy</button>
            </div>
            <div style={{
              ...M, fontSize: 9.5, lineHeight: 1.7,
              padding: "12px 14px", background: "#1E293B", color: "#E2E8F0",
              borderRadius: 4, overflow: "auto", maxHeight: 500,
              whiteSpace: "pre-wrap", wordBreak: "break-all",
            }}>
              {JSON.stringify(buildMockResponse(), null, 2).split("\n").map((line, i) => {
                const indent = line.match(/^\s*/)[0].length;
                const hasKey = line.includes(":");
                const keyMatch = line.match(/"([^"]+)":/);
                if (keyMatch) {
                  const rest = line.substring(line.indexOf(":") + 1);
                  return <div key={i}><span>{" ".repeat(indent)}</span><span style={{ color: "#93C5FD" }}>"{keyMatch[1]}"</span><span style={{ color: "#94A3B8" }}>:</span><span style={{ color: rest.includes('"') ? "#86EFAC" : rest.includes("null") ? "#94A3B8" : rest.includes("true") || rest.includes("false") ? "#C084FC" : "#FCD34D" }}>{rest}</span></div>;
                }
                return <div key={i}>{line}</div>;
              })}
            </div>
          </div>
        </div>
      </>}
    </div>
  );

  function buildMockResponse() {
    const resp = {};
    function processItems(items, target) {
      for (const item of items) {
        if (item.type === "display") continue;
        const b = bindsFor(item.key);
        const hasRel = b.find(x => x.relevant);

        if (hasRel) {
          const expr = hasRel.relevant;
          let skip = false;
          if (expr.includes("$evHist=true") && mockData.evHist !== true) skip = true;
          if (expr.includes("$homeless!=true") && mockData.homeless === true) skip = true;
          if (expr.includes("$incSrc='emp'") && mockData.incSrc !== "emp") skip = true;
          if (skip && DEF.nonRelevantBehavior === "remove") continue;
          if (skip && DEF.nonRelevantBehavior === "empty") { target[item.key] = null; continue; }
        }

        if (item.type === "group") {
          if (item.repeatable) {
            target[item.key] = [];
          } else {
            target[item.key] = {};
            if (item.children) processItems(item.children, target[item.key]);
          }
        } else {
          target[item.key] = mockData[item.key] ?? null;
        }
      }
    }
    processItems(DEF.items, resp);
    return resp;
  }
}


