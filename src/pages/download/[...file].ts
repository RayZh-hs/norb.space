import type { APIRoute } from 'astro'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

const DOWNLOAD_ROOT = resolve(process.cwd(), 'src', 'content', 'download')

const MIME_TYPES: Record<string, string> = {
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.yaml': 'application/yaml; charset=utf-8',
  '.yml': 'application/yaml; charset=utf-8',
  '.toml': 'application/toml; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.tar': 'application/x-tar',
  '.7z': 'application/x-7z-compressed',
  '.rar': 'application/vnd.rar'
}

function contentTypeFor(path: string): string {
  return MIME_TYPES[extname(path).toLowerCase()] || 'application/octet-stream'
}

function safePathFromSlug(slug?: string): string | null {
  if (!slug) return null
  const parts = slug
    .split('/')
    .map(part => part.trim())
    .filter(Boolean)

  if (parts.length === 0) return null
  if (parts.some(part => part === '.' || part === '..')) return null

  const abs = resolve(DOWNLOAD_ROOT, ...parts)
  if (abs !== DOWNLOAD_ROOT && !abs.startsWith(`${DOWNLOAD_ROOT}${sep}`)) return null
  return abs
}

function fileNameFromSlug(slug: string): string {
  return slug.split('/').filter(Boolean).at(-1) || 'download.bin'
}

export const GET: APIRoute = async ({ params }) => {
  const slug = params.file
  const absPath = safePathFromSlug(slug)

  if (!slug || !absPath) {
    return new Response('Invalid download path', { status: 400 })
  }

  try {
    const fileStat = await stat(absPath)
    if (!fileStat.isFile()) {
      return new Response('Not found', { status: 404 })
    }

    const data = await readFile(absPath)
    const fileName = fileNameFromSlug(slug)

    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': contentTypeFor(absPath),
        'Content-Length': String(fileStat.size),
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Cache-Control': 'public, max-age=3600'
      }
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
