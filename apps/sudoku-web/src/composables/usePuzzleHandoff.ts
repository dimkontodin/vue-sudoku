import { shallowRef } from 'vue'
import type { Puzzle } from '@/core/types'

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
const pending = shallowRef<Puzzle | null>(null)

export function usePuzzleHandoff() {
  function set(puzzle: Puzzle): void {
    pending.value = puzzle
  }

  /** Reads and clears in one go, so a puzzle is never handed over twice. */
  function take(): Puzzle | null {
    const puzzle = pending.value
    pending.value = null
    return puzzle
  }

  function clear(): void {
    pending.value = null
  }

  return { pending, set, take, clear }
}
