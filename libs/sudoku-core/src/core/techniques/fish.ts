import { colOf, indexAt, rowOf } from '../grid'
import { noteMask } from '../notes'
import { COLS, ROWS, UNITS, cellLabels } from '../units'
import type { Elimination, Technique, TechniqueId, TechniqueStep } from './types'
import { combinations } from './subsets'

/**
 * Basic fish of size N — X-Wing (2), Swordfish (3), Jellyfish (4).
 *
 * All three are one algorithm. Find N "base" units in which a digit's candidate
 * positions are all contained within the same N "cover" lines; the digit then
 * occupies N of those intersections, consuming every cover line, so it can be
 * removed from the cover lines everywhere outside the base units.
 *
 * Two things most write-ups leave vague, both handled here:
 *
 * 1. Eliminations happen in the units PERPENDICULAR to the ones that defined
 *    the pattern. Row-based fish eliminate down columns, and vice versa.
 * 2. A base unit needs 2..N positions, NOT exactly 2. Generalising X-Wing's
 *    "exactly two" to Swordfish finds only the 2-2-2 case and misses most of
 *    them. (A base with 1 position is a hidden single, handled earlier.)
 *
 * Sizes stop at 4: a 5x5 fish provably always implies a 4x4 on the
 * complementary digits, so anything larger is redundant.
 */
function findFish(size: number, id: TechniqueId, label: string): Technique {
  return (board, candidates) => {
    for (let digit = 1; digit <= 9; digit++) {
      const mask = noteMask(digit)

      for (const orientation of ['row', 'col'] as const) {
        const bases = orientation === 'row' ? ROWS : COLS
        const covers = orientation === 'row' ? COLS : ROWS
        const coverOf = orientation === 'row' ? colOf : rowOf

        // Base lines where the digit is still open, with 2..size positions.
        const usable = bases
          .map((unit) => ({
            unit,
            spots: unit.cells.filter((cell) => !board[cell] && (candidates[cell] ?? 0) & mask),
          }))
          .filter(({ spots }) => spots.length >= 2 && spots.length <= size)

        if (usable.length < size) continue

        for (const combo of combinations(usable, size)) {
          const coverSet = new Set<number>()
          for (const { spots } of combo) for (const cell of spots) coverSet.add(coverOf(cell))
          if (coverSet.size !== size) continue

          const patternCells = combo.flatMap(({ spots }) => spots)
          const baseIndices = new Set(combo.map(({ unit }) => unit.index))
          const eliminations: Elimination[] = []

          for (const cover of coverSet) {
            for (const cell of covers[cover]!.cells) {
              const baseLine = orientation === 'row' ? rowOf(cell) : colOf(cell)
              if (baseIndices.has(baseLine) || board[cell]) continue
              if ((candidates[cell] ?? 0) & mask) eliminations.push({ index: cell, digit })
            }
          }

          if (eliminations.length === 0) continue

          const baseNames = combo
            .map(({ unit }) => `${orientation === 'row' ? 'r' : 'c'}${unit.index + 1}`)
            .join(', ')
          const coverNames = [...coverSet]
            .sort((a, b) => a - b)
            .map((n) => `${orientation === 'row' ? 'c' : 'r'}${n + 1}`)
            .join(', ')

          return {
            technique: id,
            placements: [],
            eliminations,
            pattern: patternCells,
            targets: [...new Set(eliminations.map((e) => e.index))],
            units: [
              ...combo.map(({ unit }) => UNITS.indexOf(unit)),
              ...[...coverSet].map((n) => UNITS.indexOf(covers[n]!)),
            ],
            explanation:
              `${label}: in ${baseNames}, every ${digit} sits in ${coverNames}. Those ` +
              `${size} ${orientation === 'row' ? 'columns' : 'rows'} are used up, so ${digit} is ` +
              `removed from them elsewhere (${cellLabels([...new Set(eliminations.map((e) => e.index))])}).`,
          } satisfies TechniqueStep
        }
      }
    }

    return null
  }
}

export const xWing = findFish(2, 'xWing', 'X-Wing')
export const swordfish = findFish(3, 'swordfish', 'Swordfish')
export const jellyfish = findFish(4, 'jellyfish', 'Jellyfish')

export { indexAt }
