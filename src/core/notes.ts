export function hasNote(notes: number, digit: number): boolean {
  return (notes & (1 << (digit - 1))) !== 0
}

export function setNote(notes: number, digit: number): number {
  return notes | (1 << (digit - 1))
}

export function clearNote(notes: number, digit: number): number {
  return notes & ~(1 << (digit - 1))
}

export function toggleNote(notes: number, digit: number): number {
  return hasNote(notes, digit)
    ? clearNote(notes, digit)
    : setNote(notes, digit)
}

export function notesToArray(notes: number): number[] {
  const result: number[] = []

  for (let digit = 1; digit <= 9; digit++) {
    if (hasNote(notes, digit)) result.push(digit)
  }

  return result
}
