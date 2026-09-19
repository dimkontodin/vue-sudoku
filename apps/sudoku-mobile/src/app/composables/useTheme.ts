import { shallowRef } from 'vue'
import { isVersionedObject, readJson, writeJson } from '@vue-sudoku/sudoku-core'

/**
 * Light/dark palette selection.
 *
 * Ionic's `dark.system.css` follows the OS and offers no way to override it,
 * which is the right default but the wrong *only* option — a player reading in
 * bed wants dark at noon. This swaps to `dark.class.css` and owns the class, so
 * 'system' reproduces the old behaviour exactly and the other two win over it.
 *
 * Shaped like useHaptics on purpose: same storage helpers, same module-level
 * singleton, because two copies would drift the moment one wrote to storage.
 */

const STORAGE_KEY = 'vue-sudoku:theme'
const VERSION = 1

/** Ionic's own class name for the dark palette — see @ionic/vue/css/palettes/dark.class.css. */
const DARK_CLASS = 'ion-palette-dark'

export const THEME_CHOICES = ['system', 'light', 'dark'] as const
export type ThemeChoice = (typeof THEME_CHOICES)[number]

interface ThemePref {
  v: number
  choice: ThemeChoice
}

function isThemePref(value: unknown): value is ThemePref {
  return (
    isVersionedObject(value) &&
    THEME_CHOICES.includes((value as ThemePref).choice as (typeof THEME_CHOICES)[number])
  )
}

let shared: ReturnType<typeof create> | null = null

function create() {
  const choice = shallowRef<ThemeChoice>(
    readJson(STORAGE_KEY, VERSION, isThemePref)?.choice ?? 'system',
  )
  const isDark = shallowRef(false)

  // Held so 'system' keeps tracking a live OS change while the app is open,
  // which is the whole point of the option.
  const query =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null

  function resolve(): boolean {
    if (choice.value === 'dark') return true
    if (choice.value === 'light') return false
    return query?.matches ?? false
  }

  function apply(): void {
    isDark.value = resolve()
    document.documentElement.classList.toggle(DARK_CLASS, isDark.value)
  }

  function set(next: ThemeChoice): void {
    choice.value = next
    writeJson<ThemePref>(STORAGE_KEY, { v: VERSION, choice: next })
    apply()
  }

  query?.addEventListener('change', () => {
    if (choice.value === 'system') apply()
  })

  apply()

  return { choice, isDark, set }
}

export function useTheme() {
  shared ??= create()
  return shared
}

export type ThemeControls = ReturnType<typeof useTheme>
