import { describe, expect, it } from 'vitest'
import { CELLS } from '../constants'
import { computeCandidates } from '../candidates'
import { noteCount, notesToArray } from '../notes'
import { generate } from '../generator'
import { MIN_CLUES, clueCount, formatBoard, parseBoard, validatePuzzle } from '../parse'
import { HARD_PUZZLES, parseGrid } from './fixtures'

describe('parseBoard', () => {
  it('reads a grid with dots for empties', () => {
    const { board, error } = parseBoard(HARD_PUZZLES.antiBacktrack)

    expect(error).toBeNull()
    expect(board).not.toBeNull()
    expect(board!.length).toBe(CELLS)
    expect(clueCount(board!)).toBe(17)
  })

  it('accepts zeros and underscores as empty', () => {
    const dots = '.'.repeat(80) + '5'
    const zeros = '0'.repeat(80) + '5'
    const unders = '_'.repeat(80) + '5'

    for (const text of [zeros, unders]) {
      expect(Array.from(parseBoard(text).board!)).toEqual(Array.from(parseBoard(dots).board!))
    }
  })

  it('ignores whitespace and newlines, so a pasted grid works', () => {
    const pretty = `
      53. .7. ...
      6.. 195 ...
      .98 ... .6.
      8.. .6. ..3
      4.. 8.3 ..1
      7.. .2. ..6
      .6. ... 28.
      ... 419 ..5
      ... .8. .79
    `
    const { board, error } = parseBoard(pretty)

    expect(error).toBeNull()
    expect(board![0]).toBe(5)
    expect(board![CELLS - 1]).toBe(9)
  })

  it('rejects the wrong length', () => {
    expect(parseBoard('123').error).toBe('length')
    expect(parseBoard('.'.repeat(82)).error).toBe('length')
  })

  it('rejects stray characters rather than guessing', () => {
    expect(parseBoard('x'.repeat(81)).error).toBe('characters')
    expect(parseBoard('.'.repeat(80) + '!').error).toBe('characters')
  })

  it('round-trips through formatBoard', () => {
    const { puzzle } = generate('medium')
    const text = formatBoard(puzzle)

    expect(text).toHaveLength(CELLS)
    expect(Array.from(parseBoard(text).board!)).toEqual(Array.from(puzzle))
  })
})

describe('validatePuzzle', () => {
  it('accepts a generated puzzle and returns its solution', () => {
    const { puzzle, solution } = generate('hard')
    const result = validatePuzzle(puzzle)

    expect(result.verdict).toBe('unique')
    expect(Array.from(result.solution!)).toEqual(Array.from(solution))
  })

  it('accepts a real 17-clue puzzle, the legal minimum', () => {
    const result = validatePuzzle(parseGrid(HARD_PUZZLES.antiBacktrack))

    expect(result.clues).toBe(MIN_CLUES)
    expect(result.verdict).toBe('unique')
  })

  it('reports an empty grid rather than churning on it', () => {
    expect(validatePuzzle(new Uint8Array(CELLS)).verdict).toBe('empty')
  })

  it('reports clashing clues and names the cells', () => {
    const board = new Uint8Array(CELLS)
    board[0] = 5
    board[1] = 5

    const result = validatePuzzle(board)
    expect(result.verdict).toBe('conflicting')
    expect(result.conflicts.has(0)).toBe(true)
    expect(result.conflicts.has(1)).toBe(true)
  })

  it('rejects fewer than 17 clues without searching', () => {
    const board = new Uint8Array(CELLS)
    for (let i = 0; i < 16; i++) board[i * 5] = 0
    board[0] = 1
    board[10] = 2
    board[20] = 3

    const result = validatePuzzle(board)
    expect(result.verdict).toBe('tooFewClues')
    expect(result.clues).toBeLessThan(MIN_CLUES)
  })

  it('detects an unsolvable grid whose clues do not clash', () => {
    // The interesting case, and the reason conflict checking alone is not
    // enough: writing a legal *candidate* into a cell keeps every pair of
    // clues consistent while still making the puzzle impossible to finish.
    const { puzzle, solution } = generate('hard')
    const candidates = computeCandidates(puzzle)

    let checked = 0
    for (let index = 0; index < CELLS && checked < 3; index++) {
      if (puzzle[index] || noteCount(candidates[index]!) < 2) continue

      for (const digit of notesToArray(candidates[index]!)) {
        if (digit === solution[index]) continue

        const board = puzzle.slice()
        board[index] = digit
        const result = validatePuzzle(board)

        // Not a clash — the digit was a legal candidate for this cell.
        expect(result.conflicts.size, `cell ${index} digit ${digit}`).toBe(0)
        expect(result.verdict, `cell ${index} digit ${digit}`).toBe('unsolvable')
        checked++
        break
      }
    }

    expect(checked).toBeGreaterThan(0)
  })

  it('detects an ambiguous grid', () => {
    // Strip a generated puzzle far below what keeps it unique.
    const { puzzle } = generate('easy')
    const board = puzzle.slice()
    let removed = 0
    for (let i = 0; i < CELLS && removed < 22; i++) {
      if (board[i]) {
        board[i] = 0
        removed++
      }
    }

    expect(['ambiguous', 'tooFewClues', 'tooHard']).toContain(validatePuzzle(board).verdict)
  })

  it('gives up rather than hanging when the budget is tiny', () => {
    const { puzzle } = generate('expert')
    expect(validatePuzzle(puzzle, 1).verdict).toBe('tooHard')
  })

  it('always returns a message the UI can show', () => {
    const cases = [new Uint8Array(CELLS), generate('easy').puzzle]
    for (const board of cases) {
      expect(validatePuzzle(board).message).toMatch(/\S/)
    }
  })
})
