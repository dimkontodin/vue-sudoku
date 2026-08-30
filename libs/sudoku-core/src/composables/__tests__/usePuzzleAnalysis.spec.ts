import { describe, expect, it } from 'vitest'
import { shallowRef } from 'vue'
import { parseGrid } from '../../core/__tests__/fixtures'
import type { Board } from '../../core/types'
import { usePuzzleAnalysis } from '../usePuzzleAnalysis'

const UNIQUE = parseGrid(
  '..............3.85..1.2.......5.7.....4...1...9.......5......73..2.1........4...9',
)
const EMPTY = parseGrid('.'.repeat(81))
/** Two 5s in the same row — rejected before any search runs. */
const CONFLICTING = parseGrid(`55${'.'.repeat(79)}`)

describe('usePuzzleAnalysis', () => {
  it('starts with nothing to report', () => {
    const analysis = usePuzzleAnalysis(() => UNIQUE)

    expect(analysis.validation.value).toBeNull()
    expect(analysis.grading.value).toBeNull()
    expect(analysis.canPlay.value).toBe(false)
    expect(analysis.canSolve.value).toBe(false)
  })

  it('validates and grades a uniquely-solvable puzzle', () => {
    const analysis = usePuzzleAnalysis(() => UNIQUE)
    analysis.check()

    expect(analysis.validation.value?.verdict).toBe('unique')
    expect(analysis.validation.value?.solution).not.toBeNull()
    expect(analysis.grading.value?.techniques.length).toBeGreaterThan(0)
    expect(analysis.canPlay.value).toBe(true)
    expect(analysis.canSolve.value).toBe(true)
  })

  it('refuses to grade a grid without a single solution', () => {
    const analysis = usePuzzleAnalysis(() => EMPTY)
    analysis.check()

    expect(analysis.validation.value?.verdict).toBe('empty')
    expect(analysis.grading.value).toBeNull()
    expect(analysis.canPlay.value).toBe(false)
    // Nothing for the visualiser to search either.
    expect(analysis.canSolve.value).toBe(false)
  })

  it('offers the solver a grid it cannot grade, but not a broken one', () => {
    const conflicting = usePuzzleAnalysis(() => CONFLICTING)
    conflicting.check()
    expect(conflicting.validation.value?.verdict).toBe('conflicting')
    expect(conflicting.canSolve.value).toBe(false)

    const tooFew = usePuzzleAnalysis(() => parseGrid(`1${'.'.repeat(80)}`))
    tooFew.check()
    expect(tooFew.validation.value?.verdict).toBe('tooFewClues')
    // Legal so far, just underdetermined — the search is worth watching.
    expect(tooFew.canSolve.value).toBe(true)
  })

  it('follows whichever board the source getter points at', () => {
    const board = shallowRef<Board>(UNIQUE)
    const analysis = usePuzzleAnalysis(() => board.value)

    analysis.check()
    expect(analysis.validation.value?.verdict).toBe('unique')

    board.value = CONFLICTING
    analysis.check()
    expect(analysis.validation.value?.verdict).toBe('conflicting')
  })

  it('drops a stale verdict on reset', () => {
    const analysis = usePuzzleAnalysis(() => UNIQUE)
    analysis.check()
    analysis.reset()

    expect(analysis.validation.value).toBeNull()
    expect(analysis.grading.value).toBeNull()
    expect(analysis.canPlay.value).toBe(false)
  })
})
