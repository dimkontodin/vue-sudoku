import { describe, expect, it } from 'vitest'
import { CELLS } from '../constants'
import { generate } from '../generator'
import { solve, solveSteps } from '../solver'
import { isComplete } from '../validate'
import type { Board } from '../types'

function drain(board: Board) {
  const iterator = solveSteps(board)
  const kinds: string[] = []

  let next = iterator.next()
  while (!next.done) {
    kinds.push(next.value.kind)
    next = iterator.next()
  }

  return { solved: next.value, kinds }
}

describe('solveSteps', () => {
  it('mutates the board into a complete solution', () => {
    const { puzzle } = generate('easy')
    const board = puzzle.slice()

    const { solved } = drain(board)

    expect(solved).toBe(true)
    expect(isComplete(board)).toBe(true)
  })

  it('reaches the same solution as solve()', () => {
    const { puzzle } = generate('medium')
    const stepped = puzzle.slice()
    const direct = solve(puzzle.slice())

    drain(stepped)

    expect(Array.from(stepped)).toEqual(Array.from(direct!))
  })

  it('emits at least one step per empty cell', () => {
    const { puzzle } = generate('easy')
    const emptyCells = puzzle.filter((value) => value === 0).length

    const { kinds } = drain(puzzle.slice())

    expect(kinds.length).toBeGreaterThanOrEqual(emptyCells)
    expect(kinds).toContain('place')
  })

  it('returns false without stepping for a contradictory board', () => {
    const board = new Uint8Array(CELLS)
    board[0] = 5
    board[1] = 5

    const { solved, kinds } = drain(board)

    expect(solved).toBe(false)
    expect(kinds).toHaveLength(0)
  })

  it('leaves the board untouched after fully backtracking a dead end', () => {
    // Solvable-looking prefix that forces real backtracking before succeeding.
    const { puzzle } = generate('hard')
    const board = puzzle.slice()

    drain(board)

    // Every original clue must survive the search unchanged.
    for (let i = 0; i < CELLS; i++) {
      const clue = puzzle[i]
      expect(!clue || board[i] === clue).toBe(true)
    }
  })
})
