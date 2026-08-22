import { CELLS } from './constants'
import { peersOf } from './grid'
import { ALL_NOTES, noteMask } from './notes'
import type { Board, Notes } from './types'

/**
 * The legal candidates for every empty cell, as a bitmask grid.
 *
 * "Basic exclusion" only: a digit is a candidate unless a peer in the same row,
 * column or box already holds it. No deduction beyond the rules of the game —
 * that is what the techniques in `./techniques` are for.
 *
 * The return type is deliberately `Notes` (Uint16Array of bitmasks), identical
 * to the player's pencil marks. That is what makes "fill in my notes" a single
 * assignment, and lets the logical solver and the notes UI share one structure.
 *
 * Filled cells are 0, not their own value.
 */
export function computeCandidates(board: Board): Notes {
  const candidates = new Uint16Array(CELLS)

  for (let index = 0; index < CELLS; index++) {
    if (board[index]) continue

    let mask = ALL_NOTES
    for (const peer of peersOf(index)) {
      const value = board[peer]
      if (value) mask &= ~noteMask(value)
    }
    candidates[index] = mask
  }

  return candidates
}

/** Candidates for one cell, without building the whole grid. */
export function candidatesFor(board: Board, index: number): number {
  if (board[index]) return 0

  let mask = ALL_NOTES
  for (const peer of peersOf(index)) {
    const value = board[peer]
    if (value) mask &= ~noteMask(value)
  }
  return mask
}

/**
 * True when some empty cell has no candidates at all — the board cannot be
 * completed, whether or not its filled cells conflict.
 */
export function hasDeadCell(candidates: Notes, board: Board): boolean {
  for (let index = 0; index < CELLS; index++) {
    if (!board[index] && candidates[index] === 0) return true
  }
  return false
}
