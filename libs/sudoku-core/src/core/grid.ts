import { BOX_SIZE, CELLS, SIZE } from './constants'

export function rowOf(index: number): number {
  return Math.floor(index / SIZE)
}

export function colOf(index: number): number {
  return index % SIZE
}

export function boxOf(index: number): number {
  return Math.floor(rowOf(index) / BOX_SIZE) * BOX_SIZE + Math.floor(colOf(index) / BOX_SIZE)
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
