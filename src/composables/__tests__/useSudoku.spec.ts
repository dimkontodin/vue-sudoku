import { describe, expect, it } from 'vitest'
import { CELLS } from '@/core/constants'
import { peersOf } from '@/core/grid'
import { generate } from '@/core/generator'
import { hasNote } from '@/core/notes'
import type { Puzzle } from '@/core/types'
import { useSudoku } from '../useSudoku'

/** A puzzle with a single empty cell, so tests can reason about exact state. */
function nearlySolved(): { puzzle: Puzzle; blankIndex: number; answer: number } {
  const { solution } = generate('easy')
  const puzzle = solution.slice()
  const blankIndex = 40
  const answer = solution[blankIndex]!
  puzzle[blankIndex] = 0
  return { puzzle: { puzzle, solution }, blankIndex, answer }
}

function firstEmpty(board: Uint8Array): number {
  return board.findIndex((value) => value === 0)
}

describe('useSudoku', () => {
  it('starts from the puzzle with no notes and nothing selected', () => {
    const { puzzle } = nearlySolved()
    const game = useSudoku(puzzle)

    expect(Array.from(game.board.value)).toEqual(Array.from(puzzle.puzzle))
    expect(game.selectedIndex.value).toBeNull()
    expect(game.canUndo.value).toBe(false)
    expect(game.notes.value.every((n) => n === 0)).toBe(true)
  })

  it('does not alias the puzzle it was given', () => {
    const { puzzle } = nearlySolved()
    const game = useSudoku(puzzle)
    const emptyIndex = firstEmpty(game.board.value)

    game.select(emptyIndex)
    game.setValue(5)

    // Mutating the board must not have written through to the caller's puzzle.
    expect(puzzle.puzzle[emptyIndex]).toBe(0)
  })

  it('refuses to modify a given cell', () => {
    const { puzzle } = nearlySolved()
    const game = useSudoku(puzzle)
    const givenIndex = puzzle.puzzle.findIndex((value) => value !== 0)
    const original = puzzle.puzzle[givenIndex]!

    game.select(givenIndex)
    game.setValue(original === 9 ? 1 : 9)
    game.erase()
    game.toggleNote(3)

    expect(game.board.value[givenIndex]).toBe(original)
    expect(game.canUndo.value).toBe(false)
  })

  it('places a digit and clears it again when pressed twice', () => {
    const { puzzle, blankIndex } = nearlySolved()
    const game = useSudoku(puzzle)

    game.select(blankIndex)
    game.setValue(4)
    expect(game.board.value[blankIndex]).toBe(4)

    game.setValue(4)
    expect(game.board.value[blankIndex]).toBe(0)
  })

  it('reports conflicts against peers', () => {
    const { puzzle, blankIndex, answer } = nearlySolved()
    const game = useSudoku(puzzle)
    const wrong = answer === 9 ? 1 : answer + 1

    game.select(blankIndex)
    game.setValue(wrong)

    expect(game.conflicts.value.has(blankIndex)).toBe(true)
    expect(game.isSolved.value).toBe(false)
  })

  it('detects a solved board', () => {
    const { puzzle, blankIndex, answer } = nearlySolved()
    const game = useSudoku(puzzle)

    game.select(blankIndex)
    game.setValue(answer)

    expect(game.conflicts.value.size).toBe(0)
    expect(game.isSolved.value).toBe(true)
  })

  it('counts how many of each digit remain', () => {
    const { puzzle, blankIndex, answer } = nearlySolved()
    const game = useSudoku(puzzle)

    expect(game.remainingCounts.value[answer - 1]).toBe(1)

    game.select(blankIndex)
    game.setValue(answer)

    expect(game.remainingCounts.value[answer - 1]).toBe(0)
    expect(game.remainingCounts.value.every((count) => count === 0)).toBe(true)
  })

  describe('notes', () => {
    it('toggles notes on an empty cell', () => {
      const { puzzle, blankIndex } = nearlySolved()
      const game = useSudoku(puzzle)

      game.select(blankIndex)
      game.toggleNote(3)
      game.toggleNote(7)

      expect(game.notesFor(blankIndex)).toEqual([3, 7])

      game.toggleNote(3)
      expect(game.notesFor(blankIndex)).toEqual([7])
    })

    it('ignores notes on a cell that already holds a value', () => {
      const { puzzle, blankIndex } = nearlySolved()
      const game = useSudoku(puzzle)

      game.select(blankIndex)
      game.setValue(5)
      game.toggleNote(3)

      expect(game.notesFor(blankIndex)).toEqual([])
    })

    it('clears the cell notes when a value is placed', () => {
      const { puzzle, blankIndex } = nearlySolved()
      const game = useSudoku(puzzle)

      game.select(blankIndex)
      game.toggleNote(3)
      game.setValue(5)

      expect(game.notesFor(blankIndex)).toEqual([])
    })

    it('removes the placed digit from peer notes', () => {
      const { solution } = generate('easy')
      const board = solution.slice()
      // Empty out a cell and one of its peers so both are writable.
      const target = 0
      const peer = peersOf(target)[0]!
      board[target] = 0
      board[peer] = 0
      const game = useSudoku({ puzzle: board, solution })

      game.select(peer)
      game.toggleNote(4)
      game.toggleNote(6)
      expect(hasNote(game.notes.value[peer]!, 4)).toBe(true)

      game.select(target)
      game.setValue(4)

      expect(hasNote(game.notes.value[peer]!, 4)).toBe(false)
      expect(hasNote(game.notes.value[peer]!, 6)).toBe(true)
    })

    it('routes digits to notes while note mode is on', () => {
      const { puzzle, blankIndex } = nearlySolved()
      const game = useSudoku(puzzle)

      game.select(blankIndex)
      game.toggleNoteMode()
      game.inputDigit(8)

      expect(game.board.value[blankIndex]).toBe(0)
      expect(game.notesFor(blankIndex)).toEqual([8])
    })
  })

  describe('undo / redo', () => {
    it('undoes and redoes a placement', () => {
      const { puzzle, blankIndex } = nearlySolved()
      const game = useSudoku(puzzle)

      game.select(blankIndex)
      game.setValue(5)
      expect(game.canUndo.value).toBe(true)

      expect(game.undo()).toBe(true)
      expect(game.board.value[blankIndex]).toBe(0)
      expect(game.canRedo.value).toBe(true)

      expect(game.redo()).toBe(true)
      expect(game.board.value[blankIndex]).toBe(5)
    })

    it('undoes a peer-note clear together with the placement that caused it', () => {
      const { solution } = generate('easy')
      const board = solution.slice()
      const target = 0
      const peer = peersOf(target)[0]!
      board[target] = 0
      board[peer] = 0
      const game = useSudoku({ puzzle: board, solution })

      game.select(peer)
      game.toggleNote(4)
      game.select(target)
      game.setValue(4)
      expect(hasNote(game.notes.value[peer]!, 4)).toBe(false)

      game.undo()

      // The whole batch reverts: the digit AND the peer's note come back.
      expect(game.board.value[target]).toBe(0)
      expect(hasNote(game.notes.value[peer]!, 4)).toBe(true)
    })

    it('undoes note toggles', () => {
      const { puzzle, blankIndex } = nearlySolved()
      const game = useSudoku(puzzle)

      game.select(blankIndex)
      game.toggleNote(2)
      game.undo()

      expect(game.notesFor(blankIndex)).toEqual([])
    })

    it('returns false when there is nothing to undo or redo', () => {
      const { puzzle } = nearlySolved()
      const game = useSudoku(puzzle)

      expect(game.undo()).toBe(false)
      expect(game.redo()).toBe(false)
    })

    it('walks a multi-step sequence back to the start', () => {
      const { puzzle } = nearlySolved()
      const game = useSudoku(puzzle)
      const start = Array.from(game.board.value)
      const emptyIndex = firstEmpty(game.board.value)

      game.select(emptyIndex)
      game.setValue(1)
      game.setValue(2)
      game.setValue(3)

      while (game.canUndo.value) game.undo()

      expect(Array.from(game.board.value)).toEqual(start)
    })
  })

  describe('selection', () => {
    it('moves with clamping at the edges', () => {
      const { puzzle } = nearlySolved()
      const game = useSudoku(puzzle)

      game.select(0)
      game.moveSelection(-1, -1)
      expect(game.selectedIndex.value).toBe(0)

      game.select(CELLS - 1)
      game.moveSelection(1, 1)
      expect(game.selectedIndex.value).toBe(CELLS - 1)

      game.select(0)
      game.moveSelection(1, 1)
      expect(game.selectedIndex.value).toBe(10)
    })

    it('ignores out-of-range indices', () => {
      const { puzzle } = nearlySolved()
      const game = useSudoku(puzzle)

      game.select(5)
      game.select(-1)
      expect(game.selectedIndex.value).toBe(5)

      game.select(CELLS)
      expect(game.selectedIndex.value).toBe(5)
    })
  })

  describe('reveal / load / reset', () => {
    it('reveals the correct digit and records it as undoable', () => {
      const { puzzle, blankIndex, answer } = nearlySolved()
      const game = useSudoku(puzzle)

      game.select(blankIndex)
      expect(game.reveal()).toBe(true)
      expect(game.board.value[blankIndex]).toBe(answer)

      game.undo()
      expect(game.board.value[blankIndex]).toBe(0)
    })

    it('reset() restores the original clues and clears history', () => {
      const { puzzle, blankIndex } = nearlySolved()
      const game = useSudoku(puzzle)

      game.select(blankIndex)
      game.setValue(5)
      game.toggleNote(2)
      game.reset()

      expect(Array.from(game.board.value)).toEqual(Array.from(puzzle.puzzle))
      expect(game.canUndo.value).toBe(false)
      expect(game.notes.value.every((n) => n === 0)).toBe(true)
    })

    it('load() swaps in a new puzzle and clears everything', () => {
      const { puzzle, blankIndex } = nearlySolved()
      const game = useSudoku(puzzle)

      game.select(blankIndex)
      game.setValue(5)

      const next = generate('medium')
      game.load(next)

      expect(Array.from(game.board.value)).toEqual(Array.from(next.puzzle))
      expect(game.selectedIndex.value).toBeNull()
      expect(game.canUndo.value).toBe(false)
    })
  })

  describe('mistakes and hints', () => {
    it('counts a wrong digit as a mistake', () => {
      const { puzzle, blankIndex, answer } = nearlySolved()
      const game = useSudoku(puzzle)
      const wrong = answer === 9 ? 1 : answer + 1

      game.select(blankIndex)
      expect(game.mistakes.value).toBe(0)

      game.setValue(wrong)
      expect(game.mistakes.value).toBe(1)
    })

    it('does not count a correct digit', () => {
      const { puzzle, blankIndex, answer } = nearlySolved()
      const game = useSudoku(puzzle)

      game.select(blankIndex)
      game.setValue(answer)

      expect(game.mistakes.value).toBe(0)
    })

    it('does not un-count a mistake on undo', () => {
      const { puzzle, blankIndex, answer } = nearlySolved()
      const game = useSudoku(puzzle)
      const wrong = answer === 9 ? 1 : answer + 1

      game.select(blankIndex)
      game.setValue(wrong)
      game.undo()

      // The board is clean again, but the mistake still happened.
      expect(game.board.value[blankIndex]).toBe(0)
      expect(game.mistakes.value).toBe(1)
    })

    it('counts hints and does not count them as mistakes', () => {
      const { puzzle, blankIndex } = nearlySolved()
      const game = useSudoku(puzzle)

      game.select(blankIndex)
      game.reveal()

      expect(game.hintsUsed.value).toBe(1)
      expect(game.mistakes.value).toBe(0)
    })

    it('resets both counters on load and reset', () => {
      const { puzzle, blankIndex, answer } = nearlySolved()
      const game = useSudoku(puzzle)
      const wrong = answer === 9 ? 1 : answer + 1

      game.select(blankIndex)
      game.setValue(wrong)
      game.reveal()
      expect(game.mistakes.value).toBe(1)
      expect(game.hintsUsed.value).toBe(1)

      game.reset()
      expect(game.mistakes.value).toBe(0)
      expect(game.hintsUsed.value).toBe(0)

      game.load(generate('easy'))
      expect(game.mistakes.value).toBe(0)
      expect(game.hintsUsed.value).toBe(0)
    })
  })

  describe('incorrectCells', () => {
    it('is empty on a fresh puzzle', () => {
      const { puzzle } = nearlySolved()
      expect(useSudoku(puzzle).incorrectCells.value.size).toBe(0)
    })

    it('flags a digit that differs from the solution', () => {
      const { puzzle, blankIndex, answer } = nearlySolved()
      const game = useSudoku(puzzle)
      const wrong = answer === 9 ? 1 : answer + 1

      game.select(blankIndex)
      game.setValue(wrong)

      expect(game.incorrectCells.value.has(blankIndex)).toBe(true)
    })

    it('catches a wrong digit that conflicts with nothing', () => {
      // The point of checking against the solution rather than peers: this
      // board stays internally consistent while still being wrong.
      const source = generate('easy')
      const game = useSudoku(source)
      const empties = [...source.puzzle.keys()].filter((i) => source.puzzle[i] === 0)

      // Fill every empty cell with its correct value except one, swapped for a
      // digit that no peer uses yet.
      const target = empties[0]!
      for (const index of empties) {
        if (index === target) continue
        game.select(index)
        game.setValue(source.solution[index]!)
      }

      game.select(target)
      const answer = source.solution[target]!
      game.setValue(answer === 9 ? 1 : answer + 1)

      expect(game.incorrectCells.value.has(target)).toBe(true)
    })

    it('clears once the right digit is entered', () => {
      const { puzzle, blankIndex, answer } = nearlySolved()
      const game = useSudoku(puzzle)

      game.select(blankIndex)
      game.setValue(answer === 9 ? 1 : answer + 1)
      expect(game.incorrectCells.value.size).toBe(1)

      game.setValue(answer)
      expect(game.incorrectCells.value.size).toBe(0)
    })
  })

  describe('restore', () => {
    it('rehydrates board, notes and counters', () => {
      const source = generate('easy')
      const game = useSudoku()
      const board = source.puzzle.slice()
      const firstEmpty = board.findIndex((value) => value === 0)
      board[firstEmpty] = 4
      const notes = new Uint16Array(CELLS)
      notes[firstEmpty + 1] = 0b1010

      game.restore({
        puzzle: source.puzzle,
        solution: source.solution,
        board,
        notes,
        mistakes: 3,
        hintsUsed: 2,
      })

      expect(Array.from(game.board.value)).toEqual(Array.from(board))
      expect(game.notes.value[firstEmpty + 1]).toBe(0b1010)
      expect(game.mistakes.value).toBe(3)
      expect(game.hintsUsed.value).toBe(2)
      expect(game.isGiven(firstEmpty)).toBe(false)
    })

    it('does not restore history — undo cannot run past the save point', () => {
      const source = generate('easy')
      const game = useSudoku(source)
      const firstEmpty = source.puzzle.findIndex((value) => value === 0)

      game.select(firstEmpty)
      game.setValue(3)
      expect(game.canUndo.value).toBe(true)

      game.restore({
        puzzle: source.puzzle,
        solution: source.solution,
        board: game.board.value,
        notes: game.notes.value,
        mistakes: 0,
        hintsUsed: 0,
      })

      expect(game.canUndo.value).toBe(false)
    })

    it('does not alias the arrays it was given', () => {
      const source = generate('easy')
      const game = useSudoku()
      const board = source.puzzle.slice()

      game.restore({
        puzzle: source.puzzle,
        solution: source.solution,
        board,
        notes: new Uint16Array(CELLS),
        mistakes: 0,
        hintsUsed: 0,
      })

      const firstEmpty = board.findIndex((value) => value === 0)
      game.select(firstEmpty)
      game.setValue(7)

      expect(board[firstEmpty]).toBe(0)
    })
  })

  // The Phase 3 gate: a full game, start to finish, with nothing rendered.
  it('plays a generated puzzle through to solved', () => {
    const source = generate('easy')
    const game = useSudoku(source)

    for (let index = 0; index < CELLS; index++) {
      if (game.isGiven(index)) continue
      game.select(index)
      game.setValue(source.solution[index]!)
    }

    expect(game.isSolved.value).toBe(true)
    expect(game.conflicts.value.size).toBe(0)
    expect(Array.from(game.board.value)).toEqual(Array.from(source.solution))
  })
})
