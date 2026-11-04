/** Durable, session-scoped Jarvis memory. Stored using OpenCode's native
 * Session.Metadata events and SQLite projection; no second datastore.
 * This does not implement cross-session FTS5 personal-profile indexing.
 */
export type MemoryItem = {
  id: string
  text: string
  at: number
}
export type MemoryState = { items: MemoryItem[] }

export function itemsOf(metadata: Record<string, unknown> | undefined): MemoryItem[] {
  const candidate = metadata?.jarvisMemory
  if (!candidate || typeof candidate !== "object" || !("items" in candidate)) return []
  const items = (candidate as MemoryState).items
  if (!Array.isArray(items)) return []
  return items.filter((item): item is MemoryItem =>
    !!item && typeof item.id === "string" && typeof item.text === "string" &&
    typeof item.at === "number" && Number.isFinite(item.at),
  ).slice(-128)
}

export function remember(metadata: Record<string, unknown> | undefined, text: string, id: string, at: number) {
  const value = text.trim().slice(0, 1500)
  if (!value) throw new Error("Memory cannot be empty")
  if (!id || !Number.isFinite(at)) throw new Error("Invalid memory identity")
  const previous = itemsOf(metadata).filter((item) => item.id !== id)
  const items = [...previous, { id, text: value, at }].slice(-128)
  return { ...(metadata ?? {}), jarvisMemory: { items } }
}

export function forget(metadata: Record<string, unknown> | undefined, id: string) {
  const previous = itemsOf(metadata)
  const items = previous.filter((item) => item.id !== id)
  return { metadata: { ...(metadata ?? {}), jarvisMemory: { items } }, removed: items.length !== previous.length }
}

export function findMemories(metadata: Record<string, unknown> | undefined, query: string, limit = 10) {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
  const matching = itemsOf(metadata).filter((item) =>
    !words.length || words.every((word) => item.text.toLocaleLowerCase().includes(word)),
  )
  return matching.slice(-Math.min(Math.max(1, limit), 30)).reverse()
}
