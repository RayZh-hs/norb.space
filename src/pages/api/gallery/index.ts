import type { APIRoute } from 'astro'
import { getGalleryItems } from '@/server/galleryService'

const headers = {
  'content-type': 'application/json',
  'cache-control': 'public, max-age=300, stale-while-revalidate=900'
}

export const GET: APIRoute = async () => {
  const items = await getGalleryItems()
  const payload = {
    generatedAt: new Date().toISOString(),
    items
  }

  return new Response(JSON.stringify(payload), { headers })
}
