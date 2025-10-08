import { getCollection, type CollectionEntry } from 'astro:content'
import { getImage } from 'astro:assets'

const PREVIEW_WIDTH = 24
const SMALL_WIDTH = 960
const SMALL_QUALITY = 78
const PREVIEW_QUALITY = 45

export type GalleryItemImage = {
  src: string
  width: number
  height: number
  format: string
}

export type GalleryItem = {
  slug: string
  title: string
  description: string
  tags: string[]
  location: string | null
  shootDate: string | null
  camera: string | null
  externalLink: string | null
  aspectRatio: number
  images: {
    preview: GalleryItemImage
    small: GalleryItemImage
    raw: GalleryItemImage
  }
}

type GalleryCache = {
  generatedAt: number
  items: GalleryItem[]
  map: Map<string, GalleryItem>
}

let cache: GalleryCache | null = null

function getSlug(entry: CollectionEntry<'gallery'>): string {
  return entry.id.replace(/\/index\.md$/, '')
}

async function buildItem(entry: CollectionEntry<'gallery'>): Promise<GalleryItem> {
  const raw = entry.data.rawImage

  const small = await getImage({
    src: raw,
    width: SMALL_WIDTH,
    fit: 'inside',
    format: 'webp',
    quality: SMALL_QUALITY
  })

  const preview = await getImage({
    src: raw,
    width: PREVIEW_WIDTH,
    fit: 'cover',
    format: 'webp',
    quality: PREVIEW_QUALITY
  })

  const aspectRatio = raw.width / raw.height

  const rawImage: GalleryItemImage = {
    src: raw.src,
    width: raw.width,
    height: raw.height,
    format: raw.format
  }

  const smallWidth = small.options.width ?? SMALL_WIDTH
  const smallHeight = small.options.height ?? Math.round(smallWidth / aspectRatio)

  const smallImage: GalleryItemImage = {
    src: small.src,
    width: smallWidth,
    height: smallHeight,
    format: (small.options.format ?? 'webp').toString()
  }

  const previewWidth = preview.options.width ?? PREVIEW_WIDTH
  const previewHeight = preview.options.height ?? Math.round(previewWidth / aspectRatio)

  const previewImage: GalleryItemImage = {
    src: preview.src,
    width: previewWidth,
    height: previewHeight,
    format: (preview.options.format ?? 'webp').toString()
  }

  return {
    slug: getSlug(entry),
    title: entry.data.title,
    description: entry.data.description,
    tags: entry.data.tags,
    location: entry.data.location ?? null,
    shootDate: entry.data.shootDate ? entry.data.shootDate.toISOString() : null,
    camera: entry.data.camera ?? null,
    externalLink: entry.data.externalLink ?? null,
  aspectRatio,
    images: {
      preview: previewImage,
      small: smallImage,
      raw: rawImage
    }
  }
}

async function loadGallery(): Promise<GalleryCache> {
  if (cache && import.meta.env.PROD) return cache

  const entries = await getCollection('gallery')
  const sorted = [...entries].sort((a, b) => {
    const aDate = a.data.shootDate?.getTime?.() ?? 0
    const bDate = b.data.shootDate?.getTime?.() ?? 0
    if (aDate === bDate) return getSlug(a).localeCompare(getSlug(b))
    return bDate - aDate
  })

  const items = await Promise.all(sorted.map((entry) => buildItem(entry)))
  const map = new Map(items.map((item) => [item.slug, item]))
  cache = { generatedAt: Date.now(), items, map }
  return cache
}

export async function getGalleryItems(): Promise<GalleryItem[]> {
  const data = await loadGallery()
  return data.items
}

export async function getGalleryItem(slug: string): Promise<GalleryItem | null> {
  const data = await loadGallery()
  return data.map.get(slug) ?? null
}

export function invalidateGalleryCache() {
  cache = null
}
