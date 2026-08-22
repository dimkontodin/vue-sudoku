import { createFallbackSudokuClient } from '@vue-sudoku/sudoku-core'
import type { Puzzle, SudokuClient, WorkerRequest, WorkerResponse } from '@vue-sudoku/sudoku-core'

function createWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null

  try {
    // This exact `new URL(..., import.meta.url)` form is what lets Vite find
    // and bundle the worker — a computed path would not be statically analysable.
    return new Worker(new URL('./sudoku.worker.ts', import.meta.url), { type: 'module' })
  } catch {
    return null
  }
}

export function createSudokuClient(): SudokuClient {
  const worker = createWorker()
  if (!worker) return createFallbackSudokuClient()

  let nextRequestId = 1
  const solveCallbacks = new Map<number, Parameters<SudokuClient['solve']>[2]>()
  const generateResolvers = new Map<number, (puzzle: Puzzle) => void>()
  const generateRejecters = new Map<number, (error: Error) => void>()

  function settleSolve(
    requestId: number,
    run: (callbacks: Parameters<SudokuClient['solve']>[2]) => void,
  ): void {
    const callbacks = solveCallbacks.get(requestId)
    if (!callbacks) return
    solveCallbacks.delete(requestId)
    run(callbacks)
  }

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data

    switch (message.type) {
      case 'generated': {
        generateResolvers.get(message.requestId)?.({
          puzzle: message.puzzle,
          solution: message.solution,
        })
        generateResolvers.delete(message.requestId)
        generateRejecters.delete(message.requestId)
        return
      }
      case 'progress':
        solveCallbacks.get(message.requestId)?.onProgress?.(message)
        return
      case 'solved':
        settleSolve(message.requestId, (cb) => cb.onSolved?.(message))
        return
      case 'failed':
        settleSolve(message.requestId, (cb) => cb.onFailed?.(message))
        return
      case 'cancelled':
        settleSolve(message.requestId, (cb) => cb.onCancelled?.())
        return
      case 'error': {
        generateRejecters.get(message.requestId)?.(new Error(message.message))
        generateRejecters.delete(message.requestId)
        generateResolvers.delete(message.requestId)
        settleSolve(message.requestId, (cb) => cb.onError?.(message.message))
        return
      }
    }
  }

  function send(request: WorkerRequest): void {
    worker?.postMessage(request)
  }

  return {
    generate(difficulty) {
      const requestId = nextRequestId++

      return new Promise<Puzzle>((resolve, reject) => {
        generateResolvers.set(requestId, resolve)
        generateRejecters.set(requestId, reject)
        send({ type: 'generate', requestId, difficulty })
      })
    },

    solve(board, speed, callbacks) {
      const requestId = nextRequestId++
      solveCallbacks.set(requestId, callbacks)
      send({ type: 'solve', requestId, board, speed })
      return requestId
    },

    cancel(requestId) {
      send({ type: 'cancel', requestId })
    },

    dispose() {
      worker?.terminate()
      solveCallbacks.clear()
      generateResolvers.clear()
      generateRejecters.clear()
    },
  }
}
