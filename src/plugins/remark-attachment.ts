import type { ElementContent } from 'hast'
import type { Link, Paragraph, Root } from 'mdast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import type { VFile } from 'vfile'
import { existsSync, statSync } from 'node:fs'
import { basename, resolve } from 'node:path'

const ATTACHMENT_TITLE_RE = /^(attachment|attach|download)$/i
const ATTACHMENT_EXT_RE =
  /\.(?:pdf|zip|tar|gz|tgz|7z|rar|xz|bz2|doc|docx|xls|xlsx|ppt|pptx|txt|csv|json|ya?ml|toml|ini|patch)(?:$|[?#])/i

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`

  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }

  const rounded = value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2)
  return `${rounded} ${units[unitIndex]}`
}

function cleanPath(rawUrl: string): string {
  const withoutHash = rawUrl.split('#')[0] || ''
  return withoutHash.split('?')[0] || ''
}

function toDownloadUrl(rawUrl: string): string {
  const cleanUrl = cleanPath(rawUrl).trim()
  if (!cleanUrl) return '/download/attachment'
  if (/^https?:\/\//i.test(cleanUrl)) return rawUrl
  if (cleanUrl.startsWith('/download/')) return cleanUrl

  const name = basename(cleanUrl)
  return `/download/${name}`
}

function resolveAttachmentPath(rawUrl: string): string | null {
  const targetUrl = toDownloadUrl(rawUrl)
  const cleanUrl = cleanPath(targetUrl)
  if (!cleanUrl.startsWith('/download/')) return null

  const relative = cleanUrl.slice('/download/'.length)
  if (!relative) return null

  return resolve(process.cwd(), 'src', 'content', 'download', relative)
}

function getAttachmentSize(rawUrl: string): string {
  const path = resolveAttachmentPath(rawUrl)
  if (!path || !existsSync(path)) return ''

  try {
    const stat = statSync(path)
    if (!stat.isFile()) return ''
    return formatBytes(stat.size)
  } catch {
    return ''
  }
}

function isAttachmentLink(link: Link): boolean {
  const title = (link.title || '').trim()
  if (title && ATTACHMENT_TITLE_RE.test(title)) return true

  const url = (link.url || '').trim()
  if (!url || url.startsWith('#') || url.startsWith('mailto:')) return false

  if (/^https?:\/\//i.test(url)) return false

  return ATTACHMENT_EXT_RE.test(url)
}

export const remarkAttachment: Plugin<[], Root> = function () {
  return function (tree: Root, _file: VFile) {
    visit(tree, 'paragraph', (node: Paragraph) => {
      if (node.children.length !== 1) return

      const onlyChild = node.children[0]
      if (onlyChild.type !== 'link') return

      const link = onlyChild as Link
      if (!isAttachmentLink(link)) return
      const targetUrl = toDownloadUrl(link.url || '')
      const size = getAttachmentSize(targetUrl)
      const label = link.children
        .filter(child => child.type === 'text')
        .map(child => child.value)
        .join('')
        .trim()

      if (label) {
        const hChildren: ElementContent[] = [
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['md-attachment-name'] },
            children: [{ type: 'text', value: label }]
          }
        ]

        if (size) {
          hChildren.push({
            type: 'element',
            tagName: 'span',
            properties: { className: ['md-attachment-size'] },
            children: [{ type: 'text', value: size }]
          })
        }

        link.data ??= {}
        link.data.hChildren = hChildren
      }

      node.data ??= {}
      node.data.hName = 'p'
      node.data.hProperties = {
        ...((node.data.hProperties ?? {}) as Record<string, unknown>),
        className: ['md-attachment-line']
      }

      link.data ??= {}
      link.data.hProperties = {
        ...((link.data.hProperties ?? {}) as Record<string, unknown>),
        className: ['md-attachment-card'],
        href: targetUrl,
        download: ''
      }
    })
  }
}

export default remarkAttachment
