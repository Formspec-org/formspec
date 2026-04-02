/** @filedesc Renders blog-post-newsletter template and creates a Resend broadcast draft. */
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { createElement } from "react";
import { render } from "@react-email/components";
import BlogPostNewsletter from "./blog-post-newsletter.tsx";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID;
const SITE_URL = "https://formspec.org";

if (!RESEND_API_KEY || !RESEND_AUDIENCE_ID) {
  console.error("Missing RESEND_API_KEY or RESEND_AUDIENCE_ID");
  process.exit(1);
}

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npx tsx send-draft.mts <blog-post.md>");
  process.exit(1);
}

// Resolve relative to cwd (not script dir) so ../site/... works from emails/
const absPath = resolve(process.cwd(), filePath);

// ── Parse frontmatter ──────────────────────────────────────────────
const raw = readFileSync(absPath, "utf-8");
const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
if (!fmMatch) {
  console.error("No frontmatter found in", absPath);
  process.exit(1);
}

function parseFrontmatter(block: string): Record<string, string | string[]> {
  const meta: Record<string, string | string[]> = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (m) {
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (val.startsWith("[")) {
        meta[m[1]] = val.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
      } else {
        meta[m[1]] = val;
      }
    }
  }
  return meta;
}

const meta = parseFrontmatter(fmMatch[1]);
const title = (meta.title as string) || "New from the Formspec Blog";
const description = (meta.description as string) || "";
const author = (meta.author as string) || "The Formspec Team";
const tags = Array.isArray(meta.tags) ? meta.tags : [];
const slug = basename(absPath, ".md");
const postUrl = `${SITE_URL}/blog/${slug}/`;

// ── Render React Email template ────────────────────────────────────
const html = await render(
  createElement(BlogPostNewsletter, { title, description, postUrl, author, tags })
);

// ── Create broadcast draft via Resend API ──────────────────────────
const res = await fetch("https://api.resend.com/broadcasts", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${RESEND_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    audience_id: RESEND_AUDIENCE_ID,
    from: "Formspec <updates@formspec.org>",
    subject: title,
    html,
    name: `Blog: ${slug}`,
  }),
});

if (!res.ok) {
  const err = await res.text();
  console.error(`Resend API error (${res.status}):`, err);
  process.exit(1);
}

const data = await res.json();
console.log(`Newsletter draft created: ${data.id}`);
console.log(`Review and send at: https://resend.com/broadcasts`);
