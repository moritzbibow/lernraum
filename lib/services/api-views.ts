import { and, asc, eq, isNull } from 'drizzle-orm'
import { getDb } from '../db/client'
import { pages, questions, quizzes } from '../db/schema'
import { NotFoundError } from './errors'
import { loadLibrary, pagePathLabel, pageUrl, resolvePagePath } from './library'
import { quizPlayUrl, shortPageUrl } from './urls'

/** Full page incl. Markdown and quizzes – for Claude to read before revising. */
export function getPageForApi(idOrUrl: string) {
  const lib = loadLibrary()
  let id = idOrUrl.trim()
  // Accept URLs/paths as well: …/f/sport/sporttheorie/stunde-4, /p/<id>, /allgemein/…
  const m = id.match(/\/(f|allgemein|p)\/([^?#]*)/)
  if (m) {
    const parts = m[2].split('/').filter(Boolean).map(decodeURIComponent)
    if (m[1] === 'p') id = parts[0] ?? ''
    else if (m[1] === 'f') id = resolvePagePath(lib, parts[0] ?? '', parts.slice(1))?.id ?? ''
    else id = resolvePagePath(lib, null, parts)?.id ?? ''
  }
  const lite = lib.pageById.get(id)
  if (!lite) throw new NotFoundError(`Seite "${idOrUrl}" nicht gefunden.`)
  const db = getDb()
  const row = db.select().from(pages).where(eq(pages.id, lite.id)).get()!
  const quizRows = db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.pageId, lite.id), isNull(quizzes.deletedAt)))
    .orderBy(asc(quizzes.sort))
    .all()
  const subject = lite.subjectId ? lib.subjectById.get(lite.subjectId) : null
  return {
    page_id: row.id,
    title: row.title,
    heading: row.heading,
    kicker: row.kicker,
    date: row.lessonDate,
    subject: subject?.name ?? null,
    path: pagePathLabel(lib, row.id),
    url: pageUrl(lib, row.id),
    short_url: shortPageUrl(row.id),
    topics: row.topics,
    content_md: row.contentMd,
    updated_at: new Date(row.updatedAt).toISOString(),
    quizzes: quizRows.map((q) => ({
      quiz_id: q.id,
      title: q.title,
      url: quizPlayUrl(q.id),
      questions: db
        .select()
        .from(questions)
        .where(eq(questions.quizId, q.id))
        .orderBy(asc(questions.sort))
        .all()
        .map((x) => ({
          question_id: x.id,
          type: x.type,
          prompt: x.prompt,
          answers: x.answers.map((a) => ({ text: a.text, correct: a.correct })),
          explanation: x.explanation,
          topic: x.topicId,
        })),
    })),
  }
}
