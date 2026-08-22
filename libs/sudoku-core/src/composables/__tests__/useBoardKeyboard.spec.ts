// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { effectScope } from 'vue'
import { generate } from '../../core/generator'
import { useSudoku } from '../useSudoku'
import { useBoardKeyboard } from '../useBoardKeyboard'

function setup(options: { isEnabled?: () => boolean } = {}) {
  const source = generate('easy')
  const scope = effectScope()
  let game!: ReturnType<typeof useSudoku>

  scope.run(() => {
    game = useSudoku(source)
    useBoardKeyboard(game, { target: window, isEnabled: options.isEnabled })
  })

  const press = (key: string, init: KeyboardEventInit = {}) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }))
  }

  const firstEmpty = source.puzzle.findIndex((value) => value === 0)

  return { game, press, scope, source, firstEmpty }
}

describe('useBoardKeyboard', () => {
  it('moves the selection with the arrow keys', () => {
    const { game, press, scope } = setup()

    game.select(40)
    press('ArrowUp')
    expect(game.selectedIndex.value).toBe(31)
    press('ArrowDown')
    expect(game.selectedIndex.value).toBe(40)
    press('ArrowLeft')
    expect(game.selectedIndex.value).toBe(39)
    press('ArrowRight')
    expect(game.selectedIndex.value).toBe(40)

    scope.stop()
  })

  it('types a digit into the selected cell', () => {
    const { game, press, scope, firstEmpty } = setup()

    game.select(firstEmpty)
    press('7')

    expect(game.board.value[firstEmpty]).toBe(7)
    scope.stop()
  })

  it('erases with Backspace, Delete and 0', () => {
    const { game, press, scope, firstEmpty } = setup()

    for (const key of ['Backspace', 'Delete', '0']) {
      game.select(firstEmpty)
      press('5')
      expect(game.board.value[firstEmpty]).toBe(5)

      press(key)
      expect(game.board.value[firstEmpty]).toBe(0)
    }

    scope.stop()
  })

  it('toggles note mode with n, sending later digits to notes', () => {
    const { game, press, scope, firstEmpty } = setup()

    game.select(firstEmpty)
    press('n')
    expect(game.noteMode.value).toBe(true)

    press('3')
    expect(game.board.value[firstEmpty]).toBe(0)
    expect(game.notesFor(firstEmpty)).toEqual([3])

    scope.stop()
  })

  it('clears the selection with Escape', () => {
    const { game, press, scope } = setup()

    game.select(10)
    press('Escape')

    expect(game.selectedIndex.value).toBeNull()
    scope.stop()
  })

  it('undoes and redoes with Ctrl+Z and Ctrl+Shift+Z', () => {
    const { game, press, scope, firstEmpty } = setup()

    game.select(firstEmpty)
    press('4')
    expect(game.board.value[firstEmpty]).toBe(4)

    press('z', { ctrlKey: true })
    expect(game.board.value[firstEmpty]).toBe(0)

    press('z', { ctrlKey: true, shiftKey: true })
    expect(game.board.value[firstEmpty]).toBe(4)

    scope.stop()
  })

  it('also redoes with Ctrl+Y', () => {
    const { game, press, scope, firstEmpty } = setup()

    game.select(firstEmpty)
    press('4')
    press('z', { ctrlKey: true })
    press('y', { ctrlKey: true })

    expect(game.board.value[firstEmpty]).toBe(4)
    scope.stop()
  })

  it('ignores keys while disabled', () => {
    const { game, press, scope, firstEmpty } = setup({ isEnabled: () => false })

    game.select(firstEmpty)
    press('7')

    expect(game.board.value[firstEmpty]).toBe(0)
    scope.stop()
  })

  it('does not steal keys typed into an input', () => {
    const { game, scope, firstEmpty } = setup()
    const input = document.createElement('input')
    document.body.append(input)

    game.select(firstEmpty)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '7', bubbles: true }))

    expect(game.board.value[firstEmpty]).toBe(0)

    input.remove()
    scope.stop()
  })

  it('stops listening once its scope is disposed', () => {
    const { game, press, scope, firstEmpty } = setup()

    game.select(firstEmpty)
    scope.stop()
    press('7')

    expect(game.board.value[firstEmpty]).toBe(0)
  })
})
