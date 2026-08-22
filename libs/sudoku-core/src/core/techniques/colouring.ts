import { CELLS } from '../constants'
import { peersOf } from '../grid'
import { noteCount, noteMask, notesToArray } from '../notes'
import { ROWS, UNITS, cellLabel, cellLabels } from '../units'
import type { Board, Notes } from '../types'
import type { Elimination, Placement, Technique, TechniqueStep } from './types'

/**
 * Simple Colouring (Singles Chains).
 *
 * For one digit, build a graph over the cells that can hold it, linking two
 * cells whenever the digit has exactly TWO possible positions in a unit they
 * share (a strong link — one of the pair must be true). Two-colour each
 * connected component; within a component one colour is entirely true and the
 * other entirely false.
 *
 * Two rules follow:
 *
 *   Rule 2 (colour wrap)  — two cells of the SAME colour in one unit means that
 *                           colour is impossible. The other colour is all true,
 *                           so this PLACES digits.
 *   Rule 4 (colour trap)  — an uncoloured cell seeing both colours cannot hold
 *                           the digit, whichever colour wins.
 */
export const simpleColouring: Technique = (board, candidates) => {
  for (let digit = 1; digit <= 9; digit++) {
    const mask = noteMask(digit)

    const holders: number[] = []
    for (let index = 0; index < CELLS; index++) {
      if (!board[index] && (candidates[index] ?? 0) & mask) holders.push(index)
    }
    if (holders.length < 4) continue

    // Strong links: units where this digit has exactly two candidate cells.
    const links = new Map<number, number[]>()
    for (const unit of UNITS) {
      if (unit.cells.some((cell) => board[cell] === digit)) continue
      const spots = unit.cells.filter((cell) => !board[cell] && (candidates[cell] ?? 0) & mask)
      if (spots.length !== 2) continue

      const [a, b] = spots as [number, number]
      if (!links.has(a)) links.set(a, [])
      if (!links.has(b)) links.set(b, [])
      links.get(a)!.push(b)
      links.get(b)!.push(a)
    }

    const colour = new Map<number, 0 | 1>()

    for (const start of links.keys()) {
      if (colour.has(start)) continue

      // Two-colour this component by alternating along strong links.
      const cluster: number[] = [start]
      colour.set(start, 0)
      const queue = [start]

      while (queue.length) {
        const cell = queue.shift()!
        const next = colour.get(cell) === 0 ? 1 : 0
        for (const neighbour of links.get(cell) ?? []) {
          if (colour.has(neighbour)) continue
          colour.set(neighbour, next)
          cluster.push(neighbour)
          queue.push(neighbour)
        }
      }
      if (cluster.length < 4) continue

      const byColour: [number[], number[]] = [[], []]
      for (const cell of cluster) byColour[colour.get(cell)!].push(cell)

      // Rule 2: same colour twice in a unit kills that colour outright.
      for (const which of [0, 1] as const) {
        const group = byColour[which]
        const clash = group.some((a, i) => group.some((b, j) => i < j && peersOf(a).includes(b)))
        if (!clash) continue

        const survivors = byColour[which === 0 ? 1 : 0]
        const placements: Placement[] = survivors.map((index) => ({ index, digit }))
        const eliminations: Elimination[] = group.map((index) => ({ index, digit }))

        return {
          technique: 'simpleColouring',
          placements,
          eliminations,
          pattern: cluster,
          targets: survivors,
          units: [],
          explanation:
            `Colouring on ${digit}: ${cellLabels(group)} share a colour but two of them sit in ` +
            `the same unit, so that colour is impossible. The other colour ` +
            `(${cellLabels(survivors)}) must all be ${digit}.`,
        } satisfies TechniqueStep
      }

      // Rule 4: an uncoloured cell seeing both colours loses the digit.
      const eliminations: Elimination[] = []
      for (const cell of holders) {
        if (colour.has(cell)) continue
        const seesA = byColour[0].some((c) => peersOf(cell).includes(c))
        const seesB = byColour[1].some((c) => peersOf(cell).includes(c))
        if (seesA && seesB) eliminations.push({ index: cell, digit })
      }

      if (eliminations.length === 0) continue

      return {
        technique: 'simpleColouring',
        placements: [],
        eliminations,
        pattern: cluster,
        targets: eliminations.map((e) => e.index),
        units: [],
        explanation:
          `Colouring on ${digit}: the chain ${cellLabels(cluster)} alternates between two ` +
          `colours, one of which must be true. ${cellLabels(eliminations.map((e) => e.index))} ` +
          `sees both colours, so ${digit} can be removed there.`,
      } satisfies TechniqueStep
    }
  }

  return null
}

/**
 * BUG+1 (Bivalue Universal Grave).
 *
 * A grid where every unsolved cell has exactly two candidates always has an
 * even number of solutions — so in a proper puzzle that state is unreachable.
 * When exactly one cell has three candidates and all others have two, that cell
 * must break the tie: of its three candidates, exactly one appears three times
 * in its row (rather than twice), and that is the answer.
 *
 * Assumes a unique solution. The caller must not run this on a grid whose
 * uniqueness has not been established.
 */
export const bug: Technique = (board, candidates) => {
  let triCell = -1

  for (let index = 0; index < CELLS; index++) {
    if (board[index]) continue
    const count = noteCount(candidates[index] ?? 0)

    if (count === 2) continue
    if (count === 3 && triCell === -1) {
      triCell = index
      continue
    }
    return null
  }

  if (triCell === -1) return null

  const row = ROWS.find((unit) => unit.cells.includes(triCell))!

  for (const digit of notesToArray(candidates[triCell] ?? 0)) {
    const mask = noteMask(digit)
    const appearances = row.cells.filter(
      (cell) => !board[cell] && (candidates[cell] ?? 0) & mask,
    ).length

    if (appearances !== 3) continue

    return {
      technique: 'bug',
      placements: [{ index: triCell, digit }],
      eliminations: notesToArray((candidates[triCell] ?? 0) & ~mask).map((other) => ({
        index: triCell,
        digit: other,
      })),
      pattern: [triCell],
      targets: [triCell],
      units: [UNITS.indexOf(row)],
      explanation:
        `BUG+1: every other unsolved cell has exactly two candidates, which would leave the ` +
        `puzzle with more than one solution. ${cellLabel(triCell)} is the only cell with three, ` +
        `and ${digit} is the one appearing three times in its row — so it must be ${digit}.`,
    } satisfies TechniqueStep
  }

  return null
}

export type { Board, Notes }
