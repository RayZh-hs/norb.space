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
  schema: ({ image }) => {
    const imageRef = image()
    const frameInput = z.union([
      z.object({
        raw: imageRef,
        title: z.string().max(120).optional(),
        description: z.string().max(240).optional(),
        tags: z.array(z.string()).default([]).transform(removeDupsAndLowerCase).optional(),
      }),
      imageRef.transform((src) => ({ raw: src, title: undefined, description: undefined, tags: [] as string[] }))
    ])

    return z
      .object({
        title: z.string().max(80),
        description: z.string().max(320),
        tags: z.array(z.string()).default([]).transform(removeDupsAndLowerCase),
        location: z.string().optional(),
        shootDate: z.preprocess((value) => {
          if (typeof value === 'string' && value.trim().toLowerCase() === 'unknown') return undefined
          return value
        }, z.coerce.date().optional()),
        camera: z.string().optional(),
        externalLink: z.string().url().optional(),
        frames: z.array(frameInput).optional(),
        rawImages: z.array(imageRef).optional(),
        rawImage: imageRef.optional()
      })
      .transform((data) => {
        let framesSource = data.frames && data.frames.length ? data.frames : undefined
        if (!framesSource || !framesSource.length) {
          if (data.rawImages && data.rawImages.length) {
            framesSource = data.rawImages.map((src) => ({ raw: src, title: undefined, description: undefined, tags: [] as string[] }))
          } else if (data.rawImage) {
            framesSource = [{ raw: data.rawImage, title: undefined, description: undefined, tags: [] as string[] }]
          }
        }
        if (!framesSource || !framesSource.length) {
          throw new Error(`Gallery entry "${data.title}" must declare at least one image via 'frames' or 'rawImages'.`)
        }

        const frames = framesSource.map((frame, index) => ({
          index,
          raw: frame.raw,
          title: frame.title,
          description: frame.description,
          tags: removeDupsAndLowerCase(frame.tags ?? [])
        }))

        return {
          title: data.title,
          description: data.description,
          tags: data.tags,
          location: data.location,
          shootDate: data.shootDate,
          camera: data.camera,
          externalLink: data.externalLink,
          frames
        }
      })
  }
})

export const collections = { blog, projects, gallery }
