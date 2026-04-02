import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const distDir = path.resolve("dist");

function readFile(relativePath) {
  return fs.readFileSync(path.join(distDir, relativePath), "utf8");
}

function assertExists(relativePath) {
  const fullPath = path.join(distDir, relativePath);
  assert.ok(fs.existsSync(fullPath), `Missing required SEO artifact: ${relativePath}`);
  return fullPath;
}

function assertIncludes(text, fragment, context) {
  assert.ok(text.includes(fragment), `Expected ${context} to include: ${fragment}`);
}

function assertMatches(text, pattern, context) {
  assert.ok(pattern.test(text), `Expected ${context} to match: ${pattern}`);
}

assertExists("robots.txt");
assertExists("sitemap.xml");
assertExists("og-default.png");

const robots = readFile("robots.txt");
assertIncludes(robots, "Sitemap: https://formspec.org/sitemap.xml", "robots.txt");
assertIncludes(robots, "Disallow: /pitch/", "robots.txt");
assertIncludes(robots, "Disallow: /react/", "robots.txt");
assertIncludes(robots, "Disallow: /references/", "robots.txt");
assertIncludes(robots, "Disallow: /uswds-grant/", "robots.txt");

const sitemap = readFile("sitemap.xml");
assertIncludes(sitemap, "<loc>https://formspec.org/</loc>", "sitemap.xml");
assertIncludes(sitemap, "<loc>https://formspec.org/about/</loc>", "sitemap.xml");
assertIncludes(sitemap, "<loc>https://formspec.org/blog/</loc>", "sitemap.xml");
assertIncludes(sitemap, "<loc>https://formspec.org/blog/how-we-built-formspec/</loc>", "sitemap.xml");
assert.ok(
  !sitemap.includes("https://formspec.org/blog/tags/"),
  "Expected sitemap.xml to exclude blog tag archive pages",
);

const home = readFile("index.html");
assertMatches(home, /<link rel="canonical" href="https:\/\/formspec\.org\/"/, "home page");
assertMatches(
  home,
  /<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"/,
  "home page",
);
assertMatches(home, /<meta property="og:image" content="https:\/\/formspec\.org\/og-default\.png"/, "home page");
assertMatches(home, /<script type="application\/ld\+json">/, "home page");
assertIncludes(home, '"@type":"WebSite"', "home page structured data");
assertIncludes(home, '"@type":"Organization"', "home page structured data");

const post = readFile("blog/how-we-built-formspec/index.html");
assertMatches(post, /<meta property="og:type" content="article"/, "blog post");
assertMatches(post, /<meta property="article:published_time" content="/, "blog post");
assertIncludes(post, '"@type":"BlogPosting"', "blog post structured data");

const tagArchive = readFile("blog/tags/ai/index.html");
assertMatches(tagArchive, /<meta name="robots" content="noindex, follow"/, "tag archive");

const notFound = readFile("404.html");
assertMatches(notFound, /<meta name="robots" content="noindex, follow"/, "404 page");

console.log("SEO smoke checks passed.");
