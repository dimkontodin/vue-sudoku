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
  return hasNote(notes, digit) ? clearNote(notes, digit) : setNote(notes, digit)
}

export function notesToArray(notes: number): number[] {
  const result: number[] = []

  for (let digit = 1; digit <= 9; digit++) {
    if (hasNote(notes, digit)) result.push(digit)
  }

  return result
}

/** All nine digits set. Useful as the starting mask for candidate derivation. */
export const ALL_NOTES = 0b1_1111_1111

/** How many digits are set in a mask. */
export function noteCount(notes: number): number {
  let mask = notes
  let count = 0
  while (mask) {
    mask &= mask - 1
    count++
  }
  return count
}

/** The single digit in a mask with exactly one bit set. Undefined behaviour otherwise. */
export function soleNote(notes: number): number {
  return 32 - Math.clz32(notes)
}

export function noteMask(digit: number): number {
  return 1 << (digit - 1)
}
