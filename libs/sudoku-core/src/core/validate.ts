import { CELLS } from './constants'
import { peersOf } from './grid'
import type { Board } from './types'

export function conflictsIn(board: Board): Set<number> {
  const conflicts = new Set<number>()

  for (let i = 0; i < CELLS; i++) {
    const value = board[i]
    if (!value) continue

    for (const peer of peersOf(i)) {
      if (board[peer] === value) {
        conflicts.add(i)
        conflicts.add(peer)
      }
    }
  }

  return conflicts
}

export function isComplete(board: Board): boolean {
  for (let i = 0; i < CELLS; i++) {
    if (!board[i]) return false
  }

  return conflictsIn(board).size === 0
}
