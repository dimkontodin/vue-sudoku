import { CELLS } from '../constants'
import { peersOf } from '../grid'
import { noteCount, noteMask, notesToArray } from '../notes'
import { UNITS, cellLabel, cellLabels } from '../units'
import type { Board, Notes } from '../types'
import type { Elimination, Technique, TechniqueStep } from './types'

function sees(a: number, b: number): boolean {
  return peersOf(a).includes(b)
}

function bivalueCells(board: Board, candidates: Notes): number[] {
  const cells: number[] = []
  for (let index = 0; index < CELLS; index++) {
    if (board[index]) continue
    if (noteCount(candidates[index] ?? 0) === 2) cells.push(index)
  }
  return cells
}

function eliminateSeenByAll(
  seers: number[],
  digit: number,
  board: Board,
  candidates: Notes,
  exclude: number[],
): Elimination[] {
  const mask = noteMask(digit)
  const eliminations: Elimination[] = []

  for (let index = 0; index < CELLS; index++) {
    if (board[index] || exclude.includes(index)) continue
    if (!((candidates[index] ?? 0) & mask)) continue
    if (seers.every((seer) => sees(index, seer))) eliminations.push({ index, digit })
  }

  return eliminations
}

/**
 * Y-Wing (XY-Wing): a bi-value pivot {A,B} seeing two bi-value pincers {A,C}
 * and {B,C}. Whichever value the pivot takes, one pincer is forced to C — so C
 * is guaranteed somewhere in the pincer pair, and any cell seeing both loses it.
 */
export const yWing: Technique = (board, candidates) => {
  const bivalue = bivalueCells(board, candidates)

  for (const pivot of bivalue) {
    const [a, b] = notesToArray(candidates[pivot] ?? 0) as [number, number]

    for (const first of bivalue) {
      if (first === pivot || !sees(first, pivot)) continue
      const firstDigits = notesToArray(candidates[first] ?? 0)
      if (!firstDigits.includes(a)) continue
      const c = firstDigits.find((d) => d !== a)
      if (c === undefined || c === b) continue

      for (const second of bivalue) {
        if (second === pivot || second === first || !sees(second, pivot)) continue
        const secondDigits = notesToArray(candidates[second] ?? 0)
        if (!secondDigits.includes(b) || !secondDigits.includes(c)) continue

        const eliminations = eliminateSeenByAll([first, second], c, board, candidates, [
          pivot,
          first,
          second,
        ])
        if (eliminations.length === 0) continue

        return {
          technique: 'yWing',
          placements: [],
          eliminations,
          pattern: [pivot, first, second],
          targets: eliminations.map((e) => e.index),
          units: [],
          explanation:
            `Y-Wing: pivot ${cellLabel(pivot)} holds ${a}/${b}, with pincers ` +
            `${cellLabel(first)} (${a}/${c}) and ${cellLabel(second)} (${b}/${c}). Either way ` +
            `one pincer is ${c}, so ${c} goes from ${cellLabels(eliminations.map((e) => e.index))}.`,
        } satisfies TechniqueStep
      }
    }
  }

  return null
}

/**
 * XYZ-Wing: a three-candidate hinge {X,Y,Z} seeing bi-value wings {X,Z} and
 * {Y,Z}. Z is guaranteed among the THREE cells, not two — so an eliminating
 * cell must see the hinge as well as both wings.
 */
export const xyzWing: Technique = (board, candidates) => {
  const bivalue = bivalueCells(board, candidates)

  for (let hinge = 0; hinge < CELLS; hinge++) {
    if (board[hinge]) continue
    const hingeMask = candidates[hinge] ?? 0
    if (noteCount(hingeMask) !== 3) continue

    for (const first of bivalue) {
      if (!sees(first, hinge)) continue
      const firstMask = candidates[first] ?? 0
      if ((firstMask & hingeMask) !== firstMask) continue

      for (const second of bivalue) {
        if (second === first || !sees(second, hinge)) continue
        const secondMask = candidates[second] ?? 0
        if ((secondMask & hingeMask) !== secondMask) continue
        if ((firstMask | secondMask) !== hingeMask) continue

        const shared = firstMask & secondMask
        if (noteCount(shared) !== 1) continue
        const z = notesToArray(shared)[0]!

        // Must see all three, hinge included — that is the XYZ difference.
        const eliminations = eliminateSeenByAll([hinge, first, second], z, board, candidates, [
          hinge,
          first,
          second,
        ])
        if (eliminations.length === 0) continue

        return {
          technique: 'xyzWing',
          placements: [],
          eliminations,
          pattern: [hinge, first, second],
          targets: eliminations.map((e) => e.index),
          units: [],
          explanation:
            `XYZ-Wing: hinge ${cellLabel(hinge)} (${notesToArray(hingeMask).join('/')}) with ` +
            `wings ${cellLabel(first)} and ${cellLabel(second)}. One of the three must be ${z}, ` +
            `so ${z} goes from ${cellLabels(eliminations.map((e) => e.index))}.`,
        } satisfies TechniqueStep
      }
    }
  }

  return null
}

/**
 * W-Wing: two bi-value cells with the SAME pair {X,Y} that do not see each
 * other, joined by a strong link on X — a unit where X has exactly two
 * positions, one seeing each cell. Then one of the pair must be Y.
 *
 * The link must be strong, not merely weak; a weak link proves nothing here.
 */
export const wWing: Technique = (board, candidates) => {
  const bivalue = bivalueCells(board, candidates)

  for (let i = 0; i < bivalue.length; i++) {
    for (let j = i + 1; j < bivalue.length; j++) {
      const a = bivalue[i]!
      const b = bivalue[j]!
      const mask = candidates[a] ?? 0
      if (mask !== (candidates[b] ?? 0) || sees(a, b)) continue

      const [first, second] = notesToArray(mask) as [number, number]

      for (const [linkDigit, elimDigit] of [
        [first, second],
        [second, first],
      ] as const) {
        const linkMask = noteMask(linkDigit)

        for (let unitIndex = 0; unitIndex < UNITS.length; unitIndex++) {
          const unit = UNITS[unitIndex]!
          if (unit.cells.some((cell) => board[cell] === linkDigit)) continue

          const spots = unit.cells.filter(
            (cell) => !board[cell] && (candidates[cell] ?? 0) & linkMask,
          )
          if (spots.length !== 2) continue

          const [p, q] = spots as [number, number]
          if (p === a || p === b || q === a || q === b) continue

          const linksAB = (sees(p, a) && sees(q, b)) || (sees(p, b) && sees(q, a))
          if (!linksAB) continue

          const eliminations = eliminateSeenByAll([a, b], elimDigit, board, candidates, [a, b])
          if (eliminations.length === 0) continue

          return {
            technique: 'wWing',
            placements: [],
            eliminations,
            pattern: [a, b, p, q],
            targets: eliminations.map((e) => e.index),
            units: [unitIndex],
            explanation:
              `W-Wing: ${cellLabel(a)} and ${cellLabel(b)} both hold ${first}/${second}, joined ` +
              `by a strong link on ${linkDigit} at ${cellLabels([p, q])}. One of them must be ` +
              `${elimDigit}, so ${elimDigit} goes from ` +
              `${cellLabels(eliminations.map((e) => e.index))}.`,
          } satisfies TechniqueStep
        }
      }
    }
  }

  return null
}
