import { shallowRef } from 'vue'
import { decodeBlob } from '../vision/decode'
import { recogniseRgba } from '../vision/recognise'
import type { RecognisedPuzzle } from '../vision/types'

/**
 * Reads a puzzle out of a picture of one.
 *
 * Deliberately stops at "here is an 81-character string and how sure I am of
 * each cell". What to do with it is the caller's business — both Enter screens
 * put it into the grid the player is already editing, so a misread is corrected
 * in place rather than discovered three moves into a game.
 */

export type ImageImportStatus = 'idle' | 'reading' | 'done' | 'error'

export interface ImageImport {
  status: ReturnType<typeof shallowRef<ImageImportStatus>>
  result: ReturnType<typeof shallowRef<RecognisedPuzzle | null>>
  errorMessage: ReturnType<typeof shallowRef<string>>
  read: (blob: Blob) => Promise<RecognisedPuzzle | null>
  reset: () => void
}

export function useImageImport() {
  const status = shallowRef<ImageImportStatus>('idle')
  const result = shallowRef<RecognisedPuzzle | null>(null)
  const errorMessage = shallowRef('')

  function reset(): void {
    status.value = 'idle'
    result.value = null
    errorMessage.value = ''
  }

  async function read(blob: Blob): Promise<RecognisedPuzzle | null> {
    status.value = 'reading'
    errorMessage.value = ''
    result.value = null

    try {
      const { rgba, width, height } = await decodeBlob(blob)
      const recognised = recogniseRgba(rgba, width, height)

      // An all-empty read means the grid was not found, not that the puzzle was
      // blank — saying so is more use than handing back 81 dots.
      if (!/[1-9]/.test(recognised.text)) {
        status.value = 'error'
        errorMessage.value = 'No puzzle found in that image. Try a tighter crop of the grid.'
        return null
      }

      result.value = recognised
      status.value = 'done'
      return recognised
    } catch (error: unknown) {
      status.value = 'error'
      errorMessage.value = error instanceof Error ? error.message : 'That image could not be read.'
      return null
    }
  }

  return { status, result, errorMessage, read, reset }
}
