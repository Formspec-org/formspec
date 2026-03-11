// PROPERTIES PANEL
// Split from the-stack-desktop.tsx — prototype, imports not wired.
import { useState, useCallback } from "react";

function PropertiesPanel({ sel }) {
  const item = ALL.find(i => i.key === sel);
  const isComp = sel?.startsWith("c:"), isVar = sel?.startsWith("v:"), isInst = sel?.startsWith("i:"), isOpt = sel?.startsWith("o:"), isFel = sel?.startsWith("f:");
  const isScr = DEF.screener.items.some(i => i.key === sel);

  if (!item && !isComp && !isVar && !isInst && !isOpt && !isScr && !isFel) {
    return <div style={{ ...U, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: co.mu, padding: 28 }}>
      <div style={{ width: 44, height: 44, border: `1.5px dashed ${co.bd}`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, opacity: 0.5, fontSize: 18 }}>⬡</div>
      <div style={{ fontSize: 14, textAlign: "center", lineHeight: 1.5 }}>Select an item<br />to inspect</div>
    </div>;
  }

  // Component node
  if (isComp) {
    const n = CNODES[parseInt(sel.replace("c:", ""))]; if (!n) return null;
    const cl = CC[n.component] || co.mu;
    const catName = CCAT[cl] || "custom";
    return <div style={{ ...U, padding: "12px 14px", overflowY: "auto", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
        <Pill color={cl}>{catName}</Pill>
        <span style={{ ...M, fontSize: 15, fontWeight: 600 }}>{n.component}</span>
      </div>
      <Sec title="Props" mt={0}>
        {Object.entries(n).filter(([k]) => !k.startsWith("_") && !["component", "children", "items", "columns"].includes(k)).map(([k, v]) => <Row key={k} label={k} value={v} />)}
      </Sec>
      {n.responsive && <Sec title="Responsive Overrides">{Object.entries(n.responsive).map(([bp, ov]) => <div key={bp} style={{ marginBottom: 3 }}><Pill color={co.ac} sm>{bp}</Pill><div style={{ ...M, fontSize: 12, color: co.mu, marginTop: 2 }}>{JSON.stringify(ov)}</div></div>)}</Sec>}
      {n.accessibility && <Sec title="Accessibility">{Object.entries(n.accessibility).map(([k, v]) => <Row key={k} label={k} value={v} />)}</Sec>}
      {n.style && <Sec title="Style">{Object.entries(n.style).map(([k, v]) => <Row key={k} label={k} value={v} />)}</Sec>}
    </div>;
  }

  // FEL function
  if (isFel) {
    const parts = sel.replace("f:", "").split(":");
    const cat = FEL.find(c => c.cat === parts[0]);
    const fn = cat?.f.find(f => f[0] === parts[1]);
    if (!fn) return null;
    return <div style={{ ...U, padding: "12px 14px" }}>
      <div style={{ ...M, fontSize: 17, fontWeight: 600, color: co.ac, marginBottom: 4 }}>{fn[0]}</div>
      <div style={{ ...M, fontSize: 13, color: co.mu, marginBottom: 8, padding: "5px 8px", background: co.su, borderRadius: 3 }}>{fn[1]}</div>
      <div style={{ ...U, fontSize: 14, color: co.ink, lineHeight: 1.5, marginBottom: 8 }}>{fn[2]}</div>
      <Sec title="Category" mt={0}><Row label="Name" value={cat.cat} /><Row label="Description" value={cat.d} /></Sec>
      <Sec title="Usage Example">
        <div style={{ ...M, fontSize: 12.5, padding: "6px 8px", background: co.su, borderRadius: 3, border: `1px solid ${co.bd}` }}>
          {fn[0] === "sum" && "sum($members[*].mInc)"}
          {fn[0] === "dateDiff" && "dateDiff(today(), $dob, 'years')"}
          {fn[0] === "if" && "if($age >= 18, 'adult', 'minor')"}
          {fn[0] === "moneyAmount" && "moneyAmount($annualIncome)"}
          {fn[0] === "matches" && "matches($ssn, '^\\d{3}-\\d{2}-\\d{4}$')"}
          {fn[0] === "present" && "present($email) or present($phone)"}
          {fn[0] === "coalesce" && "coalesce($preferred, $first, 'Unknown')"}
          {fn[0] === "money" && "money(50000, 'USD')"}
          {!["sum", "dateDiff", "if", "moneyAmount", "matches", "present", "coalesce", "money"].includes(fn[0]) && `${fn[0]}(…)`}
        </div>
      </Sec>
    </div>;
  }

  if (isVar) { const v = DEF.variables.find(x => `v:${x.name}` === sel); return <div style={{ ...U, padding: "12px 14px" }}><Sec title="Variable" mt={0}><Row label="Name" value={`@${v.name}`} color={co.gr} /><Row label="Scope" value={v.scope} /><Row label="Expression" value={v.expression} /></Sec></div>; }
  if (isInst) { const n = sel.replace("i:", ""), inst = DEF.instances[n]; return <div style={{ ...U, padding: "12px 14px", overflowY: "auto", height: "100%" }}><Sec title="Data Source" mt={0}><Row label="Name" value={n} color={co.ac} />{inst.description && <Row label="Description" value={inst.description} />}{inst.source && <Row label="Source" value={inst.source} />}<Row label="Static" value={String(!!inst.static)} /><Row label="Readonly" value={String(inst.readonly !== false)} /></Sec>{inst.schema && <Sec title="Schema">{Object.entries(inst.schema).map(([k, v]) => <Row key={k} label={k} value={v} />)}</Sec>}{inst.data && <Sec title="Fallback Data"><div style={{ ...M, fontSize: 9, background: co.su, borderRadius: 3, padding: "4px 6px", whiteSpace: "pre-wrap" }}>{JSON.stringify(inst.data, null, 2)}</div></Sec>}</div>; }
  if (isOpt) { const n = sel.replace("o:", ""), os = DEF.optionSets[n]; return <div style={{ ...U, padding: "12px 14px", overflowY: "auto", height: "100%" }}><Sec title="Option Set" mt={0}><Row label="Name" value={n} />{os.source && <Row label="Source" value={os.source} />}{os.valueField && <Row label="valueField" value={os.valueField} />}{os.labelField && <Row label="labelField" value={os.labelField} />}</Sec>{os.options && <Sec title={`Options (${os.options.length})`}>{os.options.map((o, i) => <Row key={i} label={o.label} value={o.value} />)}</Sec>}</div>; }
  if (isScr) { const si = DEF.screener.items.find(i => i.key === sel), sb = DEF.screener.binds?.filter(b => b.path === si.key) || []; return <div style={{ ...U, padding: "12px 14px" }}><Sec title="Screener Field" mt={0}><Row label="Label" value={si.label} /><Row label="Key" value={si.key} /><Row label="DataType" value={si.dataType} /></Sec>{sb.length > 0 && <Sec title="Binds">{sb.map((b, i) => <div key={i}>{b.required && <BindCard type="required" label="Required" human={humanize(b.required)} raw={b.required} />}{b.constraint && <BindCard type="constraint" label="Constraint" human={humanize(b.constraint)} raw={b.constraint} />}</div>)}</Sec>}{si.options && <Sec title="Options">{si.options.map((o, i) => <Row key={i} label={o.label} value={o.value} />)}</Sec>}</div>; }

  // Standard item
  const b = bindsFor(item.key), s = shapesFor(item.key), d = item.dataType ? DT[item.dataType] : null, pr = item.presentation;
  return <div style={{ ...U, fontSize: 12, display: "flex", flexDirection: "column", height: "100%" }}>
    <div style={{ padding: "10px 14px", borderBottom: `1px solid ${co.bd}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>{d && <span style={{ width: 22, height: 22, borderRadius: 3, background: `${d.c}10`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: d.c, ...M, fontWeight: 600 }}>{d.i}</span>}<span style={{ fontWeight: 600, fontSize: 15 }}>Properties</span></div>
      <div style={{ ...M, fontSize: 12.5, color: co.mu, marginTop: 3 }}>{item.label}</div>
    </div>
    <div style={{ flex: 1, overflowY: "auto", padding: "0 14px 14px" }}>
      <Sec title="Identity" mt={8}><Row label="Key" value={item.key} /><Row label="Type" value={item.type} />{item.dataType && <Row label="DataType" value={d?.l} color={d?.c} />}{item.semanticType && <Row label="Semantic" value={item.semanticType} color={co.lo} />}{item.optionSet && <Row label="OptionSet" value={item.optionSet} />}</Sec>
      {item.type === "field" && (item.currency || item.precision != null || item.prefix || item.suffix || item.initialValue != null || item.prePopulate) && <Sec title="Field Config">
        {item.currency && <Row label="Currency" value={item.currency} />}{item.precision != null && <Row label="Precision" value={item.precision} />}{item.prefix && <Row label="Prefix" value={`"${item.prefix}"`} />}{item.suffix && <Row label="Suffix" value={`"${item.suffix}"`} />}{item.initialValue != null && <Row label="Initial" value={JSON.stringify(item.initialValue)} />}
        {item.prePopulate && <div style={{ marginTop: 4, border: `1px solid ${co.ac}20`, borderRadius: 4, padding: "6px 8px", background: `${co.ac}04` }}><div style={{ ...M, fontSize: 8, color: co.ac, fontWeight: 600, letterSpacing: 1, marginBottom: 3 }}>PRE-POPULATE</div><Row label="instance" value={item.prePopulate.instance} /><Row label="path" value={item.prePopulate.path} /><Row label="editable" value={String(item.prePopulate.editable)} /></div>}
      </Sec>}
      {item.labels && <Sec title="Alt Labels">{Object.entries(item.labels).map(([k, v]) => <Row key={k} label={k} value={v} />)}</Sec>}
      {pr && <Sec title="Presentation (Tier 1)">{pr.widgetHint && <Row label="widgetHint" value={pr.widgetHint} />}{pr.layout && Object.entries(pr.layout).map(([k, v]) => <Row key={k} label={`layout.${k}`} value={v} />)}{pr.styleHints && Object.entries(pr.styleHints).map(([k, v]) => <Row key={k} label={`style.${k}`} value={v} />)}{pr.accessibility && Object.entries(pr.accessibility).map(([k, v]) => <Row key={k} label={`a11y.${k}`} value={v} />)}</Sec>}
      {b.length > 0 && <Sec title="Behavior Rules">
        {b.map((bd, i) => <div key={i}>
          {bd.required && <BindCard type="required" label="Required" human={humanize(bd.required)} raw={bd.required} />}
          {bd.relevant && <BindCard type="relevant" label="Visible When" human={humanize(bd.relevant)} raw={bd.relevant} />}
          {bd.calculate && <BindCard type="calculate" label="Calculated" human="Auto-computed" raw={bd.calculate} />}
          {bd.constraint && <BindCard type="constraint" label="Constraint" human={humanize(bd.constraint)} raw={bd.constraint} message={bd.constraintMessage} />}
          {bd.readonly && <BindCard type="readonly" label="Read-only" human={humanize(bd.readonly)} raw={bd.readonly} />}
          {(bd.whitespace || bd.excludedValue || bd.nonRelevantBehavior || bd.disabledDisplay || bd.default != null) && <div style={{ border: `1px solid ${co.bd}`, borderRadius: 4, padding: "6px 8px", marginBottom: 4 }}><div style={{ ...M, fontSize: 11, color: co.mu, fontWeight: 600, letterSpacing: 1, marginBottom: 3 }}>BIND OVERRIDES</div>{bd.whitespace && bd.whitespace !== "preserve" && <Row label="whitespace" value={bd.whitespace} />}{bd.excludedValue && <Row label="excludedValue" value={bd.excludedValue} />}{bd.nonRelevantBehavior && <Row label="nonRelevantBehavior" value={bd.nonRelevantBehavior} />}{bd.disabledDisplay && <Row label="disabledDisplay" value={bd.disabledDisplay} />}{bd.default != null && <Row label="default" value={JSON.stringify(bd.default)} />}</div>}
        </div>)}
        <button style={{ width: "100%", padding: "8px 0", border: `1px dashed ${co.bd}`, borderRadius: 4, background: "transparent", ...M, fontSize: 12, color: co.mu, cursor: "pointer", marginTop: 2 }}>+ Add Rule</button>
      </Sec>}
      {s.length > 0 && <Sec title="Validation Shapes">{s.map((sh, i) => <ShapeCard key={i} shape={sh} />)}</Sec>}
      {item.options && <Sec title={`Options (${item.options.length})`}>{item.options.map((o, i) => <Row key={i} label={o.label} value={o.value} />)}<button style={{ width: "100%", padding: "7px 0", border: `1px dashed ${co.bd}`, borderRadius: 4, background: "transparent", ...M, fontSize: 12, color: co.mu, cursor: "pointer", marginTop: 3 }}>+ Add Option</button></Sec>}
      {item.extensions && <Sec title="Extensions">{Object.entries(item.extensions).map(([k, v]) => <Row key={k} label={k} value={v} />)}</Sec>}
      {item.repeatable && <Sec title="Repeat Config"><Row label="Min" value={item.minRepeat ?? 0} /><Row label="Max" value={item.maxRepeat ?? "∞"} /></Sec>}
    </div>
    <div style={{ padding: "8px 14px", borderTop: `1px solid ${co.bd}`, display: "flex", gap: 6 }}>
      <button style={{ flex: 1, padding: "7px 0", border: `1px solid ${co.bd}`, borderRadius: 4, background: "transparent", ...M, fontSize: 11.5, fontWeight: 500, cursor: "pointer", letterSpacing: 0.8, textTransform: "uppercase" }}>Duplicate</button>
      <button style={{ flex: 1, padding: "7px 0", border: `1px solid ${co.er}25`, borderRadius: 4, background: "transparent", ...M, fontSize: 11.5, fontWeight: 500, color: co.er, cursor: "pointer", letterSpacing: 0.8, textTransform: "uppercase" }}>Delete</button>
    </div>
  </div>;
}


