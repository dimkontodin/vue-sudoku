/**
 * Image-to-puzzle recognition.
 *
 * Everything here works on plain arrays rather than canvases or DOM types, so
 * the pipeline is unit-testable without a browser. The only canvas-dependent
 * step is decoding the source image and rendering the reference glyphs, and
 * both are isolated behind their own modules.
 */

/** A single-channel image, 0 = black, 255 = white, row-major. */
export interface GrayImage {
  width: number
  height: number
  data: Uint8ClampedArray
}

/** A point in image space. */
export interface Point {
  x: number
  y: number
}

/** The four corners of the detected board, in TL, TR, BR, BL order. */
export type Quad = readonly [Point, Point, Point, Point]

/**
 * One cell, normalised to a fixed square and binarised: 1 where there is ink,
 * 0 where there is not. Empty cells come through as all-zero.
 */
export interface CellBitmap {
  size: number
  /** Ink mask, `size * size` entries. */
  data: Uint8Array
  /** Share of the cell covered by ink, used to reject empty cells cheaply. */
  inkRatio: number
}

/** What the classifier concluded about one cell. */
export interface CellReading {
  /** 0 when the cell is empty. */
  digit: number
  /**
   * 0..1. For a digit this is how well the best template matched relative to
   * the runner-up, so a 6/8 confusion scores low even when both match well.
   * An empty cell is reported at full confidence — "no ink" is not a guess.
   */
  confidence: number
}

export interface RecognisedPuzzle {
  /** 81 characters, '1'-'9' for a digit and '.' for an empty cell. */
  text: string
  /** Per-cell readings, in the same order as `text`. */
  cells: CellReading[]
  /** Indices whose reading is worth a second look before the puzzle is used. */
  lowConfidence: number[]
  /** The quad the board was found at, in the coordinates of the source image. */
  quad: Quad
}

/**
 * Cells scoring below this are surfaced to the player for checking.
 *
 * Calibrated, not guessed. Over 150 digits rendered in five typefaces (Arial,
 * Georgia, system-ui, a monospace and Verdana), 149 read correctly and the one
 * misread scored 0.128, while 95% of the correct readings scored above 0.199.
 * 0.25 sits in that gap: it catches the error with room to spare and flags
 * about one correct cell in eight.
 *
 * It started at 0.45, which flagged a third of a *perfectly* read board — and a
 * highlight that fires on everything is one people learn to scroll past, which
 * is worse than not having it.
 */
export const LOW_CONFIDENCE = 0.25

/** The side of the warped board, in pixels. 9 cells of 32. */
export const WARP_SIZE = 288

/**
 * The side of a normalised cell bitmap handed to the classifier.
 *
 * 16 was too coarse: at that size a 9 and an 8 differ by a handful of pixels in
 * one corner, which is the same order as an antialiasing artefact.
 */
export const CELL_BITMAP_SIZE = 24
