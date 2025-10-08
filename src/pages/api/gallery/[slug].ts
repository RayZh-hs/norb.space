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

  if (size === 'raw' || size === 'small' || size === 'preview') {
    const image = item.images[size]
    return new Response(
      JSON.stringify({
        slug: item.slug,
        title: item.title,
        alt: item.title,
        image
      }),
      { headers }
    )
  }

  return new Response(JSON.stringify(item), { headers })
}
