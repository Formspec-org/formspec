/** @filedesc HTTP redirects for SPA entries — avoids defineConfig redirects that overwrite static index.html files. */
import { defineMiddleware } from "astro:middleware";

const SPA_REDIRECTS: Record<string, string> = {
  "/references": "/references/index.html",
  "/references/": "/references/index.html",
  "/refrences": "/references/index.html",
  "/refrences/": "/references/index.html",
  "/react": "/react/index.html",
  "/react/": "/react/index.html",
  "/uswds-grant": "/uswds-grant/index.html",
  "/uswds-grant/": "/uswds-grant/index.html",
};

export const onRequest = defineMiddleware((context, next) => {
  const dest = SPA_REDIRECTS[context.url.pathname];
  if (dest) {
    const url = new URL(dest, context.url);
    url.search = context.url.search;
    return Response.redirect(url.toString(), 302);
  }
  return next();
});
