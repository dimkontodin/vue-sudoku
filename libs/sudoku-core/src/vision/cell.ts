import { normaliseGlyph } from './normalise'
import type { CellBitmap, GrayImage } from './types'

/**
 * Turning one square of a rectified board into a glyph mask.
 *
 * The naive version — threshold the whole board once, take every inked pixel
 * inside the square — fails on real sources in two ways that look nothing alike
 * but have the same cause: it cannot tell the difference between *a mark* and
 * *the square it sits in*.
 *
 * A grid line a pixel inside the boundary becomes ink, so an empty cell holds a
 * "glyph", and a full cell has its digit squeezed into the corner of a bounding
 * box that now spans the whole square. A tinted cell — shaded to mark a given —
 * comes out solid, because one threshold for the whole board has to put the
 * tint on one side of it, and the side it picks is ink.
 *
 * So each square gets its own threshold, and what survives it is filtered by
 * shape before anything is measured.
 */

/** Fraction of a cell trimmed before anything else, to clear the line cores. */
const CELL_INSET = 0.06

/**
 * How far apart the two tones in a square must be before it holds anything.
 *
 * Every square splits into a darker and a lighter half — the question is
 * whether that split means something. On blank paper, or an evenly tinted cell,
 * the two halves are a few levels apart and the split is just noise being
 * sorted. Print against its background is nothing like that close.
 */
const MIN_CONTRAST = 32

/**
 * A run covering this much of the window is a grid line, not part of a digit.
 *
 * Generous, because the cost of the two mistakes is not the same: a line left
 * in place is caught again by the shape filter below, while a row of a digit
 * cleared by mistake takes the crossbar off a 5 and turns it into a 3. A line
 * that reaches the inside of a cell at all reaches the whole way across it.
 */
const LINE_SPAN = 0.85

/**
 * Anything smaller than this share of the square is a speck or a dot.
 *
 * Low, because a 1 is a hair's breadth of ink — one stroke, a thirtieth of the
 * cell wide — and covers barely more of its square than the printing dots this
 * is meant to reject. Shape does the rest of the work.
 */
const MIN_COMPONENT_AREA = 0.008

/**
 * How near the middle a mark that touches the edge of the square has to sit.
 *
 * What reaches this point is usually a grid line that entered at a slight
 * angle: too short to be cleared as a line, too fat to be a speck, and lying
 * along an edge. A digit leaks over an edge too — a tall 1 in a tight cell
 * touches the top and the bottom — but it leaks from the middle, whereas a
 * line hugs the side it came in on. Measured in the direction of the edge
 * that was touched, which is the direction that tells them apart: a 1 is
 * central left to right, a line down the side of the cell is not.
 */
const EDGE_MARGIN = 0.2

/** ...and anything spanning this much of it, while this thin, is a stray line. */
const LINE_EXTENT = 0.85
const LINE_THICKNESS = 0.25

/** Total ink below this share of the square means the square is empty. */
const EMPTY_INK_RATIO = 0.01

export interface CellRect {
  left: number
  top: number
  right: number
  bottom: number
}

interface Split {
  threshold: number
  contrast: number
  /** True when the darker tone is the minority — print on paper. */
  darkIsInk: boolean
}

/**
 * Otsu over one square, plus the two things the board-wide version cannot say:
 * how far apart the tones are, and which of them is the mark.
 *
 * Ink is whichever tone is rarer. A digit never fills its square, so the count
 * settles the polarity without knowing anything about the source — the same
 * test reads print on paper and a dark-mode screenshot, and it reads them
 * correctly in the same picture when one cell is tinted and its neighbour is
 * not.
 */
function splitCell(values: Uint8Array): Split {
  const histogram = new Uint32Array(256)
  for (const value of values) histogram[value] = (histogram[value] ?? 0) + 1

  const total = values.length
  let sum = 0
  for (let i = 0; i < 256; i += 1) sum += i * (histogram[i] ?? 0)

  let weightDark = 0
  let sumDark = 0
  let best = 0
  let bestVariance = -1
  let bestWeight = 0
  let bestSum = 0

  for (let t = 0; t < 256; t += 1) {
    weightDark += histogram[t] ?? 0
    if (weightDark === 0) continue
    const weightLight = total - weightDark
    if (weightLight === 0) break

    sumDark += t * (histogram[t] ?? 0)
    const meanDark = sumDark / weightDark
    const meanLight = (sum - sumDark) / weightLight
    const variance = weightDark * weightLight * (meanDark - meanLight) ** 2

    if (variance > bestVariance) {
      bestVariance = variance
      best = t
      bestWeight = weightDark
      bestSum = sumDark
    }
  }

  const weightLight = total - bestWeight
  const meanDark = bestWeight === 0 ? 0 : bestSum / bestWeight
  const meanLight = weightLight === 0 ? 255 : (sum - bestSum) / weightLight

  return {
    threshold: best,
    contrast: meanLight - meanDark,
    darkIsInk: bestWeight <= weightLight,
  }
}

/**
 * Clears the rows and columns that are inked from edge to edge.
 *
 * A grid line that survived the inset spans the square; no part of a digit
 * does, because a digit is never as wide as the cell it sits in. Removing the
 * line before anything is labelled is what lets a digit that *touches* one
 * still be read — cutting it out by bounding box instead would take the digit
 * with it.
 */
function removeLines(mask: Uint8Array, width: number, height: number): void {
  for (let y = 0; y < height; y += 1) {
    let count = 0
    for (let x = 0; x < width; x += 1) count += mask[y * width + x] as number
    if (count >= width * LINE_SPAN) {
      for (let x = 0; x < width; x += 1) mask[y * width + x] = 0
    }
  }

  for (let x = 0; x < width; x += 1) {
    let count = 0
    for (let y = 0; y < height; y += 1) count += mask[y * width + x] as number
    if (count >= height * LINE_SPAN) {
      for (let y = 0; y < height; y += 1) mask[y * width + x] = 0
    }
  }
}

interface Blob {
  minX: number
  maxX: number
  minY: number
  maxY: number
  pixels: number
  label: number
  touchesSide: boolean
  touchesEnd: boolean
}

/**
 * Labels the marks in a square, diagonals included.
 *
 * Eight-way on purpose: a thin stroke crossing the pixel grid at an angle
 * touches its own continuation only at the corners, so four-way connectivity
 * cuts a 7 or a 5 into pieces and leaves the classifier a fragment. Holes are
 * counted the other way round, four-way on the background, which is the
 * pairing that keeps the topology consistent.
 */
function label(
  mask: Uint8Array,
  width: number,
  height: number,
): { labels: Int32Array; blobs: Blob[] } {
  const labels = new Int32Array(mask.length).fill(-1)
  const stack: number[] = []
  const blobs: Blob[] = []

  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] !== 1 || labels[start] !== -1) continue

    const current = blobs.length
    labels[start] = current
    stack.length = 0
    stack.push(start)

    const blob: Blob = {
      minX: width,
      maxX: -1,
      minY: height,
      maxY: -1,
      pixels: 0,
      label: current,
      touchesSide: false,
      touchesEnd: false,
    }

    while (stack.length > 0) {
      const index = stack.pop() as number
      const x = index % width
      const y = (index / width) | 0

      blob.pixels += 1
      if (x === 0 || x === width - 1) blob.touchesSide = true
      if (y === 0 || y === height - 1) blob.touchesEnd = true
      if (x < blob.minX) blob.minX = x
      if (x > blob.maxX) blob.maxX = x
      if (y < blob.minY) blob.minY = y
      if (y > blob.maxY) blob.maxY = y

      for (let dy = -1; dy <= 1; dy += 1) {
        const ny = y + dy
        if (ny < 0 || ny >= height) continue
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx
          if (nx < 0 || nx >= width) continue
          const next = ny * width + nx
          if (mask[next] !== 1 || labels[next] !== -1) continue
          labels[next] = current
          stack.push(next)
        }
      }
    }

    blobs.push(blob)
  }

  return { labels, blobs }
}

/** True for the leftovers of a grid line: long in one direction, thin in the other. */
function isStray(blob: Blob, width: number, height: number): boolean {
  const boxWidth = blob.maxX - blob.minX + 1
  const boxHeight = blob.maxY - blob.minY + 1
  if (boxWidth >= width * LINE_EXTENT && boxHeight <= height * LINE_THICKNESS) return true
  if (boxHeight >= height * LINE_EXTENT && boxWidth <= width * LINE_THICKNESS) return true

  // Leaning on the edge it came in through, rather than reaching over it.
  const centreX = (blob.minX + blob.maxX) / 2 / width
  const centreY = (blob.minY + blob.maxY) / 2 / height
  if (blob.touchesSide && (centreX < EDGE_MARGIN || centreX > 1 - EDGE_MARGIN)) return true
  return blob.touchesEnd && (centreY < EDGE_MARGIN || centreY > 1 - EDGE_MARGIN)
}

function distanceToCentre(blob: Blob, width: number, height: number): number {
  const dx = (blob.minX + blob.maxX) / 2 - (width - 1) / 2
  const dy = (blob.minY + blob.maxY) / 2 - (height - 1) / 2
  return Math.hypot(dx, dy)
}

/**
 * Reads one square of the board.
 *
 * `rect` is in board pixels and comes from the fitted grid lines, so it is the
 * real square rather than a ninth of the picture.
 */
export function readCell(board: GrayImage, rect: CellRect, bitmapSize: number): CellBitmap {
  const inset = Math.round(Math.min(rect.right - rect.left, rect.bottom - rect.top) * CELL_INSET)
  const left = Math.max(0, Math.round(rect.left) + inset)
  const top = Math.max(0, Math.round(rect.top) + inset)
  const right = Math.min(board.width, Math.round(rect.right) - inset)
  const bottom = Math.min(board.height, Math.round(rect.bottom) - inset)
  const width = right - left
  const height = bottom - top
  const blank: CellBitmap = {
    size: bitmapSize,
    data: new Uint8Array(bitmapSize * bitmapSize),
    inkRatio: 0,
  }
  if (width < 4 || height < 4) return blank

  const values = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      values[y * width + x] = board.data[(top + y) * board.width + left + x] ?? 255
    }
  }

  const split = splitCell(values)
  if (split.contrast < MIN_CONTRAST) return blank

  const mask = new Uint8Array(width * height)
  for (let i = 0; i < mask.length; i += 1) {
    const dark = (values[i] as number) <= split.threshold
    mask[i] = (split.darkIsInk ? dark : !dark) ? 1 : 0
  }

  removeLines(mask, width, height)
  const { labels, blobs } = label(mask, width, height)

  const area = width * height
  const kept = blobs.filter(
    (blob) => blob.pixels >= area * MIN_COMPONENT_AREA && !isStray(blob, width, height),
  )
  if (kept.length === 0) return blank

  // The digit is the mark nearest the middle. Anything else that survived is a
  // neighbour's ink leaning in, or a corner of a line the span test missed.
  let chosen = kept[0] as Blob
  for (const blob of kept) {
    if (distanceToCentre(blob, width, height) < distanceToCentre(chosen, width, height)) {
      chosen = blob
    }
  }

  // A glyph can arrive in pieces — a dot, a broken stroke, a serif detached by
  // thresholding — so anything overlapping the chosen mark's column and close
  // to it vertically is part of the same digit.
  const group = new Set<number>([chosen.label])
  for (const blob of kept) {
    if (blob.label === chosen.label) continue
    const overlap = Math.min(blob.maxX, chosen.maxX) - Math.max(blob.minX, chosen.minX) + 1
    const gap = Math.max(blob.minY - chosen.maxY, chosen.minY - blob.maxY)
    if (overlap > 0 && gap < height * 0.25) group.add(blob.label)
  }

  let minX = width
  let maxX = -1
  let minY = height
  let maxY = -1
  let ink = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!group.has(labels[y * width + x] as number)) continue
      ink += 1
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }

  const inkRatio = ink / area
  if (inkRatio < EMPTY_INK_RATIO || maxX < minX || maxY < minY) return blank

  const data = normaliseGlyph(
    (x, y) =>
      x >= 0 && x < width && y >= 0 && y < height && group.has(labels[y * width + x] as number),
    { minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    bitmapSize,
  )

  return { size: bitmapSize, data, inkRatio }
}
