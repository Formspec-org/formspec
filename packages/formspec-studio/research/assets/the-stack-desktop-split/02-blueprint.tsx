// BLUEPRINT
// Split from the-stack-desktop.tsx — prototype, imports not wired.
import { useState, useCallback } from "react";

function Blueprint({ sel, onSel, page, onPage, section, onSection }) {
  const [expanded, setExpanded] = useState(() => { const e = {}; ALL.filter(i => i.type === "group" && i._d === 0).forEach(i => { e[i.key] = true; }); return e; });
  const [felOpen, setFelOpen] = useState({});
  const toggle = k => setExpanded(p => ({ ...p, [k]: !p[k] }));
  const [childOrder, setChildOrder] = useState({});
  const [compOrder, setCompOrder] = useState(() => CNODES.map((_, i) => i));

  const childOf = k => {
    const kids = ALL.filter(i => i._k === k);
    const order = childOrder[k];
    if (!order) return kids;
    return order.map(key => kids.find(c => c.key === key)).filter(Boolean);
  };
  const reorderChildren = (parentKey, from, to) => {
    setChildOrder(prev => {
      const kids = ALL.filter(i => i._k === parentKey);
      const current = prev[parentKey] || kids.map(i => i.key);
      const next = [...current]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved);
      return { ...prev, [parentKey]: next };
    });
  };
  const reorderComp = (from, to) => {
    setCompOrder(prev => { const n = [...prev]; const [moved] = n.splice(from, 1); n.splice(to, 0, moved); return n; });
  };

  const topGroups = ALL.filter(i => i._p === page && i.type === "group" && i._d === 0);

  const sections = [
    { id: "structure", label: "Structure", count: ALL.filter(i => i.type === "field").length },
    { id: "component", label: "Component Tree", count: CNODES.length },
    { id: "screener", label: "Screener", count: DEF.screener.routes.length },
    { id: "variables", label: "Variables", count: DEF.variables.length },
    { id: "instances", label: "Data Sources", count: Object.keys(DEF.instances).length },
    { id: "optionSets", label: "Option Sets", count: Object.keys(DEF.optionSets).length },
    { id: "migrations", label: "Migrations", count: Object.keys(DEF.migrations?.from || {}).length },
    { id: "fel", label: "FEL Reference", count: FEL.reduce((a, c) => a + c.f.length, 0) },
    { id: "settings", label: "Settings" },
  ];

  // Drag state for tree
  const treeDrag = useDragReorder("tree");
  const compDrag = useDragReorder("comp");

  const TreeNode = ({ item, index, parentKey }) => {
    const isG = item.type === "group", isSel = sel === item.key, kids = childOf(item.key);
    const isDragging = treeDrag.dragIdx === index;
    return <div>
      <DropIndicator active={treeDrag.overIdx === index && treeDrag.dragIdx !== null && treeDrag.dragIdx !== index} />
      <div
        draggable
        onDragStart={treeDrag.onDragStart(index)}
        onDragOver={treeDrag.onDragOver(index)}
        onDragEnd={treeDrag.onDragEnd}
        onDrop={treeDrag.onDrop(index, (from, to) => reorderChildren(parentKey, from, to))}
        onClick={() => { if (isG) toggle(item.key); onSel(item.key); }}
        style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 6px", cursor: "pointer", borderRadius: 3, fontSize: 13, borderLeft: isSel ? `2px solid ${co.ac}` : "2px solid transparent", background: isSel ? `${co.ac}08` : "transparent", opacity: isDragging ? 0.4 : 1, transition: "opacity 0.15s" }}>
        <DragHandle />
        {isG && <span style={{ fontSize: 8, transform: expanded[item.key] ? "rotate(90deg)" : "none", transition: "transform 0.15s", color: co.mu }}>▶</span>}
        <span style={{ fontSize: 12, opacity: 0.5 }}>{icoFor(item)}</span>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: isG ? 500 : 400, color: item.type === "display" ? co.mu : co.ink }}>{item.label}</span>
        {item.repeatable && <Pill color={co.lo} sm>⟳</Pill>}
      </div>
      {isG && expanded[item.key] && <div style={{ marginLeft: 12, borderLeft: `1px solid ${co.bd}`, paddingLeft: 4 }}>{kids.map((k, ki) => <TreeNode key={k.key} item={k} index={ki} parentKey={item.key} />)}</div>}
    </div>;
  };

  return (
    <div style={{ ...U, fontSize: 12, color: co.ink, display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "12px 12px 8px", borderBottom: `1px solid ${co.bd}` }}>
        <div style={{ ...M, fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: co.mu, marginBottom: 6 }}>Blueprint</div>
        {sections.map(s => (
          <div key={s.id} onClick={() => onSection(s.id)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 6px", cursor: "pointer", borderRadius: 3, fontSize: 13, fontWeight: section === s.id ? 600 : 400, background: section === s.id ? co.su : "transparent", color: section === s.id ? co.ink : co.mu, marginBottom: 1 }}>
            <span style={{ flex: 1 }}>{s.label}</span>
            {s.count != null && <Pill color={co.mu} sm>{s.count}</Pill>}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
        {/* STRUCTURE */}
        {section === "structure" && <>
          <div style={{ ...M, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: co.mu, marginBottom: 4 }}>Wizard Pages</div>
          {PAGES.map((p, i) => <div key={p} onClick={() => onPage(p)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 6px", cursor: "pointer", borderRadius: 3, background: page === p ? co.su : "transparent", fontWeight: page === p ? 600 : 400, fontSize: 13, marginBottom: 1 }}><span style={{ ...M, fontSize: 11, color: co.mu, minWidth: 14 }}>{i + 1}</span>{p}</div>)}
          <div style={{ height: 1, background: co.bd, margin: "8px 0" }} />
          <div style={{ ...M, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: co.mu, marginBottom: 4 }}>Items</div>
          {topGroups.map((g, gi) => <TreeNode key={g.key} item={g} index={gi} parentKey={null} />)}
        </>}

        {/* COMPONENT TREE */}
        {section === "component" && <>
          <div style={{ padding: "5px 6px", background: co.su, borderRadius: 3, marginBottom: 6, border: `1px solid ${co.bd}` }}>
            <div style={{ ...M, fontSize: 11, color: co.mu }}>TARGET DEFINITION</div>
            <div style={{ ...M, fontSize: 12, marginTop: 1 }}>{COMP.targetDefinition.compatibleVersions}</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
            {Object.entries({ layout: co.ac, input: co.gr, display: co.am, container: co.lo }).map(([k, v]) => <Pill key={k} color={v} sm>{k}</Pill>)}
          </div>
          {compOrder.map((origIdx, renderIdx) => {
            const n = CNODES[origIdx]; if (!n) return null;
            const cl = CC[n.component] || co.mu;
            const isDragging = compDrag.dragIdx === renderIdx;
            return <div key={origIdx}>
              <DropIndicator active={compDrag.overIdx === renderIdx && compDrag.dragIdx !== null && compDrag.dragIdx !== renderIdx} />
              <div
                draggable
                onDragStart={compDrag.onDragStart(renderIdx)}
                onDragOver={compDrag.onDragOver(renderIdx)}
                onDragEnd={compDrag.onDragEnd}
                onDrop={compDrag.onDrop(renderIdx, reorderComp)}
                onClick={() => onSel(`c:${origIdx}`)}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 4px", paddingLeft: 4 + n._cd * 10, cursor: "pointer", borderRadius: 3, fontSize: 12.5, background: sel === `c:${origIdx}` ? `${cl}08` : "transparent", borderLeft: sel === `c:${origIdx}` ? `2px solid ${cl}` : "2px solid transparent", opacity: isDragging ? 0.4 : 1, transition: "opacity 0.15s" }}>
                <DragHandle />
                <span style={{ ...M, fontSize: 12, fontWeight: 600, color: cl }}>{n.component}</span>
                {n.bind && <span style={{ ...M, fontSize: 11, color: co.mu }}>{n.bind}</span>}
                {n.title && !n.bind && <span style={{ fontSize: 11, color: co.mu, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</span>}
                {n.when && <span style={{ fontSize: 8, color: co.lo }}>◈</span>}
              </div>
            </div>;
          })}
          <div style={{ height: 1, background: co.bd, margin: "8px 0" }} />
          <div style={{ ...M, fontSize: 11, color: co.mu, marginBottom: 3 }}>BREAKPOINTS</div>
          {Object.entries(COMP.breakpoints).map(([k, v]) => <Row key={k} label={k} value={`${v}px`} />)}
          <div style={{ ...M, fontSize: 11, color: co.mu, marginTop: 6, marginBottom: 3 }}>TOKENS ({Object.keys(COMP.tokens).length})</div>
          {Object.entries(COMP.tokens).map(([k, v]) => <Row key={k} label={k} value={v} />)}
          <div style={{ ...M, fontSize: 11, color: co.mu, marginTop: 6, marginBottom: 3 }}>CUSTOM COMPONENTS</div>
          {Object.entries(COMP.components).map(([k, v]) => (
            <div key={k} style={{ border: `1px solid ${co.bd}`, borderRadius: 4, padding: "5px 7px", marginBottom: 3 }}>
              <div style={{ ...M, fontSize: 13, fontWeight: 500 }}>{k}</div>
              <div style={{ display: "flex", gap: 3, marginTop: 2 }}>{v.params.map(p => <Pill key={p} color={co.ac} sm>{`{${p}}`}</Pill>)}</div>
            </div>
          ))}
        </>}

        {/* SCREENER */}
        {section === "screener" && <>
          <div style={{ ...M, fontSize: 11, color: co.mu, marginBottom: 4 }}>SCREENING FIELDS</div>
          {DEF.screener.items.map(si => <div key={si.key} onClick={() => onSel(si.key)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 6px", cursor: "pointer", borderRadius: 3, fontSize: 13, background: sel === si.key ? `${co.ac}08` : "transparent", borderLeft: sel === si.key ? `2px solid ${co.ac}` : "2px solid transparent" }}><span style={{ fontSize: 12, opacity: 0.4 }}>{DT[si.dataType]?.i}</span>{si.label}</div>)}
          <div style={{ ...M, fontSize: 11, color: co.mu, marginTop: 10, marginBottom: 4 }}>ROUTES (first match)</div>
          {DEF.screener.routes.map((r, i) => <div key={i} style={{ padding: "6px 8px", border: `1px solid ${co.bd}`, borderRadius: 4, marginBottom: 3 }}><div style={{ ...U, fontSize: 13, fontWeight: 500 }}>{r.label}</div><div style={{ ...M, fontSize: 12, color: co.loT, marginTop: 2, padding: "3px 6px", background: co.loB, borderRadius: 2, display: "inline-block" }}>{humanize(r.condition)}</div><div style={{ ...M, fontSize: 11, color: co.mu, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>→ {r.target}</div></div>)}
        </>}
        {/* VARIABLES */}
        {section === "variables" && DEF.variables.map((v, i) => <div key={i} onClick={() => onSel(`v:${v.name}`)} style={{ borderLeft: `3px solid ${co.gr}`, border: `1px solid ${co.bd}`, borderRadius: 4, padding: "6px 8px", marginBottom: 4, cursor: "pointer", background: sel === `v:${v.name}` ? `${co.gr}06` : co.srf }}><div style={{ ...M, fontSize: 13, fontWeight: 500, color: co.grT }}>@{v.name}</div><div style={{ ...M, fontSize: 11, color: co.mu, marginTop: 3, padding: "3px 6px", background: co.su, borderRadius: 2 }}>{v.expression}</div><div style={{ marginTop: 3 }}><Pill color={co.mu} sm>scope: {v.scope}</Pill></div></div>)}
        {/* INSTANCES */}
        {section === "instances" && Object.entries(DEF.instances).map(([n, inst]) => <div key={n} onClick={() => onSel(`i:${n}`)} style={{ borderLeft: `3px solid ${co.ac}`, border: `1px solid ${co.bd}`, borderRadius: 4, padding: "6px 8px", marginBottom: 4, cursor: "pointer", background: sel === `i:${n}` ? `${co.ac}06` : co.srf }}><div style={{ ...M, fontSize: 13, fontWeight: 500 }}>@instance('{n}')</div>{inst.description && <div style={{ ...U, fontSize: 12, color: co.mu, marginTop: 2 }}>{inst.description}</div>}<div style={{ display: "flex", gap: 3, marginTop: 3 }}>{inst.static && <Pill color={co.gr} sm>static</Pill>}<Pill color={co.mu} sm>{inst.readonly !== false ? "readonly" : "writable"}</Pill></div>{inst.schema && <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 3 }}>{Object.entries(inst.schema).map(([k, v]) => <Pill key={k} color={co.mu} sm>{k}: {v}</Pill>)}</div>}</div>)}
        {/* OPTION SETS */}
        {section === "optionSets" && Object.entries(DEF.optionSets).map(([n, os]) => <div key={n} onClick={() => onSel(`o:${n}`)} style={{ border: `1px solid ${co.bd}`, borderRadius: 4, padding: "6px 8px", marginBottom: 4, cursor: "pointer", background: sel === `o:${n}` ? `${co.ac}06` : co.srf }}><div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ ...U, fontSize: 13, fontWeight: 500 }}>{n}</span>{os.source ? <Pill color={co.ac} sm>external</Pill> : <Pill color={co.mu} sm>{os.options?.length} opts</Pill>}</div>{os.source && <div style={{ ...M, fontSize: 11, color: co.mu, marginTop: 2 }}>{os.source}</div>}{os.valueField && <div style={{ ...M, fontSize: 11, color: co.mu }}>val: {os.valueField} · lbl: {os.labelField}</div>}{os.options && <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3 }}>{os.options.slice(0, 4).map(o => <Pill key={o.value} color={co.ink} sm>{o.label}</Pill>)}</div>}</div>)}
        {/* MIGRATIONS */}
        {section === "migrations" && Object.entries(DEF.migrations?.from || {}).map(([ver, mg]) => <div key={ver} style={{ border: `1px solid ${co.bd}`, borderRadius: 4, padding: "8px 10px", marginBottom: 4 }}><div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}><Pill color={co.am} sm>from v{ver}</Pill><span style={{ ...M, fontSize: 9, color: co.mu }}>→ v{DEF.version}</span></div><div style={{ ...U, fontSize: 11, marginBottom: 6 }}>{mg.description}</div>{mg.fieldMap.map((fm, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, ...M, fontSize: 9.5, padding: "2px 0" }}><span style={{ color: fm.transform === "drop" ? co.er : co.ink }}>{fm.source}</span><span style={{ color: co.mu }}>→</span><span style={{ color: fm.target ? co.gr : co.er }}>{fm.target || "(dropped)"}</span><Pill color={fm.transform === "drop" ? co.er : fm.transform === "expression" ? co.lo : co.gr} sm>{fm.transform}</Pill></div>)}{mg.defaults && <div style={{ ...M, fontSize: 9, color: co.mu, marginTop: 4 }}>defaults: {JSON.stringify(mg.defaults)}</div>}</div>)}
        {/* FEL REFERENCE */}
        {section === "fel" && <>
          <div style={{ ...U, fontSize: 13, color: co.mu, marginBottom: 6, lineHeight: 1.4 }}>All built-in FEL v1.0 functions. Tap a category to browse signatures.</div>
          {FEL.map((cat, ci) => (
            <div key={ci} style={{ marginBottom: 4 }}>
              <div onClick={() => setFelOpen(p => ({ ...p, [ci]: !p[ci] }))} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 8px", cursor: "pointer", borderRadius: 4, background: felOpen[ci] ? co.su : "transparent", border: `1px solid ${felOpen[ci] ? co.bd : "transparent"}` }}>
                <span style={{ fontSize: 8, transform: felOpen[ci] ? "rotate(90deg)" : "none", transition: "transform 0.15s", color: co.mu }}>▶</span>
                <span style={{ ...U, fontSize: 13.5, fontWeight: 600 }}>{cat.cat}</span>
                <span style={{ ...U, fontSize: 12, color: co.mu, flex: 1 }}>{cat.d}</span>
                <Pill color={co.mu} sm>{cat.f.length}</Pill>
              </div>
              {felOpen[ci] && <div style={{ padding: "4px 0 4px 16px" }}>
                {cat.f.map(([name, sig, desc], fi) => (
                  <div key={fi} onClick={() => onSel(`f:${cat.cat}:${name}`)} style={{ padding: "5px 7px", borderRadius: 3, cursor: "pointer", background: sel === `f:${cat.cat}:${name}` ? `${co.ac}08` : "transparent", borderLeft: sel === `f:${cat.cat}:${name}` ? `2px solid ${co.ac}` : "2px solid transparent", marginBottom: 1 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                      <span style={{ ...M, fontSize: 13, fontWeight: 600, color: co.ac }}>{name}</span>
                      <span style={{ ...M, fontSize: 12, color: co.mu }}>{sig}</span>
                    </div>
                    <div style={{ ...U, fontSize: 12, color: co.mu, marginTop: 1 }}>{desc}</div>
                  </div>
                ))}
              </div>}
            </div>
          ))}
        </>}
        {/* SETTINGS */}
        {section === "settings" && <>
          <Sec title="Definition" mt={0}>{[["$formspec", DEF.$formspec], ["url", DEF.url], ["version", DEF.version], ["algorithm", DEF.versionAlgorithm], ["status", DEF.status], ["name", DEF.name], ["date", DEF.date]].map(([l, v]) => <Row key={l} label={l} value={v} />)}</Sec>
          <Sec title="Presentation">{Object.entries(DEF.formPresentation).map(([k, v]) => <Row key={k} label={k} value={v} />)}</Sec>
          <Sec title="Behavior"><Row label="nonRelevantBehavior" value={DEF.nonRelevantBehavior} /></Sec>
          {DEF.derivedFrom && <Sec title="Lineage"><Row label="url" value={DEF.derivedFrom.url} /><Row label="version" value={DEF.derivedFrom.version} /></Sec>}
          {DEF.extensions && <Sec title="Extensions">{Object.entries(DEF.extensions).map(([k, v]) => <Row key={k} label={k} value={v} />)}</Sec>}
        </>}
      </div>
      <div style={{ padding: "6px 10px", borderTop: `1px solid ${co.bd}`, ...M, fontSize: 11, color: co.mu, display: "flex", gap: 8 }}><span>{ALL.filter(i => i.type === "field").length} fields</span><span>{DEF.binds.length} binds</span><span>{DEF.shapes.length} shapes</span></div>
    </div>
  );
}


