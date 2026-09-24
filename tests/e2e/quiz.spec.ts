import { expect, test } from '@playwright/test'
import { ingest, login, sampleContent, sampleQuiz, unique } from './helpers'

test('play a quiz with the keyboard and see the result', async ({ page, request }) => {
  const res = await ingest(request, { subject: 'Sport', page: { title: unique('Quizseite'), content_md: sampleContent }, quiz: sampleQuiz })
  await login(page)
  await page.goto(`/quiz/${res.quizId}`)
  await expect(page.getByText('Frage 1 · Multiple Choice')).toBeVisible()

  await page.keyboard.press('b') // correct
  await expect(page.getByText('RICHTIG', { exact: true })).toBeVisible()
  await expect(page.getByText('WARUM', { exact: true })).toBeVisible()
  await page.keyboard.press('Enter')

  await page.keyboard.press('2') // "Falsch" → wrong
  await expect(page.getByText('FALSCH', { exact: true })).toBeVisible()
  await page.keyboard.press('Enter')

  await page.getByPlaceholder('Deine Antwort …').fill('superkompensaton') // one typo is tolerated
  await page.keyboard.press('Enter')
  await expect(page.getByText('RICHTIG', { exact: true })).toBeVisible()
  await page.keyboard.press('Enter')

  await expect(page.getByText('2 / 3')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Falsche wiederholen (1)' })).toBeVisible()

  // The attempt is stored.
  await page.goto('/quizze')
  await expect(page.getByText('2 / 3').first()).toBeVisible()
})

test('edit a quiz: change, save, discard', async ({ page, request }) => {
  const res = await ingest(request, { subject: 'Sport', page: { title: unique('Editorseite'), content_md: sampleContent }, quiz: sampleQuiz })
  await login(page)
  await page.goto(`/quiz/${res.quizId}/bearbeiten`)
  const prompt = page.locator('textarea').first()
  await expect(prompt).toHaveValue('Wann sollte der nächste Reiz gesetzt werden?')

  await prompt.fill('Wann setzt man den nächsten Trainingsreiz?')
  await expect(page.getByText('UNGESPEICHERT')).toBeVisible()
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText('Gespeichert')).toBeVisible()
  await expect(page.getByText('UNGESPEICHERT')).toHaveCount(0)

  await page.reload()
  await expect(page.locator('textarea').first()).toHaveValue('Wann setzt man den nächsten Trainingsreiz?')

  // Switching the type needs a valid answer set; discard restores everything.
  await page.getByRole('radio', { name: 'Wahr / Falsch' }).click()
  await expect(page.getByText('UNGESPEICHERT')).toBeVisible()
  await page.getByRole('button', { name: 'Verwerfen' }).click()
  await expect(page.getByRole('radio', { name: 'Multiple Choice' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText('UNGESPEICHERT')).toHaveCount(0)
})
