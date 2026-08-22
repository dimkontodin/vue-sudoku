// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { CELLS } from '../../core/constants'
import { generate } from '../../core/generator'
import { useGameStorage, type GameToSave } from '../useGameStorage'

const STORAGE_KEY = 'vue-sudoku:game'

function sampleGame(overrides: Partial<GameToSave> = {}): GameToSave {
  const { puzzle, solution } = generate('easy')
  const board = puzzle.slice()
  const notes = new Uint16Array(CELLS)
  return {
    difficulty: 'easy',
    puzzle,
    solution,
    board,
    notes,
    elapsedMs: 12_000,
    mistakes: 2,
    hintsUsed: 1,
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('useGameStorage', () => {
  it('returns null when nothing is stored', () => {
    expect(useGameStorage().restore()).toBeNull()
  })

  it('round-trips a game', () => {
    const storage = useGameStorage()
    const game = sampleGame()
    // Make it a genuinely in-progress board.
    const board = game.board.slice()
    const firstEmpty = board.findIndex((value) => value === 0)
    board[firstEmpty] = 5
    const notes = game.notes.slice()
    notes[firstEmpty + 1] = 0b101

    expect(storage.save({ ...game, board, notes })).toBe(true)

    const restored = storage.restore()
    expect(restored).not.toBeNull()
    expect(restored!.difficulty).toBe('easy')
    expect(Array.from(restored!.board)).toEqual(Array.from(board))
    expect(Array.from(restored!.notes)).toEqual(Array.from(notes))
    expect(Array.from(restored!.puzzle)).toEqual(Array.from(game.puzzle))
    expect(Array.from(restored!.solution)).toEqual(Array.from(game.solution))
    expect(restored!.elapsedMs).toBe(12_000)
    expect(restored!.mistakes).toBe(2)
    expect(restored!.hintsUsed).toBe(1)
  })

  it('restores typed arrays, not plain arrays', () => {
    const storage = useGameStorage()
    storage.save(sampleGame())

    const restored = storage.restore()!
    expect(restored.board).toBeInstanceOf(Uint8Array)
    expect(restored.notes).toBeInstanceOf(Uint16Array)
  })

  it('does not restore a completed board', () => {
    const storage = useGameStorage()
    const { solution } = generate('easy')
    storage.save(sampleGame({ board: solution.slice() }))

    expect(storage.restore()).toBeNull()
  })

  it('clear() removes the save', () => {
    const storage = useGameStorage()
    storage.save(sampleGame())
    storage.clear()

    expect(storage.restore()).toBeNull()
  })

  describe('rejecting bad payloads', () => {
    it('ignores unparseable JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not json{')
      expect(useGameStorage().restore()).toBeNull()
    })

    it('ignores a payload from another version', () => {
      const storage = useGameStorage()
      storage.save(sampleGame())

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { v: number }
      stored.v = 99
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))

      expect(storage.restore()).toBeNull()
    })

    it('ignores a board of the wrong length', () => {
      const storage = useGameStorage()
      storage.save(sampleGame())

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { board: number[] }
      stored.board = [1, 2, 3]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))

      expect(storage.restore()).toBeNull()
    })

    it('ignores an unknown difficulty', () => {
      const storage = useGameStorage()
      storage.save(sampleGame())

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { difficulty: string }
      stored.difficulty = 'impossible'
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))

      expect(storage.restore()).toBeNull()
    })

    it('ignores a payload missing a field entirely', () => {
      const storage = useGameStorage()
      storage.save(sampleGame())

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Record<string, unknown>
      delete stored.notes
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))

      expect(storage.restore()).toBeNull()
    })
  })
})
