import { describe, expect, it } from 'vitest'
import { binarize, downscale, otsuThreshold, toGray } from '../image'
import { findBoardQuad, sliceCells, warpToSquare } from '../grid'
import { classifyCell, overlap } from '../classify'
import { recogniseGray } from '../recognise'
import { CELL_BITMAP_SIZE, type GrayImage } from '../types'
import { SAMPLE_PUZZLE, makeBoardImage, rotate, syntheticTemplates } from './fixtures'

function gray(width: number, height: number, value = 255): GrayImage {
  return { width, height, data: new Uint8ClampedArray(width * height).fill(value) }
}

describe('image primitives', () => {
  it('converts rgba to luma', () => {
    const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255])
    const image = toGray(rgba, 2, 1)

    expect(image.data[0]).toBe(255)
    expect(image.data[1]).toBe(0)
  })

  it('picks a threshold between two clusters', () => {
    const image = gray(10, 10, 0)
    image.data.fill(240, 50)

    const threshold = otsuThreshold(image)
    expect(threshold).toBeGreaterThanOrEqual(0)
    expect(threshold).toBeLessThan(240)
  })

  it('treats the minority tone as ink, so dark-mode sources still read', () => {
    // Light digits on a near-black page: "ink" is the bright pixels here, and a
    // fixed dark-is-ink rule would return the whole page as one giant glyph.
    const image = gray(10, 10, 12)
    image.data.fill(230, 0, 10)

    const mask = binarize(image)
    expect(mask[0]).toBe(1)
    expect(mask[50]).toBe(0)
  })

  it('leaves an already-small image alone', () => {
    const image = gray(40, 30)
    const { image: out, scale } = downscale(image, 800)

    expect(scale).toBe(1)
    expect(out).toBe(image)
  })

  it('bounds the longest edge when downscaling', () => {
    const { image: out, scale } = downscale(gray(1600, 800), 800)

    expect(out.width).toBe(800)
    expect(out.height).toBe(400)
    expect(scale).toBe(0.5)
  })
})

describe('board detection', () => {
  it('finds the grid inside a margin', () => {
    const image = makeBoardImage(SAMPLE_PUZZLE, { board: 360, margin: 20 })
    const [topLeft, topRight, bottomRight, bottomLeft] = findBoardQuad(image)

    expect(topLeft.x).toBeCloseTo(20, -1)
    expect(topLeft.y).toBeCloseTo(20, -1)
    expect(bottomRight.x).toBeCloseTo(380, -1)
    expect(bottomRight.y).toBeCloseTo(380, -1)
    expect(topRight.y).toBeCloseTo(20, -1)
    expect(bottomLeft.x).toBeCloseTo(20, -1)
  })

  it('falls back to the whole frame when there is no border to find', () => {
    // A tightly cropped screenshot is a legitimate input with nothing that
    // qualifies as a board outline.
    const quad = findBoardQuad(gray(50, 50))

    expect(quad[0]).toEqual({ x: 0, y: 0 })
    expect(quad[2]).toEqual({ x: 49, y: 49 })
  })

  it('rectifies to a square of the requested size', () => {
    const image = makeBoardImage(SAMPLE_PUZZLE)
    const board = warpToSquare(image, findBoardQuad(image), 288)

    expect(board.width).toBe(288)
    expect(board.height).toBe(288)
    expect(board.data.length).toBe(288 * 288)
  })

  it('finds the corners of a board that is not square to the frame', () => {
    // A photograph is never perfectly aligned. The corner search works off the
    // extremes of x+y and x-y, so it has to keep working once those no longer
    // coincide with the bounding box.
    const image = rotate(makeBoardImage(SAMPLE_PUZZLE, { board: 300, margin: 70 }), 8)
    const [topLeft, topRight, bottomRight, bottomLeft] = findBoardQuad(image)

    // Rotated clockwise by 8 degrees about the centre, so the top-left corner
    // has moved left and down, and no two corners share a coordinate.
    expect(topRight.x).toBeGreaterThan(topLeft.x)
    expect(bottomLeft.y).toBeGreaterThan(topLeft.y)
    expect(topRight.y).toBeLessThan(bottomRight.y)

    // The four corners still describe a square of about the right size.
    const top = Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y)
    const left = Math.hypot(bottomLeft.x - topLeft.x, bottomLeft.y - topLeft.y)
    expect(top).toBeGreaterThan(280)
    expect(Math.abs(top - left)).toBeLessThan(20)
  })

  // There is deliberately no end-to-end accuracy test on a rotated board. The
  // fixture glyphs are chunky 5x5 blocks, and nearest-neighbour rotation
  // scrambles their topology far faster than it does real type — a tolerance
  // pinned here would be measuring the fixture, not the pipeline. Accuracy on
  // actual fonts needs a canvas, so it is verified in the browser instead.
})

describe('cell slicing', () => {
  const image = makeBoardImage(SAMPLE_PUZZLE)
  const cells = sliceCells(warpToSquare(image, findBoardQuad(image)))

  it('returns one bitmap per square', () => {
    expect(cells).toHaveLength(81)
    expect(cells[0]?.size).toBe(CELL_BITMAP_SIZE)
  })

  it('marks empty squares as blank and filled ones as inked', () => {
    // SAMPLE_PUZZLE starts '53..7', so cells 0 and 1 carry digits and 2 and 3
    // do not.
    const blank = (index: number) => (cells[index]?.data ?? new Uint8Array()).every((v) => v === 0)

    expect(blank(0)).toBe(false)
    expect(blank(1)).toBe(false)
    expect(blank(2)).toBe(true)
    expect(blank(3)).toBe(true)
  })

  it('keeps the grid lines out of the glyph', () => {
    // Every empty cell sits between four grid lines; if the inset were too
    // small they would be read as ink and every blank square would "contain" a
    // digit.
    const empties = [...SAMPLE_PUZZLE].flatMap((c, i) => (c === '.' ? [i] : []))
    for (const index of empties) {
      expect(cells[index]?.inkRatio ?? 1).toBeLessThan(0.015)
    }
  })
})

describe('classification', () => {
  const templates = syntheticTemplates()

  it('scores overlap by shared ink, not by shared emptiness', () => {
    const a = new Uint8Array([1, 1, 0, 0])
    const b = new Uint8Array([1, 0, 0, 0])

    // Three of four pixels agree, but only half the ink does.
    expect(overlap(a, b)).toBe(0.5)
    expect(overlap(a, a)).toBe(1)
    expect(overlap(a, new Uint8Array(4))).toBe(0)
  })

  it('reports an empty cell as a certainty, not a guess', () => {
    const blank = {
      size: CELL_BITMAP_SIZE,
      data: new Uint8Array(CELL_BITMAP_SIZE ** 2),
      inkRatio: 0,
    }
    const reading = classifyCell(blank, templates)

    expect(reading.digit).toBe(0)
    expect(reading.confidence).toBe(1)
  })

  it('matches a glyph back to its own template', () => {
    const image = makeBoardImage('123456789' + '.'.repeat(72))
    const cells = sliceCells(warpToSquare(image, findBoardQuad(image)))

    for (let digit = 1; digit <= 9; digit += 1) {
      const reading = classifyCell(cells[digit - 1] as never, templates)
      expect(reading.digit).toBe(digit)
      expect(reading.confidence).toBeGreaterThan(0)
    }
  })

  it('reports a shape that suits two digits equally as uncertain', () => {
    // Confidence is the margin over the runner-up, not raw overlap: a cell that
    // matches two templates about as well is exactly the case a player needs
    // flagged, however good the best score looks on its own.
    const size = 4
    const cell = {
      size,
      data: new Uint8Array([1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      inkRatio: 0.25,
    }
    const ambiguous = [
      { digit: 3, size, data: cell.data.slice() },
      { digit: 8, size, data: cell.data.slice() },
    ]

    expect(classifyCell(cell, ambiguous).confidence).toBe(0)
  })
})

describe('recogniseGray', () => {
  it('reads a whole puzzle back out of its picture', () => {
    const image = makeBoardImage(SAMPLE_PUZZLE)
    const result = recogniseGray(image, { templates: syntheticTemplates() })

    expect(result.text).toBe(SAMPLE_PUZZLE)
    expect(result.cells).toHaveLength(81)
  })

  it('does not flag empty squares for checking', () => {
    const image = makeBoardImage(SAMPLE_PUZZLE)
    const result = recogniseGray(image, { templates: syntheticTemplates() })

    for (const index of result.lowConfidence) {
      expect(SAMPLE_PUZZLE[index]).not.toBe('.')
    }
  })

  it('survives being handed a picture with no grid in it', () => {
    const result = recogniseGray(gray(80, 80), { templates: syntheticTemplates() })

    expect(result.text).toHaveLength(81)
    expect(result.text).toBe('.'.repeat(81))
  })
})
