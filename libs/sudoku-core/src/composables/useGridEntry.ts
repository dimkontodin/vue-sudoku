import { computed, shallowRef, watch, type ShallowRef } from 'vue'
import { CELLS, SIZE } from '../core/constants'
import { colOf, rowOf } from '../core/grid'
import { clueCount, formatBoard, parseBoard, type ParseError } from '../core/parse'
import { conflictsIn } from '../core/validate'
import type { Board } from '../core/types'

/**
 * An editable grid of clues, for entering a puzzle by hand.
 *
 * Deliberately NOT useSudoku: that models a game being *played* — givens you
 * may not touch, notes, mistakes against a known solution. None of that exists
 * while you are still writing the puzzle down, where every cell is fair game
 * and there is no answer to be wrong about yet.
 *
 * The grid is the source of truth and `text` is a two-way projection of it, so
 * the same puzzle can be typed cell by cell, pasted in as 81 characters, or
 * both in turn.
 */
export function useGridEntry(initial?: Board) {
  // shallowRef + clone-on-write, never reactive(): a proxied TypedArray breaks,
  // for the reason spelled out in useSudoku.
  const board = shallowRef<Board>(initial?.slice() ?? new Uint8Array(CELLS))
  const selectedIndex = shallowRef<number | null>(null)
  const parseError = shallowRef<ParseError | null>(null)

  /** Digit-first entry: while set, every cell tap writes this digit. */
  const activeDigit = shallowRef<number | null>(null)

  /** An empty grid reads better as an empty box than as 81 dots. */
  const toText = (value: Board) => (clueCount(value) === 0 ? '' : formatBoard(value))

  const text = shallowRef(toText(board.value))

  const conflicts = computed(() => conflictsIn(board.value))
  const clues = computed(() => clueCount(board.value))
  const isEmpty = computed(() => clues.value === 0)
  const charCount = computed(() => text.value.replace(/\s/g, '').length)

  /** How many of each digit are still unplaced; index i holds digit i + 1. */
  const remainingCounts = computed(() => {
    const counts = Array.from({ length: SIZE }, () => SIZE)
    for (let index = 0; index < CELLS; index++) {
      const value = board.value[index]
      if (value) counts[value - 1] = (counts[value - 1] ?? 0) - 1
    }
    return counts
  })

  const selectedValue = computed(() => {
    const index = selectedIndex.value
    return index === null ? 0 : (board.value[index] ?? 0)
  })

  /** The digit to light up across the grid: the armed one, else the selected. */
  const highlightValue = computed(() => activeDigit.value ?? selectedValue.value)

  function sameBoard(a: Board, b: Board): boolean {
    for (let index = 0; index < CELLS; index++) if (a[index] !== b[index]) return false
    return true
  }

  /**
   * The single place that writes to the grid. Re-projecting into `text` here
   * is what keeps the two in step without a suppression flag: the watcher below
   * re-parses what we just wrote, finds it identical, and stops.
   */
  function commit(next: Board): void {
    board.value = next
    parseError.value = null
    text.value = toText(next)
  }

  // Sync flush, not the default pre: the grid and the text box are two views of
  // one value, and a board that lags a frame behind what is typed shows up as
  // clue counts and verdicts that describe the previous keystroke.
  watch(
    text,
    (value) => {
      if (value.trim() === '') {
        // Emptying the box empties the grid — the alternative, silently keeping
        // clues that are no longer written anywhere, is worse.
        parseError.value = null
        if (clueCount(board.value) !== 0) board.value = new Uint8Array(CELLS)
        return
      }

      const result = parseBoard(value)
      parseError.value = result.error
      if (result.board && !sameBoard(result.board, board.value)) board.value = result.board
    },
    { flush: 'sync' },
  )

  function select(index: number | null): void {
    if (index !== null && (index < 0 || index >= CELLS)) return
    selectedIndex.value = index
  }

  function moveSelection(rowDelta: number, colDelta: number): void {
    // Arrowing around is a cell-first gesture; keeping a digit armed would make
    // the next keypress mean something other than what the grid shows.
    activeDigit.value = null
    const current = selectedIndex.value ?? 0
    const row = Math.min(SIZE - 1, Math.max(0, rowOf(current) + rowDelta))
    const col = Math.min(SIZE - 1, Math.max(0, colOf(current) + colDelta))
    selectedIndex.value = row * SIZE + col
  }

  /** Writes a digit, or erases when it is already there — the usual toggle. */
  function setDigit(digit: number, index = selectedIndex.value): void {
    if (index === null || index < 0 || index >= CELLS) return
    if (digit < 1 || digit > SIZE) return

    const next = board.value.slice()
    next[index] = (board.value[index] ?? 0) === digit ? 0 : digit
    commit(next)
  }

  function erase(index = selectedIndex.value): void {
    if (index === null || (board.value[index] ?? 0) === 0) return
    const next = board.value.slice()
    next[index] = 0
    commit(next)
  }

  function clear(): void {
    activeDigit.value = null
    selectedIndex.value = null
    commit(new Uint8Array(CELLS))
  }

  function setBoard(next: Board): void {
    activeDigit.value = null
    commit(next.slice())
  }

  function disarm(): void {
    activeDigit.value = null
  }

  /**
   * Digit-first entry, the same rule the phone's play mode uses: with a cell
   * selected a digit writes into it, with nothing selected it arms instead, so
   * a whole puzzle can be entered digit by digit rather than cell by cell.
   */
  function onDigitTap(digit: number): void {
    if (activeDigit.value !== null) {
      if (activeDigit.value === digit) disarm()
      else activeDigit.value = digit
      return
    }

    if (selectedIndex.value !== null) {
      setDigit(digit, selectedIndex.value)
      return
    }

    activeDigit.value = digit
    selectedIndex.value = null
  }

  function onCellTap(index: number): void {
    const digit = activeDigit.value
    if (digit === null) {
      select(index)
      return
    }
    setDigit(digit, index)
  }

  /** Alias so this satisfies BoardKeyboardTarget as-is. */
  const inputDigit = (digit: number, index = selectedIndex.value) => setDigit(digit, index)

  return {
    board: board as Readonly<ShallowRef<Board>>,
    text,
    selectedIndex: selectedIndex as Readonly<ShallowRef<number | null>>,
    activeDigit: activeDigit as Readonly<ShallowRef<number | null>>,
    parseError: parseError as Readonly<ShallowRef<ParseError | null>>,

    conflicts,
    clues,
    isEmpty,
    charCount,
    remainingCounts,
    selectedValue,
    highlightValue,

    select,
    moveSelection,
    setDigit,
    inputDigit,
    erase,
    clear,
    setBoard,
    disarm,
    onDigitTap,
    onCellTap,
  }
}

export type GridEntry = ReturnType<typeof useGridEntry>
