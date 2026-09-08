import { shallowRef } from 'vue'
import type { Difficulty, Puzzle } from '../core/types'

/**
 * A puzzle in flight to the game, plus the difficulty it was graded at when it
 * was sent — either by the generator (a known band) or by the analysis panel
 * on /enter or the solver (null when the grid was never graded there, e.g. a
 * verdict the grader cannot handle). The receiving screen must use this rather
 * than assume a fixed band: the whole reason a puzzle can carry any difficulty
 * at all is that it did not come from `generate()`.
 */
export interface PuzzleHandoff extends Puzzle {
  difficulty: Difficulty | null
}

/**
 * A one-shot slot for passing a hand-entered puzzle from /enter to the game.
 *
 * The ref lives at MODULE scope, not inside the function, so every caller
 * shares one value — this is shared state, unlike the per-instance state every
 * other composable here returns. It is the smallest possible version of what
 * Phase 7 will hand to Pinia, and a useful thing to compare against.
 *
 * Deliberately not persisted: a puzzle in flight between two routes has no
 * business surviving a reload, and the saved-game slot already handles the
 * game the player is actually in the middle of.
 */
const pending = shallowRef<PuzzleHandoff | null>(null)

export function usePuzzleHandoff() {
  function set(puzzle: PuzzleHandoff): void {
    pending.value = puzzle
  }

  /** Reads and clears in one go, so a puzzle is never handed over twice. */
  function take(): PuzzleHandoff | null {
    const puzzle = pending.value
    pending.value = null
    return puzzle
  }

  function clear(): void {
    pending.value = null
  }

  return { pending, set, take, clear }
}
