'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertSession } from '../auth/session'
import { AppError } from '../services/errors'
import { recordQuizOpen } from '../services/progress'
import { recordAttempt, saveQuiz } from '../services/quizzes'
import type { ActionResult } from './library'

function message(e: unknown) {
  if (e instanceof AppError) return e.issues[0]?.message ?? e.message
  console.error('[lernraum] Quiz-Aktion fehlgeschlagen:', e)
  return 'Das hat nicht geklappt. Bitte erneut versuchen.'
}

export async function saveQuizAction(quizId: string, data: unknown): Promise<ActionResult> {
  try {
    await assertSession()
    saveQuiz(z.string().min(1).parse(quizId), data)
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: message(e) }
  }
}

export async function recordAttemptAction(quizId: string, details: { questionId: string; correct: boolean }[]): Promise<ActionResult> {
  try {
    await assertSession()
    const parsed = z.array(z.object({ questionId: z.string().min(1), correct: z.boolean() })).max(500).parse(details)
    recordAttempt(z.string().min(1).parse(quizId), { details: parsed })
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: message(e) }
  }
}

export async function markQuizOpenedAction(quizId: string): Promise<{ hadUnseen: boolean }> {
  await assertSession()
  const result = recordQuizOpen(z.string().min(1).parse(quizId))
  if (result.hadUnseen) revalidatePath('/', 'layout')
  return result
}
