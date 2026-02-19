import type { Paragraph, Root, Text } from 'mdast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

const CAPTION_RE = /^\s*\{\{([\s\S]*?)\}\}\s*$/

export const remarkImageCaption: Plugin<[], Root> = function () {
  return function (tree: Root) {
    visit(tree, 'paragraph', (node: Paragraph) => {
      if (node.children.length !== 1) return

      const child = node.children[0]
      if (child.type !== 'text') return

      const value = (child as Text).value
      const match = value.match(CAPTION_RE)
      if (!match) return

      const caption = match[1].trim()
      if (!caption) return

      ;(child as Text).value = caption
      node.data ??= {}
      node.data.hName = 'p'
      node.data.hProperties = {
        ...((node.data.hProperties ?? {}) as Record<string, unknown>),
        className: ['image-caption']
      }
    })
  }
}
