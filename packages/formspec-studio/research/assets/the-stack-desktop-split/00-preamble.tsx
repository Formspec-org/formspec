// Preamble (imports, DEF, COMP, FEL, helpers, shared UI)
// Split from the-stack-desktop.tsx — prototype, imports not wired.

import "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');`;
const co = {
  ink: "#0F172A", bg: "#F8FAFC", srf: "#FFFFFF", bd: "#E2E8F0",
  ac: "#2563EB", lo: "#7C3AED", er: "#DC2626", mu: "#64748B",
  su: "#F1F5F9", gr: "#059669", am: "#D97706",
  loT: "#5B21B6", grT: "#065F46", amT: "#92400E",
  loB: "#EDE9FE", grB: "#ECFDF5", amB: "#FFFBEB",
};
const M = { fontFamily: "'JetBrains Mono', monospace" };
const U = { fontFamily: "'Space Grotesk', sans-serif" };

// ═══ FORMSPEC DEFINITION ═══
const DEF = {
  $formspec: "1.0", url: "https://agency.gov/forms/s8-intake", version: "2025.1.0",
  versionAlgorithm: "semver", status: "draft", name: "s8-intake",
  title: "Section 8 HCV — Intake", date: "2025-03-10",
  derivedFrom: { url: "https://hud.gov/forms/hud-50058", version: "2024.1.0" },
  formPresentation: { pageMode: "wizard", labelPosition: "top", density: "comfortable", defaultCurrency: "USD" },
  nonRelevantBehavior: "remove",
  extensions: { "x-agency": { div: "housing" } },
  optionSets: {
    incSrc: { options: [{ value: "emp", label: "Employment" }, { value: "self", label: "Self-Employment" }, { value: "ss", label: "Social Security" }, { value: "other", label: "Other" }] },
    rels: { options: [{ value: "spouse", label: "Spouse" }, { value: "child", label: "Child" }, { value: "parent", label: "Parent" }] },
    states: { source: "https://api.agency.gov/ref/states", valueField: "code", labelField: "name" },
  },
  variables: [
    { name: "totalHHInc", expression: "sum($members[*].mInc)", scope: "#" },
    { name: "elderlyDed", expression: "if($hasElderly, 400, 0)", scope: "inc" },
    { name: "incLimit", expression: "if($hhSize<=4, 62450, 72850)", scope: "#" },
  ],
  instances: {
    ami: { description: "HUD AMI limits", source: "https://api.hud.gov/ami/{{fips}}", static: true, readonly: true, schema: { lim4: "decimal" }, data: { lim4: 62450 } },
    prior: { description: "Prior application", source: "https://agency.gov/api/prior/{{ssn}}", schema: { prev: "boolean" } },
  },
  screener: {
    items: [{ key: "sI", type: "field", label: "Est. Income", dataType: "money" }, { key: "sH", type: "field", label: "HH Size", dataType: "integer" }, { key: "sC", type: "field", label: "Citizenship", dataType: "choice", options: [{ value: "citizen", label: "Citizen" }, { value: "inel", label: "Ineligible" }] }],
    routes: [{ condition: "$sC = 'inel'", target: "https://agency.gov/forms/inel", label: "Ineligible" }, { condition: "true", target: "https://agency.gov/forms/s8", label: "Standard" }],
    binds: [{ path: "sI", required: "true" }, { path: "sH", required: "true", constraint: "$ >= 1 and $ <= 15" }],
  },
  migrations: { from: { "2024.2.0": { description: "Split income", fieldMap: [{ source: "gross", target: "annInc", transform: "preserve" }, { source: "old", target: null, transform: "drop" }], defaults: { evHist: false } } } },
  items: [
    {
      key: "app", type: "group", label: "Applicant Information", labels: { short: "Applicant", pdf: "Section I" },
      presentation: { layout: { page: "Applicant", flow: "grid", columns: 2, collapsible: true }, styleHints: { emphasis: "primary" }, accessibility: { role: "region" } },
      children: [
        { key: "name", type: "field", label: "Full Legal Name", dataType: "string", hint: "First Middle Last", labels: { short: "Name" }, presentation: { widgetHint: "textInput", layout: { colSpan: 2 }, styleHints: { size: "large" } }, extensions: { "x-val": { ocr: true } } },
        { key: "dob", type: "field", label: "Date of Birth", dataType: "date", presentation: { widgetHint: "datePicker" } },
        { key: "ssn", type: "field", label: "SSN", dataType: "string", hint: "XXX-XX-XXXX", semanticType: "us-gov:ssn", presentation: { widgetHint: "password" } },
        { key: "marital", type: "field", label: "Marital Status", dataType: "choice", options: [{ value: "single", label: "Single" }, { value: "married", label: "Married" }], presentation: { widgetHint: "radio" } },
        { key: "state", type: "field", label: "State", dataType: "choice", optionSet: "states", presentation: { widgetHint: "autocomplete" } },
        { key: "priorApp", type: "field", label: "Previously Applied?", dataType: "boolean", prePopulate: { instance: "prior", path: "prev", editable: false }, presentation: { widgetHint: "toggle" } },
      ]
    },
    {
      key: "hh", type: "group", label: "Household", presentation: { layout: { page: "Household" } }, children: [
        { key: "hhSize", type: "field", label: "Household Size", dataType: "integer", initialValue: 1, suffix: "persons", presentation: { widgetHint: "stepper" } },
        { key: "hasDisabled", type: "field", label: "Disabled Member?", dataType: "boolean", initialValue: false },
        { key: "hasElderly", type: "field", label: "Elderly (62+)?", dataType: "boolean" },
        {
          key: "members", type: "group", label: "Members", repeatable: true, minRepeat: 0, maxRepeat: 12, presentation: { layout: { flow: "grid", columns: 4 } }, children: [
            { key: "mName", type: "field", label: "Name", dataType: "string" },
            { key: "mRel", type: "field", label: "Relationship", dataType: "choice", optionSet: "rels" },
            { key: "mInc", type: "field", label: "Monthly Income", dataType: "money", currency: "USD", precision: 2, prefix: "$" },
          ]
        },
      ]
    },
    {
      key: "inc", type: "group", label: "Income & Assets", labels: { short: "Income" }, presentation: { layout: { page: "Financials" } }, children: [
        { key: "iIntro", type: "display", label: "Report all income sources for eligibility.", presentation: { widgetHint: "banner", styleHints: { emphasis: "warning" } } },
        { key: "annInc", type: "field", label: "Gross Annual Income", dataType: "money", currency: "USD", precision: 2, prefix: "$", hint: "All sources" },
        {
          key: "incSrc", type: "field", label: "Primary Source", dataType: "choice", optionSet: "incSrc", presentation: { widgetHint: "radio" },
          children: [{ key: "empName", type: "field", label: "Employer", dataType: "string" }, { key: "empEIN", type: "field", label: "EIN", dataType: "string", semanticType: "us-gov:ein" }]
        },
        { key: "taxRet", type: "field", label: "Tax Returns", dataType: "attachment" },
        { key: "adjInc", type: "field", label: "Adjusted Income", dataType: "money", currency: "USD", prefix: "$", hint: "Auto-calculated" },
      ]
    },
    {
      key: "housing", type: "group", label: "Housing", presentation: { layout: { page: "Housing" } }, children: [
        { key: "addr", type: "field", label: "Address", dataType: "string" },
        { key: "rent", type: "field", label: "Rent", dataType: "money", currency: "USD", prefix: "$" },
        { key: "homeless", type: "field", label: "Homeless?", dataType: "boolean", presentation: { widgetHint: "yesNo", accessibility: { liveRegion: "polite" } } },
        { key: "evHist", type: "field", label: "Prior Eviction?", dataType: "boolean" },
        { key: "evDetail", type: "field", label: "Eviction Details", dataType: "text", presentation: { widgetHint: "textarea" } },
      ]
    },
    {
      key: "rev", type: "group", label: "Review & Submit", presentation: { layout: { page: "Review" } }, children: [
        { key: "revNote", type: "display", label: "False statements may result in denial.", presentation: { widgetHint: "banner", styleHints: { emphasis: "danger" } } },
        { key: "certify", type: "field", label: "I certify all info is true", dataType: "boolean" },
        { key: "sig", type: "field", label: "Signature", dataType: "attachment", presentation: { widgetHint: "signature" } },
      ]
    },
  ],
  binds: [
    { path: "name", required: "true", whitespace: "normalize" },
    { path: "dob", required: "true", constraint: "dateDiff(today(),$,'years')>=18", constraintMessage: "Must be 18+." },
    { path: "ssn", required: "true", constraint: "matches($,'^\\d{3}-\\d{2}-\\d{4}$')", constraintMessage: "XXX-XX-XXXX.", whitespace: "remove" },
    { path: "hhSize", required: "true", constraint: "$>=1 and $<=15" },
    { path: "members[*].mName", required: "true", whitespace: "trim" },
    { path: "members[*].mInc", required: "true", constraint: "moneyAmount($)>=0" },
    { path: "annInc", required: "true", constraint: "moneyAmount($)>=0" },
    { path: "adjInc", calculate: "money(moneyAmount($annInc)-@elderlyDed,'USD')", readonly: "true" },
    { path: "evDetail", relevant: "$evHist=true", required: "$evHist=true", disabledDisplay: "protected", nonRelevantBehavior: "empty", default: "" },
    { path: "addr", relevant: "$homeless!=true", required: "$homeless!=true" },
    { path: "rent", relevant: "$homeless!=true", excludedValue: "null" },
    { path: "taxRet", required: "$incSrc='self' or moneyAmount($annInc)>50000" },
    { path: "empName", relevant: "$incSrc='emp'", required: "$incSrc='emp'" },
    { path: "certify", required: "true", constraint: "$=true", constraintMessage: "Must certify." },
    { path: "sig", required: "true" },
  ],
  shapes: [
    { id: "inc-lim", target: "annInc", severity: "error", constraint: "moneyAmount($annInc)<=@incLimit", message: "Exceeds AMI limit.", code: "INC_AMI", context: { max: "@incLimit" }, activeWhen: "present($annInc)", timing: "continuous" },
    { id: "ast-req", target: "#", severity: "warning", message: "Address or homelessness required.", code: "ADDR", or: ["present($addr)", "$homeless=true"] },
    { id: "hh-match", target: "hhSize", severity: "error", message: "Size≠members+1.", code: "HH_MIS", and: ["$hhSize=count($members[*].mName)+1"], timing: "submit" },
  ],
};

// ═══ COMPONENT DOC (Tier 3) ═══
const COMP = {
  $formspecComponent: "1.0", version: "1.0.0", name: "s8-desktop",
  targetDefinition: { url: DEF.url, compatibleVersions: ">=2025.1.0 <2026.0.0" },
  breakpoints: { sm: 576, md: 768, lg: 1024 },
  tokens: { "color.primary": "#1E40AF", "spacing.md": "16px", "border.radius": "4px" },
  components: {
    AddrBlock: { params: ["pfx", "title"], tree: { component: "Card", title: "{title}", children: [{ component: "TextInput", bind: "{pfx}Addr" }] } },
  },
  tree: {
    component: "Wizard", showProgress: true, children: [
      {
        component: "Page", title: "Applicant", children: [
          {
            component: "Card", title: "Info", children: [
              {
                component: "Grid", columns: 2, gap: "$token.spacing.md", responsive: { sm: { columns: 1 } }, children: [
                  { component: "TextInput", bind: "name", style: { fontWeight: "600" } },
                  { component: "DatePicker", bind: "dob" },
                  { component: "RadioGroup", bind: "marital", columns: 2 },
                  { component: "Select", bind: "state", searchable: true },
                ]
              },
              {
                component: "ConditionalGroup", when: "$priorApp=true", fallback: "No prior app.", children: [
                  { component: "Alert", severity: "info", text: "Prior app found." }
                ]
              },
              { component: "Toggle", bind: "priorApp", onLabel: "Yes", offLabel: "No" },
            ]
          }
        ]
      },
      {
        component: "Page", title: "Household", children: [
          {
            component: "Stack", gap: "$token.spacing.md", children: [
              { component: "NumberInput", bind: "hhSize", min: 1, max: 15, showStepper: true },
              { component: "Divider", label: "Members" },
              { component: "DataTable", bind: "members", showRowNumbers: true, allowAdd: true, allowRemove: true, columns: [{ header: "Name", bind: "mName" }, { header: "Inc", bind: "mInc" }] },
            ]
          }
        ]
      },
      {
        component: "Page", title: "Financials", children: [
          { component: "MoneyInput", bind: "annInc", currency: "USD", min: 0 },
          {
            component: "Collapsible", title: "Docs", defaultOpen: false, children: [
              { component: "FileUpload", bind: "taxRet", accept: "application/pdf", dragDrop: true, multiple: true }
            ]
          },
          { component: "Spacer", size: "$token.spacing.md" },
          { component: "ProgressBar", value: 75, max: 100, showPercent: true, label: "Income ratio" },
        ]
      },
      {
        component: "Page", title: "Housing", children: [
          { component: "Toggle", bind: "homeless" },
          {
            component: "ConditionalGroup", when: "$homeless!=true", children: [
              { component: "TextInput", bind: "addr", maxLines: 2 },
              { component: "MoneyInput", bind: "rent" },
            ]
          },
        ]
      },
      {
        component: "Page", title: "Review", children: [
          { component: "Alert", severity: "error", text: "Review all info.", dismissible: false },
          { component: "Summary", items: [{ label: "Name", bind: "name" }, { label: "Income", bind: "annInc", optionSet: "incSrc" }] },
          { component: "ValidationSummary", source: "submit", jumpLinks: true, showFieldErrors: true, dedupe: true },
          { component: "Heading", level: 3, text: "Certification" },
          { component: "CheckboxGroup", bind: "certify" },
          { component: "Signature", bind: "sig", strokeColor: "#000", height: 150, clearable: true },
          { component: "SubmitButton", label: "Submit", mode: "submit", emitEvent: true, pendingLabel: "Submitting…" },
        ]
      },
    ]
  },
};

// ═══ FEL FUNCTION CATALOG ═══
const FEL = [
  {
    cat: "Aggregate", d: "Array ops — skip nulls", f: [
      ["sum", "(array) → number", "Sum numeric elements"],
      ["count", "(array) → number", "Element count (incl. nulls)"],
      ["countWhere", "(array, predicate) → number", "Count where $ matches"],
      ["avg", "(array) → number", "Arithmetic mean"],
      ["min", "(array) → number", "Smallest value"],
      ["max", "(array) → number", "Largest value"],
    ]
  },
  {
    cat: "String", d: "Text processing", f: [
      ["length", "(string) → number", "Character count"],
      ["contains", "(str, substr) → bool", "Substring check"],
      ["startsWith", "(str, prefix) → bool", "Prefix test"],
      ["endsWith", "(str, suffix) → bool", "Suffix test"],
      ["substring", "(str, start, len?) → str", "Extract (1-based)"],
      ["replace", "(str, find, repl) → str", "Literal replace all"],
      ["upper", "(str) → str", "Uppercase"], ["lower", "(str) → str", "Lowercase"],
      ["trim", "(str) → str", "Strip whitespace"],
      ["matches", "(str, regex) → bool", "Regex test"],
      ["format", "(template, ...args) → str", "Positional {0} {1}"],
    ]
  },
  {
    cat: "Numeric", d: "Math operations", f: [
      ["round", "(num, prec?) → number", "Banker's rounding"],
      ["floor", "(num) → number", "Round down"],
      ["ceil", "(num) → number", "Round up"],
      ["abs", "(num) → number", "Absolute value"],
      ["power", "(base, exp) → number", "Exponentiation"],
    ]
  },
  {
    cat: "Date", d: "Temporal operations", f: [
      ["today", "() → date", "Current date"],
      ["now", "() → dateTime", "Current date+time"],
      ["year", "(date) → num", "Extract year"],
      ["month", "(date) → num", "Extract month"],
      ["day", "(date) → num", "Extract day"],
      ["dateDiff", "(d1, d2, unit) → num", "Difference in days/months/years"],
      ["dateAdd", "(date, amt, unit) → date", "Add/subtract units"],
      ["hours", "(dt) → num", "Extract hour"],
      ["minutes", "(dt) → num", "Extract minute"],
      ["seconds", "(dt) → num", "Extract second"],
      ["time", "(h, m, s) → time", "Construct time"],
      ["timeDiff", "(t1, t2, unit?) → num", "Time difference"],
    ]
  },
  {
    cat: "Logical", d: "Conditionals & null checks", f: [
      ["if", "(cond, then, else) → any", "Short-circuit conditional"],
      ["coalesce", "(...values) → any", "First non-null/empty"],
      ["empty", "(value) → bool", "null, '', or []"],
      ["present", "(value) → bool", "Inverse of empty()"],
      ["selected", "(field, option) → bool", "Choice contains value"],
    ]
  },
  {
    cat: "Type", d: "Checking & casting", f: [
      ["isNumber", "(val) → bool", "Finite number?"],
      ["isString", "(val) → bool", "String?"],
      ["isDate", "(val) → bool", "Valid date?"],
      ["isNull", "(val) → bool", "null or ''"],
      ["typeOf", "(val) → string", "Type name"],
      ["number", "(val) → number", "Cast to number"],
      ["string", "(val) → string", "Cast to string"],
      ["boolean", "(val) → bool", "Cast to boolean"],
      ["date", "(val) → date", "Validate as date"],
    ]
  },
  {
    cat: "Money", d: "Currency-safe arithmetic", f: [
      ["money", "(amt, cur) → money", "Construct money obj"],
      ["moneyAmount", "(money) → number", "Extract amount"],
      ["moneyCurrency", "(money) → string", "Extract currency"],
      ["moneyAdd", "(a, b) → money", "Add (same currency)"],
      ["moneySum", "(array) → money", "Sum money array"],
    ]
  },
  {
    cat: "MIP", d: "Model item property queries", f: [
      ["valid", "($path) → bool", "Zero validation errors?"],
      ["relevant", "($path) → bool", "Is visible/active?"],
      ["readonly", "($path) → bool", "Is readonly?"],
      ["required", "($path) → bool", "Is required?"],
    ]
  },
  {
    cat: "Repeat", d: "Repeat navigation", f: [
      ["prev", "(field) → any", "Previous row's value"],
      ["next", "(field) → any", "Next row's value"],
      ["parent", "(field) → any", "Ancestor field value"],
    ]
  },
];

// ── Helpers ──
function flatItems(items, d = 0, pg = null, pk = null) {
  let r = [];
  for (const i of items) {
    const p = i.presentation?.layout?.page || pg;
    r.push({ ...i, _d: d, _p: p, _k: pk });
    if (i.children) r = r.concat(flatItems(i.children, d + 1, p, i.key));
  }
  return r;
}
const ALL = flatItems(DEF.items);
const PAGES = [...new Set(ALL.filter(i => i._p).map(i => i._p))];

function bindsFor(k) {
  return DEF.binds.filter(b => { const t = b.path.replace(/\[\*\]/g, "").split(".").pop(); return t === k || b.path === k; });
}
function shapesFor(k) { return DEF.shapes.filter(s => s.target === k || s.target === "#"); }

function flatComp(n, d = 0) {
  let r = [{ ...n, _cd: d }];
  if (n.children) for (const ch of n.children) r = r.concat(flatComp(ch, d + 1));
  return r;
}
const CNODES = flatComp(COMP.tree);
const CC = { Page: co.ac, Stack: co.ac, Grid: co.ac, Wizard: co.ac, Spacer: co.ac, Columns: co.ac, Tabs: co.ac, TextInput: co.gr, NumberInput: co.gr, DatePicker: co.gr, Select: co.gr, CheckboxGroup: co.gr, Toggle: co.gr, FileUpload: co.gr, MoneyInput: co.gr, RadioGroup: co.gr, Slider: co.gr, Rating: co.gr, Signature: co.gr, Heading: co.am, Text: co.am, Divider: co.am, Alert: co.am, Summary: co.am, ValidationSummary: co.am, ProgressBar: co.am, SubmitButton: co.am, DataTable: co.am, Badge: co.am, Card: co.lo, Collapsible: co.lo, ConditionalGroup: co.lo, Panel: co.lo, Modal: co.lo, Popover: co.lo };
const CCAT = { [co.ac]: "layout", [co.gr]: "input", [co.am]: "display", [co.lo]: "container" };

const DT = { string: { l: "Text", i: "Aa", c: co.ink }, text: { l: "Long Text", i: "¶", c: co.ink }, integer: { l: "Integer", i: "#", c: co.ac }, boolean: { l: "Yes / No", i: "⊘", c: co.lo }, date: { l: "Date", i: "◷", c: co.am }, choice: { l: "Choice", i: "◉", c: co.gr }, money: { l: "Currency", i: "$", c: co.gr }, attachment: { l: "File", i: "⬆", c: co.mu } };

function humanize(e) {
  if (!e) return ""; if (e === "true") return "Always";
  return e.replace(/\$evHist\s*=\s*true/g, "Eviction = Yes").replace(/\$homeless\s*!=\s*true/g, "Not Homeless").replace(/\$incSrc\s*=\s*'emp'/g, "Employed").replace(/\$incSrc\s*=\s*'self'/g, "Self-Employed").replace(/moneyAmount\(\$annInc\)>50000/g, "Income > $50k").replace(/moneyAmount\(\$annInc\)<=@incLimit/g, "Income ≤ AMI").replace(/moneyAmount\(\$\)>=0/g, "≥ 0").replace(/dateDiff\(.*?\)/g, "Age ≥ 18").replace(/matches\(\$.*?\)/g, "Format ✓").replace(/\$>=1 and \$<=15/g, "1 – 15").replace(/\$=true/g, "Must check").replace(/present\(\$annInc\)/g, "Has income").replace(/present\(\$addr\)/g, "Has address").replace(/ or /g, " OR ").replace(/ and /g, " AND ");
}
function icoFor(item) { if (item.type === "group") return item.repeatable ? "⟳" : "▦"; if (item.type === "display") return "ℹ"; return DT[item.dataType]?.i || "•"; }

// ── Shared UI ──
function Pill({ children, color: cl = co.ac, sm }) {
  return <span style={{ ...M, fontSize: sm ? 8 : 9.5, fontWeight: 500, letterSpacing: 0.3, color: cl, background: `${cl}10`, border: `1px solid ${cl}20`, padding: sm ? "0 4px" : "1px 6px", borderRadius: 3, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 3, lineHeight: sm ? "16px" : "18px" }}>{children}</span>;
}
function Row({ label, value, color: cl }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "2px 0", borderBottom: `1px solid ${co.bd}`, gap: 8 }}><span style={{ ...M, fontSize: 8.5, color: co.mu, flexShrink: 0 }}>{label}</span><span style={{ ...M, fontSize: 9, color: cl || co.ink, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{typeof value === "object" ? JSON.stringify(value) : String(value ?? "")}</span></div>;
}
function Sec({ title, children, mt }) {
  return <div style={{ marginTop: mt ?? 10 }}><div style={{ ...M, fontSize: 8, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", color: co.mu, marginBottom: 5 }}>{title}</div>{children}</div>;
}
function BindCard({ type, label, human, raw, message }) {
  const cls = { required: co.ac, relevant: co.lo, constraint: co.am, calculate: co.gr, readonly: co.mu };
  const cl = cls[type] || co.ac;
  return <div style={{ borderLeft: `3px solid ${cl}`, border: `1px solid ${co.bd}`, borderLeftWidth: 3, borderLeftColor: cl, borderRadius: 4, padding: "6px 8px", marginBottom: 4 }}>
    <div style={{ ...M, fontSize: 8, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: cl, marginBottom: 2 }}>{label}</div>
    <div style={{ ...U, fontSize: 11, color: co.ink, lineHeight: 1.4 }}>{human}</div>
    {raw && raw !== "true" && <div style={{ ...M, fontSize: 9, color: co.mu, marginTop: 3, padding: "2px 6px", background: co.su, borderRadius: 2, overflowX: "auto", whiteSpace: "nowrap" }}>{raw}</div>}
    {message && <div style={{ ...U, fontSize: 10, color: co.mu, fontStyle: "italic", marginTop: 2 }}>"{message}"</div>}
  </div>;
}
function ShapeCard({ shape }) {
  const cl = shape.severity === "error" ? co.er : co.am;
  return <div style={{ border: `1px solid ${cl}20`, borderRadius: 4, padding: "7px 9px", marginBottom: 4, background: `${cl}04` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}><Pill color={cl} sm>{shape.severity}</Pill><span style={{ ...M, fontSize: 8.5, color: co.mu }}>{shape.code}</span></div>
    <div style={{ ...U, fontSize: 11, color: co.ink, lineHeight: 1.4 }}>{shape.message}</div>
    {shape.constraint && <div style={{ ...M, fontSize: 9, color: co.mu, marginTop: 3, padding: "2px 6px", background: co.su, borderRadius: 2 }}>{humanize(shape.constraint)}</div>}
    {shape.activeWhen && <div style={{ ...M, fontSize: 8.5, color: co.lo, marginTop: 2 }}>active: {humanize(shape.activeWhen)}</div>}
    {shape.timing && shape.timing !== "continuous" && <div style={{ ...M, fontSize: 8.5, color: co.mu }}>timing: {shape.timing}</div>}
    {shape.and && <div style={{ ...M, fontSize: 8.5, color: co.mu }}>AND: {JSON.stringify(shape.and)}</div>}
    {shape.or && <div style={{ ...M, fontSize: 8.5, color: co.mu }}>OR: {JSON.stringify(shape.or)}</div>}
    {shape.context && <div style={{ ...M, fontSize: 8, color: co.mu }}>context: {JSON.stringify(shape.context)}</div>}
  </div>;
}

export { ALL, PAGES, DEF, COMP, FEL, co, U, M, FONTS, CC, CCAT, CNODES, DT, ShapeCard, BindCard, Sec, Pill, Row, bindsFor, shapesFor, humanize, icoFor };