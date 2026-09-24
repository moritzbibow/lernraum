import { expect, test } from '@playwright/test'
import { ingest, login, sampleContent, sampleQuiz, unique } from './helpers'

test('ingested page appears in the inbox, can be read and found', async ({ page, request }) => {
  const title = unique('Stunde 4 –')
  const res = await ingest(request, { subject: 'Sport', path: ['Sporttheorie'], page: { title, content_md: sampleContent }, quiz: sampleQuiz })
  expect(res.url).toContain('/f/sport/sporttheorie/')

  await login(page)
  // Overview: "Frisch eingespeist" lists it, the inbox badge counts it.
  await expect(page.getByText('Frisch eingespeist')).toBeVisible()
  await expect(page.locator('main').getByText(title).first()).toBeVisible()
  const badge = page.locator('nav[aria-label="Hauptnavigation"] a[href="/eingang"] span')
  const before = Number(await badge.textContent())
  expect(before).toBeGreaterThanOrEqual(2)

  // Inbox → page
  await page.goto('/eingang')
  await page.getByRole('link', { name: new RegExp(title) }).first().click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: /1 · Superkompensation/ })).toBeVisible()
  await expect(page.locator('.callout__label', { hasText: 'Merke' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Themen' }).getByText('Progressive Belastung')).toBeVisible()
  await expect(page.locator('aside').getByText('3 Fragen')).toBeVisible()

  // Opening marks the page as seen → badge goes down by one.
  await expect.poll(async () => Number((await badge.textContent()) ?? 0)).toBe(before - 1)

  // ⌘K search finds content (substring of a compound word).
  await page.keyboard.press('Control+k')
  await page.getByPlaceholder(/Was willst du lernen/).fill('kompensation')
  await expect(page.locator('[cmdk-item]').filter({ hasText: title }).first()).toBeVisible()
})

test('short links survive moves', async ({ page, request }) => {
  const title = unique('Kurzlink')
  const res = await ingest(request, { subject: 'Mathe', page: { title, content_md: '## Eins\n\nText' } })
  await login(page)
  await page.goto(`/p/${res.pageId}`)
  await expect(page).toHaveURL(res.url.replace(/^https?:\/\/[^/]+/, ''))
})
