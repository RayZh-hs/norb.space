import type { APIRoute } from 'astro'
import { getCollection, type CollectionEntry } from 'astro:content'
import { getBlogCollection, sortMDByDate } from 'astro-pure/server'
import {
  getHostProjectForPost,
  getProjectMap,
  getProjectUrl,
  isCreativeProject,
  normalizeProjectSlug
} from '@/lib/content-links'

export const prerender = true

export type SearchItemKind = 'blog' | 'project' | 'creative' | 'photo' | 'page'

export interface SearchIndexItem {
  id: string
  kind: SearchItemKind
  title: string
  description: string
  url: string
  date?: string
  tags: string[]
  category?: string
  accent?: string
  headings?: string[]
  body: string
}

function extractHeadings(markdown: string): string[] {
  const headings: string[] = []
  const lines = markdown.split('\n')
  let inCodeFence = false
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence
      continue
    }
    if (inCodeFence) continue
    const match = line.match(/^#{1,4}\s+(.+?)\s*#*$/)
    if (match) {
      const cleaned = match[1]
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[*_~]/g, '')
        .trim()
      if (cleaned) headings.push(cleaned)
    }
  }
  return headings
}

function stripMarkdown(markdown: string): string {
  return markdown
    // Remove MDX import/export lines
    .replace(/^(?:import|export)\s+.*$/gm, ' ')
    // Keep code fence content lightly without backticks/language tag
    .replace(/```[^\n]*\n/g, ' ')
    .replace(/```/g, ' ')
    // Remove images ![alt](url) -> alt
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Convert links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove bare URLs
    .replace(/https?:\/\/\S+/g, ' ')
    // Remove HTML / JSX tags
    .replace(/<[^>]+>/g, ' ')
    // Remove markdown formatting markers
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~`>|]/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

export const GET: APIRoute = async () => {
  const [blogPostsRaw, projectEntries, galleryEntries, projectMap] = await Promise.all([
    getBlogCollection(),
    getCollection('projects'),
    getCollection('gallery'),
    getProjectMap()
  ])

  const blogPosts = sortMDByDate(blogPostsRaw) as CollectionEntry<'blog'>[]
  const items: SearchIndexItem[] = []

  // 1. Blog posts (full-text searchable + headings + tags + host project)
  for (const post of blogPosts) {
    const hostProject = getHostProjectForPost(post, projectMap)
    const rawBody = post.body ?? ''
    const formattedDate = post.data.publishDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    })

    items.push({
      id: `blog:${post.id}`,
      kind: 'blog',
      title: post.data.title,
      description: post.data.description,
      url: `/blog/${post.id}`,
      date: formattedDate,
      tags: post.data.tags ?? [],
      category: hostProject?.data.projectName,
      accent: post.data.heroImage?.color ?? hostProject?.data.gradient.from,
      headings: extractHeadings(rawBody),
      body: stripMarkdown(rawBody).slice(0, 8000)
    })
  }

  // 2. Projects & Creative Works
  const sortedProjects = [...projectEntries].sort((a, b) => {
    const orderA = a.data.order ?? Infinity
    const orderB = b.data.order ?? Infinity
    if (orderA !== orderB) return orderA - orderB
    return a.data.projectName.localeCompare(b.data.projectName)
  })

  for (const entry of sortedProjects) {
    const slug = normalizeProjectSlug(entry)
    const creative = isCreativeProject(entry)
    items.push({
      id: `${creative ? 'creative' : 'project'}:${slug}`,
      kind: creative ? 'creative' : 'project',
      title: entry.data.projectName,
      description: entry.data.description,
      url: getProjectUrl(entry),
      date: entry.data.year,
      tags: entry.data.tags ?? [],
      category: entry.data.category,
      accent: entry.data.gradient.from,
      body: stripMarkdown(entry.body ?? '').slice(0, 2000)
    })
  }

  // 3. Photography / Gallery entries
  const sortedGallery = [...galleryEntries].sort((a, b) => {
    const aTime = a.data.shootDate?.getTime?.() ?? 0
    const bTime = b.data.shootDate?.getTime?.() ?? 0
    if (aTime === bTime) return a.data.title.localeCompare(b.data.title)
    return bTime - aTime
  })

  for (const entry of sortedGallery) {
    const slug = entry.id.replace(/\/index\.md$/, '')
    const metaParts = [entry.data.location, entry.data.camera].filter(Boolean).join(' · ')
    items.push({
      id: `photo:${slug}`,
      kind: 'photo',
      title: entry.data.title,
      description: entry.data.description,
      url: '/creative#photography',
      date: entry.data.shootDate
        ? entry.data.shootDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
        : undefined,
      tags: entry.data.tags ?? [],
      category: metaParts || 'Photography',
      body: [entry.data.location, entry.data.camera, entry.data.description].filter(Boolean).join(' ')
    })
  }

  // 4. Key Site Pages
  const staticPages: SearchIndexItem[] = [
    {
      id: 'page:home',
      kind: 'page',
      title: 'Home',
      description: 'Call me Norb — Student developer, frontier researcher, creative designer, photographer, and botanist.',
      url: '/',
      tags: ['home', 'intro', 'contact', 'bio'],
      category: 'Page',
      body: 'Norb Ray Zhang SJTU ACM LLM Agentic Computer Vision Gair Lab CG artist photographer botanist contacts email github wechat sketchfab pexels'
    },
    {
      id: 'page:blog',
      kind: 'page',
      title: 'Blogs',
      description: 'Essays and technical notes on research, compilers, tools, and visual craft.',
      url: '/blog',
      tags: ['blog', 'essays', 'writing', 'articles'],
      category: 'Page',
      body: 'Writing across research compilers tools and visual craft'
    },
    {
      id: 'page:projects',
      kind: 'page',
      title: 'Projects',
      description: 'Interactive showcase of software engineering, compilers, AI research, and systems projects.',
      url: '/projects',
      tags: ['projects', 'code', 'systems', 'compilers'],
      category: 'Page',
      body: 'Systems & Compilers AI & Vision Tools open source software engineering'
    },
    {
      id: 'page:creative',
      kind: 'page',
      title: 'Creative',
      description: 'Visual design, desktop themes, photography archive, and 3D studies.',
      url: '/creative',
      tags: ['creative', 'design', 'photography', '3d'],
      category: 'Page',
      body: 'Visual design photography 3D modeling Sketchfab Pexels themes'
    },
    {
      id: 'page:archives',
      kind: 'page',
      title: 'Archives',
      description: 'Chronological archive of all published blog posts grouped by year.',
      url: '/archives',
      tags: ['archives', 'timeline', 'history', 'blog'],
      category: 'Page',
      body: 'All blog posts by year timeline archive'
    },
    {
      id: 'page:about',
      kind: 'page',
      title: 'About',
      description: 'Background, programming languages, creative & dev tools, and personal info.',
      url: '/about',
      tags: ['about', 'tools', 'languages', 'info'],
      category: 'Page',
      headings: ['Hobbies', 'Programming Languages', 'Tools', 'Personal Info', 'About Blog'],
      body: 'Ray Zhang Norb C++ Python JavaScript TypeScript Go Rust Scala Kotlin Vox Photoshop After Effects Premiere Blender Gaea Realityscan GIMP Graphite Kdenlive Unreal Engine VS Code Jetbrains Neovim Arch Linux SJTU'
    }
  ]

  items.push(...staticPages)

  return new Response(JSON.stringify({ items }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=900'
    }
  })
}
