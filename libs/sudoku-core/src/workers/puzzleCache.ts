import { generate, tryGenerate } from '../core/generator'
import type { Difficulty, Puzzle } from '../core/types'

/**
 * Keeps one ready-made puzzle per difficulty, generated in the background.
 *
 * Generating to an exact grade can take a few hundred milliseconds on a fast
 * machine and several seconds on a slow phone (hard is the slowest level). The
 * player spends minutes on each game, though, so the next puzzle is built while
 * they play and "New game" just hands it over. With that much time available,
 * the background run can keep going until it gets an exact hit instead of
 * settling for the easier fallback a foreground generate() has to accept when
 * its budget runs out.
 *
 * Meant to run inside the worker: the work is sliced and yields between
 * slices so solve and generate requests are not blocked behind it, but a
 * single dig inside a slice cannot be interrupted. That is fine off the main
 * thread and would be visible jank on it.
 */
export interface PuzzleCache {
  /**
   * The cached puzzle for `difficulty` if one is ready, otherwise a freshly
   * generated one. Either way, a refill for that difficulty is queued, so the
   * next request is served from the cache.
   */
  take: (difficulty: Difficulty) => Puzzle
  /** Queue a background fill for `difficulty` without taking anything. */
  prefetch: (difficulty: Difficulty) => void
  /** Whether a puzzle for `difficulty` is ready now. */
  has: (difficulty: Difficulty) => boolean
  /** Stops background work. Pending fills are dropped. */
  dispose: () => void
}

export interface PuzzleCacheOptions {
  /**
   * Work per slice before yielding, in milliseconds. Kept short so a request
   * that arrives mid-fill waits at most about one slice plus one dig.
   */
  sliceMs?: number
  /**
   * Total slice time to spend on one fill before settling for the best
   * fallback. Generous, because it runs while the player is busy anyway. It
   * only runs out on a very slow device that keeps missing an exact hit.
   */
  fillBudgetMs?: number
  /** How to yield between slices. Injectable for tests. */
  yieldToEvents?: () => Promise<void>
}

const DEFAULT_SLICE_MS = 50
const DEFAULT_FILL_BUDGET_MS = 20_000

function macrotask(): Promise<void> {
  // setTimeout rather than a microtask: only a macrotask boundary lets the
  // worker's message queue (the requests we are yielding for) run.
  return new Promise((resolve) => setTimeout(resolve, 0))
}

export function createPuzzleCache(options: PuzzleCacheOptions = {}): PuzzleCache {
  const {
    sliceMs = DEFAULT_SLICE_MS,
    fillBudgetMs = DEFAULT_FILL_BUDGET_MS,
    yieldToEvents = macrotask,
  } = options

  const ready = new Map<Difficulty, Puzzle>()
  // Difficulties waiting for a fill, in request order. One fill runs at a
  // time: filling all four at once would only make each of them slower.
  const queue: Difficulty[] = []
  let running = false
  let disposed = false

  async function fill(difficulty: Difficulty): Promise<void> {
    let spent = 0

    while (!disposed && spent < fillBudgetMs) {
      const start = performance.now()
      const puzzle = tryGenerate(difficulty, sliceMs)
      spent += performance.now() - start

      if (puzzle) {
        ready.set(difficulty, puzzle)
        return
      }
      await yieldToEvents()
    }

    // Out of budget without an exact hit. Cache the best effort rather than
    // nothing, so the next request is at least instant.
    if (!disposed) ready.set(difficulty, generate(difficulty, { timeBudgetMs: sliceMs }))
  }

  async function drain(): Promise<void> {
    if (running) return
    running = true
    try {
      // Yield first, so the request that queued this fill is answered before
      // any background work starts.
      await yieldToEvents()
      while (!disposed && queue.length > 0) {
        const difficulty = queue.shift()!
        if (!ready.has(difficulty)) await fill(difficulty)
      }
    } finally {
      running = false
    }
  }

  function prefetch(difficulty: Difficulty): void {
    if (disposed || ready.has(difficulty) || queue.includes(difficulty)) return
    queue.push(difficulty)
    void drain()
  }

  return {
    take(difficulty) {
      const cached = ready.get(difficulty)
      ready.delete(difficulty)
      const puzzle = cached ?? generate(difficulty)
      prefetch(difficulty)
      return puzzle
    },

    prefetch,

    has: (difficulty) => ready.has(difficulty),

    dispose() {
      disposed = true
      queue.length = 0
      ready.clear()
    },
  }
}
