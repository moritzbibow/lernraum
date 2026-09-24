import { and, asc, eq, isNull } from 'drizzle-orm'
import { getDb, type Tx } from '../db/client'
import { pageRevisions, pages, questions, quizzes, type Topic } from '../db/schema'
import { analyzeMarkdown } from '../content/markdown'
import { newId } from '../ids'
import { slugify } from '../slug'
import { normalizeForMatch, splitTitle } from '../text'
import {
  normalizeQuestions,
  parseOrThrow,
  ingestInput,
  quizInput,
  type IngestInput,
  type NormalizedQuestion,
  type QuizInput,
} from '../validation/content'
import { NotFoundError } from './errors'
import { addInboxItem } from './inbox'
import { loadLibrary, pagePathLabel, pageUrl } from './library'
import {
  computeReadProgress,
  createPageRow,
  createSubjectRow,
  findSibling,
  findSubject,
  liveSiblings,
  type SubjectLite,
} from './ops'
import { quizEditUrl, quizPlayUrl, shortPageUrl } from './urls'

export type IngestResult = {
  ok: true
  created: boolean
  pageId: string
  quizId: string | null
  /** App-relative URLs – the API layer turns them into absolute links. */
  url: string
  shortUrl: string
  quizUrl: string | null
  quizEditUrl: string | null
  path: string
  topics: Topic[]
  questionCount: number
  createdFolders: string[]
  warnings: string[]
}

const MAX_REVISIONS = 20

/**
 * The single entry point for content coming from Claude (REST and MCP).
 * Runs in one transaction: either everything is stored or nothing.
 */
export function ingest(raw: unknown, opts: { source?: 'claude' | 'manual'; now?: number } = {}): IngestResult {
  const input = parseOrThrow(ingestInput, raw, 'Ungültige Einspeisung.')
  const source = opts.source ?? 'claude'
  const now = opts.now ?? Date.now()
  const db = getDb()

  const result = db.transaction((tx) => {
    const warnings: string[] = []
    const createdFolders: string[] = []
    const mode = input.mode ?? 'upsert'

    // ---- 1. Resolve target container (subject + folder path) --------------
    let pageId: string | null = null
    let created = false

    if (input.page_id) {
      const existing = tx
        .select({ id: pages.id })
        .from(pages)
        .where(and(eq(pages.id, input.page_id), isNull(pages.deletedAt)))
        .get()
      if (!existing) throw new NotFoundError(`Seite mit page_id "${input.page_id}" nicht gefunden (list_tree zeigt gültige IDs).`)
      pageId = existing.id
      if (input.path?.length || input.subject) {
        warnings.push('page_id angegeben – subject/path wurden ignoriert (zum Verschieben die Oberfläche nutzen).')
      }
    }

    let subject: SubjectLite | null = null
    let parentId: string | null = null

    if (!pageId) {
      const segments = [...(input.path ?? [])]
      if (input.subject) {
        subject = findSubject(tx, input.subject) ?? null
        if (!subject) {
          subject = createSubjectRow(tx, input.subject.trim(), now)
          createdFolders.push(`Fach „${subject.name}“`)
        }
      } else if (segments.length) {
        // Tolerance: path ["Sport", …] without subject → first segment is the subject.
        const generalMatch = findSibling(liveSiblings(tx, null, null), segments[0])
        const subjectMatch = findSubject(tx, segments[0])
        if (subjectMatch && !generalMatch) {
          subject = subjectMatch
          segments.shift()
        }
      }

      // The page title may be repeated as last path segment – that is the page itself.
      const title = input.page?.title
      if (title && segments.length) {
        const last = segments[segments.length - 1]
        if (slugify(last) === slugify(title) || normalizeForMatch(last) === normalizeForMatch(title)) segments.pop()
      }

      for (const segment of segments) {
        const siblings = liveSiblings(tx, subject?.id ?? null, parentId)
        const match = findSibling(siblings, segment)
        if (match) {
          parentId = match.id
        } else {
          parentId = createPageRow(tx, { subjectId: subject?.id ?? null, parentId, title: segment, source }, now)
          createdFolders.push(`Ordner „${segment}“`)
        }
      }

      if (title) {
        const match = findSibling(liveSiblings(tx, subject?.id ?? null, parentId), title)
        if (match) pageId = match.id
      }
    }

    // ---- 2. Page upsert --------------------------------------------------
    if (mode === 'upsert' && input.page) {
      const content = input.page.content_md ?? input.page.content ?? ''
      const analysis = analyzeMarkdown(content)
      if (pageId) {
        updatePageContent(tx, pageId, input.page, content, analysis, source, now)
        addInboxItem(tx, 'page', pageId, 'updated', now)
      } else {
        pageId = createPageRow(
          tx,
          {
            subjectId: subject?.id ?? null,
            parentId,
            title: input.page.title,
            heading: input.page.heading ?? null,
            kicker: input.page.kicker ?? null,
            lessonDate: input.page.date ?? null,
            contentMd: content,
            topics: analysis.topics,
            wordCount: analysis.wordCount,
            source,
          },
          now,
        )
        created = true
        addInboxItem(tx, 'page', pageId, 'created', now)
      }
      if (!content.trim()) warnings.push('content_md ist leer – die Seite wird als Ordner angezeigt.')
      if (!analysis.topics.length && content.trim()) {
        warnings.push('Keine ##-Überschriften gefunden – ohne Themen gibt es kein Inhaltsverzeichnis.')
      }
    }

    if (!pageId) {
      throw new NotFoundError('Zielseite für das Quiz nicht gefunden. page_id angeben oder Pfad prüfen (list_tree).')
    }

    // ---- 3. Quiz ---------------------------------------------------------
    let quizId: string | null = null
    let questionCount = 0
    if (input.quiz) {
      const res = upsertQuiz(tx, pageId, input.quiz, source, now)
      quizId = res.quizId
      questionCount = res.questionCount
      warnings.push(...res.warnings)
      addInboxItem(tx, 'quiz', quizId, res.created ? 'created' : 'updated', now)
    }

    // ---- 4. Duplicate hint -------------------------------------------------
    const lib = loadLibrary(tx)
    const page = lib.pageById.get(pageId)!
    const duplicates = lib.pages.filter(
      (p) => p.id !== page.id && p.subjectId === page.subjectId && p.slug === page.slug && p.parentId !== page.parentId,
    )
    for (const d of duplicates) {
      warnings.push(`Eine Seite mit gleichem Titel existiert auch unter „${pagePathLabel(lib, d.id)}“ (page_id ${d.id}).`)
    }

    const topics = tx.select({ topics: pages.topics }).from(pages).where(eq(pages.id, pageId)).get()?.topics ?? []
    return {
      ok: true as const,
      created,
      pageId,
      quizId,
      url: pageUrl(lib, pageId) ?? shortPageUrl(pageId),
      shortUrl: shortPageUrl(pageId),
      quizUrl: quizId ? quizPlayUrl(quizId) : null,
      quizEditUrl: quizId ? quizEditUrl(quizId) : null,
      path: pagePathLabel(lib, pageId),
      topics,
      questionCount,
      createdFolders,
      warnings,
    }
  })
  return result
}

function updatePageContent(
  tx: Tx,
  pageId: string,
  page: NonNullable<IngestInput['page']>,
  content: string,
  analysis: { topics: Topic[]; wordCount: number },
  source: 'claude' | 'manual',
  now: number,
) {
  const current = tx.select().from(pages).where(eq(pages.id, pageId)).get()
  if (!current) throw new NotFoundError()

  if (current.contentMd !== content || current.title !== page.title || (current.heading ?? null) !== (page.heading ?? null)) {
    tx.insert(pageRevisions)
      .values({
        id: newId(),
        pageId,
        title: current.title,
        heading: current.heading,
        kicker: current.kicker,
        contentMd: current.contentMd,
        createdAt: now,
      })
      .run()
    const old = tx
      .select({ id: pageRevisions.id })
      .from(pageRevisions)
      .where(eq(pageRevisions.pageId, pageId))
      .orderBy(asc(pageRevisions.createdAt))
      .all()
    for (const r of old.slice(0, Math.max(0, old.length - MAX_REVISIONS))) {
      tx.delete(pageRevisions).where(eq(pageRevisions.id, r.id)).run()
    }
  }

  // Keep reading progress for topics that still exist.
  const ids = new Set(analysis.topics.map((t) => t.id))
  const progress = Object.fromEntries(Object.entries(current.topicProgress).filter(([k]) => ids.has(k) || k === '_all'))

  let slug = current.slug
  if (current.title !== page.title) {
    const siblings = liveSiblings(tx, current.subjectId, current.parentId, pageId)
    const base = slugify(page.title)
    const taken = new Set(siblings.map((s) => s.slug))
    slug = taken.has(base) ? current.slug : base
  }

  tx.update(pages)
    .set({
      title: page.title,
      slug,
      heading: page.heading ?? null,
      kicker: page.kicker ?? null,
      lessonDate: page.date ?? current.lessonDate,
      contentMd: content,
      topics: analysis.topics,
      wordCount: analysis.wordCount,
      source,
      topicProgress: progress,
      readProgress: computeReadProgress(analysis.topics, progress),
      updatedAt: now,
      contentUpdatedAt: content !== current.contentMd ? now : current.contentUpdatedAt,
    })
    .where(eq(pages.id, pageId))
    .run()
}

function matchTopic(topics: Topic[], hint: string | null): string | null {
  if (!hint) return null
  const norm = normalizeForMatch(hint)
  const found = topics.find((t) => t.id === hint || normalizeForMatch(t.title) === norm || slugify(t.title) === slugify(hint))
  return found?.id ?? null
}

function insertQuestions(tx: Tx, quizId: string, list: NormalizedQuestion[], topics: Topic[]) {
  list.forEach((q, i) => {
    tx.insert(questions)
      .values({
        id: newId(),
        quizId,
        sort: i,
        type: q.type,
        prompt: q.prompt,
        answers: q.answers,
        explanation: q.explanation,
        topicId: matchTopic(topics, q.topicHint),
      })
      .run()
  })
}

function upsertQuiz(tx: Tx, pageId: string, quiz: QuizInput, source: 'claude' | 'manual', now: number) {
  const warnings: string[] = []
  const normalized = normalizeQuestions(quiz.questions)
  const page = tx.select({ title: pages.title, topics: pages.topics }).from(pages).where(eq(pages.id, pageId)).get()
  if (!page) throw new NotFoundError()
  const title = quiz.title?.trim() || splitTitle(page.title).main

  const existing = tx
    .select({ id: quizzes.id, title: quizzes.title, sort: quizzes.sort })
    .from(quizzes)
    .where(and(eq(quizzes.pageId, pageId), isNull(quizzes.deletedAt)))
    .orderBy(asc(quizzes.sort))
    .all()
  const sameTitle = existing.find((q) => normalizeForMatch(q.title) === normalizeForMatch(title))
  const target = sameTitle ?? (!quiz.title && existing.length === 1 ? existing[0] : undefined)

  const unmatched = normalized.filter((q) => q.topicHint && !matchTopic(page.topics, q.topicHint)).length
  if (unmatched) warnings.push(`${unmatched} Frage(n) mit "topic", das zu keinem ##-Thema der Seite passt.`)

  if (target) {
    tx.delete(questions).where(eq(questions.quizId, target.id)).run()
    insertQuestions(tx, target.id, normalized, page.topics)
    tx.update(quizzes).set({ title, updatedAt: now, source }).where(eq(quizzes.id, target.id)).run()
    return { quizId: target.id, created: false, questionCount: normalized.length, warnings }
  }

  const quizId = newId()
  tx.insert(quizzes)
    .values({
      id: quizId,
      pageId,
      title,
      sort: existing.reduce((m, q) => Math.max(m, q.sort + 1), 0),
      source,
      createdAt: now,
      updatedAt: now,
    })
    .run()
  insertQuestions(tx, quizId, normalized, page.topics)
  return { quizId, created: true, questionCount: normalized.length, warnings }
}

/** Throws unless the quiz belongs to a live page – used by the quiz actions. */
export function assertQuizAlive(tx: Tx, quizId: string) {
  const row = tx
    .select({ id: quizzes.id })
    .from(quizzes)
    .innerJoin(pages, eq(pages.id, quizzes.pageId))
    .where(and(eq(quizzes.id, quizId), isNull(quizzes.deletedAt), isNull(pages.deletedAt)))
    .get()
  if (!row) throw new NotFoundError('Quiz nicht gefunden.')
}


/** Replaces title/questions of an existing quiz (REST PATCH, MCP ingest_quiz by quiz_id). */
export function replaceQuiz(quizId: string, raw: unknown, opts: { source?: 'claude' | 'manual' } = {}) {
  const input = parseOrThrow(quizInput, raw, 'Ungültiges Quiz.')
  const db = getDb()
  const now = Date.now()
  return db.transaction((tx) => {
    const quiz = tx
      .select({ id: quizzes.id, pageId: quizzes.pageId, title: quizzes.title })
      .from(quizzes)
      .where(and(eq(quizzes.id, quizId), isNull(quizzes.deletedAt)))
      .get()
    if (!quiz) throw new NotFoundError('Quiz nicht gefunden.')
    const page = tx.select({ topics: pages.topics }).from(pages).where(eq(pages.id, quiz.pageId)).get()
    const normalized = normalizeQuestions(input.questions)
    tx.delete(questions).where(eq(questions.quizId, quizId)).run()
    insertQuestions(tx, quizId, normalized, page?.topics ?? [])
    tx.update(quizzes)
      .set({ title: input.title?.trim() || quiz.title, updatedAt: now, source: opts.source ?? 'claude' })
      .where(eq(quizzes.id, quizId))
      .run()
    addInboxItem(tx, 'quiz', quizId, 'updated', now)
    return { ok: true as const, quizId, questionCount: normalized.length, quizUrl: quizPlayUrl(quizId) }
  })
}
