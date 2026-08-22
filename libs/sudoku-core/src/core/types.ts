export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'

// length 81, 0 = empty
export type Board = Uint8Array

// length 81, bit (digit - 1) set = candidate present
export type Notes = Uint16Array

export interface Puzzle {
  puzzle: Board
  solution: Board
}
