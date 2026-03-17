/** @filedesc Astro content collection definitions for the blog. */
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    author: z.string().default("Formspec Team"),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
