import { computed, onScopeDispose, shallowRef } from 'vue'
import type { Board, Difficulty } from '../core/types'
import type { SudokuClient } from '../workers/client-types'
import type { SolveProgress, SolveSpeed } from '../workers/protocol'
import { useRafCoalesced } from './useRafCoalesced'

export type SolverStatus = 'idle' | 'solving' | 'solved' | 'failed' | 'cancelled' | 'error'

/**
 * The actual `SudokuClient` (which wraps a Web Worker) is created by the
 * consuming app, not here — Vite only bundles `new Worker(new URL(...))`
 * correctly when it lives in the final app's own build. This composable just
 * drives whatever client it's handed.
 */
export function useSolver(createClient: () => SudokuClient) {
  const client = createClient()

  // One coalesced object rather than a ref per field: the board, step count
  // and depth all describe the same instant, so committing them together
  // keeps them consistent instead of tearing across frames.
  const progress = useRafCoalesced<SolveProgress | null>(null)

  const status = shallowRef<SolverStatus>('idle')
  const errorMessage = shallowRef<string | null>(null)
  const activeRequestId = shallowRef<number | null>(null)

  const board = computed(() => progress.value.value?.board ?? null)
  const steps = computed(() => progress.value.value?.steps ?? 0)
  const backtracks = computed(() => progress.value.value?.backtracks ?? 0)
  const depth = computed(() => progress.value.value?.depth ?? 0)
  const elapsedMs = computed(() => progress.value.value?.elapsedMs ?? 0)
  const isSolving = computed(() => status.value === 'solving')

  const stepsPerSecond = computed(() => {
    const current = progress.value.value
    if (!current || current.elapsedMs <= 0) return 0
    return Math.round((current.steps / current.elapsedMs) * 1000)
  })

  function finish(next: SolverStatus, final: SolveProgress | null): void {
    if (final) progress.push(final)
    // Terminal event: bypass the frame wait so the last state is never lost.
    progress.flush()
    status.value = next
    activeRequestId.value = null
  }

  function solve(input: Board, speed: SolveSpeed = 'fast'): void {
    cancel()

    status.value = 'solving'
    errorMessage.value = null
    progress.push(null)
    progress.flush()

    activeRequestId.value = client.solve(input, speed, {
      onProgress: (next) => progress.push(next),
      onSolved: (final) => finish('solved', final),
      onFailed: (final) => finish('failed', final),
      onCancelled: () => finish('cancelled', null),
      onError: (message) => {
        errorMessage.value = message
        finish('error', null)
      },
    })
  }

  function cancel(): void {
    if (activeRequestId.value === null) return
    client.cancel(activeRequestId.value)
    activeRequestId.value = null
  }

  /**
   * Drops the last run's results and returns to idle.
   *
   * cancel() alone is not enough: once a run has finished there is no active
   * request to cancel, so the final board would linger and be rendered over
   * whatever puzzle comes next.
   */
  function reset(): void {
    cancel()
    progress.push(null)
    progress.flush()
    status.value = 'idle'
    errorMessage.value = null
  }

  function generate(difficulty: Difficulty) {
    return client.generate(difficulty)
  }

  onScopeDispose(() => {
    client.dispose()
  })

  return {
    board,
    steps,
    backtracks,
    depth,
    elapsedMs,
    stepsPerSecond,
    status,
    errorMessage,
    isSolving,
    solve,
    cancel,
    reset,
    generate,
  }
}
