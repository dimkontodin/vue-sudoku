import { CELLS, DIFFICULTY_CLUES } from './constants'
import { countSolutions, solve } from './solver'
import type { Board, Difficulty, Puzzle } from './types'

function emptyBoard(): Board {
  return new Uint8Array(CELLS)
}

// Caps the uniqueness check run per removal attempt. Near-minimal puzzles
// can occasionally make naive backtracking blow up; when the budget is hit
// the removal is rejected (clue kept) rather than risking a multi-solution
// puzzle or an unbounded generation time.
const UNIQUENESS_CHECK_NODE_BUDGET = 20_000

function shuffledIndices(): number[] {
  const indices = Array.from({ length: CELLS }, (_, i) => i)

  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j]!, indices[i]!]
  }

  return indices
}

// Fills a random valid board, then removes clues one at a time — keeping a
// removal only while the board still has exactly one solution. This is the
// standard "dig holes" generation strategy: it guarantees a unique-solution
// puzzle by construction rather than checking afterwards.
export function generate(difficulty: Difficulty): Puzzle {
  const solution = solve(emptyBoard(), true)
  if (!solution) throw new Error('Failed to generate a solved board')

  const puzzle = solution.slice()
  const targetClues = DIFFICULTY_CLUES[difficulty]

  let clueCount = CELLS
  for (const index of shuffledIndices()) {
    if (clueCount <= targetClues) break

    const removed = puzzle[index]!
    puzzle[index] = 0

    if (countSolutions(puzzle.slice(), 2, UNIQUENESS_CHECK_NODE_BUDGET) !== 1) {
      puzzle[index] = removed
      continue
    }

    clueCount--
  }

  return { puzzle, solution }
}
