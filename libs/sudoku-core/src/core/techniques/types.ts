import type { Board, Notes } from '../types'

export type TechniqueId =
  | 'nakedSingle'
  | 'hiddenSingle'
  | 'pointing'
  | 'boxLineReduction'
  | 'nakedPair'
  | 'nakedTriple'
  | 'nakedQuad'
  | 'hiddenPair'
  | 'hiddenTriple'
  | 'xWing'
  | 'swordfish'
  | 'jellyfish'
  | 'simpleColouring'
  | 'yWing'
  | 'xyzWing'
  | 'wWing'
  | 'bug'

export type TechniqueTier = 0 | 1 | 2 | 3

export interface TechniqueMeta {
  id: TechniqueId
  name: string
  tier: TechniqueTier
  /**
   * Cost added to the puzzle's difficulty score each time this fires. Roughly
   * Sudoku Explainer's rating x10.
   *
   * Singles score ZERO, deliberately. Every puzzle must place one digit per
   * empty cell, so singles are mandatory work rather than difficulty — and a
   * grid solvable by singles alone is easy however many of them it takes,
   * because the player never gets stuck. Scoring them at all let clue count
   * drive the grade: the 17-clue anti-backtracking puzzle rated "hard" purely
   * for being long, despite needing no technique beyond a hidden single.
   *
   * So the score measures deduction required BEYOND the forced moves.
   */
  score: number
}

export interface Placement {
  index: number
  digit: number
}

export interface Elimination {
  index: number
  digit: number
}

/**
 * What a technique found. Never a boolean: the UI needs to know which cells to
 * light up in order to *teach* the pattern rather than just apply it.
 */
export interface TechniqueStep {
  technique: TechniqueId
  placements: Placement[]
  eliminations: Elimination[]
  /** Cells forming the pattern itself — highlighted strongly. */
  pattern: number[]
  /** Cells the step acts on — highlighted as targets. */
  targets: number[]
  /** Unit indices into UNITS, for shading rows/columns/boxes. */
  units: number[]
  /** One sentence, using r4c7 notation, safe to show to the player. */
  explanation: string
}

/** A technique reads the board and its candidates; it never mutates either. */
export type Technique = (board: Board, candidates: Notes) => TechniqueStep | null

export const TECHNIQUE_META: Record<TechniqueId, TechniqueMeta> = {
  nakedSingle: { id: 'nakedSingle', name: 'Naked Single', tier: 0, score: 0 },
  hiddenSingle: { id: 'hiddenSingle', name: 'Hidden Single', tier: 0, score: 0 },
  pointing: { id: 'pointing', name: 'Pointing', tier: 1, score: 26 },
  boxLineReduction: { id: 'boxLineReduction', name: 'Box/Line Reduction', tier: 1, score: 28 },
  nakedPair: { id: 'nakedPair', name: 'Naked Pair', tier: 1, score: 30 },
  nakedTriple: { id: 'nakedTriple', name: 'Naked Triple', tier: 1, score: 36 },
  nakedQuad: { id: 'nakedQuad', name: 'Naked Quad', tier: 1, score: 50 },
  hiddenPair: { id: 'hiddenPair', name: 'Hidden Pair', tier: 1, score: 34 },
  hiddenTriple: { id: 'hiddenTriple', name: 'Hidden Triple', tier: 1, score: 40 },
  xWing: { id: 'xWing', name: 'X-Wing', tier: 2, score: 32 },
  swordfish: { id: 'swordfish', name: 'Swordfish', tier: 2, score: 38 },
  jellyfish: { id: 'jellyfish', name: 'Jellyfish', tier: 2, score: 52 },
  simpleColouring: { id: 'simpleColouring', name: 'Simple Colouring', tier: 3, score: 65 },
  yWing: { id: 'yWing', name: 'Y-Wing', tier: 3, score: 42 },
  xyzWing: { id: 'xyzWing', name: 'XYZ-Wing', tier: 3, score: 44 },
  wWing: { id: 'wWing', name: 'W-Wing', tier: 3, score: 44 },
  bug: { id: 'bug', name: 'BUG+1', tier: 3, score: 56 },
}
