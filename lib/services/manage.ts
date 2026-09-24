import { and, eq, inArray, isNull, lt, sql } from 'drizzle-orm'
import { getDb, type Tx } from '../db/client'
import { inboxItems, pages, quizzes, subjects } from '../db/schema'
import { slugify, uniqueSlug } from '../slug'
import { ConflictError, NotFoundError, ValidationError } from './errors'
import { containerKey, descendantIds, loadLibrary, type Library } from './library'
import { createPageRow, createSubjectRow, liveSiblings, nextDeleteBatch } from './ops'

/*
 * Everything the "Verwalten" UI may do: create subjects/folders, rename, move,
 * delete (soft, undoable) – but never create content.
 */

export type ItemRef = { kind: 'subject' | 'page' | 'quiz'; id: string }

export function createSubject(name: string): { id: string; slug: string } {
  const clean = name.trim()
  if (!clean) throw new ValidationError('Name fehlt.')
  return getDb().transaction((tx) => createSubjectRow(tx, clean))
}

export function createFolder(input: { subjectId: string | null; parentId: string | null; title: string }): string {
  const title = input.title.trim()
  if (!title) throw new ValidationError('Name fehlt.')
  return getDb().transaction((tx) => {
    const lib = loadLibrary(tx)
    if (input.subjectId && !lib.subjectById.has(input.subjectId)) throw new NotFoundError('Fach nicht gefunden.')
    if (input.parentId) {
      const parent = lib.pageById.get(input.parentId)
      if (!parent) throw new NotFoundError('Übergeordnete Seite nicht gefunden.')
      if (parent.subjectId !== input.subjectId) throw new ValidationError('Ordner und Fach passen nicht zusammen.')
    }
    return createPageRow(tx, { subjectId: input.subjectId, parentId: input.parentId, title, source: 'manual' })
  })
}

export function renameItem(ref: ItemRef, name: string): void {
  const clean = name.trim()
  if (!clean) throw new ValidationError('Name fehlt.')
  const db = getDb()
  const now = Date.now()
  db.transaction((tx) => {
    if (ref.kind === 'subject') {
      const subject = tx.select().from(subjects).where(and(eq(subjects.id, ref.id), isNull(subjects.deletedAt))).get()
      if (!subject) throw new NotFoundError('Fach nicht gefunden.')
      const taken = tx
        .select({ slug: subjects.slug })
        .from(subjects)
        .where(and(isNull(subjects.deletedAt), sql`${subjects.id} <> ${ref.id}`))
        .all()
        .map((s) => s.slug)
      tx.update(subjects)
        .set({ name: clean, slug: uniqueSlug(slugify(clean), taken), updatedAt: now })
        .where(eq(subjects.id, ref.id))
        .run()
    } else if (ref.kind === 'page') {
      const page = tx.select().from(pages).where(and(eq(pages.id, ref.id), isNull(pages.deletedAt))).get()
      if (!page) throw new NotFoundError('Seite nicht gefunden.')
      const siblings = liveSiblings(tx, page.subjectId, page.parentId, page.id)
      tx.update(pages)
        .set({ title: clean, slug: uniqueSlug(slugify(clean), siblings.map((s) => s.slug)), updatedAt: now })
        .where(eq(pages.id, ref.id))
        .run()
    } else {
      const changed = tx
        .update(quizzes)
        .set({ title: clean, updatedAt: now })
        .where(and(eq(quizzes.id, ref.id), isNull(quizzes.deletedAt)))
        .run().changes
      if (!changed) throw new NotFoundError('Quiz nicht gefunden.')
    }
  })
}

export type MoveTarget = {
  /** Destination container: subject (or null = Allgemeine Seiten) and parent page (or null = top level). */
  subjectId: string | null
  parentId: string | null
  /** Optional position among the new siblings. */
  beforeId?: string | null
  afterId?: string | null
}

/** Moves pages (with their subtrees and quizzes) into another container. */
export function movePages(ids: string[], target: MoveTarget): number {
  const db = getDb()
  const now = Date.now()
  return db.transaction((tx) => {
    const lib = loadLibrary(tx)
    if (target.subjectId && !lib.subjectById.has(target.subjectId)) throw new NotFoundError('Ziel-Fach nicht gefunden.')
    if (target.parentId) {
      const parent = lib.pageById.get(target.parentId)
      if (!parent) throw new NotFoundError('Zielseite nicht gefunden.')
      if (parent.subjectId !== target.subjectId) throw new ValidationError('Zielseite gehört zu einem anderen Fach.')
    }

    const selected = new Set(ids.filter((id) => lib.pageById.has(id)))
    // Only move top-most selected pages – their descendants come along.
    const roots = [...selected].filter((id) => {
      let p = lib.pageById.get(id)?.parentId
      while (p) {
        if (selected.has(p)) return false
        p = lib.pageById.get(p)?.parentId ?? null
      }
      return true
    })
    if (roots.length === 0) return 0

    for (const id of roots) {
      if (target.parentId && (target.parentId === id || descendantIds(lib, id).includes(target.parentId))) {
        throw new ConflictError('Eine Seite kann nicht in sich selbst oder ihre Unterseiten verschoben werden.')
      }
    }

    // New order of the destination container.
    const key = containerKey(target.subjectId, target.parentId)
    const existing = (lib.children.get(key) ?? []).filter((p) => !roots.includes(p.id)).map((p) => p.id)
    let insertAt = existing.length
    if (target.beforeId) {
      const i = existing.indexOf(target.beforeId)
      if (i >= 0) insertAt = i
    } else if (target.afterId) {
      const i = existing.indexOf(target.afterId)
      if (i >= 0) insertAt = i + 1
    }
    const ordered = [...existing.slice(0, insertAt), ...roots, ...existing.slice(insertAt)]

    const takenSlugs = new Set((lib.children.get(key) ?? []).filter((p) => !roots.includes(p.id)).map((p) => p.slug))
    for (const id of roots) {
      const page = lib.pageById.get(id)!
      const slug = uniqueSlug(page.slug, takenSlugs)
      takenSlugs.add(slug)
      tx.update(pages)
        .set({ subjectId: target.subjectId, parentId: target.parentId, slug, updatedAt: now })
        .where(eq(pages.id, id))
        .run()
      const descendants = descendantIds(lib, id)
      if (descendants.length && page.subjectId !== target.subjectId) {
        tx.update(pages).set({ subjectId: target.subjectId }).where(inArray(pages.id, descendants)).run()
      }
    }
    ordered.forEach((id, sort) => {
      tx.update(pages).set({ sort }).where(eq(pages.id, id)).run()
    })
    return roots.length
  })
}

/** Reorders subjects (drag & drop in Verwalten). */
export function moveSubject(id: string, position: { beforeId?: string | null; afterId?: string | null }): void {
  const db = getDb()
  db.transaction((tx) => {
    const lib = loadLibrary(tx)
    if (!lib.subjectById.has(id)) throw new NotFoundError('Fach nicht gefunden.')
    const others = lib.subjects.filter((s) => s.id !== id).map((s) => s.id)
    let insertAt = others.length
    if (position.beforeId) {
      const i = others.indexOf(position.beforeId)
      if (i >= 0) insertAt = i
    } else if (position.afterId) {
      const i = others.indexOf(position.afterId)
      if (i >= 0) insertAt = i + 1
    }
    const ordered = [...others.slice(0, insertAt), id, ...others.slice(insertAt)]
    ordered.forEach((sid, sort) => tx.update(subjects).set({ sort }).where(eq(subjects.id, sid)).run())
  })
}

/** Attaches a quiz to another page. */
export function moveQuiz(quizId: string, pageId: string): void {
  const db = getDb()
  db.transaction((tx) => {
    const page = tx.select({ id: pages.id }).from(pages).where(and(eq(pages.id, pageId), isNull(pages.deletedAt))).get()
    if (!page) throw new NotFoundError('Zielseite nicht gefunden.')
    const changed = tx
      .update(quizzes)
      .set({ pageId, updatedAt: Date.now() })
      .where(and(eq(quizzes.id, quizId), isNull(quizzes.deletedAt)))
      .run().changes
    if (!changed) throw new NotFoundError('Quiz nicht gefunden.')
  })
}

function pageIdsInSubtrees(lib: Library, roots: string[]): string[] {
  const out = new Set<string>()
  for (const id of roots) {
    if (!lib.pageById.has(id)) continue
    out.add(id)
    for (const d of descendantIds(lib, id)) out.add(d)
  }
  return [...out]
}

/** Soft-deletes items (subtrees included). Returns the batch id for "Rückgängig". */
export function deleteItems(items: ItemRef[]): { batch: number; count: number } {
  const db = getDb()
  const batch = nextDeleteBatch()
  const count = db.transaction((tx) => {
    const lib = loadLibrary(tx)
    let n = 0
    const subjectIds = items.filter((i) => i.kind === 'subject' && lib.subjectById.has(i.id)).map((i) => i.id)
    const pageRoots = items.filter((i) => i.kind === 'page').map((i) => i.id)
    for (const sid of subjectIds) {
      for (const p of lib.pages.filter((p) => p.subjectId === sid)) pageRoots.push(p.id)
    }
    const pageIds = pageIdsInSubtrees(lib, pageRoots)
    if (subjectIds.length) {
      n += tx.update(subjects).set({ deletedAt: batch }).where(inArray(subjects.id, subjectIds)).run().changes
    }
    if (pageIds.length) {
      n += tx.update(pages).set({ deletedAt: batch }).where(and(inArray(pages.id, pageIds), isNull(pages.deletedAt))).run().changes
      tx.update(quizzes)
        .set({ deletedAt: batch })
        .where(and(inArray(quizzes.pageId, pageIds), isNull(quizzes.deletedAt)))
        .run()
    }
    const quizIds = items.filter((i) => i.kind === 'quiz').map((i) => i.id)
    if (quizIds.length) {
      n += tx.update(quizzes).set({ deletedAt: batch }).where(and(inArray(quizzes.id, quizIds), isNull(quizzes.deletedAt))).run().changes
    }
    return n
  })
  return { batch, count }
}

/** Restores everything deleted in one batch (slug clashes get a suffix). */
export function restoreBatch(batch: number): number {
  const db = getDb()
  return db.transaction((tx) => {
    let n = 0
    const deletedSubjects = tx.select().from(subjects).where(eq(subjects.deletedAt, batch)).all()
    for (const s of deletedSubjects) {
      const taken = tx.select({ slug: subjects.slug }).from(subjects).where(isNull(subjects.deletedAt)).all().map((r) => r.slug)
      tx.update(subjects).set({ deletedAt: null, slug: uniqueSlug(s.slug, taken) }).where(eq(subjects.id, s.id)).run()
      n++
    }
    const deletedPages = tx.select().from(pages).where(eq(pages.deletedAt, batch)).all()
    // Parents first, so children find their container alive.
    const byId = new Map(deletedPages.map((p) => [p.id, p]))
    const depth = (id: string): number => {
      const p = byId.get(id)
      return p?.parentId && byId.has(p.parentId) ? 1 + depth(p.parentId) : 0
    }
    for (const p of [...deletedPages].sort((a, b) => depth(a.id) - depth(b.id))) {
      const siblings = liveSiblings(tx, p.subjectId, p.parentId)
      tx.update(pages)
        .set({ deletedAt: null, slug: uniqueSlug(p.slug, siblings.map((s) => s.slug)) })
        .where(eq(pages.id, p.id))
        .run()
      n++
    }
    n += tx.update(quizzes).set({ deletedAt: null }).where(eq(quizzes.deletedAt, batch)).run().changes
    return n
  })
}

/** Hard-deletes items that were soft-deleted more than `days` ago. */
export function purgeDeleted(days = 7, tx: Tx = getDb()): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  let n = 0
  n += tx.delete(quizzes).where(lt(quizzes.deletedAt, cutoff)).run().changes
  n += tx.delete(pages).where(lt(pages.deletedAt, cutoff)).run().changes
  n += tx.delete(subjects).where(lt(subjects.deletedAt, cutoff)).run().changes
  // Pages whose parent no longer exists at all.
  n += tx
    .delete(pages)
    .where(sql`${pages.parentId} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pages p2 WHERE p2.id = ${pages.parentId})`)
    .run().changes
  tx.delete(inboxItems)
    .where(
      sql`(${inboxItems.kind} = 'page' AND NOT EXISTS (SELECT 1 FROM pages p WHERE p.id = ${inboxItems.refId}))
       OR (${inboxItems.kind} = 'quiz' AND NOT EXISTS (SELECT 1 FROM quizzes q WHERE q.id = ${inboxItems.refId}))`,
    )
    .run()
  return n
}
