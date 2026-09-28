import { describe, expect, it } from 'vitest'
import { CELLS } from '../constants'
import { computeCandidates } from '../candidates'
import { generate } from '../generator'
import { solve } from '../solver'
import { formatBoard } from '../parse'
import { isComplete } from '../validate'
import { PRESSURE_MEDIUM, TECHNIQUE_META, findNextStep, solveLogically } from '../logicalSolver'
import { HARD_PUZZLES, parseGrid } from './fixtures'
import type { Difficulty } from '../types'

describe('solveLogically', () => {
  it('solves the anti-backtracking puzzle with singles alone', () => {
    // The grid famous for defeating brute force is logically trivial. This is
    // the two-axes-of-difficulty point, as an assertion.
    const result = solveLogically(parseGrid(HARD_PUZZLES.antiBacktrack))

    expect(result.solved).toBe(true)
    expect([...result.used].sort()).toEqual(['hiddenSingle', 'nakedSingle'])
    expect(result.score).toBe(0)
  })

  it('agrees with the backtracking solver when it succeeds', () => {
    const disagreements: string[] = []

    for (const difficulty of ['easy', 'medium', 'hard'] as Difficulty[]) {
      const { puzzle, solution } = generate(difficulty)
      const result = solveLogically(puzzle)
      if (!result.solved) continue

      if (formatBoard(result.board) !== formatBoard(solution)) disagreements.push(difficulty)
    }

    expect(disagreements).toEqual([])
  })

  it('solves every generated puzzle, correctly', () => {
    // The generator only emits puzzles the logical solver can finish, so
    // every one must solve, and to the generator's own solution.
    for (let i = 0; i < 8; i++) {
      const { puzzle, solution } = generate('medium')
      const result = solveLogically(puzzle)

      expect(result.solved).toBe(true)
      expect(isComplete(result.board)).toBe(true)
      expect(Array.from(result.board)).toEqual(Array.from(solution))
    }
  })

  it('never places a digit that contradicts the real solution', () => {
    // Worse than failing to solve: a wrong placement leads the player astray.
    const wrong: string[] = []

    for (let i = 0; i < 15; i++) {
      const { puzzle, solution } = generate('hard')
      const result = solveLogically(puzzle)

      for (let index = 0; index < CELLS; index++) {
        const placed = result.board[index]
        if (placed && placed !== solution[index]) {
          wrong.push(`run ${i} cell ${index}: placed ${placed}, answer ${solution[index]}`)
        }
      }
    }

    expect(wrong).toEqual([])
  })

  it('stops cleanly on a puzzle beyond its techniques', () => {
    // The genuinely hard ones need chains we deliberately did not implement.
    const result = solveLogically(parseGrid(HARD_PUZZLES.platinumBlonde))

    const truth = solve(parseGrid(HARD_PUZZLES.platinumBlonde))!
    const wrong = [...result.board.keys()].filter(
      (index) => result.board[index] !== 0 && result.board[index] !== truth[index],
    )

    expect(result.solved).toBe(false)
    // Whatever it did manage must still be correct.
    expect(wrong).toEqual([])
  })

  it('refuses a self-contradictory board', () => {
    const board = new Uint8Array(CELLS)
    board[0] = 5
    board[1] = 5

    const result = solveLogically(board)
    expect(result.solved).toBe(false)
    expect(result.steps).toHaveLength(0)
  })

  describe('grading', () => {
    it('scores zero technique work when only singles were needed, however many', () => {
      // 64 singles for the anti-backtracking grid, about 45 for a generated easy one.
      // Length alone is not difficulty.
      const long = solveLogically(parseGrid(HARD_PUZZLES.antiBacktrack))
      const short = solveLogically(generate('easy').puzzle)

      expect(long.steps.length).toBeGreaterThan(short.steps.length)
      expect(long.score).toBe(0)
      expect(short.score).toBe(0)
    })

    it('lets singles pressure, not length, lift a sparse singles-only grid to medium', () => {
      // The 17-clue grid needs nothing but singles, but it repeatedly offers
      // only one or two of them, which is the "sparse start is harder" effect.
      // A generated easy grid always has several on offer.
      const sparse = solveLogically(parseGrid(HARD_PUZZLES.antiBacktrack))
      const generous = solveLogically(generate('easy').puzzle)

      expect(sparse.pressure).toBeGreaterThan(generous.pressure)
      expect(sparse.difficulty).toBe('medium')
      expect(generous.difficulty).toBe('easy')
    })

    it('never rates a singles-only puzzle above medium, however sparse', () => {
      // Its pressure is over twice the medium threshold. The player is never
      // truly stuck, so it still does not reach hard.
      const result = solveLogically(parseGrid(HARD_PUZZLES.antiBacktrack))

      expect(result.pressure).toBeGreaterThan(2 * PRESSURE_MEDIUM)
      expect(result.difficulty).toBe('medium')
    })

    it('rates a puzzle beyond the implemented techniques as expert, not by its easy part', () => {
      const result = solveLogically(parseGrid(HARD_PUZZLES.platinumBlonde))

      expect(result.solved).toBe(false)
      expect(result.difficulty).toBe('expert')
    })

    it('scores above zero exactly when a non-single technique was needed', () => {
      const mismatches: string[] = []

      for (let i = 0; i < 25; i++) {
        const result = solveLogically(generate('expert').puzzle)
        const neededMore = [...result.used].some((id) => TECHNIQUE_META[id].tier > 0)
        if (result.score > 0 !== neededMore) {
          mismatches.push(`run ${i}: score ${result.score}, used ${[...result.used].join('+')}`)
        }
      }

      expect(mismatches).toEqual([])
    })

    it('never grades below the tier of the hardest technique used', () => {
      const rank = { easy: 0, medium: 1, hard: 2, expert: 3 }
      // Tier N floors at the Nth level. See gradeFrom().
      const floorFor = [0, 1, 2, 3] as const
      const violations: string[] = []

      for (let i = 0; i < 40; i++) {
        const result = solveLogically(generate('expert').puzzle)
        if (!result.hardest) continue

        const tier = TECHNIQUE_META[result.hardest].tier
        if (rank[result.difficulty] < floorFor[tier]) {
          violations.push(`${result.hardest} (tier ${tier}) graded ${result.difficulty}`)
        }
      }

      expect(violations).toEqual([])
    })
  })

  describe('uniqueness gating', () => {
    it('does not use BUG unless explicitly allowed', () => {
      const usedBug = Array.from({ length: 10 }, () =>
        solveLogically(generate('expert').puzzle).used.has('bug'),
      )

      expect(usedBug).not.toContain(true)
    })

    it('can use BUG when the caller vouches for uniqueness', () => {
      const { puzzle, solution } = generate('expert')
      const result = solveLogically(puzzle, { allowUniquenessTechniques: true })

      // May or may not fire, but must never place a wrong digit.
      const wrong = [...result.board.keys()].filter(
        (index) => result.board[index] !== 0 && result.board[index] !== solution[index],
      )
      expect(wrong).toEqual([])
    })
  })
})

describe('findNextStep', () => {
  it('offers the easiest available technique first', () => {
    const { puzzle } = generate('easy')
    const step = findNextStep(puzzle, computeCandidates(puzzle))

    expect(step).not.toBeNull()
    expect(['nakedSingle', 'hiddenSingle']).toContain(step!.technique)
  })

  it('returns a step with everything the UI needs to teach it', () => {
    const { puzzle } = generate('medium')
    const step = findNextStep(puzzle, computeCandidates(puzzle))!

    expect(step.pattern.length).toBeGreaterThan(0)
    expect(step.explanation).toMatch(/\S/)
    expect(step.placements.length + step.eliminations.length).toBeGreaterThan(0)
  })

  it('returns null on a solved board', () => {
    const { solution } = generate('easy')
    expect(findNextStep(solution, computeCandidates(solution))).toBeNull()
  })
})
