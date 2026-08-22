import { computed, shallowRef, type ShallowRef } from 'vue'
import { CELLS, SIZE } from '../core/constants'
import { colOf, peersOf, rowOf } from '../core/grid'
import { clearNote, notesToArray, toggleNote as toggleNoteBit } from '../core/notes'
import { conflictsIn, isComplete } from '../core/validate'
import { computeCandidates } from '../core/candidates'
import type { Board, Notes, Puzzle } from '../core/types'
import { useHistory } from './useHistory'

/** A single cell's before/after state. */
export interface CellChange {
  index: number
  prevValue: number
  nextValue: number
  prevNotes: number
  nextNotes: number
}

/**
 * One undoable action. An array because a single user action can touch several
 * cells at once — placing a digit also clears that digit from the notes of its
 * peers, and both halves have to undo together.
 */
export type Move = CellChange[]

export interface UseSudokuOptions {
  /** Placing a digit removes it from the notes of every peer cell. */
  autoClearPeerNotes?: boolean
  historyLimit?: number
}

export function useSudoku(initial?: Puzzle, options: UseSudokuOptions = {}) {
  const { autoClearPeerNotes = true, historyLimit = 200 } = options

  const puzzle = shallowRef<Board>(initial?.puzzle.slice() ?? new Uint8Array(CELLS))
  const solution = shallowRef<Board>(initial?.solution.slice() ?? new Uint8Array(CELLS))

  // shallowRef + reassign-a-copy, NOT reactive(): Vue's deep reactivity wraps
  // objects in a Proxy, and a proxied TypedArray breaks — its methods rely on
  // internal slots the proxy does not forward. shallowRef never proxies its
  // value, so the array stays a real Uint8Array; we clone on write to trigger
  // reactivity instead. 81 bytes per keystroke is free.
  const board = shallowRef<Board>(initial?.puzzle.slice() ?? new Uint8Array(CELLS))
  const notes = shallowRef<Notes>(new Uint16Array(CELLS))

  const selectedIndex = shallowRef<number | null>(null)
  const noteMode = shallowRef(false)

  // Session counters. Incremented only by direct user actions — undo and redo
  // replay the board without re-counting, because you cannot un-make a mistake
  // that already happened.
  const mistakes = shallowRef(0)
  const hintsUsed = shallowRef(0)

  const history = useHistory<Move>({ limit: historyLimit })

  const conflicts = computed(() => conflictsIn(board.value))
  const isSolved = computed(() => isComplete(board.value))

  /**
   * How many of each digit are still unplaced. Index i holds the count for
   * digit i + 1, so a fully-placed 9 leaves remainingCounts[8] === 0.
   */
  const remainingCounts = computed(() => {
    const counts = Array.from({ length: SIZE }, () => SIZE)
    for (let i = 0; i < CELLS; i++) {
      const value = board.value[i]
      if (value) counts[value - 1] = (counts[value - 1] ?? 0) - 1
    }
    return counts
  })

  /**
   * Filled cells that disagree with the solution. Distinct from `conflicts`:
   * a digit can be consistent with every peer and still be the wrong answer,
   * which conflict checking alone will never catch.
   */
  const incorrectCells = computed(() => {
    const wrong = new Set<number>()
    for (let i = 0; i < CELLS; i++) {
      const value = board.value[i] ?? 0
      const answer = solution.value[i] ?? 0
      if (value !== 0 && answer !== 0 && value !== answer) wrong.add(i)
    }
    return wrong
  })

  const selectedValue = computed(() => {
    const index = selectedIndex.value
    return index === null ? 0 : (board.value[index] ?? 0)
  })

  function isGiven(index: number): boolean {
    return (puzzle.value[index] ?? 0) !== 0
  }

  /** The single place that writes to the board. Everything else builds a Move. */
  function commit(move: Move, record: boolean): void {
    if (move.length === 0) return

    const nextBoard = board.value.slice()
    const nextNotes = notes.value.slice()

    for (const change of move) {
      nextBoard[change.index] = change.nextValue
      nextNotes[change.index] = change.nextNotes
    }

    board.value = nextBoard
    notes.value = nextNotes
    if (record) history.push(move)
  }

  function revert(move: Move): void {
    const nextBoard = board.value.slice()
    const nextNotes = notes.value.slice()

    for (const change of move) {
      nextBoard[change.index] = change.prevValue
      nextNotes[change.index] = change.prevNotes
    }

    board.value = nextBoard
    notes.value = nextNotes
  }

  function changeFor(index: number, nextValue: number, nextNotes: number): CellChange {
    return {
      index,
      prevValue: board.value[index] ?? 0,
      nextValue,
      prevNotes: notes.value[index] ?? 0,
      nextNotes,
    }
  }

  function peerNoteClears(index: number, digit: number): CellChange[] {
    if (!autoClearPeerNotes || digit === 0) return []

    const changes: CellChange[] = []
    for (const peer of peersOf(index)) {
      const peerNotes = notes.value[peer] ?? 0
      const cleared = clearNote(peerNotes, digit)
      if (cleared !== peerNotes) changes.push(changeFor(peer, board.value[peer] ?? 0, cleared))
    }
    return changes
  }

  function select(index: number | null): void {
    if (index !== null && (index < 0 || index >= CELLS)) return
    selectedIndex.value = index
  }

  function moveSelection(rowDelta: number, colDelta: number): void {
    const current = selectedIndex.value ?? 0
    const row = Math.min(SIZE - 1, Math.max(0, rowOf(current) + rowDelta))
    const col = Math.min(SIZE - 1, Math.max(0, colOf(current) + colDelta))
    selectedIndex.value = row * SIZE + col
  }

  function erase(index = selectedIndex.value): void {
    if (index === null || isGiven(index)) return

    const hasValue = (board.value[index] ?? 0) !== 0
    const hasNotes = (notes.value[index] ?? 0) !== 0
    if (!hasValue && !hasNotes) return

    commit([changeFor(index, 0, 0)], true)
  }

  /** Writes a digit into the selected cell (or `index`), clearing its notes. */
  function setValue(digit: number, index = selectedIndex.value): void {
    if (index === null || isGiven(index)) return
    if (digit < 1 || digit > SIZE) return

    // Pressing the digit already in the cell erases it — the usual toggle.
    if ((board.value[index] ?? 0) === digit) {
      erase(index)
      return
    }

    const answer = solution.value[index] ?? 0
    if (answer !== 0 && digit !== answer) mistakes.value++

    commit([changeFor(index, digit, 0), ...peerNoteClears(index, digit)], true)
  }

  function toggleNote(digit: number, index = selectedIndex.value): void {
    if (index === null || isGiven(index)) return
    if (digit < 1 || digit > SIZE) return
    // A note is meaningless in a cell that already holds a value.
    if ((board.value[index] ?? 0) !== 0) return

    commit([changeFor(index, 0, toggleNoteBit(notes.value[index] ?? 0, digit))], true)
  }

  /** Applies whichever digit the solution wants here. Undoable like any move. */
  function reveal(index = selectedIndex.value): boolean {
    if (index === null || isGiven(index)) return false

    const answer = solution.value[index] ?? 0
    if (answer === 0 || (board.value[index] ?? 0) === answer) return false

    hintsUsed.value++
    commit([changeFor(index, answer, 0), ...peerNoteClears(index, answer)], true)
    return true
  }

  function undo(): boolean {
    const move = history.undo()
    if (!move) return false
    revert(move)
    return true
  }

  function redo(): boolean {
    const move = history.redo()
    if (!move) return false
    commit(move, false)
    return true
  }

  /**
   * Replaces every empty cell's notes with its legal candidates, as ONE
   * undoable move — filling 50 cells and then needing 50 undos to take it back
   * would be miserable.
   */
  function fillNotes(): boolean {
    const candidates = computeCandidates(board.value)
    const move: Move = []

    for (let index = 0; index < CELLS; index++) {
      if (board.value[index]) continue
      const next = candidates[index] ?? 0
      if (next === (notes.value[index] ?? 0)) continue
      move.push(changeFor(index, 0, next))
    }

    if (move.length === 0) return false
    commit(move, true)
    return true
  }

  function notesFor(index: number): number[] {
    return notesToArray(notes.value[index] ?? 0)
  }

  function load(next: Puzzle): void {
    puzzle.value = next.puzzle.slice()
    solution.value = next.solution.slice()
    board.value = next.puzzle.slice()
    notes.value = new Uint16Array(CELLS)
    selectedIndex.value = null
    mistakes.value = 0
    hintsUsed.value = 0
    history.clear()
  }

  function reset(): void {
    board.value = puzzle.value.slice()
    notes.value = new Uint16Array(CELLS)
    mistakes.value = 0
    hintsUsed.value = 0
    history.clear()
  }

  /**
   * Rehydrates a previously saved game. History is intentionally NOT restored:
   * a move stack is only meaningful against the board it was recorded on, and
   * persisting it would let an undo run past the point the save was made.
   */
  function restore(state: {
    puzzle: Board
    solution: Board
    board: Board
    notes: Notes
    mistakes: number
    hintsUsed: number
  }): void {
    puzzle.value = state.puzzle.slice()
    solution.value = state.solution.slice()
    board.value = state.board.slice()
    notes.value = state.notes.slice()
    mistakes.value = state.mistakes
    hintsUsed.value = state.hintsUsed
    selectedIndex.value = null
    history.clear()
  }

  function setNoteMode(enabled: boolean): void {
    noteMode.value = enabled
  }

  function toggleNoteMode(): void {
    noteMode.value = !noteMode.value
  }

  /** Routes a digit press through whichever input mode is active. */
  function inputDigit(digit: number, index = selectedIndex.value): void {
    if (noteMode.value) toggleNote(digit, index)
    else setValue(digit, index)
  }

  return {
    // State, exposed as Readonly at the type level only. A runtime readonly()
    // would proxy the Uint8Array and break it, per the note above.
    board: board as Readonly<ShallowRef<Board>>,
    notes: notes as Readonly<ShallowRef<Notes>>,
    puzzle: puzzle as Readonly<ShallowRef<Board>>,
    solution: solution as Readonly<ShallowRef<Board>>,
    selectedIndex: selectedIndex as Readonly<ShallowRef<number | null>>,
    noteMode: noteMode as Readonly<ShallowRef<boolean>>,
    mistakes: mistakes as Readonly<ShallowRef<number>>,
    hintsUsed: hintsUsed as Readonly<ShallowRef<number>>,

    // Derived
    conflicts,
    incorrectCells,
    isSolved,
    remainingCounts,
    selectedValue,
    canUndo: history.canUndo,
    canRedo: history.canRedo,

    // Queries
    isGiven,
    notesFor,

    // Actions
    select,
    moveSelection,
    setValue,
    toggleNote,
    inputDigit,
    erase,
    fillNotes,
    reveal,
    undo,
    redo,
    load,
    reset,
    restore,
    setNoteMode,
    toggleNoteMode,
  }
}

export type SudokuGame = ReturnType<typeof useSudoku>
