/** @filedesc SEO constants and structured data helpers for the Astro marketing site. */

export type StructuredData = Record<string, unknown>;

export const SITE_NAME = "Formspec";
export const SITE_URL = "https://formspec.org";
export const SITE_LOCALE = "en_US";
export const DEFAULT_DESCRIPTION =
  "Free, open-source form specification for grant applications, field inspections, compliance reporting, and intake workflows — designed for high-stakes environments.";
export const DEFAULT_OG_IMAGE = "/og-default.png";
export const DEFAULT_OG_IMAGE_ALT =
  "Formspec social card with the tagline Declarative forms for high-stakes workflows.";
export const DEFAULT_ROBOTS =
  "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
export const NOINDEX_ROBOTS = "noindex, follow";
export const THEME_COLOR = "#f6f4ee";

export const ROBOTS_DISALLOWED_PATHS = [
  "/pitch/",
  "/react/",
  "/references/",
  "/uswds-grant/",
  "/studio/changeset-review-harness.html",
];

export function absoluteUrl(pathname: string): string {
  return new URL(pathname, SITE_URL).toString();
}

export function stripSiteName(title: string): string {
  return title.replace(/\s+[—-]\s+Formspec$/, "").trim();
}

export function getFullTitle(title: string): string {
  const normalized = title.trim();
  if (normalized === SITE_NAME) {
    return SITE_NAME;
  }

  if (normalized.endsWith(`— ${SITE_NAME}`) || normalized.endsWith(`- ${SITE_NAME}`)) {
    return normalized;
  }

  return `${normalized} — ${SITE_NAME}`;
}

export function createWebPageSchema({
  title,
  description,
  pathname,
  type = "WebPage",
}: {
  title: string;
  description: string;
  pathname: string;
  type?: string;
}): StructuredData {
  return {
    "@context": "https://schema.org",
    "@type": type,
    name: getFullTitle(title),
    description,
    url: absoluteUrl(pathname),
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

export function createWebSiteSchema(): StructuredData {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

export function createOrganizationSchema(): StructuredData {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl(DEFAULT_OG_IMAGE),
    sameAs: [
      "https://github.com/Formspec-org/formspec",
      "https://www.linkedin.com/in/michael-deeb/",
      "https://tealwolf.consulting/",
    ],
  };
}

export function createBreadcrumbSchema(
  items: Array<{ name: string; path: string }>,
): StructuredData {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function createBlogPostingSchema({
  title,
  description,
  pathname,
  datePublished,
  dateModified,
  author,
  tags = [],
  image = DEFAULT_OG_IMAGE,
}: {
  title: string;
  description: string;
  pathname: string;
  datePublished: string;
  dateModified?: string;
  author: string;
  tags?: string[];
  image?: string;
}): StructuredData {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description,
    datePublished,
    dateModified: dateModified ?? datePublished,
    keywords: tags.join(", "),
    url: absoluteUrl(pathname),
    image: [absoluteUrl(image)],
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": absoluteUrl(pathname),
    },
    author: {
      "@type": "Person",
      name: author,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl(DEFAULT_OG_IMAGE),
      },
    },
  };
}
