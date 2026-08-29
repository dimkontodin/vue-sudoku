import { test, expect, type Page } from '@playwright/test'

// A phone viewport, not the 1280x720 the projects default to — the whole point
// of these controls is that they work at 360-430px wide.
test.use({ viewport: { width: 390, height: 844 } })

const board = (page: Page) => page.getByRole('group', { name: 'Sudoku board' })
const digitKey = (page: Page, digit: number) =>
  page.getByRole('button', { name: new RegExp(`^Enter ${digit},`) })
const cellAt = (page: Page, index: string) => page.locator(`.cell[data-index="${index}"]`)

async function openGame(page: Page) {
  await page.goto('/')
  await expect(board(page)).toBeVisible()
}

/** Indices of the first `count` cells that are empty and not givens. */
async function emptyCells(page: Page, count: number): Promise<string[]> {
  const indices = await page.locator('.cell:not(.is-given)').evaluateAll((cells) =>
    cells.filter((cell) => !cell.textContent?.trim()).map((cell) => (cell as HTMLElement).dataset.index ?? ''),
  )
  expect(indices.length).toBeGreaterThanOrEqual(count)
  return indices.slice(0, count)
}

/** A real press-and-hold — the composable keys off pointer timing, not clicks. */
async function longPress(page: Page, selector: string, ms = 600) {
  const box = await page.locator(selector).boundingBox()
  if (!box) throw new Error(`no bounding box for ${selector}`)

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  // The hold duration IS the thing under test — there is no state to poll for
  // here, so a real wait is the only way to cross the 400ms threshold.
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(ms)
  await page.mouse.up()
}

test('visits the app root url and lands on Play', async ({ page }) => {
  await openGame(page)
  await expect(page.locator('ion-title')).toHaveText('Play')
})

test('switches to the Stats tab', async ({ page }) => {
  await page.goto('/')
  await page.locator('ion-tab-button', { hasText: 'Stats' }).click()
  await expect(page.locator('ion-title', { hasText: 'Stats' })).toBeVisible()
})

test.describe('layout', () => {
  for (const size of [
    { width: 360, height: 640, name: 'small Android' },
    { width: 390, height: 844, name: 'iPhone 14' },
  ]) {
    test(`board fits without horizontal overflow on a ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height })
      await openGame(page)

      // The regression this guards: a fixed 380px board inside a padded
      // IonContent used to overflow every phone narrower than ~410px.
      const overflow = await page.evaluate(() => {
        const inner = document
          .querySelector('ion-content')
          ?.shadowRoot?.querySelector('.inner-scroll')
        const rect = document.querySelector('.board')?.getBoundingClientRect()
        return {
          scrollW: inner?.scrollWidth ?? 0,
          clientW: inner?.clientWidth ?? 0,
          boardRight: rect?.right ?? 0,
          docScrollW: document.documentElement.scrollWidth,
        }
      })

      expect(overflow.scrollW).toBe(overflow.clientW)
      expect(overflow.docScrollW).toBeLessThanOrEqual(size.width)
      expect(overflow.boardRight).toBeLessThanOrEqual(size.width)
    })
  }

  test('digit keys clear the 44px touch-target minimum', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    await openGame(page)

    const box = await page.locator('.pad__key').first().boundingBox()
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44)
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  })

  test('the pad stays pinned while the board area scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    await openGame(page)

    const footer = page.locator('ion-footer')
    const before = await footer.boundingBox()

    await page.evaluate(() => {
      const inner = document.querySelector('ion-content')?.shadowRoot?.querySelector('.inner-scroll')
      if (inner) inner.scrollTop = inner.scrollHeight
    })

    // Polls rather than sleeps: the footer must never move, so an immediately
    // satisfied assertion is the correct outcome.
    await expect
      .poll(async () => (await footer.boundingBox())?.y)
      .toBeCloseTo(before?.y ?? 0, 0)
    await expect(page.locator('.pad__key').first()).toBeInViewport()
  })
})

test.describe('cell-first input', () => {
  test('selecting a cell then tapping a digit writes it', async ({ page }) => {
    await openGame(page)

    const emptyCell = page.locator('.cell[aria-pressed="false"]:not(.is-given)').first()
    const index = await emptyCell.getAttribute('data-index')
    await emptyCell.click()
    await digitKey(page, 1).click()

    await expect(cellAt(page, index ?? '')).toContainText('1')
  })

  test('writing does not arm the digit', async ({ page }) => {
    await openGame(page)

    const [first, second] = await emptyCells(page, 2)
    await cellAt(page, first).click()
    await digitKey(page, 1).click()

    await expect(page.locator('.pad__key.is-active')).toHaveCount(0)

    // The next cell tap must select, not place — otherwise cell-first users
    // would silently fall into digit-first.
    await cellAt(page, second).click()
    await expect(cellAt(page, second)).toHaveText('')
    await expect(cellAt(page, second)).toHaveAttribute('aria-pressed', 'true')
  })

  test('re-tapping the digit already in the cell erases it', async ({ page }) => {
    await openGame(page)

    const [index] = await emptyCells(page, 1)
    await cellAt(page, index).click()
    await digitKey(page, 1).click()
    await expect(cellAt(page, index)).toContainText('1')

    await digitKey(page, 1).click()
    await expect(cellAt(page, index)).toHaveText('')
  })
})

test.describe('digit-first input', () => {
  test('arms a digit when nothing is selected and fills every cell tapped', async ({ page }) => {
    await openGame(page)

    // Nothing is selected on a fresh board, so the key arms rather than writes.
    await digitKey(page, 5).click()
    await expect(digitKey(page, 5)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.cell[aria-pressed="true"]')).toHaveCount(0)

    const targets = await emptyCells(page, 3)
    for (const index of targets) await cellAt(page, index).click()

    for (const index of targets) await expect(cellAt(page, index)).toContainText('5')

    // Still armed, still nothing selected — the mode persists across taps.
    await expect(digitKey(page, 5)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.cell[aria-pressed="true"]')).toHaveCount(0)
  })

  test('tapping a cell that already holds the armed digit erases it', async ({ page }) => {
    await openGame(page)

    const [index] = await emptyCells(page, 1)
    await digitKey(page, 5).click()
    await cellAt(page, index).click()
    await expect(cellAt(page, index)).toContainText('5')

    await cellAt(page, index).click()
    await expect(cellAt(page, index)).toHaveText('')
  })

  test('tapping the lit key disarms and hands the board back to selection', async ({ page }) => {
    await openGame(page)

    await digitKey(page, 5).click()
    await digitKey(page, 5).click()
    await expect(page.locator('.pad__key.is-active')).toHaveCount(0)

    const [index] = await emptyCells(page, 1)
    await cellAt(page, index).click()
    await expect(cellAt(page, index)).toHaveText('')
    await expect(cellAt(page, index)).toHaveAttribute('aria-pressed', 'true')
  })

  test('the armed digit is highlighted across the board', async ({ page }) => {
    await openGame(page)

    await digitKey(page, 4).click()

    const fours = await page
      .locator('.cell')
      .evaluateAll((cells) =>
        cells.filter((c) => c.querySelector('.cell__value')?.textContent?.trim() === '4').length,
      )

    expect(fours).toBeGreaterThan(0)
    await expect(page.locator('.cell.is-same-value')).toHaveCount(fours)
  })
})

test.describe('long press', () => {
  test('holding a digit adds it as a note without switching modes', async ({ page }) => {
    await openGame(page)

    const [index] = await emptyCells(page, 1)
    await cellAt(page, index).click()
    await longPress(page, '.pad__key >> nth=6') // the "7" key

    await expect(cellAt(page, index)).toHaveAttribute('aria-label', /notes 7/)
    // A pencil mark, not a value — the notes grid also renders the glyph "7",
    // so the distinction is which element holds it.
    await expect(cellAt(page, index).locator('.cell__value')).toHaveCount(0)
    await expect(cellAt(page, index).locator('.cell__notes')).toHaveCount(1)
    // And the pencil toggle was never flipped.
    await expect(page.getByRole('button', { name: 'Notes off' })).toBeVisible()
  })

  test('a tap right after a hold still writes', async ({ page }) => {
    await openGame(page)

    const [index] = await emptyCells(page, 1)
    await cellAt(page, index).click()
    await longPress(page, '.pad__key >> nth=6')
    await digitKey(page, 3).click()

    await expect(cellAt(page, index)).toContainText('3')
  })

  test('holding a filled cell erases it', async ({ page }) => {
    await openGame(page)

    const [index] = await emptyCells(page, 1)
    await cellAt(page, index).click()
    await digitKey(page, 1).click()
    await expect(cellAt(page, index)).toContainText('1')

    await longPress(page, `.cell[data-index="${index}"]`)
    await expect(cellAt(page, index)).toHaveText('')
  })
})

test.describe('secondary actions', () => {
  test('the overflow sheet holds the demoted controls and dismisses', async ({ page }) => {
    await openGame(page)

    await page.getByRole('button', { name: 'More actions' }).click()

    const sheet = page.locator('ion-action-sheet')
    await expect(sheet).toBeVisible()
    for (const label of ['Check now', 'Fill notes', 'Reveal a cell', 'Restart']) {
      await expect(sheet.getByText(label, { exact: true })).toBeVisible()
    }

    await sheet.getByText('Cancel', { exact: true }).click()
    await expect(sheet).toBeHidden()
  })

  test('Restart from the sheet clears the board back to its givens', async ({ page }) => {
    await openGame(page)

    const [index] = await emptyCells(page, 1)
    await cellAt(page, index).click()
    await digitKey(page, 1).click()
    await expect(cellAt(page, index)).toContainText('1')

    await page.getByRole('button', { name: 'More actions' }).click()
    await page.locator('ion-action-sheet').getByText('Restart', { exact: true }).click()

    await expect(cellAt(page, index)).toHaveText('')
  })

  test('Undo becomes usable once a move exists', async ({ page }) => {
    await openGame(page)

    const undo = page.getByRole('button', { name: 'Undo' })
    // Guards the Ionic attribute-latching trap: `disabled` and `aria-disabled`
    // on an IonButton stick after the first render, which left Undo dead for
    // the whole game. It is a native <button> now, so this must track.
    await expect(undo).toBeDisabled()

    const [index] = await emptyCells(page, 1)
    await cellAt(page, index).click()
    await digitKey(page, 1).click()

    await expect(undo).toBeEnabled()
    await undo.click()
    await expect(cellAt(page, index)).toHaveText('')
  })

  test('New game stays clickable after the first generate', async ({ page }) => {
    await openGame(page)

    const newGame = page.getByRole('button', { name: 'New game' })
    await expect(newGame).toBeEnabled()
    await newGame.click()
    await expect(board(page)).toBeVisible()
  })
})
