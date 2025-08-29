import type { APIRoute } from 'astro'
import { getSelection } from '@/server/galleryStore'

export const GET: APIRoute = async ({ params, request }) => {
  const uuid = params.uuid as string
  const url = new URL(request.url)
  const size = url.searchParams.get('size') || 'tiny'

  const sel = getSelection(uuid)
  if (!sel) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })

  // Map size to the best Pexels src key
  const srcKey = size === 'normal' ? 'large' : size === 'tiny' ? 'tiny' : size

  const images = sel.photos.map((p) => {
    let urlStr = p.src[srcKey] || p.src.medium || p.src.original
    if (size === 'hires') {
      // Build ~2k wide URL using Pexels params from original
      const base = p.src.original
      const sep = base.includes('?') ? '&' : '?'
      urlStr = `${base}${sep}auto=compress&cs=tinysrgb&w=2000`
    }
    return {
      id: p.id,
      alt: p.alt,
      width: p.width,
      height: p.height,
      photographer: p.photographer,
      url: urlStr
    }
  })

  return new Response(JSON.stringify({ uuid, size: srcKey, images }), {
    headers: { 'content-type': 'application/json' }
  })
}
