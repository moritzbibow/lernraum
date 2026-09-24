import { expect, test, type Page } from '@playwright/test'
import { ingest, login, unique } from './helpers'

function row(page: Page, name: string) {
  return page.locator('[role="row"]').filter({ has: page.getByRole('link', { name, exact: true }) })
}

test('create subject and folder, move, rename, delete and undo', async ({ page, request }) => {
  const subject = unique('Fach')
  const pageTitle = unique('Seite')
  await login(page)
  await page.goto('/verwalten')

  await page.getByRole('button', { name: '+ Fach' }).click()
  await page.getByLabel('Name').fill(subject)
  await page.getByRole('button', { name: 'Anlegen' }).click()
  await expect(row(page, subject)).toBeVisible()

  await row(page, subject).getByRole('checkbox').click()
  await page.getByRole('button', { name: '+ Ordner' }).click()
  await page.getByLabel('Name').fill('Ordner A')
  await page.getByRole('button', { name: 'Anlegen' }).click()
  await expect(row(page, 'Ordner A')).toBeVisible()
  await row(page, subject).getByRole('checkbox').click() // deselect

  // A page from Claude in the same subject
  await ingest(request, { subject, page: { title: pageTitle, content_md: '## Eins\n\nText' } })
  await page.reload()
  await expect(row(page, pageTitle)).toBeVisible()

  // Move via "Verschieben nach…"
  await row(page, pageTitle).getByRole('checkbox').click()
  await page.getByRole('button', { name: 'Verschieben nach…' }).click()
  await page.getByPlaceholder('Filtern …').fill('Ordner A')
  await page.getByRole('option', { name: /Ordner A/ }).click()
  await page.getByRole('button', { name: 'Hierher verschieben' }).click()
  await expect(page.getByText('Nach „Ordner A“ verschoben')).toBeVisible()
  await expect(row(page, pageTitle).getByRole('link')).toHaveAttribute('href', /\/ordner-a\//)

  // Rename
  await row(page, pageTitle).getByRole('checkbox').click()
  await page.getByRole('toolbar', { name: 'Auswahl' }).getByRole('button', { name: 'Umbenennen' }).click()
  await page.getByLabel('Name').fill(`${pageTitle} neu`)
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(row(page, `${pageTitle} neu`)).toBeVisible()

  // Delete + undo (the renamed row is still selected)
  await expect(row(page, `${pageTitle} neu`).getByRole('checkbox')).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('toolbar', { name: 'Auswahl' }).getByRole('button', { name: 'Löschen' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click()
  await expect(row(page, `${pageTitle} neu`)).toHaveCount(0)
  await page.getByRole('button', { name: 'Rückgängig' }).click()
  await expect(row(page, `${pageTitle} neu`)).toBeVisible()
})

test('drag & drop moves a page into another folder', async ({ page, request }) => {
  const subject = unique('DnD')
  const moved = unique('Zieh mich')
  await ingest(request, { subject, path: ['Quelle'], page: { title: moved, content_md: '## A\n\nx' } })
  await ingest(request, { subject, path: ['Ziel'], page: { title: 'Platzhalter', content_md: '## B\n\ny' } })
  await login(page)
  await page.goto('/verwalten')

  // Expand the subject and the source folder
  for (const name of [subject, 'Quelle']) {
    const r = row(page, name)
    if ((await r.getByRole('button', { name: 'Aufklappen' }).count()) > 0) await r.getByRole('button', { name: 'Aufklappen' }).click()
  }
  const source = row(page, moved)
  const target = row(page, 'Ziel')
  await expect(source).toBeVisible()
  const from = await source.boundingBox()
  const to = await target.boundingBox()
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2)
  await page.mouse.down()
  await page.mouse.move(from!.x + from!.width / 2 + 10, from!.y + from!.height / 2 + 10, { steps: 4 })
  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 12 })
  await expect(target.getByText('HIER ABLEGEN')).toBeVisible()
  await page.mouse.up()
  await expect(page.getByText('Nach „Ziel“ verschoben')).toBeVisible()
  await expect(row(page, moved).getByRole('link')).toHaveAttribute('href', /\/ziel\//)
})
