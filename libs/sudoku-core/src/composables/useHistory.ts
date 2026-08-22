import { computed, shallowRef, type ComputedRef, type Ref } from 'vue'

export interface UseHistoryOptions {
  /** Maximum entries to retain. Oldest are dropped first. */
  limit?: number
}

export interface UseHistory<T> {
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
  past: Ref<readonly T[]>
  future: Ref<readonly T[]>
  /** Record a new entry. Always discards the redo stack. */
  push: (entry: T) => void
  /** Pops the newest past entry and returns it, or undefined if empty. */
  undo: () => T | undefined
  /** Pops the newest future entry and returns it, or undefined if empty. */
  redo: () => T | undefined
  clear: () => void
}

/**
 * A generic undo/redo stack. It stores opaque entries and hands them back —
 * applying and reverting them is the caller's job, which is what keeps this
 * reusable for anything, not just a Sudoku board.
 *
 * Deliberately left as a plain composable rather than folded into a store:
 * every consumer wants its *own* independent history, so per-instance state
 * is the right model here (contrast with the shared game state in Phase 6).
 */
export function useHistory<T>(options: UseHistoryOptions = {}): UseHistory<T> {
  const { limit = 200 } = options

  // shallowRef + reassign: entries are treated as immutable snapshots, so
  // there is nothing to gain from deep reactivity on the arrays.
  const past = shallowRef<readonly T[]>([])
  const future = shallowRef<readonly T[]>([])

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  function push(entry: T): void {
    const next = [...past.value, entry]
    // Drop the oldest entries once past the limit so a long game cannot grow
    // memory without bound.
    past.value = next.length > limit ? next.slice(next.length - limit) : next
    // Any new action invalidates the redo branch.
    future.value = []
  }

  function undo(): T | undefined {
    const entry = past.value.at(-1)
    if (entry === undefined) return undefined

    past.value = past.value.slice(0, -1)
    future.value = [...future.value, entry]
    return entry
  }

  function redo(): T | undefined {
    const entry = future.value.at(-1)
    if (entry === undefined) return undefined

    future.value = future.value.slice(0, -1)
    past.value = [...past.value, entry]
    return entry
  }

  function clear(): void {
    past.value = []
    future.value = []
  }

  return { canUndo, canRedo, past, future, push, undo, redo, clear }
}
