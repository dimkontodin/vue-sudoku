import type { Board } from '../types'

/** Parses an 81-char grid string. `.` or `0` mean empty. */
export function parseGrid(text: string): Board {
  const cleaned = text.replace(/\s/g, '')
  return Uint8Array.from([...cleaned].map((char) => (char === '.' ? 0 : Number(char))))
}

/**
 * Named hard puzzles. Provenance, node counts and caveats in
 * docs/hard-puzzles.md — including which of these have single-source
 * name-to-grid bindings.
 *
 * Orientation matters: rotating the anti-backtracking grid through its eight
 * symmetries spans a 1,600x range in naive node count, so these strings are
 * pinned exactly as published.
 */
export const HARD_PUZZLES = {
  /**
   * Built to defeat in-order backtracking: no clues in the top rows and a first
   * row solving to 987654321, the worst case for ascending enumeration.
   * Logically trivial — singles alone finish it.
   */
  antiBacktrack:
    '..............3.85..1.2.......5.7.....4...1...9.......5......73..2.1........4...9',
  aiEscargot: '1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..',
  inkala2012: '8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..',
  platinumBlonde:
    '.......12........3..23..4....18....5.6..7.8.......9.....85.....9...4.5..47...6...',
  goldenNugget: '.......39.....1..5..3.5.8....8.9...6.7...2...1..4.......9.8..5..2....6..4..7.....',
  easterMonster:
    '1.......2.9.4...5...6...7...5.9.3.......7.......85..4.7.....6...3...9.8...2.....1',
  fataMorgana: '........3..1..56...9..4..7......9.5.7.......8.5.4.2....8..2..9...35..1..6........',
  redDwarf: '12.3....435....1....4........54..2..6...7.........8.9...31..5.......9.7.....6...8',
  norvigGrid2: '4.....8.5.3..........7......2.....6.....8.4......1.......6.3.7.5..2.....1.4......',
} as const

export type HardPuzzleName = keyof typeof HARD_PUZZLES

/** A puzzle solvable by singles alone, useful as an "easy" baseline. */
export const SINGLES_ONLY =
  '..............3.85..1.2.......5.7.....4...1...9.......5......73..2.1........4...9'
