import { beforeEach, describe, expect, it } from 'vitest'
import { resetDbForTests } from '@/lib/db/client'
import { ValidationError, NotFoundError } from '@/lib/services/errors'
import { listInbox, unseenCount } from '@/lib/services/inbox'
import { ingest } from '@/lib/services/ingest'
import { childrenOf, loadLibrary } from '@/lib/services/library'
import { getQuizDetail } from '@/lib/services/quizzes'

const lesson = (n: number, title: string) => ({
  subject: 'Sport',
  path: ['Sporttheorie', `Stunde ${n} – ${title}`],
  page: { title: `Stunde ${n} – ${title}`, content_md: `## Thema A\n\nText ${n}\n\n## Thema B\n\nMehr` },
})

describe('ingest', () => {
  beforeEach(() => {
    resetDbForTests()
  })

  it('creates subject, folders and page, and returns urls', () => {
    const r = ingest(lesson(5, 'Ausdauertraining'))
    expect(r.created).toBe(true)
    expect(r.url).toBe('/f/sport/sporttheorie/stunde-5-ausdauertraining')
    expect(r.path).toBe('Sport › Sporttheorie › Stunde 5 – Ausdauertraining')
    expect(r.topics.map((t) => t.title)).toEqual(['Thema A', 'Thema B'])
    expect(r.createdFolders).toEqual(['Fach „Sport“', 'Ordner „Sporttheorie“'])
    const lib = loadLibrary()
    expect(lib.subjects).toHaveLength(1)
    expect(lib.subjects[0].hue).toBe(140)
  })

  it('upserts an existing page instead of duplicating it', () => {
    const first = ingest(lesson(4, 'Prinzipien'))
    const second = ingest({ ...lesson(4, 'Prinzipien'), page: { title: 'Stunde 4 – Prinzipien', content_md: '## Neu\n\nx' } })
    expect(second.pageId).toBe(first.pageId)
    expect(second.created).toBe(false)
    expect(second.topics.map((t) => t.id)).toEqual(['neu'])
    expect(loadLibrary().pages).toHaveLength(2) // folder + page
  })

  it('matches path segments tolerantly (case, umlauts) and inserts in natural order', () => {
    ingest(lesson(1, 'Motorik'))
    ingest(lesson(3, 'Schnelligkeit'))
    ingest({ ...lesson(2, 'Kraft'), path: ['SPORTTHEORIE'] })
    const lib = loadLibrary()
    const folder = childrenOf(lib, lib.subjects[0].id, null)
    expect(folder).toHaveLength(1)
    expect(childrenOf(lib, lib.subjects[0].id, folder[0].id).map((p) => p.title)).toEqual([
      'Stunde 1 – Motorik',
      'Stunde 2 – Kraft',
      'Stunde 3 – Schnelligkeit',
    ])
  })

  it('treats the first path segment as subject when no subject is given', () => {
    ingest(lesson(1, 'Motorik'))
    const r = ingest({ path: ['Sport', 'Sporttheorie'], page: { title: 'Stunde 2 – Kraft', content_md: 'x' } })
    expect(r.url).toBe('/f/sport/sporttheorie/stunde-2-kraft')
  })

  it('stores pages without subject as general pages', () => {
    const r = ingest({ page: { title: 'Lerntechniken', content_md: '## Active Recall\n\nText' } })
    expect(r.url).toBe('/allgemein/lerntechniken')
  })

  it('attaches and replaces quizzes, normalizing question shorthands', () => {
    const r = ingest({
      ...lesson(4, 'Prinzipien'),
      quiz: {
        title: 'Trainingsprinzipien',
        questions: [
          { prompt: 'Wann Reiz?', answers: [{ text: 'Früh' }, { text: 'Im Hoch', correct: true }], topic: 'Thema B' },
          { prompt: 'Regeneration gehört dazu.', correct: true },
          { type: 'text', prompt: 'Fachbegriff?', correct: ['Superkompensation', 'Superkompensierung'] },
        ],
      },
    })
    expect(r.quizId).toBeTruthy()
    const quiz = getQuizDetail(r.quizId!)!
    expect(quiz.questions.map((q) => q.type)).toEqual(['mc', 'tf', 'text'])
    expect(quiz.questions[0].topicId).toBe('thema-b')
    expect(quiz.questions[1].answers.map((a) => [a.text, a.correct])).toEqual([
      ['Wahr', true],
      ['Falsch', false],
    ])
    expect(quiz.questions[2].answers.every((a) => a.correct)).toBe(true)

    const again = ingest({
      page_id: r.pageId,
      mode: 'append-quiz',
      quiz: { title: 'Trainingsprinzipien', questions: [{ prompt: 'Nur eine', correct: false }] },
    })
    expect(again.quizId).toBe(r.quizId)
    expect(getQuizDetail(r.quizId!)!.questions).toHaveLength(1)
  })

  it('reports all quiz problems at once in German', () => {
    try {
      ingest({
        ...lesson(1, 'Motorik'),
        quiz: {
          questions: [
            { prompt: 'A?', answers: [{ text: 'x' }, { text: 'y' }] },
            { prompt: 'B?', answers: [{ text: 'x', correct: true }] },
          ],
        },
      })
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError)
      const issues = (e as ValidationError).issues
      expect(issues).toHaveLength(2)
      expect(issues[0].message).toContain('Frage 1')
      expect(issues[0].path).toBe('quiz.questions[0].answers')
      expect(issues[1].message).toContain('mindestens 2')
    }
    // Nothing was written (transaction).
    expect(loadLibrary().pages).toHaveLength(0)
  })

  it('validates the envelope with readable paths', () => {
    expect(() => ingest({ subject: 'Sport', page: { title: '' } })).toThrow(ValidationError)
    expect(() => ingest({ mode: 'append-quiz', page_id: 'nope', quiz: { questions: [{ prompt: 'x', correct: true }] } })).toThrow(
      NotFoundError,
    )
  })

  it('creates inbox items for page and quiz', () => {
    ingest({ ...lesson(5, 'Ausdauer'), quiz: { questions: [{ prompt: 'x?', correct: true }] } })
    expect(unseenCount()).toBe(2)
    const inbox = listInbox()
    expect(inbox.map((i) => i.kind).sort()).toEqual(['page', 'quiz'])
    expect(inbox.find((i) => i.kind === 'quiz')!.questionCount).toBe(1)
  })
})
