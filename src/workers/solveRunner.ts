import { solveSteps } from '@/core/solver'
import type { Board } from '@/core/types'
import { SPEED_PRESETS, type SolveProgress, type SolveSpeed } from './protocol'

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export interface SolveRunCallbacks {
  onProgress: (progress: SolveProgress) => void
  onDone: (solved: boolean, progress: SolveProgress) => void
  isCancelled: () => boolean
  onCancelled: () => void
}

// Drives solveSteps() in batches, pausing between them so the host stays
// responsive and so cancellation messages get a chance to be delivered.
//
// Shared by the worker and the main-thread fallback: the pacing logic is
// identical either way, only where it runs differs.
export async function runSolve(
  board: Board,
  speed: SolveSpeed,
  callbacks: SolveRunCallbacks,
): Promise<void> {
  const { stepsPerTick, tickMs } = SPEED_PRESETS[speed]
  const iterator = solveSteps(board)
  const startedAt = performance.now()

  let steps = 0
  let backtracks = 0
  let depth = 0

  const snapshot = (): SolveProgress => ({
    // Copy: the caller receives this across a thread boundary (or keeps it
    // in a ref) while we keep mutating the original in place.
    board: board.slice(),
    steps,
    backtracks,
    depth,
    elapsedMs: performance.now() - startedAt,
  })

  for (;;) {
    if (callbacks.isCancelled()) {
      callbacks.onCancelled()
      return
    }

    let finished = false
    let solved = false

    for (let i = 0; i < stepsPerTick; i++) {
      const next = iterator.next()

      if (next.done) {
        finished = true
        solved = next.value
        break
      }

      steps++
      depth = next.value.depth
      if (next.value.kind === 'backtrack') backtracks++
    }

    if (finished) {
      callbacks.onDone(solved, snapshot())
      return
    }

    callbacks.onProgress(snapshot())

    // Even at tickMs 0 this yields to the event loop, which is what lets a
    // 'cancel' message actually arrive.
    await delay(tickMs)
  }
}
