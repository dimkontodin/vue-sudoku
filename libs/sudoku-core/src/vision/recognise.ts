import { classifyCells, type DigitTemplate } from './classify'
import { toGray } from './image'
import { detectBoard, sliceCells } from './grid'
import { digitTemplates } from './templates'
import {
  LOW_CONFIDENCE,
  type CellBitmap,
  type CellReading,
  type GrayImage,
  type RecognisedPuzzle,
} from './types'

/**
 * What this is expected to cope with:
 *
 * - Rotation and perspective, which the warp undoes: a board photographed at
 *   an angle reads as well as its sharpness allows. The tests cover 44
 *   degrees of rotation and a far edge 40% shorter than the near one.
 * - Which way up the board was, which the warp cannot know — a square grid
 *   gives it nothing to go on — so the reading is tried at all four quarter
 *   turns and the most confident one wins.
 * - Being wrong: a digit small enough that its shape no longer carries the
 *   evidence is a misread whatever this does, so confidence is the margin
 *   between the best and second-best *shapes*, and a glyph that suits two
 *   digits is reported as uncertain even when the answer chosen matches it
 *   well.
 */

/**
 * A turn has to beat the upright reading by this much before it is taken.
 *
 * All four are always tried, rather than stopping early on a reading that
 * looks good enough: an upside-down board is the case where stopping early is
 * most tempting and least safe, because half the digits still match something
 * when turned over — a 6 reads as a 9 and scores well doing it.
 */
const TURN_MARGIN = 0.05

export interface RecogniseOptions {
  /** Injectable for tests, and the seam a learned classifier would replace. */
  templates?: DigitTemplate[]
  /**
   * Try all four quarter turns and keep the most confident. On by default;
   * worth turning off for a source that is known to be upright.
   */
  findOrientation?: boolean
}

/** Quarter turn clockwise of a square bitmap. */
function turnBitmap(cell: CellBitmap): CellBitmap {
  const { size } = cell
  const data = new Uint8Array(size * size)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      data[y * size + x] = cell.data[(size - 1 - x) * size + y] as number
    }
  }
  return { size, data, inkRatio: cell.inkRatio }
}

/** The same turn, applied to the arrangement of the 81 squares. */
function turnGrid<T>(cells: T[]): T[] {
  const out: T[] = []
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) out.push(cells[(8 - col) * 9 + row] as T)
  }
  return out
}

function meanConfidence(readings: CellReading[]): number {
  const digits = readings.filter((reading) => reading.digit !== 0)
  if (digits.length === 0) return 0
  return digits.reduce((total, reading) => total + reading.confidence, 0) / digits.length
}

/**
 * Reads the cells at whichever quarter turn the digits look most like digits.
 *
 * Nothing in the picture says which edge is the top: a grid is square and its
 * corners are interchangeable, so a photograph taken with the phone turned
 * sideways rectifies into a perfectly good board that happens to be lying
 * down. The digits are the only evidence, and a 6 read sideways matches
 * nothing well — so the turn that reads confidently is the upright one.
 */
function readAtBestTurn(
  cells: CellBitmap[],
  templates: DigitTemplate[],
  search: boolean,
): { readings: CellReading[]; turns: number } {
  let current = cells
  let best = { readings: classifyCells(cells, templates), turns: 0 }
  let bestScore = meanConfidence(best.readings)
  if (!search) return best

  for (let turns = 1; turns < 4; turns += 1) {
    current = turnGrid(current.map(turnBitmap))
    const readings = classifyCells(current, templates)
    const score = meanConfidence(readings)
    if (score > bestScore + TURN_MARGIN) {
      bestScore = score
      best = { readings, turns }
    }
  }

  return best
}

/** The whole pipeline, over a decoded image. */
export function recogniseGray(image: GrayImage, options: RecogniseOptions = {}): RecognisedPuzzle {
  const board = detectBoard(image)
  const cells = sliceCells(board.image, { lines: board.lines, polarity: board.polarity })
  const { readings, turns } = readAtBestTurn(
    cells,
    options.templates ?? digitTemplates(),
    options.findOrientation ?? true,
  )

  const text = readings.map((cell) => (cell.digit === 0 ? '.' : String(cell.digit))).join('')

  // Empty cells are reported at full confidence, so they never land here — this
  // is the list of *digits* the player should glance over before committing.
  const lowConfidence = readings.flatMap((cell, index) =>
    cell.confidence < LOW_CONFIDENCE ? [index] : [],
  )

  return { text, cells: readings, lowConfidence, quad: board.quad, turns }
}

/** Decoded RGBA straight from a canvas or an ImageData. */
export function recogniseRgba(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  options: RecogniseOptions = {},
): RecognisedPuzzle {
  return recogniseGray(toGray(rgba, width, height), options)
}
