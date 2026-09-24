import { expect, test } from '@playwright/test'
import { login } from './helpers'

test('dark is the default and the switch persists light mode', async ({ page }) => {
  await login(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('switch', { name: 'Dunkler Modus' }).first().click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('switch', { name: 'Dunkler Modus' }).first().click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})
