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
 * Box-filter downscale to a bounded longest edge.
 *
 * Connected-component labelling is the expensive step of grid detection and it
 * scales with pixel count, not with detail — a 4000px phone photo finds exactly
 * the same board at 800px, a factor of 25 cheaper. Returns the input untouched
 * when it is already small enough, so callers can always call it.
 *
 * Averaging rather than sampling, because a grid line is the thinnest thing in
 * the picture and also the thing detection depends on. Nearest-neighbour on a
 * 5x downscale steps straight over a 3px line for most of its length and leaves
 * it dotted, which breaks the one property the board is found by: that its
 * lines are a single connected shape.
 */
export function downscale(image: GrayImage, maxEdge: number): { image: GrayImage; scale: number } {
  const longest = Math.max(image.width, image.height)
  if (longest <= maxEdge) return { image, scale: 1 }

  const scale = maxEdge / longest
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const data = new Uint8ClampedArray(width * height)

  for (let y = 0; y < height; y += 1) {
    const y0 = Math.floor((y * image.height) / height)
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * image.height) / height))
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.floor((x * image.width) / width)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * image.width) / width))

      let total = 0
      let count = 0
      for (let sy = y0; sy < y1 && sy < image.height; sy += 1) {
        for (let sx = x0; sx < x1 && sx < image.width; sx += 1) {
          total += image.data[sy * image.width + sx] ?? 0
          count += 1
        }
      }
      data[y * width + x] = count === 0 ? 0 : total / count
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

/**
 * Which tone counts as ink. `dark` is print on paper, `light` is a dark-mode
 * screenshot or a photograph of a screen.
 */
export type InkPolarity = 'dark' | 'light'

/** The polarity that leaves ink in the minority, which is how a grid looks. */
export function inkPolarity(image: GrayImage, threshold = otsuThreshold(image)): InkPolarity {
  let below = 0
  for (const value of image.data) if (value <= threshold) below += 1
  return below > image.data.length / 2 ? 'light' : 'dark'
}

/**
 * How far a pixel must sit from its neighbourhood before it counts as ink,
 * on the 0-255 scale. Below this a region is flat — paper, or an evenly
 * filled cell — however the local mean happens to fall.
 */
const LOCAL_CONTRAST = 10

/** Fraction of the longest edge used as the averaging window. */
const LOCAL_WINDOW = 0.125

/**
 * Ink mask from a local mean rather than one global cutoff.
 *
 * A single threshold is a statement about the whole picture, and a photograph
 * does not have one: the shadowed half of a page is darker than the lit half's
 * ink, so any global cutoff either loses lines in the shadow or floods the lit
 * side. Comparing each pixel with the average of the area around it asks the
 * only question that matters locally — is this darker than the paper *here* —
 * and the absolute floor keeps flat regions (blank paper, a solid background,
 * a tinted cell) out of the mask however the mean lands.
 *
 * It also stops a dark background merging with the board: the interior of a
 * black margin matches its own neighbourhood and drops out, leaving only the
 * edge where it meets the page, where a global threshold hands back one
 * connected blob spanning the whole frame.
 */
export function adaptiveMask(
  image: GrayImage,
  polarity: InkPolarity = inkPolarity(image),
  contrast = LOCAL_CONTRAST,
): Uint8Array {
  const { width, height } = image
  const radius = Math.max(2, Math.round((Math.max(width, height) * LOCAL_WINDOW) / 2))

  // Summed-area table, so every window costs four lookups whatever its size.
  const stride = width + 1
  const integral = new Float64Array(stride * (height + 1))
  for (let y = 0; y < height; y += 1) {
    let row = 0
    for (let x = 0; x < width; x += 1) {
      row += image.data[y * width + x] ?? 0
      integral[(y + 1) * stride + x + 1] = (integral[y * stride + x + 1] ?? 0) + row
    }
  }

  const mask = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - radius)
    const y1 = Math.min(height, y + radius + 1)
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - radius)
      const x1 = Math.min(width, x + radius + 1)

      const total =
        (integral[y1 * stride + x1] ?? 0) -
        (integral[y0 * stride + x1] ?? 0) -
        (integral[y1 * stride + x0] ?? 0) +
        (integral[y0 * stride + x0] ?? 0)
      const mean = total / ((x1 - x0) * (y1 - y0))
      const value = image.data[y * width + x] ?? 0
      const delta = polarity === 'dark' ? mean - value : value - mean

      mask[y * width + x] = delta >= contrast ? 1 : 0
    }
  }

  return mask
}
