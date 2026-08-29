/**
 * Tap vs. long-press over one set of pointer handlers, for elements rendered in
 * a `v-for` — every handler takes the payload (a digit, a cell index) so a
 * single composable instance serves all 81 cells or all 9 keys.
 *
 * Tap fires on `click`, not on `pointerup`, deliberately: the cells and pad keys
 * are real `<button>`s, and a keyboard Enter/Space produces a `click` with no
 * pointer events at all. Binding tap to `pointerup` would silently drop keyboard
 * activation — and the `aria-pressed` board is the one thing we do not want to
 * break. A long-press instead raises a flag that swallows the `click` that the
 * browser sends afterwards.
 */
export interface LongPressHandlers<T> {
  tap: (payload: T) => void
  longPress: (payload: T) => void
}

export interface LongPressOptions {
  /** How long the press must be held, in ms. */
  delay?: number
  /** Movement past this many px cancels the press — it was a scroll, not a hold. */
  moveTolerance?: number
}

export function useLongPress<T>(handlers: LongPressHandlers<T>, options: LongPressOptions = {}) {
  const { delay = 400, moveTolerance = 10 } = options

  let timer: ReturnType<typeof setTimeout> | null = null
  let originX = 0
  let originY = 0
  // Set when a long-press fired, so the trailing `click` is ignored. Cleared on
  // the next `pointerdown` rather than on a timer: if the finger lifts outside
  // the element no `click` ever arrives, and a flag left standing would eat the
  // user's next real tap.
  let swallowClick = false

  function cancel(): void {
    if (timer === null) return
    clearTimeout(timer)
    timer = null
  }

  function onPointerdown(event: PointerEvent, payload: T): void {
    // Ignore secondary buttons; touch and pen always report button 0.
    if (event.button !== 0) return

    swallowClick = false
    originX = event.clientX
    originY = event.clientY

    // Keep receiving pointermove even once the finger slides off the key, so the
    // tolerance check below actually sees the drag.
    const target = event.currentTarget
    if (target instanceof Element) {
      try {
        target.setPointerCapture(event.pointerId)
      } catch {
        // Pointer already released, or capture unsupported — the timer still works.
      }
    }

    cancel()
    timer = setTimeout(() => {
      timer = null
      swallowClick = true
      handlers.longPress(payload)
    }, delay)
  }

  function onPointermove(event: PointerEvent): void {
    if (timer === null) return
    const dx = event.clientX - originX
    const dy = event.clientY - originY
    if (Math.hypot(dx, dy) > moveTolerance) cancel()
  }

  function onPointerup(): void {
    cancel()
  }

  function onPointercancel(): void {
    cancel()
    swallowClick = false
  }

  function onClick(payload: T): void {
    if (swallowClick) {
      swallowClick = false
      return
    }
    handlers.tap(payload)
  }

  /** Stops Android/iOS from opening their own long-press menu over the element. */
  function onContextmenu(event: Event): void {
    event.preventDefault()
  }

  return { onPointerdown, onPointermove, onPointerup, onPointercancel, onClick, onContextmenu }
}

export type LongPressBindings<T> = ReturnType<typeof useLongPress<T>>
