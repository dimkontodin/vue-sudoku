import { describe, expect, it } from 'vitest'
import { effectScope } from 'vue'
import { formatBoard } from '../../core/parse'
import { useGridEntry } from '../useGridEntry'

const EXAMPLE = '..............3.85..1.2.......5.7.....4...1...9.......5......73..2.1........4...9'

/** The composable registers a watcher, so each case gets its own scope. */
function withEntry(body: (entry: ReturnType<typeof useGridEntry>) => void): void {
  const scope = effectScope()
  try {
    scope.run(() => body(useGridEntry()))
  } finally {
    scope.stop()
  }
}

describe('useGridEntry', () => {
  it('starts on an empty grid with an empty text box', () => {
    withEntry((entry) => {
      expect(entry.clues.value).toBe(0)
      expect(entry.isEmpty.value).toBe(true)
      expect(entry.text.value).toBe('')
      expect(entry.selectedIndex.value).toBeNull()
    })
  })

  it('writes the digit into the selected cell', () => {
    withEntry((entry) => {
      entry.select(4)
      entry.setDigit(7)

      expect(entry.board.value[4]).toBe(7)
      expect(entry.clues.value).toBe(1)
    })
  })

  it('erases when the digit already in the cell is pressed again', () => {
    withEntry((entry) => {
      entry.select(0)
      entry.setDigit(3)
      entry.setDigit(3)

      expect(entry.board.value[0]).toBe(0)
      expect(entry.isEmpty.value).toBe(true)
    })
  })

  it('projects the grid into the text box as it is edited', () => {
    withEntry((entry) => {
      entry.select(80)
      entry.setDigit(9)

      expect(entry.text.value).toBe(formatBoard(entry.board.value))
      expect(entry.text.value.endsWith('9')).toBe(true)
    })
  })

  it('parses text typed into the box back into the grid', () => {
    withEntry((entry) => {
      entry.text.value = EXAMPLE

      expect(formatBoard(entry.board.value)).toBe(EXAMPLE)
      expect(entry.clues.value).toBe(17)
      expect(entry.parseError.value).toBeNull()
    })
  })

  it('reports a parse error without touching the grid', () => {
    withEntry((entry) => {
      entry.text.value = EXAMPLE
      entry.text.value = 'nonsense'

      expect(entry.parseError.value).toBe('characters')
      expect(formatBoard(entry.board.value)).toBe(EXAMPLE)
    })
  })

  it('empties the grid when the text box is cleared', () => {
    withEntry((entry) => {
      entry.text.value = EXAMPLE
      entry.text.value = ''

      expect(entry.isEmpty.value).toBe(true)
      expect(entry.parseError.value).toBeNull()
    })
  })

  it('flags clues that clash', () => {
    withEntry((entry) => {
      entry.setDigit(5, 0)
      entry.setDigit(5, 1)

      expect([...entry.conflicts.value].sort()).toEqual([0, 1])
    })
  })

  it('counts down the digits still to place', () => {
    withEntry((entry) => {
      entry.setDigit(4, 0)
      entry.setDigit(4, 10)

      expect(entry.remainingCounts.value[3]).toBe(7)
      expect(entry.remainingCounts.value[0]).toBe(9)
    })
  })

  describe('digit-first entry', () => {
    it('arms a digit when nothing is selected, then writes it on every cell tap', () => {
      withEntry((entry) => {
        entry.onDigitTap(6)
        expect(entry.activeDigit.value).toBe(6)

        entry.onCellTap(0)
        entry.onCellTap(40)

        expect(entry.board.value[0]).toBe(6)
        expect(entry.board.value[40]).toBe(6)
        // The mode persists: nothing was selected along the way.
        expect(entry.selectedIndex.value).toBeNull()
        expect(entry.activeDigit.value).toBe(6)
      })
    })

    it('writes into the selected cell instead of arming', () => {
      withEntry((entry) => {
        entry.select(12)
        entry.onDigitTap(2)

        expect(entry.board.value[12]).toBe(2)
        expect(entry.activeDigit.value).toBeNull()
      })
    })

    it('disarms on the lit key and re-arms on any other', () => {
      withEntry((entry) => {
        entry.onDigitTap(1)
        entry.onDigitTap(1)
        expect(entry.activeDigit.value).toBeNull()

        entry.onDigitTap(1)
        entry.onDigitTap(8)
        expect(entry.activeDigit.value).toBe(8)
      })
    })

    it('takes a digit back out when its own cell is tapped again', () => {
      withEntry((entry) => {
        entry.onDigitTap(3)
        entry.onCellTap(20)
        entry.onCellTap(20)

        expect(entry.board.value[20]).toBe(0)
      })
    })

    it('highlights the armed digit, falling back to the selected cell', () => {
      withEntry((entry) => {
        entry.onDigitTap(5)
        expect(entry.highlightValue.value).toBe(5)

        entry.disarm()
        entry.select(0)
        entry.setDigit(9)
        expect(entry.highlightValue.value).toBe(9)
      })
    })

    it('disarms when the selection is moved by keyboard', () => {
      withEntry((entry) => {
        entry.onDigitTap(7)
        entry.moveSelection(1, 0)

        expect(entry.activeDigit.value).toBeNull()
        expect(entry.selectedIndex.value).toBe(9)
      })
    })
  })

  it('clears the grid, the selection and the armed digit together', () => {
    withEntry((entry) => {
      entry.text.value = EXAMPLE
      entry.select(3)
      entry.onDigitTap(4)
      entry.clear()

      expect(entry.isEmpty.value).toBe(true)
      expect(entry.text.value).toBe('')
      expect(entry.selectedIndex.value).toBeNull()
      expect(entry.activeDigit.value).toBeNull()
    })
  })
})
