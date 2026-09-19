import { classifyCells, type DigitTemplate } from './classify'
import { downscale, toGray } from './image'
import { findBoardQuad, scaleQuad, sliceCells, warpToSquare } from './grid'
import { digitTemplates } from './templates'
import { LOW_CONFIDENCE, type GrayImage, type RecognisedPuzzle } from './types'

/**
 * Grid detection is the expensive step and gains nothing from detail, so it runs
 * on a bounded copy. The warp then samples the *original* pixels, which is where
 * digit fidelity actually matters.
 */
const DETECT_MAX_EDGE = 800

/**
 * Known limits, measured on rendered boards in a browser:
 *
 * - A square-on screenshot of printed digits reads essentially perfectly
 *   (Arial, system-ui and a monospace all came back exact; a serif missed one
 *   cell out of thirty, and flagged it).
 * - Accuracy falls off as the board rotates away from square, because the
 *   glyphs are resampled twice before they reach the classifier. A photograph
 *   worth reading should be roughly square-on.
 * - Whatever it gets wrong, it should flag: the confidence score is a margin
 *   over the runner-up, not a raw match, so a cell that could be two digits is
 *   reported as uncertain even when it matches one of them well.
 */

export interface RecogniseOptions {
  /** Injectable for tests, and the seam a learned classifier would replace. */
  templates?: DigitTemplate[]
}

/** The whole pipeline, over a decoded image. */
export function recogniseGray(image: GrayImage, options: RecogniseOptions = {}): RecognisedPuzzle {
  const { image: small, scale } = downscale(image, DETECT_MAX_EDGE)
  const quad = scaleQuad(findBoardQuad(small), scale)
  const board = warpToSquare(image, quad)

  const cells = classifyCells(sliceCells(board), options.templates ?? digitTemplates())
  const text = cells.map((cell) => (cell.digit === 0 ? '.' : String(cell.digit))).join('')

  // Empty cells are reported at full confidence, so they never land here — this
  // is the list of *digits* the player should glance over before committing.
  const lowConfidence = cells.flatMap((cell, index) =>
    cell.confidence < LOW_CONFIDENCE ? [index] : [],
  )

  return { text, cells, lowConfidence, quad }
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
