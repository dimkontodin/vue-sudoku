import { test, expect, type Page } from '@playwright/test'

// See here how to get started:
// https://playwright.dev/docs/intro
test('visits the app root url', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Sudoku' })).toBeVisible()
})

const board = (page: Page) => page.getByRole('group', { name: 'Sudoku board' })
const status = (page: Page) => page.locator('.status')
const nav = (page: Page, name: string) => page.getByRole('link', { name, exact: true })
// Anchored: the Show mistakes note mentions "auto-check" and would match it too.
const toggle = (page: Page, name: string) =>
  page.locator('.settings__toggle', { hasText: new RegExp(`^\\s*${name}`) })

async function openGame(page: Page) {
  // A fresh browser context starts with empty storage, but be explicit: a saved
  // preference from another test would make the defaults below meaningless.
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(board(page)).toBeVisible()
}

test.describe('the mistakes counter is not a spoiler channel', () => {
  test('is hidden by default, while hints used is not', async ({ page }) => {
    await openGame(page)

    // With auto-check off the board says nothing about a wrong digit, but a
    // tally ticking up the instant one lands still tells the player which one
    // it was, so it is withheld too. Hints used leaks nothing and stays.
    await expect(status(page)).toContainText('Hints')
    await expect(status(page)).not.toContainText('Mistakes')
  })

  test('Settings reveals it, and auto-check implies it', async ({ page }) => {
    await openGame(page)

    await nav(page, 'Settings').click()
    await toggle(page, 'Show mistakes').locator('input').check()
    await nav(page, 'Play').click()
    await expect(status(page)).toContainText('Mistakes')

    // Auto-check already flags wrong digits on the board, so hiding the tally
    // behind its own switch would withhold nothing: it follows auto-check.
    await nav(page, 'Settings').click()
    await toggle(page, 'Show mistakes').locator('input').uncheck()
    await toggle(page, 'Auto-check').locator('input').check()
    await expect(toggle(page, 'Show mistakes')).toContainText(
      'Always shown while auto-check is on.',
    )
    await expect(toggle(page, 'Show mistakes').locator('input')).toBeDisabled()

    await nav(page, 'Play').click()
    await expect(status(page)).toContainText('Mistakes')
  })

  test('the setting survives a reload', async ({ page }) => {
    await openGame(page)

    await nav(page, 'Settings').click()
    await toggle(page, 'Auto-check').locator('input').check()
    await page.reload()

    await expect(toggle(page, 'Auto-check').locator('input')).toBeChecked()
  })
})

test.describe('restart asks before wiping the board', () => {
  const restartButton = (page: Page) =>
    page.locator('.controls').getByRole('button', { name: 'Restart' })
  const dialog = (page: Page) => page.getByRole('dialog', { name: 'Restart this puzzle?' })

  /** Types a digit into the first empty cell and returns that cell's index. */
  async function fillOneCell(page: Page): Promise<string> {
    const [index] = await page
      .locator('.cell:not(.is-given)')
      .evaluateAll((cells) =>
        cells
          .filter((cell) => !cell.textContent?.trim())
          .map((cell) => (cell as HTMLElement).dataset.index ?? ''),
      )
    if (index === undefined) throw new Error('no empty cell to fill')
    await page.locator(`.cell[data-index="${index}"]`).click()
    await page.getByRole('button', { name: /^Enter 1,/ }).click()
    await expect(page.locator(`.cell[data-index="${index}"]`)).toContainText('1')
    return index
  }

  test('Cancel keeps the entries, Restart clears them', async ({ page }) => {
    await openGame(page)
    const index = await fillOneCell(page)
    const cell = page.locator(`.cell[data-index="${index}"]`)

    await restartButton(page).click()
    await expect(dialog(page)).toBeVisible()
    // Destructive action: Cancel has the focus, so a stray Enter is harmless.
    await expect(dialog(page).getByRole('button', { name: 'Cancel' })).toBeFocused()
    await dialog(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog(page)).toBeHidden()
    await expect(cell).toContainText('1')

    await restartButton(page).click()
    await dialog(page).getByRole('button', { name: 'Restart' }).click()
    await expect(dialog(page)).toBeHidden()
    await expect(cell).toHaveText('')
  })

  test('Escape cancels', async ({ page }) => {
    await openGame(page)
    const index = await fillOneCell(page)

    await restartButton(page).click()
    await expect(dialog(page)).toBeVisible()
    await page.keyboard.press('Escape')

    await expect(dialog(page)).toBeHidden()
    await expect(page.locator(`.cell[data-index="${index}"]`)).toContainText('1')
  })
})

test('the theme setting overrides the OS and is remembered', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await openGame(page)
  const html = page.locator('html')

  await nav(page, 'Settings').click()
  await page.locator('.settings__segment', { hasText: 'Dark' }).click()
  await expect(html).toHaveAttribute('data-theme', 'dark')

  await page.reload()
  await expect(html).toHaveAttribute('data-theme', 'dark')

  await page.locator('.settings__segment', { hasText: 'System' }).click()
  await expect(html).not.toHaveAttribute('data-theme')
})
