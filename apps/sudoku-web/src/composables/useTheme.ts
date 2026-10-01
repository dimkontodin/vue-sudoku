import { shallowRef } from 'vue'
import { isVersionedObject, readJson, writeJson } from '@vue-sudoku/sudoku-core'

/**
 * Light/dark selection that can override the OS.
 *
 * 'system' leaves `data-theme` off the root element, so main.scss falls back to
 * `prefers-color-scheme` exactly as before; 'light' and 'dark' set it, and the
 * stylesheet lets them win. Same storage key and choices as the mobile app's
 * useTheme, which swaps an Ionic palette class instead.
 *
 * A shared singleton: two copies would drift the moment one wrote to storage.
 */

const STORAGE_KEY = 'vue-sudoku:theme'
const VERSION = 1

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

  function apply(): void {
    const root = document.documentElement
    if (choice.value === 'system') delete root.dataset.theme
    else root.dataset.theme = choice.value
  }

  function set(next: ThemeChoice): void {
    choice.value = next
    writeJson<ThemePref>(STORAGE_KEY, { v: VERSION, choice: next })
    apply()
  }

  apply()

  return { choice, set }
}

export function useTheme() {
  shared ??= create()
  return shared
}
