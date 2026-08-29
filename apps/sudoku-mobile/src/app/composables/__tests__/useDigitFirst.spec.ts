import { describe, expect, it } from 'vitest'
import { CELLS, useSudoku, type Puzzle } from '@vue-sudoku/sudoku-core'
import { useDigitFirst } from '../useDigitFirst'

/**
 * A hand-built puzzle so the tests can assert on exact digits: cell 0 is a
 * given 5, cell 1 is empty with a known answer of 3, cell 2 is empty with a
 * known answer of 4. Nothing else in the grid matters here — useDigitFirst
 * routes taps, it does not validate sudoku.
 */
function makeGame() {
  const puzzle = new Uint8Array(CELLS)
  const solution = new Uint8Array(CELLS)
  puzzle[0] = 5
  solution[0] = 5
  solution[1] = 3
  solution[2] = 4

  return useSudoku({ puzzle, solution } as Puzzle)
}

describe('useDigitFirst', () => {
  describe('cell-first: a cell is selected, so a digit tap writes into it', () => {
    it('writes the digit into the selected cell', () => {
      const game = makeGame()
      const input = useDigitFirst(game)

      expect(input.onCellTap(1)).toBe('none')
      expect(game.selectedIndex.value).toBe(1)

      expect(input.onDigitTap(3)).toBe('value')
      expect(game.board.value[1]).toBe(3)
      // Writing never arms — the selection stays in charge.
      expect(input.activeDigit.value).toBeNull()
    })

    it('re-tapping the digit already in the cell erases it', () => {
      const game = makeGame()
      const input = useDigitFirst(game)

      input.onCellTap(1)
      input.onDigitTap(3)
      expect(input.onDigitTap(3)).toBe('erase')
      expect(game.board.value[1]).toBe(0)
    })

    it('refuses to write into a given', () => {
      const game = makeGame()
      const input = useDigitFirst(game)

      input.onCellTap(0)
      expect(input.onDigitTap(7)).toBe('none')
      expect(game.board.value[0]).toBe(5)
    })

    it('writes notes instead while the pencil toggle is on', () => {
      const game = makeGame()
      const input = useDigitFirst(game)

      game.toggleNoteMode()
      input.onCellTap(1)

      expect(input.onDigitTap(3)).toBe('note')
      expect(game.board.value[1]).toBe(0)
      expect(game.notesFor(1)).toEqual([3])
    })
  })

  describe('digit-first: nothing is selected, so a digit tap arms it', () => {
    it('arms the digit and clears any selection', () => {
      const game = makeGame()
      const input = useDigitFirst(game)

      expect(input.onDigitTap(3)).toBe('none')
      expect(input.activeDigit.value).toBe(3)
      expect(game.selectedIndex.value).toBeNull()
    })

    it('places the armed digit into every cell tapped, staying armed', () => {
      const game = makeGame()
      const input = useDigitFirst(game)

      input.onDigitTap(3)
      expect(input.onCellTap(1)).toBe('value')
      expect(input.onCellTap(2)).toBe('value')

      expect(game.board.value[1]).toBe(3)
      expect(game.board.value[2]).toBe(3)
      expect(input.activeDigit.value).toBe(3)
      // The selection must stay null or the next digit tap would be ambiguous.
      expect(game.selectedIndex.value).toBeNull()
    })

    it('tapping a cell that already holds the armed digit erases it', () => {
      const game = makeGame()
      const input = useDigitFirst(game)

      input.onDigitTap(3)
      input.onCellTap(1)
      expect(input.onCellTap(1)).toBe('erase')
      expect(game.board.value[1]).toBe(0)
    })

    it('tapping the armed digit disarms; tapping another re-arms', () => {
      const game = makeGame()
      const input = useDigitFirst(game)

      input.onDigitTap(3)
      expect(input.onDigitTap(4)).toBe('none')
      expect(input.activeDigit.value).toBe(4)

      expect(input.onDigitTap(4)).toBe('none')
      expect(input.activeDigit.value).toBeNull()
    })

    it('skips givens without disarming', () => {
      const game = makeGame()
      const input = useDigitFirst(game)

      input.onDigitTap(3)
      expect(input.onCellTap(0)).toBe('none')
      expect(game.board.value[0]).toBe(5)
      expect(input.activeDigit.value).toBe(3)
    })

    it('once disarmed, a cell tap selects again', () => {
      const game = makeGame()
      const input = useDigitFirst(game)

      input.onDigitTap(3)
      input.onDigitTap(3)

      expect(input.onCellTap(1)).toBe('none')
      expect(game.selectedIndex.value).toBe(1)
      expect(game.board.value[1]).toBe(0)
    })
  })

  describe('long-press a digit', () => {
    it('drops a single note into the selected cell without changing mode', () => {
      const game = makeGame()
      const input = useDigitFirst(game)

      input.onCellTap(1)
      expect(input.onDigitLongPress(3)).toBe('note')

      expect(game.notesFor(1)).toEqual([3])
      expect(game.noteMode.value).toBe(false)
      expect(input.activeDigit.value).toBeNull()
    })

    it('arms as a note when nothing is selected', () => {
      const game = makeGame()
      const input = useDigitFirst(game)

      expect(input.onDigitLongPress(3)).toBe('note')
      expect(input.activeDigit.value).toBe(3)
      expect(input.isNoteInput.value).toBe(true)

      expect(input.onCellTap(1)).toBe('note')
      expect(game.notesFor(1)).toEqual([3])
      expect(game.board.value[1]).toBe(0)
    })

    it('a note-armed digit keeps pencilling across cells', () => {
      const game = makeGame()
      const input = useDigitFirst(game)

      input.onDigitLongPress(3)
      input.onCellTap(1)
      input.onCellTap(2)

      expect(game.notesFor(1)).toEqual([3])
      expect(game.notesFor(2)).toEqual([3])
    })

    it('will not note a cell that already holds a value', () => {
      const game = makeGame()
      const input = useDigitFirst(game)

      input.onCellTap(1)
      input.onDigitTap(3)
      expect(input.onDigitLongPress(7)).toBe('none')
      expect(game.notesFor(1)).toEqual([])
    })
  })

  describe('long-press a cell', () => {
    it('erases a filled cell', () => {
      const game = makeGame()
      const input = useDigitFirst(game)

      input.onCellTap(1)
      input.onDigitTap(3)

      expect(input.onCellLongPress(1)).toBe('erase')
      expect(game.board.value[1]).toBe(0)
    })

    it('erases notes too', () => {
      const game = makeGame()
      const input = useDigitFirst(game)

      input.onDigitLongPress(3)
      input.onCellTap(1)

      expect(input.onCellLongPress(1)).toBe('erase')
      expect(game.notesFor(1)).toEqual([])
    })

    it('falls back to selection on an empty cell rather than doing nothing', () => {
      const game = makeGame()
      const input = useDigitFirst(game)

      expect(input.onCellLongPress(1)).toBe('none')
      expect(game.selectedIndex.value).toBe(1)
    })

    it('leaves givens alone', () => {
      const game = makeGame()
      const input = useDigitFirst(game)

      expect(input.onCellLongPress(0)).toBe('none')
      expect(game.board.value[0]).toBe(5)
    })
  })

  describe('highlightValue', () => {
    it('follows the selected cell when nothing is armed', () => {
      const game = makeGame()
      const input = useDigitFirst(game)

      expect(input.highlightValue.value).toBe(0)
      input.onCellTap(0)
      expect(input.highlightValue.value).toBe(5)
    })

    it('is the armed digit while digit-first is running', () => {
      const game = makeGame()
      const input = useDigitFirst(game)

      input.onDigitTap(7)
      expect(input.highlightValue.value).toBe(7)
    })
  })

  it('disarm() returns to neutral', () => {
    const game = makeGame()
    const input = useDigitFirst(game)

    input.onDigitLongPress(3)
    input.disarm()

    expect(input.activeDigit.value).toBeNull()
    expect(input.isNoteInput.value).toBe(false)
  })
})
