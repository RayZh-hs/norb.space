import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

function removeDupsAndLowerCase(array: string[]) {
  if (!array.length) return array
  const lowercaseItems = array.map((str) => str.toLowerCase())
  const distinctItems = new Set(lowercaseItems)
  return Array.from(distinctItems)
}

const blog = defineCollection({
  // Load Markdown and MDX files in the `src/content/blog/` directory.
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  // Required
  schema: ({ image }) =>
    z.object({
      // Required
      title: z.string().max(60),
      description: z.string().max(160),
      publishDate: z.coerce.date(),
      // Optional
      updatedDate: z.coerce.date().optional(),
      heroImage: z
        .object({
          src: image(),
          alt: z.string().optional(),
          inferSize: z.boolean().optional(),
          width: z.number().optional(),
          height: z.number().optional(),

          color: z.string().optional()
        })
        .optional(),
      tags: z.array(z.string()).default([]).transform(removeDupsAndLowerCase),
      language: z.string().optional(),
      draft: z.boolean().default(false),
      // Integrations
      comment: z.boolean().default(true)
    })
})

const projects = defineCollection({
  type: 'content', // 'content' for Markdown/MDX files
  schema: ({ image }) => z.object({
    projectName: z.string(),
    description: z.string(),
    tags: z.array(z.string()).optional(),
    icon: z.object({
      src: image(), // Use Astro's image helper for the icon source
    }).optional(),
    homepage: z.string().url().optional(), // URL for the project's homepage
    demopage: z.string().url().optional(),
    gradient: z.object({
      from: z.string(),
      to: z.string(),
    }),
    // Add any other fields you might need, e.g., order
    order: z.number().optional(),
  }),
});

const gallery = defineCollection({
  loader: glob({ base: './src/content/gallery', pattern: '**/index.md' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().max(80),
      description: z.string().max(240),
      alt: z.string().max(160).optional(),
      tags: z.array(z.string()).default([]).transform(removeDupsAndLowerCase),
      location: z.string().optional(),
      shootDate: z.preprocess((value) => {
        if (typeof value === 'string' && value.trim().toLowerCase() === 'unknown') return undefined
        return value
      }, z.coerce.date().optional()),
      camera: z.string().optional(),
      rawImage: image(),
      externalLink: z.string().url().optional()
    })
})

// Define docs collection
const docs = defineCollection({
  loader: glob({ base: './src/content/docs', pattern: '**/*.{md,mdx}' }),
  schema: () =>
    z.object({
      title: z.string().max(60),
      description: z.string().max(160),
      publishDate: z.coerce.date().optional(),
      updatedDate: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]).transform(removeDupsAndLowerCase),
      draft: z.boolean().default(false)
    })
})

export const collections = { blog, docs, projects, gallery }
