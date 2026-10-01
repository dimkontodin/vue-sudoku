import { computed, shallowRef } from 'vue'
import { isVersionedObject, readJson, writeJson } from '../utils/storage'

/**
 * Standing choices about how the game behaves, as opposed to one-shot actions
 * like restart or fill notes. They persist across reloads and are shared by the
 * web and mobile apps, so both treat a wrong digit the same way.
 *
 * A shared singleton over the storage helpers: every screen that asks gets the
 * same refs, so flipping a switch on Settings is seen by the board at once.
 */

const STORAGE_KEY = 'vue-sudoku:gameplay'
const VERSION = 1

interface GameplayPrefs {
  v: number
  autoCheck: boolean
  showMistakes: boolean
}

function isGameplayPrefs(value: unknown): value is GameplayPrefs {
  return (
    isVersionedObject(value) &&
    typeof (value as GameplayPrefs).autoCheck === 'boolean' &&
    typeof (value as GameplayPrefs).showMistakes === 'boolean'
  )
}

let shared: ReturnType<typeof create> | null = null

function create() {
  const saved = readJson(STORAGE_KEY, VERSION, isGameplayPrefs)

  // Off by default: unasked-for feedback reveals every wrong digit the instant
  // it is entered, which is a different game from the one most players want.
  const autoCheck = shallowRef(saved?.autoCheck ?? false)

  // Also off by default, and for a subtler reason. The mistakes counter is a
  // spoiler channel in its own right: with highlighting off the board says
  // nothing, but a counter ticking up the moment a digit lands still tells the
  // player *which* digit was wrong. Hints used carries no such signal, so that
  // stays on screen unconditionally.
  const showMistakes = shallowRef(saved?.showMistakes ?? false)

  function persist(): void {
    writeJson<GameplayPrefs>(STORAGE_KEY, {
      v: VERSION,
      autoCheck: autoCheck.value,
      showMistakes: showMistakes.value,
    })
  }

  function setAutoCheck(enabled: boolean): void {
    autoCheck.value = enabled
    persist()
  }

  function setShowMistakes(enabled: boolean): void {
    showMistakes.value = enabled
    persist()
  }

  /**
   * Auto-check already flags wrong digits on the board, so hiding the tally
   * behind it would withhold nothing — the counter only needs its own opt-in
   * while the board is staying quiet.
   */
  const mistakesVisible = computed(() => autoCheck.value || showMistakes.value)

  return { autoCheck, showMistakes, mistakesVisible, setAutoCheck, setShowMistakes }
}

export function useGameplayPrefs() {
  shared ??= create()
  return shared
}
