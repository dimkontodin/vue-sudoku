import { solveLogically } from './logicalSolver'
import { TECHNIQUE_META } from './techniques/types'
import type { Board, Difficulty } from './types'

export interface Grading {
  difficulty: Difficulty
  /** False when the logical solver ran out of techniques before finishing. */
  solved: boolean
  /** Display names of the techniques needed, easiest first. */
  techniques: string[]
}

/**
 * Grades a puzzle by which techniques it actually needs, rather than by how
 * many clues it has.
 *
 * Uniqueness techniques are allowed, so only call this on a grid already
 * validated as having exactly one solution — on anything else they produce
 * confidently wrong eliminations (see SolveOptions).
 */
export function gradeBoard(board: Board): Grading {
  const result = solveLogically(board, { allowUniquenessTechniques: true })

  const techniques = [...result.used]
    .map((id) => TECHNIQUE_META[id])
    .sort((a, b) => a.tier - b.tier || a.score - b.score)
    .map((meta) => meta.name)

  return { difficulty: result.difficulty, solved: result.solved, techniques }
}
