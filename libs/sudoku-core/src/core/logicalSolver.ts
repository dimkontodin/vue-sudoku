import { CELLS } from './constants'
import { computeCandidates } from './candidates'
import { noteMask } from './notes'
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
}

export interface LogicalSolveResult {
  solved: boolean
  board: Board
  steps: TechniqueStep[]
  /** Every technique that fired at least once. */
  used: Set<TechniqueId>
  /** The hardest technique required, or null if the puzzle needed none. */
  hardest: TechniqueId | null
  /** Sum of per-step scores — total work, not just peak difficulty. */
  score: number
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
  const { allowUniquenessTechniques = false } = options

  for (const { id, run } of TECHNIQUE_ORDER) {
    if (id === 'bug' && !allowUniquenessTechniques) continue
    const step = run(board, candidates)
    if (step) return step
  }

  return null
}

/**
 * Grade from the accumulated score, floored at the tier of the hardest
 * technique used. Copied from HoDoKu's model, and for the reason HoDoKu gives:
 * pure hardest-technique grading makes a puzzle needing one lucky X-Wing rate
 * above one needing forty patient steps, which does not match how either feels
 * to play.
 */
function gradeFrom(score: number, hardest: TechniqueId | null): Difficulty {
  const tier = hardest ? TECHNIQUE_META[hardest].tier : 0

  // Calibrated against 40 generated puzzles per difficulty rather than guessed.
  // Singles score 0, so a score of 0 means "never needed anything but forced
  // moves" — which is what easy means.
  const byScore: Difficulty =
    score === 0 ? 'easy' : score < 100 ? 'medium' : score < 300 ? 'hard' : 'expert'

  // Tier 3 floors at 'hard', not 'expert': one Y-Wing does not make an expert
  // puzzle. Needing many of them will, via the score.
  const floor: Difficulty = tier === 0 ? 'easy' : tier === 1 ? 'medium' : 'hard'

  const rank: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2, expert: 3 }
  return rank[byScore] >= rank[floor] ? byScore : floor
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

  if (conflictsIn(board).size > 0) {
    return {
      solved: false,
      board,
      steps,
      used,
      hardest: null,
      score: 0,
      difficulty: 'easy',
    }
  }

  let candidates = computeCandidates(board)

  while (steps.length < maxSteps) {
    const step = findNextStep(board, candidates, options)
    if (!step) break

    applyStep(board, candidates, step)
    steps.push(step)
    used.add(step.technique)
    score += TECHNIQUE_META[step.technique].score

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

  return { solved, board, steps, used, hardest, score, difficulty: gradeFrom(score, hardest) }
}

export { TECHNIQUE_META }
export type { TechniqueStep, TechniqueId }
