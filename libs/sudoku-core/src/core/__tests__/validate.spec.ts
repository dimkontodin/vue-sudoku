import { describe, expect, it } from 'vitest'
import { CELLS } from '../constants'
import { conflictsIn, isComplete } from '../validate'
import type { Board } from '../types'

function boardFromRows(rows: number[][]): Board {
  return Uint8Array.from(rows.flat())
}

describe('validate', () => {
  it('reports no conflicts on an empty board', () => {
    expect(conflictsIn(new Uint8Array(CELLS)).size).toBe(0)
  })

  it('flags two equal digits in the same row', () => {
    const board = new Uint8Array(CELLS)
    board[0] = 5
    board[1] = 5
    const conflicts = conflictsIn(board)
    expect(conflicts.has(0)).toBe(true)
    expect(conflicts.has(1)).toBe(true)
    expect(conflicts.size).toBe(2)
  })

  it('flags two equal digits in the same column', () => {
    const board = new Uint8Array(CELLS)
    board[0] = 7 // row 0, col 0
    board[9] = 7 // row 1, col 0
    const conflicts = conflictsIn(board)
    expect(conflicts.has(0)).toBe(true)
    expect(conflicts.has(9)).toBe(true)
  })

  it('flags two equal digits in the same box', () => {
    const board = new Uint8Array(CELLS)
    board[0] = 3 // row 0, col 0 -> box 0
    board[10] = 3 // row 1, col 1 -> box 0
    const conflicts = conflictsIn(board)
    expect(conflicts.has(0)).toBe(true)
    expect(conflicts.has(10)).toBe(true)
  })

  it('does not flag equal digits that are not peers', () => {
    const board = new Uint8Array(CELLS)
    board[0] = 4 // row 0, col 0, box 0
    board[80] = 4 // row 8, col 8, box 8
    expect(conflictsIn(board).size).toBe(0)
  })

  it('treats an incomplete board as not complete even without conflicts', () => {
    const board = new Uint8Array(CELLS)
    board[0] = 1
    expect(isComplete(board)).toBe(false)
  })

  it('recognizes a fully filled, conflict-free board as complete', () => {
    // A valid, solved 9x9 grid.
    const solved = boardFromRows([
      [5, 3, 4, 6, 7, 8, 9, 1, 2],
      [6, 7, 2, 1, 9, 5, 3, 4, 8],
      [1, 9, 8, 3, 4, 2, 5, 6, 7],
      [8, 5, 9, 7, 6, 1, 4, 2, 3],
      [4, 2, 6, 8, 5, 3, 7, 9, 1],
      [7, 1, 3, 9, 2, 4, 8, 5, 6],
      [9, 6, 1, 5, 3, 7, 2, 8, 4],
      [2, 8, 7, 4, 1, 9, 6, 3, 5],
      [3, 4, 5, 2, 8, 6, 1, 7, 9],
    ])
    expect(conflictsIn(solved).size).toBe(0)
    expect(isComplete(solved)).toBe(true)
  })
})
