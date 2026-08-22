import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { generate } from '../../core/generator'
import { isComplete } from '../../core/validate'
import { createFallbackSudokuClient } from '../../workers/fallbackClient'
import { useSolver } from '../useSolver'

// No `Worker` in the node environment, so these exercise the client's
// main-thread fallback — same runner, same callbacks, same guarantees.

// requestAnimationFrame does not exist here either; run callbacks immediately
// so coalesced values land without needing a real frame.
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional no-op stub
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Lets queued microtasks and timers run so a fallback solve can finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

function withScope<T>(body: (solver: ReturnType<typeof useSolver>) => Promise<T>): Promise<T> {
  const scope = effectScope()
  const result = scope.run(() => body(useSolver(createFallbackSudokuClient)))!
  return result.finally(() => scope.stop())
}

describe('useSolver', () => {
  it('starts idle with no board', async () => {
    await withScope(async (solver) => {
      expect(solver.status.value).toBe('idle')
      expect(solver.board.value).toBeNull()
      expect(solver.steps.value).toBe(0)
    })
  })

  it('solves a puzzle and exposes the finished board', async () => {
    await withScope(async (solver) => {
      const { puzzle } = generate('easy')

      solver.solve(puzzle, 'instant')
      await settle()

      expect(solver.status.value).toBe('solved')
      expect(solver.board.value).not.toBeNull()
      expect(isComplete(solver.board.value!)).toBe(true)
      expect(solver.steps.value).toBeGreaterThan(0)
    })
  })

  it('does not fire callbacks before solve() has returned', async () => {
    await withScope(async (solver) => {
      const { puzzle } = generate('easy')

      // A fast solve finishes inside the first batch. If the fallback ran
      // synchronously, status would already be terminal on this line.
      solver.solve(puzzle, 'instant')
      expect(solver.status.value).toBe('solving')

      await settle()
      expect(solver.status.value).toBe('solved')
    })
  })

  // The reported bug: solve once, then ask for a new puzzle, and the old
  // solved board stayed on screen because nothing cleared it.
  describe('reset', () => {
    it('clears the board and status after a completed solve', async () => {
      await withScope(async (solver) => {
        const { puzzle } = generate('easy')

        solver.solve(puzzle, 'instant')
        await settle()
        expect(solver.board.value).not.toBeNull()

        solver.reset()

        expect(solver.status.value).toBe('idle')
        expect(solver.board.value).toBeNull()
        expect(solver.steps.value).toBe(0)
        expect(solver.backtracks.value).toBe(0)
        expect(solver.elapsedMs.value).toBe(0)
      })
    })

    it('is safe to call when nothing has run', async () => {
      await withScope(async (solver) => {
        solver.reset()
        expect(solver.status.value).toBe('idle')
        expect(solver.board.value).toBeNull()
      })
    })

    it('leaves no stale board for a second puzzle to render over', async () => {
      await withScope(async (solver) => {
        const first = generate('easy')
        solver.solve(first.puzzle, 'instant')
        await settle()

        const solved = Array.from(solver.board.value!)

        // What "New puzzle" does.
        solver.reset()

        expect(solver.board.value).toBeNull()

        // And a fresh solve must not begin from the previous result.
        const second = generate('easy')
        solver.solve(second.puzzle, 'instant')
        expect(solver.board.value).toBeNull()

        await settle()
        expect(Array.from(solver.board.value!)).not.toEqual(solved)
      })
    })

    it('clears a previous error', async () => {
      await withScope(async (solver) => {
        // Two identical clues in one row: unsolvable, so the run fails.
        const board = new Uint8Array(81)
        board[0] = 5
        board[1] = 5

        solver.solve(board, 'instant')
        await settle()
        expect(solver.status.value).toBe('failed')

        solver.reset()
        expect(solver.status.value).toBe('idle')
        expect(solver.errorMessage.value).toBeNull()
      })
    })
  })

  it('clears the previous board when a new solve starts', async () => {
    await withScope(async (solver) => {
      const first = generate('easy')
      solver.solve(first.puzzle, 'instant')
      await settle()
      expect(solver.board.value).not.toBeNull()

      const second = generate('easy')
      solver.solve(second.puzzle, 'instant')

      // Cleared synchronously, before any progress for the new run arrives.
      expect(solver.board.value).toBeNull()
      expect(solver.status.value).toBe('solving')
    })
  })

  it('reports an unsolvable board as failed rather than solved', async () => {
    await withScope(async (solver) => {
      const board = new Uint8Array(81)
      board[0] = 5
      board[1] = 5

      solver.solve(board, 'instant')
      await settle()

      expect(solver.status.value).toBe('failed')
    })
  })
})
