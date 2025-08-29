import type { APIRoute } from 'astro'
import { createSelection, type PexelsPhoto } from '@/server/galleryStore'

const PEXELS_API = 'https://api.pexels.com/v1/search?query=nature&per_page=12'

export const GET: APIRoute = async () => {
  const key = import.meta.env.PEXKEY ?? process.env.PEXKEY ?? ''
  if (!key) {
    console.error('[api/gallery] Missing PEXKEY environment variable')
    return new Response(JSON.stringify({ error: 'Missing PEXKEY in environment' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }

  const res = await fetch(PEXELS_API, {
    headers: { Authorization: key }
  }).catch((err) => {
    console.error('[api/gallery] Fetch error:', err)
    return new Response(null, { status: 500 }) as unknown as Response
  })
  if (!res.ok) {
    console.error('[api/gallery] Pexels responded with non-OK status:', res.status)
    return new Response(JSON.stringify({ error: 'Failed to fetch from Pexels', status: res.status }), { status: 502, headers: { 'content-type': 'application/json' } })
  }

  type PexelsResp = { photos?: Array<{ id: number; width: number; height: number; alt: string; photographer: string; src: Record<string, string> }>} 
  const data: PexelsResp = await res.json()
  const photos: PexelsPhoto[] = (data?.photos || []).map((p) => ({
    id: p.id,
    width: p.width,
    height: p.height,
    alt: p.alt,
    photographer: p.photographer,
    src: p.src
  }))

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
