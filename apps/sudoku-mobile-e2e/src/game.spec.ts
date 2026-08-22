import { test, expect } from '@playwright/test'

test('visits the app root url and lands on Play', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('ion-title')).toHaveText('Play')
  await expect(page.getByRole('group', { name: 'Sudoku board' })).toBeVisible()
})

test('can select a cell and enter a digit', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('group', { name: 'Sudoku board' })).toBeVisible()

  const emptyCell = page.locator('.cell[aria-pressed="false"]:not(.is-given)').first()
  const index = await emptyCell.getAttribute('data-index')
  await emptyCell.click()
  await page.getByRole('button', { name: /Enter 1,/ }).click()

  await expect(page.locator(`.cell[data-index="${index}"]`)).toContainText('1')
})

test('switches to the Stats tab', async ({ page }) => {
  await page.goto('/')
  await page.locator('ion-tab-button', { hasText: 'Stats' }).click()
  await expect(page.locator('ion-title', { hasText: 'Stats' })).toBeVisible()
})
