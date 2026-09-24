import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { attempts, pages, questions, quizzes, type Answer, type AttemptDetail, type QuestionType, type Topic } from '../db/schema'
import { newId } from '../ids'
import { parseOrThrow, quizEditInput, validateEditedQuestions } from '../validation/content'
import { NotFoundError, ValidationError } from './errors'
import { loadLibrary, pagePathLabel, pageTrail, pageUrl, type Library } from './library'

export type QuestionView = {
  id: string
  type: QuestionType
  prompt: string
  answers: Answer[]
  explanation: string | null
  topicId: string | null
}

export type AttemptView = { score: number; total: number; finishedAt: number }

export type QuizDetail = {
  id: string
  title: string
  source: 'claude' | 'manual'
  createdAt: number
  updatedAt: number
  page: { id: string; title: string; url: string; topics: Topic[] }
  subject: { id: string; name: string; slug: string; hue: number; lightness: number; chroma: number } | null
  /** e.g. ["Sport", "Sporttheorie", "Stunde 4"] – short labels for kickers */
  trail: string[]
  questions: QuestionView[]
  lastAttempt: AttemptView | null
  attemptCount: number
}

export function lastAttempts(quizIds: string[]): Map<string, AttemptView> {
  if (!quizIds.length) return new Map()
  const rows = getDb()
    .select({ quizId: attempts.quizId, score: attempts.score, total: attempts.total, finishedAt: attempts.finishedAt })
    .from(attempts)
    .where(inArray(attempts.quizId, quizIds))
    .orderBy(desc(attempts.finishedAt))
    .all()
  const map = new Map<string, AttemptView>()
  for (const r of rows) if (!map.has(r.quizId)) map.set(r.quizId, { score: r.score, total: r.total, finishedAt: r.finishedAt })
  return map
}

export function getQuizDetail(quizId: string, lib: Library = loadLibrary()): QuizDetail | null {
  const db = getDb()
  const quiz = db.select().from(quizzes).where(and(eq(quizzes.id, quizId), isNull(quizzes.deletedAt))).get()
  if (!quiz) return null
  const pageLite = lib.pageById.get(quiz.pageId)
  if (!pageLite) return null
  const page = db.select({ topics: pages.topics }).from(pages).where(eq(pages.id, quiz.pageId)).get()
  const subject = pageLite.subjectId ? lib.subjectById.get(pageLite.subjectId) ?? null : null
  const qs = db.select().from(questions).where(eq(questions.quizId, quizId)).orderBy(asc(questions.sort)).all()
  const count = db.get<{ n: number }>(sql`SELECT count(*) AS n FROM attempts WHERE quiz_id = ${quizId}`)?.n ?? 0
  const trail = pageTrail(lib, pageLite.id).map((p) => shortLabel(p.title))
  return {
    id: quiz.id,
    title: quiz.title,
    source: quiz.source,
    createdAt: quiz.createdAt,
    updatedAt: quiz.updatedAt,
    page: { id: pageLite.id, title: pageLite.title, url: pageUrl(lib, pageLite.id) ?? '/', topics: page?.topics ?? [] },
    subject: subject
      ? { id: subject.id, name: subject.name, slug: subject.slug, hue: subject.hue, lightness: subject.lightness, chroma: subject.chroma }
      : null,
    trail: [subject?.name ?? 'Allgemein', ...trail],
    questions: qs.map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      answers: q.answers,
      explanation: q.explanation,
      topicId: q.topicId,
    })),
    lastAttempt: lastAttempts([quiz.id]).get(quiz.id) ?? null,
    attemptCount: count,
  }
}

function shortLabel(title: string): string {
  const m = title.match(/^(.*?)\s+[–—-]\s+/)
  return m && m[1] ? m[1] : title
}

export type QuizListItem = {
  id: string
  title: string
  questionCount: number
  pageId: string
  pageTitle: string
  pageUrl: string
  path: string
  updatedAt: number
  lastAttempt: AttemptView | null
}

export type QuizGroup = {
  subject: { id: string; name: string; hue: number; lightness: number; chroma: number } | null
  quizzes: QuizListItem[]
}

/** Quizzes on live pages, grouped by subject (general pages last). */
export function listQuizzes(lib: Library = loadLibrary()): QuizGroup[] {
  const db = getDb()
  const rows = db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      pageId: quizzes.pageId,
      sort: quizzes.sort,
      updatedAt: quizzes.updatedAt,
      count: sql<number>`(SELECT count(*) FROM questions qq WHERE qq.quiz_id = quizzes.id)`,
    })
    .from(quizzes)
    .where(isNull(quizzes.deletedAt))
    .all()
    .filter((q) => lib.pageById.has(q.pageId))
  const last = lastAttempts(rows.map((r) => r.id))

  // Order quizzes like the library tree.
  const order = new Map<string, number>()
  let i = 0
  const walk = (subjectId: string | null, parentId: string | null) => {
    for (const p of lib.children.get(parentId ?? (subjectId ? `s:${subjectId}` : 'general')) ?? []) {
      order.set(p.id, i++)
      walk(subjectId, p.id)
    }
  }
  for (const s of lib.subjects) walk(s.id, null)
  walk(null, null)

  const groups = new Map<string | null, QuizGroup>()
  for (const s of lib.subjects) {
    groups.set(s.id, { subject: { id: s.id, name: s.name, hue: s.hue, lightness: s.lightness, chroma: s.chroma }, quizzes: [] })
  }
  groups.set(null, { subject: null, quizzes: [] })

  rows
    .sort((a, b) => (order.get(a.pageId) ?? 0) - (order.get(b.pageId) ?? 0) || a.sort - b.sort)
    .forEach((q) => {
      const page = lib.pageById.get(q.pageId)!
      groups.get(page.subjectId)?.quizzes.push({
        id: q.id,
        title: q.title,
        questionCount: q.count,
        pageId: page.id,
        pageTitle: page.title,
        pageUrl: pageUrl(lib, page.id) ?? '/',
        path: pagePathLabel(lib, page.id, { includeSubject: false }),
        updatedAt: q.updatedAt,
        lastAttempt: last.get(q.id) ?? null,
      })
    })
  return [...groups.values()].filter((g) => g.quizzes.length > 0)
}

/** Quizzes attached to one page (reading view). */
export function quizzesForPage(pageId: string): { id: string; title: string; questionCount: number; lastAttempt: AttemptView | null }[] {
  const rows = getDb()
    .select({
      id: quizzes.id,
      title: quizzes.title,
      count: sql<number>`(SELECT count(*) FROM questions qq WHERE qq.quiz_id = quizzes.id)`,
    })
    .from(quizzes)
    .where(and(eq(quizzes.pageId, pageId), isNull(quizzes.deletedAt)))
    .orderBy(asc(quizzes.sort), asc(quizzes.createdAt))
    .all()
  const last = lastAttempts(rows.map((r) => r.id))
  return rows.map((r) => ({ id: r.id, title: r.title, questionCount: r.count, lastAttempt: last.get(r.id) ?? null }))
}

/** Saves the editor state: questions are replaced as a whole, ids are kept. */
export function saveQuiz(quizId: string, raw: unknown): void {
  const input = parseOrThrow(quizEditInput, raw, 'Quiz konnte nicht gespeichert werden.')
  validateEditedQuestions(input)
  const db = getDb()
  const now = Date.now()
  db.transaction((tx) => {
    const quiz = tx.select({ id: quizzes.id }).from(quizzes).where(and(eq(quizzes.id, quizId), isNull(quizzes.deletedAt))).get()
    if (!quiz) throw new NotFoundError('Quiz nicht gefunden.')
    const existing = new Set(
      tx.select({ id: questions.id }).from(questions).where(eq(questions.quizId, quizId)).all().map((q) => q.id),
    )
    const keep = new Set<string>()
    input.questions.forEach((q, sort) => {
      const answers = q.answers.map((a) => ({ id: a.id || newId(8), text: a.text, correct: a.correct }))
      const values = {
        sort,
        type: q.type,
        prompt: q.prompt,
        answers,
        explanation: q.explanation?.trim() || null,
        topicId: q.topicId ?? null,
      }
      if (q.id && existing.has(q.id)) {
        keep.add(q.id)
        tx.update(questions).set(values).where(eq(questions.id, q.id)).run()
      } else {
        tx.insert(questions).values({ id: newId(), quizId, ...values }).run()
      }
    })
    const removed = [...existing].filter((id) => !keep.has(id))
    if (removed.length) tx.delete(questions).where(inArray(questions.id, removed)).run()
    tx.update(quizzes).set({ title: input.title, updatedAt: now, source: 'manual' }).where(eq(quizzes.id, quizId)).run()
  })
}

export function recordAttempt(quizId: string, result: { details: AttemptDetail[] }): AttemptView {
  const db = getDb()
  const quiz = db.select({ id: quizzes.id }).from(quizzes).where(and(eq(quizzes.id, quizId), isNull(quizzes.deletedAt))).get()
  if (!quiz) throw new NotFoundError('Quiz nicht gefunden.')
  const valid = new Set(db.select({ id: questions.id }).from(questions).where(eq(questions.quizId, quizId)).all().map((q) => q.id))
  const details = result.details.filter((d) => valid.has(d.questionId))
  if (details.length === 0) throw new ValidationError('Leerer Versuch.')
  const score = details.filter((d) => d.correct).length
  const finishedAt = Date.now()
  db.insert(attempts).values({ id: newId(), quizId, score, total: details.length, details, finishedAt }).run()
  return { score, total: details.length, finishedAt }
}
