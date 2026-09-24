import { and, asc, isNull } from 'drizzle-orm'
import { getDb } from '../db/client'
import { attempts, pages, questions, quizzes, subjects } from '../db/schema'

/** Complete JSON export of the live library (for backups / moving elsewhere). */
export function exportAll() {
  const db = getDb()
  const liveSubjects = db.select().from(subjects).where(isNull(subjects.deletedAt)).orderBy(asc(subjects.sort)).all()
  const livePages = db.select().from(pages).where(isNull(pages.deletedAt)).orderBy(asc(pages.sort)).all()
  const liveQuizzes = db.select().from(quizzes).where(and(isNull(quizzes.deletedAt))).all()
  const quizIds = new Set(liveQuizzes.map((q) => q.id))
  const allQuestions = db.select().from(questions).orderBy(asc(questions.sort)).all().filter((q) => quizIds.has(q.quizId))
  const allAttempts = db.select().from(attempts).all().filter((a) => quizIds.has(a.quizId))
  return {
    format: 'lernraum-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    subjects: liveSubjects.map(({ deletedAt: _d, ...s }) => s),
    pages: livePages.map(({ deletedAt: _d, ...p }) => p),
    quizzes: liveQuizzes.map(({ deletedAt: _d, ...q }) => ({
      ...q,
      questions: allQuestions.filter((x) => x.quizId === q.id),
    })),
    attempts: allAttempts,
  }
}
