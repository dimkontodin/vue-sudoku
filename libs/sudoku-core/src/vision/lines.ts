import { adaptiveMask, type InkPolarity } from './image'
import type { GrayImage } from './types'

/**
 * Where the grid lines actually are on a rectified board.
 *
 * Cutting a board into 81 equal ninths assumes the rectangle handed over is
 * exactly the grid and nothing else, and that assumption fails constantly: a
 * screenshot carries a margin, a dark background merges with the border, a
 * photograph is found a few pixels wide. Every one of those shifts the cell
 * boundaries by a fraction of a cell, which is enough to slice a digit in half
 * and to drag a grid line into the cell next door.
 *
 * Ten lines per axis is a strong, cheap thing to look for: a sudoku is the only
 * thing in the picture with that structure, so the fit doubles as the test of
 * whether this rectangle is a board at all.
 */

/**
 * Widest and narrowest cell pitch to consider, as a share of the rectangle.
 *
 * A ninth is a board that fills its rectangle exactly. The floor allows a
 * rectangle a third too large — a border, a page, a screenshot with a margin —
 * and no more: given enough freedom the fit will shrink the pitch until ten
 * lines land on ten strokes of the digits instead, which scores well and is
 * nonsense.
 */
const MIN_PITCH = 1 / 12
const MAX_PITCH = 1 / 9

/** How far a line may sit from where an even spacing would put it. */
const SNAP_TOLERANCE = 0.12

/**
 * How many strips each profile is measured in.
 *
 * A single profile over the whole board asks "is this column inked from top to
 * bottom", which a line answers with a resounding yes — unless the board is a
 * degree out of true, in which case the line drifts a few pixels across and
 * the column it was in is inked for only part of its height. Measuring in
 * strips and taking the weakest asks the question that was meant: is there a
 * line here, all the way down, allowing it to lean. It also sharpens the
 * distinction from a digit, which shows up in one strip and not the others.
 */
const BANDS = 3

export interface GridLines {
  /** Ten column boundaries, left to right. */
  xs: number[]
  /** Ten row boundaries, top to bottom. */
  ys: number[]
  /**
   * 0..1: how much of each fitted line is inked, less how much ink sits
   * between the lines. Above ~0.4 the rectangle contains a grid; below it,
   * this is not a board.
   */
  score: number
}

/**
 * Share of each column (or row) that is ink, measured in strips and as a
 * whole. A grid line reads near 1 everywhere; a digit reads near 1 nowhere.
 */
interface Profile {
  /** One per strip, across the axis being measured. */
  bands: Float64Array[]
  /** All strips together, for sub-pixel positioning. */
  whole: Float64Array
}

function profile(mask: Uint8Array, width: number, height: number, axis: 'x' | 'y'): Profile {
  const length = axis === 'x' ? width : height
  const depth = axis === 'x' ? height : width
  const bands = Array.from({ length: BANDS }, () => new Float64Array(length))
  const whole = new Float64Array(length)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] !== 1) continue
      const at = axis === 'x' ? x : y
      const across = axis === 'x' ? y : x
      const band = bands[Math.min(BANDS - 1, Math.floor((across * BANDS) / depth))] as Float64Array
      band[at] = (band[at] as number) + 1
      whole[at] = (whole[at] as number) + 1
    }
  }

  const bandDepth = depth / BANDS
  for (let i = 0; i < length; i += 1) {
    whole[i] = (whole[i] as number) / depth
    for (const band of bands) band[i] = Math.min(1, (band[i] as number) / bandDepth)
  }

  return { bands, whole }
}

function peak(values: Float64Array, centre: number, tolerance: number): number {
  let best = 0
  const from = Math.max(0, Math.round(centre - tolerance))
  const to = Math.min(values.length - 1, Math.round(centre + tolerance))
  for (let i = from; i <= to; i += 1) best = Math.max(best, values[i] as number)
  return best
}

/** How strongly a line shows up in the strip that sees it least. */
function linePeak(profile: Profile, centre: number, tolerance: number): number {
  let weakest = 1
  for (const band of profile.bands) weakest = Math.min(weakest, peak(band, centre, tolerance))
  return weakest
}

/** The emptiest place near `centre` — how clear the middle of a cell is. */
function trough(values: Float64Array, centre: number, reach: number): number {
  let least = 1
  const from = Math.max(0, Math.round(centre - reach))
  const to = Math.min(values.length - 1, Math.round(centre + reach))
  if (from > to) return 0
  for (let i = from; i <= to; i += 1) least = Math.min(least, values[i] as number)
  return least
}

/**
 * How grid-like a set of ten lines is: inked where the lines are, clear
 * between them.
 *
 * The second half is what stops the fit from finding a "grid" in a patch of
 * digits. Ten peaks on their own are easy to come by in any dense ink — it is
 * the *gaps* that make a grid a grid, and a sudoku has nine of them across,
 * each nearly empty somewhere near its middle.
 */
function gridScore(values: Profile, origin: number, pitch: number): number {
  const tolerance = Math.max(1, pitch * SNAP_TOLERANCE)
  let lines = 0
  for (let i = 0; i < 10; i += 1) lines += linePeak(values, origin + i * pitch, tolerance)

  let gaps = 0
  for (let i = 0; i < 9; i += 1) {
    gaps += trough(values.whole, origin + (i + 0.5) * pitch, pitch * 0.25)
  }

  return Math.max(0, lines / 10 - gaps / 9)
}

/**
 * The centre of mass of the peak near `centre`, or the estimate unchanged when
 * there is nothing there. Sub-pixel, and it sits in the middle of a thick line
 * rather than on whichever edge happened to be darkest.
 */
function refine(values: Float64Array, centre: number, tolerance: number): number {
  const from = Math.max(0, Math.round(centre - tolerance))
  const to = Math.min(values.length - 1, Math.round(centre + tolerance))

  let height = 0
  for (let i = from; i <= to; i += 1) height = Math.max(height, values[i] as number)
  if (height <= 0) return centre

  let weight = 0
  let total = 0
  for (let i = from; i <= to; i += 1) {
    const value = values[i] as number
    if (value < height / 2) continue
    weight += value
    total += value * i
  }

  return weight === 0 ? centre : total / weight
}

/**
 * Best fit of ten evenly spaced lines, then each line pulled onto the ink.
 *
 * Fitting the even model first and refining after is what keeps this honest:
 * picking the ten strongest columns outright would happily choose ten strokes
 * of the same digit, whereas the model can only score well when the ink really
 * does repeat at one pitch across the whole board. The refinement afterwards is
 * what absorbs what the model cannot express — the slight unevenness left by
 * perspective, and lines that are a pixel or two off where they should be.
 */
function fitAxis(values: Profile, size: number): { positions: number[]; score: number } {
  let bestOrigin = 0
  let bestPitch = size / 9
  let bestScore = -1

  for (let pitch = size * MIN_PITCH; pitch <= size * MAX_PITCH + 1e-6; pitch += 0.25) {
    // Lines may start a little before the rectangle and end a little after it:
    // a board found a few pixels inside its own border still has eight good
    // lines to fit, and the two that fall outside simply score nothing.
    const from = -pitch * 0.3
    const to = size - 9 * pitch + pitch * 0.3

    for (let origin = from; origin <= to; origin += 0.5) {
      const score = gridScore(values, origin, pitch)
      if (score > bestScore) {
        bestScore = score
        bestOrigin = origin
        bestPitch = pitch
      }
    }
  }

  const tolerance = Math.max(1, bestPitch * SNAP_TOLERANCE)
  const positions: number[] = []
  for (let i = 0; i < 10; i += 1) {
    const modelled = bestOrigin + i * bestPitch
    const snapped = refine(values.whole, modelled, tolerance)
    // Never let a refinement cross its neighbour; a fitted line that has drifted
    // past the previous one is noise, not a line.
    const previous = positions[i - 1]
    positions.push(previous === undefined ? snapped : Math.max(snapped, previous + bestPitch * 0.5))
  }

  return { positions, score: Math.max(0, bestScore) }
}

/**
 * Finds the grid on a rectified board. `score` says how much to believe it.
 */
export function findGridLines(board: GrayImage, polarity: InkPolarity = 'dark'): GridLines {
  const mask = adaptiveMask(board, polarity)
  const x = fitAxis(profile(mask, board.width, board.height, 'x'), board.width)
  const y = fitAxis(profile(mask, board.width, board.height, 'y'), board.height)

  return { xs: x.positions, ys: y.positions, score: Math.min(x.score, y.score) }
}

/**
 * Re-reads a fit at a different resolution, without deciding anything again.
 *
 * Rectifying the winning board a second time — larger, so the digits keep the
 * detail the source had — must not be an opportunity to find a *different*
 * grid: fitting again from scratch at the new size can and does lock onto
 * another pitch, and then the board that was chosen is not the board that is
 * read. So the lines that were already found are carried over and only nudged
 * onto the ink where it has moved by a pixel or two.
 */
export function snapGridLines(
  board: GrayImage,
  lines: GridLines,
  factor: number,
  polarity: InkPolarity = 'dark',
): GridLines {
  const mask = adaptiveMask(board, polarity)
  const columns = profile(mask, board.width, board.height, 'x')
  const rows = profile(mask, board.width, board.height, 'y')

  const snap = (positions: number[], values: Profile): { out: number[]; score: number } => {
    const scaled = positions.map((position) => position * factor)
    const pitch = ((scaled[9] as number) - (scaled[0] as number)) / 9
    const tolerance = Math.max(1, pitch * SNAP_TOLERANCE)
    const out = scaled.map((position) => refine(values.whole, position, tolerance))
    const score = gridScore(values, out[0] as number, pitch)
    return { out, score }
  }

  const x = snap(lines.xs, columns)
  const y = snap(lines.ys, rows)

  return { xs: x.out, ys: y.out, score: Math.min(x.score, y.score) }
}

/** Ten evenly spaced boundaries, for when no grid can be found. */
export function evenGridLines(width: number, height: number): GridLines {
  const xs: number[] = []
  const ys: number[] = []
  for (let i = 0; i <= 9; i += 1) {
    xs.push((i * width) / 9)
    ys.push((i * height) / 9)
  }
  return { xs, ys, score: 0 }
}
