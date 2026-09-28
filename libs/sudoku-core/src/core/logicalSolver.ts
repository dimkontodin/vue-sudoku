import { CELLS } from './constants'
import { computeCandidates } from './candidates'
import { noteCount, noteMask } from './notes'
import { UNITS } from './units'
import { conflictsIn } from './validate'
import { bug, simpleColouring } from './techniques/colouring'
import { jellyfish, swordfish, xWing } from './techniques/fish'
import { boxLineReduction, pointing } from './techniques/intersections'
import { hiddenSingle, nakedSingle } from './techniques/singles'
import { hiddenPair, hiddenTriple, nakedPair, nakedQuad, nakedTriple } from './techniques/subsets'
import { wWing, xyzWing, yWing } from './techniques/wings'
import {
  TECHNIQUE_META,
  type Technique,
  type TechniqueId,
  type TechniqueStep,
  type TechniqueTier,
} from './techniques/types'
import type { Board, Difficulty, Notes } from './types'

/**
 * Techniques in the order they are attempted — cheapest first.
 *
 * The order defines both which hint a player is offered and how a puzzle is
 * graded, so it is the single most important list in this file. It follows
 * SudokuWiki's ordering, which differs from Sudoku Explainer's in a couple of
 * places (SE rates X-Wing below Naked Triple, and Swordfish below Y-Wing).
 */
export const TECHNIQUE_ORDER: readonly { id: TechniqueId; run: Technique }[] = [
  { id: 'nakedSingle', run: nakedSingle },
  { id: 'hiddenSingle', run: hiddenSingle },
  { id: 'pointing', run: pointing },
  { id: 'boxLineReduction', run: boxLineReduction },
  { id: 'nakedPair', run: nakedPair },
  { id: 'hiddenPair', run: hiddenPair },
  { id: 'nakedTriple', run: nakedTriple },
  { id: 'hiddenTriple', run: hiddenTriple },
  { id: 'nakedQuad', run: nakedQuad },
  { id: 'xWing', run: xWing },
  { id: 'swordfish', run: swordfish },
  { id: 'simpleColouring', run: simpleColouring },
  { id: 'yWing', run: yWing },
  { id: 'xyzWing', run: xyzWing },
  { id: 'wWing', run: wWing },
  { id: 'jellyfish', run: jellyfish },
  { id: 'bug', run: bug },
]

export interface SolveOptions {
  /**
   * Allow techniques that assume the puzzle has exactly one solution (BUG).
   * Off by default: on a hand-entered grid whose uniqueness has not been
   * checked, these produce confidently WRONG eliminations.
   */
  allowUniquenessTechniques?: boolean
  /** Stop after this many steps, as a runaway guard. */
  maxSteps?: number
  /**
   * Only try techniques up to this tier. The generator uses it to dig a puzzle
   * that stays solvable with the techniques its difficulty allows.
   */
  maxTier?: TechniqueTier
}

export interface LogicalSolveResult {
  solved: boolean
  board: Board
  steps: TechniqueStep[]
  /** Every technique that fired at least once. */
  used: Set<TechniqueId>
  /** The hardest technique required, or null if the puzzle needed none. */
  hardest: TechniqueId | null
  /**
   * Deduction beyond the forced moves: the sum of per-step technique scores,
   * with repeats of a technique already used discounted (see REPEAT_FACTOR).
   * Zero for a singles-only puzzle.
   */
  score: number
  /**
   * How hard the forced moves were to *find*: grows each time the player had
   * only one or two singles available (see singlesPressure()). This is how a
   * sparse grid's harder opening counts toward the grade without counting
   * clues directly.
   */
  pressure: number
  difficulty: Difficulty
}

/** Applies a step to a board in place. */
function applyStep(board: Board, candidates: Notes, step: TechniqueStep): void {
  for (const { index, digit } of step.placements) board[index] = digit
  for (const { index, digit } of step.eliminations) {
    candidates[index] = (candidates[index] ?? 0) & ~noteMask(digit)
  }
}

/**
 * Finds the single cheapest step available on the current board, or null if no
 * implemented technique applies.
 */
export function findNextStep(
  board: Board,
  candidates: Notes,
  options: SolveOptions = {},
): TechniqueStep | null {
  const { allowUniquenessTechniques = false, maxTier = 3 } = options

  for (const { id, run } of TECHNIQUE_ORDER) {
    if (id === 'bug' && !allowUniquenessTechniques) continue
    if (TECHNIQUE_META[id].tier > maxTier) continue
    const step = run(board, candidates)
    if (step) return step
  }

  return null
}

/**
 * Later uses of a technique the player has already applied once are worth
 * this fraction of its score: spotting the tenth pointing pair is not ten times
 * the insight of the first, and without the discount a long run of cheap tier-1
 * steps outscores one genuinely hard Y-Wing.
 */
const REPEAT_FACTOR = 0.5

/**
 * How many distinct placements singles offer right now. Naked singles are
 * cells with one candidate. Hidden singles are digits with one spot in some unit.
 * A cell found both ways counts once.
 */
function countSingles(board: Board, candidates: Notes): number {
  const found = new Set<number>()

  for (let index = 0; index < CELLS; index++) {
    const mask = candidates[index] ?? 0
    if (!board[index] && noteCount(mask) === 1) found.add(index * 16 + (31 - Math.clz32(mask)))
  }

  for (const unit of UNITS) {
    for (let bit = 0; bit < 9; bit++) {
      let spot = -1
      let count = 0
      for (const cell of unit.cells) {
        if (board[cell] === bit + 1) {
          count = 2 // already placed: not a single
          break
        }
        if (!board[cell] && (candidates[cell] ?? 0) & (1 << bit)) {
          spot = cell
          if (++count > 1) break
        }
      }
      if (count === 1) found.add(spot * 16 + bit)
    }
  }

  return found.size
}

/**
 * The cost of one forced move, given how many were available: 1 when the
 * player had to find the only one, falling off quickly once several are on
 * offer. Summed over a solve, this is near zero for a generous grid and grows
 * with each bottleneck a sparse one forces.
 */
function singlesPressure(available: number): number {
  return available <= 1 ? 1 : 1 / (available * available)
}

/**
 * Pressure at or above this makes a singles-only puzzle 'medium'. For scale:
 * generated 40-clue grids sit around 1.7, 26-clue ones around 4, and the
 * 17-clue anti-backtracking grid at 8.6. Below it the player always has a few
 * obvious moves to choose from.
 */
export const PRESSURE_MEDIUM = 4

/** How much one unit of pressure adds to the score, once a technique is needed. */
const PRESSURE_WEIGHT = 5

export const DIFFICULTY_RANK: Record<Difficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
  expert: 3,
}

/**
 * Grade from what the puzzle demands. The hardest technique used sets a floor
 * (tier N floors at the Nth level), and the total work can raise the grade above
 * that floor. This is HoDoKu's model and HoDoKu's reason for it: grading only
 * by the hardest technique would rate a puzzle needing one lucky X-Wing above
 * one needing forty patient steps, which is not how either feels to play.
 *
 * The work is the technique score plus the weighted singles pressure. That is
 * the only place clue count enters: a sparse grid forces more "only one move
 * available" bottlenecks.
 *
 * - Singles only: 'easy', or 'medium' when the pressure says the forced moves
 *   were hard to find. Never higher, because the player is never truly stuck.
 * - Stalled (the implemented techniques could not finish): 'expert'. It needs
 *   something beyond every technique we know, which is the definition of the
 *   top level, not a reason to rate it by the easy part the solver managed.
 *   The generator never emits these, because hints could not finish them.
 */
function gradeFrom(
  score: number,
  pressure: number,
  hardest: TechniqueId | null,
  solved: boolean,
): Difficulty {
  if (!solved) return 'expert'

  const tier = hardest ? TECHNIQUE_META[hardest].tier : 0
  if (tier === 0) return pressure >= PRESSURE_MEDIUM ? 'medium' : 'easy'

  // Calibrated on puzzles from the difficulty-targeted generator
  // (generator.report.spec.ts), not guessed.
  const work = score + pressure * PRESSURE_WEIGHT
  const byWork: Difficulty = work < 100 ? 'medium' : work < 250 ? 'hard' : 'expert'

  const floor: Difficulty = tier === 1 ? 'medium' : tier === 2 ? 'hard' : 'expert'
  return DIFFICULTY_RANK[byWork] >= DIFFICULTY_RANK[floor] ? byWork : floor
}

/**
 * Solves as far as human techniques allow, recording every step.
 *
 * After each successful step the cascade restarts from the top. That is both
 * what a person does and what makes "hardest technique required" meaningful —
 * continuing from where you left off would credit advanced techniques with
 * eliminations that a fresh pass of singles would have found, silently
 * inflating every grade.
 */
export function solveLogically(input: Board, options: SolveOptions = {}): LogicalSolveResult {
  const { maxSteps = 500 } = options

  const board = input.slice()
  const steps: TechniqueStep[] = []
  const used = new Set<TechniqueId>()
  let score = 0
  let pressure = 0

  if (conflictsIn(board).size > 0) {
    return {
      solved: false,
      board,
      steps,
      used,
      hardest: null,
      score: 0,
      pressure: 0,
      difficulty: 'easy',
    }
  }

  let candidates = computeCandidates(board)

  while (steps.length < maxSteps) {
    const step = findNextStep(board, candidates, options)
    if (!step) break

    const meta = TECHNIQUE_META[step.technique]
    if (meta.tier === 0) pressure += singlesPressure(countSingles(board, candidates))
    else score += used.has(step.technique) ? meta.score * REPEAT_FACTOR : meta.score

    applyStep(board, candidates, step)
    steps.push(step)
    used.add(step.technique)

    // Placing a digit invalidates candidates across all its peers, so rebuild
    // rather than trying to patch them.
    if (step.placements.length > 0) candidates = computeCandidates(board)
  }

  let hardest: TechniqueId | null = null
  for (const id of used) {
    if (!hardest) {
      hardest = id
      continue
    }
    const a = TECHNIQUE_META[id]
    const b = TECHNIQUE_META[hardest]
    if (a.tier > b.tier || (a.tier === b.tier && a.score > b.score)) hardest = id
  }

  let solved = true
  for (let index = 0; index < CELLS; index++) {
    if (!board[index]) {
      solved = false
      break
    }
  }

  score = Math.round(score)
  pressure = Math.round(pressure * 10) / 10

  return {
    solved,
    board,
    steps,
    used,
    hardest,
    score,
    pressure,
    difficulty: gradeFrom(score, pressure, hardest, solved),
  }
}

export { TECHNIQUE_META }
export type { TechniqueStep, TechniqueId }
