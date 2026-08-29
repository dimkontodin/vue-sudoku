import { computed, shallowRef } from 'vue'
import type { SudokuGame } from '@vue-sudoku/sudoku-core'

/**
 * Two touch input models over one deterministic rule, so the player never has
 * to pick a mode:
 *
 *   a cell is selected  → a digit tap writes into it   (cell-first, as on web)
 *   nothing is selected → a digit tap ARMS that digit  (digit-first)
 *
 * While a digit is armed, every cell tap places it and the selection stays
 * null, so the mode persists across taps. Nothing extra is needed to take a
 * digit back out: `setValue` already erases when the digit being written is the
 * one already in the cell, so place and un-place are literally the same tap.
 *
 * All of this is new *triggers* over the existing sudoku-core API — the core
 * takes an explicit index on every write, so nothing there had to change.
 */

/** What just happened, so the caller can pick the matching haptic. */
export type InputFeedback = 'value' | 'note' | 'erase' | 'none'

export function useDigitFirst(game: SudokuGame) {
  const activeDigit = shallowRef<number | null>(null)
  /** Set only by a long-press arm. The pencil toggle is folded in below. */
  const armedAsNote = shallowRef(false)

  /** The pencil toggle always wins, so flipping it mid-run does the obvious thing. */
  const isNoteInput = computed(() => armedAsNote.value || game.noteMode.value)

  /**
   * Which digit the board should highlight: the armed one while digit-first is
   * running, otherwise whatever sits in the selected cell.
   */
  const highlightValue = computed(() => activeDigit.value ?? game.selectedValue.value)

  function disarm(): void {
    activeDigit.value = null
    armedAsNote.value = false
  }

  function arm(digit: number, asNote: boolean): void {
    activeDigit.value = digit
    armedAsNote.value = asNote
    // Armed mode owns the board; leaving a cell selected would make the next
    // digit tap ambiguous between "write here" and "re-arm".
    game.select(null)
  }

  function isWritable(index: number): boolean {
    return !game.isGiven(index)
  }

  function write(digit: number, index: number, asNote: boolean): InputFeedback {
    if (!isWritable(index)) return 'none'

    if (asNote) {
      // A note is meaningless in a cell that already holds a value.
      if ((game.board.value[index] ?? 0) !== 0) return 'none'
      game.toggleNote(digit, index)
      return 'note'
    }

    const before = game.board.value[index] ?? 0
    game.setValue(digit, index)
    return before === digit ? 'erase' : 'value'
  }

  function onCellTap(index: number): InputFeedback {
    const digit = activeDigit.value
    if (digit === null) {
      game.select(index)
      return 'none'
    }
    return write(digit, index, isNoteInput.value)
  }

  function onDigitTap(digit: number): InputFeedback {
    // Armed: the lit key disarms, any other key re-arms.
    if (activeDigit.value !== null) {
      if (activeDigit.value === digit) disarm()
      else arm(digit, armedAsNote.value)
      return 'none'
    }

    const selected = game.selectedIndex.value
    if (selected !== null) return write(digit, selected, isNoteInput.value)

    arm(digit, false)
    return 'none'
  }

  function onDigitLongPress(digit: number): InputFeedback {
    const selected = game.selectedIndex.value

    // No cell to write into (or already running digit-first): arm as a note, so
    // every following cell tap drops a pencil mark.
    if (activeDigit.value !== null || selected === null) {
      arm(digit, true)
      return 'note'
    }

    return write(digit, selected, true)
  }

  function onCellLongPress(index: number): InputFeedback {
    if (!isWritable(index)) return 'none'

    const isEmpty = (game.board.value[index] ?? 0) === 0 && (game.notes.value[index] ?? 0) === 0
    if (isEmpty) {
      // Nothing to erase — fall back to plain selection so the gesture is never
      // a dead end.
      if (activeDigit.value === null) game.select(index)
      return 'none'
    }

    game.erase(index)
    return 'erase'
  }

  return {
    activeDigit,
    isNoteInput,
    highlightValue,
    disarm,
    onCellTap,
    onDigitTap,
    onDigitLongPress,
    onCellLongPress,
  }
}

export type DigitFirstInput = ReturnType<typeof useDigitFirst>
