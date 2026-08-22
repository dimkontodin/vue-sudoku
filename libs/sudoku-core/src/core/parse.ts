import { CELLS } from './constants'
import { countSolutions, solve } from './solver'
import { conflictsIn } from './validate'
import type { Board } from './types'

/**
 * The minimum clues a uniquely-solvable puzzle can have. Proved exhaustively in
 * 2012 (McGuire, Tugemann & Civario): no 16-clue puzzle has a unique solution.
 * A free rejection before any search.
 */
export const MIN_CLUES = 17

export type ParseError = 'length' | 'characters'

export interface ParseResult {
  board: Board | null
  error: ParseError | null
}

/**
 * Reads an 81-cell grid. Accepts `.`, `0` and `_` as empty, ignores all
 * whitespace, and rejects anything else rather than guessing.
 */
export function parseBoard(text: string): ParseResult {
  const cleaned = text.replace(/\s/g, '')

  if (!/^[0-9._]*$/.test(cleaned)) return { board: null, error: 'characters' }
  if (cleaned.length !== CELLS) return { board: null, error: 'length' }

  const board = new Uint8Array(CELLS)
  for (let index = 0; index < CELLS; index++) {
    const char = cleaned[index]!
    board[index] = char === '.' || char === '_' || char === '0' ? 0 : Number(char)
  }

  return { board, error: null }
}

export function formatBoard(board: Board): string {
  return [...board].map((value) => (value === 0 ? '.' : String(value))).join('')
}

export function clueCount(board: Board): number {
  let count = 0
  for (let index = 0; index < CELLS; index++) if (board[index]) count++
  return count
}

export type PuzzleVerdict =
  'empty' | 'conflicting' | 'tooFewClues' | 'unsolvable' | 'unique' | 'ambiguous' | 'tooHard'

export interface Validation {
  verdict: PuzzleVerdict
  clues: number
  /** Set on 'conflicting' so the UI can highlight the offending cells. */
  conflicts: ReadonlySet<number>
  /** Set on 'unique'. */
  solution: Board | null
  message: string
}

const MESSAGES: Record<PuzzleVerdict, string> = {
  empty: 'Enter some clues to begin.',
  conflicting: 'Two clues clash in the same row, column or box.',
  tooFewClues: `A puzzle needs at least ${MIN_CLUES} clues to have a single solution.`,
  unsolvable: 'No solution exists for these clues.',
  unique: 'Valid puzzle with exactly one solution.',
  ambiguous: 'These clues allow more than one solution.',
  tooHard: 'Could not decide — these clues leave too much open to check quickly.',
}

/**
 * Classifies a hand-entered grid, cheapest check first.
 *
 * The node budget matters here in a way it does not for generated puzzles:
 * user input is adversarial by nature, and an unbounded uniqueness check on a
 * near-empty grid would hang the tab.
 */
export function validatePuzzle(board: Board, nodeBudget = 500_000): Validation {
  const clues = clueCount(board)
  const conflicts = conflictsIn(board)

  const base = { clues, conflicts, solution: null as Board | null }

  if (clues === 0) return { ...base, verdict: 'empty', message: MESSAGES.empty }
  if (conflicts.size > 0) return { ...base, verdict: 'conflicting', message: MESSAGES.conflicting }
  if (clues < MIN_CLUES) return { ...base, verdict: 'tooFewClues', message: MESSAGES.tooFewClues }

  const count = countSolutions(board.slice(), 2, nodeBudget)

  if (count === -1) return { ...base, verdict: 'tooHard', message: MESSAGES.tooHard }
  if (count === 0) return { ...base, verdict: 'unsolvable', message: MESSAGES.unsolvable }
  if (count > 1) return { ...base, verdict: 'ambiguous', message: MESSAGES.ambiguous }

  // Re-solve to hand back the actual grid; countSolutions only counts.
  return {
    ...base,
    verdict: 'unique',
    solution: solve(board.slice()),
    message: MESSAGES.unique,
  }
}
