import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLongPress } from '../useLongPress'

/**
 * A stand-in for the `<button>` the handlers are bound to. jsdom's PointerEvent
 * support is patchy, so the tests hand the composable plain objects shaped like
 * the two fields it actually reads plus the currentTarget it captures on.
 */
function pointer(x = 0, y = 0, button = 0) {
  return {
    button,
    pointerId: 1,
    clientX: x,
    clientY: y,
    currentTarget: null,
  } as unknown as PointerEvent
}

function setup(delay = 400) {
  const tap = vi.fn()
  const longPress = vi.fn()
  const press = useLongPress<number>({ tap, longPress }, { delay })
  return { tap, longPress, press }
}

describe('useLongPress', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('a quick press fires tap, not longPress', () => {
    const { tap, longPress, press } = setup()

    press.onPointerdown(pointer(), 7)
    vi.advanceTimersByTime(100)
    press.onPointerup()
    press.onClick(7)

    expect(tap).toHaveBeenCalledWith(7)
    expect(longPress).not.toHaveBeenCalled()
  })

  it('holding past the threshold fires longPress and swallows the click', () => {
    const { tap, longPress, press } = setup()

    press.onPointerdown(pointer(), 7)
    vi.advanceTimersByTime(400)

    expect(longPress).toHaveBeenCalledWith(7)

    press.onPointerup()
    press.onClick(7)
    expect(tap).not.toHaveBeenCalled()
  })

  it('only swallows one click, so the next tap still lands', () => {
    const { tap, press } = setup()

    press.onPointerdown(pointer(), 7)
    vi.advanceTimersByTime(400)
    press.onPointerup()
    press.onClick(7)

    press.onPointerdown(pointer(), 7)
    vi.advanceTimersByTime(50)
    press.onPointerup()
    press.onClick(7)

    expect(tap).toHaveBeenCalledTimes(1)
    expect(tap).toHaveBeenCalledWith(7)
  })

  it('clears a stale swallow flag on the next pointerdown', () => {
    const { tap, press } = setup()

    // Long-press, then lift the finger outside the element: no click ever
    // arrives, so the flag would otherwise still be set.
    press.onPointerdown(pointer(), 7)
    vi.advanceTimersByTime(400)
    press.onPointerup()

    press.onPointerdown(pointer(), 7)
    vi.advanceTimersByTime(50)
    press.onPointerup()
    press.onClick(7)

    expect(tap).toHaveBeenCalledWith(7)
  })

  it('dragging past the tolerance cancels the press', () => {
    const { tap, longPress, press } = setup()

    press.onPointerdown(pointer(0, 0), 7)
    vi.advanceTimersByTime(100)
    press.onPointermove(pointer(0, 40))
    vi.advanceTimersByTime(400)

    expect(longPress).not.toHaveBeenCalled()

    // The click that follows a cancelled press is still a tap.
    press.onPointerup()
    press.onClick(7)
    expect(tap).toHaveBeenCalledWith(7)
  })

  it('tolerates a small wobble', () => {
    const { longPress, press } = setup()

    press.onPointerdown(pointer(0, 0), 7)
    press.onPointermove(pointer(3, 3))
    vi.advanceTimersByTime(400)

    expect(longPress).toHaveBeenCalledWith(7)
  })

  it('pointercancel aborts without firing anything', () => {
    const { tap, longPress, press } = setup()

    press.onPointerdown(pointer(), 7)
    vi.advanceTimersByTime(100)
    press.onPointercancel()
    vi.advanceTimersByTime(400)

    expect(longPress).not.toHaveBeenCalled()
    expect(tap).not.toHaveBeenCalled()
  })

  it('ignores non-primary buttons', () => {
    const { longPress, press } = setup()

    press.onPointerdown(pointer(0, 0, 2), 7)
    vi.advanceTimersByTime(400)

    expect(longPress).not.toHaveBeenCalled()
  })

  it('a keyboard click with no pointer events still taps', () => {
    const { tap, press } = setup()

    // This is why tap hangs off `click` rather than `pointerup`: Enter/Space on
    // a focused button produces a click and nothing else.
    press.onClick(7)

    expect(tap).toHaveBeenCalledWith(7)
  })

  it('preventDefault stops the platform context menu', () => {
    const { press } = setup()
    const event = { preventDefault: vi.fn() } as unknown as Event

    press.onContextmenu(event)

    expect(event.preventDefault).toHaveBeenCalled()
  })
})
