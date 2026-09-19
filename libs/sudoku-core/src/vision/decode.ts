/**
 * Turning whatever the player supplied into pixels.
 *
 * The only part of recognition that touches browser APIs, kept apart from the
 * pipeline so the rest stays testable in plain Node.
 */

/** Anything bigger than this is downscaled before decoding, to bound memory. */
const MAX_DECODE_EDGE = 1600

export interface DecodedImage {
  rgba: Uint8ClampedArray
  width: number
  height: number
}

function fit(width: number, height: number): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= MAX_DECODE_EDGE) return { width, height }
  const scale = MAX_DECODE_EDGE / longest
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/**
 * Decodes a Blob to RGBA.
 *
 * Uses createImageBitmap, which decodes off the main thread and works inside a
 * worker — an <img> element would not, and a 12MP phone photo decoded on the
 * main thread is a visible freeze.
 */
export async function decodeBlob(blob: Blob): Promise<DecodedImage> {
  const bitmap = await createImageBitmap(blob)
  try {
    const { width, height } = fit(bitmap.width, bitmap.height)

    const canvas =
      typeof OffscreenCanvas === 'function'
        ? new OffscreenCanvas(width, height)
        : Object.assign(document.createElement('canvas'), { width, height })

    const context = canvas.getContext('2d') as
      OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null
    if (!context) throw new Error('Could not read the image: no 2D canvas available.')

    context.drawImage(bitmap, 0, 0, width, height)
    return { rgba: context.getImageData(0, 0, width, height).data, width, height }
  } finally {
    bitmap.close()
  }
}

/**
 * The first image on a clipboard or drop payload, if there is one.
 *
 * Reads `items` as well as `files` because a screenshot pasted straight from the
 * OS clipboard arrives as an item with no entry in `files` in some browsers.
 */
export function imageFrom(transfer: DataTransfer | null | undefined): File | null {
  if (!transfer) return null

  for (const file of Array.from(transfer.files)) {
    if (file.type.startsWith('image/')) return file
  }
  for (const item of Array.from(transfer.items)) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file) return file
  }
  return null
}
