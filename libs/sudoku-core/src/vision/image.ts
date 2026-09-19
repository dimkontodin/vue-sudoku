import type { GrayImage } from './types'

/** Rec. 601 luma, the usual weighting for "how bright does this look". */
export function toGray(rgba: Uint8ClampedArray, width: number, height: number): GrayImage {
  const data = new Uint8ClampedArray(width * height)
  for (let i = 0, p = 0; i < data.length; i += 1, p += 4) {
    data[i] =
      (((rgba[p] ?? 0) * 299 + (rgba[p + 1] ?? 0) * 587 + (rgba[p + 2] ?? 0) * 114) / 1000) | 0
  }
  return { width, height, data }
}

/**
 * Nearest-neighbour downscale to a bounded longest edge.
 *
 * Connected-component labelling is the expensive step of grid detection and it
 * scales with pixel count, not with detail — a 4000px phone photo finds exactly
 * the same board at 800px, a factor of 25 cheaper. Returns the input untouched
 * when it is already small enough, so callers can always call it.
 */
export function downscale(image: GrayImage, maxEdge: number): { image: GrayImage; scale: number } {
  const longest = Math.max(image.width, image.height)
  if (longest <= maxEdge) return { image, scale: 1 }

  const scale = maxEdge / longest
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const data = new Uint8ClampedArray(width * height)

  for (let y = 0; y < height; y += 1) {
    const sy = Math.min(image.height - 1, (y / scale) | 0)
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(image.width - 1, (x / scale) | 0)
      data[y * width + x] = image.data[sy * image.width + sx] ?? 0
    }
  }

  return { image: { width, height, data }, scale }
}

/**
 * Otsu's method: the threshold that best separates the histogram into two
 * groups. Chosen over a fixed cutoff because a photographed page and a dark-mode
 * screenshot have nothing in common except that ink and paper are two clusters.
 */
export function otsuThreshold(image: GrayImage): number {
  const histogram = new Uint32Array(256)
  for (const value of image.data) histogram[value] = (histogram[value] ?? 0) + 1

  const total = image.data.length
  let sum = 0
  for (let i = 0; i < 256; i += 1) sum += i * (histogram[i] ?? 0)

  let sumBackground = 0
  let weightBackground = 0
  let best = 0
  let bestVariance = -1

  for (let t = 0; t < 256; t += 1) {
    weightBackground += histogram[t] ?? 0
    if (weightBackground === 0) continue

    const weightForeground = total - weightBackground
    if (weightForeground === 0) break

    sumBackground += t * (histogram[t] ?? 0)
    const meanBackground = sumBackground / weightBackground
    const meanForeground = (sum - sumBackground) / weightForeground
    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2

    if (variance > bestVariance) {
      bestVariance = variance
      best = t
    }
  }

  return best
}

/**
 * True where there is ink.
 *
 * `invert` handles dark-mode sources: a screenshot of this very app is light
 * digits on a near-black page, where "ink" is the bright pixels. It is decided
 * by which side of the threshold the majority of pixels fall on — paper always
 * outnumbers ink on a sudoku grid.
 */
export function binarize(image: GrayImage, threshold = otsuThreshold(image)): Uint8Array {
  let below = 0
  for (const value of image.data) if (value <= threshold) below += 1

  const invert = below > image.data.length / 2
  const mask = new Uint8Array(image.data.length)
  for (let i = 0; i < mask.length; i += 1) {
    const dark = (image.data[i] ?? 0) <= threshold
    mask[i] = (invert ? !dark : dark) ? 1 : 0
  }
  return mask
}
