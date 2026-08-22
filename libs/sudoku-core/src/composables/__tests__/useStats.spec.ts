// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import type { Difficulty } from '../../core/types'
import { formatMs, useStats, type WinRecord } from '../useStats'

function win(difficulty: Difficulty, timeMs: number, extra: Partial<WinRecord> = {}): WinRecord {
  return {
    difficulty,
    timeMs,
    hintsUsed: 0,
    mistakes: 0,
    date: new Date('2026-08-21T10:00:00Z').toISOString(),
    ...extra,
  }
}

const summaryFor = (stats: ReturnType<typeof useStats>, difficulty: Difficulty) =>
  stats.summaries.value.find((row) => row.difficulty === difficulty)!

beforeEach(() => {
  localStorage.clear()
})

describe('useStats', () => {
  it('starts empty', () => {
    const stats = useStats()
    expect(stats.totals.value).toEqual({ started: 0, won: 0, winRate: 0 })
    expect(stats.recentWins.value).toEqual([])
    expect(summaryFor(stats, 'easy').bestMs).toBeNull()
  })

  it('counts started games per difficulty', () => {
    const stats = useStats()
    stats.recordStart('easy')
    stats.recordStart('easy')
    stats.recordStart('hard')

    expect(summaryFor(stats, 'easy').started).toBe(2)
    expect(summaryFor(stats, 'hard').started).toBe(1)
    expect(stats.totals.value.started).toBe(3)
  })

  it('tracks best and average time', () => {
    const stats = useStats()
    stats.recordWin(win('easy', 90_000))
    stats.recordWin(win('easy', 30_000))
    stats.recordWin(win('easy', 60_000))

    const easy = summaryFor(stats, 'easy')
    expect(easy.won).toBe(3)
    expect(easy.bestMs).toBe(30_000)
    expect(easy.averageMs).toBe(60_000)
  })

  it('keeps difficulties separate', () => {
    const stats = useStats()
    stats.recordWin(win('easy', 10_000))
    stats.recordWin(win('expert', 500_000))

    expect(summaryFor(stats, 'easy').bestMs).toBe(10_000)
    expect(summaryFor(stats, 'expert').bestMs).toBe(500_000)
    expect(summaryFor(stats, 'medium').bestMs).toBeNull()
  })

  it('computes a win rate against started games', () => {
    const stats = useStats()
    stats.recordStart('easy')
    stats.recordStart('easy')
    stats.recordStart('easy')
    stats.recordWin(win('easy', 1000))

    expect(summaryFor(stats, 'easy').winRate).toBeCloseTo(1 / 3)
  })

  it('caps the win rate at 1 when wins outnumber recorded starts', () => {
    // Possible when a restored game is won after stats were cleared.
    const stats = useStats()
    stats.recordWin(win('easy', 1000))
    stats.recordWin(win('easy', 2000))

    expect(summaryFor(stats, 'easy').winRate).toBe(1)
    expect(stats.totals.value.winRate).toBe(1)
  })

  it('lists recent wins newest first, capped at 10', () => {
    const stats = useStats()
    for (let i = 1; i <= 12; i++) stats.recordWin(win('easy', i * 1000))

    expect(stats.recentWins.value).toHaveLength(10)
    expect(stats.recentWins.value[0]!.timeMs).toBe(12_000)
  })

  it('persists across instances', () => {
    const first = useStats()
    first.recordStart('medium')
    first.recordWin(win('medium', 45_000))

    const second = useStats()
    expect(summaryFor(second, 'medium').won).toBe(1)
    expect(summaryFor(second, 'medium').bestMs).toBe(45_000)
  })

  it('clear() empties everything, including storage', () => {
    const stats = useStats()
    stats.recordStart('easy')
    stats.recordWin(win('easy', 1000))
    stats.clear()

    expect(stats.totals.value.won).toBe(0)
    expect(useStats().totals.value.started).toBe(0)
  })

  it('ignores a corrupt payload rather than throwing', () => {
    localStorage.setItem('vue-sudoku:stats', '{ broken')
    expect(() => useStats()).not.toThrow()
    expect(useStats().totals.value.started).toBe(0)
  })

  it('fills in a difficulty missing from an older payload', () => {
    localStorage.setItem(
      'vue-sudoku:stats',
      JSON.stringify({ v: 1, started: { easy: 3 }, wins: [] }),
    )

    const stats = useStats()
    expect(summaryFor(stats, 'easy').started).toBe(3)
    // Absent in storage — must read as 0, not undefined.
    expect(summaryFor(stats, 'expert').started).toBe(0)
  })
})

describe('formatMs', () => {
  it.each([
    [0, '0:00'],
    [9000, '0:09'],
    [65_000, '1:05'],
    [600_000, '10:00'],
  ])('formats %ims as %s', (ms, expected) => {
    expect(formatMs(ms)).toBe(expected)
  })
})
