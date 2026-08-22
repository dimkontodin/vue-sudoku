import { describe, expect, it } from 'vitest'
import { CELLS } from '../constants'
import { boxOf, colOf, indexAt, peersOf, rowOf } from '../grid'

describe('grid', () => {
  it('maps row/col back to the same index', () => {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const index = indexAt(row, col)
        expect(rowOf(index)).toBe(row)
        expect(colOf(index)).toBe(col)
      }
    }
  })

  it('assigns each cell to one of 9 boxes, 9 cells per box', () => {
    const counts = new Map<number, number>()
    for (let i = 0; i < CELLS; i++) {
      const box = boxOf(i)
      counts.set(box, (counts.get(box) ?? 0) + 1)
    }
    expect(counts.size).toBe(9)
    for (const count of counts.values()) {
      expect(count).toBe(9)
    }
  })

  it('gives every cell exactly 20 peers', () => {
    for (let i = 0; i < CELLS; i++) {
      expect(peersOf(i)).toHaveLength(20)
    }
  })

  it('never includes a cell as its own peer', () => {
    for (let i = 0; i < CELLS; i++) {
      expect(peersOf(i)).not.toContain(i)
    }
  })

  it('is symmetric: j is a peer of i iff i is a peer of j', () => {
    for (let i = 0; i < CELLS; i++) {
      for (const j of peersOf(i)) {
        expect(peersOf(j)).toContain(i)
      }
    }
  })
})
