import { expect, test } from '@playwright/test'
import { ingest, login, sampleContent, unique } from './helpers'

test('mobile: bottom navigation, library and reading', async ({ page, request }) => {
  const title = unique('Mobil')
  await ingest(request, { subject: 'Englisch', path: ['Grammatik'], page: { title, content_md: sampleContent } })
  await login(page)
  const nav = page.getByRole('navigation', { name: 'Navigation' })
  await expect(nav).toBeVisible()
  await expect(page.locator('aside')).toBeHidden() // no sidebar on phones

  await nav.getByRole('link', { name: 'Bibliothek' }).click()
  await expect(page.getByRole('heading', { name: 'Bibliothek' })).toBeVisible()
  await page.getByRole('link', { name: 'Englisch', exact: true }).click()
  await page.getByRole('link', { name: title }).click()
  await expect(page.getByRole('heading', { level: 2, name: /Superkompensation/ })).toBeVisible()
  await nav.getByRole('link', { name: /Eingang/ }).click()
  await expect(page.getByRole('heading', { name: 'Eingang' })).toBeVisible()
})
