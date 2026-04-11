# Formspec Website — Astro Rebuild

**Date:** 2026-03-16
**Status:** Draft

## Summary

Replace the monolithic 3000-line `site/index.html` with an Astro 5.x site that supports a blog, is maintainable, and integrates into the existing monorepo and Firebase Hosting deploy pipeline.

## Decisions

- **Framework:** Astro 5.x (content-focused SSG, zero JS by default, island architecture for interactive bits)
- **Styling:** Tailwind CSS v4 (CSS-first config via `@theme` directives, no JS config file)
- **Blog:** Astro content collections (markdown with typed frontmatter, Astro 5.x `content.config.ts` API)
- **Location:** Monorepo workspace at `site/` (replaces current single HTML file)
- **Landing page:** Fresh design — content extracted from existing `site/index.html`, new visual treatment
- **Deploy:** Static build output → `public/` via existing `build-hosting.sh`
- **Fonts:** Self-hosted Inter + JetBrains Mono via `@fontsource` (better perf than Google Fonts CDN)

## Project Structure

```
site/
├── astro.config.mjs
├── tsconfig.json
├── package.json
├── public/                      # static assets (favicons, og images)
├── src/
│   ├── layouts/
│   │   ├── Base.astro           # <html>, <head>, fonts, SEO meta, global styles
│   │   ├── Page.astro           # Base + nav + footer (static pages)
│   │   └── Post.astro           # Base + blog post chrome (date, tags, author)
│   ├── components/
│   │   ├── Nav.astro
│   │   ├── Footer.astro
│   │   ├── Hero.astro
│   │   ├── Personas.astro
│   │   ├── DeveloperSection.astro
│   │   ├── CallToAction.astro
│   │   └── ...
│   ├── content.config.ts        # Astro 5.x content collection schema
│   ├── content/
│   │   └── blog/
│   │       └── *.md
│   ├── pages/
│   │   ├── index.astro          # landing page
│   │   ├── 404.astro            # custom 404 page
│   │   ├── blog/
│   │   │   ├── index.astro      # blog listing (sorted by date, tag filter)
│   │   │   ├── [slug].astro     # individual post
│   │   │   ├── tags/
│   │   │   │   └── [tag].astro  # tag archive
│   │   │   └── rss.xml.ts       # RSS feed at /blog/rss.xml
│   │   └── [...slug].astro      # optional catch-all for future static pages
│   └── styles/
│       └── global.css            # Tailwind v4 @theme directives + custom CSS
```

Note: no `tailwind.config.mjs` — Tailwind v4 uses CSS-first configuration.

## Blog Content Collection

Astro 5.x content collection using `defineCollection` and `glob()` loader in `src/content.config.ts`:

```ts
{
  title: string,
  description: string,
  date: Date,
  tags: string[],
  author?: string,       // defaults to "Formspec Team"
  draft?: boolean,       // excluded from production builds
}
```

Features:
- `/blog/` listing sorted by date
- `/blog/tags/[tag]/` archive pages
- RSS at `/blog/rss.xml`
- Shiki syntax highlighting for code blocks
- Plain markdown to start; MDX available if needed later

## Landing Page

Fresh design using content extracted from the existing `site/index.html`:
- Hero: tagline, value prop, primary CTA
- Personas: grant managers, field operations, agency evaluators
- Developer section: spec overview, code examples, quick start
- Open source / no lock-in messaging
- Footer with links

Content (copy, persona descriptions, code snippets) will be extracted from the existing 3000-line HTML and adapted to the new component structure.

The current interactive demo (live form rendering) is not in initial scope — can be revisited as an Astro island later.

## SEO & Meta

`Base.astro` supports per-page meta via props:
- `<title>`, `<meta name="description">`
- Open Graph tags (og:title, og:description, og:image)
- Canonical URL
- Blog posts auto-generate meta from frontmatter

## Integration with Monorepo

### Workspace

Add `"site"` to root `package.json` workspaces array.

The root `npm run build` script is NOT modified — it builds TypeScript packages only. The site builds exclusively through `build-hosting.sh`.

Add `"start:site": "npm run dev --workspace=site"` to root `package.json` for local development.

### Build Script Changes

`scripts/build-hosting.sh` section 1 changes from:

```bash
cp "$ROOT/site/index.html" "$PUBLIC/index.html"
```

to:

```bash
(cd "$ROOT/site" && npm run build)
cp -r "$ROOT/site/dist/"* "$PUBLIC/"
```

`site/dist/` is already covered by the root `.gitignore` (`dist/` pattern).

### Astro Config

```js
export default defineConfig({
  site: 'https://formspec.dev',
  integrations: [tailwind()],
  build: {
    format: 'directory',
  },
  outDir: './dist',
});
```

### Firebase Hosting Compatibility

- `cleanUrls: true` + Astro `format: 'directory'` are compatible — Astro outputs `blog/index.html`, Firebase serves it at `/blog`
- No rewrite rules needed for blog routes (static pages, not SPA)
- Custom `404.astro` produces `dist/404.html` which Firebase Hosting serves automatically for missing routes

## What's NOT in Scope

- Interactive form demo (island) — can add later
- Documentation site (separate concern, lives in `docs/`)
- Authentication or dynamic features
- Pagination — add when post count warrants it
- Search — add later if needed
- Dark/light mode toggle — pick one theme and ship it
- Image optimization pipeline — add when blog posts need images
