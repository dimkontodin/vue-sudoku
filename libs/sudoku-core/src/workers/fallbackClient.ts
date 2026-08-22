import { generate } from '../core/generator'
import { runSolve } from './solveRunner'
import type { SolveCallbacks, SudokuClient } from './client-types'

/**
 * A `SudokuClient` that never talks to a Worker — runs solves inline on the
 * calling thread, still yielding between batches so the UI keeps painting.
 * Consuming apps fall back to this when `Worker` is unavailable, and it's
 * also exactly what these composables run against under Vitest (no `Worker`
 * in the node/jsdom test environments either).
 */
export function createFallbackSudokuClient(): SudokuClient {
  let nextRequestId = 1
  const solveCallbacks = new Map<number, SolveCallbacks>()
  const locallyCancelled = new Set<number>()

  function settleSolve(requestId: number, run: (callbacks: SolveCallbacks) => void): void {
    const callbacks = solveCallbacks.get(requestId)
    if (!callbacks) return
    solveCallbacks.delete(requestId)
    run(callbacks)
  }

  return {
    generate(difficulty) {
      return Promise.resolve(generate(difficulty))
    },

    solve(board, speed, callbacks) {
      const requestId = nextRequestId++
      solveCallbacks.set(requestId, callbacks)

      // Deferred to a microtask so callbacks can never fire before solve()
      // has returned its id. A fast solve finishes inside the first batch,
      // before runSolve hits any await, and a caller storing the returned id
      // would otherwise overwrite the null that completion just wrote.
      void Promise.resolve()
        .then(() =>
          runSolve(Uint8Array.from(board), speed, {
            isCancelled: () => locallyCancelled.has(requestId),
            onCancelled: () => {
              locallyCancelled.delete(requestId)
              settleSolve(requestId, (cb) => cb.onCancelled?.())
            },
            onProgress: (progress) => solveCallbacks.get(requestId)?.onProgress?.(progress),
            onDone: (solved, progress) =>
              settleSolve(requestId, (cb) => {
                const callbackEmitter = solved ? cb.onSolved : cb.onFailed
                return callbackEmitter?.(progress)
              }),
          }),
        )
        .catch((error: unknown) => {
          settleSolve(requestId, (cb) =>
            cb.onError?.(error instanceof Error ? error.message : String(error)),
          )
        })

      return requestId
    },

    cancel(requestId) {
      locallyCancelled.add(requestId)
    },

    dispose() {
      solveCallbacks.clear()
      locallyCancelled.clear()
    },
  }
}
