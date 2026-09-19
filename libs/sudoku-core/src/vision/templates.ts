import { countHoles, type DigitTemplate } from './classify'
import { normaliseGlyph } from './normalise'
import { CELL_BITMAP_SIZE } from './types'

/**
 * Reference glyphs, drawn rather than downloaded.
 *
 * The alternative was shipping a trained classifier — a model file, a runtime to
 * execute it, and a download on first use. Printed sudoku digits are a narrow
 * enough problem that rendering the ten shapes we are looking for and comparing
 * against them costs nothing and needs no network. The seam is `DigitTemplate`:
 * swapping in a CNN later means replacing this module, not the pipeline.
 */

/**
 * Enough variety to cover what sudoku sources actually use. A geometric sans
 * (Arial), a humanist UI sans (Segoe/Roboto/Helvetica via system-ui), a serif
 * for printed books and newspapers, and a monospace for puzzle-text renderings.
 */
const FONT_STACKS = [
  'Arial, Helvetica, sans-serif',
  'system-ui, "Segoe UI", Roboto, sans-serif',
  'Georgia, "Times New Roman", serif',
  'ui-monospace, Consolas, "Courier New", monospace',
] as const

const WEIGHTS = ['400', '700'] as const

/** Drawn large, then downsampled by the same bbox-fit the cells go through. */
const RENDER_SIZE = 64

type Canvas2D = {
  canvas: { width: number; height: number }
  clearRect: (x: number, y: number, w: number, h: number) => void
  fillText: (text: string, x: number, y: number) => void
  getImageData: (x: number, y: number, w: number, h: number) => { data: Uint8ClampedArray }
  font: string
  fillStyle: string
  textAlign: string
  textBaseline: string
}

function createContext(size: number): Canvas2D | null {
  if (typeof OffscreenCanvas === 'function') {
    const context = new OffscreenCanvas(size, size).getContext('2d')
    return (context as unknown as Canvas2D) ?? null
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    return (canvas.getContext('2d') as unknown as Canvas2D) ?? null
  }
  return null
}

/** Crops to the ink and hands it to the same normaliser sliceCells uses. */
function toBitmap(rgba: Uint8ClampedArray, renderSize: number, bitmapSize: number): Uint8Array {
  let minX = renderSize
  let maxX = -1
  let minY = renderSize
  let maxY = -1

  const ink = new Uint8Array(renderSize * renderSize)
  for (let i = 0; i < ink.length; i += 1) {
    // Alpha, not luminance: the glyph is drawn white onto a cleared canvas, so
    // every antialiased edge pixel is full-white with a low alpha. Reading the
    // red channel would take all of them as solid ink and fatten every shape.
    if ((rgba[i * 4 + 3] ?? 0) < 128) continue
    ink[i] = 1
    const x = i % renderSize
    const y = (i / renderSize) | 0
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  if (maxX < minX || maxY < minY) return new Uint8Array(bitmapSize * bitmapSize)

  return normaliseGlyph(
    (x, y) => x >= 0 && x < renderSize && y >= 0 && y < renderSize && ink[y * renderSize + x] === 1,
    { minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    bitmapSize,
  )
}

let cached: DigitTemplate[] | null = null

/**
 * Builds the template set once per session. Cheap (72 small draws) but pointless
 * to repeat, and every recognition run needs the same set.
 */
export function digitTemplates(bitmapSize = CELL_BITMAP_SIZE): DigitTemplate[] {
  if (cached && cached[0]?.size === bitmapSize) return cached

  const context = createContext(RENDER_SIZE)
  if (!context) return []

  const templates: DigitTemplate[] = []
  context.fillStyle = '#fff'
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  for (const family of FONT_STACKS) {
    for (const weight of WEIGHTS) {
      context.font = `${weight} ${Math.round(RENDER_SIZE * 0.72)}px ${family}`
      for (let digit = 1; digit <= 9; digit += 1) {
        context.clearRect(0, 0, RENDER_SIZE, RENDER_SIZE)
        context.fillText(String(digit), RENDER_SIZE / 2, RENDER_SIZE / 2)
        const { data } = context.getImageData(0, 0, RENDER_SIZE, RENDER_SIZE)
        const bitmap = toBitmap(data, RENDER_SIZE, bitmapSize)
        templates.push({
          digit,
          size: bitmapSize,
          data: bitmap,
          holes: countHoles(bitmap, bitmapSize),
        })
      }
    }
  }

  cached = templates
  return templates
}

/** Test seam: forces the next call to re-render. */
export function resetTemplateCache(): void {
  cached = null
}
