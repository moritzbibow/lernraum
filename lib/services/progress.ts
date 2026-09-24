import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { pages } from '../db/schema'
import { markSeen } from './inbox'
import { computeReadProgress } from './ops'

/** Called when a page is actually viewed (not on prefetch). */
export function recordPageOpen(pageId: string): { hadUnseen: boolean } {
  const db = getDb()
  const hadUnseen = db.transaction((tx) => {
    tx.update(pages).set({ lastOpenedAt: Date.now() }).where(eq(pages.id, pageId)).run()
    return markSeen('page', pageId, tx)
  })
  return { hadUnseen }
}

export function recordQuizOpen(quizId: string): { hadUnseen: boolean } {
  return { hadUnseen: markSeen('quiz', quizId) }
}

/** Merges per-topic scroll progress (0–1, only ever increases). */
export function updateTopicProgress(pageId: string, fractions: Record<string, number>): number | null {
  const db = getDb()
  return db.transaction((tx) => {
    const page = tx
      .select({ topics: pages.topics, topicProgress: pages.topicProgress })
      .from(pages)
      .where(eq(pages.id, pageId))
      .get()
    if (!page) return null
    const valid = new Set([...page.topics.map((t) => t.id), '_all'])
    const merged = { ...page.topicProgress }
    for (const [key, value] of Object.entries(fractions)) {
      if (!valid.has(key) || typeof value !== 'number' || !Number.isFinite(value)) continue
      merged[key] = Math.max(merged[key] ?? 0, Math.min(1, Math.max(0, Math.round(value * 1000) / 1000)))
    }
    const readProgress = computeReadProgress(page.topics, merged)
    tx.update(pages).set({ topicProgress: merged, readProgress }).where(eq(pages.id, pageId)).run()
    return readProgress
  })
}
