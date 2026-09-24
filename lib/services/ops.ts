import { and, asc, eq, isNull, ne, or, type SQL } from 'drizzle-orm'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'
import { pickSubjectColor } from '../colors'
import type { Tx } from '../db/client'
import { pages, subjects, type ContentSource, type Topic } from '../db/schema'
import { newId } from '../ids'
import { slugify, uniqueSlug } from '../slug'
import { naturalCompare, normalizeForMatch } from '../text'

/* Low-level building blocks shared by ingest and the management actions. */

export function eqOrNull(column: SQLiteColumn, value: string | null): SQL {
  return value === null ? isNull(column) : eq(column, value)
}

export type SiblingRow = { id: string; slug: string; title: string; sort: number }

export function liveSiblings(tx: Tx, subjectId: string | null, parentId: string | null, excludeId?: string): SiblingRow[] {
  const conditions = [eqOrNull(pages.subjectId, subjectId), eqOrNull(pages.parentId, parentId), isNull(pages.deletedAt)]
  if (excludeId) conditions.push(ne(pages.id, excludeId))
  return tx
    .select({ id: pages.id, slug: pages.slug, title: pages.title, sort: pages.sort })
    .from(pages)
    .where(and(...conditions))
    .orderBy(asc(pages.sort))
    .all()
}

/** Finds a live sibling by slug or (tolerant) title. */
export function findSibling(siblings: SiblingRow[], title: string): SiblingRow | undefined {
  const slug = slugify(title)
  const norm = normalizeForMatch(title)
  return siblings.find((s) => s.slug === slug) ?? siblings.find((s) => normalizeForMatch(s.title) === norm)
}

/**
 * Position for a new sibling. Numbered series that are in natural order
 * ("Stunde 1, 2, 3 …") get the new page at its natural place so late additions
 * still line up; everything else is appended in creation order.
 */
export function placeNewSibling(tx: Tx, siblings: SiblingRow[], title: string): number {
  if (siblings.length === 0) return 0
  const ordered = [...siblings].sort((a, b) => a.sort - b.sort)
  const last = ordered[ordered.length - 1]
  // Only numbered series ("Stunde 3", "Kapitel 2") are kept in natural order.
  const numbered = /\d/.test(title) && ordered.every((s) => /\d/.test(s.title))
  const natural = numbered && ordered.every((s, i) => i === 0 || naturalCompare(ordered[i - 1].title, s.title) <= 0)
  if (!natural) return last.sort + 1
  const index = ordered.findIndex((s) => naturalCompare(title, s.title) < 0)
  if (index === -1) return last.sort + 1
  ordered.forEach((s, i) => {
    const sort = i < index ? i : i + 1
    if (s.sort !== sort) tx.update(pages).set({ sort }).where(eq(pages.id, s.id)).run()
  })
  return index
}

export type NewPage = {
  subjectId: string | null
  parentId: string | null
  title: string
  heading?: string | null
  kicker?: string | null
  lessonDate?: string | null
  contentMd?: string
  topics?: Topic[]
  wordCount?: number
  source: ContentSource
}

export function createPageRow(tx: Tx, input: NewPage, now = Date.now()): string {
  const siblings = liveSiblings(tx, input.subjectId, input.parentId)
  const id = newId()
  const sort = placeNewSibling(tx, siblings, input.title)
  const hasContent = Boolean(input.contentMd?.trim())
  tx.insert(pages)
    .values({
      id,
      subjectId: input.subjectId,
      parentId: input.parentId,
      slug: uniqueSlug(slugify(input.title), siblings.map((s) => s.slug)),
      title: input.title,
      heading: input.heading ?? null,
      kicker: input.kicker ?? null,
      lessonDate: input.lessonDate ?? null,
      sort,
      contentMd: input.contentMd ?? '',
      topics: input.topics ?? [],
      wordCount: input.wordCount ?? 0,
      source: input.source,
      createdAt: now,
      updatedAt: now,
      contentUpdatedAt: hasContent ? now : null,
    })
    .run()
  return id
}

export type SubjectLite = { id: string; slug: string; name: string }

export function findSubject(tx: Tx, nameOrSlug: string): SubjectLite | undefined {
  const slug = slugify(nameOrSlug)
  const norm = normalizeForMatch(nameOrSlug)
  const rows = tx
    .select({ id: subjects.id, slug: subjects.slug, name: subjects.name })
    .from(subjects)
    .where(and(isNull(subjects.deletedAt), or(eq(subjects.slug, slug), eq(subjects.id, nameOrSlug))))
    .all()
  if (rows.length) return rows[0]
  return tx
    .select({ id: subjects.id, slug: subjects.slug, name: subjects.name })
    .from(subjects)
    .where(isNull(subjects.deletedAt))
    .all()
    .find((s) => normalizeForMatch(s.name) === norm)
}

export function createSubjectRow(tx: Tx, name: string, now = Date.now()): SubjectLite {
  const live = tx
    .select({ slug: subjects.slug, hue: subjects.hue, sort: subjects.sort })
    .from(subjects)
    .where(isNull(subjects.deletedAt))
    .all()
  const color = pickSubjectColor(name, live.map((s) => s.hue))
  const id = newId()
  const slug = uniqueSlug(slugify(name), live.map((s) => s.slug))
  tx.insert(subjects)
    .values({
      id,
      slug,
      name,
      hue: color.hue,
      lightness: color.lightness,
      chroma: color.chroma,
      sort: live.reduce((m, s) => Math.max(m, s.sort + 1), 0),
      createdAt: now,
      updatedAt: now,
    })
    .run()
  return { id, slug, name }
}

/** Topic progress fractions → overall reading progress (a topic ≥ 80 % counts as done). */
export function computeReadProgress(topics: Topic[], progress: Record<string, number>): number {
  const keys = topics.length ? topics.map((t) => t.id) : ['_all']
  const sum = keys.reduce((acc, key) => {
    const f = Math.max(0, Math.min(1, progress[key] ?? 0))
    return acc + (f >= 0.8 ? 1 : f)
  }, 0)
  return Math.round((sum / keys.length) * 1000) / 1000
}

/** Monotonic id for soft-delete batches (so one "Rückgängig" restores exactly one delete). */
let lastBatch = 0
export function nextDeleteBatch(): number {
  lastBatch = Math.max(Date.now(), lastBatch + 1)
  return lastBatch
}
