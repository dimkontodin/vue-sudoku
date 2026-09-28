import { CELLS, DIFFICULTY_CLUES } from './constants'
import { peersOf } from './grid'
import { DIFFICULTY_RANK, TECHNIQUE_META, solveLogically } from './logicalSolver'
import { countSolutions, solve } from './solver'
import type { TechniqueTier } from './techniques/types'
import type { Board, Difficulty, Puzzle } from './types'
import { UNITS } from './units'

function emptyBoard(): Board {
  return new Uint8Array(CELLS)
}

// Caps the uniqueness check run per removal attempt. Near-minimal puzzles
// can occasionally make naive backtracking blow up; when the budget is hit
// the removal is rejected (clue kept) rather than risking a multi-solution
// puzzle or an unbounded generation time.
const UNIQUENESS_CHECK_NODE_BUDGET = 20_000

interface LevelSpec {
  /** Hardest technique tier the dig may make the puzzle depend on. */
  maxTier: TechniqueTier
  /** Stop digging at this many clues (DIFFICULTY_CLUES). */
  minClues: number
  /**
   * Fewest steps beyond singles the puzzle must need. A puzzle can grade
   * medium on singles pressure alone, or on a single pointing pair, and
   * neither feels like medium. This makes the player actually use techniques,
   * more than once.
   */
  minTechniqueSteps: number
}

/**
 * Each level digs under the technique ceiling it allows, then keeps only
 * puzzles that grade at that level and meet its minimum technique work. The
 * ceiling guarantees a puzzle is never harder than asked. The checks make
 * sure it is not easier. So the generator emits a stricter subset of each
 * grade: a hand-entered, singles-only, sparse grid still grades medium, but
 * the generator never offers one as medium.
 */
const LEVELS: Record<Difficulty, LevelSpec> = {
  easy: { maxTier: 0, minClues: DIFFICULTY_CLUES.easy, minTechniqueSteps: 0 },
  medium: { maxTier: 1, minClues: DIFFICULTY_CLUES.medium, minTechniqueSteps: 2 },
  hard: { maxTier: 2, minClues: DIFFICULTY_CLUES.hard, minTechniqueSteps: 0 },
  expert: { maxTier: 3, minClues: DIFFICULTY_CLUES.expert, minTechniqueSteps: 0 },
}

export interface GenerateOptions {
  /**
   * Wall-clock budget for finding a puzzle that grades exactly at the
   * requested difficulty. When it runs out, the closest candidate found so far
   * is returned instead: never harder than asked and always solvable by the
   * hint engine, just possibly one level easier.
   */
  timeBudgetMs?: number
}

const DEFAULT_TIME_BUDGET_MS = 1500

function shuffledIndices(): number[] {
  const indices = Array.from({ length: CELLS }, (_, i) => i)

  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j]!, indices[i]!]
  }

  return indices
}

/**
 * Whether naked and hidden singles alone complete the grid. This is the same
 * question as `solveLogically(board, { maxTier: 0 }).solved`, but without
 * building steps and explanations, so it is roughly an order of magnitude
 * cheaper. That matters because the dig asks it for nearly every clue, and in
 * the first half of a dig the answer is almost always yes.
 */
function solvesWithSingles(input: Board): boolean {
  const board = input.slice()
  const free = new Uint16Array(CELLS)
  for (let index = 0; index < CELLS; index++) {
    if (board[index]) continue
    let mask = 0x1ff
    for (const peer of peersOf(index)) if (board[peer]) mask &= ~(1 << (board[peer]! - 1))
    free[index] = mask
  }

  const place = (index: number, bit: number) => {
    board[index] = 32 - Math.clz32(bit)
    free[index] = 0
    for (const peer of peersOf(index)) free[peer]! &= ~bit
  }

  let progress = true
  while (progress) {
    progress = false

    for (let index = 0; index < CELLS; index++) {
      if (board[index]) continue
      const mask = free[index]!
      if (!mask) return false
      if ((mask & (mask - 1)) === 0) {
        place(index, mask)
        progress = true
      }
    }

    for (const { cells: unit } of UNITS) {
      let seenOnce = 0
      let seenTwice = 0
      let placed = 0
      for (const cell of unit) {
        if (board[cell]) placed |= 1 << (board[cell]! - 1)
        else {
          seenTwice |= seenOnce & free[cell]!
          seenOnce |= free[cell]!
        }
      }
      const hidden = seenOnce & ~seenTwice & ~placed
      if (!hidden) continue
      for (const cell of unit) {
        const bit = free[cell]! & hidden
        if (!board[cell] && bit) {
          place(cell, bit & -bit)
          progress = true
        }
      }
    }
  }

  for (let index = 0; index < CELLS; index++) if (!board[index]) return false
  return true
}

/**
 * Whether `puzzle` still qualifies for the level after a removal.
 *
 * Below tier 3 no uniqueness technique is in play, so a completed logical solve
 * proves the solution is unique by itself: every deduction was sound, and it
 * left only one possibility. That makes the backtracking count unnecessary.
 * The same holds for the singles fast path at every tier.
 * Tier 3 includes BUG, which *assumes* uniqueness, so outside the fast path,
 * uniqueness must be established first by counting.
 */
function stillQualifies(puzzle: Board, spec: LevelSpec): boolean {
  if (solvesWithSingles(puzzle)) return true
  if (spec.maxTier === 0) return false

  if (spec.maxTier === 3) {
    if (countSolutions(puzzle.slice(), 2, UNIQUENESS_CHECK_NODE_BUDGET) !== 1) return false
    return solveLogically(puzzle, { allowUniquenessTechniques: true }).solved
  }
  return solveLogically(puzzle, { maxTier: spec.maxTier }).solved
}

/**
 * Removes clues from `start` in random order, keeping each removal only if the
 * puzzle is still unique and solvable within the level's techniques, until it
 * reaches the level's clue floor or no clue can be removed.
 */
function dig(start: Board, spec: LevelSpec): Board {
  const puzzle = start.slice()
  let clueCount = puzzle.reduce((n, value) => (value ? n + 1 : n), 0)

  for (const index of shuffledIndices()) {
    if (clueCount <= spec.minClues) break
    if (!puzzle[index]) continue

    const removed = puzzle[index]!
    puzzle[index] = 0

    if (!stillQualifies(puzzle, spec)) {
      puzzle[index] = removed
      continue
    }

    clueCount--
  }

  return puzzle
}

/** Puts back `count` random clues from the solution: the first step of a re-dig. */
function restoreClues(puzzle: Board, solution: Board, count: number): Board {
  const next = puzzle.slice()
  const empty = shuffledIndices().filter((index) => !next[index])
  for (const index of empty.slice(0, count)) next[index] = solution[index]!
  return next
}

// Hill-climb tuning. A dig that lands one level short is usually a few clues
// away from the target, so re-dig its neighbourhood (restore a couple of clues
// and remove in a new order) a few times before starting over with a new grid.
const RESTORED_PER_REDIG = 3
const REDIGS_PER_GRID = 6

interface SearchResult {
  /** A puzzle grading exactly at the target, or null if none was found in time. */
  exact: Puzzle | null
  /** The closest easier puzzle seen, as a fallback. */
  best: Puzzle | null
}

/**
 * Fill a random grid, dig under the level's technique ceiling, and grade the
 * result. A dig that lands one level short is re-dug locally (hill-climbing),
 * and anything else starts over with a new grid. Stops at the first exact hit,
 * or once `deadline` passes and `keepGoing` says there is enough to return.
 */
function search(
  difficulty: Difficulty,
  deadline: number,
  keepGoing: (best: Puzzle | null) => boolean,
): SearchResult {
  const spec = LEVELS[difficulty]
  const target = DIFFICULTY_RANK[difficulty]

  // How close a graded puzzle is to what was asked for. Right grade but too
  // little technique work sits just below the target, so it is both the best
  // fallback and worth hill-climbing from.
  let best: { puzzle: Puzzle; level: number } | null = null

  do {
    const solution = solve(emptyBoard(), true)
    if (!solution) throw new Error('Failed to generate a solved board')

    let puzzle = dig(solution, spec)

    for (let redig = 0; redig <= REDIGS_PER_GRID; redig++) {
      const grade = solveLogically(puzzle, { allowUniquenessTechniques: true })
      // The dig guarantees this, but a puzzle the hint engine cannot finish
      // must never reach a player, so it is checked rather than assumed.
      if (!grade.solved) break

      const rank = DIFFICULTY_RANK[grade.difficulty]
      const techniqueSteps = grade.steps.filter(
        (step) => TECHNIQUE_META[step.technique].tier > 0,
      ).length
      const level = rank === target && techniqueSteps < spec.minTechniqueSteps ? target - 0.5 : rank

      if (level === target) return { exact: { puzzle, solution }, best: null }
      if (level < target && (!best || level > best.level)) {
        best = { puzzle: { puzzle, solution }, level }
      }
      // Too hard (the work pushed it past the level) or too far below: this
      // neighbourhood is not worth climbing.
      if (level < target - 1 || level > target || performance.now() >= deadline) break

      puzzle = dig(restoreClues(puzzle, solution, RESTORED_PER_REDIG), spec)
    }
  } while (performance.now() < deadline || keepGoing(best?.puzzle ?? null))

  return { exact: null, best: best?.puzzle ?? null }
}

/**
 * Generates a unique-solution puzzle that grades as `difficulty`, judged by
 * the techniques it needs (see gradeFrom() in logicalSolver.ts), not by how
 * many clues it has.
 *
 * A dig costs a few to a few dozen milliseconds, and some levels need several.
 * When the budget runs out, the closest easier puzzle found is returned: never
 * harder than asked and always finishable by the hint engine. Which advanced
 * technique a hard or expert puzzle ends up needing is left to chance, which
 * gives variety without the cost of forcing a particular one.
 */
export function generate(difficulty: Difficulty, options: GenerateOptions = {}): Puzzle {
  const { timeBudgetMs = DEFAULT_TIME_BUDGET_MS } = options
  const deadline = performance.now() + timeBudgetMs
  const result = search(difficulty, deadline, (best) => !best)
  return (result.exact ?? result.best)!
}

/**
 * Like generate(), but only succeeds with a puzzle that grades exactly as
 * `difficulty`, and otherwise returns null once `timeBudgetMs` is spent. This
 * lets background prefetching work in short slices, yielding between them,
 * without ever accepting a fallback it has plenty of time to improve on.
 *
 * A single dig is not interruptible, so a slice can overrun its budget by one
 * dig: tens of milliseconds, more on a slow device.
 */
export function tryGenerate(difficulty: Difficulty, timeBudgetMs: number): Puzzle | null {
  const deadline = performance.now() + timeBudgetMs
  return search(difficulty, deadline, () => false).exact
}
