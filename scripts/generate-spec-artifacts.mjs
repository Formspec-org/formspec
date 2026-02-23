#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const CONFIG_PATH = path.join(SCRIPT_DIR, "spec-artifacts.config.json");
const CHECK_MODE = process.argv.includes("--check");

const state = {
  errors: [],
  writes: 0,
  stale: 0,
};

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function rel(absPath) {
  return toPosix(path.relative(ROOT_DIR, absPath));
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(absPath) {
  return fs.readFileSync(absPath, "utf8");
}

function readJson(absPath) {
  return JSON.parse(readText(absPath));
}

function parseAttributes(text) {
  const attrs = {};
  const re = /([a-zA-Z0-9_-]+)=([^\s]+)/g;
  let match = re.exec(text);
  while (match) {
    attrs[match[1]] = match[2];
    match = re.exec(text);
  }
  return attrs;
}

function escapePointerToken(token) {
  return token.replace(/~/g, "~0").replace(/\//g, "~1");
}

function normalizePointer(pointer) {
  let value = (pointer || "").trim();
  if (value.startsWith("#")) {
    value = value.slice(1);
  }
  if (value === "") {
    return "";
  }
  if (!value.startsWith("/")) {
    throw new Error(`Invalid JSON Pointer "${pointer}" (expected "#/..." or "/...")`);
  }
  return value;
}

function toPointer(pointer) {
  return `#${normalizePointer(pointer)}`;
}

function joinPointer(basePointer, ...tokens) {
  let normalized = normalizePointer(basePointer);
  for (const token of tokens) {
    normalized += `/${escapePointerToken(token)}`;
  }
  return `#${normalized}`;
}

function resolvePointer(document, pointer) {
  const normalized = normalizePointer(pointer);
  if (normalized === "") {
    return document;
  }

  const tokens = normalized.slice(1).split("/");
  let current = document;
  for (const token of tokens) {
    const key = token.replace(/~1/g, "/").replace(/~0/g, "~");
    if (!isObject(current) && !Array.isArray(current)) {
      throw new Error(`Cannot resolve pointer "${pointer}"`);
    }
    if (!(key in current)) {
      throw new Error(`Cannot resolve pointer "${pointer}"`);
    }
    current = current[key];
  }
  return current;
}

function markdownCell(value) {
  const str = String(value ?? "");
  return str.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function shortText(value) {
  if (!value) {
    return "";
  }
  return String(value).replace(/\s+/g, " ").trim();
}

function htmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\$/g, "&#36;")
    .replace(/\|/g, "&#124;");
}

function codeLiteral(value) {
  return `<code>${htmlEscape(value)}</code>`;
}

function typeLabel(node) {
  if (!isObject(node)) {
    return "";
  }
  if (typeof node.type === "string") {
    return node.type;
  }
  if (Array.isArray(node.type)) {
    return node.type.join(", ");
  }
  if (node.const !== undefined) {
    return "const";
  }
  if (Array.isArray(node.enum)) {
    return "enum";
  }
  if (typeof node.$ref === "string") {
    return "$ref";
  }
  if (Array.isArray(node.anyOf) || Array.isArray(node.oneOf) || Array.isArray(node.allOf)) {
    return "composite";
  }
  return "any";
}

function notesLabel(node) {
  if (!isObject(node)) {
    return "";
  }
  const notes = [];
  if (Array.isArray(node.enum)) {
    notes.push(`enum: ${node.enum.map((x) => codeLiteral(JSON.stringify(x))).join(", ")}`);
  }
  if (node.const !== undefined) {
    notes.push(`const: ${codeLiteral(JSON.stringify(node.const))}`);
  }
  if (node.default !== undefined) {
    notes.push(`default: ${codeLiteral(JSON.stringify(node.default))}`);
  }
  if (typeof node.pattern === "string") {
    notes.push(`pattern: ${codeLiteral(node.pattern)}`);
  }
  if (typeof node.$ref === "string") {
    notes.push(`${codeLiteral("$ref")}: ${codeLiteral(node.$ref)}`);
  }
  if (isObject(node["x-lm"]) && node["x-lm"].critical === true) {
    notes.push("critical");
  }
  return notes.join("; ");
}

function buildRowsFromPointer(schema, pointer) {
  const rows = [];
  const normalized = normalizePointer(pointer);
  const node = resolvePointer(schema, pointer);

  let properties = null;
  let requiredSet = new Set();
  let pointerBase = toPointer(pointer);

  if (normalized.endsWith("/properties") && isObject(node)) {
    properties = node;
    const parentPointer = normalized.slice(0, normalized.length - "/properties".length);
    const parentNode = resolvePointer(schema, `#${parentPointer}`);
    if (isObject(parentNode) && Array.isArray(parentNode.required)) {
      requiredSet = new Set(parentNode.required);
    }
    pointerBase = `#${normalized}`;
  } else if (isObject(node) && isObject(node.properties)) {
    properties = node.properties;
    if (Array.isArray(node.required)) {
      requiredSet = new Set(node.required);
    }
    pointerBase = joinPointer(pointer, "properties");
  }

  if (!properties) {
    rows.push({
      pointer: toPointer(pointer),
      field: "(self)",
      type: typeLabel(node),
      required: "",
      notes: notesLabel(node),
      description: shortText(node?.description),
    });
    return rows;
  }

  for (const key of Object.keys(properties).sort()) {
    const child = properties[key];
    rows.push({
      pointer: joinPointer(pointerBase, key),
      field: key,
      type: typeLabel(child),
      required: requiredSet.has(key) ? "yes" : "no",
      notes: notesLabel(child),
      description: shortText(child?.description),
    });
  }

  return rows;
}

function renderSchemaRefBlock(attrs, schemaCache) {
  const schemaAttr = attrs.schema;
  if (!schemaAttr) {
    throw new Error("schema-ref block missing required attribute: schema");
  }
  if (!attrs.pointers) {
    throw new Error("schema-ref block missing required attribute: pointers");
  }

  const schemaAbs = path.resolve(ROOT_DIR, schemaAttr);
  if (!fs.existsSync(schemaAbs)) {
    throw new Error(`schema-ref schema does not exist: ${schemaAttr}`);
  }

  const schema = schemaCache.get(schemaAbs) ?? readJson(schemaAbs);
  schemaCache.set(schemaAbs, schema);

  const rows = [];
  for (const pointer of attrs.pointers.split(",").map((x) => x.trim()).filter(Boolean)) {
    rows.push(...buildRowsFromPointer(schema, pointer));
  }

  const lines = [];
  lines.push(`<!-- generated:schema-ref id=${attrs.id || ""} -->`);
  lines.push("| Pointer | Field | Type | Required | Notes | Description |");
  lines.push("|---|---|---|---|---|---|");
  for (const row of rows) {
    const typeValue = row.type || "—";
    const typeCell = typeValue === "—" ? "—" : codeLiteral(typeValue);
    lines.push(
      `| \`${markdownCell(row.pointer)}\` | \`${markdownCell(row.field)}\` | ${typeCell} | ${markdownCell(row.required || "—")} | ${markdownCell(row.notes || "—")} | ${markdownCell(row.description || "—")} |`
    );
  }
  if (rows.length === 0) {
    lines.push("| _(none)_ |  |  |  |  |  |");
  }
  return lines.join("\n");
}

function applyBlufBlocks(specText, specDir) {
  const blufPattern = /<!--\s*bluf:start\s+([^>]*)-->([\s\S]*?)<!--\s*bluf:end\s*-->/g;
  return specText.replace(blufPattern, (full, attrText) => {
    const attrs = parseAttributes(attrText);
    if (!attrs.file) {
      throw new Error("bluf block missing required attribute: file");
    }
    const blufAbs = path.resolve(specDir, attrs.file);
    if (!fs.existsSync(blufAbs)) {
      throw new Error(`bluf file does not exist: ${rel(blufAbs)}`);
    }
    const blufContent = readText(blufAbs).trimEnd();
    return `<!-- bluf:start file=${attrs.file} -->\n${blufContent}\n<!-- bluf:end -->`;
  });
}

function applySchemaRefBlocks(specText, schemaCache) {
  const schemaRefPattern = /<!--\s*schema-ref:start\s+([^>]*)-->([\s\S]*?)<!--\s*schema-ref:end\s*-->/g;
  return specText.replace(schemaRefPattern, (full, attrText) => {
    const attrs = parseAttributes(attrText);
    const generated = renderSchemaRefBlock(attrs, schemaCache);
    return `<!-- schema-ref:start ${attrText.trim()} -->\n${generated}\n<!-- schema-ref:end -->`;
  });
}

function collectCriticalNodes(schema) {
  const nodes = [];

  function walk(node, pointer, required) {
    if (!isObject(node)) {
      return;
    }

    if (isObject(node["x-lm"]) && node["x-lm"].critical === true) {
      nodes.push({
        pointer,
        required: required ? "yes" : "no",
        description: shortText(node.description),
        examples: node.examples,
        intent: shortText(node["x-lm"].intent),
        node,
      });
    }

    if (isObject(node.properties)) {
      const requiredSet = new Set(Array.isArray(node.required) ? node.required : []);
      for (const key of Object.keys(node.properties).sort()) {
        walk(node.properties[key], joinPointer(pointer, "properties", key), requiredSet.has(key));
      }
    }

    if (isObject(node.$defs)) {
      for (const key of Object.keys(node.$defs).sort()) {
        walk(node.$defs[key], joinPointer(pointer, "$defs", key), false);
      }
    }

    for (const keyword of ["allOf", "anyOf", "oneOf", "prefixItems"]) {
      if (Array.isArray(node[keyword])) {
        for (let i = 0; i < node[keyword].length; i += 1) {
          walk(node[keyword][i], joinPointer(pointer, keyword, String(i)), false);
        }
      }
    }

    if (isObject(node.items)) {
      walk(node.items, joinPointer(pointer, "items"), false);
    }
    if (isObject(node.additionalProperties)) {
      walk(node.additionalProperties, joinPointer(pointer, "additionalProperties"), false);
    }
    if (isObject(node.patternProperties)) {
      for (const key of Object.keys(node.patternProperties).sort()) {
        walk(node.patternProperties[key], joinPointer(pointer, "patternProperties", key), false);
      }
    }
    for (const keyword of ["if", "then", "else", "not"]) {
      if (isObject(node[keyword])) {
        walk(node[keyword], joinPointer(pointer, keyword), false);
      }
    }
  }

  walk(schema, "#", false);
  return nodes.sort((a, b) => a.pointer.localeCompare(b.pointer));
}

function validateCriticalAnnotations(schemaPath, criticalNodes) {
  for (const item of criticalNodes) {
    if (!item.description) {
      state.errors.push(
        `${schemaPath}:${item.pointer} missing required description for x-lm.critical node`
      );
    }
    if (!Array.isArray(item.examples) || item.examples.length === 0) {
      state.errors.push(
        `${schemaPath}:${item.pointer} missing required non-empty examples array for x-lm.critical node`
      );
    }
  }
}

function findTitle(specText, fallback) {
  const titleMatch = specText.match(/^#\s+(.+)$/m);
  return titleMatch ? titleMatch[1].trim() : fallback;
}

function normalizeEssentials(entry, key, options) {
  const list = entry[key];
  const label = key;
  if (!Array.isArray(list)) {
    throw new Error(`entry missing required ${label} array`);
  }
  const normalized = list.map(shortText).filter(Boolean);
  if (normalized.length < options.min || normalized.length > options.max) {
    throw new Error(
      `${label} must contain between ${options.min} and ${options.max} non-empty items`
    );
  }
  return normalized;
}

function renderBullets(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function renderCriticalTable(criticalNodes) {
  const lines = [];
  lines.push("| Pointer | Required | Type | Guidance | Description |");
  lines.push("|---|---|---|---|---|");
  if (criticalNodes.length === 0) {
    lines.push("| _(none)_ |  |  |  |  |");
    return lines.join("\n");
  }
  for (const item of criticalNodes) {
    lines.push(
      `| \`${markdownCell(item.pointer)}\` | ${markdownCell(item.required)} | ${markdownCell(typeLabel(item.node))} | ${markdownCell(item.intent)} | ${markdownCell(item.description)} |`
    );
  }
  return lines.join("\n");
}

function generateLlmDoc(entry, specText, criticalNodes) {
  const specAbs = path.resolve(ROOT_DIR, entry.spec);
  const schemaAbs = path.resolve(ROOT_DIR, entry.schema);
  const specDir = path.dirname(specAbs);

  let blufText = "_No BLUF configured._";
  if (entry.bluf) {
    const blufAbs = path.resolve(ROOT_DIR, entry.bluf);
    if (!fs.existsSync(blufAbs)) {
      throw new Error(`BLUF file does not exist: ${rel(blufAbs)}`);
    }
    blufText = readText(blufAbs).trim();
  } else {
    const marker = specText.match(/<!--\s*bluf:start\s+([^>]*)-->([\s\S]*?)<!--\s*bluf:end\s*-->/);
    if (marker) {
      const attrs = parseAttributes(marker[1]);
      if (attrs.file) {
        const blufAbs = path.resolve(specDir, attrs.file);
        if (fs.existsSync(blufAbs)) {
          blufText = readText(blufAbs).trim();
        }
      }
    }
  }

  const title = findTitle(specText, path.basename(entry.spec));
  const behaviorEssentials = normalizeEssentials(entry, "behaviorEssentials", { min: 3, max: 8 });
  const conformanceEssentials = normalizeEssentials(entry, "conformanceEssentials", {
    min: 2,
    max: 8,
  });
  let semanticCapsuleText = "";
  if (entry.semanticCapsule) {
    const semanticCapsuleAbs = path.resolve(ROOT_DIR, entry.semanticCapsule);
    if (!fs.existsSync(semanticCapsuleAbs)) {
      throw new Error(`Semantic capsule file does not exist: ${rel(semanticCapsuleAbs)}`);
    }
    semanticCapsuleText = readText(semanticCapsuleAbs).trim();
    if (!semanticCapsuleText) {
      throw new Error(`Semantic capsule file is empty: ${entry.semanticCapsule}`);
    }
  }

  const output = [
    `# ${title} (LLM Reference)`,
    "",
    "<!-- Generated by scripts/generate-spec-artifacts.mjs. Do not edit by hand. -->",
    "",
    `Source spec: \`${entry.spec}\``,
    `Source schema: \`${entry.schema}\``,
    "",
    "## Bottom Line Up Front",
    "",
    blufText,
    "",
    "## Critical Schema Fields",
    "",
    renderCriticalTable(criticalNodes),
    "",
    "## Behavioral Essentials",
    "",
    renderBullets(behaviorEssentials),
    "",
  ];

  if (semanticCapsuleText) {
    output.push("## Semantic Capsule", "", semanticCapsuleText, "");
  }

  output.push(
    "## Conformance Essentials",
    "",
    renderBullets(conformanceEssentials),
    ""
  );

  return output.join("\n");
}

function writeOrCheck(absPath, expectedText) {
  const currentText = fs.existsSync(absPath) ? readText(absPath) : null;
  if (currentText === expectedText) {
    return;
  }

  if (CHECK_MODE) {
    state.stale += 1;
    state.errors.push(`stale generated artifact: ${rel(absPath)}`);
    return;
  }

  fs.writeFileSync(absPath, expectedText, "utf8");
  state.writes += 1;
}

function processEntry(entry, schemaCache) {
  const specAbs = path.resolve(ROOT_DIR, entry.spec);
  const schemaAbs = path.resolve(ROOT_DIR, entry.schema);

  if (!fs.existsSync(specAbs)) {
    state.errors.push(`missing spec file: ${entry.spec}`);
    return;
  }
  if (!fs.existsSync(schemaAbs)) {
    state.errors.push(`missing schema file: ${entry.schema}`);
    return;
  }

  const schema = schemaCache.get(schemaAbs) ?? readJson(schemaAbs);
  schemaCache.set(schemaAbs, schema);
  const criticalNodes = collectCriticalNodes(schema);
  validateCriticalAnnotations(entry.schema, criticalNodes);

  let specText = readText(specAbs);
  try {
    specText = applyBlufBlocks(specText, path.dirname(specAbs));
    specText = applySchemaRefBlocks(specText, schemaCache);
  } catch (error) {
    state.errors.push(`${entry.spec}: ${error.message}`);
    return;
  }

  writeOrCheck(specAbs, specText);

  if (entry.llm) {
    try {
      const llmText = generateLlmDoc(entry, specText, criticalNodes);
      const llmAbs = path.resolve(ROOT_DIR, entry.llm);
      writeOrCheck(llmAbs, llmText);
    } catch (error) {
      state.errors.push(`${entry.llm}: ${error.message}`);
    }
  }
}

function main() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`Missing config file: ${rel(CONFIG_PATH)}`);
    process.exit(1);
  }

  const config = readJson(CONFIG_PATH);
  if (!Array.isArray(config.specs) || config.specs.length === 0) {
    console.error(`Invalid config in ${rel(CONFIG_PATH)}: "specs" must be a non-empty array`);
    process.exit(1);
  }

  const schemaCache = new Map();
  for (const entry of config.specs) {
    processEntry(entry, schemaCache);
  }

  if (state.errors.length > 0) {
    console.error("spec artifact generation failed:");
    for (const error of state.errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  if (!CHECK_MODE) {
    console.log(`Updated ${state.writes} generated artifact(s).`);
  } else {
    console.log("Spec artifacts are up to date.");
  }
}

main();
