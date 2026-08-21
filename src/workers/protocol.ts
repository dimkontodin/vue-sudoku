import type { Difficulty } from '@/core/types'

// How fast the solver runs and, consequently, how often it can emit.
//
// `stepsPerTick` is the batch of solver steps executed between emissions and
// `tickMs` is the pause after each batch. Together they set both the visible
// speed and the message rate: one message per tick, so ~60/s at tickMs 16.
// Emitting per step instead would post millions of messages a second and the
// structured clone alone would dwarf the actual solving.
export type SolveSpeed = 'instant' | 'fast' | 'medium' | 'slow'

export const SPEED_PRESETS: Record<SolveSpeed, { stepsPerTick: number; tickMs: number }> = {
  // Solve as fast as possible; emit occasionally just to show progress.
  instant: { stepsPerTick: 50_000, tickMs: 0 },
  fast: { stepsPerTick: 250, tickMs: 16 },
  medium: { stepsPerTick: 25, tickMs: 16 },
  slow: { stepsPerTick: 2, tickMs: 40 },
}

export interface SolveProgress {
  /** Snapshot of the board as it currently stands mid-search. */
  board: Uint8Array
  /** Total solver steps (placements + backtracks) so far. */
  steps: number
  /** Backtracks so far — the interesting number when watching it work. */
  backtracks: number
  /** Current recursion depth. */
  depth: number
  elapsedMs: number
}

export type WorkerRequest =
  | { type: 'generate'; requestId: number; difficulty: Difficulty }
  | { type: 'solve'; requestId: number; board: Uint8Array; speed: SolveSpeed }
  | { type: 'cancel'; requestId: number }

export type WorkerResponse =
  | { type: 'generated'; requestId: number; puzzle: Uint8Array; solution: Uint8Array }
  | ({ type: 'progress'; requestId: number } & SolveProgress)
  | ({ type: 'solved'; requestId: number } & SolveProgress)
  | ({ type: 'failed'; requestId: number } & SolveProgress)
  | { type: 'cancelled'; requestId: number }
  | { type: 'error'; requestId: number; message: string }
