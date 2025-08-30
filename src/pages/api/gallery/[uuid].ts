import type { APIRoute } from 'astro'
import { getSelection } from '@/server/galleryStore'

export const GET: APIRoute = async ({ params, request }) => {
  const uuid = params.uuid as string
  const url = new URL(request.url)
  const size = url.searchParams.get('size') || 'tiny'

  const sel = getSelection(uuid)
  if (!sel) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })

  // Helper: non-cropped tiny preserving aspect ratio
  const tinyUrl = (orig: string, w: number, h: number) => {
    const base = orig
    const sep = base.includes('?') ? '&' : '?'
    // Resize by a single dimension based on orientation to avoid cropping
    if (w >= h) {
      // Landscape: constrain height
      return `${base}${sep}auto=compress&cs=tinysrgb&h=200`
    } else {
      // Portrait: constrain width
      return `${base}${sep}auto=compress&cs=tinysrgb&w=200`
    }
  }

  const images = sel.photos.map((p) => {
    let urlStr = ''
    if (size === 'tiny') {
      urlStr = tinyUrl(p.src.original, p.width, p.height)
    } else if (size === 'normal') {
      urlStr = p.src.large || p.src.large2x || p.src.medium || p.src.original
    } else if (size === 'hires') {
      const base = p.src.original
      const sep = base.includes('?') ? '&' : '?'
      urlStr = `${base}${sep}auto=compress&cs=tinysrgb&w=2000`
    } else {
      urlStr = p.src[size as keyof typeof p.src] || p.src.medium || p.src.original
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

  return new Response(JSON.stringify({ uuid, size, images }), {
    headers: { 'content-type': 'application/json' }
  })
}
