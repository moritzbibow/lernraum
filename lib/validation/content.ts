import { z } from 'zod'
import type { Answer, QuestionType } from '../db/schema'
import { newId } from '../ids'
import { ValidationError, type Issue } from '../services/errors'

z.config(z.locales.de())

/* ------------------------------------------------------------------ */
/* Input shapes (as sent by Claude via REST or MCP)                    */
/* ------------------------------------------------------------------ */

export const answerInput = z.object({
  text: z.string().trim().min(1).max(500),
  correct: z.boolean().optional(),
})

export const questionInput = z.object({
  type: z.enum(['mc', 'tf', 'text']).optional(),
  prompt: z.string().trim().min(1).max(1000),
  answers: z.array(answerInput).max(8).optional(),
  /** Shorthand: boolean for Wahr/Falsch, string(s) for accepted free-text answers. */
  correct: z.union([z.boolean(), z.string().trim().min(1), z.array(z.string().trim().min(1)).min(1)]).optional(),
  explanation: z.string().trim().max(3000).nullish(),
  /** Title (or id) of the ## topic the question belongs to – enables "Zur Seite →" deep links. */
  topic: z.string().trim().max(200).nullish(),
})

export const quizInput = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  questions: z.array(questionInput).min(1).max(200),
})

export const pageInput = z.object({
  title: z.string().trim().min(1).max(200),
  heading: z.string().trim().max(300).nullish(),
  kicker: z.string().trim().max(120).nullish(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum im Format JJJJ-MM-TT angeben')
    .nullish(),
  content_md: z.string().max(500_000).optional(),
  /** Alias for content_md. */
  content: z.string().max(500_000).optional(),
})

export const ingestInput = z
  .object({
    subject: z.string().trim().max(100).nullish(),
    path: z.array(z.string().trim().min(1).max(200)).max(10).optional(),
    page: pageInput.optional(),
    page_id: z.string().trim().min(1).optional(),
    quiz: quizInput.optional(),
    mode: z.enum(['upsert', 'append-quiz']).optional(),
  })
  .superRefine((value, ctx) => {
    const mode = value.mode ?? 'upsert'
    if (mode === 'upsert' && !value.page) {
      ctx.addIssue({ code: 'custom', path: ['page'], message: 'Für mode "upsert" wird "page" mit title und content_md benötigt.' })
    }
    if (mode === 'append-quiz') {
      if (!value.quiz) ctx.addIssue({ code: 'custom', path: ['quiz'], message: 'Für mode "append-quiz" wird "quiz" benötigt.' })
      if (!value.page_id && !value.page?.title && !(value.path && value.path.length)) {
        ctx.addIssue({
          code: 'custom',
          path: ['page_id'],
          message: 'Zielseite fehlt: page_id angeben oder subject + path (+ page.title).',
        })
      }
    }
  })

export type IngestInput = z.infer<typeof ingestInput>
export type QuestionInput = z.infer<typeof questionInput>
export type QuizInput = z.infer<typeof quizInput>

/* ------------------------------------------------------------------ */
/* Editor shape (UI "Quiz bearbeiten")                                 */
/* ------------------------------------------------------------------ */

export const quizEditInput = z.object({
  title: z.string().trim().min(1).max(200),
  questions: z
    .array(
      z.object({
        id: z.string().optional(),
        type: z.enum(['mc', 'tf', 'text']),
        prompt: z.string().trim().min(1, 'Die Frage darf nicht leer sein.').max(1000),
        answers: z
          .array(
            z.object({
              id: z.string().optional(),
              text: z.string().trim().min(1, 'Antworten dürfen nicht leer sein.').max(500),
              correct: z.boolean(),
            }),
          )
          .max(8),
        explanation: z.string().trim().max(3000).nullish(),
        topicId: z.string().nullish(),
      }),
    )
    .min(1, 'Ein Quiz braucht mindestens eine Frage.'),
})

export type QuizEditInput = z.infer<typeof quizEditInput>

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatPath(path: ReadonlyArray<PropertyKey>): string {
  let out = ''
  for (const part of path) {
    if (typeof part === 'number') out += `[${part}]`
    else out += out ? `.${String(part)}` : String(part)
  }
  return out
}

export function issuesFromZod(error: z.ZodError): Issue[] {
  return error.issues.map((i) => ({ path: formatPath(i.path), message: i.message }))
}

/** Parses with zod and throws a ValidationError with readable issues. */
export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, message = 'Ungültige Eingabe.'): T {
  const result = schema.safeParse(data)
  if (!result.success) throw new ValidationError(message, issuesFromZod(result.error))
  return result.data
}

export type NormalizedQuestion = {
  type: QuestionType
  prompt: string
  answers: Answer[]
  explanation: string | null
  topicHint: string | null
}

function answer(text: string, correct: boolean): Answer {
  return { id: newId(8), text, correct }
}

/**
 * Brings a question from Claude into canonical form and checks the rules:
 * - mc: 2–8 answers, exactly one correct
 * - tf: `correct: true|false` shorthand or two answers with exactly one correct
 * - text: accepted answers (all count as correct)
 */
export function normalizeQuestion(q: QuestionInput, index: number, basePath = 'quiz.questions'): NormalizedQuestion {
  const path = `${basePath}[${index}]`
  const label = `Frage ${index + 1}`
  const issues: Issue[] = []

  let type: QuestionType | undefined = q.type
  if (!type) {
    if (typeof q.correct === 'boolean') type = 'tf'
    else if (q.answers && q.answers.length) type = 'mc'
    else if (q.correct !== undefined) type = 'text'
  }

  let answers: Answer[] = []
  if (!type) {
    issues.push({ path, message: `${label}: Typ unklar – "type" angeben ("mc", "tf" oder "text") und Antworten ergänzen.` })
  } else if (type === 'mc') {
    const list = q.answers ?? []
    if (list.length < 2) issues.push({ path: `${path}.answers`, message: `${label}: Multiple Choice braucht mindestens 2 Antworten.` })
    const correctCount = list.filter((a) => a.correct).length
    if (list.length >= 2 && correctCount !== 1) {
      issues.push({
        path: `${path}.answers`,
        message: `${label}: Genau eine Antwort muss "correct": true haben (gefunden: ${correctCount}).`,
      })
    }
    answers = list.map((a) => answer(a.text, Boolean(a.correct)))
  } else if (type === 'tf') {
    if (typeof q.correct === 'boolean') {
      answers = [answer('Wahr', q.correct), answer('Falsch', !q.correct)]
    } else if (q.answers && q.answers.length === 2 && q.answers.filter((a) => a.correct).length === 1) {
      answers = q.answers.map((a) => answer(a.text, Boolean(a.correct)))
    } else {
      issues.push({
        path: `${path}.correct`,
        message: `${label}: Wahr/Falsch braucht "correct": true oder false (oder zwei Antworten, genau eine richtig).`,
      })
    }
  } else {
    const accepted = q.answers?.length
      ? q.answers.map((a) => a.text)
      : Array.isArray(q.correct)
        ? q.correct
        : typeof q.correct === 'string'
          ? [q.correct]
          : []
    if (accepted.length === 0) {
      issues.push({ path: `${path}.answers`, message: `${label}: Freitext braucht mindestens eine akzeptierte Antwort.` })
    }
    answers = accepted.map((text) => answer(text, true))
  }

  if (issues.length) throw new ValidationError(issues[0].message, issues)
  return {
    type: type!,
    prompt: q.prompt,
    answers,
    explanation: q.explanation?.trim() || null,
    topicHint: q.topic?.trim() || null,
  }
}

/** Normalizes all questions and collects every problem at once (so Claude can fix them in one go). */
export function normalizeQuestions(list: QuestionInput[], basePath = 'quiz.questions'): NormalizedQuestion[] {
  const issues: Issue[] = []
  const out: NormalizedQuestion[] = []
  list.forEach((q, i) => {
    try {
      out.push(normalizeQuestion(q, i, basePath))
    } catch (e) {
      if (e instanceof ValidationError) issues.push(...e.issues)
      else throw e
    }
  })
  if (issues.length) throw new ValidationError(`${issues.length} Problem(e) im Quiz.`, issues)
  return out
}

/** Checks the rules for questions edited in the UI. */
export function validateEditedQuestions(input: QuizEditInput): void {
  const issues: Issue[] = []
  input.questions.forEach((q, i) => {
    const label = `Frage ${i + 1}`
    const correct = q.answers.filter((a) => a.correct).length
    if (q.type === 'mc') {
      if (q.answers.length < 2) issues.push({ path: `questions[${i}]`, message: `${label}: mindestens 2 Antworten.` })
      else if (correct !== 1) issues.push({ path: `questions[${i}]`, message: `${label}: genau eine richtige Antwort markieren.` })
    } else if (q.type === 'tf') {
      if (q.answers.length !== 2 || correct !== 1) {
        issues.push({ path: `questions[${i}]`, message: `${label}: Wahr oder Falsch als richtig markieren.` })
      }
    } else if (q.answers.length === 0) {
      issues.push({ path: `questions[${i}]`, message: `${label}: mindestens eine akzeptierte Antwort.` })
    }
  })
  if (issues.length) throw new ValidationError(issues[0].message, issues)
}
