import { beforeAll, describe, expect, it } from 'vitest'
import { DIFFICULTY_CLUES } from '../constants'
import { generate } from '../generator'
import { countSolutions } from '../solver'
import { conflictsIn, isComplete } from '../validate'
import type { Difficulty, Puzzle } from '../types'

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert']

describe.each(DIFFICULTIES)('generate(%s)', (difficulty) => {
  // Generation is the expensive part (up to 81 uniqueness checks); run it
  // once per difficulty and assert everything against that one result.
  let result: Puzzle
  beforeAll(() => {
    result = generate(difficulty)
  })

  it('produces a complete, conflict-free solution', () => {
    expect(isComplete(result.solution)).toBe(true)
    expect(conflictsIn(result.solution).size).toBe(0)
  })

  it('produces a puzzle that is a subset of the solution', () => {
    const { puzzle, solution } = result
    for (let i = 0; i < puzzle.length; i++) {
      const clue = puzzle[i]
      expect(!clue || clue === solution[i]).toBe(true)
    }
  })

  it('produces a puzzle with exactly one solution', () => {
    expect(countSolutions(result.puzzle.slice(), 2)).toBe(1)
  })

  it('does not remove more clues than the difficulty target allows', () => {
    const clueCount = result.puzzle.filter((value) => value !== 0).length
    // The generator only ever removes a clue, so it can land above the
    // target (when removing further would break uniqueness) but never below it.
    expect(clueCount).toBeGreaterThanOrEqual(DIFFICULTY_CLUES[difficulty])
  })
})
