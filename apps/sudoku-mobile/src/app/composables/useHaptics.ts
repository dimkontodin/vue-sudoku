import { shallowRef } from 'vue'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { isVersionedObject, readJson, writeJson } from '@vue-sudoku/sudoku-core'

/**
 * Physical feedback for board input. Three layers, because the app runs in three
 * places: the Capacitor plugin on a device, `navigator.vibrate` in an Android
 * browser, and nothing at all under `nx serve` on a desktop or in Playwright.
 *
 * Every call is fire-and-forget inside a try/catch — feedback is a nicety, and a
 * missing plugin or a permissions refusal must never stop the player entering a
 * digit.
 */

const STORAGE_KEY = 'vue-sudoku:haptics'
const VERSION = 1

interface HapticsPref {
  v: number
  enabled: boolean
}

function isHapticsPref(value: unknown): value is HapticsPref {
  return isVersionedObject(value) && typeof (value as HapticsPref).enabled === 'boolean'
}

/** Vibration lengths in ms for the browser fallback, roughly matching the native styles. */
const WEB_PATTERNS = {
  light: 12,
  warning: [24, 40, 24],
  success: [12, 40, 24],
} as const

let shared: ReturnType<typeof create> | null = null

function create() {
  const isEnabled = shallowRef(readJson(STORAGE_KEY, VERSION, isHapticsPref)?.enabled ?? true)
  const isNative = Capacitor.isNativePlatform()

  function setEnabled(enabled: boolean): void {
    isEnabled.value = enabled
    writeJson<HapticsPref>(STORAGE_KEY, { v: VERSION, enabled })
  }

  function toggle(): void {
    setEnabled(!isEnabled.value)
  }

  function vibrate(pattern: number | readonly number[]): void {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
    try {
      navigator.vibrate(pattern as number | number[])
    } catch {
      // Blocked by the browser, or the page is not visible. Nothing to do.
    }
  }

  function run(native: () => Promise<unknown>, web: number | readonly number[]): void {
    if (!isEnabled.value) return

    if (!isNative) {
      vibrate(web)
      return
    }

    try {
      void native().catch(() => {
        // Plugin present but the platform refused — silently do without.
      })
    } catch {
      // Plugin missing entirely (web build that skipped `cap sync`).
    }
  }

  /** A digit landed, a note toggled, or a long-press just crossed its threshold. */
  function tick(): void {
    run(() => Haptics.impact({ style: ImpactStyle.Light }), WEB_PATTERNS.light)
  }

  /** A wrong digit went in. */
  function warn(): void {
    run(() => Haptics.notification({ type: NotificationType.Warning }), WEB_PATTERNS.warning)
  }

  /** The puzzle is solved. */
  function succeed(): void {
    run(() => Haptics.notification({ type: NotificationType.Success }), WEB_PATTERNS.success)
  }

  return { isEnabled, setEnabled, toggle, tick, warn, succeed }
}

/**
 * Shared across callers: the on/off preference is app-wide, and two independent
 * copies would drift apart the moment one of them wrote to storage.
 */
export function useHaptics() {
  shared ??= create()
  return shared
}

export type HapticsControls = ReturnType<typeof useHaptics>
