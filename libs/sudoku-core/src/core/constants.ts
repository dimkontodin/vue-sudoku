import type { Difficulty } from './types'

// Grid constants
export const SIZE = 9
export const BOX_SIZE = 3
export const CELLS = SIZE ** 2

/**
 * The fewest clues the generator leaves at each difficulty. This is a floor,
 * not the grade: difficulty comes from the techniques a puzzle needs (see
 * gradeFrom() in logicalSolver.ts), and a dig usually stops above the floor
 * because no further clue can go. The floor exists so that easy and medium
 * grids do not look barren, even when the techniques would allow it.
 */
export const DIFFICULTY_CLUES: Record<Difficulty, number> = {
  easy: 28,
  medium: 24,
  hard: 22,
  expert: 17,
}
