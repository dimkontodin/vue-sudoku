import { BOX_SIZE, CELLS, SIZE } from './constants'

function computeRowOf(): Uint8Array {
  const table = new Uint8Array(CELLS)
  for (let i = 0; i < CELLS; i++) table[i] = Math.floor(i / SIZE)
  return table
}

function computeColOf(): Uint8Array {
  const table = new Uint8Array(CELLS)
  for (let i = 0; i < CELLS; i++) table[i] = i % SIZE
  return table
}

function computeBoxOf(row: Uint8Array, col: Uint8Array): Uint8Array {
  const table = new Uint8Array(CELLS)
  for (let i = 0; i < CELLS; i++) {
    table[i] = Math.floor(row[i]! / BOX_SIZE) * BOX_SIZE + Math.floor(col[i]! / BOX_SIZE)
  }
  return table
}

// Precomputed once — row/col/box never change for a given index, so a table
// lookup replaces the division/modulo that would otherwise run on every call
// from the solver's hot paths (peer computation, fish/intersection scans, ...).
const ROW_OF = computeRowOf()
const COL_OF = computeColOf()
const BOX_OF = computeBoxOf(ROW_OF, COL_OF)

export function rowOf(index: number): number {
  return ROW_OF[index]!
}

export function colOf(index: number): number {
  return COL_OF[index]!
}

export function boxOf(index: number): number {
  return BOX_OF[index]!
}

export function indexAt(row: number, col: number): number {
  return row * SIZE + col
}

function computePeers(): number[][] {
  const peers: number[][] = []

  for (let i = 0; i < CELLS; i++) {
    const row = rowOf(i)
    const col = colOf(i)
    const box = boxOf(i)
    const set = new Set<number>()

    for (let j = 0; j < CELLS; j++) {
      if (j === i) continue
      if (rowOf(j) === row || colOf(j) === col || boxOf(j) === box) {
        set.add(j)
      }
    }

    peers.push([...set])
  }

  return peers
}

// Computed once at module load and shared — every cell has exactly 20 peers
// (8 in its row, 8 in its column, 4 remaining in its box, no duplicates).
export const PEERS: readonly number[][] = computePeers()

export function peersOf(index: number): readonly number[] {
  // `index` is always a valid cell (0-80) by contract of every caller in this
  // codebase, so the array access can't actually be undefined here.
  return PEERS[index]!
}
