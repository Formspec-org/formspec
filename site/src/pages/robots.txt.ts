import { ROBOTS_DISALLOWED_PATHS, absoluteUrl } from "../lib/seo";

export function GET() {
  const body = [
    "User-agent: *",
    "Allow: /",
    ...ROBOTS_DISALLOWED_PATHS.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
