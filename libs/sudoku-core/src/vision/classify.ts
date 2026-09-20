import type { CellBitmap, CellReading } from './types'

/**
 * One reference glyph, as an ink mask the same size as a normalised cell.
 *
 * Several variants per digit is the point: a 1 with a serif and a 1 that is a
 * bare stroke are different shapes, and a single template for each would make
 * whichever font was not chosen unreadable.
 */
export interface DigitTemplate {
  digit: number
  size: number
  data: Uint8Array
  /** Enclosed holes in this glyph, cached because it never changes. */
  holes?: number
}

/**
 * How much better the winner has to be than the runner-up before the reading is
 * reported as confident. 6/8 and 3/9 are the pairs this is defending against:
 * both can match well, and it is the *margin* that says whether the answer is
 * actually known.
 */
const MARGIN_SCALE = 6

/**
 * How much a template is discounted when its enclosed-hole count disagrees with
 * the cell's. Not a hard filter: a smudged glyph can lose a hole, and a soft
 * penalty degrades into "slightly less confident" rather than "wrong digit".
 */
const HOLE_MISMATCH_PENALTY = 0.55

/**
 * Jaccard overlap between two ink masks: shared ink over total ink.
 *
 * Preferred over counting matching pixels, which would score two mostly-empty
 * bitmaps as nearly identical — every blank pixel they share would count as
 * agreement.
 */
export function overlap(a: Uint8Array, b: Uint8Array): number {
  let intersection = 0
  let union = 0
  for (let i = 0; i < a.length; i += 1) {
    const inA = a[i] === 1
    const inB = b[i] === 1
    if (inA && inB) intersection += 1
    if (inA || inB) union += 1
  }
  return union === 0 ? 0 : intersection / union
}

/**
 * Counts enclosed background regions — the holes in the glyph.
 *
 * Shape overlap alone cannot reliably separate 8 from 9, or 6 from 8: once a
 * glyph is normalised to a small bitmap they differ by a handful of pixels in
 * one corner, which is exactly the size of an antialiasing artefact. Topology
 * does not care about pixel counts: 8 has two holes, 6 and 9 have one, and the
 * rest have none. Flood-fills the background inward from the border, and
 * whatever background it cannot reach is enclosed.
 */
export function countHoles(data: Uint8Array, size: number): number {
  const seen = new Uint8Array(data.length)
  const stack: number[] = []

  for (let i = 0; i < size; i += 1) {
    for (const index of [i, size * (size - 1) + i, i * size, i * size + size - 1]) {
      if (data[index] === 0 && seen[index] === 0) {
        seen[index] = 1
        stack.push(index)
      }
    }
  }

  while (stack.length > 0) {
    const index = stack.pop() as number
    const x = index % size
    const y = (index / size) | 0
    const neighbours = [
      x > 0 ? index - 1 : -1,
      x < size - 1 ? index + 1 : -1,
      y > 0 ? index - size : -1,
      y < size - 1 ? index + size : -1,
    ]
    for (const next of neighbours) {
      if (next < 0 || data[next] !== 0 || seen[next] === 1) continue
      seen[next] = 1
      stack.push(next)
    }
  }

  let holes = 0
  for (let index = 0; index < data.length; index += 1) {
    if (data[index] !== 0 || seen[index] === 1) continue

    holes += 1
    seen[index] = 1
    stack.push(index)
    while (stack.length > 0) {
      const current = stack.pop() as number
      const x = current % size
      const y = (current / size) | 0
      const neighbours = [
        x > 0 ? current - 1 : -1,
        x < size - 1 ? current + 1 : -1,
        y > 0 ? current - size : -1,
        y < size - 1 ? current + size : -1,
      ]
      for (const next of neighbours) {
        if (next < 0 || data[next] !== 0 || seen[next] === 1) continue
        seen[next] = 1
        stack.push(next)
      }
    }
  }

  return holes
}

/** True when the bitmap carries no ink at all — an empty square. */
function isBlank(cell: CellBitmap): boolean {
  for (let i = 0; i < cell.data.length; i += 1) if (cell.data[i] === 1) return false
  return true
}

/**
 * Reads one cell by finding the reference glyph it overlaps best.
 *
 * Confidence combines how well the winner matched with how far clear of the
 * runner-up it finished, so a cell that could plausibly be two digits is
 * reported as uncertain even when the pixels line up well.
 */
export function classifyCell(cell: CellBitmap, templates: DigitTemplate[]): CellReading {
  // Not a guess: no ink means no digit, and saying so at full confidence keeps
  // empty squares out of the "please check these" list.
  if (isBlank(cell)) return { digit: 0, confidence: 1 }

  const cellHoles = countHoles(cell.data, cell.size)
  // Best score per digit, with the topology penalty and without it.
  const scored = new Float64Array(10)
  const raw = new Float64Array(10)

  for (const template of templates) {
    if (template.size !== cell.size) continue

    const templateHoles = template.holes ?? countHoles(template.data, template.size)
    const match = overlap(cell.data, template.data)
    const score = match * (templateHoles === cellHoles ? 1 : HOLE_MISMATCH_PENALTY)

    if (match > (raw[template.digit] as number)) raw[template.digit] = match
    if (score > (scored[template.digit] as number)) scored[template.digit] = score
  }

  let bestDigit = 0
  for (let digit = 1; digit <= 9; digit += 1) {
    if ((scored[digit] as number) > (scored[bestDigit] as number)) bestDigit = digit
  }
  if (bestDigit === 0) return { digit: 0, confidence: 0 }

  // Confidence is measured on the raw shapes, deliberately, while the answer
  // is chosen with the holes counted. When the two disagree — a 6 whose gap
  // has closed up at thumbnail resolution reads as an 8 on topology, but the
  // ink still fits a 6 about as well — the margin collapses and the cell is
  // put in front of the player, which is the only honest thing to do with a
  // glyph that no longer carries the evidence.
  let rival = 0
  for (let digit = 1; digit <= 9; digit += 1) {
    if (digit !== bestDigit) rival = Math.max(rival, raw[digit] as number)
  }

  const margin = Math.min(1, Math.max(0, (raw[bestDigit] as number) - rival) * MARGIN_SCALE)
  return { digit: bestDigit, confidence: (scored[bestDigit] as number) * margin }
}

export function classifyCells(cells: CellBitmap[], templates: DigitTemplate[]): CellReading[] {
  return cells.map((cell) => classifyCell(cell, templates))
}
