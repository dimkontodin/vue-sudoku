import { beforeAll, describe, expect, it } from 'vitest'
import { DIFFICULTY_CLUES } from '../constants'
import { generate } from '../generator'
import { TECHNIQUE_META, solveLogically } from '../logicalSolver'
import { countSolutions } from '../solver'
import { conflictsIn, isComplete } from '../validate'
import type { Difficulty, Puzzle } from '../types'

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert']

describe.each(DIFFICULTIES)('generate(%s)', (difficulty) => {
  // Generation is the expensive part (up to 81 uniqueness checks); run it
  // once per difficulty and assert everything against that one result.
  let result: Puzzle
  beforeAll(() => {
    // A generous budget: on a slow CI machine the default could run out and
    // fall back to an easier puzzle, which is correct behaviour but not what
    // these tests are checking.
    result = generate(difficulty, { timeBudgetMs: 20_000 })
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

  it('does not dig below the clue floor for the difficulty', () => {
    const clueCount = result.puzzle.filter((value) => value !== 0).length
    // A dig stops at the floor, or earlier when no further clue can go.
    expect(clueCount).toBeGreaterThanOrEqual(DIFFICULTY_CLUES[difficulty])
  })

  it('grades as the difficulty it was generated for', () => {
    // This is the point of the generator: the level comes from the
    // techniques needed, not from the clue count. Given the default budget, a
    // miss means generation fell back to an easier puzzle, which the report
    // spec shows essentially never happens.
    const grade = solveLogically(result.puzzle, { allowUniquenessTechniques: true })
    expect(grade.solved).toBe(true)
    expect(grade.difficulty).toBe(difficulty)
  })

  it.runIf(difficulty === 'medium')('needs techniques more than once, not just singles', () => {
    const grade = solveLogically(result.puzzle, { allowUniquenessTechniques: true })
    const techniqueSteps = grade.steps.filter((step) => TECHNIQUE_META[step.technique].tier > 0)
    expect(techniqueSteps.length).toBeGreaterThanOrEqual(2)
  })
})
