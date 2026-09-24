import { and, asc, isNull, sql } from 'drizzle-orm'
import { getDb, type Tx } from '../db/client'
import { pages, subjects } from '../db/schema'
import { naturalCompare } from '../text'
import { pageUrlFromSlugs } from './urls'

/*
 * In-memory snapshot of the live library (subjects + page tree, without page
 * content). A personal library has at most a few thousand pages, so building
 * paths and trees in memory is simpler and faster than recursive SQL.
 */

export type SubjectRow = typeof subjects.$inferSelect

export type PageLite = {
  id: string
  subjectId: string | null
  parentId: string | null
  slug: string
  title: string
  heading: string | null
  sort: number
  hasContent: boolean
  wordCount: number
  source: 'claude' | 'manual'
  createdAt: number
  updatedAt: number
  contentUpdatedAt: number | null
  lastOpenedAt: number | null
  readProgress: number
}

export type Library = {
  subjects: SubjectRow[]
  subjectById: Map<string, SubjectRow>
  pages: PageLite[]
  pageById: Map<string, PageLite>
  /** children by container key: page id, `s:<subjectId>` or `general` */
  children: Map<string, PageLite[]>
}

export function containerKey(subjectId: string | null, parentId: string | null): string {
  if (parentId) return parentId
  return subjectId ? `s:${subjectId}` : 'general'
}

export function loadLibrary(tx: Tx = getDb()): Library {
  const subjectRows = tx
    .select()
    .from(subjects)
    .where(isNull(subjects.deletedAt))
    .orderBy(asc(subjects.sort), asc(subjects.createdAt))
    .all()
  const pageRows = tx
    .select({
      id: pages.id,
      subjectId: pages.subjectId,
      parentId: pages.parentId,
      slug: pages.slug,
      title: pages.title,
      heading: pages.heading,
      sort: pages.sort,
      hasContent: sql<number>`length(trim(${pages.contentMd})) > 0`,
      wordCount: pages.wordCount,
      source: pages.source,
      createdAt: pages.createdAt,
      updatedAt: pages.updatedAt,
      contentUpdatedAt: pages.contentUpdatedAt,
      lastOpenedAt: pages.lastOpenedAt,
      readProgress: pages.readProgress,
    })
    .from(pages)
    .where(and(isNull(pages.deletedAt)))
    .all()
    .map((p) => ({ ...p, hasContent: Boolean(p.hasContent) }))

  const subjectById = new Map(subjectRows.map((s) => [s.id, s]))
  const pageById = new Map(pageRows.map((p) => [p.id, p]))
  const children = new Map<string, PageLite[]>()
  for (const p of pageRows) {
    // Orphans (parent deleted/missing) are shown at the container root.
    const parentAlive = p.parentId ? pageById.has(p.parentId) : false
    const key = containerKey(p.subjectId, parentAlive ? p.parentId : null)
    if (p.subjectId && !subjectById.has(p.subjectId)) continue
    const list = children.get(key)
    if (list) list.push(p)
    else children.set(key, [p])
  }
  for (const list of children.values()) {
    list.sort((a, b) => a.sort - b.sort || naturalCompare(a.title, b.title))
  }
  return { subjects: subjectRows, subjectById, pages: pageRows, pageById, children }
}

export function childrenOf(lib: Library, subjectId: string | null, parentId: string | null): PageLite[] {
  return lib.children.get(containerKey(subjectId, parentId)) ?? []
}

/** Ancestors from the top-level page down to (and including) the page itself. */
export function pageTrail(lib: Library, pageId: string): PageLite[] {
  const trail: PageLite[] = []
  const seen = new Set<string>()
  let current = lib.pageById.get(pageId)
  while (current && !seen.has(current.id)) {
    trail.unshift(current)
    seen.add(current.id)
    current = current.parentId ? lib.pageById.get(current.parentId) : undefined
  }
  return trail
}

export function pageUrl(lib: Library, pageId: string): string | null {
  const page = lib.pageById.get(pageId)
  if (!page) return null
  const subject = page.subjectId ? lib.subjectById.get(page.subjectId) : null
  if (page.subjectId && !subject) return null
  return pageUrlFromSlugs(subject ? subject.slug : null, pageTrail(lib, pageId).map((p) => p.slug))
}

/** "Sport › Sporttheorie › Stunde 5 – Ausdauertraining" */
export function pagePathLabel(lib: Library, pageId: string, opts: { includeSelf?: boolean; includeSubject?: boolean } = {}): string {
  const { includeSelf = true, includeSubject = true } = opts
  const page = lib.pageById.get(pageId)
  if (!page) return ''
  const trail = pageTrail(lib, pageId)
  const names = (includeSelf ? trail : trail.slice(0, -1)).map((p) => p.title)
  if (includeSubject) {
    const subject = page.subjectId ? lib.subjectById.get(page.subjectId) : null
    names.unshift(subject ? subject.name : 'Allgemein')
  }
  return names.join(' › ')
}

export function descendantIds(lib: Library, pageId: string): string[] {
  const out: string[] = []
  const stack = [pageId]
  while (stack.length) {
    const id = stack.pop()!
    for (const child of lib.children.get(id) ?? []) {
      out.push(child.id)
      stack.push(child.id)
    }
  }
  return out
}

/** Resolves a URL path (subject slug or null for "Allgemein" + page slugs) to a page. */
export function resolvePagePath(lib: Library, subjectSlug: string | null, slugs: string[]): PageLite | null {
  let subjectId: string | null = null
  if (subjectSlug !== null) {
    const subject = lib.subjects.find((s) => s.slug === subjectSlug)
    if (!subject) return null
    subjectId = subject.id
  }
  let parentId: string | null = null
  let found: PageLite | null = null
  for (const slug of slugs) {
    found = childrenOf(lib, subjectId, parentId).find((p) => p.slug === slug) ?? null
    if (!found) return null
    parentId = found.id
  }
  return found
}

/** A page without own content is shown as "Ordner". */
export function isFolder(page: Pick<PageLite, 'hasContent'>): boolean {
  return !page.hasContent
}
