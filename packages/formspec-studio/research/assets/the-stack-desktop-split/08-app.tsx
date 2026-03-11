// APP
// Split from the-stack-desktop.tsx — prototype, imports not wired.
import { useState, useCallback } from "react";

export default function App() {
  const [sel, setSel] = useState("annInc");
  const [page, setPage] = useState("Applicant");
  const [tab, setTab] = useState("Editor");
  const [section, setSection] = useState("structure");
  const pageItems = ALL.filter(i => i._p === page);

  return (
    <div style={{ ...U, height: "100vh", display: "flex", flexDirection: "column", background: co.bg, color: co.ink }}>
      <style>{FONTS}</style>
      <header style={{ height: 50, borderBottom: `1px solid ${co.bd}`, background: co.srf, display: "flex", alignItems: "center", padding: "0 16px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginRight: 22 }}>
          <div style={{ width: 26, height: 26, background: co.ac, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2" y="1.5" width="8" height="2" rx=".4" fill="white" /><rect x="2" y="5" width="8" height="2" rx=".4" fill="white" fillOpacity=".7" /><rect x="2" y="8.5" width="8" height="2" rx=".4" fill="white" fillOpacity=".4" /></svg></div>
          <div><div style={{ fontWeight: 700, fontSize: 15, letterSpacing: -0.4, lineHeight: 1.1 }}>The Stack</div><div style={{ ...M, fontSize: 11, color: co.mu, letterSpacing: 0.4 }}>FORMSPEC {DEF.$formspec} · {DEF.status.toUpperCase()}</div></div>
        </div>
        <        nav style={{ display: "flex", height: "100%", gap: 0 }}>{["Editor", "Logic", "Data", "Preview"].map(t => <button key={t} onClick={() => setTab(t)} style={{ padding: "0 14px", height: "100%", ...U, fontSize: 13, fontWeight: tab === t ? 600 : 400, color: tab === t ? co.ac : co.mu, background: "transparent", border: "none", borderBottom: tab === t ? `2px solid ${co.ac}` : "2px solid transparent", cursor: "pointer" }}>{t}</button>)}</nav>
        <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, background: co.su, border: `1px solid ${co.bd}`, borderRadius: 4, padding: "6px 12px", width: "100%", maxWidth: 280 }}><span style={{ fontSize: 13, color: co.mu }}>🔍</span><span style={{ ...U, fontSize: 13, color: co.mu }}>Search items, rules, FEL…</span><span style={{ ...M, fontSize: 11, color: co.mu, marginLeft: "auto", border: `1px solid ${co.bd}`, borderRadius: 2, padding: "1px 5px" }}>⌘K</span></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button style={{ padding: "5px 12px", border: `1px solid ${co.bd}`, borderRadius: 4, background: "transparent", ...U, fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}>Preview</button>
          <button style={{ padding: "5px 14px", border: "none", borderRadius: 4, background: co.ac, ...U, fontSize: 12.5, fontWeight: 600, color: "white", cursor: "pointer" }}>Publish</button>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#E2D9CF", border: `2px solid ${co.bd}`, marginLeft: 4 }} />
        </div>
      </header>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <aside style={{ width: 230, borderRight: `1px solid ${co.bd}`, background: co.bg, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <Blueprint sel={sel} onSel={setSel} page={page} onPage={setPage} section={section} onSection={setSection} />
        </aside>
        <main style={{ flex: 1, overflowY: "auto", background: co.bg }}>
          {tab === "Editor" && <div style={{ maxWidth: 660, margin: "0 auto", padding: "0 28px 80px" }}>
            <div style={{ padding: "14px 0 4px" }}><div style={{ ...U, fontSize: 17, fontWeight: 600, letterSpacing: -0.4 }}>{DEF.title}</div><div style={{ ...M, fontSize: 12, color: co.mu, marginTop: 2 }}>{DEF.url} · v{DEF.version} · {DEF.formPresentation.pageMode} · {DEF.formPresentation.defaultCurrency}</div></div>
            <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "8px 0 4px" }}>
              {PAGES.map((p, i) => <div key={p} style={{ display: "flex", alignItems: "center" }}>
                <div onClick={() => setPage(p)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", cursor: "pointer", borderRadius: 4, background: page === p ? `${co.ac}0a` : "transparent", border: `1px solid ${page === p ? co.ac + "30" : "transparent"}` }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, ...M, fontWeight: 600, background: page === p ? co.ac : co.bd, color: page === p ? "white" : co.mu }}>{i + 1}</span>
                  <span style={{ ...U, fontSize: 13, fontWeight: page === p ? 600 : 400, color: page === p ? co.ac : co.mu }}>{p}</span>
                </div>
                {i < PAGES.length - 1 && <div style={{ width: 16, height: 1, background: co.bd }} />}
              </div>)}
            </div>
            <div style={{ height: 1, background: co.bd, marginBottom: 4 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {pageItems.map((item, idx) => {
                const s = sel === item.key, oc = () => setSel(item.key);
                const block = item.type === "group"
                  ? <GroupBlock key={item.key} item={item} sel={s} onClick={oc} />
                  : item.type === "display"
                  ? <DisplayBlock key={item.key} item={item} sel={s} onClick={oc} />
                  : <FieldBlock key={item.key} item={item} sel={s} onClick={oc} />;
                return (
                  <div key={item.key}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", item.key);
                      e.currentTarget.style.opacity = "0.35";
                      e.currentTarget.style.transform = "scale(0.98)";
                    }}
                    onDragEnd={e => {
                      e.currentTarget.style.opacity = "1";
                      e.currentTarget.style.transform = "none";
                      document.querySelectorAll("[data-drop-line]").forEach(el => { el.style.height = "0px"; el.style.margin = "0"; });
                    }}
                    onDragOver={e => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      const line = e.currentTarget.querySelector("[data-drop-line]");
                      if (line) { line.style.height = "3px"; line.style.margin = "3px 0"; }
                    }}
                    onDragLeave={e => {
                      const line = e.currentTarget.querySelector("[data-drop-line]");
                      if (line) { line.style.height = "0px"; line.style.margin = "0"; }
                    }}
                    onDrop={e => {
                      e.preventDefault();
                      document.querySelectorAll("[data-drop-line]").forEach(el => { el.style.height = "0px"; el.style.margin = "0"; });
                    }}
                    style={{ transition: "opacity 0.15s, transform 0.15s", cursor: "grab" }}
                  >
                    <div data-drop-line="true" style={{ height: 0, margin: 0, background: co.ac, borderRadius: 2, transition: "all 0.12s" }} />
                    <div style={{ display: "flex", gap: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", padding: "0 2px", opacity: 0.3, flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "0.8"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "0.3"}>
                        <svg width="8" height="16" viewBox="0 0 8 16" fill={co.mu}>
                          <circle cx="2" cy="3" r="1.1"/><circle cx="6" cy="3" r="1.1"/>
                          <circle cx="2" cy="7" r="1.1"/><circle cx="6" cy="7" r="1.1"/>
                          <circle cx="2" cy="11" r="1.1"/><circle cx="6" cy="11" r="1.1"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>{block}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button style={{ marginTop: 14, width: "100%", padding: "11px 0", border: `1px dashed ${co.bd}`, borderRadius: 4, background: "transparent", ...M, fontSize: 12, color: co.mu, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onMouseOver={e => e.currentTarget.style.borderColor = co.ac} onMouseOut={e => e.currentTarget.style.borderColor = co.bd}>+ Add Item</button>
          </div>}
          {tab === "Logic" && <LogicTab sel={sel} onSel={setSel} />}
          {tab === "Data" && <DataTab sel={sel} onSel={setSel} />}
          {tab === "Preview" && <PreviewTab />}
          {tab !== "Editor" && tab !== "Logic" && tab !== "Data" && tab !== "Preview" && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: co.mu, ...U, fontSize: 13 }}>{tab} tab — coming soon</div>}
        </main>
        <aside style={{ width: 270, borderLeft: `1px solid ${co.bd}`, background: co.srf, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <PropertiesPanel sel={sel} />
        </aside>
      </div>
      <footer style={{ height: 26, borderTop: `1px solid ${co.bd}`, background: co.srf, display: "flex", alignItems: "center", padding: "0 16px", justifyContent: "space-between", ...M, fontSize: 8.5, color: co.mu, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: co.gr, boxShadow: `0 0 4px ${co.gr}60` }} />FORMSPEC {DEF.$formspec}</span><span style={{ color: co.bd }}>│</span><span>{DEF.formPresentation.pageMode} · {DEF.formPresentation.defaultCurrency} · {DEF.formPresentation.density}</span><span style={{ color: co.bd }}>│</span><span>{ALL.filter(i => i.type === "field").length} fields · {DEF.binds.length} binds · {DEF.shapes.length} shapes · {DEF.variables.length} vars · {FEL.reduce((a, c) => a + c.f.length, 0)} FEL fns</span></div>
        <span>{DEF.url}</span>
      </footer>
    </div>
  );
}

