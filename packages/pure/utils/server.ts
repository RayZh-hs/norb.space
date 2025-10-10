import { getCollection, type CollectionEntry } from 'astro:content'

type BlogEntry = CollectionEntry<'blog'>
type BlogCollections = BlogEntry[]

export const prod = import.meta.env.PROD

/** Note: this function filters out draft posts based on the environment */
export async function getBlogCollection() {
  return getCollection('blog', ({ data }) => {
    if (!prod) return true
    return data.draft !== true
  })
}

function getYearFromCollection(collection: BlogEntry): number | undefined {
  const dateStr = collection.data.updatedDate ?? collection.data.publishDate
  return dateStr ? new Date(dateStr).getFullYear() : undefined
}
export function groupCollectionsByYear(collections: BlogCollections): [number, BlogCollections][] {
  const collectionsByYear = collections.reduce((acc, collection) => {
    const year = getYearFromCollection(collection)
    if (year !== undefined) {
      if (!acc.has(year)) {
        acc.set(year, [])
      }
      acc.get(year)!.push(collection)
    }
    return acc
  }, new Map<number, BlogCollections>())

  return Array.from(
    collectionsByYear.entries() as IterableIterator<[number, BlogCollections]>
  ).sort((a, b) => b[0] - a[0])
}

export function sortMDByDate(collections: BlogCollections): BlogCollections {
  return collections.sort((a, b) => {
    const aDate = new Date(a.data.updatedDate ?? a.data.publishDate ?? 0).valueOf()
    const bDate = new Date(b.data.updatedDate ?? b.data.publishDate ?? 0).valueOf()
    return bDate - aDate
  })
}

/** Note: This function doesn't filter draft posts, pass it the result of getAllPosts above to do so. */
export function getAllTags(collections: BlogCollections) {
  return collections.flatMap((collection) => collection.data.tags)
}

/** Note: This function doesn't filter draft posts, pass it the result of getAllPosts above to do so. */
export function getUniqueTags(collections: BlogCollections) {
  return [...new Set(getAllTags(collections))]
}

/** Note: This function doesn't filter draft posts, pass it the result of getAllPosts above to do so. */
export function getUniqueTagsWithCount(collections: BlogCollections): [string, number][] {
  return [
    ...getAllTags(collections).reduce(
      (acc, t) => acc.set(t, (acc.get(t) || 0) + 1),
      new Map<string, number>()
    )
  ].sort((a, b) => b[1] - a[1])
}
