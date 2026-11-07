import { beforeEach, describe, expect, it } from 'vitest'
import { resetDbForTests } from '@/lib/db/client'
import { fisherYates, mulberry32 } from '@/lib/shuffle'
import { ingest, replaceQuiz } from '@/lib/services/ingest'
import { quizQualityWarnings, shuffleAnswers } from '@/lib/services/quiz-quality'
import { getQuizDetail } from '@/lib/services/quizzes'
import { normalizeQuestions } from '@/lib/validation/content'

const mc = (correctAt: number, texts = ['Antwort eins', 'Antwort zwei', 'Antwort drei', 'Antwort vier'], explanation?: string) => ({
  type: 'mc' as const,
  prompt: `Frage ${correctAt}`,
  answers: texts.map((text, i) => ({ text, correct: i === correctAt })),
  explanation,
})

describe('shuffle', () => {
  it('returns a permutation and is deterministic for a seed', () => {
    const list = [1, 2, 3, 4, 5, 6, 7, 8]
    const a = fisherYates(list, mulberry32(42))
    expect([...a].sort()).toEqual(list)
    expect(fisherYates(list, mulberry32(42))).toEqual(a)
    expect(list).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    const orders = new Set(Array.from({ length: 20 }, (_, s) => fisherYates(list, mulberry32(s)).join()))
    expect(orders.size).toBeGreaterThan(15)
  })
})

describe('quizQualityWarnings', () => {
  it('flags the correct answer sitting at the same position too often', () => {
    const w = quizQualityWarnings(normalizeQuestions([mc(0), mc(0), mc(0), mc(1), mc(2)]))
    expect(w).toHaveLength(1)
    expect(w[0]).toContain('3 von 5 Multiple-Choice-Fragen an Position 1 (60 %)')
  })

  it('flags the correct answer being the longest too often', () => {
    const long = (i: number) => ['kurz', 'knapp', 'klein', 'winzig'].map((t, j) => (j === i ? 'eine deutlich längere richtige Antwort' : t))
    const w = quizQualityWarnings(normalizeQuestions([mc(0, long(0)), mc(1, long(1)), mc(2, long(2)), mc(3)]))
    expect(w).toHaveLength(1)
    expect(w[0]).toContain('3 von 4')
    expect(w[0]).toContain('die längste')
  })

  it('flags explanations that point at a position', () => {
    const w = quizQualityWarnings(normalizeQuestions([mc(1, undefined, 'Richtig ist die zweite Antwort.'), mc(2, undefined, 'Antwort C stimmt.')]))
    expect(w).toEqual([expect.stringContaining('Frage 1, 2')])
  })

  it('stays quiet for well-mixed quizzes and below four mc questions', () => {
    expect(quizQualityWarnings(normalizeQuestions([mc(0), mc(1), mc(2), mc(3), mc(1)]))).toEqual([])
    expect(quizQualityWarnings(normalizeQuestions([mc(0), mc(0), mc(0)]))).toEqual([])
  })
})

describe('shuffleAnswers', () => {
  it('shuffles only multiple choice and keeps the correct flag on its answer', () => {
    const qs = normalizeQuestions([mc(0, ['A1', 'B1', 'C1', 'D1', 'E1', 'F1']), { type: 'tf', prompt: 'x', correct: false }])
    const out = shuffleAnswers(qs, mulberry32(7))
    expect(out[0].answers.map((a) => a.text).sort()).toEqual(['A1', 'B1', 'C1', 'D1', 'E1', 'F1'])
    expect(out[0].answers.find((a) => a.correct)?.text).toBe('A1')
    expect(out[1].answers.map((a) => a.text)).toEqual(['Wahr', 'Falsch'])
  })
})

describe('ingest with quiz quality', () => {
  beforeEach(() => {
    resetDbForTests()
  })

  const quiz = { title: 'Ausdauer', questions: Array.from({ length: 6 }, () => mc(0)) }

  it('returns warnings and stores shuffled answers', () => {
    const r = ingest({ subject: 'Sport', page: { title: 'Ausdauer', content_md: '## A\n\nx' }, quiz })
    expect(r.warnings).toEqual([expect.stringContaining('6 von 6 Multiple-Choice-Fragen an Position 1')])
    const stored = getQuizDetail(r.quizId!)!.questions
    for (const q of stored) {
      expect(q.answers).toHaveLength(4)
      expect(q.answers.find((a) => a.correct)?.text).toBe('Antwort eins')
    }
    // 6 questions × 4 answers: all still at position 1 would be a 1 in 4^6 chance.
    expect(stored.some((q) => !q.answers[0].correct)).toBe(true)
  })

  it('replaceQuiz returns warnings too', () => {
    const r = ingest({ subject: 'Sport', page: { title: 'Ausdauer', content_md: '## A\n\nx' }, quiz })
    expect(replaceQuiz(r.quizId!, quiz).warnings).toHaveLength(1)
  })
})
