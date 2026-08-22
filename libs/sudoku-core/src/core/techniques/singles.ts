import { CELLS } from '../constants'
import { noteCount, noteMask, soleNote } from '../notes'
import { UNITS, cellLabel, unitLabel } from '../units'
import type { Technique, TechniqueStep } from './types'

/** A cell with exactly one remaining candidate must hold it. */
export const nakedSingle: Technique = (board, candidates) => {
  for (let index = 0; index < CELLS; index++) {
    if (board[index]) continue

    const mask = candidates[index] ?? 0
    if (noteCount(mask) !== 1) continue

    const digit = soleNote(mask)
    return {
      technique: 'nakedSingle',
      placements: [{ index, digit }],
      eliminations: [],
      pattern: [index],
      targets: [index],
      units: [],
      explanation: `${cellLabel(index)} has only one candidate left, so it must be ${digit}.`,
    } satisfies TechniqueStep
  }

  return null
}

/**
 * A digit with only one possible position in a unit must go there — even if
 * that cell has other candidates too, which is what makes it "hidden".
 */
export const hiddenSingle: Technique = (board, candidates) => {
  for (let unitIndex = 0; unitIndex < UNITS.length; unitIndex++) {
    const unit = UNITS[unitIndex]!

    for (let digit = 1; digit <= 9; digit++) {
      const mask = noteMask(digit)
      let found = -1
      let count = 0
      let alreadyPlaced = false

      for (const cell of unit.cells) {
        if (board[cell] === digit) {
          alreadyPlaced = true
          break
        }
        if (board[cell]) continue
        if ((candidates[cell] ?? 0) & mask) {
          found = cell
          count++
        }
      }

      if (alreadyPlaced || count !== 1) continue

      // A naked single is the same placement found more cheaply, so leave it
      // to that technique rather than crediting this one.
      if (noteCount(candidates[found] ?? 0) === 1) continue

      return {
        technique: 'hiddenSingle',
        placements: [{ index: found, digit }],
        eliminations: [],
        pattern: [found],
        targets: [found],
        units: [unitIndex],
        explanation:
          `${digit} can only go in ${cellLabel(found)} within ${unitLabel(unit)}, ` +
          `so that cell is ${digit}.`,
      } satisfies TechniqueStep
    }
  }

  return null
}
