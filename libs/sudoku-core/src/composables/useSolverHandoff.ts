import { shallowRef } from 'vue'
import type { Board } from '../core/types'

/**
 * A one-shot slot for passing a grid to the solver visualiser, the sibling of
 * usePuzzleHandoff.
 *
 * A bare Board, not a Puzzle: the whole point of sending a grid here rather
 * than to the game is that its solution is not known yet — that is what the
 * solver is about to work out on screen.
 */
const pending = shallowRef<Board | null>(null)

export function useSolverHandoff() {
  function set(board: Board): void {
    pending.value = board.slice()
  }

  /** Reads and clears in one go, so a grid is never handed over twice. */
  function take(): Board | null {
    const board = pending.value
    pending.value = null
    return board
  }

  function clear(): void {
    pending.value = null
  }

  return { pending, set, take, clear }
}
