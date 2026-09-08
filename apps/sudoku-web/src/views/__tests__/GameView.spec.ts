// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { CELLS } from '@vue-sudoku/sudoku-core'
import { usePuzzleHandoff } from '@vue-sudoku/sudoku-core'
import type { Difficulty, Puzzle } from '@vue-sudoku/sudoku-core'
import GameView from '../GameView.vue'

/**
 * The worker client is mocked so `generate()` is controllable from the test:
 * each call gets its own deferred promise, resolved on demand, so a test can
 * hold a generation "in flight" while it pokes at the rest of the view.
 */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const generateCalls: { difficulty: Difficulty; deferred: ReturnType<typeof deferred<Puzzle>> }[] =
  []

vi.mock('@/workers/sudokuClient', () => ({
  createSudokuClient: () => ({
    generate: vi.fn((difficulty: Difficulty) => {
      const entry = { difficulty, deferred: deferred<Puzzle>() }
      generateCalls.push(entry)
      return entry.deferred.promise
    }),
    solve: vi.fn(),
    cancel: vi.fn(),
    dispose: vi.fn(),
  }),
}))

/** A puzzle that is easy to tell apart from another one in a saved payload. */
function markedPuzzle(marker: number): Puzzle {
  const puzzle = new Uint8Array(CELLS)
  const solution = new Uint8Array(CELLS).fill(1)
  puzzle[0] = marker
  solution[0] = marker
  return { puzzle, solution }
}

function readSavedGame(): { difficulty: Difficulty; puzzle: number[] } | null {
  const raw = localStorage.getItem('vue-sudoku:game')
  if (!raw) return null
  return JSON.parse(raw)
}

const STUBS = {
  SudokuBoard: true,
  NumberPad: true,
  GameControls: true,
  GameStatusBar: true,
  WinDialog: true,
  HintPanel: true,
}

describe('GameView', () => {
  beforeEach(() => {
    localStorage.clear()
    usePuzzleHandoff().clear()
    generateCalls.length = 0
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('never persists a difficulty label that does not match the puzzle on screen', async () => {
    const wrapper = mount(GameView, { global: { stubs: STUBS } })
    await flushPromises()

    // Initial mount kicked off `newGame()` at the default difficulty, 'easy'.
    expect(generateCalls).toHaveLength(1)
    expect(generateCalls[0]!.difficulty).toBe('easy')
    generateCalls[0]!.deferred.resolve(markedPuzzle(1))
    await flushPromises()

    // Loading that puzzle touches game.board, which schedules a debounced
    // save (see the `watch([game.board, game.notes])` in GameView) that has
    // not fired yet — this is the "stale save in flight" the race exploits.

    // Switch difficulty before that save fires. A second generation starts,
    // but has not resolved.
    const expertButton = wrapper
      .findAll('.picker__option')
      .find((button) => button.text() === 'expert')!
    await expertButton.trigger('click')

    expect(generateCalls).toHaveLength(2)
    expect(generateCalls[1]!.difficulty).toBe('expert')

    // Let the stale 400ms debounced save fire. The puzzle on screen is still
    // the easy one — the expert generation has not resolved.
    await vi.advanceTimersByTimeAsync(400)

    const savedWhileGenerating = readSavedGame()
    expect(savedWhileGenerating).not.toBeNull()
    // The saved puzzle must still be the one actually on screen (marker 1,
    // easy) — whatever difficulty label goes with it must say 'easy', not
    // whatever the picker was switched to mid-flight.
    expect(savedWhileGenerating!.puzzle[0]).toBe(1)
    expect(savedWhileGenerating!.difficulty).toBe('easy')

    // Once the new puzzle actually arrives, the label and the puzzle update
    // together.
    generateCalls[1]!.deferred.resolve(markedPuzzle(2))
    await flushPromises()

    const savedAfterGeneration = readSavedGame()
    expect(savedAfterGeneration!.puzzle[0]).toBe(2)
    expect(savedAfterGeneration!.difficulty).toBe('expert')
  })
})
