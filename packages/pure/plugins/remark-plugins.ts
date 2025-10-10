import type { Image, Root } from 'mdast'
import type { Plugin } from 'unified'
import type { VFile } from 'vfile'
import { visit } from 'unist-util-visit'

// Cannot use '../utils' for plugin absolute path
import mdastToString from '../utils/mdast-util-to-string'
import getReadingTime from '../utils/reading-time'

export const remarkAddZoomable: Plugin<[{ className?: string }], Root> = function ({
  className = 'zoomable'
}) {
  return function (tree: Root) {
    visit(tree, 'image', (node: Image) => {
      node.data ??= {}
      node.data.hProperties = { class: className }
    })
  }
}

export const remarkReadingTime: Plugin<[], Root> = function () {
  return function (tree: Root, file: VFile) {
    const textOnPage = mdastToString(tree)
    const readingTime = getReadingTime(textOnPage)
    // readingTime.text will give us minutes read as a friendly string,
    // i.e. "3 min read"
    const frontmatter = (file.data as Record<string, unknown>)?.astro as
      | { frontmatter?: Record<string, unknown> }
      | undefined
    if (frontmatter?.frontmatter) {
      frontmatter.frontmatter.minutesRead = readingTime.text
      frontmatter.frontmatter.words = readingTime.words
    }
  }
}
