import { generate, runSolve } from '@vue-sudoku/sudoku-core'
import type { WorkerRequest, WorkerResponse } from '@vue-sudoku/sudoku-core'

// The project compiles against the DOM lib, where `self` is a Window. Pulling
// in the `webworker` lib to get DedicatedWorkerGlobalScope would collide with
// DOM's declarations, so describe just the surface this file uses — which has
// the bonus of type-checking every message against the protocol.
interface WorkerScope {
  postMessage: (message: WorkerResponse) => void
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
}

const ctx = self as unknown as WorkerScope

// Request ids the main thread has asked us to abandon. runSolve() checks this
// between batches, which is the only reason it pauses at all in instant mode.
const cancelled = new Set<number>()

function post(message: WorkerResponse): void {
  ctx.postMessage(message)
}

async function handle(request: WorkerRequest): Promise<void> {
  switch (request.type) {
    case 'cancel':
      cancelled.add(request.requestId)
      return

    case 'generate': {
      const { puzzle, solution } = generate(request.difficulty)
      post({
        type: 'generated',
        requestId: request.requestId,
        puzzle,
        solution,
      })
      return
    }

    case 'solve': {
      const { requestId, speed } = request
      // Copy the incoming board: structured clone already gave us our own
      // buffer, but runSolve mutates it and we want that to be explicit.
      const board = Uint8Array.from(request.board)

      await runSolve(board, speed, {
        isCancelled: () => cancelled.has(requestId),
        onCancelled: () => {
          cancelled.delete(requestId)
          post({
            type: 'cancelled',
            requestId,
          })
        },
        onProgress: (progress) =>
          post({
            type: 'progress',
            requestId,
            ...progress,
          }),

        onDone: (solved, progress) =>
          post({
            type: solved ? 'solved' : 'failed',
            requestId,
            ...progress,
          }),
      })
      return
    }
  }
}

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data

  handle(request).catch((error: unknown) => {
    post({
      type: 'error',
      requestId: request.requestId,
      message: error instanceof Error ? error.message : String(error),
    })
  })
}
