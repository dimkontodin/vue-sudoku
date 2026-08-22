import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useRafCoalesced } from '../useRafCoalesced'

// Manual animation-frame clock: callbacks only run when we say so, which is
// what makes "many pushes collapse into one commit" observable at all.
let queue: Map<number, FrameRequestCallback>
let nextHandle: number
let cancelled: number[]

function runFrame(): void {
  const pending = [...queue.entries()]
  queue.clear()
  for (const [, callback] of pending) callback(performance.now())
}

beforeEach(() => {
  queue = new Map()
  nextHandle = 1
  cancelled = []

  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const handle = nextHandle++
    queue.set(handle, callback)
    return handle
  })
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
    cancelled.push(handle)
    queue.delete(handle)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useRafCoalesced', () => {
  it('starts with the initial value and commits nothing on its own', () => {
    const scope = effectScope()
    scope.run(() => {
      const coalesced = useRafCoalesced(0)
      expect(coalesced.value.value).toBe(0)
      expect(queue.size).toBe(0)
    })
    scope.stop()
  })

  it('collapses many pushes in one frame into a single latest-value commit', () => {
    const scope = effectScope()
    scope.run(() => {
      const coalesced = useRafCoalesced(0)

      for (let i = 1; i <= 500; i++) coalesced.push(i)

      // Nothing has reached the ref yet, and only ONE frame was scheduled.
      expect(coalesced.value.value).toBe(0)
      expect(queue.size).toBe(1)

      runFrame()

      // Only the newest value survives; the other 499 are discarded.
      expect(coalesced.value.value).toBe(500)
    })
    scope.stop()
  })

  it('schedules a new frame for pushes that arrive after a commit', () => {
    const scope = effectScope()
    scope.run(() => {
      const coalesced = useRafCoalesced(0)

      coalesced.push(1)
      runFrame()
      expect(coalesced.value.value).toBe(1)

      coalesced.push(2)
      expect(queue.size).toBe(1)
      runFrame()
      expect(coalesced.value.value).toBe(2)
    })
    scope.stop()
  })

  it('flush() commits the pending value immediately without a frame', () => {
    const scope = effectScope()
    scope.run(() => {
      const coalesced = useRafCoalesced(0)

      coalesced.push(42)
      coalesced.flush()

      expect(coalesced.value.value).toBe(42)
      expect(queue.size).toBe(0)
    })
    scope.stop()
  })

  it('treats null as a real pending value rather than "nothing pending"', () => {
    const scope = effectScope()
    scope.run(() => {
      const coalesced = useRafCoalesced<number | null>(7)

      coalesced.push(null)
      runFrame()

      expect(coalesced.value.value).toBeNull()
    })
    scope.stop()
  })

  it('cancels a pending frame when its scope is disposed', () => {
    const scope = effectScope()
    let coalesced!: ReturnType<typeof useRafCoalesced<number>>
    scope.run(() => {
      coalesced = useRafCoalesced(0)
      coalesced.push(99)
    })

    expect(queue.size).toBe(1)
    scope.stop()

    expect(cancelled).toHaveLength(1)
    expect(queue.size).toBe(0)
    expect(coalesced.value.value).toBe(0)
  })
})
