import { test, expect, type Page } from '@playwright/test'

// A phone viewport, not the 1280x720 the projects default to — the whole point
// of these controls is that they work at 360-430px wide.
test.use({ viewport: { width: 390, height: 844 } })

// Ionic's router outlet keeps the page being navigated away from mounted for
// its back-stack, so after a cross-tab push both the old and new
// ion-title/board exist in the DOM at once — the new one is appended last.
const board = (page: Page) => page.getByRole('group', { name: 'Sudoku board' }).last()

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
