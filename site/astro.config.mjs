/** @filedesc Astro configuration for the formspec.org marketing/docs site. */
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://formspec.org",
  // References: use `src/middleware.ts` (HTTP redirect) instead of `redirects` here —
  // Astro static `redirects` emit HTML at the destination and overwrite `public/references/index.html`.
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    format: "directory",
  },
  outDir: "./dist",
  markdown: {
    shikiConfig: {
      theme: "github-light",
      wrap: true,
    },
  },
});
