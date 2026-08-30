import { computed, shallowRef } from 'vue'
import { gradeBoard, type Grading } from '../core/grade'
import { validatePuzzle, type Validation } from '../core/parse'
import type { Board } from '../core/types'

/**
 * The "is this a real puzzle, and how hard is it?" panel, shared by the enter
 * screen and the solver so the two answer the question the same way.
 *
 * It takes a getter rather than a ref so a caller can point it at whatever
 * board is current — a grid being typed, or the puzzle the solver is holding.
 */
export function usePuzzleAnalysis(source: () => Board | null) {
  const validation = shallowRef<Validation | null>(null)
  const grading = shallowRef<Grading | null>(null)
  const isChecking = shallowRef(false)

  /** Only a uniquely-solvable grid can be graded — see gradeBoard. */
  function check(): Validation | null {
    const board = source()
    if (!board) return null

    isChecking.value = true
    try {
      const result = validatePuzzle(board)
      validation.value = result
      grading.value = result.verdict === 'unique' ? gradeBoard(board) : null
      return result
    } finally {
      isChecking.value = false
    }
  }

  function reset(): void {
    validation.value = null
    grading.value = null
  }

  const canPlay = computed(
    () => validation.value?.verdict === 'unique' && validation.value.solution !== null,
  )

  /**
   * Whether handing this grid to the brute-force solver would show anything.
   * Every verdict but these two leaves it something to search — including
   * 'ambiguous' and 'tooHard', which are exactly the cases worth watching.
   */
  const canSolve = computed(() => {
    const verdict = validation.value?.verdict
    return verdict !== undefined && verdict !== 'empty' && verdict !== 'conflicting'
  })

  return { validation, grading, isChecking, check, reset, canPlay, canSolve }
}
