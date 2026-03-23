/** @filedesc HTTP redirect to the references SPA entry — avoids defineConfig redirects, which emit HTML at /references/* and overwrite public/references/index.html. */
import { defineMiddleware } from "astro:middleware";

const REFERENCES_ALIASES = new Set([
  "/references",
  "/references/",
  "/refrences",
  "/refrences/",
]);

export const onRequest = defineMiddleware((context, next) => {
  if (REFERENCES_ALIASES.has(context.url.pathname)) {
    const dest = new URL("/references/index.html", context.url);
    dest.search = context.url.search;
    return Response.redirect(dest.toString(), 302);
  }
  return next();
});
