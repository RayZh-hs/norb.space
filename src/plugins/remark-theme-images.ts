import type { RemarkPlugin } from '@astrojs/markdown-remark'
import type { Link, LinkReference, Paragraph, PhrasingContent, Root, Text } from 'mdast'
import { visit } from 'unist-util-visit'

const TRAILING_THEME_MARKER_RE = /^(.*?)(?:\s*)!(dark|light)\s*$/s
const THEME_IMAGE_RE = /!(dark|light)\[([^\]]*)\]\(([^\s)]+)(?:\s+["']([^"']*)["'])?\)/g

function getTextContent(children: PhrasingContent[]): string {
  let text = ''
  for (const child of children) {
    if (child.type === 'text') {
      text += child.value
    } else if ('children' in child) {
      text += getTextContent(child.children as PhrasingContent[])
    }
  }
  return text
}

// Change: Return an array of nodes (Wrapper Start + Image + Wrapper End)
function createThemeImageNodes(theme: 'dark' | 'light', alt: string, url: string, title?: string): PhrasingContent[] {
  // We apply the visibility logic to a parent <span>.
  // Astro optimizes the <img> inside, but preserves our <span> and its classes.
  
  // Logic: 
  // Light: Hide in dark mode (dark:hidden)
  // Dark: Hide by default, Show in dark mode (hidden dark:inline-block)
  // Note: used inline-block to prevent breaking paragraph flow, change to 'dark:block' if you prefer block level.
  const classes = theme === 'dark' ? 'hidden dark:inline-block' : 'dark:hidden'

  return [
    {
      type: 'html',
      value: `<span class="${classes}" data-theme-image="${theme}">`
    },
    {
      type: 'image',
      alt,
      url,
      title
    },
    {
      type: 'html',
      value: '</span>'
    }
  ]
}

export const remarkThemeImages: RemarkPlugin = function () {
  return function transformer(tree: Root) {
    visit(tree, 'paragraph', (node: Paragraph) => {
      const nextChildren: PhrasingContent[] = []
      let changed = false
      const children = node.children

      for (let i = 0; i < children.length; i++) {
        const child = children[i]

        // 1. If not text, preserve and continue
        if (child.type !== 'text') {
          nextChildren.push(child)
          continue
        }

        const textNode = child as Text
        const value = textNode.value

        // 2. Check for Split Pattern: Text("...!light") + Link(...)
        const markerMatch = value.match(TRAILING_THEME_MARKER_RE)
        
        if (markerMatch) {
          const [, prefix, theme] = markerMatch
          
          let linkIndex = i + 1
          while (
            linkIndex < children.length &&
            children[linkIndex].type === 'text' &&
            /^\s*$/.test((children[linkIndex] as Text).value)
          ) {
            linkIndex++
          }

          const maybeLink = children[linkIndex]

          if (maybeLink && (maybeLink.type === 'link' || maybeLink.type === 'linkReference')) {
            changed = true
            
            if (prefix) {
              nextChildren.push({ type: 'text', value: prefix })
            }

            const link = maybeLink as Link | LinkReference
            const url = 'url' in link ? link.url : ''
            const title = 'title' in link ? (link as Link).title || undefined : undefined

            // Spread the wrapper+image nodes into the children array
            nextChildren.push(
              ...createThemeImageNodes(
                theme as 'dark' | 'light', 
                getTextContent(link.children), 
                url, 
                title
              )
            )

            i = linkIndex
            continue
          }
        }

        // 3. Fallback: Check for Combined Pattern inside single Text node
        let lastIndex = 0
        THEME_IMAGE_RE.lastIndex = 0
        let match = THEME_IMAGE_RE.exec(value)

        while (match) {
          changed = true
          const [raw, theme, alt, url, title] = match
          const start = match.index

          if (start > lastIndex) {
            nextChildren.push({
              type: 'text',
              value: value.slice(lastIndex, start)
            })
          }

          nextChildren.push(
            ...createThemeImageNodes(theme as 'dark' | 'light', alt, url, title)
          )
          
          lastIndex = start + raw.length
          match = THEME_IMAGE_RE.exec(value)
        }

        if (lastIndex < value.length) {
          nextChildren.push({
            type: 'text',
            value: value.slice(lastIndex)
          })
        }
      }

      if (changed) {
        node.children = nextChildren
      }
    })
  }
}

export default remarkThemeImages