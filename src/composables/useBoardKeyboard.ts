import { onScopeDispose } from 'vue'
import type { SudokuGame } from './useSudoku'

export interface UseBoardKeyboardOptions {
  /** Where to listen. Defaults to `window`. */
  target?: EventTarget | null
  /** Turn handling off without tearing the listener down (e.g. while solved). */
  isEnabled?: () => boolean
}

const ARROW_DELTAS: Record<string, [row: number, col: number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
}

/**
 * Translates key presses into game actions. Holds no state of its own — it is
 * purely an input adapter, which is why it takes the game rather than creating
 * one, and why it is trivially testable by dispatching KeyboardEvents.
 */
export function useBoardKeyboard(game: SudokuGame, options: UseBoardKeyboardOptions = {}): void {
  const { isEnabled } = options
  const target = options.target ?? globalThis.window
  if (!target) return

  function handle(event: Event): void {
    const keyEvent = event as KeyboardEvent
    if (isEnabled != null && !isEnabled()) return

    // Never steal keys from a real input the user is typing into.
    const node = keyEvent.target as HTMLElement | null
    if (node?.isContentEditable) return
    if (node && /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName)) return

    const delta = ARROW_DELTAS[keyEvent.key]
    if (delta) {
      game.moveSelection(delta[0], delta[1])
      keyEvent.preventDefault()
      return
    }

    // Ctrl/Cmd+Z undoes, adding Shift redoes; Ctrl/Cmd+Y also redoes.
    if (keyEvent.ctrlKey || keyEvent.metaKey) {
      const key = keyEvent.key.toLowerCase()
      if (key === 'z') {
        if (keyEvent.shiftKey) game.redo()
        else game.undo()
        keyEvent.preventDefault()
      } else if (key === 'y') {
        game.redo()
        keyEvent.preventDefault()
      }
      return
    }

    if (keyEvent.key >= '1' && keyEvent.key <= '9') {
      game.inputDigit(Number(keyEvent.key))
      keyEvent.preventDefault()
      return
    }

    switch (keyEvent.key) {
      case 'Backspace':
      case 'Delete':
      case '0':
        game.erase()
        keyEvent.preventDefault()
        return
      case 'n':
      case 'N':
        game.toggleNoteMode()
        keyEvent.preventDefault()
        return
      case 'Escape':
        game.select(null)
        keyEvent.preventDefault()
        return
    }
  }

  target.addEventListener('keydown', handle)
  onScopeDispose(() => target.removeEventListener('keydown', handle))
}
