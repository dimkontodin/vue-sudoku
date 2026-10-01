// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The composable is a module-level singleton, so each test loads a fresh copy
// to simulate a page reload reading whatever the last one saved.
async function load() {
  vi.resetModules()
  const { useGameplayPrefs } = await import('../useGameplayPrefs')
  return useGameplayPrefs()
}

beforeEach(() => {
  localStorage.clear()
})

describe('useGameplayPrefs', () => {
  it('defaults to quiet: nothing flags a wrong digit or counts it', async () => {
    const prefs = await load()

    expect(prefs.autoCheck.value).toBe(false)
    expect(prefs.showMistakes.value).toBe(false)
    expect(prefs.mistakesVisible.value).toBe(false)
  })

  it('shows the mistakes counter when asked, without auto-check', async () => {
    const prefs = await load()

    prefs.setShowMistakes(true)

    expect(prefs.autoCheck.value).toBe(false)
    expect(prefs.mistakesVisible.value).toBe(true)
  })

  it('shows the counter whenever auto-check is on, since the board is flagging digits anyway', async () => {
    const prefs = await load()

    prefs.setAutoCheck(true)

    expect(prefs.showMistakes.value).toBe(false)
    expect(prefs.mistakesVisible.value).toBe(true)
  })

  it('survives a reload', async () => {
    const first = await load()
    first.setAutoCheck(true)
    first.setShowMistakes(true)

    const reloaded = await load()

    expect(reloaded.autoCheck.value).toBe(true)
    expect(reloaded.showMistakes.value).toBe(true)
  })

  it('falls back to the defaults when the stored value is malformed', async () => {
    localStorage.setItem('vue-sudoku:gameplay', '{"v":1,"autoCheck":"yes"}')

    const prefs = await load()

    expect(prefs.autoCheck.value).toBe(false)
    expect(prefs.mistakesVisible.value).toBe(false)
  })
})
