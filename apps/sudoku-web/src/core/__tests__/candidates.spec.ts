import { describe, expect, it } from 'vitest'
import { CELLS } from '../constants'
import { candidatesFor, computeCandidates, hasDeadCell } from '../candidates'
import { generate } from '../generator'
import { peersOf } from '../grid'
import { ALL_NOTES, hasNote, noteCount, notesToArray, soleNote } from '../notes'

describe('computeCandidates', () => {
  it('offers every digit on an empty board', () => {
    const candidates = computeCandidates(new Uint8Array(CELLS))
    for (let index = 0; index < CELLS; index++) {
      expect(candidates[index]).toBe(ALL_NOTES)
    }
  })

  it('leaves filled cells at zero, not at their own value', () => {
    const { puzzle } = generate('easy')
    const candidates = computeCandidates(puzzle)

    const nonZero = [...puzzle.keys()].filter(
      (index) => puzzle[index] !== 0 && candidates[index] !== 0,
    )

    expect(nonZero).toEqual([])
  })

  it('excludes every digit already held by a peer', () => {
    const { puzzle } = generate('medium')
    const candidates = computeCandidates(puzzle)

    const leaks: string[] = []

    for (let index = 0; index < CELLS; index++) {
      if (puzzle[index]) continue

      for (const peer of peersOf(index)) {
        const value = puzzle[peer]
        if (value && hasNote(candidates[index]!, value)) {
          leaks.push(`cell ${index} still offers ${value}, held by peer ${peer}`)
        }
      }
    }

    expect(leaks).toEqual([])
  })

  it('always includes the true answer for an empty cell', () => {
    const missing: string[] = []

    for (let trial = 0; trial < 5; trial++) {
      const { puzzle, solution } = generate('hard')
      const candidates = computeCandidates(puzzle)

      for (let index = 0; index < CELLS; index++) {
        if (puzzle[index]) continue
        if (!hasNote(candidates[index]!, solution[index]!)) {
          missing.push(`trial ${trial} cell ${index} lost its answer`)
        }
      }
    }

    expect(missing).toEqual([])
  })

  it('agrees with the single-cell helper', () => {
    const { puzzle } = generate('expert')
    const grid = computeCandidates(puzzle)

    for (let index = 0; index < CELLS; index++) {
      expect(candidatesFor(puzzle, index)).toBe(grid[index])
    }
  })

  it('finds a naked single as a one-bit mask', () => {
    const { solution } = generate('easy')
    const board = solution.slice()
    board[40] = 0

    const candidates = computeCandidates(board)
    expect(noteCount(candidates[40]!)).toBe(1)
    expect(soleNote(candidates[40]!)).toBe(solution[40])
  })

  it('returns the same bitmask type as notes, so it can be assigned straight in', () => {
    const { puzzle } = generate('easy')
    const candidates = computeCandidates(puzzle)

    expect(candidates).toBeInstanceOf(Uint16Array)
    expect(candidates.length).toBe(CELLS)
    expect(() => notesToArray(candidates[0]!)).not.toThrow()
  })
})

describe('hasDeadCell', () => {
  it('is false for a solvable board', () => {
    const { puzzle } = generate('medium')
    expect(hasDeadCell(computeCandidates(puzzle), puzzle)).toBe(false)
  })

  it('is true when an empty cell has no candidates left', () => {
    // Fill a row with 1-8, leaving the ninth cell needing 9, then place 9
    // in that cell's column elsewhere.
    const board = new Uint8Array(CELLS)
    for (let col = 0; col < 8; col++) board[col] = col + 1
    board[8 + 9] = 9

    expect(hasDeadCell(computeCandidates(board), board)).toBe(true)
  })
})
