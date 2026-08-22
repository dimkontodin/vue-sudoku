import { describe, expect, it } from 'vitest'
import { clearNote, hasNote, notesToArray, setNote, toggleNote } from '../notes'

describe('notes', () => {
  it('has no notes set initially', () => {
    for (let digit = 1; digit <= 9; digit++) {
      expect(hasNote(0, digit)).toBe(false)
    }
  })

  it('sets and detects a single note', () => {
    const notes = setNote(0, 5)
    expect(hasNote(notes, 5)).toBe(true)
    expect(hasNote(notes, 4)).toBe(false)
  })

  it('clears a note without affecting others', () => {
    let notes = setNote(0, 3)
    notes = setNote(notes, 7)
    notes = clearNote(notes, 3)
    expect(hasNote(notes, 3)).toBe(false)
    expect(hasNote(notes, 7)).toBe(true)
  })

  it('toggles a note on and back off', () => {
    let notes = toggleNote(0, 9)
    expect(hasNote(notes, 9)).toBe(true)
    notes = toggleNote(notes, 9)
    expect(hasNote(notes, 9)).toBe(false)
  })

  it('lists all set digits in ascending order', () => {
    let notes = setNote(0, 8)
    notes = setNote(notes, 1)
    notes = setNote(notes, 5)
    expect(notesToArray(notes)).toEqual([1, 5, 8])
  })

  it('round-trips all 9 digits', () => {
    let notes = 0
    for (let digit = 1; digit <= 9; digit++) {
      notes = setNote(notes, digit)
    }
    expect(notesToArray(notes)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })
})
