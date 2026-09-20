import { boardCandidates, frameQuad, type BoardCandidate } from './components'
import { downscale, inkPolarity, type InkPolarity } from './image'
import { evenGridLines, findGridLines, snapGridLines, type GridLines } from './lines'
import { readCell } from './cell'
import {
  CELL_BITMAP_SIZE,
  WARP_SIZE,
  type CellBitmap,
  type GrayImage,
  type Point,
  type Quad,
} from './types'

/**
 * Detection is the expensive step and gains nothing from detail, so it runs on
 * a bounded copy. The warp then samples the *original* pixels, which is where
 * digit fidelity actually matters.
 */
const DETECT_MAX_EDGE = 800

/**
 * How much of a fitted grid line must be ink before the rectangle is believed
 * to be a board. Well under what a clean grid scores, because the cost of
 * being wrong is asymmetric: a board read with even ninths is what this code
 * did before, whereas a board rejected is a board the player has to type in.
 */
const MIN_GRID_SCORE = 0.35

/**
 * Smallest and largest rectified board.
 *
 * The board is rectified at roughly the size it was found at, rather than at
 * one fixed size, because both mistakes cost accuracy: shrink a 60px cell to
 * 30 and the thin top of a 9 closes up into an 8 — or opens into a 3 —
 * whereas blowing up a thumbnail invents detail that was never there and
 * costs time to process. The floor keeps small sources workable for the line
 * fit; the ceiling keeps a 12MP photograph from being rectified at 12MP.
 */
const MIN_WARP = WARP_SIZE
const MAX_WARP = 720

/**
 * How much of the choice is "and the grid fills it", rather than "and it has a
 * grid in it".
 *
 * Several shapes usually contain the same grid — the border, the page it is
 * printed on, the white ring around it — and all of them score alike on the
 * lines, because the lines they contain are the same lines. The tightest of
 * them is the right answer: every extra pixel of margin is a pixel of
 * something else sampled into the cells, and it is the only way to break a tie
 * that would otherwise go to whichever shape happened to be found first.
 */
const COVERAGE_WEIGHT = 0.3

/**
 * A board found in a picture. Named for the *detection*, not for the puzzle:
 * `Board` in this library is nine rows of digits.
 */
export interface DetectedBoard {
  /** The board, rectified to a square. */
  image: GrayImage
  /** The grid's outline, in the coordinates of the source image. */
  quad: Quad
  /** The rectangle that was rectified: the outline, with a little air. */
  source: Quad
  /** Cell boundaries within `image`, from the grid lines themselves. */
  lines: GridLines
  /** Which tone was ink when it was found. */
  polarity: InkPolarity
  /** 0..1 confidence that this really is a sudoku grid. */
  score: number
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
 * photograph of a flat page needs — including one taken at an angle, where the
 * board arrives as a trapezium and the far edge is shorter than the near one.
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

/** Maps a point of the rectified square back to where it came from. */
function project(h: number[], u: number, v: number): Point {
  const w = (h[6] as number) * u + (h[7] as number) * v + 1
  return {
    x: ((h[0] as number) * u + (h[1] as number) * v + (h[2] as number)) / w,
    y: ((h[3] as number) * u + (h[4] as number) * v + (h[5] as number)) / w,
  }
}

/**
 * The outline of the grid itself, in source coordinates.
 *
 * The shape that was detected is only ever approximately the board — a border
 * around it, a page behind it — but the fitted lines are the board, so pushing
 * their corners back through the same homography says where it really is. This
 * is what a player sees drawn over their photograph.
 */
function gridQuad(warpedFrom: Quad, lines: GridLines, size: number): Quad {
  const h = solveHomography(warpedFrom, size)
  const left = lines.xs[0] as number
  const right = lines.xs[9] as number
  const top = lines.ys[0] as number
  const bottom = lines.ys[9] as number

  return [
    project(h, left, top),
    project(h, right, top),
    project(h, right, bottom),
    project(h, left, bottom),
  ]
}

/** Rectifies the quad to a square, undoing both rotation and perspective. */
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
 * How far outside its corners a board is rectified, as a share of its side.
 *
 * The shape that is found is the *outside* of the board's border, so warping
 * to exactly those corners puts the outermost grid line flush with the edge of
 * the rectified square, with half of it sampled off the end. Those two lines
 * are the ones the cell boundaries at the rim depend on, so a little air is
 * left around the board instead.
 */
const QUAD_PADDING = 0.03

/**
 * Pushes the corners out from the centre, as far as the picture allows.
 *
 * Backing off rather than clamping, because clamping each corner to the frame
 * separately would shear a board that is lying at an angle — and a board flush
 * with the edge of the frame has nothing to gain from the padding anyway.
 */
function padQuad(quad: Quad, width: number, height: number, amount: number): Quad {
  const cx = (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4
  const cy = (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4

  let scale = 1 + amount * 2
  for (const point of quad) {
    const dx = point.x - cx
    const dy = point.y - cy
    if (dx > 0) scale = Math.min(scale, (width - 1 - cx) / dx)
    if (dx < 0) scale = Math.min(scale, -cx / dx)
    if (dy > 0) scale = Math.min(scale, (height - 1 - cy) / dy)
    if (dy < 0) scale = Math.min(scale, -cy / dy)
  }
  if (!(scale > 1)) return quad

  return quad.map((point) => ({
    x: cx + (point.x - cx) * scale,
    y: cy + (point.y - cy) * scale,
  })) as unknown as Quad
}

/**
 * Finds the board by rectifying every plausible shape and keeping the one that
 * turns out to have a grid in it.
 *
 * Choosing by size alone — the largest square-ish thing in the picture — is
 * what the first version did, and it is wrong about a whole class of ordinary
 * images: a page border encloses the grid and is therefore bigger, a dark
 * background merges with the border into one shape spanning the frame, and on
 * a coloured poster the paper itself is the biggest square thing there is. All
 * three are *nearly* right, which is the worst case — the crop is plausible
 * and every cell is off by a fraction of its width.
 *
 * Ten evenly spaced lines is something only the board has, so the candidates
 * are scored on whether they contain that, and a shape that merely encloses
 * the board loses to the board itself.
 */
/**
 * Rectifies again onto the lines that were just found, while that improves.
 *
 * Whichever rectangle wins is only approximately the board — the shape found
 * is a border, or a page, or the white card the puzzle is printed on — but the
 * lines fitted inside it are the board's own lines, so they describe a better
 * rectangle than the one they were found in. Feeding that back makes the
 * result insensitive to which of several nested shapes happened to score
 * highest: they all converge on the same grid.
 */
function tighten(
  image: GrayImage,
  board: DetectedBoard | null,
  size: number,
): DetectedBoard | null {
  let current = board
  if (!current) return null
  let quality =
    current.score * (1 - COVERAGE_WEIGHT + COVERAGE_WEIGHT * coverage(current.lines, size))

  for (let pass = 0; pass < 2; pass += 1) {
    const source = padQuad(current.quad, image.width, image.height, QUAD_PADDING)
    const warped = warpToSquare(image, source, size)
    const lines = findGridLines(warped, current.polarity)
    const next = lines.score * (1 - COVERAGE_WEIGHT + COVERAGE_WEIGHT * coverage(lines, size))
    if (next <= quality) break

    quality = next
    current = {
      image: warped,
      source,
      quad: gridQuad(source, lines, size),
      lines,
      polarity: current.polarity,
      score: lines.score,
    }
  }

  return current
}

/** The board's own size, rounded so every cell is a whole number of pixels. */
function warpSizeFor(quad: Quad, limit: number): number {
  const sides = quad.map((point, i) => {
    const next = quad[(i + 1) % 4] as Point
    return Math.hypot(next.x - point.x, next.y - point.y)
  })
  const side = sides.reduce((total, length) => total + length, 0) / 4

  return Math.min(Math.min(MAX_WARP, limit), Math.max(MIN_WARP, Math.round(side / 9) * 9))
}

/** How much of the rectified square the fitted grid actually occupies. */
function coverage(lines: GridLines, size: number): number {
  const across = ((lines.xs[9] as number) - (lines.xs[0] as number)) / size
  const down = ((lines.ys[9] as number) - (lines.ys[0] as number)) / size
  return Math.min(1, Math.max(0, (across + down) / 2))
}

export function detectBoard(image: GrayImage, size = WARP_SIZE): DetectedBoard {
  const { image: small, scale } = downscale(image, DETECT_MAX_EDGE)
  const proposals: BoardCandidate[] = [
    ...boardCandidates(small),
    // A screenshot cropped to the grid has no border to find, so the frame
    // itself is always worth trying.
    { quad: frameQuad(small.width, small.height), polarity: inkPolarity(small), share: 1 },
  ]

  let best: DetectedBoard | null = null
  let bestQuality = 0
  for (const proposal of proposals) {
    const quad = padQuad(scaleQuad(proposal.quad, scale), image.width, image.height, QUAD_PADDING)
    const warped = warpToSquare(image, quad, size)
    const lines = findGridLines(warped, proposal.polarity)
    const quality = lines.score * (1 - COVERAGE_WEIGHT + COVERAGE_WEIGHT * coverage(lines, size))
    if (best && quality <= bestQuality) continue

    bestQuality = quality
    best = {
      image: warped,
      source: quad,
      quad: gridQuad(quad, lines, size),
      lines,
      polarity: proposal.polarity,
      score: lines.score,
    }
  }

  best = tighten(image, best, size)

  if (best && best.score >= MIN_GRID_SCORE) {
    // Rectify the winner again at the resolution it was actually found at, so
    // the cells are read from the pixels the source had rather than from the
    // reduced copy the candidates were compared on.
    const wanted = warpSizeFor(best.source, Math.max(image.width, image.height))
    if (wanted === size) return best

    const warped = warpToSquare(image, best.source, wanted)
    const lines = snapGridLines(warped, best.lines, wanted / size, best.polarity)

    return {
      image: warped,
      source: best.source,
      quad: gridQuad(best.source, lines, wanted),
      lines,
      polarity: best.polarity,
      score: Math.min(best.score, lines.score),
    }
  }

  // Nothing in the picture looks like a grid. Fall back to the old behaviour —
  // the whole frame, cut into ninths — which at least reads a board drawn
  // without lines, and reads a picture of nothing as an empty puzzle.
  const quad = frameQuad(image.width, image.height)
  return {
    image: warpToSquare(image, quad, size),
    source: quad,
    quad,
    lines: evenGridLines(size, size),
    polarity: inkPolarity(small),
    score: best?.score ?? 0,
  }
}

/** The board's corners in the source image. Detection, without the pixels. */
export function findBoardQuad(image: GrayImage): Quad {
  return detectBoard(image).quad
}

export interface SliceOptions {
  /** Cell boundaries; found from the board itself when not supplied. */
  lines?: GridLines
  /** Which tone is ink, for finding those boundaries. */
  polarity?: InkPolarity
  bitmapSize?: number
}

/**
 * Cuts the rectified board into 81 normalised ink masks.
 *
 * The boundaries come from the grid lines rather than from ninths of the
 * picture, so a board found slightly too large — which is the usual outcome,
 * since the thing detected is a border *around* the grid — still has its cells
 * cut in the right places.
 */
export function sliceCells(board: GrayImage, options: SliceOptions = {}): CellBitmap[] {
  const bitmapSize = options.bitmapSize ?? CELL_BITMAP_SIZE
  const found = options.lines ?? findGridLines(board, options.polarity ?? 'dark')
  const lines = found.score >= MIN_GRID_SCORE ? found : evenGridLines(board.width, board.height)
  const cells: CellBitmap[] = []

  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      cells.push(
        readCell(
          board,
          {
            left: lines.xs[col] as number,
            top: lines.ys[row] as number,
            right: lines.xs[col + 1] as number,
            bottom: lines.ys[row + 1] as number,
          },
          bitmapSize,
        ),
      )
    }
  }

  return cells
}
