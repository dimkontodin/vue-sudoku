import { computed, onScopeDispose, shallowRef } from 'vue'

export interface UseTimerOptions {
  /** Pause automatically when the tab goes into the background. */
  autoPauseOnHide?: boolean
  /** How often the elapsed ref refreshes, in ms. */
  tickMs?: number
}

function formatDuration(totalMs: number): string {
  const totalSeconds = Math.floor(totalMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * Elapsed-time counter with start/pause/reset.
 *
 * Elapsed time is derived from wall-clock timestamps rather than by counting
 * ticks, so a throttled or delayed interval cannot make the clock drift — the
 * interval only decides how often the ref refreshes, never what it holds.
 */
export function useTimer(options: UseTimerOptions = {}) {
  const { autoPauseOnHide = true, tickMs = 250 } = options

  const elapsedMs = shallowRef(0)
  const isRunning = shallowRef(false)

  // Time banked from previous runs, plus when the current run started.
  let accumulatedMs = 0
  let startedAt: number | null = null
  let intervalId: ReturnType<typeof setInterval> | null = null

  const formatted = computed(() => formatDuration(elapsedMs.value))

  function sync(): void {
    elapsedMs.value = startedAt != null ? accumulatedMs + (Date.now() - startedAt) : accumulatedMs
  }

  function stopTicking(): void {
    if (intervalId === null) return
    clearInterval(intervalId)
    intervalId = null
  }

  function start(): void {
    if (isRunning.value) return
    startedAt = Date.now()
    isRunning.value = true
    stopTicking()
    intervalId = setInterval(sync, tickMs)
    sync()
  }

  function pause(): void {
    if (!isRunning.value) return
    // Bank the current run before dropping the start marker.
    if (startedAt !== null) accumulatedMs += Date.now() - startedAt
    startedAt = null
    isRunning.value = false
    stopTicking()
    sync()
  }

  function reset(): void {
    const wasRunning = isRunning.value
    stopTicking()
    accumulatedMs = 0
    startedAt = wasRunning ? Date.now() : null
    if (wasRunning) intervalId = setInterval(sync, tickMs)
    sync()
  }

  function toggle(): void {
    if (isRunning.value) pause()
    else start()
  }

  /** Restore a previously saved elapsed time (used when reloading a game). */
  function setElapsed(ms: number): void {
    accumulatedMs = Math.max(0, ms)
    startedAt = isRunning.value ? Date.now() : null
    sync()
  }

  // Auto-pause on tab hide. Guarded so the composable still works in a
  // non-DOM environment (node tests, SSR).
  let detachVisibility: (() => void) | null = null

  if (autoPauseOnHide && typeof document !== 'undefined') {
    // Resume only if we were the one who paused it, so an explicit pause
    // survives the user tabbing away and back.
    let pausedByHide = false

    const onVisibilityChange = (): void => {
      if (document.hidden) {
        if (!isRunning.value) return
        pausedByHide = true
        pause()
      } else if (pausedByHide) {
        pausedByHide = false
        start()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    detachVisibility = () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }

  onScopeDispose(() => {
    stopTicking()
    detachVisibility?.()
  })

  return { elapsedMs, isRunning, formatted, start, pause, reset, toggle, setElapsed }
}

export type Timer = ReturnType<typeof useTimer>
