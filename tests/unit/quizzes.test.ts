import { beforeEach, describe, expect, it } from 'vitest'
import { resetDbForTests } from '@/lib/db/client'
import { ValidationError } from '@/lib/services/errors'
import { ingest } from '@/lib/services/ingest'
import { getQuizDetail, listQuizzes, recordAttempt, saveQuiz } from '@/lib/services/quizzes'
import { updateTopicProgress, recordPageOpen } from '@/lib/services/progress'
import { getDashboard } from '@/lib/services/views'
import { unseenCount } from '@/lib/services/inbox'

function seedQuiz() {
  return ingest({
    subject: 'Sport',
    path: ['Sporttheorie'],
    page: { title: 'Stunde 4 – Trainingsprinzipien', content_md: '## Superkompensation\n\nx\n\n## Regeneration\n\ny' },
    quiz: {
      questions: [
        { prompt: 'Frage 1?', answers: [{ text: 'A', correct: true }, { text: 'B' }] },
        { prompt: 'Frage 2', correct: false },
      ],
    },
  })
}

describe('quizzes', () => {
  beforeEach(() => {
    resetDbForTests()
  })

  it('defaults the quiz title to the display part of the page title', () => {
    const r = seedQuiz()
    expect(getQuizDetail(r.quizId!)!.title).toBe('Trainingsprinzipien')
    expect(getQuizDetail(r.quizId!)!.trail).toEqual(['Sport', 'Sporttheorie', 'Stunde 4'])
  })

  it('saves edited questions, keeping ids and order', () => {
    const r = seedQuiz()
    const quiz = getQuizDetail(r.quizId!)!
    const [q1, q2] = quiz.questions
    saveQuiz(quiz.id, {
      title: 'Neu',
      questions: [
        { ...q2, prompt: 'Frage 2 geändert' },
        { ...q1, answers: [...q1.answers, { text: 'C', correct: false }] },
      ],
    })
    const after = getQuizDetail(quiz.id)!
    expect(after.title).toBe('Neu')
    expect(after.questions.map((q) => q.id)).toEqual([q2.id, q1.id])
    expect(after.questions[0].prompt).toBe('Frage 2 geändert')
    expect(after.questions[1].answers).toHaveLength(3)
  })

  it('rejects invalid edits', () => {
    const r = seedQuiz()
    const quiz = getQuizDetail(r.quizId!)!
    const q1 = quiz.questions[0]
    expect(() =>
      saveQuiz(quiz.id, { title: 'x', questions: [{ ...q1, answers: q1.answers.map((a) => ({ ...a, correct: true })) }] }),
    ).toThrow(ValidationError)
  })

  it('records attempts and lists quizzes with last results', () => {
    const r = seedQuiz()
    const quiz = getQuizDetail(r.quizId!)!
    recordAttempt(quiz.id, { details: quiz.questions.map((q, i) => ({ questionId: q.id, correct: i === 0 })) })
    const groups = listQuizzes()
    expect(groups[0].subject!.name).toBe('Sport')
    expect(groups[0].quizzes[0].lastAttempt).toMatchObject({ score: 1, total: 2 })
  })
})

describe('progress & dashboard', () => {
  beforeEach(() => {
    resetDbForTests()
  })

  it('tracks topic progress and feeds the dashboard', () => {
    const r = seedQuiz()
    expect(unseenCount()).toBe(2)
    recordPageOpen(r.pageId)
    expect(unseenCount()).toBe(1)
    expect(updateTopicProgress(r.pageId, { superkompensation: 0.9, regeneration: 0.3, bogus: 1 })).toBeCloseTo(0.65)
    // Progress only grows.
    expect(updateTopicProgress(r.pageId, { superkompensation: 0.1 })).toBeCloseTo(0.65)
    const d = getDashboard()
    expect(d.continueCard?.mainTitle).toBe('Trainingsprinzipien')
    expect(d.continueCard?.pathLabel).toBe('Sporttheorie › Stunde 4')
    expect(d.continueCard?.topics).toEqual([
      { title: 'Superkompensation', done: true },
      { title: 'Regeneration', done: false },
    ])
    expect(d.continueCard?.quiz?.questionCount).toBe(2)
    expect(d.fresh).toHaveLength(2)
  })
})
