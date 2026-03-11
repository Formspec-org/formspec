// EDITOR BLOCKS
// Split from the-stack-desktop.tsx — prototype, imports not wired.
import { useState, useCallback } from "react";

function GroupBlock({ item, sel, onClick }) {
  const pr = item.presentation;
  return <div style={{ marginTop: item._d === 0 ? 20 : 8 }} onClick={onClick}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0 6px", borderBottom: `2px solid ${co.ink}`, cursor: "pointer" }}>
      <div style={{ width: 3, height: 14, background: sel ? co.ac : co.ink, borderRadius: 1 }} />
      <span style={{ ...M, fontSize: item._d === 0 ? 12.5 : 11.5, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" }}>{item.label}</span>
      {item.repeatable && <Pill color={co.lo} sm>⟳ {item.minRepeat || 0}–{item.maxRepeat || "∞"}</Pill>}
      {item.labels?.short && <Pill color={co.mu} sm>"{item.labels.short}"</Pill>}
      {pr?.layout?.flow && pr.layout.flow !== "stack" && <Pill color={co.ac} sm>{pr.layout.flow}{pr.layout.columns ? `:${pr.layout.columns}` : ""}</Pill>}
      {pr?.styleHints?.emphasis && <Pill color={co.am} sm>{pr.styleHints.emphasis}</Pill>}
    </div>
  </div>;
}

function FieldBlock({ item, sel, onClick }) {
  const b = bindsFor(item.key), s = shapesFor(item.key), d = DT[item.dataType] || { l: "?", i: "?", c: co.mu }, pr = item.presentation;
  const hasCal = b.some(x => x.calculate), hasRel = b.some(x => x.relevant), hasCon = b.some(x => x.constraint), isReq = b.some(x => x.required);
  return <div onClick={onClick} style={{ background: co.srf, border: `${sel ? 2 : 1}px solid ${sel ? co.ac : co.bd}`, borderRadius: 4, cursor: "pointer", marginLeft: item._d > 1 ? (item._d - 1) * 20 : 0, position: "relative" }}>
    {item._d > 1 && <div style={{ position: "absolute", left: -12, top: 0, bottom: 0, borderLeft: `1.5px dashed ${co.bd}` }}><div style={{ position: "absolute", top: "50%", left: -0.75, width: 7, borderBottom: `1.5px dashed ${co.bd}` }} /></div>}
    <div style={{ display: "flex", alignItems: "flex-start", padding: "8px 12px", gap: 8 }}>
      <span style={{ width: 24, height: 24, borderRadius: 4, background: `${d.c}08`, border: `1px solid ${d.c}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: d.c, ...M, fontWeight: 600, flexShrink: 0, marginTop: 1 }}>{d.i}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          <span style={{ ...U, fontSize: 15, fontWeight: 500, letterSpacing: -0.2 }}>{item.label}</span>
          {isReq && <Pill color={co.ac} sm>Required</Pill>}{hasCal && <Pill color={co.gr} sm>ƒx Calc</Pill>}{b.some(x => x.readonly) && <Pill color={co.mu} sm>Read-only</Pill>}
          {item.optionSet && <Pill color={co.ink} sm>↳ {item.optionSet}</Pill>}{item.prePopulate && <Pill color={co.ac} sm>Pre-pop</Pill>}
          {item.initialValue != null && <Pill color={co.mu} sm>init: {JSON.stringify(item.initialValue)}</Pill>}
          {item.currency && <Pill color={co.gr} sm>{item.currency}</Pill>}{item.precision != null && <Pill color={co.mu} sm>.{item.precision}</Pill>}
          {pr?.widgetHint && <Pill color={co.ac} sm>⊞ {pr.widgetHint}</Pill>}
          {s.filter(x => x.target !== "#").map((x, i) => <Pill key={i} color={x.severity === "error" ? co.er : co.am} sm>{x.code}</Pill>)}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 3, ...M, fontSize: 12, color: co.mu }}><span style={{ color: d.c }}>{d.l}</span><span>{item.key}</span>{item.semanticType && <span style={{ color: co.lo }}>{item.semanticType}</span>}{item.prefix && <span>pfx: "{item.prefix}"</span>}{item.suffix && <span>sfx: "{item.suffix}"</span>}</div>
        {item.hint && <div style={{ ...U, fontSize: 13, color: co.mu, marginTop: 3 }}>{item.hint}</div>}
      </div>
    </div>
    {(hasRel || hasCal || hasCon) && <div style={{ borderTop: `1px solid ${co.bd}`, padding: "5px 12px 6px 44px", display: "flex", gap: 10, flexWrap: "wrap", ...M, fontSize: 12 }}>
      {hasRel && <span style={{ color: co.loT }}>◈ {humanize(b.find(x => x.relevant)?.relevant)}</span>}
      {hasCal && <span style={{ color: co.grT }}>ƒ Auto-calculated</span>}
      {hasCon && <span style={{ color: co.amT }}>⚡ Validated</span>}
      {b.some(x => x.whitespace && x.whitespace !== "preserve") && <span style={{ color: co.mu }}>ws: {b.find(x => x.whitespace)?.whitespace}</span>}
      {b.some(x => x.disabledDisplay) && <span style={{ color: co.mu }}>display: {b.find(x => x.disabledDisplay)?.disabledDisplay}</span>}
    </div>}
  </div>;
}

function DisplayBlock({ item, sel, onClick }) {
  const pr = item.presentation;
  return <div onClick={onClick} style={{ padding: "8px 12px", cursor: "pointer", borderRadius: 4, borderLeft: `3px solid ${co.ac}30`, background: sel ? `${co.ac}06` : "transparent", border: `1px solid ${sel ? co.ac : "transparent"}` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ ...M, fontSize: 11, color: co.ac, letterSpacing: 1, textTransform: "uppercase" }}>Display</span>{pr?.widgetHint && <Pill color={co.am} sm>{pr.widgetHint}</Pill>}{pr?.styleHints?.emphasis && <Pill color={co.am} sm>{pr.styleHints.emphasis}</Pill>}</div>
    <div style={{ ...U, fontSize: 14, color: co.ink, lineHeight: 1.45, marginTop: 2 }}>{item.label}</div>
  </div>;
}


