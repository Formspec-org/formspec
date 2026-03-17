/** @filedesc Research prototype: Preview tab rendering a mock wizard with desktop/tablet/mobile viewports. */
// PREVIEW TAB
// Split from the-stack-desktop.tsx — prototype, imports not wired.
import { useState, useCallback } from "react";

function PreviewTab() {
  const [step, setStep] = useState(0);
  const [collapsed, setCollapsed] = useState({});
  const [viewport, setViewport] = useState("desktop");

  const vpW = { desktop: "100%", tablet: 768, mobile: 375 };

  // Walk the component tree and render a visual preview
  function renderNode(node, depth = 0) {
    if (!node || !node.component) return null;
    const C = node.component;

    // Wizard — render as step container
    if (C === "Wizard") {
      const pages = (node.children || []).filter(c => c.component === "Page");
      const current = pages[step];
      return (
        <div>
          {/* Step indicator */}
          {node.showProgress && (
            <div style={{ display: "flex", alignItems: "center", padding: "16px 0 20px" }}>
              {pages.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center" }}>
                  <div onClick={() => setStep(i)} style={{
                    display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                    padding: "6px 14px", borderRadius: 6,
                    background: i === step ? `${co.ac}0c` : i < step ? `${co.gr}08` : "transparent",
                    border: `1px solid ${i === step ? co.ac + "30" : i < step ? co.gr + "20" : co.bd}`,
                  }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      ...M, fontSize: 11, fontWeight: 600,
                      background: i === step ? co.ac : i < step ? co.gr : co.bd,
                      color: i <= step ? "white" : co.mu,
                    }}>{i < step ? "✓" : i + 1}</span>
                    <span style={{ ...U, fontSize: 12.5, fontWeight: i === step ? 600 : 400, color: i === step ? co.ac : i < step ? co.grT : co.mu }}>{p.title}</span>
                  </div>
                  {i < pages.length - 1 && <div style={{ width: 24, height: 2, background: i < step ? co.gr : co.bd, borderRadius: 1 }} />}
                </div>
              ))}
            </div>
          )}
          {/* Current page */}
          {current && (
            <div>
              {current.title && <div style={{ ...U, fontSize: 20, fontWeight: 700, letterSpacing: -0.5, marginBottom: 4 }}>{current.title}</div>}
              {current.description && <div style={{ ...U, fontSize: 13, color: co.mu, marginBottom: 16, lineHeight: 1.5 }}>{current.description}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {(current.children || []).map((ch, i) => <div key={i}>{renderNode(ch, depth + 1)}</div>)}
              </div>
            </div>
          )}
          {/* Nav buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, paddingTop: 16, borderTop: `1px solid ${co.bd}` }}>
            <button disabled={step === 0} onClick={() => setStep(s => s - 1)} style={{
              ...U, fontSize: 12.5, fontWeight: 500, padding: "8px 20px", borderRadius: 4,
              border: `1px solid ${co.bd}`, background: "transparent", cursor: step === 0 ? "default" : "pointer",
              color: step === 0 ? co.mu : co.ink, opacity: step === 0 ? 0.4 : 1,
            }}>← Back</button>
            <button onClick={() => setStep(s => Math.min(s + 1, pages.length - 1))} style={{
              ...U, fontSize: 12.5, fontWeight: 600, padding: "8px 24px", borderRadius: 4,
              border: "none", background: step === pages.length - 1 ? co.gr : co.ac,
              color: "white", cursor: "pointer",
            }}>{step === pages.length - 1 ? "Submit" : "Continue →"}</button>
          </div>
        </div>
      );
    }

    // Page — shouldn't render standalone in wizard mode, but handle gracefully
    if (C === "Page") {
      return <div>{(node.children || []).map((ch, i) => <div key={i}>{renderNode(ch, depth + 1)}</div>)}</div>;
    }

    // Card
    if (C === "Card") {
      return (
        <div style={{ border: `1px solid ${co.bd}`, borderRadius: 6, background: co.srf, overflow: "hidden" }}>
          {(node.title || node.subtitle) && (
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${co.bd}`, background: co.su }}>
              {node.title && <div style={{ ...U, fontSize: 14, fontWeight: 600 }}>{node.title}</div>}
              {node.subtitle && <div style={{ ...U, fontSize: 11.5, color: co.mu, marginTop: 2 }}>{node.subtitle}</div>}
            </div>
          )}
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
            {(node.children || []).map((ch, i) => <div key={i}>{renderNode(ch, depth + 1)}</div>)}
          </div>
        </div>
      );
    }

    // Grid
    if (C === "Grid") {
      const cols = typeof node.columns === "number" ? node.columns : 2;
      return (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
          {(node.children || []).map((ch, i) => <div key={i}>{renderNode(ch, depth + 1)}</div>)}
        </div>
      );
    }

    // Stack
    if (C === "Stack") {
      const horiz = node.direction === "horizontal";
      return (
        <div style={{ display: "flex", flexDirection: horiz ? "row" : "column", gap: 12 }}>
          {(node.children || []).map((ch, i) => <div key={i} style={{ flex: horiz ? 1 : undefined }}>{renderNode(ch, depth + 1)}</div>)}
        </div>
      );
    }

    // Collapsible
    if (C === "Collapsible") {
      const isOpen = collapsed[node.title] !== undefined ? collapsed[node.title] : (node.defaultOpen !== false);
      return (
        <div style={{ border: `1px solid ${co.bd}`, borderRadius: 6, overflow: "hidden" }}>
          <div onClick={() => setCollapsed(p => ({ ...p, [node.title]: !isOpen }))}
            style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", background: co.su }}>
            <span style={{ ...U, fontSize: 13, fontWeight: 600 }}>{node.title}</span>
            <span style={{ fontSize: 10, color: co.mu, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
          </div>
          {isOpen && <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {(node.children || []).map((ch, i) => <div key={i}>{renderNode(ch, depth + 1)}</div>)}
          </div>}
        </div>
      );
    }

    // ConditionalGroup
    if (C === "ConditionalGroup") {
      return (
        <div style={{ borderLeft: `2px solid ${co.lo}30`, paddingLeft: 12 }}>
          <div style={{ ...M, fontSize: 8, color: co.lo, letterSpacing: 0.5, marginBottom: 6 }}>◈ CONDITIONAL: {node.when}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(node.children || []).map((ch, i) => <div key={i}>{renderNode(ch, depth + 1)}</div>)}
          </div>
        </div>
      );
    }

    // Alert
    if (C === "Alert") {
      const colors = { info: co.ac, success: co.gr, warning: co.am, error: co.er };
      const bgs = { info: `${co.ac}08`, success: `${co.gr}08`, warning: `${co.am}08`, error: `${co.er}08` };
      const cl = colors[node.severity] || co.mu;
      const icons = { info: "ℹ", success: "✓", warning: "⚠", error: "✕" };
      return (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderRadius: 6, background: bgs[node.severity], border: `1px solid ${cl}20` }}>
          <span style={{ fontSize: 13, color: cl, flexShrink: 0, marginTop: 1 }}>{icons[node.severity]}</span>
          <span style={{ ...U, fontSize: 12.5, color: co.ink, lineHeight: 1.5 }}>{node.text}</span>
        </div>
      );
    }

    // Divider
    if (C === "Divider") {
      if (node.label) {
        return <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
          <div style={{ flex: 1, height: 1, background: co.bd }} />
          <span style={{ ...M, fontSize: 9.5, color: co.mu, letterSpacing: 0.5 }}>{node.label}</span>
          <div style={{ flex: 1, height: 1, background: co.bd }} />
        </div>;
      }
      return <div style={{ height: 1, background: co.bd, margin: "4px 0" }} />;
    }

    // Spacer
    if (C === "Spacer") return <div style={{ height: 16 }} />;

    // Heading
    if (C === "Heading") {
      const sizes = { 1: 22, 2: 18, 3: 15, 4: 13, 5: 12, 6: 11 };
      return <div style={{ ...U, fontSize: sizes[node.level] || 15, fontWeight: 600, letterSpacing: -0.3 }}>{node.text}</div>;
    }

    // DataTable — skeleton table
    if (C === "DataTable") {
      const cols = node.columns || [];
      return (
        <div style={{ border: `1px solid ${co.bd}`, borderRadius: 6, overflow: "hidden" }}>
          <div style={{ display: "flex", background: co.su, borderBottom: `1px solid ${co.bd}` }}>
            {node.showRowNumbers && <div style={{ ...M, fontSize: 9, color: co.mu, padding: "8px 10px", minWidth: 36, borderRight: `1px solid ${co.bd}` }}>#</div>}
            {cols.map((col, i) => <div key={i} style={{ ...U, fontSize: 11, fontWeight: 600, color: co.ink, padding: "8px 12px", flex: 1, borderRight: i < cols.length - 1 ? `1px solid ${co.bd}` : "none" }}>{col.header}</div>)}
          </div>
          {[0, 1, 2].map(row => (
            <div key={row} style={{ display: "flex", borderBottom: row < 2 ? `1px solid ${co.bd}` : "none" }}>
              {node.showRowNumbers && <div style={{ ...M, fontSize: 9, color: co.mu, padding: "8px 10px", minWidth: 36, borderRight: `1px solid ${co.bd}` }}>{row + 1}</div>}
              {cols.map((col, i) => <div key={i} style={{ padding: "8px 12px", flex: 1, borderRight: i < cols.length - 1 ? `1px solid ${co.bd}` : "none" }}>
                <div style={{ height: 8, background: co.su, borderRadius: 2, width: `${60 + (row * 13 + i * 17) % 30}%` }} />
              </div>)}
            </div>
          ))}
          {node.allowAdd && <div style={{ padding: "8px 12px", textAlign: "center" }}>
            <span style={{ ...M, fontSize: 10, color: co.ac, cursor: "pointer" }}>+ Add Row</span>
          </div>}
        </div>
      );
    }

    // Summary
    if (C === "Summary") {
      return (
        <div style={{ border: `1px solid ${co.bd}`, borderRadius: 6, overflow: "hidden" }}>
          {(node.items || []).map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", borderBottom: i < node.items.length - 1 ? `1px solid ${co.bd}` : "none", background: i % 2 === 0 ? co.srf : co.su }}>
              <span style={{ ...U, fontSize: 11.5, color: co.mu }}>{item.label}</span>
              <span style={{ ...M, fontSize: 11, color: co.ink }}>—</span>
            </div>
          ))}
        </div>
      );
    }

    // ValidationSummary
    if (C === "ValidationSummary") {
      return (
        <div style={{ border: `1px solid ${co.gr}20`, borderRadius: 6, padding: "12px 14px", background: `${co.gr}06` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14, color: co.gr }}>✓</span>
            <span style={{ ...U, fontSize: 12, color: co.grT, fontWeight: 500 }}>No validation errors</span>
          </div>
        </div>
      );
    }

    // SubmitButton
    if (C === "SubmitButton") {
      return (
        <button style={{
          ...U, fontSize: 14, fontWeight: 600, padding: "12px 32px", borderRadius: 6,
          border: "none", background: co.ac, color: "white", cursor: "pointer",
          width: "100%", textAlign: "center",
        }}>{node.label || "Submit"}</button>
      );
    }

    // ProgressBar
    if (C === "ProgressBar") {
      const pct = Math.round(((node.value || 0) / (node.max || 100)) * 100);
      return (
        <div>
          {node.label && <div style={{ ...U, fontSize: 11, color: co.mu, marginBottom: 4 }}>{node.label}</div>}
          <div style={{ height: 8, background: co.su, borderRadius: 4, overflow: "hidden", border: `1px solid ${co.bd}` }}>
            <div style={{ height: "100%", width: `${pct}%`, background: co.ac, borderRadius: 4, transition: "width 0.3s" }} />
          </div>
          {node.showPercent && <div style={{ ...M, fontSize: 9, color: co.mu, marginTop: 3, textAlign: "right" }}>{pct}%</div>}
        </div>
      );
    }

    // ── Field placeholders ──
    // All input components: TextInput, NumberInput, DatePicker, Select, Toggle, etc.
    const inputTypes = ["TextInput", "NumberInput", "DatePicker", "Select", "CheckboxGroup", "Toggle", "FileUpload", "MoneyInput", "RadioGroup", "Slider", "Rating", "Signature"];
    if (inputTypes.includes(C)) {
      const item = node.bind ? ALL.find(i => i.key === node.bind) : null;
      const label = item?.label || node.bind || C;
      const b = node.bind ? bindsFor(node.bind) : [];
      const isReq = b.some(x => x.required);
      const hint = item?.hint;

      // Widget-specific placeholder rendering
      let placeholder = null;

      if (C === "Toggle") {
        placeholder = (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 36, height: 20, borderRadius: 10, background: co.bd, position: "relative" }}>
              <div style={{ width: 16, height: 16, borderRadius: 8, background: "white", position: "absolute", top: 2, left: 2, boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }} />
            </div>
            {node.offLabel && <span style={{ ...U, fontSize: 11.5, color: co.mu }}>{node.offLabel}</span>}
          </div>
        );
      } else if (C === "Signature") {
        placeholder = (
          <div style={{ height: node.height || 120, border: `1px dashed ${co.bd}`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", background: co.su }}>
            <span style={{ ...U, fontSize: 12, color: co.mu }}>Sign here</span>
          </div>
        );
      } else if (C === "FileUpload") {
        placeholder = (
          <div style={{ padding: "20px", border: `1.5px dashed ${co.bd}`, borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: co.su }}>
            <span style={{ fontSize: 20, color: co.mu }}>⬆</span>
            <span style={{ ...U, fontSize: 11.5, color: co.mu }}>Drag files here or click to browse</span>
            {node.accept && <span style={{ ...M, fontSize: 9, color: co.mu }}>{node.accept}</span>}
          </div>
        );
      } else if (C === "RadioGroup") {
        const opts = item?.options || DEF.optionSets[item?.optionSet]?.options || [];
        const colCount = node.columns || 1;
        placeholder = (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${colCount}, 1fr)`, gap: "6px 16px" }}>
            {opts.slice(0, 6).map((o, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", border: `1.5px solid ${co.bd}`, flexShrink: 0 }} />
                <span style={{ ...U, fontSize: 11.5, color: co.ink }}>{o.label}</span>
              </div>
            ))}
          </div>
        );
      } else if (C === "CheckboxGroup") {
        placeholder = (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${co.bd}`, flexShrink: 0 }} />
            <span style={{ ...U, fontSize: 11.5, color: co.ink }}>{label}</span>
          </div>
        );
      } else if (C === "Select") {
        placeholder = (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", border: `1px solid ${co.bd}`, borderRadius: 4, background: co.srf }}>
            <span style={{ ...U, fontSize: 12, color: co.mu }}>{node.placeholder || "Select…"}</span>
            <span style={{ fontSize: 10, color: co.mu }}>▾</span>
          </div>
        );
      } else if (C === "DatePicker") {
        placeholder = (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", border: `1px solid ${co.bd}`, borderRadius: 4, background: co.srf }}>
            <span style={{ ...U, fontSize: 12, color: co.mu }}>{node.format || "MM/DD/YYYY"}</span>
            <span style={{ fontSize: 11, color: co.mu }}>◷</span>
          </div>
        );
      } else if (C === "MoneyInput") {
        placeholder = (
          <div style={{ display: "flex", alignItems: "center", border: `1px solid ${co.bd}`, borderRadius: 4, overflow: "hidden", background: co.srf }}>
            <div style={{ padding: "8px 10px", background: co.su, borderRight: `1px solid ${co.bd}`, ...M, fontSize: 11, color: co.mu }}>{node.currency || "$"}</div>
            <div style={{ padding: "8px 12px", flex: 1, ...U, fontSize: 12, color: co.mu }}>0.00</div>
          </div>
        );
      } else if (C === "NumberInput") {
        placeholder = (
          <div style={{ display: "flex", alignItems: "center", border: `1px solid ${co.bd}`, borderRadius: 4, overflow: "hidden", background: co.srf }}>
            <div style={{ padding: "8px 12px", flex: 1, ...U, fontSize: 12, color: co.mu }}>0</div>
            {node.showStepper && <div style={{ display: "flex", flexDirection: "column", borderLeft: `1px solid ${co.bd}` }}>
              <div style={{ padding: "2px 8px", borderBottom: `1px solid ${co.bd}`, fontSize: 8, color: co.mu, cursor: "pointer", textAlign: "center" }}>▲</div>
              <div style={{ padding: "2px 8px", fontSize: 8, color: co.mu, cursor: "pointer", textAlign: "center" }}>▼</div>
            </div>}
          </div>
        );
      } else {
        // TextInput default
        const lines = node.maxLines || 1;
        placeholder = (
          <div style={{
            padding: "8px 12px", border: `1px solid ${co.bd}`, borderRadius: 4,
            background: co.srf, minHeight: lines > 1 ? lines * 20 : undefined,
          }}>
            <span style={{ ...U, fontSize: 12, color: co.mu }}>{node.placeholder || hint || "Enter text…"}</span>
          </div>
        );
      }

      // Don't wrap toggles/checkboxes in the label-above pattern
      if (C === "Toggle" || C === "CheckboxGroup") {
        return <div style={{ padding: "2px 0" }}>{placeholder}</div>;
      }

      return (
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
            <span style={{ ...U, fontSize: 12, fontWeight: 500, color: co.ink }}>{label}</span>
            {isReq && <span style={{ color: co.er, fontSize: 12 }}>*</span>}
          </div>
          {hint && C !== "TextInput" && <div style={{ ...U, fontSize: 10.5, color: co.mu, marginBottom: 4 }}>{hint}</div>}
          {placeholder}
        </div>
      );
    }

    // Fallback — unknown component
    return (
      <div style={{ padding: "6px 10px", border: `1px dashed ${co.bd}`, borderRadius: 4, ...M, fontSize: 9.5, color: co.mu }}>
        {C} {node.bind ? `→ ${node.bind}` : ""}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 28px 80px" }}>
      {/* Toolbar */}
      <div style={{ width: "100%", maxWidth: 900, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0 8px" }}>
        <div style={{ ...U, fontSize: 16, fontWeight: 600, letterSpacing: -0.4 }}>Form Preview</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Viewport switcher */}
          {["desktop", "tablet", "mobile"].map(v => (
            <button key={v} onClick={() => setViewport(v)} style={{
              ...M, fontSize: 9, padding: "4px 10px", borderRadius: 4, cursor: "pointer",
              border: `1px solid ${viewport === v ? co.ac + "40" : co.bd}`,
              background: viewport === v ? `${co.ac}08` : "transparent",
              color: viewport === v ? co.ac : co.mu, fontWeight: viewport === v ? 600 : 400,
              textTransform: "capitalize",
            }}>
              {v === "desktop" ? "🖥" : v === "tablet" ? "▭" : "📱"} {v}
            </button>
          ))}
          <div style={{ width: 1, height: 20, background: co.bd, margin: "0 4px" }} />
          <div style={{ ...M, fontSize: 9, color: co.mu }}>
            {viewport === "desktop" ? "100%" : `${vpW[viewport]}px`}
          </div>
        </div>
      </div>

      {/* Preview frame */}
      <div style={{
        width: typeof vpW[viewport] === "number" ? vpW[viewport] : "100%",
        maxWidth: 900, transition: "width 0.3s ease",
        border: `1px solid ${co.bd}`, borderRadius: 8,
        background: co.srf, overflow: "hidden",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      }}>
        {/* Form header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${co.bd}`, background: co.su }}>
          <div style={{ ...U, fontSize: 18, fontWeight: 700, letterSpacing: -0.5, color: co.ink }}>{DEF.title}</div>
          <div style={{ ...U, fontSize: 12, color: co.mu, marginTop: 4, lineHeight: 1.5 }}>{DEF.description}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Pill color={co.ac} sm>{DEF.formPresentation.pageMode}</Pill>
            <Pill color={co.mu} sm>{DEF.formPresentation.density}</Pill>
            <Pill color={co.gr} sm>{DEF.formPresentation.defaultCurrency}</Pill>
          </div>
        </div>

        {/* Form body */}
        <div style={{ padding: "20px 24px 28px" }}>
          {renderNode(COMP.tree)}
        </div>
      </div>
    </div>
  );
}


