import type { APIRoute } from 'astro'
import { createSelection, type PexelsPhoto } from '@/server/galleryStore'

// Use curated endpoint (typically faster than search) and ask for more items
const PEXELS_API = 'https://api.pexels.com/v1/curated?page=2?per_page=12'

// Simple in-memory cache to avoid hitting Pexels on every request during dev/preview
let cachedPhotos: PexelsPhoto[] | null = null
let cachedAt = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export const GET: APIRoute = async () => {
  const key = import.meta.env.PEXKEY ?? process.env.PEXKEY ?? ''
  if (!key) {
    console.error('[api/gallery] Missing PEXKEY environment variable')
    return new Response(JSON.stringify({ error: 'Missing PEXKEY in environment' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
  let photos: PexelsPhoto[] = []
  const now = Date.now()
  if (cachedPhotos && now - cachedAt < CACHE_TTL_MS) {
    photos = cachedPhotos
  } else {
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 10_000) // 10s timeout
    try {
      const res = await fetch(PEXELS_API, {
        headers: { Authorization: key },
        signal: ctrl.signal
      })
      if (!res.ok) {
        console.error('[api/gallery] Pexels responded with non-OK status:', res.status)
        return new Response(JSON.stringify({ error: 'Failed to fetch from Pexels', status: res.status }), { status: 502, headers: { 'content-type': 'application/json' } })
      }
      type PexelsResp = { photos?: Array<{ id: number; width: number; height: number; alt: string; photographer: string; src: Record<string, string> }> }
      const data: PexelsResp = await res.json()
      photos = (data?.photos || []).map((p) => ({
        id: p.id,
        width: p.width,
        height: p.height,
        alt: p.alt,
        photographer: p.photographer,
        src: p.src
      }))
      cachedPhotos = photos
      cachedAt = now
    } catch (err) {
      console.error('[api/gallery] Fetch error:', err)
      return new Response(JSON.stringify({ error: 'Error fetching from Pexels' }), { status: 502, headers: { 'content-type': 'application/json' } })
    } finally {
      clearTimeout(timeout)
    }
  }

  const selection = createSelection(photos)

  // Return selection with minimal payload and where to fetch images
  return new Response(
    JSON.stringify({
      uuid: selection.uuid,
      count: photos.length,
      items: photos.map((p) => ({ id: p.id, alt: p.alt, width: p.width, height: p.height, photographer: p.photographer }))
    }),
    { headers: { 'content-type': 'application/json' } }
  )
}
