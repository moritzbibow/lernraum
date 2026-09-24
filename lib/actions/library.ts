'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertSession } from '../auth/session'
import { AppError } from '../services/errors'
import { markAllSeen } from '../services/inbox'
import {
  createFolder,
  createSubject,
  deleteItems,
  movePages,
  moveQuiz,
  moveSubject,
  renameItem,
  restoreBatch,
  type ItemRef,
} from '../services/manage'

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string }

function errorMessage(e: unknown): string {
  if (e instanceof AppError) return e.message
  if (e instanceof z.ZodError) return 'Ungültige Eingabe.'
  console.error('[lernraum] Aktion fehlgeschlagen:', e)
  return 'Das hat nicht geklappt. Bitte erneut versuchen.'
}

async function run<T extends object>(fn: () => T): Promise<ActionResult<T>> {
  try {
    await assertSession()
    const data = fn()
    revalidatePath('/', 'layout')
    return { ok: true, ...data }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}

const itemRef = z.object({ kind: z.enum(['subject', 'page', 'quiz']), id: z.string().min(1) })
const nullableId = z.string().min(1).nullable()

export async function createSubjectAction(name: string) {
  return run(() => ({ subject: createSubject(z.string().trim().min(1).max(100).parse(name)) }))
}

export async function createFolderAction(input: { subjectId: string | null; parentId: string | null; title: string }) {
  return run(() => {
    const data = z.object({ subjectId: nullableId, parentId: nullableId, title: z.string().trim().min(1).max(200) }).parse(input)
    return { id: createFolder(data) }
  })
}

export async function renameAction(ref: ItemRef, name: string) {
  return run(() => {
    renameItem(itemRef.parse(ref), z.string().trim().min(1).max(200).parse(name))
    return {}
  })
}

export async function moveAction(ids: string[], target: { subjectId: string | null; parentId: string | null; beforeId?: string | null; afterId?: string | null }) {
  return run(() => {
    const t = z
      .object({ subjectId: nullableId, parentId: nullableId, beforeId: nullableId.optional(), afterId: nullableId.optional() })
      .parse(target)
    return { moved: movePages(z.array(z.string().min(1)).max(500).parse(ids), t) }
  })
}

export async function moveSubjectAction(id: string, position: { beforeId?: string | null; afterId?: string | null }) {
  return run(() => {
    moveSubject(z.string().min(1).parse(id), z.object({ beforeId: nullableId.optional(), afterId: nullableId.optional() }).parse(position))
    return {}
  })
}

export async function deleteAction(refs: ItemRef[]) {
  return run(() => deleteItems(z.array(itemRef).min(1).max(500).parse(refs)))
}

export async function restoreAction(batch: number) {
  return run(() => ({ restored: restoreBatch(z.number().int().positive().parse(batch)) }))
}

export async function moveQuizAction(quizId: string, pageId: string) {
  return run(() => {
    moveQuiz(z.string().min(1).parse(quizId), z.string().min(1).parse(pageId))
    return {}
  })
}

export async function markAllSeenAction() {
  return run(() => ({ count: markAllSeen() }))
}
