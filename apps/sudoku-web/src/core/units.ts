import { BOX_SIZE, CELLS, SIZE } from './constants'
import { boxOf, colOf, rowOf } from './grid'

export type UnitKind = 'row' | 'col' | 'box'

export interface Unit {
  kind: UnitKind
  /** 0-8 within its kind. */
  index: number
  cells: readonly number[]
}

function buildUnits(): Unit[] {
  const units: Unit[] = []

  for (let index = 0; index < SIZE; index++) {
    const row: number[] = []
    const col: number[] = []
    const box: number[] = []

    for (let cell = 0; cell < CELLS; cell++) {
      if (rowOf(cell) === index) row.push(cell)
      if (colOf(cell) === index) col.push(cell)
      if (boxOf(cell) === index) box.push(cell)
    }

    units.push({ kind: 'row', index, cells: row })
    units.push({ kind: 'col', index, cells: col })
    units.push({ kind: 'box', index, cells: box })
  }

  return units
}

/** All 27 units, computed once. Order is row/col/box interleaved per index. */
export const UNITS: readonly Unit[] = buildUnits()

export const ROWS: readonly Unit[] = UNITS.filter((unit) => unit.kind === 'row')
export const COLS: readonly Unit[] = UNITS.filter((unit) => unit.kind === 'col')
export const BOXES: readonly Unit[] = UNITS.filter((unit) => unit.kind === 'box')

export function unitsOfKind(kind: UnitKind): readonly Unit[] {
  if (kind === 'row') return ROWS
  if (kind === 'col') return COLS
  return BOXES
}

/** Human-facing label, 1-based: "row 4", "column 7", "box 2". */
export function unitLabel(unit: Unit): string {
  const noun = unit.kind === 'row' ? 'row' : unit.kind === 'col' ? 'column' : 'box'
  return `${noun} ${unit.index + 1}`
}

/** "r4c7", the standard forum notation for a cell. */
export function cellLabel(index: number): string {
  return `r${rowOf(index) + 1}c${colOf(index) + 1}`
}

export function cellLabels(indices: readonly number[]): string {
  return indices.map(cellLabel).join(', ')
}

/** The three rows (or columns) a box spans. */
export function linesThroughBox(boxIndex: number, kind: 'row' | 'col'): number[] {
  const band = Math.floor(boxIndex / BOX_SIZE) * BOX_SIZE
  const stack = (boxIndex % BOX_SIZE) * BOX_SIZE
  const start = kind === 'row' ? band : stack
  return [start, start + 1, start + 2]
}
