import { test, expect, type Page } from '@playwright/test'

// A phone viewport, not the 1280x720 the projects default to — the whole point
// of these controls is that they work at 360-430px wide.
test.use({ viewport: { width: 390, height: 844 } })

async function openSolver(page: Page) {
  await page.goto('/tabs/solver')
  await expect(page.locator('ion-title')).toHaveText('Solver')
}

const statusValue = (page: Page) =>
  page.locator('.stats > div').filter({ hasText: 'Status' }).locator('dd')

test.describe('Solver tab', () => {
  test('New puzzle stays clickable across repeated generates', async ({ page }) => {
    await openSolver(page)

    // Guards the Ionic attribute-latching trap: `disabled` and `aria-disabled`
    // on an IonButton stick after the first render, which left this dead after
    // the very first generate. It is a native <button> now, so this must track
    // across every isGenerating true -> false cycle, not just the first.
    const newPuzzle = page.locator('.solver__btn--outline')
    await expect(newPuzzle).toBeEnabled()

    await newPuzzle.click()
    await expect(newPuzzle).toBeEnabled()
    await newPuzzle.click()
    await expect(newPuzzle).toBeEnabled()
  })

  test('Solve is enabled once a puzzle exists and actually starts a solve', async ({ page }) => {
    await openSolver(page)

    // Same trap on the `!puzzle` binding: it starts disabled before the first
    // generate resolves, so a latched `disabled` here would leave the solver
    // permanently unusable.
    const solve = page.locator('.solver__btn--solid')
    await expect(solve).toBeEnabled()

    await solve.click()
    await expect(statusValue(page)).toHaveText('solved')
  })
})
