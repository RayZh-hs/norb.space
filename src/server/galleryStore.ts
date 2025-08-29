// Simple in-memory store for current dev/preview session

export type PexelsPhoto = {
  id: number
  width: number
  height: number
  alt: string
  photographer: string
  src: Record<string, string>
}

export type Selection = {
  uuid: string
  createdAt: number
  photos: PexelsPhoto[]
}

const selections = new Map<string, Selection>()

export function createSelection(photos: PexelsPhoto[]): Selection {
  const g: typeof globalThis = globalThis
  const uuid = g.crypto && typeof g.crypto.randomUUID === 'function'
    ? g.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const sel: Selection = { uuid, createdAt: Date.now(), photos }
  selections.set(uuid, sel)
  return sel
}

export function getSelection(uuid: string): Selection | undefined {
  return selections.get(uuid)
}

// Optional cleanup util (not used yet)
export function pruneOldSelections(ttlMs = 10 * 60 * 1000) {
  const now = Date.now()
  for (const [id, sel] of selections.entries()) {
    if (now - sel.createdAt > ttlMs) selections.delete(id)
  }
}
