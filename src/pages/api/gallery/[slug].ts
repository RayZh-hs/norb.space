import type { APIRoute } from 'astro'
import { getGalleryItem } from '@/server/galleryService'

const headers = {
  'content-type': 'application/json',
  'cache-control': 'public, max-age=300, stale-while-revalidate=900'
}

export const GET: APIRoute = async ({ params, request }) => {
  const slug = params.slug
  if (!slug) {
    return new Response(JSON.stringify({ error: 'Missing slug' }), { status: 400, headers })
  }

  const item = await getGalleryItem(slug)
  if (!item) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers })
  }

  const url = new URL(request.url)
  const size = url.searchParams.get('size')

  const frameParam = url.searchParams.get('frame')
  const frameIndex = frameParam !== null ? Number.parseInt(frameParam, 10) : 0
  const frame = Number.isFinite(frameIndex) ? item.frames[frameIndex] ?? item.cover : item.cover

  if (size === 'raw' || size === 'small' || size === 'preview') {
    const image = frame.images[size]
    return new Response(
      JSON.stringify({
        slug: item.slug,
        title: frame.title,
        alt: frame.title,
        frame: frame.index,
        image
      }),
      { headers }
    )
  }

  return new Response(JSON.stringify(item), { headers })
}
