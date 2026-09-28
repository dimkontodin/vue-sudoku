import { afterEach, describe, expect, it, vi } from 'vitest'
import * as generator from '../../core/generator'
import { solveLogically } from '../../core/logicalSolver'
import { countSolutions } from '../../core/solver'
import { createPuzzleCache, type PuzzleCache } from '../puzzleCache'

/** Resolves once the cache holds a puzzle for `difficulty`. */
async function until(check: () => boolean, timeoutMs = 10_000): Promise<void> {
  const start = performance.now()
  while (!check()) {
    if (performance.now() - start > timeoutMs) throw new Error('timed out waiting for the cache')
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

describe('createPuzzleCache', () => {
  let cache: PuzzleCache

  afterEach(() => {
    cache?.dispose()
    vi.restoreAllMocks()
  })

  it('generates on the spot when nothing is cached, then refills in the background', async () => {
    cache = createPuzzleCache()
    expect(cache.has('medium')).toBe(false)

    const first = cache.take('medium')
    expect(countSolutions(first.puzzle.slice(), 2)).toBe(1)

    await until(() => cache.has('medium'))
  })

  it('serves the prefetched puzzle, exactly graded, without generating in the foreground', async () => {
    cache = createPuzzleCache()
    cache.prefetch('hard')
    await until(() => cache.has('hard'))

    const generate = vi.spyOn(generator, 'generate')
    const served = cache.take('hard')

    expect(generate).not.toHaveBeenCalled()
    const grade = solveLogically(served.puzzle, { allowUniquenessTechniques: true })
    expect(grade.difficulty).toBe('hard')
  })

  it('hands each cached puzzle out once', async () => {
    cache = createPuzzleCache()
    cache.prefetch('easy')
    await until(() => cache.has('easy'))

    const first = cache.take('easy')
    // The refill has not had a chance to run yet, so this one is fresh.
    const second = cache.take('easy')
    expect(Array.from(second.puzzle)).not.toEqual(Array.from(first.puzzle))
  })

  it('does not start background work before the requester has been answered', () => {
    const tryGenerate = vi.spyOn(generator, 'tryGenerate')
    cache = createPuzzleCache()

    cache.take('easy')
    // The fill waits for a macrotask boundary, so nothing ran synchronously.
    expect(tryGenerate).not.toHaveBeenCalled()
  })

  it('falls back to a best-effort puzzle when the fill budget runs out', async () => {
    vi.spyOn(generator, 'tryGenerate').mockReturnValue(null)
    cache = createPuzzleCache({ fillBudgetMs: 0 })

    cache.prefetch('expert')
    await until(() => cache.has('expert'))
    expect(countSolutions(cache.take('expert').puzzle.slice(), 2)).toBe(1)
  })

  it('stops filling once disposed', async () => {
    const tryGenerate = vi.spyOn(generator, 'tryGenerate')
    cache = createPuzzleCache()

    cache.prefetch('medium')
    cache.dispose()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(tryGenerate).not.toHaveBeenCalled()
    expect(cache.has('medium')).toBe(false)
  })
})

describe('tryGenerate', () => {
  it('returns only exact grades, never a fallback', () => {
    // A spent budget still allows one attempt, which may or may not hit, so
    // across many tries both outcomes occur. Whatever comes back must be exact.
    const results = Array.from({ length: 10 }, () => generator.tryGenerate('expert', 0))
    const grades = results
      .filter((result) => result !== null)
      .map((result) => solveLogically(result.puzzle, { allowUniquenessTechniques: true }).difficulty)

    expect(grades.every((grade) => grade === 'expert')).toBe(true)
  })
})
