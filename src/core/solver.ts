import { CELLS } from './constants'
import { peersOf } from './grid'
import { conflictsIn } from './validate'
import type { Board } from './types'

interface MrvCell {
  index: number
  candidates: number[]
}

function candidatesFor(board: Board, index: number): number[] {
  const used = new Set<number>()

  for (const peer of peersOf(index)) {
    const value = board[peer]
    if (value) used.add(value)
  }

  const candidates: number[] = []
  for (let digit = 1; digit <= 9; digit++) {
    if (!used.has(digit)) candidates.push(digit)
  }

  return candidates
}

// Picks the empty cell with the Fewest remaining candidates (MRV heuristic) —
// filling the most-constrained cell first prunes dead branches far earlier
// than scanning left-to-right, which is what makes backtracking fast enough
// to generate/solve boards interactively.
function findMrvCell(board: Board): MrvCell | null {
  let best: MrvCell | null = null

  for (let i = 0; i < CELLS; i++) {
    if (board[i]) continue

    const candidates = candidatesFor(board, i)
    if (candidates.length === 0) return { index: i, candidates }
    if (!best || candidates.length < best.candidates.length) {
      best = { index: i, candidates }
      if (candidates.length === 1) break
    }
  }

  return best
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }

  return copy
}

function search(board: Board, randomize: boolean): Board | null {
  const cell = findMrvCell(board)
  if (!cell) return board
  if (cell.candidates.length === 0) return null

  const order = randomize ? shuffle(cell.candidates) : cell.candidates

  for (const digit of order) {
    board[cell.index] = digit
    const result = search(board, randomize)
    if (result) return result
    board[cell.index] = 0
  }

  return null
}

// Mutates `board` in place and returns it once solved, or returns `null` if
// no solution exists. Pass a clone if the caller needs to keep the original.
export function solve(board: Board, randomize = false): Board | null {
  // The search only ever derives candidates for EMPTY cells, so it cannot
  // notice that the pre-filled clues already contradict each other. Without
  // this guard an inconsistent board (say two 5s in one row) sends it
  // exploring the whole space before failing — exponential time to return
  // the null we can determine up front in O(cells).
  if (conflictsIn(board).size > 0) return null

  return search(board, randomize)
}

interface SearchState {
  nodes: number
  aborted: boolean
}

function searchSolutionCount(
  board: Board,
  limit: number,
  nodeBudget: number,
  state: SearchState,
): number {
  if (state.aborted) return 0
  if (++state.nodes > nodeBudget) {
    state.aborted = true
    return 0
  }

  const cell = findMrvCell(board)
  if (!cell) return 1
  if (cell.candidates.length === 0) return 0

  let count = 0
  for (const digit of cell.candidates) {
    board[cell.index] = digit
    count += searchSolutionCount(board, limit - count, nodeBudget, state)
    board[cell.index] = 0
    if (state.aborted || count >= limit) break
  }

  return count
}

// Counts solutions up to `limit`, short-circuiting once reached — this is
// the uniqueness check the generator relies on, so it must stay cheap even
// on boards with many empty cells.
//
// `nodeBudget` bounds the search for callers (the generator) that need a
// hard ceiling on worst-case time: near-minimal puzzles can occasionally
// make naive backtracking uniqueness-checks explode. Exceeding the budget
// returns -1 ("unknown") rather than a possibly-wrong count.
export function countSolutions(board: Board, limit = 2, nodeBudget = Infinity): number {
  // Same guard as solve() — reject a self-contradictory board up front rather
  // than letting the search try to disprove it the hard way.
  if (conflictsIn(board).size > 0) return 0

  const state: SearchState = { nodes: 0, aborted: false }
  const count = searchSolutionCount(board, limit, nodeBudget, state)
  return state.aborted ? -1 : count
}

export type SolveStepKind = 'place' | 'backtrack'

export interface SolveStep {
  kind: SolveStepKind
  index: number
  /** The digit placed, or 0 when the cell is being cleared on backtrack. */
  value: number
  /** Recursion depth, useful for visualising how deep the search has gone. */
  depth: number
}

function* searchSteps(board: Board, depth: number): Generator<SolveStep, boolean, void> {
  const cell = findMrvCell(board)
  if (!cell) return true
  if (cell.candidates.length === 0) return false

  for (const digit of cell.candidates) {
    board[cell.index] = digit
    yield { kind: 'place', index: cell.index, value: digit, depth }

    // `yield*` delegates to the nested generator, forwarding each of its
    // steps to our consumer, and evaluates to that generator's return value.
    if (yield* searchSteps(board, depth + 1)) return true

    board[cell.index] = 0
    yield { kind: 'backtrack', index: cell.index, value: 0, depth }
  }

  return false
}

// Step-by-step twin of solve(), for visualising the search. Yields one step
// per placement/backtrack and returns whether the board was solved; `board`
// is mutated in place, so the consumer can render it after each step.
//
// This is deliberately NOT what solve()/countSolutions() use: resuming a
// recursive generator walks the whole delegation chain on every next(), so
// it costs roughly O(depth) per step. That is irrelevant when a human is
// watching it and unacceptable in the generator's inner loop.
export function* solveSteps(board: Board): Generator<SolveStep, boolean, void> {
  if (conflictsIn(board).size > 0) return false

  return yield* searchSteps(board, 0)
}
