import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useTimer } from '../useTimer'

// Fake timers drive both setInterval and Date.now, so elapsed time is exact
// rather than merely approximate.
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/** Runs `body` inside an effect scope and disposes it afterwards. */
function withScope(body: (timer: ReturnType<typeof useTimer>) => void): void {
  const scope = effectScope()
  scope.run(() => {
    // autoPause needs a document; these tests cover the clock itself.
    body(useTimer({ autoPauseOnHide: false }))
  })
  scope.stop()
}

describe('useTimer', () => {
  it('starts at zero and stopped', () => {
    withScope((timer) => {
      expect(timer.elapsedMs.value).toBe(0)
      expect(timer.isRunning.value).toBe(false)
      expect(timer.formatted.value).toBe('0:00')
    })
  })

  it('accumulates while running', () => {
    withScope((timer) => {
      timer.start()
      vi.advanceTimersByTime(3000)

      expect(timer.isRunning.value).toBe(true)
      expect(timer.elapsedMs.value).toBe(3000)
      expect(timer.formatted.value).toBe('0:03')
    })
  })

  it('stops accumulating once paused', () => {
    withScope((timer) => {
      timer.start()
      vi.advanceTimersByTime(2000)
      timer.pause()

      vi.advanceTimersByTime(5000)

      expect(timer.isRunning.value).toBe(false)
      expect(timer.elapsedMs.value).toBe(2000)
    })
  })

  it('banks time across pause/resume cycles', () => {
    withScope((timer) => {
      timer.start()
      vi.advanceTimersByTime(1000)
      timer.pause()
      vi.advanceTimersByTime(9000)
      timer.start()
      vi.advanceTimersByTime(500)

      expect(timer.elapsedMs.value).toBe(1500)
    })
  })

  it('ignores a redundant start or pause', () => {
    withScope((timer) => {
      timer.start()
      timer.start()
      vi.advanceTimersByTime(1000)
      expect(timer.elapsedMs.value).toBe(1000)

      timer.pause()
      timer.pause()
      expect(timer.elapsedMs.value).toBe(1000)
    })
  })

  it('reset() zeroes the clock but keeps running if it was', () => {
    withScope((timer) => {
      timer.start()
      vi.advanceTimersByTime(4000)
      timer.reset()

      expect(timer.elapsedMs.value).toBe(0)
      expect(timer.isRunning.value).toBe(true)

      vi.advanceTimersByTime(1000)
      expect(timer.elapsedMs.value).toBe(1000)
    })
  })

  it('reset() on a paused timer leaves it paused', () => {
    withScope((timer) => {
      timer.start()
      vi.advanceTimersByTime(4000)
      timer.pause()
      timer.reset()

      expect(timer.elapsedMs.value).toBe(0)
      expect(timer.isRunning.value).toBe(false)

      vi.advanceTimersByTime(1000)
      expect(timer.elapsedMs.value).toBe(0)
    })
  })

  it('toggle() flips between running and paused', () => {
    withScope((timer) => {
      timer.toggle()
      expect(timer.isRunning.value).toBe(true)
      timer.toggle()
      expect(timer.isRunning.value).toBe(false)
    })
  })

  it('setElapsed() restores a saved time and keeps counting from it', () => {
    withScope((timer) => {
      timer.setElapsed(60_000)
      expect(timer.formatted.value).toBe('1:00')

      timer.start()
      vi.advanceTimersByTime(5000)
      expect(timer.elapsedMs.value).toBe(65_000)
    })
  })

  it('formats minutes and zero-pads seconds', () => {
    withScope((timer) => {
      timer.setElapsed(9000)
      expect(timer.formatted.value).toBe('0:09')

      timer.setElapsed(125_000)
      expect(timer.formatted.value).toBe('2:05')

      timer.setElapsed(600_000)
      expect(timer.formatted.value).toBe('10:00')
    })
  })

  it('stops ticking when its scope is disposed', () => {
    const scope = effectScope()
    let timer!: ReturnType<typeof useTimer>
    scope.run(() => {
      timer = useTimer({ autoPauseOnHide: false })
      timer.start()
    })

    vi.advanceTimersByTime(1000)
    expect(timer.elapsedMs.value).toBe(1000)

    scope.stop()
    vi.advanceTimersByTime(5000)

    // The interval is gone, so the ref no longer refreshes.
    expect(timer.elapsedMs.value).toBe(1000)
  })
})
