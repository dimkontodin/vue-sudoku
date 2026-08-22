import type { Difficulty } from './types'

// Grid constants
export const SIZE = 9
export const BOX_SIZE = 3
export const CELLS = SIZE ** 2

export const DIFFICULTY_CLUES: Record<Difficulty, number> = {
  easy: 40,
  medium: 32,
  hard: 26,
  expert: 24,
}
