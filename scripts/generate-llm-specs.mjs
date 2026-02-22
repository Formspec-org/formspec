#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { toString } from "mdast-util-to-string";

const SPEC_DIR = "specs";
const OMIT_MARKER_RE = /<!--\s*llm:omit\s*-->/i;
const QUICK_REFERENCE_RE = /\bquick\s+reference\b/i;
const SPEC_PART_RE = /^spec-part\d*\.md$/i;

function isMarkdownSourceFile(name) {
  if (!name.endsWith(".md")) {
    return false;
  }
  if (name.endsWith(".llm.md")) {
    return false;
  }
  if (SPEC_PART_RE.test(name)) {
    return false;
  }
  return true;
}

function isOmitMarker(node) {
  return node?.type === "html" && OMIT_MARKER_RE.test(node.value || "");
}

function isQuickReferenceHeading(node) {
  if (!node || node.type !== "heading") {
    return false;
  }
  return QUICK_REFERENCE_RE.test(toString(node).trim());
}

function filterTree(tree) {
  const children = Array.isArray(tree.children) ? tree.children : [];
  const output = [];

  let hasQuickReference = false;
  for (let index = 0; index < children.length; index += 1) {
    const node = children[index];

    if (node.type !== "heading") {
      if (!isOmitMarker(node)) {
        output.push(node);
      }
      continue;
    }

    const quickReference = isQuickReferenceHeading(node);
    if (quickReference) {
      hasQuickReference = true;
    }

    const next = children[index + 1];
    const hasOmitMarker = isOmitMarker(next);

    if (hasOmitMarker && !quickReference) {
      const minDepth = node.depth;
      index += 1; // consume the marker node immediately after the heading

      while (index + 1 < children.length) {
        const lookahead = children[index + 1];
        if (lookahead.type === "heading" && lookahead.depth <= minDepth) {
          break;
        }
        index += 1;
      }
      continue;
    }

    output.push(node);

    if (hasOmitMarker) {
      // Marker should never be emitted in generated llm docs.
      index += 1;
    }
  }

  tree.children = output;
  return { hasQuickReference };
}

async function collectSourceFiles(specRoot) {
  const discovered = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (entry.isFile() && isMarkdownSourceFile(entry.name)) {
        discovered.push(absolutePath);
      }
    }
  }

  await walk(specRoot);
  discovered.sort();
  return discovered;
}

function toLlmPath(sourcePath) {
  return sourcePath.replace(/\.md$/i, ".llm.md");
}

async function readFileIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function main() {
  const check = process.argv.includes("--check");
  const dryRun = process.argv.includes("--dry-run");
  const cwd = process.cwd();
  const specRoot = path.join(cwd, SPEC_DIR);

  const processor = unified()
    .use(remarkParse)
    .use(remarkStringify, {
      bullet: "-",
      closeAtx: false,
      fences: true,
      incrementListMarker: false,
      listItemIndent: "one",
      rule: "-",
      setext: false,
      tightDefinitions: true,
    });

  const files = await collectSourceFiles(specRoot);
  if (files.length === 0) {
    throw new Error(`No markdown source files found under ${SPEC_DIR}/`);
  }

  let changed = 0;
  const changedFiles = [];
  const quickReferenceMissing = [];

  for (const sourcePath of files) {
    const source = await fs.readFile(sourcePath, "utf8");
    const tree = processor.parse(source);
    const { hasQuickReference } = filterTree(tree);
    const generatedTree = processor.runSync(tree);
    let output = processor.stringify(generatedTree);
    if (!output.endsWith("\n")) {
      output += "\n";
    }

    const destinationPath = toLlmPath(sourcePath);
    const before = await readFileIfExists(destinationPath);

    if (before !== output) {
      changed += 1;
      changedFiles.push(path.relative(cwd, destinationPath));
      if (!dryRun && !check) {
        await fs.writeFile(destinationPath, output, "utf8");
      }
    }

    if (!hasQuickReference) {
      quickReferenceMissing.push(path.relative(cwd, sourcePath));
    }
  }

  const mode = check ? "check" : dryRun ? "dry-run" : "write";
  console.log(
    `[generate-llm-specs] mode=${mode} files=${files.length} changed=${changed}`
  );

  if (quickReferenceMissing.length > 0) {
    console.warn(
      `[generate-llm-specs] warning: missing 'Quick Reference' heading in ${quickReferenceMissing.length} source file(s):`
    );
    for (const missingFile of quickReferenceMissing) {
      console.warn(`  - ${missingFile}`);
    }
  }

  if (check && changed > 0) {
    console.error(
      "[generate-llm-specs] check failed: generated llm specs are stale:"
    );
    for (const changedFile of changedFiles) {
      console.error(`  - ${changedFile}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[generate-llm-specs] error: ${error.message}`);
  process.exitCode = 1;
});
