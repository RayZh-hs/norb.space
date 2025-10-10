import type { RemarkPlugin } from '@astrojs/markdown-remark'
// Import the 'Parent' type
import type { Content, Link, Paragraph, Parent, Root } from 'mdast'
import { visit } from 'unist-util-visit'

type RepoInfo = {
  full_name: string
  name: string
  description: string | null
  html_url: string
}

const cache = new Map<string, RepoInfo | null>()

async function fetchRepo(owner: string, repo: string): Promise<RepoInfo | null> {
  const key = `${owner}/${repo}`
  if (cache.has(key)) return cache.get(key) as RepoInfo | null
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { Accept: 'application/vnd.github+json' }
    })
    if (!res.ok) {
      cache.set(key, null)
      return null
    }
    const data = await res.json()
    const info: RepoInfo = {
      full_name: data.full_name || `${owner}/${repo}`,
      name: data.name || repo,
      description: data.description || null,
      html_url: data.html_url || `https://github.com/${owner}/${repo}`
    }
    cache.set(key, info)
    return info
  } catch {
    cache.set(key, null)
    return null
  }
}

const GH_REPO_RE =
  /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\/?|#.*)?$/

// Remark plugin: turn paragraphs that contain a single GitHub repo link
// into a rich card block with icon, title, description, and clickable link
export const remarkGithubCard: RemarkPlugin = function () {
  return async function transformer(tree: Root) {
    const tasks: Array<Promise<void>> = []
    // Correct the signature of the visitor function here
    visit(
      tree,
      'paragraph',
      (node: Paragraph, index: number | undefined, parent: Parent | undefined) => {
        if (!parent || typeof index !== 'number') return
        const children: Content[] = node.children || []
        if (children.length !== 1 || children[0].type !== 'link') return
        const link = children[0] as Link
        const url: string = link.url || ''
        const m = url.match(GH_REPO_RE)
        if (!m) return
        const owner = m[1]
        const repo = m[2]

        tasks.push(
          (async () => {
            const info = await fetchRepo(owner, repo)
            const title = info?.name || `${owner}/${repo}`
            const desc = info?.description || ''
            const href = info?.html_url || `https://github.com/${owner}/${repo}`

            const html = `\n<a class="gh-card" href="${href}" target="_blank" rel="noopener noreferrer">\n  <div class="gh-card-icon" aria-hidden="true">\n    <svg viewBox="0 0 16 16" width="24" height="24" fill="currentColor" aria-hidden="true">\n      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8 0 0016 8c0-4.42-3.58-8-8-8z"></path>\n    </svg>\n  </div>\n  <div class="gh-card-body">\n    <div class="gh-card-title">${title}</div>\n    <div class="gh-card-desc">${desc.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>\n  </div>\n</a>\n`

            parent.children[index] = { type: 'html', value: html }
          })()
        )
      }
    )
    await Promise.all(tasks)
  }
}

export default remarkGithubCard
