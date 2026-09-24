import { expect, test } from '@playwright/test'
import { E2E } from '../../playwright.config'

test('redirects to login and rejects a wrong password', async ({ page }) => {
  await page.goto('/verwalten')
  await expect(page).toHaveURL(/\/login\?next=%2Fverwalten/)
  await page.fill('input[name=password]', 'falsch')
  await page.click('button[type=submit]')
  await expect(page.getByText('Das Passwort stimmt nicht.')).toBeVisible()
  await page.fill('input[name=password]', E2E.password)
  await page.click('button[type=submit]')
  await expect(page).toHaveURL(/\/verwalten$/)
  await expect(page.getByRole('heading', { name: 'Verwalten' })).toBeVisible()
})

test('API requires a bearer token', async ({ request }) => {
  expect((await request.get('/api/tree')).status()).toBe(401)
  expect((await request.get('/api/tree', { headers: { Authorization: 'Bearer falsch' } })).status()).toBe(401)
  expect((await request.get('/api/tree', { headers: { Authorization: `Bearer ${E2E.token}` } })).status()).toBe(200)
})

test('logout ends the session', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name=password]', E2E.password)
  await page.click('button[type=submit]')
  await page.waitForURL('/')
  await page.goto('/einstellungen')
  await page.getByRole('button', { name: 'Abmelden' }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})
