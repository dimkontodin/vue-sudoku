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
 * So this walks the *destination* instead and samples backwards, over the
 * whole patch of the glyph each destination pixel covers, which cannot leave
 * gaps at any scale.
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

  /**
   * Share of a destination pixel's source area that has to be inked.
   *
   * When shrinking, one destination pixel covers a patch of the glyph, and
   * what to do with a patch that is partly inked decides whether a 6 stays a
   * 6. Taking ink if *any* of it is inked keeps the thinnest stroke alive —
   * and closes the gap at the top of a 6 into the second hole of an 8, which
   * is exactly the distinction the classifier leans on hardest. A proportion
   * keeps both: a stroke passing through a patch covers a third of it or
   * more, while the air beside the stroke does not.
   */
  const coverage = 0.3

  for (let by = 0; by < bitmapSize; by += 1) {
    const gy0 = (by - offsetY) / scale
    const gy1 = (by + 1 - offsetY) / scale
    if (gy1 <= 0 || gy0 >= box.height) continue

    const sy0 = Math.max(0, Math.floor(gy0))
    const sy1 = Math.max(sy0 + 1, Math.min(box.height, Math.ceil(gy1)))

    for (let bx = 0; bx < bitmapSize; bx += 1) {
      const gx0 = (bx - offsetX) / scale
      const gx1 = (bx + 1 - offsetX) / scale
      if (gx1 <= 0 || gx0 >= box.width) continue

      const sx0 = Math.max(0, Math.floor(gx0))
      const sx1 = Math.max(sx0 + 1, Math.min(box.width, Math.ceil(gx1)))

      let inked = 0
      let total = 0
      for (let sy = sy0; sy < sy1; sy += 1) {
        for (let sx = sx0; sx < sx1; sx += 1) {
          total += 1
          if (isInk(box.minX + sx, box.minY + sy)) inked += 1
        }
      }

      if (total > 0 && inked / total >= coverage) data[by * bitmapSize + bx] = 1
    }
  }

  return data
}
