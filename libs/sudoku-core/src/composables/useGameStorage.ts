import { CELLS } from '../core/constants'
import type { Difficulty } from '../core/types'
import { isNumberArray, isVersionedObject, readJson, removeKey, writeJson } from '../utils/storage'

const STORAGE_KEY = 'vue-sudoku:game'

/**
 * Bumping this discards every saved game rather than trying to migrate it.
 * A half-finished puzzle is cheap to lose; a crash on boot from a payload the
 * current code cannot read is not.
 */
const VERSION = 2

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert']

/** Typed arrays are not JSON, so boards travel as plain number arrays. */
export interface SavedGame {
  v: number
  difficulty: Difficulty
  puzzle: number[]
  solution: number[]
  board: number[]
  notes: number[]
  elapsedMs: number
  mistakes: number
  hintsUsed: number
  savedAt: number
}

function isSavedGame(value: unknown): value is SavedGame {
  if (!isVersionedObject(value)) return false
  const game = value as Partial<SavedGame>

  return (
    typeof game.difficulty === 'string' &&
    DIFFICULTIES.includes(game.difficulty as Difficulty) &&
    isNumberArray(game.puzzle, CELLS) &&
    isNumberArray(game.solution, CELLS) &&
    isNumberArray(game.board, CELLS) &&
    isNumberArray(game.notes, CELLS) &&
    typeof game.elapsedMs === 'number' &&
    typeof game.mistakes === 'number' &&
    typeof game.hintsUsed === 'number'
  )
}

export interface RestoredGame {
  difficulty: Difficulty
  puzzle: Uint8Array
  solution: Uint8Array
  board: Uint8Array
  notes: Uint16Array
  elapsedMs: number
  mistakes: number
  hintsUsed: number
}

export interface GameToSave {
  difficulty: Difficulty
  puzzle: Uint8Array
  solution: Uint8Array
  board: Uint8Array
  notes: Uint16Array
  elapsedMs: number
  mistakes: number
  hintsUsed: number
}

export function useGameStorage() {
  function save(game: GameToSave): boolean {
    return writeJson(STORAGE_KEY, {
      v: VERSION,
      difficulty: game.difficulty,
      puzzle: Array.from(game.puzzle),
      solution: Array.from(game.solution),
      board: Array.from(game.board),
      notes: Array.from(game.notes),
      elapsedMs: Math.round(game.elapsedMs),
      mistakes: game.mistakes,
      hintsUsed: game.hintsUsed,
      savedAt: Date.now(),
    } satisfies SavedGame)
  }

  function restore(): RestoredGame | null {
    const saved = readJson(STORAGE_KEY, VERSION, isSavedGame)
    if (!saved) return null

    // A finished board is not worth restoring — it would reopen a solved
    // puzzle with no moves left to make.
    if (saved.board.every((value) => value !== 0)) return null

    return {
      difficulty: saved.difficulty,
      puzzle: Uint8Array.from(saved.puzzle),
      solution: Uint8Array.from(saved.solution),
      board: Uint8Array.from(saved.board),
      notes: Uint16Array.from(saved.notes),
      elapsedMs: saved.elapsedMs,
      mistakes: saved.mistakes,
      hintsUsed: saved.hintsUsed,
    }
  }

  function clear(): void {
    removeKey(STORAGE_KEY)
  }

  return { save, restore, clear }
}
