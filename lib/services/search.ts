import { and, isNull } from 'drizzle-orm'
import { getDb, getSqlite } from '../db/client'
import { quizzes } from '../db/schema'
import { normalizeForMatch } from '../text'
import { loadLibrary, pagePathLabel, pageUrl } from './library'
import { quizPlayUrl, subjectUrl } from './urls'

export type SearchResult = {
  kind: 'page' | 'quiz' | 'subject'
  id: string
  title: string
  url: string
  path: string
  /** HTML-escaped snippet with <mark> highlights (pages only) */
  snippet?: string
  hue?: number | null
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Markdown → plain text, good enough for search snippets. */
function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^:::.*$/gm, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>|~]+/g, ' ')
    .replace(/\$+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Case- and diacritics-insensitive fold that keeps a 1:1 mapping to code points. */
function fold(chars: string[]): string {
  return chars.map((c) => (c.length > 1 ? '·' : (c.normalize('NFD')[0] ?? c).toLowerCase())).join('')
}

/** ~140 characters around the first hit, with <mark> around every hit. */
export function buildSnippet(md: string, terms: string[], radius = 70): string | undefined {
  const chars = [...plainText(md)]
  const folded = fold(chars)
  const needles = terms.map((t) => fold([...t])).filter((t) => t.length >= 2)
  let first = -1
  for (const n of needles) {
    const i = folded.indexOf(n)
    if (i >= 0 && (first === -1 || i < first)) first = i
  }
  if (first === -1) return undefined
  const start = Math.max(0, first - radius)
  const end = Math.min(chars.length, first + radius * 1.4)
  const marks = new Array<boolean>(chars.length).fill(false)
  for (const n of needles) {
    let i = folded.indexOf(n, start)
    while (i >= 0 && i < end) {
      for (let k = i; k < i + n.length; k++) marks[k] = true
      i = folded.indexOf(n, i + n.length)
    }
  }
  let out = start > 0 ? '…' : ''
  let open = false
  for (let k = start; k < end; k++) {
    if (marks[k] && !open) {
      out += '<mark>'
      open = true
    } else if (!marks[k] && open) {
      out += '</mark>'
      open = false
    }
    out += escapeHtml(chars[k])
  }
  if (open) out += '</mark>'
  if (end < chars.length) out += '…'
  return out
}

/** Full-text search (FTS5 trigram) over pages + title search over subjects and quizzes. */
export function search(query: string, limit = 20): SearchResult[] {
  const q = query.trim()
  if (!q) return []
  const lib = loadLibrary()
  const norm = normalizeForMatch(q)
  const results: SearchResult[] = []
  const seen = new Set<string>()

  // Subjects by name
  for (const s of lib.subjects) {
    if (normalizeForMatch(s.name).includes(norm)) {
      results.push({ kind: 'subject', id: s.id, title: s.name, url: subjectUrl(s.slug), path: 'Fach', hue: s.hue })
    }
  }

  // Pages via FTS (terms with ≥ 3 characters)
  const terms = q
    .split(/\s+/)
    .map((t) => t.replace(/"/g, ''))
    .filter((t) => t.length >= 3)
  if (terms.length) {
    const match = terms.map((t) => `"${t}"`).join(' ')
    try {
      const rows = getSqlite()
        .prepare(
          `SELECT page_id AS pageId, body FROM pages_fts
           WHERE pages_fts MATCH ? ORDER BY bm25(pages_fts, 0.0, 10.0, 5.0, 1.0) LIMIT 60`,
        )
        .all(match) as { pageId: string; body: string }[]
      for (const r of rows) {
        const url = pageUrl(lib, r.pageId)
        if (!url || seen.has(r.pageId)) continue
        seen.add(r.pageId)
        const page = lib.pageById.get(r.pageId)!
        results.push({
          kind: 'page',
          id: page.id,
          title: page.title,
          url,
          path: pagePathLabel(lib, page.id, { includeSelf: false }),
          snippet: buildSnippet(r.body, terms),
          hue: page.subjectId ? lib.subjectById.get(page.subjectId)?.hue ?? null : null,
        })
      }
    } catch {
      // Malformed FTS query – fall through to title matching.
    }
  }

  // Short queries (or no FTS hit): title substring match
  for (const page of lib.pages) {
    if (seen.has(page.id) || !normalizeForMatch(page.title).includes(norm)) continue
    const url = pageUrl(lib, page.id)
    if (!url) continue
    seen.add(page.id)
    results.push({
      kind: 'page',
      id: page.id,
      title: page.title,
      url,
      path: pagePathLabel(lib, page.id, { includeSelf: false }),
      hue: page.subjectId ? lib.subjectById.get(page.subjectId)?.hue ?? null : null,
    })
  }

  // Quizzes by title
  const quizRows = getDb()
    .select({ id: quizzes.id, title: quizzes.title, pageId: quizzes.pageId })
    .from(quizzes)
    .where(and(isNull(quizzes.deletedAt)))
    .all()
  for (const quiz of quizRows) {
    if (!lib.pageById.has(quiz.pageId) || !normalizeForMatch(quiz.title).includes(norm)) continue
    const page = lib.pageById.get(quiz.pageId)!
    results.push({
      kind: 'quiz',
      id: quiz.id,
      title: quiz.title,
      url: quizPlayUrl(quiz.id),
      path: pagePathLabel(lib, page.id),
      hue: page.subjectId ? lib.subjectById.get(page.subjectId)?.hue ?? null : null,
    })
  }

  return results.slice(0, limit)
}
