import { boxOf, colOf, rowOf } from '../grid'
import { noteMask } from '../notes'
import { BOXES, COLS, ROWS, UNITS, cellLabels, unitLabel, type Unit } from '../units'
import type { Board, Notes } from '../types'
import type { Elimination, Technique, TechniqueStep } from './types'

function unitIndexOf(unit: Unit): number {
  return UNITS.indexOf(unit)
}

function spotsFor(unit: Unit, digit: number, board: Board, candidates: Notes): number[] {
  const mask = noteMask(digit)
  const spots: number[] = []
  for (const cell of unit.cells) {
    if (board[cell]) continue
    if ((candidates[cell] ?? 0) & mask) spots.push(cell)
  }
  return spots
}

function alreadyPlaced(unit: Unit, digit: number, board: Board): boolean {
  return unit.cells.some((cell) => board[cell] === digit)
}

/**
 * Pointing — found in a BOX, eliminates along a LINE.
 *
 * If every candidate for a digit inside a box sits in one row (or column), the
 * digit must land on that row somewhere inside the box, so it cannot appear on
 * the rest of that row.
 */
export const pointing: Technique = (board, candidates) => {
  for (const box of BOXES) {
    for (let digit = 1; digit <= 9; digit++) {
      if (alreadyPlaced(box, digit, board)) continue

      const spots = spotsFor(box, digit, board, candidates)
      if (spots.length < 2) continue

      for (const kind of ['row', 'col'] as const) {
        const lineOf = kind === 'row' ? rowOf : colOf
        const lineIndex = lineOf(spots[0]!)
        if (!spots.every((cell) => lineOf(cell) === lineIndex)) continue

        const line = (kind === 'row' ? ROWS : COLS)[lineIndex]!
        const mask = noteMask(digit)
        const eliminations: Elimination[] = []

        for (const cell of line.cells) {
          if (boxOf(cell) === box.index || board[cell]) continue
          if ((candidates[cell] ?? 0) & mask) eliminations.push({ index: cell, digit })
        }

        if (eliminations.length === 0) continue

        return {
          technique: 'pointing',
          placements: [],
          eliminations,
          pattern: spots,
          targets: eliminations.map((e) => e.index),
          units: [unitIndexOf(box), unitIndexOf(line)],
          explanation:
            `In ${unitLabel(box)}, ${digit} can only go in ${cellLabels(spots)}, all on ` +
            `${unitLabel(line)}. So ${digit} is removed from the rest of that ${kind === 'row' ? 'row' : 'column'}.`,
        } satisfies TechniqueStep
      }
    }
  }

  return null
}

/**
 * Box/Line Reduction (Claiming) — found in a LINE, eliminates inside a BOX.
 *
 * The mirror of pointing: if every candidate for a digit on a row sits inside
 * one box, the digit must land in that box on that row, so it cannot appear
 * elsewhere in the box.
 */
export const boxLineReduction: Technique = (board, candidates) => {
  for (const line of [...ROWS, ...COLS]) {
    for (let digit = 1; digit <= 9; digit++) {
      if (alreadyPlaced(line, digit, board)) continue

      const spots = spotsFor(line, digit, board, candidates)
      if (spots.length < 2) continue

      const boxIndex = boxOf(spots[0]!)
      if (!spots.every((cell) => boxOf(cell) === boxIndex)) continue

      const box = BOXES[boxIndex]!
      const mask = noteMask(digit)
      const eliminations: Elimination[] = []

      for (const cell of box.cells) {
        if (spots.includes(cell) || board[cell]) continue
        if ((candidates[cell] ?? 0) & mask) eliminations.push({ index: cell, digit })
      }

      if (eliminations.length === 0) continue

      return {
        technique: 'boxLineReduction',
        placements: [],
        eliminations,
        pattern: spots,
        targets: eliminations.map((e) => e.index),
        units: [unitIndexOf(line), unitIndexOf(box)],
        explanation:
          `On ${unitLabel(line)}, ${digit} can only go in ${cellLabels(spots)}, all inside ` +
          `${unitLabel(box)}. So ${digit} is removed from the rest of that box.`,
      } satisfies TechniqueStep
    }
  }

  return null
}
