import { describe, expect, it } from 'vitest'
import { CELLS } from '../constants'
import { countSolutions, solve } from '../solver'
import type { Board } from '../types'

// A well-known "hard" example puzzle and its unique solution.
const CLASSIC_PUZZLE: number[] = [
  5, 3, 0, 0, 7, 0, 0, 0, 0, 6, 0, 0, 1, 9, 5, 0, 0, 0, 0, 9, 8, 0, 0, 0, 0, 6, 0, 8, 0, 0, 0, 6, 0,
  0, 0, 3, 4, 0, 0, 8, 0, 3, 0, 0, 1, 7, 0, 0, 0, 2, 0, 0, 0, 6, 0, 6, 0, 0, 0, 0, 2, 8, 0, 0, 0, 0,
  4, 1, 9, 0, 0, 5, 0, 0, 0, 0, 8, 0, 0, 7, 9,
]

const CLASSIC_SOLUTION: number[] = [
  5, 3, 4, 6, 7, 8, 9, 1, 2, 6, 7, 2, 1, 9, 5, 3, 4, 8, 1, 9, 8, 3, 4, 2, 5, 6, 7, 8, 5, 9, 7, 6, 1,
  4, 2, 3, 4, 2, 6, 8, 5, 3, 7, 9, 1, 7, 1, 3, 9, 2, 4, 8, 5, 6, 9, 6, 1, 5, 3, 7, 2, 8, 4, 2, 8, 7,
  4, 1, 9, 6, 3, 5, 3, 4, 5, 2, 8, 6, 1, 7, 9,
]

describe('solve', () => {
  it('solves a known puzzle to its known solution', () => {
    const board: Board = Uint8Array.from(CLASSIC_PUZZLE)
    const result = solve(board)
    expect(result).not.toBeNull()
    expect(Array.from(result!)).toEqual(CLASSIC_SOLUTION)
  })

  it('returns the board unchanged when it is already solved', () => {
    const board: Board = Uint8Array.from(CLASSIC_SOLUTION)
    const result = solve(board)
    expect(Array.from(result!)).toEqual(CLASSIC_SOLUTION)
  })

  it('returns null for a board with no valid solution', () => {
    const board = new Uint8Array(CELLS)
    board[0] = 5 // row 0, col 0
    board[1] = 5 // row 0, col 1 — duplicate in the same row, unsolvable
    expect(solve(board)).toBeNull()
  })

  // Regression: the search only derives candidates for empty cells, so it
  // cannot see a contradiction between two *given* clues. Without the
  // up-front conflict guard this board takes exponential time to reject.
  it('rejects a contradictory board immediately rather than searching', () => {
    const board = new Uint8Array(CELLS)
    board[0] = 5
    board[1] = 5

    const started = performance.now()
    expect(solve(board)).toBeNull()
    expect(countSolutions(board, 2)).toBe(0)
    expect(performance.now() - started).toBeLessThan(100)
  })
})

describe('countSolutions', () => {
  it('finds exactly 1 solution for a uniquely-solvable puzzle', () => {
    const board: Board = Uint8Array.from(CLASSIC_PUZZLE)
    expect(countSolutions(board, 2)).toBe(1)
  })

  it('stops at the limit for a board with many solutions', () => {
    const board = new Uint8Array(CELLS) // fully empty — has vastly more than 2 solutions
    expect(countSolutions(board, 2)).toBe(2)
  })

  it('returns 0 for an unsolvable board', () => {
    const board = new Uint8Array(CELLS)
    board[0] = 5
    board[1] = 5
    expect(countSolutions(board, 2)).toBe(0)
  })
})

describe('countSolutions with a node budget', () => {
  it('gives up and returns -1 when the budget is exceeded', () => {
    const board = new Uint8Array(CELLS) // fully empty — trivially exceeds a tiny budget
    expect(countSolutions(board, 2, 1)).toBe(-1)
  })

  it('still finds the real count when the budget is generous', () => {
    const board: Board = Uint8Array.from(CLASSIC_PUZZLE)
    expect(countSolutions(board, 2, 100_000)).toBe(1)
  })
})
