import { describe, expect, it } from 'vitest'
import { generate } from '../../core/generator'
import { solveLogically } from '../../core/logicalSolver'
import { computeCandidates } from '../../core/candidates'
import { noteMask, notesToArray } from '../../core/notes'
import { parseGrid } from '../../core/__tests__/fixtures'
import { HARD_PUZZLES } from '../../core/__tests__/fixtures'
import { useHints } from '../useHints'

describe('useHints', () => {
  it('starts with nothing shown', () => {
    const hints = useHints()

    expect(hints.stage.value).toBe('none')
    expect(hints.step.value).toBeNull()
    expect(hints.patternCells.value.size).toBe(0)
    expect(hints.headline.value).toBe('')
  })

  it('names the technique before revealing where it is', () => {
    const hints = useHints()
    const { puzzle } = generate('easy')

    hints.next(puzzle)

    expect(hints.stage.value).toBe('technique')
    expect(hints.headline.value).toMatch(/Look for a/)
    // The point of the first stage: told what to hunt for, not where.
    expect(hints.patternCells.value.size).toBe(0)
    expect(hints.detail.value).toBe('')
  })

  it('reveals the cells on the second press', () => {
    const hints = useHints()
    const { puzzle } = generate('easy')

    hints.next(puzzle)
    hints.next(puzzle)

    expect(hints.stage.value).toBe('located')
    expect(hints.patternCells.value.size).toBeGreaterThan(0)
    expect(hints.detail.value).toMatch(/\S/)
  })

  it('stops at located, since applying is the caller job', () => {
    const hints = useHints()
    const { puzzle } = generate('easy')

    hints.next(puzzle)
    hints.next(puzzle)
    hints.next(puzzle)

    // No further stage: the board change from applying is what ends the hint.
    expect(hints.stage.value).toBe('located')
  })

  it('offers the easiest technique available', () => {
    const hints = useHints()
    hints.next(parseGrid(HARD_PUZZLES.antiBacktrack))

    // That grid falls to singles, so a hint must never reach for anything else.
    expect(['nakedSingle', 'hiddenSingle']).toContain(hints.step.value!.technique)
  })

  it('reports being stuck rather than guessing', () => {
    // Platinum Blonde yields one hidden single and then stalls: it needs chain
    // techniques this solver deliberately does not implement. Run the logical
    // solver to that dead end first, since a hint on the ORIGINAL grid would
    // find that one opening move.
    const stalled = solveLogically(parseGrid(HARD_PUZZLES.platinumBlonde))
    expect(stalled.solved).toBe(false)

    const hints = useHints()
    hints.next(stalled.board)

    expect(hints.stuck.value).toBe(true)
    expect(hints.step.value).toBeNull()
    expect(hints.headline.value).toMatch(/No pattern/)
  })

  it('recomputes against the current board, not the one first asked about', () => {
    const hints = useHints()
    const { puzzle, solution } = generate('easy')

    hints.next(puzzle)
    const first = hints.step.value!
    // An easy puzzle always opens with a placement, so this is safe to assume.
    expect(first.placements.length).toBeGreaterThan(0)

    hints.reset()

    // Fill in the cell the first hint pointed at, then ask again.
    const advanced = puzzle.slice()
    for (const { index } of first.placements) advanced[index] = solution[index]!
    hints.next(advanced)

    expect(hints.step.value).not.toBeNull()
    expect(hints.step.value!.pattern).not.toEqual(first.pattern)
  })

  describe('progress through eliminations', () => {
    it('does not offer the same elimination twice in a row', () => {
      // The bug this guards: an elimination-only step leaves the board
      // untouched, so recomputing candidates from the board alone re-finds it
      // and the hint loops forever. Seen live as 90 hints for 15 placements.
      const hints = useHints()
      const { puzzle } = generate('expert')

      const seen: string[] = []
      let repeated: string | null = null

      for (let i = 0; i < 30; i++) {
        hints.next(puzzle)
        const step = hints.step.value
        if (!step) break

        const key = `${step.technique}:${step.eliminations.map((e) => `${e.index}/${e.digit}`).join(',')}`
        if (step.eliminations.length > 0 && seen.includes(key)) {
          repeated = key
          break
        }
        seen.push(key)

        hints.apply(step)
        hints.reset(false)
      }

      expect(repeated).toBeNull()
    })

    it('gets past an elimination-only technique to the placements it unlocks', () => {
      // A fixed grid, not a generated one: many "expert" puzzles need nothing
      // past hidden singles, so generating one to prove this was flaky. This
      // puzzle needs Pointing, which only removes candidates — reaching its
      // 77 steps is only possible if those eliminations stick.
      const hints = useHints()
      const puzzle = parseGrid(HARD_PUZZLES.norvigGrid2)
      const used = new Set<string>()
      let steps = 0

      for (let i = 0; i < 200; i++) {
        hints.next(puzzle)
        const step = hints.step.value
        if (!step) break
        used.add(step.technique)
        steps++
        hints.apply(step)
        hints.reset(false)
      }

      expect(used.has('pointing')).toBe(true)
      expect(used.size).toBeGreaterThan(1)
      // Without accumulation it stalls on the first Pointing step forever.
      expect(steps).toBeGreaterThan(50)
    })

    it('honours the player notes as eliminations already made', () => {
      // A fixed grid, because generating one was flaky: sometimes the first
      // empty cell was already a natural naked single, and the premise of the
      // test evaporated. This puzzle has SEVEN candidates in cell 0 and no
      // natural naked single anywhere, so narrowing cell 0 creates the only
      // one on the board.
      const hints = useHints()
      const puzzle = parseGrid(HARD_PUZZLES.antiBacktrack)
      const legal = notesToArray(computeCandidates(puzzle)[0]!)
      expect(legal.length).toBeGreaterThan(1)

      const notes = new Uint16Array(81)
      notes[0] = noteMask(legal[0]!)

      hints.next(puzzle, notes)

      // The board alone offers seven candidates here; the player's notes say
      // otherwise, and the engine has to believe them.
      expect(hints.step.value!.technique).toBe('nakedSingle')
      expect(hints.step.value!.placements[0]).toEqual({ index: 0, digit: legal[0] })
    })
  })

  it('reset() clears everything', () => {
    const hints = useHints()
    const { puzzle } = generate('easy')

    hints.next(puzzle)
    hints.next(puzzle)
    hints.reset()

    expect(hints.stage.value).toBe('none')
    expect(hints.step.value).toBeNull()
    expect(hints.patternCells.value.size).toBe(0)
    expect(hints.stuck.value).toBe(false)
  })
})
