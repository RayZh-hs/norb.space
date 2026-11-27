import { defineMiddleware } from 'astro:middleware'

const CACHEABLE_CONTENT_TYPES = [
  'text/html',
  'application/json',
  'application/xml',
  'application/rss+xml',
  'text/plain'
]

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next()

  if (context.request.method !== 'GET' || response.status !== 200) {
    return response
  }

  if (response.headers.has('Cache-Control')) {
    return response
  }

  const contentType = (response.headers.get('Content-Type') || '').toLowerCase()
  const isCacheable = CACHEABLE_CONTENT_TYPES.some((type) => contentType.includes(type))
  if (!isCacheable) {
    return response
  }

  const headers = new Headers(response.headers)
  headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=86400')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
})
