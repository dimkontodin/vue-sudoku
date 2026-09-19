/**
 * Fitting a glyph into a fixed-size bitmap.
 *
 * Shared by cell slicing and template rendering, because the two are only
 * comparable if they are normalised identically — and because getting it right
 * is subtler than it looks. The obvious implementation walks the *source*
 * pixels and writes each one into the destination, which silently breaks the
 * moment the glyph is smaller than the bitmap: the writes land on scattered
 * destination pixels and leave gaps between them. A dotted stroke still looks
 * roughly like a digit to an overlap score, but it is topologically ruined —
 * the enclosed hole in a 6 leaks out through the gaps, and the classifier's
 * strongest signal for separating 6, 8 and 9 disappears.
 *
 * So this walks the *destination* instead and samples backwards, which cannot
 * leave gaps at any scale.
 */

export interface InkBox {
  minX: number
  minY: number
  width: number
  height: number
}

export function normaliseGlyph(
  isInk: (x: number, y: number) => boolean,
  box: InkBox,
  bitmapSize: number,
): Uint8Array {
  const data = new Uint8Array(bitmapSize * bitmapSize)
  if (box.width <= 0 || box.height <= 0) return data

  // Aspect kept, so a 1 and a 7 stay different shapes rather than both being
  // stretched to fill the square.
  const scale = (bitmapSize - 2) / Math.max(box.width, box.height)
  const offsetX = (bitmapSize - box.width * scale) / 2
  const offsetY = (bitmapSize - box.height * scale) / 2

  // When shrinking, one destination pixel covers several source pixels; take
  // ink if any of them has it, so thin strokes survive instead of being
  // sampled away between them.
  const footprint = Math.max(0, Math.ceil(0.5 / scale - 0.5))

  for (let by = 0; by < bitmapSize; by += 1) {
    const gy = (by + 0.5 - offsetY) / scale
    if (gy < 0 || gy >= box.height) continue

    for (let bx = 0; bx < bitmapSize; bx += 1) {
      const gx = (bx + 0.5 - offsetX) / scale
      if (gx < 0 || gx >= box.width) continue

      const sx = box.minX + Math.floor(gx)
      const sy = box.minY + Math.floor(gy)

      let inked = false
      for (let dy = -footprint; dy <= footprint && !inked; dy += 1) {
        for (let dx = -footprint; dx <= footprint && !inked; dx += 1) {
          if (isInk(sx + dx, sy + dy)) inked = true
        }
      }

      if (inked) data[by * bitmapSize + bx] = 1
    }
  }

  return data
}
