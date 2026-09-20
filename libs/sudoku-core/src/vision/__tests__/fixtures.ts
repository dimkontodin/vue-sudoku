import { detectBoard, sliceCells } from '../grid'
import type { DigitTemplate } from '../classify'
import type { GrayImage } from '../types'

/**
 * Synthetic sudoku images, so the pipeline can be tested without a browser or a
 * checked-in binary.
 *
 * The glyphs are seven-segment-ish 5x5 patterns rather than real type: the point
 * of these tests is that detection, rectification, slicing and matching line up
 * with each other, not that any particular font is legible. Real fonts are what
 * `digitTemplates()` covers, and that needs a canvas.
 */
const PATTERNS: Record<number, string[]> = {
  1: ['..#..', '..#..', '..#..', '..#..', '..#..'],
  2: ['####.', '....#', '.###.', '#....', '.####'],
  3: ['####.', '....#', '.###.', '....#', '####.'],
  4: ['#...#', '#...#', '#####', '....#', '....#'],
  5: ['#####', '#....', '####.', '....#', '####.'],
  6: ['.####', '#....', '####.', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '..#..'],
  8: ['.###.', '#...#', '.###.', '#...#', '.###.'],
  9: ['.###.', '#...#', '.####', '....#', '####.'],
}

export interface BoardImageOptions {
  /** Side of the drawn board in pixels. */
  board?: number
  /** White space around the board, so it is not flush with the frame. */
  margin?: number
  /** Thickness of the grid lines. */
  line?: number
}

function fill(image: GrayImage, x0: number, y0: number, x1: number, y1: number, value: number) {
  for (let y = Math.max(0, y0); y < Math.min(image.height, y1); y += 1) {
    for (let x = Math.max(0, x0); x < Math.min(image.width, x1); x += 1) {
      image.data[y * image.width + x] = value
    }
  }
}

/** Renders an 81-character puzzle string as a picture of a sudoku grid. */
export function makeBoardImage(text: string, options: BoardImageOptions = {}): GrayImage {
  const board = options.board ?? 360
  const margin = options.margin ?? 20
  const line = options.line ?? 2
  const side = board + margin * 2

  const image: GrayImage = {
    width: side,
    height: side,
    data: new Uint8ClampedArray(side * side).fill(255),
  }

  const cell = board / 9
  for (let i = 0; i <= 9; i += 1) {
    const offset = Math.round(margin + i * cell)
    fill(image, margin, offset, margin + board, offset + line, 0)
    fill(image, offset, margin, offset + line, margin + board, 0)
  }

  for (let index = 0; index < 81; index += 1) {
    const digit = Number(text[index])
    if (!digit) continue

    const pattern = PATTERNS[digit] as string[]
    const row = Math.floor(index / 9)
    const col = index % 9
    const glyph = cell * 0.6
    const unit = glyph / 5
    const left = margin + col * cell + (cell - glyph) / 2
    const top = margin + row * cell + (cell - glyph) / 2

    for (let py = 0; py < 5; py += 1) {
      for (let px = 0; px < 5; px += 1) {
        if ((pattern[py] as string)[px] !== '#') continue
        fill(
          image,
          Math.round(left + px * unit),
          Math.round(top + py * unit),
          Math.round(left + (px + 1) * unit),
          Math.round(top + (py + 1) * unit),
          0,
        )
      }
    }
  }

  return image
}

/** Bilinear sample, white outside the frame, as a page is white around a board. */
function sample(image: GrayImage, x: number, y: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  if (x0 < 0 || y0 < 0 || x0 + 1 >= image.width || y0 + 1 >= image.height) return 255

  const fx = x - x0
  const fy = y - y0
  const p00 = image.data[y0 * image.width + x0] ?? 255
  const p10 = image.data[y0 * image.width + x0 + 1] ?? 255
  const p01 = image.data[(y0 + 1) * image.width + x0] ?? 255
  const p11 = image.data[(y0 + 1) * image.width + x0 + 1] ?? 255

  return p00 * (1 - fx) * (1 - fy) + p10 * fx * (1 - fy) + p01 * (1 - fx) * fy + p11 * fx * fy
}

/**
 * Rotates an image about its centre, leaving white where nothing maps.
 *
 * A plain 2D rotation rather than a homography on purpose: the fixture has to
 * be obviously correct, or a failure says nothing about the code under test.
 * It is enough to make the board non-axis-aligned, which is the thing worth
 * proving.
 */
export function rotate(image: GrayImage, degrees: number): GrayImage {
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(-radians)
  const sin = Math.sin(-radians)
  const cx = (image.width - 1) / 2
  const cy = (image.height - 1) / 2
  const data = new Uint8ClampedArray(image.width * image.height).fill(255)

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const dx = x - cx
      const dy = y - cy
      data[y * image.width + x] = sample(image, cx + dx * cos - dy * sin, cy + dx * sin + dy * cos)
    }
  }

  return { width: image.width, height: image.height, data }
}

/**
 * Exact quarter turns clockwise — a phone held sideways, not a tilted one.
 *
 * Nothing is resampled, so a test that uses this is testing the pipeline's
 * sense of which way up the board is and nothing else.
 */
export function turn(image: GrayImage, quarters = 1): GrayImage {
  let current = image
  for (let i = 0; i < ((quarters % 4) + 4) % 4; i += 1) {
    const { width, height } = current
    const data = new Uint8ClampedArray(width * height)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        data[x * height + (height - 1 - y)] = current.data[y * width + x] as number
      }
    }
    current = { width: height, height: width, data }
  }
  return current
}

/**
 * Tilts an image as if the page were photographed from off to one side.
 *
 * `strength` is how much narrower the far edge ends up, as a share of the
 * near one, which is the only part of a real perspective that matters here:
 * straight lines stay straight, and the cells on the far side of the board
 * are smaller than the cells on the near side. Nothing else in the pipeline
 * can tell the difference between this and a real photograph of a flat page.
 */
export function tilt(image: GrayImage, strength = 0.25): GrayImage {
  const { width, height } = image
  const data = new Uint8ClampedArray(width * height).fill(255)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      // Rows keep their place; columns squeeze towards the top of the frame.
      const squeeze = 1 - strength * (1 - y / (height - 1))
      const sx = (x - (width - 1) / 2) / squeeze + (width - 1) / 2
      const sy = (y - (height - 1) / 2) / squeeze + (height - 1) / 2
      data[y * width + x] = sample(image, sx, sy)
    }
  }

  return { width, height, data }
}

/**
 * Templates built by running the real pipeline over a board holding one of each
 * digit, so the fixture never has to reimplement the normalisation in grid.ts —
 * if that changes, these change with it.
 */
export function syntheticTemplates(): DigitTemplate[] {
  const text = '123456789' + '.'.repeat(72)
  const image = makeBoardImage(text)
  const board = detectBoard(image)
  const cells = sliceCells(board.image, { lines: board.lines, polarity: board.polarity })

  return cells.slice(0, 9).map((cell, i) => ({ digit: i + 1, size: cell.size, data: cell.data }))
}

/** A valid, solvable puzzle used as realistic input. */
export const SAMPLE_PUZZLE =
  '53..7....' +
  '6..195...' +
  '.98....6.' +
  '8...6...3' +
  '4..8.3..1' +
  '7...2...6' +
  '.6....28.' +
  '...419..5' +
  '....8..79'
