import { computed, shallowRef } from 'vue'
import type { Difficulty } from '@/core/types'
import { isVersionedObject, readJson, removeKey, writeJson } from '@/utils/storage'

const STORAGE_KEY = 'vue-sudoku:stats'
const VERSION = 1
const MAX_RECORDS = 500

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert']

export interface WinRecord {
  difficulty: Difficulty
  timeMs: number
  hintsUsed: number
  mistakes: number
  /** ISO timestamp — absolute, so it survives being read on another day. */
  date: string
}

interface StatsData {
  v: number
  started: Record<Difficulty, number>
  wins: WinRecord[]
}

export interface DifficultySummary {
  difficulty: Difficulty
  started: number
  won: number
  /** null when nothing has been won at this difficulty yet. */
  bestMs: number | null
  averageMs: number | null
  winRate: number
}

/**
 * Wins over games started.
 *
 * The denominator is max(started, won) rather than started alone: a win can
 * outlive its start count — finish a restored game after clearing stats and
 * you get a win with nothing to divide by. Taking the max keeps the rate at
 * or below 1 by construction instead of clamping a nonsense value, and avoids
 * reporting "2 wins, 0%".
 */
function rate(started: number, won: number): number {
  const denominator = Math.max(started, won)
  return denominator > 0 ? won / denominator : 0
}

function emptyStarted(): Record<Difficulty, number> {
  return { easy: 0, medium: 0, hard: 0, expert: 0 }
}

function isStatsData(value: unknown): value is StatsData {
  if (!isVersionedObject(value)) return false
  const data = value as Partial<StatsData>

  return (
    typeof data.started === 'object' &&
    data.started !== null &&
    Array.isArray(data.wins) &&
    data.wins.every(
      (win: unknown) =>
        typeof win === 'object' &&
        win !== null &&
        typeof (win as WinRecord).timeMs === 'number' &&
        DIFFICULTIES.includes((win as WinRecord).difficulty),
    )
  )
}

function load(): StatsData {
  const stored = readJson(STORAGE_KEY, VERSION, isStatsData)
  if (!stored) return { v: VERSION, started: emptyStarted(), wins: [] }

  // Merge over a fresh record so a difficulty added later cannot read undefined.
  return {
    v: VERSION,
    started: { ...emptyStarted(), ...stored.started },
    wins: stored.wins,
  }
}

export function useStats() {
  const data = shallowRef<StatsData>(load())

  function persist(next: StatsData): void {
    data.value = next
    writeJson(STORAGE_KEY, next)
  }

  function recordStart(difficulty: Difficulty): void {
    persist({
      ...data.value,
      started: { ...data.value.started, [difficulty]: (data.value.started[difficulty] ?? 0) + 1 },
    })
  }

  function recordWin(record: WinRecord): void {
    // Newest first, capped — an unbounded array would grow forever in storage.
    const wins = [record, ...data.value.wins].slice(0, MAX_RECORDS)
    persist({ ...data.value, wins })
  }

  const summaries = computed<DifficultySummary[]>(() =>
    DIFFICULTIES.map((difficulty) => {
      const wins = data.value.wins.filter((win) => win.difficulty === difficulty)
      const started = data.value.started[difficulty] ?? 0
      const times = wins.map((win) => win.timeMs)

      return {
        difficulty,
        started,
        won: wins.length,
        bestMs: times.length ? Math.min(...times) : null,
        averageMs: times.length
          ? Math.round(times.reduce((total, time) => total + time, 0) / times.length)
          : null,
        winRate: rate(started, wins.length),
      }
    }),
  )

  const totals = computed(() => {
    const started = DIFFICULTIES.reduce(
      (total, difficulty) => total + (data.value.started[difficulty] ?? 0),
      0,
    )
    const won = data.value.wins.length
    return { started, won, winRate: rate(started, won) }
  })

  const recentWins = computed(() => data.value.wins.slice(0, 10))

  function clear(): void {
    removeKey(STORAGE_KEY)
    data.value = { v: VERSION, started: emptyStarted(), wins: [] }
  }

  return { summaries, totals, recentWins, recordStart, recordWin, clear }
}

/** mm:ss for a duration in milliseconds. */
export function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}
