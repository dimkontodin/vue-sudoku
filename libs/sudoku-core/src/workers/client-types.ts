import type { Board, Difficulty, Puzzle } from '../core/types'
import type { SolveProgress, SolveSpeed } from './protocol'

export interface SolveCallbacks {
  onProgress?: (progress: SolveProgress) => void
  onSolved?: (progress: SolveProgress) => void
  onFailed?: (progress: SolveProgress) => void
  onCancelled?: () => void
  onError?: (message: string) => void
}

// The worker instantiation itself (`new Worker(new URL(...))`) must live in
// each consuming app, not here — Vite only statically detects and bundles
// that pattern in the final app's own build, not through a pre-built
// dependency. This type is the contract app-local sudokuClient.ts implements,
// so composables here can depend on the shape without depending on a worker.
export interface SudokuClient {
  generate: (difficulty: Difficulty) => Promise<Puzzle>
  /**
   * Start building a puzzle for `difficulty` in the background, so a later
   * generate() resolves immediately. A hint, not a request: clients without a
   * background thread may ignore it, which is why it is optional.
   */
  prefetch?: (difficulty: Difficulty) => void
  solve: (board: Board, speed: SolveSpeed, callbacks: SolveCallbacks) => number
  cancel: (requestId: number) => void
  dispose: () => void
}
