import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { E2E } from '../../playwright.config'

export async function login(page: Page) {
  await page.goto('/login')
  await page.fill('input[name=password]', E2E.password)
  await page.click('button[type=submit]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))
}

export async function ingest(request: APIRequestContext, body: unknown) {
  const res = await request.post('/api/ingest', { headers: { Authorization: `Bearer ${E2E.token}` }, data: body })
  expect(res.ok(), await res.text()).toBeTruthy()
  return (await res.json()) as { url: string; pageId: string; quizId: string | null; path: string }
}

let counter = 0
/** Unique names so tests don't depend on each other's data. */
export function unique(prefix: string) {
  counter++
  return `${prefix} ${Date.now().toString(36).slice(-4)}${counter}`
}

export const sampleContent = `## Superkompensation

Nach einer Trainingsbelastung sinkt die Leistungsfähigkeit zunächst ab und steigt dann über das Ausgangsniveau.

:::merke
Der nächste Reiz sollte im Hoch der Superkompensation gesetzt werden.
:::

## Progressive Belastung

Belastungen müssen schrittweise gesteigert werden.`

export const sampleQuiz = {
  title: 'Prinzipien',
  questions: [
    {
      type: 'mc',
      prompt: 'Wann sollte der nächste Reiz gesetzt werden?',
      answers: [{ text: 'Direkt danach' }, { text: 'Im Hoch der Superkompensation', correct: true }, { text: 'Nie' }],
      explanation: 'Dann ist die Leistungsfähigkeit am höchsten.',
      topic: 'Superkompensation',
    },
    { type: 'tf', prompt: 'Belastungen sollen schrittweise steigen.', correct: true, topic: 'Progressive Belastung' },
    { type: 'text', prompt: 'Wie heißt das Anstiegsphänomen?', correct: ['Superkompensation'] },
  ],
}
