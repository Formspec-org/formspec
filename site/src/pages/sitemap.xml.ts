import { getCollection } from "astro:content";
import { absoluteUrl } from "../lib/seo";

function createUrlTag(loc: string, lastmod?: string) {
  return [
    "  <url>",
    `    <loc>${loc}</loc>`,
    ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
    "  </url>",
  ].join("\n");
}

export async function GET() {
  const posts = await getCollection("blog", ({ data }) => {
    return import.meta.env.PROD ? !data.draft : true;
  });

  const staticPaths = ["/", "/about/", "/architecture/", "/features/", "/blog/"];
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...staticPaths.map((pathname) => createUrlTag(absoluteUrl(pathname))),
    ...posts.map((post) =>
      createUrlTag(
        absoluteUrl(`/blog/${post.id}/`),
        post.data.date.toISOString().split("T")[0],
      ),
    ),
    "</urlset>",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
