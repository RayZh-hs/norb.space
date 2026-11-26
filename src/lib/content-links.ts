import { getCollection, type CollectionEntry } from 'astro:content'

export function normalizeProjectSlug(entry: CollectionEntry<'projects'>): string {
  return entry.slug.replace(/\/index$/, '')
}

export async function getProjectMap(): Promise<Map<string, CollectionEntry<'projects'>>> {
  const projects = await getCollection('projects')
  const map = new Map<string, CollectionEntry<'projects'>>()
  for (const project of projects) {
    const slug = normalizeProjectSlug(project)
    map.set(slug, project)
    map.set(slug.toLowerCase(), project)
  }
  return map
}

export function getHostProjectForPost(
  post: CollectionEntry<'blog'>,
  projectMap: Map<string, CollectionEntry<'projects'>>
): CollectionEntry<'projects'> | null {
  const key = post.data.project?.trim().toLowerCase()
  if (!key) return null
  return projectMap.get(key) ?? null
}

export function getRelatedBlogsForProject(
  project: CollectionEntry<'projects'>,
  allPosts: CollectionEntry<'blog'>[]
): CollectionEntry<'blog'>[] {
  const slug = normalizeProjectSlug(project).toLowerCase()
  const blogpage = project.data.blogpage ?? ''
  const seen = new Set<string>()
  const matched: CollectionEntry<'blog'>[] = []

  for (const post of allPosts) {
    const byField = post.data.project?.trim().toLowerCase() === slug
    const byBlogpage = blogpage.length > 0 && blogpage.includes(`/blog/${post.id}`)
    if ((byField || byBlogpage) && !seen.has(post.id)) {
      seen.add(post.id)
      matched.push(post)
    }
  }
  return matched
}
