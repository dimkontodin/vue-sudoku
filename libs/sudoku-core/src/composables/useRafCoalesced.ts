import { onScopeDispose, readonly, shallowRef, type Ref } from 'vue'

export interface RafCoalesced<T> {
  /** Updates at most once per animation frame, always with the latest value. */
  value: Readonly<Ref<T>>
  /** Feed a new value in. Cheap — safe to call thousands of times a second. */
  push: (next: T) => void
  /** Apply any pending value immediately (for terminal events). */
  flush: () => void
}

/**
 * Keeps the newest pushed value and commits it to a ref once per animation
 * frame, discarding anything superseded in between.
 *
 * This is the Vue-shaped equivalent of RxJS's
 * `source$.pipe(auditTime(0, animationFrameScheduler))` — the rest of that
 * mental model maps over too:
 *
 *   RxJS                          | here
 *   ------------------------------|------------------------------------------
 *   Observable                    | worker messages / any callback source
 *   BehaviorSubject               | ref / shallowRef
 *   subscribe()                   | push() from the message handler
 *   auditTime(0, animationFrame)  | this composable
 *   map()                         | computed()
 *   takeUntil(destroy$)           | onScopeDispose()
 *
 * Why a frame rather than a fixed interval: the screen cannot show more than
 * one state per frame, so any update beyond that is work thrown away. Pushing
 * 5,000 progress messages a second into a ref would run Vue's reactivity and
 * re-render 5,000 times to paint ~60 of them.
 */
export function useRafCoalesced<T>(initial: T): RafCoalesced<T> {
  const value = shallowRef(initial) as Ref<T>

  // Boxed so that `undefined`/`null` are legitimate pending values rather
  // than being mistaken for "nothing pending".
  let pending: { value: T } | null = null
  let frame = 0

  function commit(): void {
    frame = 0
    if (!pending) return
    value.value = pending.value
    pending = null
  }

  function push(next: T): void {
    pending = { value: next }
    // A frame is already scheduled — the value we just overwrote never
    // reaches the UI, which is exactly the point.
    if (frame !== 0) return
    frame = requestAnimationFrame(commit)
  }

  function flush(): void {
    if (frame !== 0) cancelAnimationFrame(frame)
    commit()
  }

  onScopeDispose(() => {
    if (frame !== 0) cancelAnimationFrame(frame)
  })

  return { value: readonly(value) as Readonly<Ref<T>>, push, flush }
}
