import { binarize } from './image'
import { normaliseGlyph } from './normalise'
import {
  CELL_BITMAP_SIZE,
  WARP_SIZE,
  type CellBitmap,
  type GrayImage,
  type Point,
  type Quad,
} from './types'

/** A component has to cover this much of the frame to be a candidate board. */
const MIN_AREA_SHARE = 0.04
/** ...and be roughly square. A sudoku grid is square however it is photographed. */
const MIN_ASPECT = 0.55
const MAX_ASPECT = 1.8
/** How much of each cell edge is dropped, to keep grid lines out of the glyph. */
const CELL_INSET = 0.15
/** Below this share of ink a cell is empty rather than unreadable. */
const EMPTY_INK_RATIO = 0.015

interface Component {
  minX: number
  maxX: number
  minY: number
  maxY: number
  corners: Quad
}

/**
 * Finds the board as the largest square-ish connected run of ink.
 *
 * The grid lines of a sudoku form one connected shape and, in any picture worth
 * reading, the biggest one — which is cheaper and far less fragile than chasing
 * contours. Falls back to the whole frame when nothing qualifies, because a
 * tightly cropped screenshot legitimately has no border to find.
 */
export function findBoardQuad(image: GrayImage): Quad {
  const { width, height } = image
  const mask = binarize(image)
  const seen = new Uint8Array(mask.length)
  const stack: number[] = []
  let best: Component | null = null
  let bestBox = -1

  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] === 0 || seen[start] === 1) continue

    seen[start] = 1
    stack.length = 0
    stack.push(start)

    let minX = width
    let maxX = -1
    let minY = height
    let maxY = -1
    // Extremes of x+y and x-y give the corners of a quad directly, with no
    // convex hull needed.
    let minSum = Infinity
    let maxSum = -Infinity
    let minDiff = Infinity
    let maxDiff = -Infinity
    let topLeft: Point = { x: 0, y: 0 }
    let bottomRight: Point = { x: 0, y: 0 }
    let bottomLeft: Point = { x: 0, y: 0 }
    let topRight: Point = { x: 0, y: 0 }

    while (stack.length > 0) {
      const index = stack.pop() as number
      const x = index % width
      const y = (index / width) | 0

      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y

      const sum = x + y
      const diff = x - y
      if (sum < minSum) {
        minSum = sum
        topLeft = { x, y }
      }
      if (sum > maxSum) {
        maxSum = sum
        bottomRight = { x, y }
      }
      if (diff < minDiff) {
        minDiff = diff
        bottomLeft = { x, y }
      }
      if (diff > maxDiff) {
        maxDiff = diff
        topRight = { x, y }
      }

      if (x > 0 && mask[index - 1] === 1 && seen[index - 1] === 0) {
        seen[index - 1] = 1
        stack.push(index - 1)
      }
      if (x < width - 1 && mask[index + 1] === 1 && seen[index + 1] === 0) {
        seen[index + 1] = 1
        stack.push(index + 1)
      }
      if (y > 0 && mask[index - width] === 1 && seen[index - width] === 0) {
        seen[index - width] = 1
        stack.push(index - width)
      }
      if (y < height - 1 && mask[index + width] === 1 && seen[index + width] === 0) {
        seen[index + width] = 1
        stack.push(index + width)
      }
    }

    const boxWidth = maxX - minX + 1
    const boxHeight = maxY - minY + 1
    const aspect = boxWidth / boxHeight
    const share = (boxWidth * boxHeight) / (width * height)
    if (share < MIN_AREA_SHARE || aspect < MIN_ASPECT || aspect > MAX_ASPECT) continue

    if (boxWidth * boxHeight > bestBox) {
      bestBox = boxWidth * boxHeight
      best = { minX, maxX, minY, maxY, corners: [topLeft, topRight, bottomRight, bottomLeft] }
    }
  }

  if (!best) {
    return [
      { x: 0, y: 0 },
      { x: width - 1, y: 0 },
      { x: width - 1, y: height - 1 },
      { x: 0, y: height - 1 },
    ]
  }
  return best.corners
}

/** Maps a quad found on a downscaled copy back onto the original image. */
export function scaleQuad(quad: Quad, factor: number): Quad {
  return [
    { x: quad[0].x / factor, y: quad[0].y / factor },
    { x: quad[1].x / factor, y: quad[1].y / factor },
    { x: quad[2].x / factor, y: quad[2].y / factor },
    { x: quad[3].x / factor, y: quad[3].y / factor },
  ]
}

/**
 * Homography mapping the destination square onto the source quad, solved as a
 * plain 8x8 system. Straight lines stay straight under it, which is all a
 * photograph of a flat page needs.
 */
function solveHomography(quad: Quad, size: number): number[] {
  const destination: Point[] = [
    { x: 0, y: 0 },
    { x: size, y: 0 },
    { x: size, y: size },
    { x: 0, y: size },
  ]

  const matrix: number[][] = []
  for (let i = 0; i < 4; i += 1) {
    const d = destination[i] as Point
    const s = quad[i] as Point
    matrix.push([d.x, d.y, 1, 0, 0, 0, -d.x * s.x, -d.y * s.x, s.x])
    matrix.push([0, 0, 0, d.x, d.y, 1, -d.x * s.y, -d.y * s.y, s.y])
  }

  // Gauss-Jordan with partial pivoting.
  for (let col = 0; col < 8; col += 1) {
    let pivot = col
    for (let row = col + 1; row < 8; row += 1) {
      const a = Math.abs((matrix[row] as number[])[col] as number)
      const b = Math.abs((matrix[pivot] as number[])[col] as number)
      if (a > b) pivot = row
    }

    const swap = matrix[col] as number[]
    matrix[col] = matrix[pivot] as number[]
    matrix[pivot] = swap

    const pivotRow = matrix[col] as number[]
    const pivotValue = pivotRow[col] as number
    if (Math.abs(pivotValue) < 1e-10) continue

    for (let k = col; k < 9; k += 1) pivotRow[k] = (pivotRow[k] as number) / pivotValue

    for (let row = 0; row < 8; row += 1) {
      if (row === col) continue
      const current = matrix[row] as number[]
      const factor = current[col] as number
      if (factor === 0) continue
      for (let k = col; k < 9; k += 1) {
        current[k] = (current[k] as number) - factor * (pivotRow[k] as number)
      }
    }
  }

  return matrix.map((row) => (row as number[])[8] as number)
}

function sampleBilinear(image: GrayImage, x: number, y: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  if (x0 < 0 || y0 < 0 || x0 >= image.width || y0 >= image.height) return 255

  const x1 = Math.min(image.width - 1, x0 + 1)
  const y1 = Math.min(image.height - 1, y0 + 1)
  const fx = x - x0
  const fy = y - y0
  const p00 = image.data[y0 * image.width + x0] ?? 255
  const p10 = image.data[y0 * image.width + x1] ?? 255
  const p01 = image.data[y1 * image.width + x0] ?? 255
  const p11 = image.data[y1 * image.width + x1] ?? 255

  return p00 * (1 - fx) * (1 - fy) + p10 * fx * (1 - fy) + p01 * (1 - fx) * fy + p11 * fx * fy
}

/** Rectifies the quad to a square, so every cell afterwards is the same size. */
export function warpToSquare(image: GrayImage, quad: Quad, size = WARP_SIZE): GrayImage {
  const h = solveHomography(quad, size)
  const a = h[0] as number
  const b = h[1] as number
  const c = h[2] as number
  const d = h[3] as number
  const e = h[4] as number
  const f = h[5] as number
  const g = h[6] as number
  const i = h[7] as number
  const data = new Uint8ClampedArray(size * size)

  for (let v = 0; v < size; v += 1) {
    for (let u = 0; u < size; u += 1) {
      const w = g * u + i * v + 1
      data[v * size + u] = sampleBilinear(image, (a * u + b * v + c) / w, (d * u + e * v + f) / w)
    }
  }

  return { width: size, height: size, data }
}

/**
 * Cuts the rectified board into 81 normalised ink masks.
 *
 * Each cell is binarised against one board-wide threshold rather than its own:
 * per-cell Otsu on an *empty* cell has only noise to separate, and would
 * faithfully turn a JPEG artefact into a confident digit.
 */
export function sliceCells(board: GrayImage, bitmapSize = CELL_BITMAP_SIZE): CellBitmap[] {
  const mask = binarize(board)
  const cellSize = board.width / 9
  const inset = Math.round(cellSize * CELL_INSET)
  const cells: CellBitmap[] = []

  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const left = Math.round(col * cellSize) + inset
      const top = Math.round(row * cellSize) + inset
      const right = Math.round((col + 1) * cellSize) - inset
      const bottom = Math.round((row + 1) * cellSize) - inset

      let ink = 0
      let minX = right
      let maxX = left - 1
      let minY = bottom
      let maxY = top - 1

      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          if (mask[y * board.width + x] !== 1) continue
          ink += 1
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }

      const area = Math.max(1, (right - left) * (bottom - top))
      const inkRatio = ink / area
      const hasGlyph = inkRatio >= EMPTY_INK_RATIO && maxX >= minX && maxY >= minY

      const data = hasGlyph
        ? normaliseGlyph(
            (x, y) =>
              x >= left && x < right && y >= top && y < bottom && mask[y * board.width + x] === 1,
            { minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 },
            bitmapSize,
          )
        : new Uint8Array(bitmapSize * bitmapSize)

      cells.push({ size: bitmapSize, data, inkRatio })
    }
  }

  return cells
}
