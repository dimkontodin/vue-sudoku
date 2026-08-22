import { describe, expect, it } from 'vitest'
import { useHistory } from '../useHistory'

describe('useHistory', () => {
  it('starts empty', () => {
    const history = useHistory<string>()
    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(false)
    expect(history.undo()).toBeUndefined()
    expect(history.redo()).toBeUndefined()
  })

  it('returns entries newest-first when undoing', () => {
    const history = useHistory<string>()
    history.push('a')
    history.push('b')

    expect(history.undo()).toBe('b')
    expect(history.undo()).toBe('a')
    expect(history.undo()).toBeUndefined()
  })

  it('replays entries in order when redoing', () => {
    const history = useHistory<string>()
    history.push('a')
    history.push('b')
    history.undo()
    history.undo()

    expect(history.redo()).toBe('a')
    expect(history.redo()).toBe('b')
    expect(history.redo()).toBeUndefined()
  })

  it('discards the redo branch once a new entry is pushed', () => {
    const history = useHistory<string>()
    history.push('a')
    history.push('b')
    history.undo()
    expect(history.canRedo.value).toBe(true)

    history.push('c')

    expect(history.canRedo.value).toBe(false)
    expect(history.redo()).toBeUndefined()
  })

  it('tracks canUndo/canRedo reactively', () => {
    const history = useHistory<number>()
    expect(history.canUndo.value).toBe(false)

    history.push(1)
    expect(history.canUndo.value).toBe(true)
    expect(history.canRedo.value).toBe(false)

    history.undo()
    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(true)
  })

  it('drops the oldest entries past the limit', () => {
    const history = useHistory<number>({ limit: 3 })
    for (const n of [1, 2, 3, 4, 5]) history.push(n)

    expect(history.past.value).toEqual([3, 4, 5])
  })

  it('clear() empties both stacks', () => {
    const history = useHistory<number>()
    history.push(1)
    history.undo()
    history.clear()

    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(false)
  })
})
