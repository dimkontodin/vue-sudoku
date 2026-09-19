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
  test('Check puzzle and Play it become usable once their preconditions are met', async ({
    page,
  }) => {
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
    // The Play screen dropped its ion-title when the header collapsed to one
    // toolbar; the difficulty button is what identifies it now.
    await expect(page.getByRole('button', { name: /^Difficulty:/ })).toBeVisible()
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

test.describe('reading a puzzle from a picture', () => {
  // Chromium only, and for a harness reason rather than an app one: Firefox and
  // WebKit drop `clipboardData` when a ClipboardEvent is built by hand, so the
  // synthetic paste below never carries the image. A real paste works on all
  // three — there is just no way to fake one outside Chromium.
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'synthetic ClipboardEvent cannot carry files outside Chromium',
  )

  const PUZZLE = '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79'

  /**
   * Draws a sudoku on a canvas in the page and pastes it in as a PNG, which is
   * the real path a screenshot takes: clipboard -> paste event -> core's
   * vision pipeline -> the grid. Rendering it here rather than checking in a
   * binary keeps the fixture readable and the repo free of test images.
   */
  async function pasteRenderedPuzzle(page: Page, puzzle: string) {
    await page.evaluate(async (text) => {
      const S = 54
      const M = 30
      const side = S * 9 + M * 2
      const canvas = document.createElement('canvas')
      canvas.width = side
      canvas.height = side

      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no 2d context')

      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, side, side)
      ctx.strokeStyle = '#000'
      for (let i = 0; i <= 9; i += 1) {
        ctx.lineWidth = i % 3 === 0 ? 3 : 1
        ctx.beginPath()
        ctx.moveTo(M + i * S, M)
        ctx.lineTo(M + i * S, M + 9 * S)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(M, M + i * S)
        ctx.lineTo(M + 9 * S, M + i * S)
        ctx.stroke()
      }

      ctx.fillStyle = '#000'
      ctx.font = '600 32px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (let i = 0; i < 81; i += 1) {
        const ch = text[i]
        if (!ch || ch === '.') continue
        ctx.fillText(ch, M + (i % 9) * S + S / 2, M + Math.floor(i / 9) * S + S / 2 + 1)
      }

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('no blob')

      const transfer = new DataTransfer()
      transfer.items.add(new File([blob], 'puzzle.png', { type: 'image/png' }))
      window.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }),
      )
    }, puzzle)
  }

  /** Resolves once the paste has been read into the grid. */
  async function expectRead(page: Page) {
    await expect(page.locator('.enter__meta span').first()).not.toHaveText('0 clues')
  }

  test('a pasted screenshot lands in the grid', async ({ page }) => {
    await openEnter(page)
    await pasteRenderedPuzzle(page, PUZZLE)
    await expectRead(page)

    const read = await page
      .locator('.cell')
      .evaluateAll((cells) => cells.map((cell) => cell.textContent?.trim() || '.').join(''))

    // Not an exact match: how a glyph rasterises depends on which fonts the
    // machine running the tests actually has, so pinning all 81 characters here
    // would be testing the font stack. Exactness on known pixels is core's job
    // (see libs/sudoku-core vision.spec.ts); this asserts the wiring holds and
    // that the result is usable.
    const wrong = [...read].flatMap((ch, i) => (ch === PUZZLE[i] ? [] : [i]))
    expect(wrong.length).toBeLessThanOrEqual(3)

    const flagged = await page
      .locator('.cell.is-hint-pattern')
      .evaluateAll((cells) => cells.map((cell) => Number((cell as HTMLElement).dataset.index)))

    // The guarantee that actually matters: whatever it got wrong, it flagged.
    for (const index of wrong) expect(flagged).toContain(index)
  })

  test('a read puzzle is offered for checking, never straight for play', async ({ page }) => {
    await openEnter(page)
    await pasteRenderedPuzzle(page, PUZZLE)
    await expectRead(page)

    // The grid is filled in and Check is live, but Play it stays shut until the
    // player has actually validated what came out of the picture.
    await expect(page.getByRole('button', { name: 'Check puzzle' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Play it' })).toBeDisabled()
  })

  test('cells it is unsure of are highlighted, and clear once corrected', async ({ page }) => {
    await openEnter(page)
    await pasteRenderedPuzzle(page, PUZZLE)
    await expectRead(page)

    const flagged = page.locator('.cell.is-hint-pattern')
    const before = await flagged.count()
    expect(before).toBeGreaterThan(0)

    // Changing a flagged cell resolves it: the flag tracks what was read, so it
    // drops as soon as the value stops being that.
    const first = flagged.first()
    await first.click()
    await page.getByRole('button', { name: /^Enter 4,/ }).click()

    await expect(flagged).toHaveCount(before - 1)
  })
})
