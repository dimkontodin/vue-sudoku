import { noteCount, noteMask, notesToArray } from '../notes'
import { UNITS, cellLabels, unitLabel, type Unit } from '../units'
import type { Board } from '../types'
import type { Elimination, Technique, TechniqueId, TechniqueStep } from './types'

/** Every combination of `size` items, as index tuples. */
function combinations<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = []
  const current: T[] = []

  const walk = (start: number) => {
    if (current.length === size) {
      result.push([...current])
      return
    }
    for (let i = start; i < items.length; i++) {
      current.push(items[i]!)
      walk(i + 1)
      current.pop()
    }
  }

  walk(0)
  return result
}

function unsolvedCells(unit: Unit, board: Board): number[] {
  return unit.cells.filter((cell) => !board[cell])
}

/**
 * Naked subset: N cells in a unit whose combined candidates number exactly N.
 * Those N digits are locked into those N cells, so no other cell in the unit
 * can use them.
 *
 * The trap this avoids: cells need NOT have identical candidate sets, nor even
 * all N candidates each. A valid naked triple can be {1,2}/{2,3}/{1,3}. Testing
 * for identical sets — the obvious first implementation — misses most of them.
 * What matters is that the UNION has size N.
 */
function findNakedSubset(size: number, id: TechniqueId, label: string): Technique {
  return (board, candidates) => {
    for (let unitIndex = 0; unitIndex < UNITS.length; unitIndex++) {
      const unit = UNITS[unitIndex]!
      const cells = unsolvedCells(unit, board)
      if (cells.length <= size) continue

      for (const combo of combinations(cells, size)) {
        let union = 0
        for (const cell of combo) union |= candidates[cell] ?? 0
        if (noteCount(union) !== size) continue

        const digits = notesToArray(union)
        const eliminations: Elimination[] = []

        for (const cell of cells) {
          if (combo.includes(cell)) continue
          const overlap = (candidates[cell] ?? 0) & union
          if (!overlap) continue
          for (const digit of notesToArray(overlap)) eliminations.push({ index: cell, digit })
        }

        if (eliminations.length === 0) continue

        return {
          technique: id,
          placements: [],
          eliminations,
          pattern: combo,
          targets: [...new Set(eliminations.map((e) => e.index))],
          units: [unitIndex],
          explanation:
            `${cellLabels(combo)} in ${unitLabel(unit)} share only the candidates ` +
            `${digits.join(', ')}, so those digits are locked there and removed from the ` +
            `rest of the ${unit.kind === 'box' ? 'box' : unit.kind === 'row' ? 'row' : 'column'}. (${label})`,
        } satisfies TechniqueStep
      }
    }

    return null
  }
}

/**
 * Hidden subset: N digits in a unit whose candidate positions occupy exactly N
 * cells. Those cells must hold those digits, so every OTHER candidate is
 * removed from them.
 *
 * The dual of a naked subset — naked is N cells holding N digits, hidden is
 * N digits held in N cells.
 */
function findHiddenSubset(size: number, id: TechniqueId, label: string): Technique {
  return (board, candidates) => {
    for (let unitIndex = 0; unitIndex < UNITS.length; unitIndex++) {
      const unit = UNITS[unitIndex]!
      const cells = unsolvedCells(unit, board)
      if (cells.length <= size) continue

      // Digits still open in this unit, with where they can go.
      const spots = new Map<number, number[]>()
      for (let digit = 1; digit <= 9; digit++) {
        if (unit.cells.some((cell) => board[cell] === digit)) continue
        const mask = noteMask(digit)
        const where = cells.filter((cell) => (candidates[cell] ?? 0) & mask)
        if (where.length >= 2 && where.length <= size) spots.set(digit, where)
      }
      if (spots.size < size) continue

      for (const combo of combinations([...spots.keys()], size)) {
        const covered = new Set<number>()
        for (const digit of combo) for (const cell of spots.get(digit)!) covered.add(cell)
        if (covered.size !== size) continue

        let comboMask = 0
        for (const digit of combo) comboMask |= noteMask(digit)

        const eliminations: Elimination[] = []
        for (const cell of covered) {
          const extra = (candidates[cell] ?? 0) & ~comboMask
          if (!extra) continue
          for (const digit of notesToArray(extra)) eliminations.push({ index: cell, digit })
        }

        if (eliminations.length === 0) continue

        return {
          technique: id,
          placements: [],
          eliminations,
          pattern: [...covered],
          targets: [...new Set(eliminations.map((e) => e.index))],
          units: [unitIndex],
          explanation:
            `In ${unitLabel(unit)}, the digits ${combo.join(', ')} can only go in ` +
            `${cellLabels([...covered])}. Those cells must hold exactly those digits, so their ` +
            `other candidates are removed. (${label})`,
        } satisfies TechniqueStep
      }
    }

    return null
  }
}

export const nakedPair = findNakedSubset(2, 'nakedPair', 'Naked Pair')
export const nakedTriple = findNakedSubset(3, 'nakedTriple', 'Naked Triple')
export const nakedQuad = findNakedSubset(4, 'nakedQuad', 'Naked Quad')

export const hiddenPair = findHiddenSubset(2, 'hiddenPair', 'Hidden Pair')
export const hiddenTriple = findHiddenSubset(3, 'hiddenTriple', 'Hidden Triple')

export { combinations }
