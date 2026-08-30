import { test, expect, type Page } from '@playwright/test'

// A phone viewport, not the 1280x720 the projects default to — the whole point
// of these controls is that they work at 360-430px wide.
test.use({ viewport: { width: 390, height: 844 } })

// Ionic's router outlet keeps the page being navigated away from mounted for
// its back-stack, so after a cross-tab push both the old and new
// ion-title/board exist in the DOM at once — the new one is appended last.
const board = (page: Page) => page.getByRole('group', { name: 'Sudoku board' }).last()
const digitKey = (page: Page, digit: number) =>
  page.getByRole('button', { name: new RegExp(`^Enter ${digit},`) }).last()
const cellAt = (page: Page, index: number) => page.locator(`.cell[data-index="${index}"]`).last()

async function openEnter(page: Page) {
  await page.goto('/tabs/enter')
  await expect(page.locator('ion-title')).toHaveText('Enter')
}

test.describe('Enter tab', () => {
  test('Check puzzle and Play it become usable once their preconditions are met', async ({ page }) => {
    await openEnter(page)

    const check = page.getByRole('button', { name: 'Check puzzle' })
    const playIt = page.getByRole('button', { name: 'Play it' })

    // Guards the Ionic attribute-latching trap: `disabled` and `aria-disabled`
    // on an IonButton stick after the first render, which left both buttons
    // dead for the whole session — Play it starts disabled (nothing has been
    // validated yet), so it was permanently unclickable. Both are native
    // <button>s now, so this must track.
    await expect(check).toBeDisabled()
    await expect(playIt).toBeDisabled()

    await page.getByRole('button', { name: 'Example' }).click()
    await expect(check).toBeEnabled()
    await expect(playIt).toBeDisabled()

    await check.click()
    await expect(page.getByText('Valid puzzle with exactly one solution.')).toBeVisible()
    await expect(playIt).toBeEnabled()

    await playIt.click()
    await expect(board(page)).toBeVisible()
    await expect(page.locator('ion-title').last()).toHaveText('Play')
  })

  test('editing the puzzle after a check re-disables Play it', async ({ page }) => {
    await openEnter(page)

    await page.getByRole('button', { name: 'Example' }).click()
    await page.getByRole('button', { name: 'Check puzzle' }).click()

    const playIt = page.getByRole('button', { name: 'Play it' })
    await expect(playIt).toBeEnabled()

    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(playIt).toBeDisabled()
  })
})

test.describe('Enter tab input', () => {
  test('a digit arms, then every square tapped takes it', async ({ page }) => {
    await openEnter(page)

    await digitKey(page, 5).click()
    await expect(digitKey(page, 5)).toHaveAttribute('aria-pressed', 'true')

    await cellAt(page, 0).click()
    await cellAt(page, 40).click()

    await expect(cellAt(page, 0)).toContainText('5')
    await expect(cellAt(page, 40)).toContainText('5')
    await expect(page.getByText('2 clues')).toBeVisible()

    // Still armed — entering a puzzle means placing one digit many times over.
    await expect(digitKey(page, 5)).toHaveAttribute('aria-pressed', 'true')
  })

  test('tapping a square first sends the next digit straight into it', async ({ page }) => {
    await openEnter(page)

    await cellAt(page, 3).click()
    await digitKey(page, 7).click()

    await expect(cellAt(page, 3)).toContainText('7')
    await expect(digitKey(page, 7)).toHaveAttribute('aria-pressed', 'false')
  })

  test('clues that clash are flagged while they are still being typed', async ({ page }) => {
    await openEnter(page)

    await digitKey(page, 6).click()
    await cellAt(page, 0).click()
    await cellAt(page, 1).click()

    // No check has been run — this is the live conflict pass, not a verdict.
    await expect(page.locator('.cell.has-conflict')).toHaveCount(2)
  })

  test('a checked puzzle is graded by the techniques it needs', async ({ page }) => {
    await openEnter(page)

    await page.getByRole('button', { name: 'Example' }).click()
    await page.getByRole('button', { name: 'Check puzzle' }).click()

    await expect(page.getByText('Graded')).toBeVisible()
    await expect(page.getByText('Techniques used:')).toBeVisible()
  })

  test('Watch the solver carries the entered puzzle to the Solver tab', async ({ page }) => {
    await openEnter(page)

    const watch = page.getByRole('button', { name: 'Watch the solver' })
    // Nothing has been checked yet, so there is no verdict to act on.
    await expect(watch).toBeDisabled()

    await page.getByRole('button', { name: 'Example' }).click()
    await page.getByRole('button', { name: 'Check puzzle' }).click()
    await expect(watch).toBeEnabled()

    await watch.click()
    await expect(page.locator('ion-title').last()).toHaveText('Solver')
    await expect(page.getByText('Searching the puzzle you entered.')).toBeVisible()

    // The generator never ran: the grid on screen is the 17 clues just entered.
    await expect(page.locator('.board__cell.is-clue')).toHaveCount(17)
  })
})
