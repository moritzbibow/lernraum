import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { getDb, type Tx } from '../db/client'
import { inboxItems, questions, quizzes } from '../db/schema'
import { newId } from '../ids'
import { loadLibrary, pagePathLabel, pageUrl, type Library } from './library'
import { quizPlayUrl } from './urls'

export function addInboxItem(tx: Tx, kind: 'page' | 'quiz', refId: string, action: 'created' | 'updated', now = Date.now()) {
  // At most one unseen entry per item.
  tx.delete(inboxItems)
    .where(and(eq(inboxItems.kind, kind), eq(inboxItems.refId, refId), isNull(inboxItems.seenAt)))
    .run()
  tx.insert(inboxItems).values({ id: newId(), kind, refId, action, createdAt: now }).run()
}

export function markSeen(kind: 'page' | 'quiz', refId: string, tx: Tx = getDb()): boolean {
  const result = tx
    .update(inboxItems)
    .set({ seenAt: Date.now() })
    .where(and(eq(inboxItems.kind, kind), eq(inboxItems.refId, refId), isNull(inboxItems.seenAt)))
    .run()
  return result.changes > 0
}

export function markAllSeen(tx: Tx = getDb()): number {
  return tx.update(inboxItems).set({ seenAt: Date.now() }).where(isNull(inboxItems.seenAt)).run().changes
}

/** Unseen items whose target still exists. */
export function unseenCount(tx: Tx = getDb()): number {
  const row = tx.get<{ n: number }>(sql`
    SELECT count(*) AS n FROM inbox_items i
    WHERE i.seen_at IS NULL AND (
      (i.kind = 'page' AND EXISTS (SELECT 1 FROM pages p WHERE p.id = i.ref_id AND p.deleted_at IS NULL))
      OR (i.kind = 'quiz' AND EXISTS (
        SELECT 1 FROM quizzes q JOIN pages p ON p.id = q.page_id
        WHERE q.id = i.ref_id AND q.deleted_at IS NULL AND p.deleted_at IS NULL))
    )`)
  return row?.n ?? 0
}

/** Newest unseen item timestamp – lets the UI detect fresh ingests cheaply. */
export function inboxSignature(tx: Tx = getDb()): { unseen: number; latest: number } {
  const latest = tx.get<{ t: number | null }>(sql`SELECT max(created_at) AS t FROM inbox_items`)
  return { unseen: unseenCount(tx), latest: latest?.t ?? 0 }
}

export type InboxEntry = {
  id: string
  kind: 'page' | 'quiz'
  action: 'created' | 'updated'
  refId: string
  title: string
  path: string
  url: string
  createdAt: number
  seen: boolean
  questionCount?: number
  pageTitle?: string
  subjectHue?: number | null
}

export function listInbox(opts: { limit?: number; lib?: Library } = {}, tx: Tx = getDb()): InboxEntry[] {
  const { limit = 100 } = opts
  const lib = opts.lib ?? loadLibrary(tx)
  const rows = tx.select().from(inboxItems).orderBy(desc(inboxItems.createdAt)).limit(limit * 2).all()

  const quizIds = rows.filter((r) => r.kind === 'quiz').map((r) => r.refId)
  const quizRows = quizIds.length
    ? tx
        .select({
          id: quizzes.id,
          title: quizzes.title,
          pageId: quizzes.pageId,
          count: sql<number>`(SELECT count(*) FROM questions qq WHERE qq.quiz_id = quizzes.id)`,
        })
        .from(quizzes)
        .where(and(inArray(quizzes.id, quizIds), isNull(quizzes.deletedAt)))
        .all()
    : []
  const quizById = new Map(quizRows.map((q) => [q.id, q]))

  const out: InboxEntry[] = []
  for (const r of rows) {
    if (out.length >= limit) break
    if (r.kind === 'page') {
      const page = lib.pageById.get(r.refId)
      const url = page ? pageUrl(lib, page.id) : null
      if (!page || !url) continue
      out.push({
        id: r.id,
        kind: 'page',
        action: r.action,
        refId: r.refId,
        title: page.title,
        path: pagePathLabel(lib, page.id, { includeSelf: false }),
        url,
        createdAt: r.createdAt,
        seen: r.seenAt !== null,
        subjectHue: page.subjectId ? (lib.subjectById.get(page.subjectId)?.hue ?? null) : null,
      })
    } else {
      const quiz = quizById.get(r.refId)
      const page = quiz ? lib.pageById.get(quiz.pageId) : undefined
      if (!quiz || !page) continue
      out.push({
        id: r.id,
        kind: 'quiz',
        action: r.action,
        refId: r.refId,
        title: quiz.title,
        path: pagePathLabel(lib, page.id),
        url: quizPlayUrl(quiz.id),
        createdAt: r.createdAt,
        seen: r.seenAt !== null,
        questionCount: quiz.count,
        pageTitle: page.title,
        subjectHue: page.subjectId ? (lib.subjectById.get(page.subjectId)?.hue ?? null) : null,
      })
    }
  }
  return out
}

/** Page ids with an unseen inbox entry ("NEU" markers in the tree). */
export function unseenPageIds(tx: Tx = getDb()): Set<string> {
  const rows = tx
    .select({ refId: inboxItems.refId })
    .from(inboxItems)
    .where(and(eq(inboxItems.kind, 'page'), isNull(inboxItems.seenAt)))
    .all()
  const quizRows = tx
    .select({ pageId: quizzes.pageId })
    .from(inboxItems)
    .innerJoin(quizzes, eq(quizzes.id, inboxItems.refId))
    .where(and(eq(inboxItems.kind, 'quiz'), isNull(inboxItems.seenAt)))
    .all()
  return new Set([...rows.map((r) => r.refId), ...quizRows.map((r) => r.pageId)])
}
